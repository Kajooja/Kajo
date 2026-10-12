-- #232C freezes the visible outcome evidence actually read by this consumer.
-- It is neither commit-time history nor retrospective prediction input. Existing
-- scalar evaluators, Events, ranking functions and shadow artifacts are untouched.
create table private.shared_round_outcome_captures (
  id uuid primary key,
  profile_id uuid not null,
  round_id uuid not null,
  item_id uuid not null,
  -- The old immutable receipt supplies all source-erasure cascades without
  -- taking a FK lock on the mutable round/Profile held by an answering actor.
  source_command_id uuid not null references private.shared_rating_round_receipts(command_id) on delete cascade,
  source_revision integer not null check(source_revision between 1 and 4096),
  request jsonb not null check(jsonb_typeof(request)='object' and octet_length(request::text)<=4096),
  result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<=524288),
  observed_at timestamptz not null
);
create index shared_round_outcome_captures_round_idx on private.shared_round_outcome_captures(round_id);
create index shared_round_outcome_captures_source_idx on private.shared_round_outcome_captures(source_command_id);

create table private.shared_round_vector_comparisons (
  id uuid primary key,
  capture_id uuid not null references private.shared_round_outcome_captures(id) on delete cascade,
  genome_id uuid not null references private.predictor_genomes(id),
  window_id uuid not null references private.evaluation_windows(id),
  request jsonb not null check(jsonb_typeof(request)='object' and octet_length(request::text)<=4096),
  result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<=8388608),
  observed_at timestamptz not null
);
create index shared_round_vector_comparisons_capture_idx on private.shared_round_vector_comparisons(capture_id);
create index shared_round_vector_comparisons_genome_idx on private.shared_round_vector_comparisons(genome_id);
create index shared_round_vector_comparisons_window_idx on private.shared_round_vector_comparisons(window_id);
alter table private.shared_round_outcome_captures enable row level security;
alter table private.shared_round_vector_comparisons enable row level security;
revoke all on table private.shared_round_outcome_captures,private.shared_round_vector_comparisons
  from public,anon,authenticated,service_role;
create trigger shared_round_outcome_capture_immutable before update on private.shared_round_outcome_captures
  for each row execute function private.deny_shared_round_evidence_update_v1();
create trigger shared_round_vector_comparison_immutable before update on private.shared_round_vector_comparisons
  for each row execute function private.deny_shared_round_evidence_update_v1();

create function private.get_shared_round_outcome_capture_v1(target_capture_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select result from private.shared_round_outcome_captures where id=target_capture_id;
$$;
create function private.get_shared_round_vector_comparison_v1(target_comparison_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select result from private.shared_round_vector_comparisons where id=target_comparison_id;
$$;

create function private.capture_shared_rating_round_outcome_v1(
  capture_id uuid,target_profile_id uuid,target_round_id uuid,
  outcome_cutoff timestamptz,evidence_cutoff timestamptz,maturity_interval interval
)
returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' set extra_float_digits='3' as $$
declare request jsonb; prior record; outcome jsonb; commands jsonb; observed_at timestamptz; result jsonb;
begin
  if capture_id is null or target_profile_id is null or target_round_id is null
    or outcome_cutoff is null or evidence_cutoff is null or not isfinite(outcome_cutoff) or not isfinite(evidence_cutoff)
    or outcome_cutoff>clock_timestamp() or evidence_cutoff>clock_timestamp()
    or maturity_interval is null or not isfinite(maturity_interval)
    or extract(year from maturity_interval)<>0 or extract(month from maturity_interval)<>0
    or maturity_interval<interval '0 seconds' or maturity_interval>interval '90 days' then
    raise exception 'Invalid Shared round capture boundary' using errcode='22023'; end if;
  request := jsonb_build_object('captureId',capture_id,'profileId',target_profile_id,'roundId',target_round_id,
    'outcomeCutoff',outcome_cutoff,'evidenceCutoff',evidence_cutoff,'maturitySeconds',extract(epoch from maturity_interval));
  perform pg_advisory_xact_lock(hashtextextended('shared-round-capture-id:'||capture_id::text,0));
  select c.* into prior from private.shared_round_outcome_captures c where c.id=capture_id;
  if found then
    if prior.request<>request then raise exception 'Shared round capture ID payload mismatch' using errcode='22023'; end if;
    return prior.result;
  end if;
  -- Advisory serialization needs a fresh post-lock snapshot for the count cap.
  -- REPEATABLE READ could otherwise allocate from a stale count of fifteen.
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Shared round capture allocation requires READ COMMITTED' using errcode='25001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-round-capture-allocation:'||target_round_id::text,0));
  if (select count(*) from private.shared_round_outcome_captures c where c.round_id=target_round_id)>=16 then
    raise exception 'Shared round capture limit reached' using errcode='54000'; end if;
  -- One SQL statement and the STABLE reader share a single MVCC snapshot.
  with projection as materialized (
    select private.shared_rating_round_outcome_v1(target_profile_id,target_round_id,
      outcome_cutoff,evidence_cutoff,maturity_interval) outcome
  )
  select p.outcome,(select coalesce(jsonb_agg(c.command_id order by (c.result#>>'{round,revision}')::integer),'[]'::jsonb)
    from private.shared_rating_round_receipts c where c.round_id=target_round_id
      and (c.result#>>'{round,revision}')::integer<=(p.outcome#>>'{source,revision}')::integer)
    into outcome,commands from projection p;
  if outcome is null then raise exception 'No visible Shared round outcome' using errcode='22023'; end if;
  if jsonb_array_length(commands)<>(outcome#>>'{source,revision}')::integer then
    raise exception 'Shared round capture prefix unavailable' using errcode='55000'; end if;
  -- This records an actual read boundary, not an invented historical commit.
  observed_at := clock_timestamp();
  result := jsonb_build_object('contractVersion','shared-round-capture-v1','captureId',capture_id,
    'observedAt',observed_at,'sourceBasis','SERVER_VISIBLE_COMMAND_RECEIPT_PREFIX','usage','OUTCOME_EVIDENCE_ONLY',
    'historicalFeatureEligible',false,'interpretationVersion','shared-round-outcome-v1',
    'maturityVersion','explicit-elapsed-seconds-v1','sourceCommandId',outcome#>'{source,commandId}',
    'sourceRevision',outcome#>'{source,revision}','visibleCommandIds',commands,
    'outcomeDigest',md5(outcome::text),'outcome',outcome,'groupReward',null,'learnable',false);
  if octet_length(result::text)>524288 then raise exception 'Shared round capture snapshot limit exceeded' using errcode='54000'; end if;
  insert into private.shared_round_outcome_captures(id,profile_id,round_id,item_id,source_command_id,
    source_revision,request,result,observed_at) values(capture_id,target_profile_id,target_round_id,
    (outcome#>>'{round,itemId}')::uuid,(outcome#>>'{source,commandId}')::uuid,
    (outcome#>>'{source,revision}')::integer,request,result,observed_at);
  return result;
end;
$$;

-- All mutable production inputs are materialized per actor in one statement;
-- this STABLE invocation gives the whole vector one consistent read snapshot.
-- Persist only compact ranks/selection/scores/checksums, not duplicate features.
create function private.shared_round_vector_comparison_projection_v1(
  capture jsonb,target_genome_id uuid,target_window_id uuid
)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC' set extra_float_digits='3' as $$
declare
  genome private.predictor_genomes%rowtype; evaluation_window private.evaluation_windows%rowtype;
  response jsonb; source_run jsonb; shadow_run jsonb; source_pool jsonb; shadow_pool jsonb;
  source_target jsonb; shadow_target jsonb; source_compact jsonb; shadow_compact jsonb;
  source_id uuid; shadow_id uuid; reason text; expected_code text; expected_scope text;
  participants integer; pool_count integer; supported integer := 0; pairs jsonb := '[]'; mask jsonb := '[]';
  ready boolean; status text; outcome jsonb := capture->'outcome';
begin
  select g.* into genome from private.predictor_genomes g where g.id=target_genome_id;
  if not found then raise exception 'Unknown Shared comparison genome' using errcode='22023'; end if;
  select w.* into evaluation_window from private.evaluation_windows w where w.id=target_window_id;
  if not found or not isfinite(evaluation_window.prediction_from) or not isfinite(evaluation_window.prediction_until)
    or not isfinite(evaluation_window.input_cutoff) or not isfinite(evaluation_window.outcome_cutoff)
    or evaluation_window.outcome_cutoff>clock_timestamp() or genome.created_at>evaluation_window.input_cutoff
    or (outcome->>'outcomeCutoff')::timestamptz is distinct from evaluation_window.outcome_cutoff then
    raise exception 'Invalid Shared comparison evaluation window' using errcode='22023'; end if;
  participants := jsonb_array_length(outcome->'responses');
  if participants not between 2 and 32 then raise exception 'Shared comparison vector unavailable' using errcode='55000'; end if;
  ready := outcome->>'vectorStatus'='READY_FOR_VECTOR_REVIEW';
  for response in select value from jsonb_array_elements(outcome->'responses') loop
    source_id := null; shadow_id := null; source_run := null; shadow_run := null;
    source_pool := null; shadow_pool := null; source_target := null; shadow_target := null;
    source_compact := null; shadow_compact := null;
    reason := case when not ready then 'OUTCOME_NOT_READY'
      when response->>'status'<>'RATED' then 'RESPONSE_NOT_RATED'
      when response#>>'{attribution,status}' not in ('VALIDATED_TRACE','LATE_EXPOSURE_V1')
        or response#>>'{attribution,predictionId}' is null then 'NO_OWN_ORIGIN' else 'SUPPORTED' end;
    if reason='SUPPORTED' then
      source_id := (response#>>'{attribution,predictionId}')::uuid;
      with production as materialized (
        select r.* from private.prediction_runs r where r.id=source_id
      ), shadow as materialized (
        select s.* from private.shadow_prediction_runs s where s.source_prediction_id=source_id and s.genome_id=target_genome_id
      )
      select (select to_jsonb(r) from production r),(select to_jsonb(s) from shadow s),
        (select coalesce(jsonb_agg(to_jsonb(c) order by c.item_id),'[]'::jsonb) from
          (select c.* from private.prediction_candidates c where c.prediction_id=source_id order by c.item_id limit 1001) c),
        (select coalesce(jsonb_agg(to_jsonb(c) order by c.item_id),'[]'::jsonb) from
          (select c.* from private.shadow_prediction_candidates c where c.shadow_prediction_id=(select s.id from shadow s)
            order by c.item_id limit 1001) c)
        into source_run,shadow_run,source_pool,shadow_pool;
      if source_run is null then reason := 'SOURCE_UNAVAILABLE';
      elsif source_run->>'profile_id' is distinct from outcome#>>'{round,profileId}'
        or source_run->>'actor_user_id' is distinct from response->>'actorUserId'
        or source_run->>'session_id' is distinct from response#>>'{origin,sessionId}'
        or source_run->>'discovery_mode' is distinct from response#>>'{origin,discoveryMode}'
        or (source_run->>'requested_at')::timestamptz>(response->>'receivedAt')::timestamptz then reason := 'SOURCE_SCOPE_MISMATCH';
      elsif (source_run->>'requested_at')::timestamptz<evaluation_window.prediction_from
        or (source_run->>'requested_at')::timestamptz>=evaluation_window.prediction_until
        or (source_run->>'requested_at')::timestamptz>evaluation_window.input_cutoff then reason := 'SOURCE_OUTSIDE_WINDOW';
      elsif jsonb_array_length(source_pool)>1000 or jsonb_array_length(shadow_pool)>1000 then reason := 'CANDIDATE_POOL_LIMIT';
      elsif shadow_run is null then reason := 'SHADOW_UNAVAILABLE';
      end if;
    end if;
    if reason='SUPPORTED' then
      shadow_id := (shadow_run->>'id')::uuid;
      expected_code := case when 'frozen-page-v1'=any(string_to_array(source_run->>'policy_version','+'))
        then 'shadow-page-replay-v1' else 'shadow-replay-v2' end;
      expected_scope := case when expected_code='shadow-page-replay-v1'
        then 'FROZEN_SOURCE_POOL_AND_OBSERVED_PAGE_PREFIX' else 'FROZEN_SOURCE_POOL' end;
      if shadow_run->>'profile_id' is distinct from source_run->>'profile_id'
        or shadow_run->>'actor_user_id' is distinct from source_run->>'actor_user_id'
        or shadow_run->>'session_id' is distinct from source_run->>'session_id'
        or shadow_run->>'requested_item_type' is distinct from source_run->>'requested_item_type'
        or shadow_run->>'discovery_mode' is distinct from source_run->>'discovery_mode'
        or (shadow_run->>'as_of')::timestamptz is distinct from (source_run->>'requested_at')::timestamptz
        or shadow_run->'context' is distinct from source_run->'context'
        or shadow_run->'state_snapshot' is distinct from source_run->'state_snapshot'
        or shadow_run->>'source_model_version' is distinct from source_run->>'model_version'
        or shadow_run->>'source_policy_version' is distinct from source_run->>'policy_version'
        or shadow_run->>'memory_version' is distinct from genome.memory_version
        or shadow_run->>'outcome_version' is distinct from genome.outcome_version
        or shadow_run->>'reward_version' is distinct from genome.reward_version then reason := 'SHADOW_SCOPE_MISMATCH';
      elsif shadow_run->>'code_version' is distinct from expected_code
        or shadow_run->>'feature_version' is distinct from 'prediction-features-v2'
        or not ('frozen-replay-v2'=any(string_to_array(source_run->>'policy_version','+')))
        or exists(select 1 from jsonb_array_elements(source_pool) c
          where c#>>'{explanation,scoringFeatures,version}' is distinct from 'prediction-features-v2'
            or jsonb_typeof(c#>'{explanation,resurfacingInput}') is distinct from 'object')
        or exists(select 1 from jsonb_array_elements(shadow_pool) c
          where c#>>'{explanation,version}' is distinct from expected_code
            or c#>>'{explanation,comparisonScope}' is distinct from expected_scope) then reason := 'UNSUPPORTED_REPLAY';
      end if;
    end if;
    if reason='SUPPORTED' then
      pool_count := jsonb_array_length(source_pool);
      if pool_count<1 or pool_count<>(source_run->>'candidate_count')::integer
        or pool_count<>jsonb_array_length(shadow_pool) or pool_count<>(shadow_run->>'candidate_count')::integer
        or (shadow_run->>'hypothetical_result_count')::integer<>(source_run->>'result_count')::integer
        or (select count(*) from jsonb_array_elements(source_pool) c where c->'selected_for_delivery'='true'::jsonb)
          <>(source_run->>'result_count')::integer
        or (select count(distinct c->>'source_rank') from jsonb_array_elements(source_pool) c)<>pool_count
        or (select count(distinct c->>'final_rank') from jsonb_array_elements(source_pool) c)<>pool_count
        or (select max((c->>'source_rank')::integer) from jsonb_array_elements(source_pool) c)<>pool_count
        or (select max((c->>'final_rank')::integer) from jsonb_array_elements(source_pool) c)<>pool_count
        or (select count(distinct c->>'shadow_rank') from jsonb_array_elements(shadow_pool) c)<>pool_count
        or (select max((c->>'shadow_rank')::integer) from jsonb_array_elements(shadow_pool) c)<>pool_count
        or (select min((c->>'shadow_rank')::integer) from jsonb_array_elements(shadow_pool) c)<>1
        or exists(select 1 from jsonb_array_elements(source_pool) p
          full join jsonb_array_elements(shadow_pool) s on p->>'item_id'=s->>'item_id'
          where p is null or s is null or p->'source_rank' is distinct from s->'source_rank'
            or p->'final_rank' is distinct from s->'production_final_rank'
            or p->'source_score' is distinct from s->'source_score'
            or p->'final_score' is distinct from s->'production_final_score'
            or p->'scenario_score' is distinct from s->'scenario_score'
            or p->'explanation' is distinct from s#>'{explanation,input,productionExplanation}') then reason := 'CANDIDATE_POOL_MISMATCH';
      end if;
      select c into source_target from jsonb_array_elements(source_pool) c where c->>'item_id'=outcome#>>'{round,itemId}';
      select c into shadow_target from jsonb_array_elements(shadow_pool) c where c->>'item_id'=outcome#>>'{round,itemId}';
      if reason='SUPPORTED' and (source_target is null or source_target->'selected_for_delivery' is distinct from 'true'::jsonb
        or shadow_target is null) then reason := 'SOURCE_ITEM_NOT_SELECTED'; end if;
    end if;
    if source_run is not null and jsonb_array_length(source_pool)<=1000 then
      select jsonb_agg(jsonb_build_object('itemId',c->'item_id','sourceRank',c->'source_rank','finalRank',c->'final_rank',
        'sourceScore',c->'source_score','finalScore',c->'final_score','selectedForDelivery',c->'selected_for_delivery',
        'explanationChecksum',md5((c->'explanation')::text),
        'scoringFeaturesChecksum',md5((c#>'{explanation,scoringFeatures}')::text),
        'resurfacingInputChecksum',md5((c#>'{explanation,resurfacingInput}')::text)) order by c->>'item_id')
        into source_compact from jsonb_array_elements(source_pool) c;
    end if;
    if shadow_run is not null and jsonb_array_length(shadow_pool)<=1000 then
      select jsonb_agg(jsonb_build_object('itemId',c->'item_id','sourceRank',c->'source_rank',
        'productionFinalRank',c->'production_final_rank','shadowRank',c->'shadow_rank',
        'sourceScore',c->'source_score','productionFinalScore',c->'production_final_score','shadowScore',c->'shadow_score',
        'hypotheticalSelected',c->'hypothetical_selected','explanationChecksum',md5((c->'explanation')::text)) order by c->>'item_id')
        into shadow_compact from jsonb_array_elements(shadow_pool) c;
    end if;
    if reason='SUPPORTED' then supported := supported+1; mask := mask||jsonb_build_array(response->'actorUserId'); end if;
    pairs := pairs||jsonb_build_array(jsonb_build_object('actorUserId',response->'actorUserId',
      'responseRevision',response->'responseRevision','rating',response->'rating',
      'sourcePredictionId',source_id,'shadowPredictionId',shadow_id,'supportStatus',reason,
      'production',case when source_target is null then null else jsonb_build_object('rank',source_target->'final_rank',
        'selectedForDelivery',source_target->'selected_for_delivery','modelVersion',source_run->'model_version',
        'policyVersion',source_run->'policy_version') end,
      'shadow',case when shadow_target is null then null else jsonb_build_object('rank',shadow_target->'shadow_rank',
        'hypotheticalSelected',shadow_target->'hypothetical_selected','codeVersion',shadow_run->'code_version',
        'featureVersion',shadow_run->'feature_version','memoryVersion',shadow_run->'memory_version',
        'outcomeVersion',shadow_run->'outcome_version','rewardVersion',shadow_run->'reward_version') end,
      'productionTrace',case when source_run is null then null else jsonb_build_object('run',source_run,'candidates',source_compact) end,
      'shadowTrace',case when shadow_run is null then null else jsonb_build_object('run',shadow_run,'candidates',shadow_compact) end));
  end loop;
  status := case when not ready then 'OUTCOME_NOT_READY' when supported=participants then 'COMPLETE_VECTOR_SUPPORTED'
    when supported>0 then 'PARTIAL_VECTOR_SUPPORTED' else 'NO_SUPPORTED_VECTOR' end;
  return jsonb_build_object('contractVersion','shared-round-vector-comparison-v1','captureId',capture->'captureId',
    'genomeId',target_genome_id,'evaluationWindowId',target_window_id,'usage','OUTCOME_EVIDENCE_ONLY',
    'comparisonBasis','SAME_FROZEN_VECTOR_AND_COMMON_SUPPORT_MASK','interpretationVersion','shared-round-outcome-v1',
    'metricVersion','shared-round-paired-support-v1','outcomeDigest',capture->'outcomeDigest','capturedOutcome',outcome,
    'evaluationWindow',to_jsonb(evaluation_window),'genome',to_jsonb(genome),'supportStatus',status,
    'vectorComparisonEligible',status='COMPLETE_VECTOR_SUPPORTED','commonSupportMask',mask,'commonSupportDigest',md5(mask::text),
    'coverage',jsonb_build_object('participantCount',participants,'supportedParticipantCount',supported,
      'unsupportedParticipantCount',participants-supported,'roundObservationCount',case when status='COMPLETE_VECTOR_SUPPORTED' then 1 else 0 end),
    'pairs',pairs,
    'production',jsonb_build_object('captureId',capture->'captureId','outcomeDigest',capture->'outcomeDigest',
      'supportMask',mask,'supportDigest',md5(mask::text)),
    'shadow',jsonb_build_object('captureId',capture->'captureId','outcomeDigest',capture->'outcomeDigest',
      'supportMask',mask,'supportDigest',md5(mask::text)),
    'groupReward',null,'productionMetric',null,'challengerMetric',null,'advantage',null,'learnable',false,'historicalFeatureEligible',false);
end;
$$;

create function private.compare_shared_round_outcome_capture_v1(
  comparison_id uuid,target_capture_id uuid,target_genome_id uuid,target_window_id uuid
)
returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' set extra_float_digits='3' as $$
declare request jsonb; prior record; capture jsonb; result jsonb; observed_at timestamptz;
begin
  if comparison_id is null or target_capture_id is null or target_genome_id is null or target_window_id is null then
    raise exception 'Shared comparison identities are required' using errcode='22023'; end if;
  request := jsonb_build_object('comparisonId',comparison_id,'captureId',target_capture_id,'genomeId',target_genome_id,'evaluationWindowId',target_window_id);
  perform pg_advisory_xact_lock(hashtextextended('shared-round-comparison-id:'||comparison_id::text,0));
  select c.* into prior from private.shared_round_vector_comparisons c where c.id=comparison_id;
  if found then
    if prior.request<>request then raise exception 'Shared comparison ID payload mismatch' using errcode='22023'; end if;
    return prior.result;
  end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Shared comparison allocation requires READ COMMITTED' using errcode='25001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shared-round-comparison-allocation:'||target_capture_id::text,0));
  if (select count(*) from private.shared_round_vector_comparisons c where c.capture_id=target_capture_id)>=16 then
    raise exception 'Shared comparison limit reached' using errcode='54000'; end if;
  select c.result into capture from private.shared_round_outcome_captures c where c.id=target_capture_id;
  if not found then raise exception 'Unknown Shared outcome capture' using errcode='22023'; end if;
  result := private.shared_round_vector_comparison_projection_v1(capture,target_genome_id,target_window_id);
  observed_at := clock_timestamp();
  result := result||jsonb_build_object('comparisonId',comparison_id,'observedAt',observed_at);
  if octet_length(result::text)>8388608 then raise exception 'Shared comparison snapshot limit exceeded' using errcode='54000'; end if;
  insert into private.shared_round_vector_comparisons(id,capture_id,genome_id,window_id,request,result,observed_at)
    values(comparison_id,target_capture_id,target_genome_id,target_window_id,request,result,observed_at);
  return result;
end;
$$;

revoke all on function private.get_shared_round_outcome_capture_v1(uuid),private.get_shared_round_vector_comparison_v1(uuid),
  private.capture_shared_rating_round_outcome_v1(uuid,uuid,uuid,timestamptz,timestamptz,interval),
  private.shared_round_vector_comparison_projection_v1(jsonb,uuid,uuid),
  private.compare_shared_round_outcome_capture_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
