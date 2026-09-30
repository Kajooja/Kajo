-- Actual serving -> frozen baseline/challenger replay on the complete schema.
-- Synthetic accounts, Events and traces only; every mutation rolls back.
begin;
create temp table replay_sources(id uuid primary key) on commit drop;
create temp table replay_frozen(prediction_id uuid,item_id uuid,body jsonb) on commit drop;
do $replay$
declare
  actor uuid := gen_random_uuid(); partner uuid := gen_random_uuid();
  shared uuid := gen_random_uuid(); personal uuid; profile uuid; seed_prediction uuid;
  seed uuid := 'a2290000-0000-4000-8000-000000000001';
  ordinary uuid := 'a2290000-0000-4000-8000-000000000002';
  tied uuid := 'a2290000-0000-4000-8000-000000000003';
  terminal uuid := 'a2290000-0000-4000-8000-000000000004';
  reminder_a uuid := 'a2290000-0000-4000-8000-000000000005';
  reminder_b uuid := 'a2290000-0000-4000-8000-000000000006';
  recent uuid := 'a2290000-0000-4000-8000-000000000007';
  baseline uuid := md5('kajo:predictor-genome:prediction-v1-baseline')::uuid;
  challenger uuid := gen_random_uuid(); flip_source uuid;
  current_mode text; page_size integer; ranked record; outcome jsonb; features jsonb; config jsonb;
  event_snapshot jsonb; assignments jsonb; scalar_before jsonb; scalar_after jsonb;
  saved_count integer;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','Replay '||right(id::text,8))
    from unnest(array[actor,partner]) fixture(id);
  select id into strict personal from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name) values(shared,'SHARED','Replay fixture');
  insert into public.profile_members(profile_id,user_id) values(shared,actor),(shared,partner);
  insert into public.items(id,item_type,title,tags,discoverable)
    select id,'BOOK','Replay '||right(id::text,2),array['replay'],true
    from unnest(array[seed,ordinary,tied,terminal,reminder_a,reminder_b,recent]) fixture(id);
  -- Only synthetic history is aged, before it becomes input to any tested run.
  -- This gives real non-zero ScenarioMemory and fractional raw taste features.
  foreach profile in array array[personal,shared] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform set_config('role','authenticated',true);
    select * into strict ranked from public.rank_items_v1(profile,'FOR_YOU','BOOK',20,'{}') where item_id=seed;
    seed_prediction := ranked.prediction_id;
    perform set_config('role','postgres',true);
    update private.prediction_runs set requested_at=now()-interval '2 days' where id=seed_prediction;
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,prediction_id,properties)
      values(gen_random_uuid(),actor,profile,seed,'BOOK','ITEM_IMPRESSION',now()-interval '25 hours',seed_prediction,'{}'),
        (gen_random_uuid(),actor,profile,seed,'BOOK','ITEM_RATED',now()-interval '23 hours',seed_prediction,'{"rating":9}');
    insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,rating,saved)
      values(profile,terminal,actor,true,10,false),
        (profile,reminder_a,actor,false,null,true),(profile,reminder_b,actor,false,null,true),
        (profile,recent,actor,false,null,true);
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at)
      values(gen_random_uuid(),actor,profile,recent,'BOOK','ITEM_SAVED',now()-interval '1 day');
    -- Saved projection creates real List membership; its age is authoritative.
    update public.item_list_entries entry set added_at=now()-interval '45 days'
      from public.item_lists list where list.id=entry.list_id and list.profile_id=profile
        and entry.item_id in (reminder_a,reminder_b);
  end loop;
  update public.items set discoverable=false where id=seed;
  update public.items set tags=array['unlearned'] where id=reminder_b;
  foreach profile in array array[personal,shared] loop
    foreach current_mode in array array['FOR_YOU','SURPRISE','RISK'] loop
      foreach page_size in array array[1,3,20] loop
        perform set_config('role','authenticated',true);
        select * into ranked from public.rank_items_v1(profile,current_mode,'BOOK',page_size,'{}') limit 1;
        perform set_config('role','postgres',true);
        if ranked.prediction_id is null then raise exception 'Expected a nonempty replay source'; end if;
        insert into pg_temp.replay_sources values(ranked.prediction_id);
      end loop;
    end loop;
  end loop;
  if (select count(*) from pg_temp.replay_sources)<>18 then raise exception 'Missing replay matrix case'; end if;
  if not exists(select 1 from private.prediction_candidates c join pg_temp.replay_sources s on s.id=c.prediction_id
    where c.scenario_score<>0 and c.explanation#>>'{scoringFeatures,longTerm}'<>c.explanation->>'longTerm') then
    raise exception 'Fixture lacks nonzero ScenarioMemory and full-precision features';
  end if;
  if not exists(select 1 from private.prediction_candidates c join pg_temp.replay_sources s on s.id=c.prediction_id
    where (c.explanation#>>'{sharedCommonFit,contribution}')::double precision<>0) then
    raise exception 'Fixture lacks Shared common-fit signal';
  end if;
  if exists(select 1 from private.prediction_candidates c join pg_temp.replay_sources s on s.id=c.prediction_id
    join private.prediction_runs r on r.id=s.id
    where abs(c.final_score-(c.source_score+c.scenario_score * case r.discovery_mode
      when 'FOR_YOU' then 2.2 when 'SURPRISE' then 1.6 else 1.0 end
      +(c.explanation#>>'{sharedCommonFit,contribution}')::double precision))>1e-12) then
    raise exception 'Serving lost the accepted Scenario/common-fit formula';
  end if;
  if exists(select 1 from private.prediction_candidates c join pg_temp.replay_sources s on s.id=c.prediction_id
    where c.item_id in (terminal,recent) and c.selected_for_delivery) then
    raise exception 'Serving selected a terminal/recent-saved card';
  end if;
  select count(*) into saved_count from private.prediction_candidates c join pg_temp.replay_sources s on s.id=c.prediction_id
    where c.explanation#>>'{resurfacingPolicy,classification}'='SAVED_REMINDER' and c.selected_for_delivery;
  if saved_count<>12 then raise exception 'Expected one reminder in each size 3/20 slate, got %: %',saved_count,(select jsonb_agg(distinct c.explanation->'resurfacingPolicy') from private.prediction_candidates c join pg_temp.replay_sources s on s.id=c.prediction_id where c.item_id=reminder_a); end if;
  if exists(select 1 from private.prediction_candidates a join private.prediction_candidates b
    on b.prediction_id=a.prediction_id and b.item_id=tied
    join private.prediction_runs r on r.id=a.prediction_id join pg_temp.replay_sources s on s.id=r.id
    where a.item_id=ordinary and r.discovery_mode='FOR_YOU' and (a.final_score<>b.final_score or a.final_rank>=b.final_rank)) then
    raise exception 'Exact FOR_YOU ties lost the deterministic Item-id rule';
  end if;
  -- A precision boundary which old four-decimal explanations cannot distinguish.
  select g.config into strict config from private.predictor_genomes g where g.id=baseline;
  features := '{"scoringFeatures":{"version":"prediction-features-v2","direct":0,"longTerm":1.000041,"shortTerm":0,"novelty":0,"exploration":0,"reactionQueuePenalty":0,"impressionCooldownPenalty":0}}';
  if private.prediction_candidate_score_v2('FOR_YOU',features,0,config) <> 1.000041
    or private.prediction_candidate_score_v2('FOR_YOU',jsonb_set(features,'{scoringFeatures,longTerm}','1.000049'),0,config) <=
       private.prediction_candidate_score_v2('FOR_YOU',features,0,config) then
    raise exception 'Full precision was lost at the scoring boundary';
  end if;
  begin
    perform private.prediction_candidate_score_v2('FOR_YOU',features-'scoringFeatures',0,config);
    raise exception 'Missing raw features were guessed';
  exception when invalid_parameter_value then null; end;
  -- Same canonical scalar score under the forced baseline is also V0's score.
  select jsonb_agg(jsonb_build_array(item_id,score) order by item_id) into scalar_before
    from private.rank_items_v0(personal,'RISK','BOOK',50,'{}');
  select jsonb_agg(jsonb_build_array(item_id,score) order by item_id) into scalar_after
    from private.rank_items_scalar_v1(personal,'RISK','BOOK',50,'{}',baseline);
  if scalar_before is distinct from scalar_after then raise exception 'Candidate generator/scalar score drift'; end if;
  -- A deliberately different, unassigned test genome prefers the other reminder.
  -- Its shadow must reapply the cap, not copy the baseline's finalized decision.
  insert into private.predictor_genomes(id,genome_key,model_family,code_version,feature_version,
    memory_version,outcome_version,reward_version,config,created_by)
    select challenger,'replay-reminder-flip','SCALAR_V1','shadow-replay-v2','prediction-features-v2',
      g.memory_version,g.outcome_version,g.reward_version,
      jsonb_set(g.config,'{modeWeights,FOR_YOU}',
        '{"direct":0,"longTerm":0,"shortTerm":0,"novelty":4,"exploration":0,"scenario":0,"reactionPenalty":0,"impressionCooldown":0}'),
      'frozen-replay-smoke' from private.predictor_genomes g where g.id=baseline;
  select r.id into strict flip_source from private.prediction_runs r join pg_temp.replay_sources s on s.id=r.id
    where r.profile_id=personal and r.discovery_mode='FOR_YOU' and r.candidate_count=6 limit 1;
  if (select c.explanation#>>'{resurfacingPolicy,classification}' from private.prediction_candidates c
    where c.prediction_id=flip_source and c.item_id=reminder_a) is distinct from 'SAVED_REMINDER'
    or (select explanation#>>'{resurfacingPolicy,classification}' from private.rank_items_scalar_v1(
      personal,'FOR_YOU','BOOK',50,'{}',challenger) where item_id=reminder_b) is distinct from 'SAVED_REMINDER' then
    raise exception 'Reminder flip lacks an actual scalar serving control';
  end if;
  insert into pg_temp.replay_frozen select c.prediction_id,c.item_id,to_jsonb(c)
    from private.prediction_candidates c join pg_temp.replay_sources s on s.id=c.prediction_id;
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
    select id,baseline from pg_temp.replay_sources;
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id) values(flip_source,challenger);
  -- Replay must use only frozen inputs, even after membership/catalog/taste drift.
  update public.items set tags=array['later-catalog'],discoverable=false;
  update public.item_interactions set consumed=true,rating=0;
  delete from public.profile_members where profile_id=shared and user_id=partner;
  select jsonb_agg(to_jsonb(e) order by e.id) into event_snapshot from public.events e;
  select jsonb_agg(to_jsonb(a) order by a.id) into assignments from private.policy_assignments a;
  outcome := private.process_shadow_prediction_jobs_v1(250);
  if (outcome->>'failed')::integer<>0 or (outcome->>'processed')::integer<72 then
    raise exception 'Frozen worker failed the replay matrix: %',outcome;
  end if;
  if exists(select 1 from private.shadow_prediction_runs r join pg_temp.replay_sources s on s.id=r.source_prediction_id
    join private.shadow_prediction_candidates shadow on shadow.shadow_prediction_id=r.id
    join private.prediction_candidates c on c.prediction_id=r.source_prediction_id and c.item_id=shadow.item_id
    where r.genome_id=baseline and (shadow.shadow_score<>c.final_score or shadow.shadow_rank<>c.final_rank
      or shadow.hypothetical_selected<>c.selected_for_delivery
      or shadow.explanation->'resurfacingPolicy'<>c.explanation->'resurfacingPolicy')) then
    raise exception 'Baseline replay differs in score, rank, eligibility or selected predicate';
  end if;
  if (select count(*) from private.shadow_prediction_runs r join pg_temp.replay_sources s on s.id=r.source_prediction_id
    where r.genome_id=baseline and r.code_version='shadow-replay-v2' and r.feature_version='prediction-features-v2')<>18 then
    raise exception 'Missing/versionless baseline control';
  end if;
  if exists(select 1 from private.shadow_prediction_candidates c
    where c.hypothetical_selected and (c.explanation#>>'{resurfacingPolicy,eligible}')::boolean is not true) then
    raise exception 'A challenger selected a suppressed card';
  end if;
  if exists(select shadow_prediction_id from private.shadow_prediction_candidates
    where explanation#>>'{resurfacingPolicy,classification}'='SAVED_REMINDER'
    group by shadow_prediction_id having count(*)>1) then raise exception 'Challenger exceeded the reminder cap'; end if;
  if not exists(select 1 from private.shadow_prediction_candidates c join private.shadow_prediction_runs r
    on r.id=c.shadow_prediction_id where r.genome_id=challenger and c.item_id=reminder_b
      and c.hypothetical_selected and c.explanation#>>'{resurfacingPolicy,classification}'='SAVED_REMINDER') then
    raise exception 'Challenger copied the source reminder instead of replaying its scalar cap';
  end if;
  if exists(select 1 from pg_temp.replay_frozen f join private.prediction_candidates c
    on c.prediction_id=f.prediction_id and c.item_id=f.item_id where to_jsonb(c)<>f.body)
    or (select jsonb_agg(to_jsonb(e) order by e.id) from public.events e) is distinct from event_snapshot
    or (select jsonb_agg(to_jsonb(a) order by a.id) from private.policy_assignments a) is distinct from assignments then
    raise exception 'Replay changed production traces, historical Events or policy assignments';
  end if;
  if private.process_shadow_prediction_jobs_v1(250)<>'{"processed":0,"failed":0}'::jsonb then
    raise exception 'Worker reran finished frozen jobs';
  end if;
end;
$replay$;
select jsonb_build_object('frozenReplay',
  'PASS: 18 Personal/Shared mode/page controls; exact scores/ranks/selection, Scenario/common-fit, precision/ties, suppression/reminder cap and future-state isolation') as snapshot;
rollback;
