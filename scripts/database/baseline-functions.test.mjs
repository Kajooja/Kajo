import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadFunctionSource } from './function-source.mjs';
import { buildBaselineFunctions, resolveBaselineDefinition } from './baseline-functions.mjs';

const source = await loadFunctionSource();
const imports = await readFile(new URL('../../supabase/migrations/20260904203000_profile_bootstrap_import_foundation.sql', import.meta.url), 'utf8');
const smoke = await readFile(new URL('baseline-function-smoke.sql', import.meta.url), 'utf8');
const names = [
  'private.normalize_import_title_v1', 'private.assert_personal_profile_owner_v1',
  'private.get_profile_import_job_v1', 'private.create_profile_import_job_v1',
  'private.stage_profile_import_rows_v1', 'private.resolve_profile_import_row_v1',
  'private.commit_profile_import_job_v1', 'private.remove_profile_import_job_v1',
  'private.resurfacing_policy_config_v1', 'private.resurfacing_policy_decision_v1',
  'private.provision_personal_profile_from_auth_user',
  'public.create_profile_import_job_v1', 'public.stage_profile_import_rows_v1',
  'public.resolve_profile_import_row_v1', 'public.commit_profile_import_job_v1',
  'public.remove_profile_import_job_v1', 'public.get_profile_import_job_v1',
];

async function fixture() {
  const db = new PGlite();
  try {
    // Only the columns used by the tested bodies are represented. Import tables
    // below use exact source constraints. This is not Supabase/Auth acceptance.
    await db.exec(`create role authenticated; create schema auth; create schema private;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create table public.users(id uuid primary key,nickname text);
      create table public.profiles(id uuid primary key default gen_random_uuid(),profile_type text,name text,owner_user_id uuid);
      create table public.profile_members(profile_id uuid,user_id uuid,primary key(profile_id,user_id));
      create table public.items(id uuid primary key,item_type text,title text,tags text[],discoverable boolean,release_year int);
      create table public.events(id uuid,profile_id uuid,item_id uuid,event_type text,occurred_at timestamptz,prediction_id uuid);
      create table private.item_external_ids(item_id uuid,namespace text,external_id text);
      create table private.item_sources(item_id uuid,provider_key text);
      create table private.prediction_candidates(prediction_id uuid,item_id uuid,explanation jsonb);`);
    for (const table of ['profile_import_jobs', 'profile_import_rows', 'profile_bootstrap_evidence']) {
      const sql = imports.match(new RegExp(`^create table private\\.${table} \\([\\s\\S]*?^\\);`, 'm'))?.[0];
      assert.ok(sql, `Missing canonical table ${table}`);
      await db.exec(sql);
    }
    for (const name of names) {
      const definition = source.definitions.find(row => row.name === name);
      assert.ok(definition, name);
      await db.exec(resolveBaselineDefinition(definition));
    }
    await db.exec(`create trigger provision_kajo_personal_profile after insert on auth.users
      for each row execute function private.provision_personal_profile_from_auth_user();
      revoke all on all functions in schema public,private from public;
      grant usage on schema public,private to authenticated;`);
    // Match the tested RPC call chain; do not claim complete source ACL parity.
    for (const name of names.filter(name => /\.(create|stage|resolve|commit|remove|get)_profile_import_/.test(name))) {
      const signature = (await db.query(`select p.oid::regprocedure::text as signature from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace
        where n.nspname || '.' || p.proname=$1`, [name])).rows[0]?.signature;
      assert.ok(signature, name);
      await db.exec(`grant execute on function ${signature} to authenticated`);
    }
    return db;
  } catch (error) { await db.close(); throw error; }
}

test('source-derived supplement is deterministic and rejects unexpected patch fragments', async () => {
  const first = await buildBaselineFunctions();
  assert.deepEqual(await buildBaselineFunctions(), first);
  assert.equal(first.functionCount, 122);
  assert.match(first.sql, /set local check_function_bodies = on/);
  const definition = source.definitions.find(row => row.name === 'private.stage_profile_import_rows_v1');
  assert.throws(() => resolveBaselineDefinition({ ...definition, sql: definition.sql.replace('> 500', '> 600') }),
    /Expected exactly one reviewed baseline fragment/);
});

test('resolved source RPCs preserve import bounds, correction/removal and authorization', async () => {
  const db = await fixture();
  try {
    await db.exec('begin');
    await db.exec(smoke);
    await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int as count from private.profile_import_jobs')).rows[0].count, 0);
  } finally { await db.close(); }
});

test('the same behavior probe rejects both original unresolved definitions', async () => {
  const db = await fixture();
  try {
    for (const [name, expectedError] of [
      ['private.resurfacing_policy_decision_v1', /Missing bootstrap evidence suppressed/],
      ['private.stage_profile_import_rows_v1', /between 1 and 500 rows/],
    ]) {
      await db.exec('begin');
      await db.exec(source.definitions.find(row => row.name === name).sql);
      await assert.rejects(db.exec(smoke), expectedError);
      await db.exec('rollback');
    }
  } finally { await db.close(); }
});
