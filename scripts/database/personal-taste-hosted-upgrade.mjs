// Review/preflight and disposable rehearsal only. No network or hosted apply.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { personalNativeDecayFixtureSql } from './personal-native-decay.mjs';
import { personalTasteChallengeFixtureSql } from './personal-taste-challenge.mjs';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';

export const tasteHostedManifest = JSON.parse(await readFile(new URL('personal-taste-hosted-upgrade.json', import.meta.url), 'utf8'));
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const hash = value => createHash('sha256').update(value).digest('hex');

// Exact source identities only. A compact body is recognized so preflight can
// demand the separate append-only compatibility bridge, never normalize drift.
const originalGuardSql=await readFile(new URL('../../supabase/migrations/20260904170000_sleep_layer_v1_foundation.sql',import.meta.url),'utf8');
export const tasteImmutableGuardCanonicalBody=originalGuardSql.match(/create or replace function private\.reject_immutable_prediction_artifact_change_v1\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i)?.[1];
assert.ok(tasteImmutableGuardCanonicalBody,'Canonical immutable guard source missing');
export const tasteImmutableGuardCompactBody=" begin raise exception '% is immutable; create a new versioned row instead', tg_table_name using errcode = '55000'; end; ";

export function validateTasteHostedForwards(files) {
  assert.equal(files.length, tasteHostedManifest.forwards.length, 'Expected the exact reviewed forward chain');
  files.forEach((file, index) => {
    const expected = tasteHostedManifest.forwards[index];
    assert.equal(file.name, expected.filename, 'Forward dependency order changed');
    assert.equal(hash(file.sql), expected.sha256, `Reviewed SQL changed: ${file.name}`);
  });
  return files;
}

export async function loadTasteHostedForwards() {
  return validateTasteHostedForwards(await Promise.all(tasteHostedManifest.forwards.map(async file => ({
    name: file.filename, sql: await readFile(new URL('../../supabase/migrations/' + file.filename, import.meta.url), 'utf8'),
  }))));
}

const signatures = [
  'private.build_profile_memory_state_v1(uuid,timestamptz)',
  'private.rank_items_v0(uuid,text,text,integer,jsonb)',
  'private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',
  'private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)',
  'private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',
  'private.get_shared_discovery_overlay(uuid,text)',
];

// Derive expected definitions/permissions from repository SQL in a new local
// database. No live project/history/ACL snapshot is stored in the repository.
export async function tasteCatalogFunctionReference() {
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const {files}=await buildFreshInstallation();
    const index=files.findIndex(file=>file.name===tasteHostedManifest.sourceCheckpoint);
    assert.ok(index>=0,'Reviewed source checkpoint missing');
    for(const file of files.slice(0,index+1))await db.exec(file.sql);
    const result=await db.query(`select s.signature,md5(p.prosrc) as "sourceMd5",
      pg_get_userbyid(p.proowner) as owner,p.prosecdef as "securityDefiner",
      p.proconfig as configuration,p.proacl::text as acl
      from unnest($1::text[]) with ordinality s(signature,position)
      join pg_proc p on p.oid=to_regprocedure(s.signature) order by s.position`,[signatures]);
    assert.equal(result.rows.length,signatures.length);
    return result.rows;
  }finally{await db.close();}
}

export async function tasteHostedPreflightSql(checkpoint) {
  assert.ok(checkpoint?.target,'A private operator checkpoint is required');
  const {target,functions}=checkpoint;
  assert.match(target.projectRef,/^[a-z]{20}$/);
  assert.equal(target.postgresMajor,17);
  assert.ok(Number.isSafeInteger(target.historyCount)&&target.historyCount>=0);
  assert.match(target.historyMd5,/^[a-f0-9]{32}$/);
  assert.deepEqual(functions,await tasteCatalogFunctionReference(),'Observed bodies/security must match the reviewed repository generation');
  return `begin read only;
    set local statement_timeout='10s';set local search_path=pg_catalog;
    do $preflight$ declare history_digest text; history_count bigint; installed record; f jsonb; guard pg_catalog.pg_proc%rowtype;
    begin
      if split_part(current_setting('server_version'),'.',1)::integer<>${target.postgresMajor} then
        raise exception 'Hosted Taste PostgreSQL generation changed';end if;
      select md5(coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,
        'statementMd5',md5(array_to_string(statements,E'\\n'))) order by version),'[]'::jsonb)::text),count(*)
        into history_digest,history_count from supabase_migrations.schema_migrations;
      if history_count<>${target.historyCount} or history_digest<>${quote(target.historyMd5)} then
        raise exception 'Hosted Taste history changed; review the actual successful prefix';end if;
      for f in select value from jsonb_array_elements(${quote(JSON.stringify(functions))}::jsonb) loop
        select p.prosrc,p.proowner,p.prosecdef,p.proconfig,p.proacl into installed
          from pg_proc p where p.oid=to_regprocedure(f->>'signature');
        if not found or md5(installed.prosrc)<>f->>'sourceMd5' then
          raise exception 'Hosted Taste catalog-generation source drift: %',f->>'signature';end if;
        if pg_get_userbyid(installed.proowner) is distinct from f->>'owner'
          or installed.prosecdef is distinct from (f->>'securityDefiner')::boolean
          or to_jsonb(installed.proconfig) is distinct from f->'configuration'
          or installed.proacl::text is distinct from f->>'acl' then
          raise exception 'Hosted Taste function security/configuration drift: %',f->>'signature';end if;
      end loop;
      select p.* into guard from pg_catalog.pg_proc p
        where p.oid=pg_catalog.to_regprocedure('private.reject_immutable_prediction_artifact_change_v1()');
      if not found or guard.prosecdef or guard.prokind<>'f'
        or guard.prorettype<>'pg_catalog.trigger'::pg_catalog.regtype
        or guard.prolang<>(select oid from pg_catalog.pg_language where lanname='plpgsql')
        or pg_catalog.pg_get_userbyid(guard.proowner)<>'postgres'
        or guard.proconfig is distinct from array['search_path=""']::text[]
        or guard.proacl::text is distinct from '{postgres=X/postgres}' then
        raise exception 'Hosted Taste immutable guard security/configuration drift';end if;
      if guard.prosrc=${quote(tasteImmutableGuardCompactBody)} then
        raise exception 'Hosted Taste immutable guard requires the exact compatibility bridge before forwards';end if;
      if guard.prosrc is distinct from ${quote(tasteImmutableGuardCanonicalBody)} then
        raise exception 'Hosted Taste immutable guard source drift';end if;
      if to_regprocedure('public.get_profile_bootstrap_status_v1(uuid)') is null
        or to_regprocedure('public.taste_session_v1(jsonb)') is not null
        or to_regprocedure('public.taste_challenge_v1(jsonb)') is not null then
        raise exception 'Hosted Taste endpoint checkpoint changed';end if;
    end;$preflight$;
    select jsonb_build_object('hostedTastePreflight','PASS: observed history and catalog-generation bodies match',
      'expectedProjectRef',${quote(target.projectRef)},'forwards',${tasteHostedManifest.forwards.length}) snapshot;
    rollback;`;
}

export async function tasteHostedUpgradeSql(files) {
  validateTasteHostedForwards(files);
  const fixture = await personalNativeDecayFixtureSql();
  const challenge = await personalTasteChallengeFixtureSql();
  const smoke = await readFile(new URL('personal-taste-challenge-smoke.sql', import.meta.url), 'utf8');
  return `begin;
    -- This fixture fails on any existing application data: never run on hosted.
    ${fixture}
    create temp table taste_upgrade_rows(identity text,columns text[],digest text) on commit drop;
    create temp table taste_upgrade_functions on commit drop as
      select p.oid,p.proowner,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private') and p.prokind='f';
    create temp table taste_upgrade_history(digest text) on commit drop;
    do $snapshot$ declare r record; body text;
    begin
      for r in select c.oid,format('%I.%I',n.nspname,c.relname) identity,
        array(select a.attname::text from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped order by a.attnum) columns
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
        and (n.nspname in('public','private') or (n.nspname='auth' and c.relname='users')) loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text) from %s x',r.identity) into body;
        insert into pg_temp.taste_upgrade_rows values(r.identity,r.columns,body);
      end loop;
      if to_regclass('supabase_migrations.schema_migrations') is not null then
        execute 'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text) from supabase_migrations.schema_migrations x' into body;
        insert into pg_temp.taste_upgrade_history values(body);
      end if;
    end;$snapshot$;
    ${files.map(file => file.sql).join('\n')}
    do $preserve$ declare r record; body text;
    begin
      for r in select * from pg_temp.taste_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(j.body order by j.body::text),''[]''::jsonb)::text)
          from %s x cross join lateral(select jsonb_object_agg(key,value) body from jsonb_each(to_jsonb(x)) where key=any($1)) j',r.identity)
          into body using r.columns;
        if body is distinct from r.digest then raise exception 'Hosted Taste chain changed old rows: %',r.identity;end if;
      end loop;
      if exists(select * from pg_temp.taste_upgrade_functions except select oid,proowner,proacl from pg_proc) then
        raise exception 'Hosted Taste chain changed old function identities/owners/ACLs';end if;
      if exists(select 1 from pg_temp.taste_upgrade_history) then
        execute 'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text) from supabase_migrations.schema_migrations x' into body;
        if body is distinct from(select digest from pg_temp.taste_upgrade_history) then
          raise exception 'Hosted Taste rehearsal changed CLI migration history';end if;
      end if;
      if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='private' and c.relkind='r'
        and format('%I.%I',n.nspname,c.relname) not in(select identity from pg_temp.taste_upgrade_rows)
        and (not c.relrowsecurity or has_table_privilege('anon',c.oid,'select')
          or has_table_privilege('authenticated',c.oid,'select') or has_table_privilege('service_role',c.oid,'select'))) then
        raise exception 'Hosted Taste chain exposed new private storage';end if;
      if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='private' and p.prokind='f' and p.oid not in(select oid from pg_temp.taste_upgrade_functions)
        -- These four owner-checking implementations intentionally support their
        -- SECURITY INVOKER public routes; this is not a schema-wide grant.
        and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('service_role',p.oid,'execute')
          or (has_function_privilege('authenticated',p.oid,'execute') and p.oid not in(
            'private.get_shared_rating_round_v1(uuid,uuid)'::regprocedure,
            'private.commit_shared_rating_round_v1(jsonb)'::regprocedure,
            'private.taste_session_v1(jsonb)'::regprocedure,
            'private.taste_challenge_v1(jsonb)'::regprocedure)))) then
        raise exception 'Hosted Taste chain exposed new private helpers';end if;
      if has_function_privilege('anon','public.taste_session_v1(jsonb)','execute')
        or has_function_privilege('anon','public.taste_challenge_v1(jsonb)','execute')
        or not has_function_privilege('authenticated','public.taste_session_v1(jsonb)','execute')
        or not has_function_privilege('authenticated','public.taste_challenge_v1(jsonb)','execute') then
        raise exception 'Hosted Taste RPC role boundary changed';end if;
    end;$preserve$;
    select jsonb_build_object('hostedTasteUpgrade','PASS: complete reviewed chain; old populated rows, frozen evidence, function identity/ACL and history preserved') snapshot;
    ${challenge}
    ${smoke}
    rollback;`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await loadTasteHostedForwards();
    const checkpoint=process.argv[2]?JSON.parse(await readFile(process.argv[2],'utf8')):null;
    console.log(JSON.stringify({ ...tasteHostedManifest,
      ...(checkpoint?{preflightSql:await tasteHostedPreflightSql(checkpoint)}:{preflightState:'PRIVATE_CHECKPOINT_REQUIRED'}),
      deploymentState: 'PREPARED_ONLY', procedure: 'Refresh metadata; apply reviewed new forwards individually only after authorization; record provider identities; stop on failure or ambiguous acknowledgement.' }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
