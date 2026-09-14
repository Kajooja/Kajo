import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { assertEmptyApplication, snapshotApplication } from './baseline-installation.mjs';
import { catalogDescriptionCleanupSql, catalogDescriptionFixtureSql, catalogDescriptionSmokeSql, catalogDescriptionUpgradeSql } from './catalog-descriptions.mjs';

test('BOOK description forward preserves populated catalog; guarded writes on the full schema (also native CI)', async () => {
  const installation = await buildFreshInstallation();
  const db = new PGlite();
  const snapshots = async sql => (await db.exec(sql)).flatMap(r => r.rows.filter(row => Object.hasOwn(row, 'snapshot')).map(row => row.snapshot));
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const index = installation.files.findIndex(file => file.name.endsWith('_book_description_refresh.sql'));
    assert.ok(index > 0);
    for (const file of installation.files.slice(0, index)) await db.exec(`begin; ${file.sql} commit;`);
    assert.match((await snapshots(catalogDescriptionUpgradeSql(installation.files[index])))[0]?.catalogDescriptionUpgrade, /^PASS: unchanged populated/);
    for (const file of installation.files.slice(index)) await db.exec(`begin; ${file.sql} commit;`);
    const before = await snapshotApplication(snapshots, installation.candidate, { forward: true });
    assertEmptyApplication(before);
    assert.match((await snapshots(await catalogDescriptionSmokeSql()))[0]?.catalogDescriptions, /^PASS: guarded/);
    assert.deepEqual(await snapshotApplication(snapshots, installation.candidate, { forward: true }), before,
      'Description acceptance must roll back all fixture catalog data and helpers');
    await db.exec(`begin; ${catalogDescriptionFixtureSql()} commit;`);
    await db.exec(catalogDescriptionCleanupSql());
    assert.deepEqual(await snapshotApplication(snapshots, installation.candidate, { forward: true }), before,
      'Committed native-concurrency fixtures must clean up under the real restrictive foreign keys');
  } finally { await db.close(); }
});
