-- Full-schema serving and frozen-shadow acceptance. Synthetic rows only.
begin;
do $late$
declare
  actor uuid := gen_random_uuid(); partner uuid := gen_random_uuid();
  profile uuid := gen_random_uuid(); personal uuid;
  item uuid := gen_random_uuid(); unseen uuid := gen_random_uuid();
  session uuid := gen_random_uuid(); partner_session uuid := gen_random_uuid();
  personal_session uuid := gen_random_uuid(); prediction uuid; action uuid := gen_random_uuid();
  impression uuid := gen_random_uuid(); forged uuid := gen_random_uuid();
  started timestamptz := now()-interval '3 days'; exposed timestamptz := now()-interval '2 days';
  acted timestamptz := now()-interval '1 day'; before_proof timestamptz;
  command jsonb; receipt jsonb; snapshot jsonb; frozen jsonb; result jsonb;
  ranked record; genome uuid; window_id uuid; label text;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','Late '||right(id::text,8))
    from unnest(array[actor,partner]) fixture(id);
  select id into strict personal from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name) values(profile,'SHARED','Late outcome');
  insert into public.profile_members(profile_id,user_id) values(profile,actor),(profile,partner);
  insert into public.items(id,item_type,title,tags,discoverable) values
    (item,'MOVIE','Late rating',array['late-outcome'],true),
    (unseen,'MOVIE','Unseen control',array['late-outcome'],true);
  insert into public.event_sessions(id,actor_user_id,profile_id,started_at) values
    (session,actor,profile,started),(partner_session,partner,profile,started),
    (personal_session,actor,personal,started);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  select * into strict ranked from public.rank_items_v1(profile,'FOR_YOU','MOVIE',20,
    jsonb_build_object('sessionId',session)) where item_id=item;
  prediction := ranked.prediction_id;
  perform set_config('role','postgres',true);
  -- Only this synthetic run is aged, before its shadow is frozen.
  update private.prediction_runs set requested_at=started where id=prediction;
  result := private.process_shadow_prediction_jobs_v1(250);
  if (result->>'failed')::integer<>0 then raise exception 'Shadow fixture failed: %',result; end if;
  select genome_id into strict genome from private.shadow_prediction_runs
    where source_prediction_id=prediction order by genome_id limit 1;
  command := jsonb_build_object('version',1,'actionId',action,'actorUserId',actor,'profileId',profile,
    'itemId',item,'kind','SET_RATING','rating',0,'occurredAt',acted,'predictionId',prediction,
    'discoveryMode','FOR_YOU','session',jsonb_build_object('sessionId',session,'startedAt',started,'context','{}'::jsonb));
  perform set_config('role','authenticated',true);
  receipt := public.commit_item_action_v1(command);
  perform set_config('role','postgres',true);
  if receipt->>'predictionId' is not null then raise exception 'Missing exposure was attributed at commit'; end if;
  select to_jsonb(e) into strict snapshot from public.events e where e.id=action;
  -- Wrong member, Profile and Item impressions cannot rescue this action.
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id) values
    (gen_random_uuid(),partner,profile,item,'MOVIE','ITEM_IMPRESSION',exposed,partner_session,prediction),
    (gen_random_uuid(),actor,personal,item,'MOVIE','ITEM_IMPRESSION',exposed,personal_session,prediction),
    (gen_random_uuid(),actor,profile,unseen,'MOVIE','ITEM_IMPRESSION',exposed,session,prediction);
  if exists(select 1 from private.prediction_outcome_events_v1(profile,clock_timestamp(),clock_timestamp())) then
    raise exception 'Wrong member/Profile/Item exposure attributed a Shared rating';
  end if;
  -- Two immutable evaluation windows: before and after proof. Both compare the
  -- same already-frozen shadow; later proof must never alter the earlier result.
  foreach label in array array['before','after','undone'] loop
    if label='after' then
      before_proof := clock_timestamp();
      insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id,created_at)
        values(impression,actor,profile,item,'MOVIE','ITEM_IMPRESSION',exposed,session,prediction,before_proof);
      if exists(select 1 from private.prediction_outcome_events_v1(profile,clock_timestamp(),before_proof-interval '1 microsecond')) then
        raise exception 'Later-arriving proof leaked before its evidence cutoff';
      end if;
      if exists(select 1 from private.prediction_outcome_events_v1(profile,acted-interval '1 second',clock_timestamp())) then
        raise exception 'Outcome beyond the occurrence cutoff was used';
      end if;
      -- Duplicate impressions are still one Outcome. A copied client actionId
      -- cannot make an unowned Event part of the private receipt.
      insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id)
        values(gen_random_uuid(),actor,profile,item,'MOVIE','ITEM_IMPRESSION',exposed,session,prediction);
      insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,discovery_mode,properties)
        values(forged,actor,profile,item,'MOVIE','ITEM_RATED',acted,session,'FOR_YOU',snapshot->'properties'),
          (gen_random_uuid(),actor,profile,item,'MOVIE','ITEM_RATED',acted,session,'FOR_YOU','{"actionId":"invalid-uuid","rating":10}');
      if (select count(*) from private.prediction_outcome_events_v1(profile,clock_timestamp(),clock_timestamp()) e
        where e.prediction_id=prediction and e.attribution_source='LATE_EXPOSURE_V1'
          and private.outcome_reward_v1(e.event_type,e.properties)=-1)<>1 then
        raise exception 'Zero rating lost, duplicate evidence counted or forged receipt accepted';
      end if;
      if exists(select 1 from private.prediction_outcome_events_v1(personal,clock_timestamp(),clock_timestamp())) then
        raise exception 'Shared Outcome leaked into Personal learning';
      end if;
      -- Keep forgery from influencing the separate, already-existing raw taste
      -- memory path; this acceptance targets Prediction attribution only.
      delete from public.events where id=forged or properties->>'actionId'='invalid-uuid';
    elsif label='undone' then
      perform set_config('role','authenticated',true);
      perform public.commit_item_action_v1((command-'rating')||jsonb_build_object('kind','UNDO',
        'actionId',gen_random_uuid(),'reversesActionId',action,'occurredAt',acted+interval '1 hour'));
      perform set_config('role','postgres',true);
    end if;
    perform set_config('role','authenticated',true);
    select * into strict ranked from public.rank_items_v1(profile,'FOR_YOU','MOVIE',20,
      jsonb_build_object('sessionId',session)) where item_id=unseen;
    perform set_config('role','postgres',true);
    if (select c.scenario_support from private.prediction_candidates c
      where c.prediction_id=ranked.prediction_id and c.item_id=unseen) <>
        (case when label='after' then 1 else 0 end) then
      raise exception '%: actual serving ScenarioMemory did not reconcile/undo exactly once',label;
    end if;
    if label='after' and (select c.scenario_score from private.prediction_candidates c
      where c.prediction_id=ranked.prediction_id and c.item_id=unseen)>=0 then
      raise exception 'Zero rating did not have a negative Scenario reward';
    end if;
    if (select policy_version from private.prediction_runs where id=ranked.prediction_id)
      not like '%+outcome-attribution-v1' then raise exception 'Missing serving attribution version'; end if;
    window_id := gen_random_uuid();
    insert into private.evaluation_windows(id,window_key,prediction_from,prediction_until,input_cutoff,outcome_cutoff,created_by)
      values(window_id,window_id::text,started-interval '1 hour',started+interval '1 hour',
        started+interval '1 hour',now()-interval '1 hour','late-outcome-smoke');
    perform private.evaluate_shadow_genome_v1(window_id,genome);
    if (select outcome_count from private.genome_evaluations
      where evaluation_window_id=window_id and scope_type='GLOBAL')<>
        (case when label='after' then 1 else 0 end) then
      raise exception '%: actual frozen-shadow evaluation lost or duplicated a reconciled/reversed outcome',label;
    end if;
    if exists(select 1 from private.genome_evaluations where evaluation_window_id=window_id
      and (metrics->>'outcomeAttributionVersion' is distinct from 'outcome-attribution-v1'
        or metrics->>'evidenceCutoff' is null)) then raise exception 'Unversioned evaluation'; end if;
    if label='before' then
      select jsonb_agg(to_jsonb(e) order by e.id) into frozen from private.genome_evaluations e;
    elsif exists(select 1 from jsonb_array_elements(frozen) old
      join private.genome_evaluations e on e.id=(old->>'id')::uuid where to_jsonb(e)<>old) then
      raise exception 'Reconciliation rewrote a frozen evaluation';
    end if;
  end loop;
  perform set_config('role','authenticated',true);
  if public.commit_item_action_v1(command) is distinct from receipt then raise exception 'Replay changed accepted receipt'; end if;
  perform set_config('role','postgres',true);
  if (select to_jsonb(e) from public.events e where e.id=action) is distinct from snapshot then
    raise exception 'Reconciliation rewrote original Event';
  end if;
  if has_function_privilege('anon','private.prediction_outcome_events_v1(uuid,timestamptz,timestamptz)','execute')
    or has_function_privilege('authenticated','private.prediction_outcome_events_v1(uuid,timestamptz,timestamptz)','execute')
    or has_function_privilege('service_role','private.prediction_outcome_events_v1(uuid,timestamptz,timestamptz)','execute') then
    raise exception 'Internal attribution projection exposed directly';
  end if;
end;
$late$;
select jsonb_build_object('lateOutcomes','PASS: exact late Shared exposure; serving and frozen evaluation parity; zero/undo/cutoffs/forgery/deduplication; immutable history and private ACLs') as snapshot;
rollback;
