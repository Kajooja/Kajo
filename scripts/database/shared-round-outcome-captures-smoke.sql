create function pg_temp.capture_reject(sql text,expected_state text default '22023') returns void
language plpgsql as $$ begin
  begin execute sql; exception when others then
    if expected_state is not null and sqlstate is distinct from expected_state then raise; end if;
    return;
  end;
  raise exception 'Invalid capture/comparison input succeeded: %',sql;
end; $$;
create function pg_temp.assert_capture(value jsonb,expected_revision integer) returns void
language plpgsql as $$ begin
  if value is null or value->>'contractVersion' is distinct from 'shared-round-capture-v1'
    or value->>'sourceBasis' is distinct from 'SERVER_VISIBLE_COMMAND_RECEIPT_PREFIX'
    or value->>'usage' is distinct from 'OUTCOME_EVIDENCE_ONLY'
    or value->>'interpretationVersion' is distinct from 'shared-round-outcome-v1'
    or value->>'maturityVersion' is distinct from 'explicit-elapsed-seconds-v1'
    or value->'sourceRevision' is distinct from to_jsonb(expected_revision)
    or value->'sourceCommandId' is distinct from value#>'{outcome,source,commandId}'
    or value->'sourceRevision' is distinct from value#>'{outcome,source,revision}'
    or value->>'outcomeDigest' is distinct from md5((value->'outcome')::text)
    or jsonb_array_length(value->'visibleCommandIds') is distinct from expected_revision
    or value->'historicalFeatureEligible' is distinct from 'false'::jsonb
    or value#>'{outcome,historicalFeatureEligible}' is distinct from 'false'::jsonb
    or value->'groupReward' is distinct from 'null'::jsonb or value->'learnable' is distinct from 'false'::jsonb then
    raise exception 'Frozen capture identity/versions/content or closed admission lost: %',value; end if;
end; $$;
create function pg_temp.assert_comparison(value jsonb,expected_support integer,expected_status text) returns void
language plpgsql as $$ begin
  if value is null or value->>'contractVersion' is distinct from 'shared-round-vector-comparison-v1'
    or value->>'comparisonBasis' is distinct from 'SAME_FROZEN_VECTOR_AND_COMMON_SUPPORT_MASK'
    or value->>'usage' is distinct from 'OUTCOME_EVIDENCE_ONLY'
    or value->>'metricVersion' is distinct from 'shared-round-paired-support-v1'
    or value->>'supportStatus' is distinct from expected_status
    or value#>'{coverage,supportedParticipantCount}' is distinct from to_jsonb(expected_support)
    or jsonb_array_length(value->'commonSupportMask') is distinct from expected_support
    or value->>'commonSupportDigest' is distinct from md5((value->'commonSupportMask')::text)
    or value->'production' is distinct from value->'shadow'
    or value#>'{production,supportMask}' is distinct from value->'commonSupportMask'
    or value#>'{production,outcomeDigest}' is distinct from value->'outcomeDigest'
    or value->'historicalFeatureEligible' is distinct from 'false'::jsonb
    or value->'groupReward' is distinct from 'null'::jsonb or value->'learnable' is distinct from 'false'::jsonb
    or value->'productionMetric' is distinct from 'null'::jsonb or value->'challengerMetric' is distinct from 'null'::jsonb
    or value->'advantage' is distinct from 'null'::jsonb then
    raise exception 'Paired comparison did not retain one vector/mask and unavailable metrics: %',value; end if;
end; $$;
create function pg_temp.capture_genome(target_id uuid,created timestamptz) returns uuid language plpgsql as $$ begin
  insert into private.predictor_genomes
    select (jsonb_populate_record(null::private.predictor_genomes,to_jsonb(g)||jsonb_build_object(
      'id',target_id,'genome_key','capture-control-'||target_id,'created_at',created,'created_by','CAPTURE_NEGATIVE_CONTROL'))).*
    from private.predictor_genomes g where id=md5('kajo:predictor-genome:prediction-v1-baseline')::uuid;
  return target_id;
end; $$;

do $capture_matrix$
declare
  f record; c record; checkpoint record; role_name text; target regprocedure; relation text;
  target_capture uuid := 'a232c000-0000-4000-8000-000000000050';
  comparison_id uuid := 'a232c000-0000-4000-8000-000000000060';
  value jsonb; frozen jsonb; comparison jsonb; frozen_comparison jsonb; response jsonb; ids jsonb;
  event_digest text; interaction_digest text; evaluation_digest text; receipt_digest text; before_delete text;
  pending_id uuid := gen_random_uuid(); immature_id uuid := gen_random_uuid(); partial_round uuid := gen_random_uuid();
  n_round uuid := gen_random_uuid(); n_capture uuid := gen_random_uuid(); n_comparison uuid := gen_random_uuid();
  new_genome uuid; new_window uuid; new_shadow uuid; row_shadow record; item_candidate record;
  current_cutoff timestamptz; open_at timestamptz; i integer; worker jsonb;
  pending_shadow_comparison uuid := gen_random_uuid(); pending_shadow_result jsonb;
  old_capture_ids uuid[]; capture_count integer; comparison_count integer;
begin
  select * into strict f from pg_temp.outcome_fixture; select * into strict c from pg_temp.capture_fixture;
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb)::text) into event_digest from public.events e;
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by to_jsonb(e)::text),'[]'::jsonb)::text) into interaction_digest from public.item_interactions e;
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by to_jsonb(e)::text),'[]'::jsonb)::text) into evaluation_digest from private.genome_evaluations e;
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.command_id),'[]'::jsonb)::text) into receipt_digest from private.shared_rating_round_receipts e;

  -- Closed roles must actually fail to execute/read, even under PUBLIC creator defaults.
  foreach target in array array[
    'private.capture_shared_rating_round_outcome_v1(uuid,uuid,uuid,timestamptz,timestamptz,interval)'::regprocedure,
    'private.get_shared_round_outcome_capture_v1(uuid)'::regprocedure,
    'private.shared_round_vector_comparison_projection_v1(jsonb,uuid,uuid)'::regprocedure,
    'private.compare_shared_round_outcome_capture_v1(uuid,uuid,uuid,uuid)'::regprocedure,
    'private.get_shared_round_vector_comparison_v1(uuid)'::regprocedure] loop
    if exists(select 1 from pg_proc where oid=target and (prosecdef or exists(
      select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) where grantee=0 and privilege_type='EXECUTE'))) then
      raise exception 'Capture/comparison exposed PUBLIC execute or definer authority'; end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_function_privilege(role_name,target,'EXECUTE') then raise exception 'API role can execute %',target; end if;
    end loop;
  end loop;
  foreach relation in array array['private.shared_round_outcome_captures','private.shared_round_vector_comparisons'] loop
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(role_name,relation,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        raise exception 'API role holds audit table privilege: %, %',role_name,relation; end if;
    end loop;
  end loop;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform set_config('role',role_name,true);
    begin perform private.get_shared_round_outcome_capture_v1(target_capture); raise exception 'API capture read succeeded';
      exception when insufficient_privilege then null; end;
    begin perform private.get_shared_round_vector_comparison_v1(comparison_id); raise exception 'API comparison read succeeded';
      exception when insufficient_privilege then null; end;
    begin perform private.capture_shared_rating_round_outcome_v1(target_capture,f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds');
      raise exception 'API capture write succeeded'; exception when insufficient_privilege then null; end;
    begin perform private.compare_shared_round_outcome_capture_v1(comparison_id,target_capture,c.genome_id,c.window_id);
      raise exception 'API comparison write succeeded'; exception when insufficient_privilege then null; end;
    begin perform private.shared_round_vector_comparison_projection_v1('{}'::jsonb,c.genome_id,c.window_id);
      raise exception 'API internal projection succeeded'; exception when insufficient_privilege then null; end;
    foreach relation in array array['private.shared_round_outcome_captures','private.shared_round_vector_comparisons'] loop
      begin execute format('select count(*) from %s',relation); raise exception 'API role directly read audit vector';
        exception when insufficient_privilege then null; end;
    end loop;
    perform set_config('role','postgres',true);
  end loop;
  if exists(select 1 from pg_class where oid in ('private.shared_round_outcome_captures'::regclass,
    'private.shared_round_vector_comparisons'::regclass) and not relrowsecurity) then raise exception 'Audit tables lack RLS'; end if;

  value := private.capture_shared_rating_round_outcome_v1(target_capture,f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds');
  perform pg_temp.assert_capture(value,3); frozen := value;
  if value->'outcome' is distinct from private.shared_rating_round_outcome_v1(f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds')
    or value#>'{outcome,descriptive,minRating}' is distinct from '0'::jsonb
    or value#>'{outcome,descriptive,ratingSpread}' is distinct from '10'::jsonb
    or (value->>'observedAt')::timestamptz<c.outcome_cutoff then raise exception 'Capture changed the observed zero/disagreement vector'; end if;
  select jsonb_agg(command_id order by (result#>>'{round,revision}')::integer) into ids
    from private.shared_rating_round_receipts where round_id=c.round_id;
  if value->'visibleCommandIds' is distinct from ids then raise exception 'Visible receipt prefix identities differ'; end if;
  if private.get_shared_round_outcome_capture_v1(target_capture)::text is distinct from frozen::text
    or private.capture_shared_rating_round_outcome_v1(target_capture,f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds')::text is distinct from frozen::text then
    raise exception 'Exact capture retry/replay changed bytes'; end if;
  perform pg_temp.capture_reject(format('select private.capture_shared_rating_round_outcome_v1(%L,%L,%L,%L,%L,interval ''1 second'')',
    target_capture,f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff));
  perform pg_temp.capture_reject(format('select private.capture_shared_rating_round_outcome_v1(%L,%L,%L,%L,%L,interval ''0 seconds'')',
    target_capture,f.multi,c.round_id,c.outcome_cutoff,c.outcome_cutoff));
  perform pg_temp.capture_reject(format('update private.shared_round_outcome_captures set result=''{}'' where id=%L',target_capture),null);
  if private.get_shared_round_outcome_capture_v1(gen_random_uuid()) is not null then raise exception 'Missing capture fabricated a replay'; end if;
  perform pg_temp.capture_reject(format('select private.capture_shared_rating_round_outcome_v1(%L,%L,%L,%L,%L,interval ''0 seconds'')',
    gen_random_uuid(),f.pair,gen_random_uuid(),c.outcome_cutoff,c.outcome_cutoff));
  select min(created_at) into open_at from private.shared_rating_round_receipts where round_id=c.round_id;
  perform pg_temp.capture_reject(format('select private.capture_shared_rating_round_outcome_v1(%L,%L,%L,%L,%L,interval ''0 seconds'')',
    gen_random_uuid(),f.pair,c.round_id,open_at-interval '1 microsecond',open_at-interval '1 microsecond'));
  perform pg_temp.capture_reject(format('select private.capture_shared_rating_round_outcome_v1(%L,%L,%L,null,%L,interval ''0 seconds'')',
    gen_random_uuid(),f.pair,c.round_id,c.outcome_cutoff));
  perform pg_temp.capture_reject(format('select private.capture_shared_rating_round_outcome_v1(%L,%L,%L,%L,%L,interval ''1 month'')',
    gen_random_uuid(),f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff));

  comparison := private.compare_shared_round_outcome_capture_v1(comparison_id,target_capture,c.genome_id,c.window_id);
  perform pg_temp.assert_comparison(comparison,2,'COMPLETE_VECTOR_SUPPORTED'); frozen_comparison := comparison;
  if comparison->'capturedOutcome' is distinct from frozen->'outcome'
    or comparison->'vectorComparisonEligible' is distinct from 'true'::jsonb
    or comparison#>'{coverage,roundObservationCount}' is distinct from '1'::jsonb
    or comparison#>'{coverage,participantCount}' is distinct from '2'::jsonb
    or jsonb_array_length(comparison->'pairs') is distinct from 2
    or exists(select 1 from jsonb_array_elements(comparison->'pairs') pair where pair->>'supportStatus' is distinct from 'SUPPORTED'
      or pair#>'{production,rank}' is distinct from pair#>'{shadow,rank}'
      or pair->'productionTrace' is null or pair->'shadowTrace' is null) then
    raise exception 'Complete vector lost exact paired frozen run support or multiplied observation units'; end if;
  if private.get_shared_round_vector_comparison_v1(comparison_id)::text is distinct from frozen_comparison::text
    or private.compare_shared_round_outcome_capture_v1(comparison_id,target_capture,c.genome_id,c.window_id)::text is distinct from frozen_comparison::text then
    raise exception 'Exact paired comparison retry/replay changed bytes'; end if;
  perform pg_temp.capture_reject(format('update private.shared_round_vector_comparisons set result=''{}'' where id=%L',comparison_id),null);
  perform pg_temp.capture_reject(format('select private.compare_shared_round_outcome_capture_v1(%L,%L,%L,%L)',
    comparison_id,pending_id,c.genome_id,c.window_id));
  if private.get_shared_round_vector_comparison_v1(gen_random_uuid()) is not null then raise exception 'Missing comparison fabricated support'; end if;

  -- Ready outcomes remain diagnostics when the matching frozen shadow is absent.
  new_genome := pg_temp.capture_genome(gen_random_uuid(),c.input_cutoff);
  value := private.compare_shared_round_outcome_capture_v1(pending_shadow_comparison,target_capture,new_genome,c.window_id);
  pending_shadow_result := value;
  perform pg_temp.assert_comparison(value,0,'NO_SUPPORTED_VECTOR');
  if value->'vectorComparisonEligible' is distinct from 'false'::jsonb
    or exists(select 1 from jsonb_array_elements(value->'pairs') pair where pair->>'supportStatus' is distinct from 'SHADOW_UNAVAILABLE') then
    raise exception 'Absent shadow gained borrowed support'; end if;
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
    values(c.source_a,new_genome),(c.source_b,new_genome);
  worker := private.process_shadow_prediction_jobs_v1(250);
  if worker->>'failed' is distinct from '0' then raise exception 'Later comparison shadow failed: %',worker; end if;
  value := private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),target_capture,new_genome,c.window_id);
  perform pg_temp.assert_comparison(value,2,'COMPLETE_VECTOR_SUPPORTED');
  if private.get_shared_round_vector_comparison_v1(pending_shadow_comparison)::text is distinct from pending_shadow_result::text
    or private.compare_shared_round_outcome_capture_v1(pending_shadow_comparison,target_capture,new_genome,c.window_id)::text is distinct from pending_shadow_result::text then
    raise exception 'Later shadow availability changed stored comparison/retry'; end if;
  new_genome := pg_temp.capture_genome(gen_random_uuid(),clock_timestamp());
  perform pg_temp.capture_reject(format('select private.compare_shared_round_outcome_capture_v1(%L,%L,%L,%L)',
    gen_random_uuid(),target_capture,new_genome,c.window_id));
  perform pg_temp.capture_reject(format('select private.compare_shared_round_outcome_capture_v1(%L,%L,%L,%L)',
    gen_random_uuid(),target_capture,c.genome_id,gen_random_uuid()));
  new_window := gen_random_uuid();
  insert into private.evaluation_windows select (jsonb_populate_record(null::private.evaluation_windows,to_jsonb(w)||
    jsonb_build_object('id',new_window,'window_key','capture-wrong-cutoff-'||new_window,'outcome_cutoff',c.outcome_cutoff+interval '1 microsecond'))).*
    from private.evaluation_windows w where w.id=c.window_id;
  perform pg_temp.capture_reject(format('select private.compare_shared_round_outcome_capture_v1(%L,%L,%L,%L)',
    gen_random_uuid(),target_capture,c.genome_id,new_window));
  new_window := gen_random_uuid();
  insert into private.evaluation_windows select (jsonb_populate_record(null::private.evaluation_windows,to_jsonb(w)||
    jsonb_build_object('id',new_window,'window_key','capture-outside-'||new_window,
      'prediction_from',c.input_cutoff-interval '2 microseconds','prediction_until',c.input_cutoff-interval '1 microsecond'))).*
    from private.evaluation_windows w where w.id=c.window_id;
  value := private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),target_capture,c.genome_id,new_window);
  perform pg_temp.assert_comparison(value,0,'NO_SUPPORTED_VECTOR');
  if exists(select 1 from jsonb_array_elements(value->'pairs') pair where pair->>'supportStatus' is distinct from 'SOURCE_OUTSIDE_WINDOW') then
    raise exception 'Prediction outside fixed input window gained support'; end if;

  -- Immutable synthetic shadow controls: wrong scope, replay version and candidate pool.
  for i in 1..4 loop
    new_genome := pg_temp.capture_genome(gen_random_uuid(),c.input_cutoff);
    for row_shadow in select s.* from private.shadow_prediction_runs s where s.id in (c.shadow_a,c.shadow_b) loop
      new_shadow := gen_random_uuid();
      insert into private.shadow_prediction_runs select (jsonb_populate_record(null::private.shadow_prediction_runs,
        to_jsonb(row_shadow)||jsonb_build_object('id',new_shadow,'genome_id',new_genome)||case i
          when 1 then jsonb_build_object('profile_id',f.personal)
          when 2 then jsonb_build_object('code_version','unsupported-capture-replay') else '{}'::jsonb end)).*;
      for item_candidate in select * from private.shadow_prediction_candidates where shadow_prediction_id=row_shadow.id loop
        if i<>3 then
          insert into private.shadow_prediction_candidates select (jsonb_populate_record(null::private.shadow_prediction_candidates,
            to_jsonb(item_candidate)||jsonb_build_object('shadow_prediction_id',new_shadow)||case when i=4 then
              jsonb_build_object('production_final_rank',item_candidate.production_final_rank+1) else '{}'::jsonb end)).*;
        end if;
      end loop;
    end loop;
    value := private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),target_capture,new_genome,c.window_id);
    perform pg_temp.assert_comparison(value,0,'NO_SUPPORTED_VECTOR');
    if exists(select 1 from jsonb_array_elements(value->'pairs') pair where pair->>'supportStatus'='SUPPORTED') then
      raise exception 'Mismatched frozen shadow gained support'; end if;
  end loop;

  -- Partial support keeps the same full vector but only A's actual own source.
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,partial_round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',f.book,'experienceId',gen_random_uuid())));
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,partial_round,'SET_RESPONSE',1,
    jsonb_build_object('rating',0,'origin',jsonb_build_object('predictionId',c.source_a,
      'sessionId',(select session_id from private.prediction_runs where id=c.source_a),'discoveryMode','FOR_YOU'))));
  response := pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.pair,partial_round,'SET_RESPONSE',2,
    jsonb_build_object('rating',10,'origin',jsonb_build_object('predictionId',c.source_a,
      'sessionId',(select session_id from private.prediction_runs where id=c.source_a),'discoveryMode','FOR_YOU'))));
  current_cutoff := clock_timestamp(); new_window := gen_random_uuid();
  insert into private.evaluation_windows select (jsonb_populate_record(null::private.evaluation_windows,to_jsonb(w)||
    jsonb_build_object('id',new_window,'window_key','capture-partial-'||new_window,'outcome_cutoff',current_cutoff))).*
    from private.evaluation_windows w where w.id=c.window_id;
  value := private.capture_shared_rating_round_outcome_v1(gen_random_uuid(),f.pair,partial_round,current_cutoff,current_cutoff,interval '0 seconds');
  comparison := private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),(value->>'captureId')::uuid,c.genome_id,new_window);
  perform pg_temp.assert_comparison(comparison,1,'PARTIAL_VECTOR_SUPPORTED');
  if comparison->'vectorComparisonEligible' is distinct from 'false'::jsonb
    or comparison->'commonSupportMask' is distinct from jsonb_build_array(f.actor)
    or comparison#>'{coverage,roundObservationCount}' is distinct from '0'::jsonb
    or comparison->'capturedOutcome' is distinct from value->'outcome' then
    raise exception 'Another actor borrowed exposure or partial evidence became a full vector'; end if;

  -- Incomplete and immature captures store no support rather than fabricate missing ratings.
  select * into strict checkpoint from pg_temp.outcome_receipts where revision=2;
  value := private.capture_shared_rating_round_outcome_v1(pending_id,f.pair,f.round,checkpoint.accepted_at,checkpoint.accepted_at,interval '0 seconds');
  perform pg_temp.assert_capture(value,2);
  new_window := gen_random_uuid();
  insert into private.evaluation_windows select (jsonb_populate_record(null::private.evaluation_windows,to_jsonb(w)||
    jsonb_build_object('id',new_window,'window_key','capture-pending-'||new_window,'outcome_cutoff',checkpoint.accepted_at,
      'prediction_from',checkpoint.accepted_at-interval '3 microseconds','prediction_until',checkpoint.accepted_at-interval '2 microseconds',
      'input_cutoff',checkpoint.accepted_at-interval '1 microsecond'))).*
    from private.evaluation_windows w where w.id=c.window_id;
  value := private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),pending_id,c.genome_id,new_window);
  perform pg_temp.assert_comparison(value,0,'OUTCOME_NOT_READY');
  if value#>'{capturedOutcome,coverage,unansweredCount}' is distinct from '1'::jsonb then raise exception 'Missing answer became zero'; end if;
  value := private.capture_shared_rating_round_outcome_v1(immature_id,f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff,interval '1 day');
  perform pg_temp.assert_capture(value,3);
  if value#>'{outcome,maturity,intervalSeconds}' is distinct from '86400'::jsonb then raise exception 'Elapsed maturity interval changed'; end if;
  value := private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),immature_id,c.genome_id,c.window_id);
  perform pg_temp.assert_comparison(value,0,'OUTCOME_NOT_READY');

  -- New correction/cancellation captures are separate; old interpretation and paired traces stay byte-identical.
  response := pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.pair,c.round_id,'SET_RESPONSE',3,'{"rating":1}'));
  current_cutoff := clock_timestamp();
  value := private.capture_shared_rating_round_outcome_v1(gen_random_uuid(),f.pair,c.round_id,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_capture(value,4);
  if value#>'{outcome,descriptive,ratingSpread}' is distinct from '1'::jsonb then raise exception 'Correction reused old response'; end if;
  response := pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.pair,c.round_id,'CANCEL_ROUND',4));
  current_cutoff := clock_timestamp();
  value := private.capture_shared_rating_round_outcome_v1(gen_random_uuid(),f.pair,c.round_id,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_capture(value,5);
  if value#>>'{outcome,vectorStatus}' is distinct from 'CANCELLED' then raise exception 'Cancellation kept ready evidence'; end if;
  if private.get_shared_round_outcome_capture_v1(target_capture)::text is distinct from frozen::text
    or private.get_shared_round_vector_comparison_v1(comparison_id)::text is distinct from frozen_comparison::text
    or private.capture_shared_rating_round_outcome_v1(target_capture,f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds')::text is distinct from frozen::text then
    raise exception 'Later correction/cancellation rewrote frozen replay'; end if;

  -- Allocation bounds are real; exact retries remain usable at their limits.
  select count(*) into capture_count from private.shared_round_outcome_captures where round_id=c.round_id;
  for i in capture_count+1..16 loop
    perform private.capture_shared_rating_round_outcome_v1(gen_random_uuid(),f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds');
  end loop;
  perform pg_temp.capture_reject(format('select private.capture_shared_rating_round_outcome_v1(%L,%L,%L,%L,%L,interval ''0 seconds'')',
    gen_random_uuid(),f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff),'54000');
  if (select count(*) from private.shared_round_outcome_captures where round_id=c.round_id)<>16
    or private.capture_shared_rating_round_outcome_v1(target_capture,f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds') is distinct from frozen then
    raise exception 'Capture limit broke exact retry or count'; end if;
  select count(*) into comparison_count from private.shared_round_vector_comparisons where capture_id=target_capture;
  for i in comparison_count+1..16 loop
    perform private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),target_capture,c.genome_id,c.window_id);
  end loop;
  perform pg_temp.capture_reject(format('select private.compare_shared_round_outcome_capture_v1(%L,%L,%L,%L)',
    gen_random_uuid(),target_capture,c.genome_id,c.window_id),'54000');
  if (select count(*) from private.shared_round_vector_comparisons where capture_id=target_capture)<>16
    or private.compare_shared_round_outcome_capture_v1(comparison_id,target_capture,c.genome_id,c.window_id) is distinct from frozen_comparison then
    raise exception 'Comparison limit broke exact retry or count'; end if;

  -- Inherited shadow NO ACTION FKs block source account erasure. The failure must roll back ALL new lineage.
  select md5(jsonb_build_object('rounds',(select jsonb_agg(to_jsonb(r) order by id) from private.shared_rating_rounds r),
    'receipts',(select jsonb_agg(to_jsonb(r) order by command_id) from private.shared_rating_round_receipts r),
    'captures',(select jsonb_agg(to_jsonb(r) order by id) from private.shared_round_outcome_captures r),
    'comparisons',(select jsonb_agg(to_jsonb(r) order by id) from private.shared_round_vector_comparisons r))::text) into before_delete;
  perform pg_temp.capture_reject(format('delete from auth.users where id=%L',f.partner),'23503');
  if not exists(select 1 from auth.users where id=f.partner) or before_delete is distinct from
    md5(jsonb_build_object('rounds',(select jsonb_agg(to_jsonb(r) order by id) from private.shared_rating_rounds r),
      'receipts',(select jsonb_agg(to_jsonb(r) order by command_id) from private.shared_rating_round_receipts r),
      'captures',(select jsonb_agg(to_jsonb(r) order by id) from private.shared_round_outcome_captures r),
      'comparisons',(select jsonb_agg(to_jsonb(r) order by id) from private.shared_round_vector_comparisons r))::text) then
    raise exception 'Blocked inherited erasure left partial deletion'; end if;
  perform pg_temp.capture_reject(format('delete from public.profiles where id=%L',f.pair),'23503');
  if before_delete is distinct from md5(jsonb_build_object(
      'rounds',(select jsonb_agg(to_jsonb(r) order by id) from private.shared_rating_rounds r),
      'receipts',(select jsonb_agg(to_jsonb(r) order by command_id) from private.shared_rating_round_receipts r),
      'captures',(select jsonb_agg(to_jsonb(r) order by id) from private.shared_round_outcome_captures r),
      'comparisons',(select jsonb_agg(to_jsonb(r) order by id) from private.shared_round_vector_comparisons r))::text)
    or private.get_shared_round_outcome_capture_v1(target_capture) is distinct from frozen
    or private.get_shared_round_vector_comparison_v1(comparison_id) is distinct from frozen_comparison then
    raise exception 'Blocked Profile erasure changed new evidence'; end if;

  -- A former NON-source participant is retained only in historical receipts: deleting C removes all derived lineage.
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.multi,n_round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',f.book,'experienceId',gen_random_uuid())));
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.multi,n_round,'SET_RESPONSE',1,'{"rating":0}'));
  response := pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.multi,n_round,'SET_RESPONSE',2,'{"rating":10}'));
  response := pg_temp.outcome_commit(f.third,pg_temp.outcome_command(f.third,f.multi,n_round,'SET_RESPONSE',3,'{"rating":null}'));
  current_cutoff := clock_timestamp();
  value := private.capture_shared_rating_round_outcome_v1(n_capture,f.multi,n_round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_capture(value,4);
  if value#>'{outcome,coverage,unknownCount}' is distinct from '1'::jsonb
    or value#>'{outcome,coverage,ratedCount}' is distinct from '2'::jsonb then raise exception 'N-member unknown became confirmation'; end if;
  new_window := gen_random_uuid();
  insert into private.evaluation_windows select (jsonb_populate_record(null::private.evaluation_windows,to_jsonb(w)||
    jsonb_build_object('id',new_window,'window_key','capture-n-'||new_window,'outcome_cutoff',current_cutoff))).*
    from private.evaluation_windows w where w.id=c.window_id;
  comparison := private.compare_shared_round_outcome_capture_v1(n_comparison,n_capture,c.genome_id,new_window);
  perform pg_temp.assert_comparison(comparison,0,'OUTCOME_NOT_READY');
  delete from public.profile_members where profile_id=f.multi and user_id=f.third;
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.multi,n_round,'RECONFIRM_ROUND',4));
  current_cutoff := clock_timestamp();
  value := private.capture_shared_rating_round_outcome_v1(gen_random_uuid(),f.multi,n_round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_capture(value,5);
  if value#>'{outcome,coverage,unansweredCount}' is distinct from '2'::jsonb
    or value#>'{outcome,coverage,ratedCount}' is distinct from '0'::jsonb
    or value#>'{outcome,source,participantSetVersion}' is distinct from '2'::jsonb then raise exception 'Reconfirmation merged old answers'; end if;
  delete from auth.users where id=f.third;
  if exists(select 1 from private.shared_rating_rounds where id=n_round)
    or exists(select 1 from private.shared_round_outcome_captures where round_id=n_round)
    or private.get_shared_round_outcome_capture_v1(n_capture) is not null
    or private.get_shared_round_vector_comparison_v1(n_comparison) is not null then
    raise exception 'Former non-source participant identity survived derived erasure'; end if;

  -- Only new lineages cascade on direct round erasure; serving/shadow records remain intact.
  select array_agg(id) into old_capture_ids from private.shared_round_outcome_captures where round_id=c.round_id;
  delete from private.shared_rating_rounds where id=c.round_id;
  if exists(select 1 from private.shared_round_outcome_captures where id=any(old_capture_ids))
    or exists(select 1 from private.shared_round_vector_comparisons where capture_id=any(old_capture_ids))
    or private.get_shared_round_outcome_capture_v1(target_capture) is not null
    or private.get_shared_round_vector_comparison_v1(comparison_id) is not null then raise exception 'Round deletion resurrected frozen lineage'; end if;
  if event_digest is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb)::text) from public.events e)
    or interaction_digest is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(e) order by to_jsonb(e)::text),'[]'::jsonb)::text) from public.item_interactions e)
    or evaluation_digest is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(e) order by to_jsonb(e)::text),'[]'::jsonb)::text) from private.genome_evaluations e) then
    raise exception 'Source-only capture/comparison changed legacy Events, state or scalar evaluations'; end if;
  for checkpoint in select * from pg_temp.outcome_receipts loop
    if pg_temp.outcome_commit((checkpoint.command->>'actorUserId')::uuid,checkpoint.command) is distinct from checkpoint.result then
      raise exception 'Capture/comparison rewrote legacy exact round receipts'; end if;
  end loop;
end; $capture_matrix$;
select jsonb_build_object('sharedRoundOutcomeCaptures',
  'PASS: exact visible-prefix capture/replay; same paired vector/support and unavailable metrics; real own delivery/frozen shadows; mismatch controls, maturity, corrections, caps, closed APIs, immutable retries and bounded erasure with inherited source-deletion blocker explicit') snapshot;
