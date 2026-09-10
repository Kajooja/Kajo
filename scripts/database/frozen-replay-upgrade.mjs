// Run unchanged forward against populated pre-v2 state, then roll everything back.
export function frozenReplayUpgradeSql(migration, fixture, tables) {
  if (!migration.name.endsWith('_frozen_prediction_replay.sql')) throw new Error('Expected frozen replay forward');
  const names = [...new Set([...tables, 'private.item_action_receipts', 'private.item_action_heads',
    'private.shared_list_proposal_destinations', 'auth.users'])];
  const fingerprints = names.map(name => {
    if (!/^(public|private|auth)\.[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid snapshot table');
    return `select '${name}' as identity,md5(coalesce((select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)
      from ${name} r),'[]'::jsonb)::text) as digest`;
  }).join('\nunion all\n');
  const functions = `select p.oid,p.oid::regprocedure::text as identity,p.proowner,p.proacl,p.prosecdef,p.proconfig,
    case when p.oid in (
      'private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure,
      'private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)'::regprocedure,
      'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure,
      'private.process_shadow_prediction_jobs_v1(integer)'::regprocedure,
      'private.evaluate_shadow_genome_v1(uuid,uuid)'::regprocedure) then null else pg_get_functiondef(p.oid) end as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'`;
  const baselineScores = `with allowed as materialized (select id from public.profiles where private.is_profile_member(id))
    select p.id as profile_id,m.mode,r.item_id,r.score from allowed p
    cross join (values ('FOR_YOU'),('SURPRISE'),('RISK')) m(mode)
    cross join lateral private.rank_items_v0(p.id,m.mode,'BOOK',50,'{}') r`;
  return `begin;
    ${fixture}
    create temp table replay_upgrade_control(genome uuid,window_id uuid) on commit drop;
    do $legacy$ declare window_id uuid := gen_random_uuid(); genome uuid; actor uuid; profile uuid; item uuid;
    begin
      -- All ageing is synthetic and precedes freezing; retain genuine pre-v2
      -- shadows, mature evaluations, a durable receipt and a queued legacy job.
      update private.prediction_runs set requested_at=now()-interval '2 days';
      insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,prediction_id,properties)
        select gen_random_uuid(),r.actor_user_id,r.profile_id,c.item_id,'BOOK',event_type,now()-interval '1 day',r.id,properties
        from private.prediction_runs r join private.prediction_candidates c on c.prediction_id=r.id and c.selected_for_delivery
        cross join (values ('ITEM_IMPRESSION','{}'::jsonb),('ITEM_RATED','{"rating":9}'::jsonb)) e(event_type,properties);
      perform private.process_shadow_prediction_jobs_v1(250);
      select genome_id into strict genome from private.shadow_prediction_runs order by genome_id limit 1;
      insert into private.evaluation_windows(id,window_key,prediction_from,prediction_until,input_cutoff,outcome_cutoff,created_by)
        values(window_id,window_id::text,now()-interval '49 hours',now()-interval '47 hours',
          now()-interval '47 hours',now()-interval '1 hour','replay-upgrade');
      perform private.evaluate_shadow_genome_v1(window_id,genome);
      if not exists(select 1 from private.genome_evaluations where evaluation_window_id=window_id and outcome_count>0) then
        raise exception 'Legacy upgrade lacks a real evaluated shadow';
      end if;
      insert into pg_temp.replay_upgrade_control values(genome,window_id);
      insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
        select id,md5('kajo:predictor-genome:prediction-v1-baseline')::uuid from private.prediction_runs;
      select p.owner_user_id,p.id into actor,profile from public.profiles p where p.profile_type='PERSONAL' limit 1;
      select id into item from public.items limit 1;
      perform set_config('request.jwt.claim.sub',actor::text,true);
      perform public.commit_item_action_v1(jsonb_build_object('version',1,'actionId',gen_random_uuid(),
        'actorUserId',actor,'profileId',profile,'itemId',item,'kind','SET_RATING','rating',8,
        'occurredAt',now(),'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb)));
    end; $legacy$;
    select set_config('request.jwt.claim.sub','a2080000-0000-4000-8000-000000000001',true);
    create temp table replay_baseline_before on commit drop as ${baselineScores};
    alter default privileges for role postgres grant execute on functions to public;
    create temp table replay_rows_before on commit drop as ${fingerprints};
    create temp table replay_functions_before on commit drop as ${functions};
    ${migration.sql}
    do $verify$ declare helper regprocedure; new_window uuid := gen_random_uuid(); result jsonb;
    begin
      if exists((${fingerprints}) except select * from pg_temp.replay_rows_before) then
        raise exception 'Replay forward changed existing data/Auth/receipts/traces/evaluations';
      end if;
      if exists(select * from pg_temp.replay_functions_before except (${functions})) then
        raise exception 'Replay forward changed identities/ACLs or unrelated definitions';
      end if;
      if (select count(*) from (${functions}) f)<>(select count(*)+3 from pg_temp.replay_functions_before) then
        raise exception 'Unexpected new replay functions';
      end if;
      if exists((${baselineScores}) except select * from pg_temp.replay_baseline_before)
        or exists(select * from pg_temp.replay_baseline_before except (${baselineScores})) then
        raise exception 'Unified scoring changed the accepted raw baseline scores';
      end if;
      foreach helper in array array[
        'private.prediction_candidate_score_v2(text,jsonb,double precision,jsonb)'::regprocedure,
        'private.finalize_resurfacing_policy_v1(jsonb,integer)'::regprocedure,
        'private.prediction_delivery_tier_v1(jsonb)'::regprocedure
      ] loop
        if has_function_privilege('authenticated',helper,'execute') or has_function_privilege('anon',helper,'execute')
          or has_function_privilege('service_role',helper,'execute') or (select prosecdef from pg_proc where oid=helper) then
          raise exception 'Open creator defaults leaked a private/invoker replay helper';
        end if;
      end loop;
      result := private.process_shadow_prediction_jobs_v1(250);
      if result<>'{"processed":0,"failed":2}'::jsonb
        or exists(select 1 from private.shadow_prediction_jobs where status='FAILED' and last_error not like 'Unsupported replay inputs:%') then
        raise exception 'Legacy queued inputs were silently reconstructed: %',result;
      end if;
      insert into private.evaluation_windows(id,window_key,prediction_from,prediction_until,input_cutoff,outcome_cutoff,created_by)
        select new_window,new_window::text,w.prediction_from,w.prediction_until,w.input_cutoff,w.outcome_cutoff,'replay-upgrade-v2'
        from private.evaluation_windows w join pg_temp.replay_upgrade_control c on c.window_id=w.id;
      perform private.evaluate_shadow_genome_v1(new_window,(select genome from pg_temp.replay_upgrade_control));
      if not exists(select 1 from private.genome_evaluations where evaluation_window_id=new_window
        and eligibility_reason='NO_MATURE_COMPARABLE_OUTCOMES' and outcome_count=0
        and metrics->>'replayVersion'='shadow-replay-v2') then
        raise exception 'New evaluation mixed incompatible legacy replay scores';
      end if;
    end; $verify$;
    select jsonb_build_object('frozenReplayUpgrade',
      'PASS: unchanged populated data/receipts/frozen traces/evaluations and old identities/ACLs; three private helpers; legacy replay fails closed and is excluded from new comparisons') as snapshot;
    rollback;`;
}
