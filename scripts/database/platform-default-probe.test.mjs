import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { probePlatformDefaults } from './platform-default-probe.mjs';

async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create role supabase_admin;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function extensions.existing_platform_function() returns integer language sql as $$select 7$$;
    grant usage on schema public to anon,authenticated,service_role;
    alter default privileges for role postgres in schema public grant execute on functions to anon,authenticated,service_role;
    alter default privileges for role postgres in schema public grant select on tables to authenticated;
    alter default privileges for role supabase_admin in schema extensions grant execute on functions to anon;
    alter default privileges for role postgres in schema extensions grant execute on functions to service_role;`);
  const exec = async sql => (await db.exec(sql)).flatMap(result => result.rows
    .filter(row => Object.hasOwn(row, 'snapshot')).map(row => row.snapshot));
  return { db, exec };
}

test('the CI platform probe executes the real migration and restores defaults, roles, schemas and current functions', async () => {
  const { db, exec } = await fixture();
  try {
    const report = await probePlatformDefaults(exec);
    assert.equal(report.status, 'PASS');
    assert.equal(report.platformRestored, true);
    assert.ok(report.existingFunctions.count >= 1);
    assert.notDeepEqual(report.corrected.creatorDefaults, report.before.creatorDefaults);
    assert.equal((await db.query("select to_regnamespace('private') as private_schema")).rows[0].private_schema, null);
    assert.equal((await db.query("select has_function_privilege('anon','extensions.existing_platform_function()','execute') as allowed")).rows[0].allowed, true);
    assert.deepEqual(await probePlatformDefaults(exec), report, 'Independent rollback runs must be repeatable');
  } finally { await db.close(); }
});

test('the platform probe rejects application data and preserves it after failure', async () => {
  const { db, exec } = await fixture();
  try {
    await db.exec('create table public.existing_app(id integer); insert into public.existing_app values (73);');
    await assert.rejects(probePlatformDefaults(exec), /requires an empty application\/Auth database/);
    assert.deepEqual((await db.query('select * from public.existing_app')).rows, [{ id: 73 }]);
    assert.equal((await db.query("select to_regnamespace('private') as private_schema")).rows[0].private_schema, null);
  } finally { await db.close(); }
});
