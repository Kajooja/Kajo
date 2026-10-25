-- Align memory/Scenario arithmetic with the canonical native evidence clock.
-- Delivery, current hard eligibility, policy assignment and Working lifecycle
-- retain their existing post-lock clocks. Current rows and READ COMMITTED
-- statement snapshots are not historical reconstruction or commit visibility.
do $shared_prediction_cutoff$
declare p record; body text; patch record;
begin
  select proc.*,pg_get_functiondef(proc.oid) definition into strict p from pg_proc proc
    where proc.oid='private.rank_items_candidate_with_identity_v1(timestamp with time zone,uuid[],boolean,uuid[],boolean,uuid,uuid,text,text,integer,jsonb)'::regprocedure;
  if md5(p.prosrc)<>'ea9bd681003796ae45261ee0fb6c1a05' or p.proowner<>'postgres'::regrole
    or not p.prosecdef or p.provolatile<>'v'
    or p.prolang<>(select oid from pg_language where lanname='plpgsql')
    or p.proleakproof or p.proisstrict or p.proparallel<>'u'
    or p.proconfig is distinct from array['search_path=""']::text[]
    or has_function_privilege('anon',p.oid,'EXECUTE')
    or has_function_privilege('authenticated',p.oid,'EXECUTE')
    or has_function_privilege('service_role',p.oid,'EXECUTE')
    or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where acl.grantor<>p.proowner or acl.grantee<>p.proowner) then
    raise exception 'Shared prediction cutoff source/security drift';
  end if;
  body:=p.prosrc;
  for patch in select * from (values
    ('  request_time timestamptz;',E'  request_time timestamptz;\n  computation_time timestamptz := pg_catalog.now();',1),
    ('private.build_profile_memory_state_v1(target_profile_id, request_time)',
      'private.build_profile_memory_state_v1(target_profile_id, computation_time)',1),
    ('and event.created_at <= request_time','and event.created_at <= computation_time',1),
    ('and event.occurred_at <= request_time','and event.occurred_at <= computation_time',2),
    ('private.prediction_outcome_events_v1(target_profile_id, request_time, request_time)',
      'private.prediction_outcome_events_v1(target_profile_id, computation_time, computation_time)',1),
    ('extract(epoch from (request_time - historical_outcomes.occurred_at))',
      'extract(epoch from (computation_time - historical_outcomes.occurred_at))',1),
    ('  insert into private.prediction_runs (',$input$  current_state := current_state || jsonb_build_object('predictionInput',jsonb_build_object(
    'version','native-prediction-clocks-v1',
    'nativeEvidenceAsOf',computation_time,'memoryStateAsOf',computation_time,'scenarioAsOf',computation_time,
    'requestAsOf',request_time,'workingStateAsOf',current_working_state->'cutoff',
    'arithmeticClock','TRANSACTION_START',
    'eligibilityClock',case when _candidate_ids is not null then 'TRANSACTION_START' else 'CURRENT_WALL_TIME' end,
    'dataSnapshot','CURRENT_STATEMENT_SNAPSHOTS','historicalReconstruction','UNAVAILABLE','commitVisibility','UNKNOWN',
    'candidateAcquisition',case when _candidate_ids is not null then 'EXPLICIT_CANONICAL'
      when _catalog_chain then 'CATALOG_CHAIN' else 'LEGACY_DISCOVERY' end,
    'requiredAfter',case when _candidate_ids is not null then _evaluation_after else null end));

  insert into private.prediction_runs ($input$,1)
  ) changes(before_text,after_text,expected_count) loop
    if (length(body)-length(replace(body,patch.before_text,'')))/length(patch.before_text)<>patch.expected_count then
      raise exception 'Shared prediction cutoff replacement drift: %',patch.before_text;
    end if;
    body:=replace(body,patch.before_text,patch.after_text);
  end loop;
  execute replace(p.definition,p.prosrc,body);
end;$shared_prediction_cutoff$;
