import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applicationSmokeSql, assertEmptyApplication, buildBaselineInstallation, snapshotApplication, sourceApplicationReference } from './baseline-installation.mjs';

const snapshots = db => async sql => (await db.exec(sql)).flatMap(result => result.rows
  .filter(row => Object.hasOwn(row, 'snapshot')).map(row => row.snapshot));
async function freshPlatformFixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges for role postgres in schema public grant all on sequences to anon,authenticated,service_role;
    alter default privileges for role postgres in schema public grant all on functions to anon,authenticated,service_role;`);
  return db;
}

test('source-only candidate matches the separately reconstructed reference despite broad initial platform grants', async () => {
  const candidate = await buildBaselineInstallation();
  assert.deepEqual(await buildBaselineInstallation(), candidate);
  const expected = await sourceApplicationReference(candidate);
  const db = await freshPlatformFixture();
  try {
    await db.exec(`begin; ${candidate.sql} commit;`);
    const actual = await snapshotApplication(snapshots(db), candidate);
    assertEmptyApplication(actual);
    assert.deepEqual(actual, expected, 'Native auto-grants must not leak into application ACLs');
    // The same source applied too late cannot undo every inherited service grant.
    assert.equal((await db.query("select has_table_privilege('service_role','public.profile_messages','select') as allowed")).rows[0].allowed, false);
  } finally { await db.close(); }
});

test('two committed candidate installations match exactly and run the full Auth/Personal/Shared/import rollback smoke', async () => {
  const candidate = await buildBaselineInstallation();
  const correction = await readFile(new URL('../../supabase/migrations/20260909131913_close_postgres_function_defaults.sql', import.meta.url), 'utf8');
  const smoke = await applicationSmokeSql();
  let first;
  for (let index = 0; index < 2; index++) {
    const db = await freshPlatformFixture();
    try {
      await db.exec(`begin; ${candidate.sql} commit;`);
      const before = await snapshotApplication(snapshots(db), candidate);
      await db.exec(`begin; ${correction} commit;`);
      assert.deepEqual(await snapshotApplication(snapshots(db), candidate), before);
      const results = await snapshots(db)(smoke);
      assert.equal(results.length, 1);
      assert.match(results[0].smoke, /^PASS: authenticated public V1/);
      const after = await snapshotApplication(snapshots(db), candidate);
      assertEmptyApplication(after);
      assert.deepEqual(after, before, 'Smoke must roll back every synthetic application row');
      if (first) assert.deepEqual(after, first, 'Independent candidate installations differ');
      else first = after;
      await assert.rejects(db.exec(`begin; ${candidate.sql} commit;`), /requires empty application schemas and Auth/);
      await db.exec('rollback;');
      assert.deepEqual(await snapshotApplication(snapshots(db), candidate), after, 'Rejected reinstall changed the existing installation');
    } finally { await db.close(); }
  }
});
