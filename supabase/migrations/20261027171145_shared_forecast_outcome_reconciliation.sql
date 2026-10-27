-- #232F: read-only reconciliation of an actually consumed forecast with an
-- immutable #232C outcome capture. No delivery, cohort or metric is invented.
do $preflight$
begin
  if current_user<>'postgres'
    or exists(select 1 from pg_proc where pronamespace='private'::regnamespace
      and proname='reconcile_shared_forecast_outcome_v1')
    or to_regclass('private.shared_round_prediction_consumptions') is null
    or to_regprocedure('private.validate_shared_consumption_v1(jsonb)') is null
    or to_regprocedure('private.validate_native_final_source_v1(uuid)') is null then
    raise exception 'Shared reconciliation predecessor or owner unavailable';
  end if;
end;$preflight$;

create function private.reconcile_shared_forecast_outcome_v1(
  target_prediction_id uuid, target_capture_id uuid, minimum_maturity_seconds integer
)
returns jsonb language plpgsql stable security invoker
set search_path='' set timezone='UTC' set extra_float_digits=3 as $reconcile$
declare
  source private.prediction_runs%rowtype;
  binding private.shared_round_prediction_consumptions%rowtype;
  prepared private.shared_round_prediction_inputs%rowtype;
  captured private.shared_round_outcome_captures%rowtype;
  selected private.shared_rating_round_receipts%rowtype;
  candidate private.prediction_candidates%rowtype;
  outcome jsonb; marker jsonb; members jsonb; prefix_ids jsonb; input_prefix_ids jsonb;
  responses jsonb; first_response jsonb; status text; result jsonb;
  receipt_count integer; revision_count integer; maximum_revision integer;
begin
  if target_prediction_id is null or target_capture_id is null
    or minimum_maturity_seconds is null or minimum_maturity_seconds not between 0 and 7776000 then
    raise exception 'Invalid Shared reconciliation request' using errcode='22023';
  end if;
  -- One STABLE invocation reads one statement snapshot. It creates no copied
  -- artifact that could outlive the existing source-erasure owners.
  result:=jsonb_build_object('contractVersion','shared-forecast-outcome-v1',
    'predictionId',target_prediction_id,'captureId',target_capture_id,
    'policy',jsonb_build_object('version','shared-forecast-outcome-policy-v1',
      'selectionBasis','EXPLICIT_FORECAST_CAPTURE_PAIR','cohortAdmission','NONE',
      'minimumMaturitySeconds',minimum_maturity_seconds,
      'labelPolicy','LATEST_CAPTURED_RESPONSE_WITH_FIRST_RESPONSE_LINEAGE',
      'observationUnit','PROFILE_ROUND_EXPERIENCE_NOT_MEMBER_OR_REVISION'),
    'forecastKind','UNCALIBRATED_ORDINAL','exposureToForecast','NONE_EVALUATION_ONLY',
    'qualityComparable',false,'qualityReason','NO_EXPOSED_POLICY_OR_CALIBRATED_RATING_TARGET',
    'selectionWasProspective','NOT_ESTABLISHED','historicalFeatureEligible',false,
    'commitVisibility','NO_GLOBAL_COMMIT_HISTORY','groupReward',null,'metric',null,
    'learnable',false,'responses','[]'::jsonb);
  select * into source from private.prediction_runs where id=target_prediction_id;
  select * into binding from private.shared_round_prediction_consumptions where prediction_id=target_prediction_id;
  select * into prepared from private.shared_round_prediction_inputs where id=binding.input_id;
  select * into captured from private.shared_round_outcome_captures where id=target_capture_id;
  if source.id is null or binding.prediction_id is null or prepared.id is null or captured.id is null then
    return result||jsonb_build_object('status','SOURCE_UNAVAILABLE');
  end if;
  if not private.validate_shared_consumption_v1(to_jsonb(source))
    or not private.validate_native_final_source_v1(source.id) then
    raise exception 'Shared reconciliation requires a consumed frozen forecast' using errcode='22023';
  end if;
  marker:=binding.marker;
  outcome:=captured.result->'outcome';
  if captured.profile_id is distinct from source.profile_id
    or captured.round_id is distinct from prepared.round_id
    or captured.item_id::text is distinct from marker->>'targetItemId'
    or outcome#>'{round,experienceId}' is distinct from marker->'targetExperienceId' then
    raise exception 'Shared reconciliation target scope mismatch' using errcode='22023';
  end if;
  select * into selected from private.shared_rating_round_receipts where command_id=captured.source_command_id;
  select coalesce(jsonb_agg(c.command_id order by (c.result#>>'{round,revision}')::integer),'[]'),
    count(*),count(distinct (c.result#>>'{round,revision}')::integer),max((c.result#>>'{round,revision}')::integer),
    coalesce(jsonb_agg(c.command_id order by (c.result#>>'{round,revision}')::integer)
      filter(where (c.result#>>'{round,revision}')::integer<=prepared.target_revision),'[]')
    into prefix_ids,receipt_count,revision_count,maximum_revision,input_prefix_ids
    from private.shared_rating_round_receipts c where c.round_id=prepared.round_id
      and (c.result#>>'{round,revision}')::integer<=captured.source_revision;
  if captured.result->>'contractVersion' is distinct from 'shared-round-capture-v1'
    or outcome->>'contractVersion' is distinct from 'shared-round-outcome-v1'
    or captured.result->>'captureId' is distinct from captured.id::text
    or captured.result->>'outcomeDigest' is distinct from md5(outcome::text)
    or captured.result->'sourceCommandId' is distinct from to_jsonb(captured.source_command_id)
    or captured.result->'sourceRevision' is distinct from to_jsonb(captured.source_revision)
    or outcome#>'{source,commandId}' is distinct from to_jsonb(captured.source_command_id)
    or outcome#>'{source,revision}' is distinct from to_jsonb(captured.source_revision)
    or outcome->'round' is distinct from selected.result->'round'
    or selected.profile_id is distinct from source.profile_id
    or selected.round_id is distinct from prepared.round_id
    or prefix_ids is distinct from captured.result->'visibleCommandIds'
    or receipt_count<>captured.source_revision or revision_count<>receipt_count or maximum_revision<>receipt_count
    or not isfinite(captured.observed_at)
    or captured.observed_at is distinct from (captured.result->>'observedAt')::timestamptz
    or (outcome->>'outcomeCutoff')::timestamptz>captured.observed_at
    or (outcome->>'evidenceCutoff')::timestamptz>captured.observed_at then
    raise exception 'Shared reconciliation captured evidence unavailable' using errcode='55000';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('actorUserId',m.user_id,'membershipGeneration',g.generation_id)
    order by m.user_id),'[]') into members from public.profile_members m
    left join private.shared_round_membership_generations g on g.profile_id=m.profile_id and g.user_id=m.user_id
    where m.profile_id=source.profile_id;
  select * into strict candidate from private.prediction_candidates where prediction_id=source.id;
  result:=result||jsonb_build_object('observation',jsonb_build_object('profileId',source.profile_id,
    'roundId',prepared.round_id,'experienceId',marker->'targetExperienceId','itemId',captured.item_id),
    'forecast',jsonb_build_object('inputCaptureId',prepared.id,'inputDigest',marker->'inputDigest',
      'featureInputDigest',marker->'featureInputDigest','consumedAt',marker->'consumedAt',
      'targetRevision',prepared.target_revision,'score',candidate.final_score,'rank',candidate.final_rank,
      'modelVersion',source.model_version,'policyVersion',source.policy_version),
    'outcome',jsonb_build_object('digest',captured.result->'outcomeDigest','sourceRevision',captured.source_revision,
      'sourceCommandId',captured.source_command_id,'observedAt',captured.observed_at,
      'outcomeCutoff',outcome->'outcomeCutoff','evidenceCutoff',outcome->'evidenceCutoff',
      'maturity',outcome->'maturity','vectorStatus',outcome->'vectorStatus','coverage',outcome->'coverage'),
    'membershipBasis','EXACT_FULL_PROFILE_ENROLLMENT_NOT_SESSION');
  status:=case
    when members is distinct from prepared.result#>'{target,round,participants}' then 'CURRENT_ENROLLMENT_CHANGED'
    when outcome#>'{round,participants}' is distinct from prepared.result#>'{target,round,participants}'
      or outcome#>'{source,participantSetVersion}' is distinct from prepared.result#>'{target,round,participantSetVersion}'
      then 'CAPTURE_ENROLLMENT_CHANGED'
    when captured.source_revision<prepared.target_revision then 'CAPTURE_PREDATES_INPUT'
    when input_prefix_ids is distinct from prepared.result#>'{target,visibleCommandIds}' then 'INPUT_PREFIX_MISMATCH'
    when (outcome#>>'{maturity,intervalSeconds}')::numeric<minimum_maturity_seconds then 'MATURITY_POLICY_MISMATCH'
    else null end;
  if status is not null then return result||jsonb_build_object('status',status);end if;

  -- Earliest commands, not the latest corrected answer timestamp, prove which
  -- first response this forecast preceded. Retain UNKNOWN/CLEARED as no rating.
  select jsonb_build_object('commandId',c.command_id,'revision',a.revision,'receivedAt',a.received_at,
    'status',a.status) into first_response from private.shared_rating_round_responses a
    join private.shared_rating_round_receipts c on c.round_id=a.round_id
      and (c.result#>>'{round,revision}')::integer=a.revision
    where a.round_id=prepared.round_id and a.revision<=captured.source_revision order by a.revision limit 1;
  if first_response is not null and ((first_response->>'revision')::integer<=prepared.target_revision
    or (first_response->>'receivedAt')::timestamptz<=(marker->>'consumedAt')::timestamptz) then
    return result||jsonb_build_object('status','FORECAST_NOT_BEFORE_FIRST_RESPONSE','firstResponse',first_response);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('actorUserId',p->'actorUserId',
    'membershipGeneration',p->'membershipGeneration','status',latest->'status','rating',latest->'rating',
    'latestResponseRevision',latest->'responseRevision','attribution',latest->'attribution',
    'firstResponse',first_answer.value,'firstRating',first_rating.value,
    'corrected',coalesce((latest->>'responseRevision')::integer>first_answer.revision,false))
    order by p->>'actorUserId'),'[]') into responses
    from jsonb_array_elements(outcome#>'{round,participants}') p
    join jsonb_array_elements(outcome->'responses') latest on latest->>'actorUserId'=p->>'actorUserId'
    left join lateral (
      select a.revision,jsonb_build_object('commandId',c.command_id,'revision',a.revision,
        'receivedAt',a.received_at,'status',a.status,'rating',a.rating) value
      from private.shared_rating_round_responses a join private.shared_rating_round_receipts c
        on c.round_id=a.round_id and (c.result#>>'{round,revision}')::integer=a.revision
      where a.round_id=prepared.round_id and a.actor_user_id=(p->>'actorUserId')::uuid
        and a.revision<=captured.source_revision
      order by a.revision limit 1
    ) first_answer on true
    left join lateral (
      select jsonb_build_object('commandId',c.command_id,'revision',a.revision,
        'receivedAt',a.received_at,'rating',a.rating) value
      from private.shared_rating_round_responses a join private.shared_rating_round_receipts c
        on c.round_id=a.round_id and (c.result#>>'{round,revision}')::integer=a.revision
      where a.round_id=prepared.round_id and a.actor_user_id=(p->>'actorUserId')::uuid
        and a.revision<=captured.source_revision and a.status='RATED'
      order by a.revision limit 1
    ) first_rating on true;
  status:=case outcome->>'vectorStatus'
    when 'CANCELLED' then 'OUTCOME_CANCELLED'
    when 'INCOMPLETE' then 'OUTCOME_INCOMPLETE'
    when 'IMMATURE' then 'OUTCOME_IMMATURE'
    when 'READY_FOR_VECTOR_REVIEW' then 'MATURE_VECTOR_LINKED'
    else 'UNSUPPORTED_OUTCOME' end;
  return result||jsonb_build_object('status',status,'firstResponse',first_response,'responses',responses);
end;$reconcile$;

revoke all on function private.reconcile_shared_forecast_outcome_v1(uuid,uuid,integer)
  from public,anon,authenticated,service_role;
do $closed$
declare f record;
begin
  select * into strict f from pg_proc
    where oid='private.reconcile_shared_forecast_outcome_v1(uuid,uuid,integer)'::regprocedure;
  if f.proowner<>'postgres'::regrole or f.prosecdef or f.provolatile<>'s'
    or exists(select 1 from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
      where a.grantee<>f.proowner or a.grantor<>f.proowner or a.is_grantable) then
    raise exception 'Shared reconciliation owner-only access unavailable';
  end if;
end;$closed$;
