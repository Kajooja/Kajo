import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';
import {
  tastePoolHostedForward, loadTastePoolHostedForward, validateTastePoolHostedForward,
  tastePoolHostedMetadataSql, tastePoolHostedRowsSql, tastePoolHostedPreflightSql,
  tastePoolHostedGuardedMigrationSql, tastePoolHostedPostflightSql, tastePoolHostedLockSql,
} from './personal-taste-pool-hosted-upgrade.mjs';

const projectRef = 'aaaaaaaaaaaaaaaaaaaa';
const actor = 'ab157000-0000-4000-8000-000000000001';
const literal = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const md5 = value => createHash('md5').update(value).digest('hex');
const first = results => results.flatMap(r => r.rows)[0]?.snapshot;

async function populatedPredecessor() {
  const db = new PGlite();
  // PostgreSQL forbids removing SUPERUSER from bootstrap role OID 10. A distinct
  // disposable postgres role lets the actual wrapper exercise hosted-like
  // ownership/permissions without weakening the test into a superuser run.
  await db.exec(`create role pool_test_admin superuser;
    set session authorization pool_test_admin;
    alter role postgres rename to pool_original_bootstrap;
    create role postgres superuser;
    set session authorization postgres;`);
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    grant authenticated to postgres;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text,name text,statements text[]);`);
  await db.exec(`create role supabase_auth_admin;create table auth.schema_migrations(version text);
    alter table auth.schema_migrations owner to supabase_auth_admin;
    grant select on auth.schema_migrations to postgres;
    insert into auth.schema_migrations values('provider-history-retained');`);
  const { files } = await buildFreshInstallation();
  const index = files.findIndex(f => f.name === tastePoolHostedForward.filename);
  assert.ok(index > 0);
  for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
  await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',
    ['20261023202605', 'scenario_similarity_evaluation', ['preserved exact provider SQL']]);
  await db.exec(`begin;${await personalTasteSessionFixtureSql()}commit;`);
  const profileId = (await db.query(`select id from public.profiles where owner_user_id='${actor}' and profile_type='PERSONAL'`)).rows[0].id;
  const call = async request => (await db.exec(`begin;set local request.jwt.claim.sub='${actor}';set local role authenticated;
    select public.taste_session_v2(${literal(request)}) result;commit;`)).flatMap(r => r.rows)[0].result;
  const started = await call({ operation: 'START', profileId, requestId: randomUUID() });
  const nextRequest = { operation: 'NEXT', profileId, sessionId: started.sessionId, expectedRevision: started.revision, requestId: randomUUID() };
  const question = await call(nextRequest);
  const answerRequest = { operation: 'ANSWER', profileId, sessionId: started.sessionId, expectedRevision: question.revision,
    requestId: randomUUID(), questionId: question.questionId, answer: { kind: 'RATING', value: 10 } };
  const answer = await call(answerRequest);
  return { db, call, nextRequest, question, answerRequest, answer };
}
async function checkpoint(db) {
  const metadata = first(await db.exec(tastePoolHostedMetadataSql));
  const rows = first(await db.exec(tastePoolHostedRowsSql(metadata)));
  return { target: { projectRef, postgresMajor: 17 }, metadata, rows };
}

test('hosted Taste pool preparation pins exactly one immutable source and rejects altered bytes', async () => {
  const source = await loadTastePoolHostedForward();
  assert.equal(validateTastePoolHostedForward(source), source);
  assert.throws(() => validateTastePoolHostedForward({ ...source, sql: source.sql + '\n' }), /Reviewed Taste pool SQL changed/);
  assert.throws(() => validateTastePoolHostedForward({ ...source, name: 'other.sql' }), /single reviewed Taste pool forward/);
  await assert.rejects(tastePoolHostedPreflightSql(), /Explicit expected project ref/);
});

test('fixed-width row digest is order-independent, content-sensitive and retains duplicate multiplicity', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema private;create table private.sequential_taste_sessions(value jsonb);
      insert into private.sequential_taste_sessions values('{"large":"alpha","number":1}'),('{"large":"beta","number":2}');`);
    const sql = tastePoolHostedRowsSql({ tables: { 'private.sequential_taste_sessions': {} } });
    const snapshot = async () => first(await db.exec(sql))['private.sequential_taste_sessions'];
    const original = await snapshot();
    assert.equal(original.algorithm, 'MD5_SORTED_ROW_MD5_V1');assert.equal(original.count, 2);
    await db.exec(`begin;create temp table saved as select * from private.sequential_taste_sessions;
      truncate private.sequential_taste_sessions;insert into private.sequential_taste_sessions select * from saved order by value::text desc;commit;`);
    assert.deepEqual(await snapshot(), original);
    await db.exec('insert into private.sequential_taste_sessions select * from saved order by value::text limit 1;');
    const duplicate = await snapshot();assert.equal(duplicate.count, 3);assert.notEqual(duplicate.md5, original.md5);
    await db.exec(`truncate private.sequential_taste_sessions;insert into private.sequential_taste_sessions select * from saved;
      update private.sequential_taste_sessions set value=jsonb_set(value,'{number}','3') where value->>'number'='2';`);
    const changed = await snapshot();assert.equal(changed.count, original.count);assert.notEqual(changed.md5, original.md5);
  } finally { await db.close(); }
});

test('only the explicit provider-owned auth history permits SELECT-only ACCESS SHARE', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role supabase_auth_admin;create role pool_operator;
      create schema auth;create schema private;create schema supabase_migrations;
      create table auth.schema_migrations(version text);alter table auth.schema_migrations owner to supabase_auth_admin;
      create table private.sequential_taste_sessions(id integer);
      create table supabase_migrations.schema_migrations(version text);
      grant usage on schema auth,private,supabase_migrations to pool_operator;
      grant select on auth.schema_migrations to pool_operator;
      grant select,update on private.sequential_taste_sessions,supabase_migrations.schema_migrations to pool_operator;`);
    const metadata = { tables: { 'private.sequential_taste_sessions': {}, 'auth.schema_migrations': { owner: 'supabase_auth_admin' } } };
    const locks = tastePoolHostedLockSql(metadata);
    await assert.rejects(db.exec('begin;set local role pool_operator;lock table auth.schema_migrations in share mode;commit;'), /permission denied/);
    await db.exec('rollback;');
    await db.exec(`begin;set local role pool_operator;${locks}commit;`);
    assert.throws(() => tastePoolHostedLockSql({ tables: { ...metadata.tables, 'auth.schema_migrations': { owner: 'postgres' } } }), /Unexpected owner/);
    await db.exec('revoke select on auth.schema_migrations from pool_operator;');
    await assert.rejects(db.exec(`begin;set local role pool_operator;${locks}commit;`), /owner\/read boundary drift/);await db.exec('rollback;');
    // An unrelated read-only table receives no fallback and still fails SHARE.
    await db.exec(`grant select on auth.schema_migrations to pool_operator;
      create table auth.another_history(version text);grant select on auth.another_history to pool_operator;`);
    await assert.rejects(db.exec(`begin;set local role pool_operator;${tastePoolHostedLockSql({ tables: { ...metadata.tables, 'auth.another_history': {} } })}commit;`), /permission denied/);
    await db.exec('rollback;');
  } finally { await db.close(); }
});

test('guarded hosted Taste pool upgrade preserves populated V3, exact replies, metadata and atomic history', async () => {
  const fixture = await populatedPredecessor();
  const { db, call, nextRequest, question, answerRequest, answer } = fixture;
  try {
    const before = await checkpoint(db);
    await db.exec("set timezone='America/New_York';");
    assert.deepEqual(await checkpoint(db), before, 'Connection timezone cannot change captured row hashes');
    const preflight = await tastePoolHostedPreflightSql(before, projectRef);
    assert.match(first(await db.exec(preflight)), /^PASS/);
    await assert.rejects(tastePoolHostedPreflightSql(before, 'bbbbbbbbbbbbbbbbbbbb'), /Wrong target project/);
    const source = await loadTastePoolHostedForward();
    const wrapper = await tastePoolHostedGuardedMigrationSql(before, projectRef);
    assert.equal(wrapper.split(source.sql).length, 2, 'Exact migration bytes must appear once');
    assert.ok(!/\b(commit|rollback|begin)\s*;/i.test(wrapper), 'Provider owns the sole transaction');

    // Freshly changed data/history must fail before any source write.
    await assert.rejects(db.exec(`begin;update public.items set title=title||' changed'
      where id=(select min(id::text)::uuid from public.items);${wrapper}commit;`), /retained rows changed/);await db.exec('rollback;');
    assert.deepEqual((await checkpoint(db)).rows, before.rows);
    await assert.rejects(db.exec(`begin;update supabase_migrations.schema_migrations set name=name||'_changed';
      ${wrapper}commit;`), /metadata\/history drift/);await db.exec('rollback;');
    await assert.rejects(db.exec(`begin;update auth.schema_migrations set version='provider-changed';
      ${wrapper}commit;`), /retained rows changed/);await db.exec('rollback;');

    // Undeclared writes/security drift after the embedded source must roll back
    // the complete DDL, old function patches and provider receipt together.
    const receipt = { version: '20261024230000', name: tastePoolHostedForward.providerName, statementMd5: md5(wrapper) };
    const historyInsert = `insert into supabase_migrations.schema_migrations values('${receipt.version}','${receipt.name}',array[${"'" + wrapper.replaceAll("'", "''") + "'"}]);`;
    for (const injection of [
      "update public.items set title=title||' invalid';",
      "update auth.schema_migrations set version='provider-changed';",
      'grant select on private.sequential_taste_candidate_pools_v4 to authenticated;',
      'grant execute on function private.taste_candidate_catalog_v4(uuid,timestamptz) to authenticated;',
      'alter table private.sequential_taste_candidate_pools_v4 disable row level security;',
      'alter table private.sequential_taste_panels disable trigger redact_sequential_taste_candidate_pool_v4;',
      'alter table private.sequential_taste_candidate_pools_v4 drop constraint sequential_taste_candidate_pools_v4_session_id_fkey;',
      `do $unreviewed$ declare f record;begin
        select pg_get_functiondef(oid) definition,prosrc into strict f from pg_proc
          where oid='private.sequential_taste_similarity_v2(jsonb,jsonb)'::regprocedure;
        execute replace(f.definition,f.prosrc,f.prosrc||E'\\n-- unreviewed');
      end;$unreviewed$;`,
    ]) {
      const corrupted = wrapper.replace('do $taste_pool_postcheck$', `${injection}\ndo $taste_pool_postcheck$`);
      await assert.rejects(db.exec(`begin;${corrupted}${historyInsert}commit;`), /post-install metadata\/security drift|installation changed retained rows/);
      await db.exec('rollback;');
      assert.deepEqual(await checkpoint(db), before, 'Failed wrapper must leave every captured source/row/history field unchanged');
    }
    const sourceDrift = structuredClone(before);
    sourceDrift.metadata.functions['private.taste_session_v2(jsonb)'].bodyMd5 = '0'.repeat(32);
    await assert.rejects(tastePoolHostedGuardedMigrationSql(sourceDrift, projectRef), /source drift/);
    const digestDrift = structuredClone(before);digestDrift.rows['public.items'].algorithm = 'UNVERSIONED';
    await assert.rejects(tastePoolHostedGuardedMigrationSql(digestDrift, projectRef), /Unreviewed row digest algorithm/);

    // Reproduce the hosted deployment role, not merely superuser behavior.
    // All application objects remain postgres-owned; provider history is SELECT-only.
    await db.exec('alter role postgres nosuperuser;');
    const providerPrivileges = async () => (await db.query(`select
      has_table_privilege(current_user,'auth.schema_migrations','SELECT') readable,
      has_table_privilege(current_user,'auth.schema_migrations','UPDATE,DELETE,TRUNCATE') writable`)).rows[0];
    assert.deepEqual(await providerPrivileges(), { readable: true, writable: false });
    await assert.rejects(db.exec('begin;lock table auth.schema_migrations in share mode;commit;'), /permission denied/);
    await db.exec('rollback;');
    await db.exec("set timezone='Europe/Helsinki';");
    await db.exec(`begin;${wrapper}${historyInsert}commit;`);
    assert.deepEqual(await providerPrivileges(), { readable: true, writable: false });
    const postflight = await tastePoolHostedPostflightSql(before, projectRef, receipt);
    assert.match(first(await db.exec(postflight)), /^PASS/);
    assert.deepEqual(await call(nextRequest), question);
    assert.deepEqual(await call(answerRequest), answer);
    const after = await checkpoint(db);
    assert.equal(after.metadata.tables['private.sequential_taste_sessions'].columns.policy.default, "'CANONICAL_FORECAST_POOL_V4'::text");
    assert.equal((await db.query('select distinct policy from private.sequential_taste_sessions')).rows[0].policy, 'CANONICAL_FORECAST_V3');
    await assert.rejects(tastePoolHostedGuardedMigrationSql(after, projectRef), /already recorded|already exist/);
    await assert.rejects(db.exec(`begin;${wrapper}commit;`), /metadata\/history drift/);await db.exec('rollback;');
    await assert.rejects(tastePoolHostedPostflightSql(before, projectRef, { ...receipt, statementMd5: '0'.repeat(32) }), /exact guarded wrapper/);
    await db.query('update supabase_migrations.schema_migrations set statements=$1 where version=$2', [['drift'], receipt.version]);
    await assert.rejects(db.exec(postflight), /provider receipt\/history mismatch/);await db.exec('rollback;');
  } catch (error) { delete error.query; throw error; } finally { await db.close(); }
});
