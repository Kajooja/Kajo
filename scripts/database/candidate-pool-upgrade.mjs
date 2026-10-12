import { readFile } from 'node:fs/promises';

export async function candidatePoolSmokeSql() {
  const [fixture, probe] = await Promise.all(['candidate-pool-fixture.sql', 'candidate-pool-smoke.sql']
    .map(name => readFile(new URL(name, import.meta.url), 'utf8')));
  return `begin;\n${fixture}\n${probe}\nrollback;`;
}

export function candidatePoolUpgradeSql(migration, fixture, tables) {
  if (!migration.name.endsWith('_eligibility_first_candidate_pool.sql')) throw new Error('Expected candidate pool forward');
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
  const constraints = `select c.oid,c.conrelid,c.conname,pg_get_constraintdef(c.oid) as definition from pg_constraint c
    join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private')
    and not(c.conrelid='private.shadow_prediction_runs'::regclass and c.conname='shadow_prediction_runs_counts_check')`;
  return `begin;
    ${fixture}
    do $prepare$ declare actor uuid; profile uuid; item uuid; result jsonb;
    begin
      result := private.process_shadow_prediction_jobs_v1(250);
      if (result->>'failed')::integer<>0 then raise exception 'Invalid pre-upgrade v2 shadow fixture'; end if;
      select p.owner_user_id,p.id into actor,profile from public.profiles p where p.profile_type='PERSONAL' limit 1;
      select id into item from public.items limit 1;
      perform set_config('request.jwt.claim.sub',actor::text,true);
      perform public.commit_item_action_v1(jsonb_build_object('version',1,'actionId',gen_random_uuid(),
        'actorUserId',actor,'profileId',profile,'itemId',item,'kind','SET_RATING','rating',8,
        'occurredAt',now(),'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb)));
    end; $prepare$;
    create temp table pool_rows_before on commit drop as ${fingerprints};
    create temp table pool_functions_before on commit drop as ${functions};
    create temp table pool_constraints_before on commit drop as ${constraints};
    ${migration.sql}
    do $verify$ declare result jsonb;
    begin
      if exists((${fingerprints}) except select * from pg_temp.pool_rows_before) then
        raise exception 'Pool forward changed existing data/Auth/receipts/frozen traces';
      end if;
      if exists(select * from pg_temp.pool_functions_before except (${functions}))
        or exists((${functions}) except select * from pg_temp.pool_functions_before) then
        raise exception 'Pool forward changed function identities/ACLs/configuration or unrelated definitions';
      end if;
      if exists(select * from pg_temp.pool_constraints_before except (${constraints}))
        or exists((${constraints}) except select * from pg_temp.pool_constraints_before) then
        raise exception 'Pool forward changed an unrelated constraint';
      end if;
      -- Pending v2 inputs from the preceding generation policy remain replayable.
      insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
        select id,md5('kajo:predictor-genome:prediction-v1-baseline')::uuid from private.prediction_runs;
      result := private.process_shadow_prediction_jobs_v1(250);
      if result<>'{"processed":2,"failed":0}'::jsonb then raise exception 'Pre-admission v2 replay was lost: %',result; end if;
      if exists(select 1 from private.shadow_prediction_runs r join private.shadow_prediction_candidates s on s.shadow_prediction_id=r.id
        join private.prediction_candidates c on c.prediction_id=r.source_prediction_id and c.item_id=s.item_id
        where r.genome_id=md5('kajo:predictor-genome:prediction-v1-baseline')::uuid
          and (s.shadow_score<>c.final_score or s.shadow_rank<>c.final_rank or s.hypothetical_selected<>c.selected_for_delivery)) then
        raise exception 'Pre-admission v2 baseline replay drifted';
      end if;
    end; $verify$;
    select jsonb_build_object('candidatePoolUpgrade',
      'PASS: unchanged populated data/receipts/frozen traces, all function boundaries and unrelated constraints; prior v2 replay retained') as snapshot;
    rollback;`;
}
