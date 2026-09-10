import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { snapshotApplication } from './baseline-installation.mjs';
import { candidatePoolSmokeSql, candidatePoolUpgradeSql } from './candidate-pool-upgrade.mjs';

test('admission before the candidate cutoff fills suppressed pools and preserves frozen/empty replay (full schema)', async () => {
  const installation = await buildFreshInstallation(), db = new PGlite();
  const snapshots = async sql => (await db.exec(sql)).flatMap(r => r.rows.map(row => {
    assert.deepEqual(Object.keys(row), ['snapshot'], 'Native SQL probes accept only JSON snapshot output');
    return row.snapshot;
  }));
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const index = installation.files.findIndex(f => f.name.endsWith('_eligibility_first_candidate_pool.sql'));
    assert.ok(index > 0);
    for (const file of installation.files.slice(0, index)) await db.exec(`begin; ${file.sql} commit;`);
    await db.exec('begin');
    try {
      await db.exec(await readFile(new URL('candidate-pool-fixture.sql', import.meta.url), 'utf8'));
      const profiles = (await db.query('select * from pg_temp.pool_profiles')).rows;
      for (const profile of profiles) for (const domain of ['BOOK', 'MOVIE']) for (const mode of ['FOR_YOU', 'SURPRISE', 'RISK']) {
        await db.exec('set local role authenticated');
        const rows = (await db.query('select * from public.rank_items_v1($1,$2,$3,20)', [profile.profile_id, mode, domain])).rows;
        assert.equal(rows.length, 0, 'Pre-fix fixture must reproduce starvation with 24 ordinary Items still available');
        await db.exec('set local role postgres');
      }
    } finally { await db.exec('rollback'); }
    const migration = installation.files[index];
    const fixture = await readFile(new URL('existing-application-fixture.sql', import.meta.url), 'utf8');
    const upgrade = await snapshots(candidatePoolUpgradeSql(migration, fixture, installation.candidate.tables));
    assert.match(upgrade[0]?.candidatePoolUpgrade, /^PASS: unchanged populated/);
    const before = await snapshotApplication(snapshots, installation.candidate, { forward: true });
    await db.exec('begin');
    try {
      const [{ definition }] = (await db.query("select pg_get_functiondef('private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure) as definition")).rows;
      await db.exec(definition.replace('  ranked as (', '  ranked as  ('));
      await assert.rejects(db.exec(migration.sql), /Candidate pool forward: unexpected source anchor/);
    } finally { await db.exec('rollback'); }
    assert.deepEqual(await snapshotApplication(snapshots, installation.candidate, { forward: true }), before,
      'A divergent source must roll back the count-constraint change and every prior replacement');
    for (const file of installation.files.slice(index)) await db.exec(`begin; ${file.sql} commit;`);
    const installed = await snapshotApplication(snapshots, installation.candidate, { forward: true });
    const result = await snapshots(await candidatePoolSmokeSql());
    assert.match(result[0]?.candidatePool, /^PASS: 36 mode/);
    assert.deepEqual(await snapshotApplication(snapshots, installation.candidate, { forward: true }), installed);
  } finally { await db.close(); }
});
