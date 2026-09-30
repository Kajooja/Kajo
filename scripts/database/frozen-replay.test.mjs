import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { snapshotApplication } from './baseline-installation.mjs';
import { frozenReplayUpgradeSql } from './frozen-replay-upgrade.mjs';

test('frozen serving/shadow replay parity, populated upgrade and incompatible-history isolation (full schema)', async () => {
  const installation = await buildFreshInstallation();
  const db = new PGlite();
  const snapshots = async sql => (await db.exec(sql)).flatMap(r => r.rows.map(row => {
    assert.deepEqual(Object.keys(row), ['snapshot'], 'Native SQL probes accept only JSON snapshot output');
    return row.snapshot;
  }));
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const index = installation.files.findIndex(file => file.name.endsWith('_frozen_prediction_replay.sql'));
    assert.ok(index > 0);
    for (const file of installation.files.slice(0, index)) await db.exec(`begin; ${file.sql} commit;`);
    const migration = installation.files[index];
    const fixture = await readFile(new URL('existing-application-fixture.sql', import.meta.url), 'utf8');
    for (const digits of [0, 1]) {
      await db.exec(`set extra_float_digits=${digits}`);
      const upgrade = await snapshots(frozenReplayUpgradeSql(migration, fixture, installation.candidate.tables));
      assert.match(upgrade[0]?.frozenReplayUpgrade, /^PASS: unchanged populated/);
      assert.equal((await db.query('show extra_float_digits')).rows[0].extra_float_digits, String(digits),
        'Feature serializer must restore the caller rounding setting');
    }
    const before = await snapshotApplication(snapshots, installation.candidate, { forward: true });
    await db.exec('begin');
    try {
      const [{ definition }] = (await db.query("select pg_get_functiondef('private.evaluate_shadow_genome_v1(uuid,uuid)'::regprocedure) as definition")).rows;
      await db.exec(definition.replace('and shadow.candidate_count = production.candidate_count', 'and shadow.candidate_count=production.candidate_count'));
      await assert.rejects(db.exec(migration.sql), /Frozen replay forward: unexpected source anchor/);
    } finally { await db.exec('rollback'); }
    assert.deepEqual(await snapshotApplication(snapshots, installation.candidate, { forward: true }), before,
      'Unexpected installed source must roll back every helper and previous replacement');
    for (const file of installation.files.slice(index)) await db.exec(`begin; ${file.sql} commit;`);
    const installed = await snapshotApplication(snapshots, installation.candidate, { forward: true });
    for (const digits of [0, 1]) {
      await db.exec(`set extra_float_digits=${digits}`);
      const replay = await snapshots(await readFile(new URL('frozen-replay-smoke.sql', import.meta.url), 'utf8'));
      assert.match(replay[0]?.frozenReplay, /^PASS: 18 Personal\/Shared/);
      assert.equal((await db.query('show extra_float_digits')).rows[0].extra_float_digits, String(digits));
    }
    assert.deepEqual(await snapshotApplication(snapshots, installation.candidate, { forward: true }), installed,
      'Replay acceptance must leave no fixture accounts, Events or traces');
  } finally { await db.close(); }
});
