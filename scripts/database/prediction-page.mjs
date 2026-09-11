import { readFile } from 'node:fs/promises';

export async function predictionPageSmokeSql() {
  const fixture = await readFile(new URL('candidate-pool-fixture.sql', import.meta.url), 'utf8');
  const smoke = await readFile(new URL('prediction-page-smoke.sql', import.meta.url), 'utf8');
  return `begin; ${fixture}\n${smoke}\nrollback;`;
}

export function predictionPageUpgradeSql(migration, fixture) {
  if (!migration.name.endsWith('_identified_prediction_page.sql')) throw new Error('Expected identified page forward');
  const functions = `select p.oid,p.oid::regprocedure::text as identity,p.proowner,p.proacl,p.prosecdef,p.proconfig,p.provolatile,
    case when p.oid='private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure
      then null else pg_get_functiondef(p.oid) end as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f'`;
  return `begin;
    ${fixture}
    create temp table page_upgrade_functions on commit drop as ${functions};
    create temp table page_upgrade_constraints on commit drop as
      select c.oid,c.conrelid,c.conname,pg_get_constraintdef(c.oid) as definition
      from pg_constraint c join pg_namespace n on n.oid=c.connamespace
      where n.nspname in ('public','private');
    create temp table page_upgrade_rows(identity text primary key,digest text) on commit drop;
    do $snapshot$ declare relation record; digest text;
    begin
      for relation in select format('%I.%I',n.nspname,c.relname) as identity
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users')) loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        insert into pg_temp.page_upgrade_rows values(relation.identity,digest);
      end loop;
    end; $snapshot$;
    ${migration.sql}
    do $verify$ declare relation record; digest text; response jsonb; actor uuid; profile uuid;
    begin
      for relation in select * from pg_temp.page_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        if digest<>relation.digest then raise exception 'Page forward changed data in %',relation.identity; end if;
      end loop;
      if exists(select * from pg_temp.page_upgrade_functions except (${functions})) then
        raise exception 'Page forward changed existing function boundaries/unrelated definitions';
      end if;
      if (select count(*) from (${functions}) f where f.oid not in(select oid from pg_temp.page_upgrade_functions))<>3 then
        raise exception 'Unexpected new page functions';
      end if;
      if exists(select * from pg_temp.page_upgrade_constraints except
        select c.oid,c.conrelid,c.conname,pg_get_constraintdef(c.oid) from pg_constraint c) then
        raise exception 'Page forward changed existing constraints';
      end if;
      if exists(select 1 from private.prediction_page_receipts) then raise exception 'Upgrade created unsolicited receipts'; end if;
      select owner_user_id,id into strict actor,profile from public.profiles where profile_type='PERSONAL'
        and owner_user_id='a2080000-0000-4000-8000-000000000001';
      perform set_config('request.jwt.claim.sub',actor::text,true);
      perform set_config('role','authenticated',true);
      response := public.rank_items_page_v1(jsonb_build_object('version',1,'requestId',gen_random_uuid(),
        'profileId',profile,'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',20,'context','{}'::jsonb));
      if jsonb_array_length(response->'items')<>1 then raise exception 'Populated upgrade lost available Item'; end if;
      if (select count(*) from public.rank_items_v1(profile,'FOR_YOU','BOOK',20,'{}'))<>1 then
        raise exception 'Populated upgrade broke legacy row RPC';
      end if;
      perform set_config('role','postgres',true);
    end; $verify$;
    select jsonb_build_object('predictionPageUpgrade',
      'PASS: unchanged populated data/Auth/traces, existing function boundaries/constraints and both public ranking contracts') as snapshot;
    rollback;`;
}
