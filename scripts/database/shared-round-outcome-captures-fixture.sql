-- Existing-schema, real serving/shadow/round inputs for the additive capture forward.
-- The earlier outcome fixture supplies synthetic actors, Items and legacy history.
create temp table capture_fixture(
  round_id uuid,genome_id uuid,window_id uuid,outcome_cutoff timestamptz,input_cutoff timestamptz,
  source_a uuid,source_b uuid,shadow_a uuid,shadow_b uuid
) on commit drop;
do $capture_fixture$
declare
  f record; actor uuid; session_id uuid; delivery jsonb; origin jsonb; response jsonb;
  round_id uuid := 'a232c000-0000-4000-8000-000000000030';
  target_genome uuid := md5('kajo:predictor-genome:prediction-v1-baseline')::uuid;
  window_id uuid := 'a232c000-0000-4000-8000-000000000040';
  sources uuid[] := '{}'; shadows uuid[] := '{}'; origins jsonb[] := '{}';
  input_cutoff timestamptz; outcome_cutoff timestamptz; prediction_from timestamptz; worker jsonb;
begin
  select * into strict f from pg_temp.outcome_fixture;
  foreach actor in array array[f.actor,f.partner] loop
    session_id := gen_random_uuid();
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform set_config('role','authenticated',true);
    delivery := public.rank_items_page_v1(jsonb_build_object('version',3,'requestId',gen_random_uuid(),
      'profileId',f.pair,'sessionId',session_id,'discoveryMode','FOR_YOU','itemType','BOOK','limit',10,'context','{}'::jsonb));
    perform set_config('role','postgres',true);
    if not exists(select 1 from jsonb_array_elements(delivery->'items') item where item->>'item_id'=f.book::text) then
      raise exception 'Capture fixture lacks its actual selected Item'; end if;
    sources := array_append(sources,(delivery->>'predictionId')::uuid);
    origins := array_append(origins,jsonb_build_object('predictionId',delivery->'predictionId',
      'sessionId',session_id,'discoveryMode','FOR_YOU'));
    insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
      values(session_id,actor,f.pair,(delivery#>>'{source,featureAt}')::timestamptz,'{}'::jsonb);
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,
      session_id,prediction_id,discovery_mode,created_at)
      values(gen_random_uuid(),actor,f.pair,f.book,'BOOK','ITEM_IMPRESSION',clock_timestamp(),
        session_id,(delivery->>'predictionId')::uuid,'FOR_YOU',clock_timestamp());
  end loop;
  input_cutoff := clock_timestamp();
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,round_id,'OPEN_ROUND',0,
    jsonb_build_object('itemId',f.book,'experienceId',gen_random_uuid())));
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,round_id,'SET_RESPONSE',1,
    jsonb_build_object('rating',0,'origin',origins[1])));
  response := pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.pair,round_id,'SET_RESPONSE',2,
    jsonb_build_object('rating',10,'origin',origins[2])));
  outcome_cutoff := clock_timestamp();
  if response#>>'{round,state}' is distinct from 'COMPLETED'
    or exists(select 1 from jsonb_array_elements(response#>'{round,responses}') answer
      where answer#>>'{origin,status}' is distinct from 'VALIDATED_TRACE') then
    raise exception 'Capture fixture did not establish two own validated responses'; end if;
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
    select source,target_genome from unnest(sources) source on conflict do nothing;
  worker := private.process_shadow_prediction_jobs_v1(250);
  if worker->>'failed' is distinct from '0' then raise exception 'Capture fixture shadow failed: %',worker; end if;
  foreach actor in array sources loop
    select id into strict session_id from private.shadow_prediction_runs
      where source_prediction_id=actor and genome_id=target_genome;
    shadows := array_append(shadows,session_id);
  end loop;
  select min(requested_at)-interval '1 microsecond' into prediction_from
    from private.prediction_runs where id=any(sources);
  insert into private.evaluation_windows(id,window_key,prediction_from,prediction_until,input_cutoff,outcome_cutoff,created_by)
    values(window_id,'shared-round-capture-'||window_id,prediction_from,input_cutoff,input_cutoff,outcome_cutoff,
      'SHARED_ROUND_CAPTURE_FIXTURE');
  insert into pg_temp.capture_fixture values(round_id,target_genome,window_id,outcome_cutoff,input_cutoff,
    sources[1],sources[2],shadows[1],shadows[2]);
end; $capture_fixture$;
