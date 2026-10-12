import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';

const target = 'private.get_shared_discovery_overlay(uuid,text)';
const functionSnapshotSql = `select p.oid,p.oid::regprocedure::text as identity,p.proowner,p.proacl,p.prosecdef,p.proconfig,
  case when p.oid='${target}'::regprocedure then null else pg_get_functiondef(p.oid) end as definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private') and p.prokind='f' order by p.oid`;

async function snapshotRows(db) {
  const { rows } = await db.query(`select n.nspname||'.'||c.relname as identity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','auth') and c.relkind in ('r','p') order by 1`);
  const result = [];
  for (const { identity } of rows) {
    assert.match(identity, /^(public|private|auth)\.[a-z_][a-z0-9_]*$/);
    result.push({ identity, ...(await db.query(`select md5(coalesce(jsonb_agg(to_jsonb(r)
      order by to_jsonb(r)::text),'[]'::jsonb)::text) as digest from ${identity} r`)).rows[0] });
  }
  return result;
}

test('Shared overlay eligibility preserves populated history/ACLs and refuses unknown source', async () => {
  const installation = await buildFreshInstallation();
  const migration = installation.files.find(file => file.name.endsWith('_shared_overlay_eligibility.sql'));
  assert.ok(migration);
  const smoke = await readFile(new URL('shared-overlay-eligibility-smoke.sql', import.meta.url), 'utf8');
  const [fixture, verification] = smoke.split('-- Forward-under-test applies here in the populated-upgrade regression.');
  assert.ok(fixture && verification);
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of installation.files.filter(file => file !== migration)) {
      await db.exec(`begin; ${file.sql} commit;`);
    }
    const emptyRows = await snapshotRows(db);
    // Negative control proves the unchanged old read path can reintroduce Items.
    await assert.rejects(db.exec(smoke), /failed to retain catalogue\/Shared discovery exclusions/);
    await db.exec('rollback');
    assert.deepEqual(await snapshotRows(db), emptyRows);

    await db.exec('begin');
    try {
      const [{ definition }] = (await db.query(`select pg_get_functiondef('${target}'::regprocedure) as definition`)).rows;
      await db.exec(definition.replace('  return query\n', '  return  query\n'));
      await assert.rejects(db.exec(migration.sql), /Shared overlay eligibility forward: unexpected source/);
    } finally { await db.exec('rollback'); }

    await db.exec(fixture);
    const beforeRows = await snapshotRows(db);
    const beforeFunctions = (await db.query(functionSnapshotSql)).rows;
    await db.exec(migration.sql);
    assert.deepEqual(await snapshotRows(db), beforeRows, 'Forward must not alter application/Auth/evidence rows');
    assert.deepEqual((await db.query(functionSnapshotSql)).rows, beforeFunctions,
      'Forward must retain all identities/owners/ACLs and every unrelated function');
    const result = (await db.exec(verification)).flatMap(value => value.rows);
    assert.match(result.find(row => row.snapshot)?.snapshot?.sharedOverlayEligibility, /^PASS: withdrawn\/rejected/);
    assert.deepEqual(await snapshotRows(db), emptyRows, 'Upgrade/runtime fixtures must fully roll back');
  } finally { await db.close(); }
});
