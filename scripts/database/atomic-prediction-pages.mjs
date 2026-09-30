import { readFile } from 'node:fs/promises';

export async function atomicPredictionPagesSmokeSql(name = 'atomic-prediction-pages-smoke.sql') {
  const fixture = await readFile(new URL('candidate-pool-fixture.sql', import.meta.url), 'utf8');
  const smoke = await readFile(new URL(name, import.meta.url), 'utf8');
  return `begin; ${fixture}\n${smoke}\nrollback;`;
}

// Apply both successors to an already populated first-page installation. The
// first snapshot precedes windows; the second also protects an existing window.
export function predictionContinuationUpgradeSql(windowMigration, pageMigration, fixture) {
  if (!windowMigration.name.endsWith('_prediction_continuation_windows.sql')
    || !pageMigration.name.endsWith('_atomic_prediction_pages.sql')) throw new Error('Expected ordered continuation forwards');
  const snapshot = `do $snapshot$ declare relation record; digest text;
    begin
      for relation in select format('%I.%I',n.nspname,c.relname) identity
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users')) loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        insert into pg_temp.continuation_upgrade_rows values(relation.identity,digest)
          on conflict(identity) do update set digest=excluded.digest;
      end loop;
    end; $snapshot$;`;
  const verify = `do $verify$ declare relation record; digest text;
    begin
      for relation in select * from pg_temp.continuation_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        if digest<>relation.digest then raise exception 'Continuation forward changed populated %',relation.identity; end if;
      end loop;
    end; $verify$;`;
  return `begin;
    ${fixture}
    create temp table continuation_upgrade(request jsonb,response jsonb,cached_window jsonb,legacy_definition text) on commit drop;
    create temp table continuation_upgrade_rows(identity text primary key,digest text) on commit drop;
    do $seed$ declare actor uuid := 'a2080000-0000-4000-8000-000000000001'; profile uuid; request jsonb; response jsonb;
    begin
      select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
      perform set_config('request.jwt.claim.sub',actor::text,true);
      request := jsonb_build_object('version',1,'requestId',gen_random_uuid(),'profileId',profile,
        'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',20,'context','{}'::jsonb);
      perform set_config('role','authenticated',true);
      response := public.rank_items_page_v1(request);
      perform set_config('role','postgres',true);
      insert into pg_temp.continuation_upgrade values(request,response,null,pg_get_functiondef('private.rank_items_page_v1(jsonb)'::regprocedure));
    end; $seed$;
    ${snapshot}
    ${windowMigration.sql}
    ${verify}
    update pg_temp.continuation_upgrade set cached_window=private.open_prediction_window_v1((request->>'requestId')::uuid);
    ${snapshot}
    create temp table continuation_upgrade_functions on commit drop as
      select p.oid,p.oid::regprocedure::text identity,p.proowner,p.proacl,
        case when p.oid in ('private.rank_items_page_v1(jsonb)'::regprocedure,
          'private.process_shadow_prediction_jobs_v1(integer)'::regprocedure,
          'private.evaluate_shadow_genome_v1(uuid,uuid)'::regprocedure) then null else pg_get_functiondef(p.oid) end definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f';
    ${pageMigration.sql}
    ${verify}
    do $accept$ declare checkpoint record; response jsonb;
    begin
      select * into strict checkpoint from pg_temp.continuation_upgrade;
      if private.read_prediction_window_v1((checkpoint.cached_window->>'id')::uuid)<>checkpoint.cached_window
        or pg_get_functiondef('private.rank_items_first_page_v1(jsonb)'::regprocedure)<>
          replace(checkpoint.legacy_definition,'FUNCTION private.rank_items_page_v1(','FUNCTION private.rank_items_first_page_v1(') then
        raise exception 'Upgrade changed old window or first-page implementation'; end if;
      if exists(select 1 from pg_temp.continuation_upgrade_functions before
        join pg_proc p on p.oid=before.oid where p.proowner<>before.proowner or p.proacl is distinct from before.proacl
          or (before.definition is not null and before.definition<>pg_get_functiondef(p.oid))) then
        raise exception 'Upgrade changed existing ownership, grants or unrelated function'; end if;
      if exists(select 1 from private.prediction_page_contexts) or exists(select 1 from private.prediction_page_cursors) then
        raise exception 'Upgrade manufactured page evidence'; end if;
      perform set_config('role','authenticated',true);
      if public.rank_items_page_v1(checkpoint.request)<>checkpoint.response then raise exception 'Upgrade rewrote existing first-page receipt'; end if;
      response := public.rank_items_page_v1(checkpoint.request||jsonb_build_object('version',2,'requestId',gen_random_uuid()));
      if response->'version'<>'2'::jsonb or jsonb_array_length(response->'items')<>1 then raise exception 'Upgraded v2 reader failed'; end if;
      perform set_config('role','postgres',true);
    end; $accept$;
    select jsonb_build_object('continuationUpgrade','PASS: populated pre-window receipts, exact old windows/data/ACLs, v1 retry and v2 delivery') snapshot;
    rollback;`;
}
