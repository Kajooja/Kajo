import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { assertUpgradePreserved, buildExistingApplicationFixture, probeExistingApplicationUpgrade,
  snapshotExistingApplication } from './existing-application-upgrade.mjs';

const execFor = db => async sql => (await db.exec(sql)).flatMap(result => result.rows
  .filter(row => Object.hasOwn(row, 'snapshot')).map(row => row.snapshot));
async function existingFixture() {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated,service_role;`);
    const fixture = await buildExistingApplicationFixture();
    await db.exec(`begin; ${fixture.sql} commit;`);
    return db;
  } catch (error) { await db.close(); throw error; }
}

test('independent populated application upgrade preserves complete rows, schema, triggers, ACLs and runtime', async () => {
  const db = await existingFixture();
  try {
    const result = await probeExistingApplicationUpgrade(execFor(db));
    assert.equal(result.status, 'PASS');
    assert.equal(result.before.rows['auth.users'].count, 3);
    assert.equal(result.after.rows['public.events'].count, 1);
    assert.notDeepEqual(result.before.platform.creatorDefaults, result.after.platform.creatorDefaults);
    assert.equal(result.before.applicationFunctions.functions.length, 122);
  } finally { await db.close(); }
});

test('upgrade comparison detects changed evidence content at constant row count and changed function grants', async () => {
  const db = await existingFixture();
  try {
    const exec = execFor(db);
    const before = await snapshotExistingApplication(exec);
    await db.exec(`update public.events set properties='{"rating":1}';`);
    const altered = await snapshotExistingApplication(exec);
    assert.equal(altered.rows['public.events'].count, before.rows['public.events'].count);
    assert.throws(() => assertUpgradePreserved(before, altered), /Upgrade changed existing rows/);
    await db.exec(`update public.events set properties='{"rating":8}';
      grant execute on function public.rank_items_v1(uuid,text,text,integer,jsonb) to anon;`);
    const changedGrant = await snapshotExistingApplication(exec);
    assert.throws(() => assertUpgradePreserved(before, changedGrant), /Upgrade changed existing applicationFunctions/);
  } finally { await db.close(); }
});

test('an already-corrected fixture cannot masquerade as an old-to-new upgrade', async () => {
  const db = await existingFixture();
  try {
    const migration = await readFile(new URL('../../supabase/migrations/20260909131913_close_postgres_function_defaults.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await assert.rejects(probeExistingApplicationUpgrade(execFor(db)), /permission denied for function kajo_upgrade_before/);
    await db.exec('rollback;');
  } finally { await db.close(); }
});
