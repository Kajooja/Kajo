import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { applicationSmokeSql, assertEmptyApplication, buildBaselineInstallation, snapshotApplication, sourceApplicationReference } from './baseline-installation.mjs';
import { buildFreshInstallation, installFreshDatabase, validateMigrationFiles } from './fresh-installation.mjs';

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

test('fresh lineage rejects duplicate versions, unordered or unsafe paths, and changed source bytes before execution', async () => {
  const a = { name: '20260910100000_one.sql', sql: 'select 1;' };
  const b = { name: '20260910100000_two.sql', sql: 'select 2;' };
  assert.throws(() => validateMigrationFiles([a, b]), /Duplicate migration version/);
  assert.throws(() => validateMigrationFiles([b, { ...a, name: '20260909100000_one.sql' }]), /chronological/);
  assert.throws(() => validateMigrationFiles([{ ...a, name: '../20260910100000_one.sql' }]), /Invalid migration/);
  const installation = await buildFreshInstallation();
  installation.files[0].sql += '\nselect 1;';
  const unexpected = () => { throw new Error('Must not access the database'); };
  await assert.rejects(installFreshDatabase(unexpected, unexpected, installation), /bytes changed/);
});

test('canonical fresh install verifies unchanged forward files, actual history and new table state', async () => {
  const installation = await buildFreshInstallation();
  const forward = { name: '20991230120000_forward_fixture.sql', sql: `
    create table private.kajo_forward_fixture(id integer primary key);
    alter table private.kajo_forward_fixture enable row level security;
    create function private.kajo_forward_fixture_value() returns integer language sql as $$ select 7 $$;
    revoke all on function private.kajo_forward_fixture_value() from public;` };
  installation.files.push(forward);
  installation.history.push({ version: forward.name.slice(0, 14), name: forward.name.slice(15, -4) });
  installation.manifest.files.push({ name: forward.name,
    sha256: createHash('sha256').update(forward.sql).digest('hex') });
  const db = await freshPlatformFixture();
  try {
    await db.exec('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text);');
    const apply = async files => {
      for (const file of files) {
        await db.exec('begin;');
        await db.exec(file.sql);
        await db.query('insert into supabase_migrations.schema_migrations values($1,$2)',
          [file.name.slice(0, 14), file.name.slice(15, -4)]);
        await db.exec('commit;');
      }
      return { fixture: 'PGlite transaction simulation; real CLI tested separately in CI' };
    };
    const result = await installFreshDatabase(snapshots(db), apply, installation);
    assert.deepEqual(result.history, installation.history);
    assert.equal((await db.query('select private.kajo_forward_fixture_value() as value')).rows[0].value, 7);
    await assert.rejects(installFreshDatabase(snapshots(db), () => {
      throw new Error('CLI must not run on a populated application');
    }, installation), /requires empty application schemas and Auth/);
    await db.exec('rollback;');
    await db.exec('insert into private.kajo_forward_fixture values(1);');
    const changed = await snapshotApplication(snapshots(db), installation.candidate, { forward: true });
    assert.throws(() => assertEmptyApplication(changed), /kajo_forward_fixture/);
    await db.exec('alter table private.kajo_forward_fixture disable row level security;');
    await assert.rejects(snapshotApplication(snapshots(db), installation.candidate, { forward: true }));
  } finally { await db.close(); }
});
