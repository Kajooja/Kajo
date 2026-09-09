import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createSourceRelationDatabase } from './relation-source.mjs';
import { compareFunctionSchemas } from './function-schema-parity.mjs';

const correction = await readFile(new URL('../../supabase/migrations/20260909131913_close_postgres_function_defaults.sql', import.meta.url), 'utf8');
const smoke = await readFile(new URL('function-defaults-smoke.sql', import.meta.url), 'utf8');
const snapshotSql = await readFile(new URL('function-schema-snapshot.sql', import.meta.url), 'utf8');
const snapshot = async db => (await db.exec(snapshotSql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;
const defaults = async db => (await db.query('select * from pg_default_acl order by oid')).rows;

test('forward defaults close new application functions while preserving current grants and platform creators', async () => {
  const { db } = await createSourceRelationDatabase();
  try {
    // Model both global and per-schema auto-grants, independently of an export.
    await db.exec(`alter default privileges for role postgres grant execute on functions to anon;
      alter default privileges for role postgres in schema public,private
        grant execute on functions to public,anon,authenticated,service_role;
      alter default privileges for role postgres in schema public grant select on tables to authenticated;
      create role platform_creator;
      create schema platform_fixture authorization platform_creator;
      alter default privileges for role postgres in schema platform_fixture grant execute on functions to service_role;`);
    const originalFunctions = await snapshot(db);
    const originalDefaults = await defaults(db);
    await db.exec(`begin; ${correction} rollback;`);
    assert.deepEqual(await defaults(db), originalDefaults, 'Rollback must restore every default ACL');
    await db.exec(correction);
    const correctedDefaults = await defaults(db);
    await db.exec(correction);
    assert.deepEqual(await defaults(db), correctedDefaults, 'The forward migration must be idempotent');
    assert.equal(compareFunctionSchemas(originalFunctions, await snapshot(db)).status, 'MATCH');
    await db.exec(`begin; ${smoke} rollback;`);
    assert.equal(compareFunctionSchemas(originalFunctions, await snapshot(db)).status, 'MATCH');
    await db.exec(`create table public.default_table_probe(id integer);
      set role platform_creator;
      create function platform_fixture.platform_function() returns integer language sql as $$select 1$$;
      reset role;
      create function platform_fixture.postgres_function() returns integer language sql as $$select 1$$;`);
    const row = (await db.query(`select
      has_table_privilege('authenticated','public.default_table_probe','select') as table_grant,
      has_function_privilege('anon','platform_fixture.platform_function()','execute') as other_creator,
      has_function_privilege('anon','platform_fixture.postgres_function()','execute') as global_revoked,
      has_function_privilege('service_role','platform_fixture.postgres_function()','execute') as other_schema_grant`)).rows[0];
    assert.deepEqual(row, { table_grant: true, other_creator: true, global_revoked: false, other_schema_grant: true });
  } finally { await db.close(); }
});

test('the same future-function smoke rejects the original per-schema-only hardening', async () => {
  const { db } = await createSourceRelationDatabase();
  try {
    await db.exec('begin');
    await assert.rejects(db.exec(smoke), /Future function .* is callable by anon without an explicit grant/);
    await db.exec('rollback');
  } finally { await db.close(); }
});
