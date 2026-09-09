import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadSystemSeedSource, verifySystemSeedSource, buildDeterministicSeedSql, baselineSeedEpoch } from './system-seed-source.mjs';

test('SleepLayer system seeds are reconstructed only from reviewed migration source', async () => {
  const seed = await loadSystemSeedSource();
  assert.match(seed.sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(seed.seedSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(seed.expected, { predictorGenomes: 4, promotionDecisions: 4, policyAssignments: 1 });
  assert.equal((seed.sql.match(/^insert into /gm) ?? []).length, 3);
  assert.match(seed.sql, /'prediction-v1-baseline'/);
  assert.doesNotMatch(seed.sql, /profile_bootstrap_evidence|prediction_runs|auth\.users/);
});

test('changing one genome weight fails closed before emitting SQL', async () => {
  const source = await readFile(new URL('../../supabase/migrations/20260904170000_sleep_layer_v1_foundation.sql', import.meta.url), 'utf8');
  assert.throws(() => verifySystemSeedSource(source.replace('"shortTerm":1.2', '"shortTerm":9.9')), /source checksum changed/);
});

test('two deterministic seed installs match every field and preserve canonical genome/policy semantics', async () => {
  const original = await readFile(new URL('../../supabase/migrations/20260904170000_sleep_layer_v1_foundation.sql', import.meta.url), 'utf8');
  const canonical = await loadSystemSeedSource();
  const deterministic = await buildDeterministicSeedSql();
  let reference;
  const tables = ['predictor_genomes', 'promotion_decisions', 'policy_assignments'];
  const normalize = snapshot => snapshot.map(rows => rows.map(({id,created_at,effective_from,...rest}) => rest));
  for (let install = 0; install < 2; install++) {
    const db = new PGlite();
    try {
      await db.exec('create schema private');
      // Exact canonical validators and three seed-table definitions. Only the
      // unused evaluation-window FK target is a signature fixture.
      await db.exec(original.slice(0, original.indexOf('create table private.predictor_genomes')));
      await db.exec('create table private.evaluation_windows(id uuid primary key)');
      for (const table of tables) {
        const start = original.indexOf(`create table private.${table} (`);
        const end = original.indexOf('\n);', start);
        assert.ok(start >= 0 && end > start);
        await db.exec(original.slice(start, end + 3));
      }
      const snapshot = async () => Promise.all(tables.map(async table => (await db.query(
        `select to_jsonb(t) as value from private.${table} t order by to_jsonb(t)->>'genome_key', to_jsonb(t)->>'genome_id'`)).rows.map(r => r.value)));
      await db.exec('begin');
      await db.exec(canonical.sql);
      const canonicalSnapshot = await snapshot();
      await db.exec('rollback');
      await db.exec(deterministic);
      const current = await snapshot();
      assert.deepEqual(current.map(rows => rows.length), [4,4,1]);
      assert.deepEqual(normalize(current), normalize(canonicalSnapshot));
      assert.deepEqual(current[0].map(row => row.id), canonicalSnapshot[0].map(row => row.id));
      for (const rows of current) for (const row of rows) {
        assert.equal(Date.parse(row.created_at), Date.parse(baselineSeedEpoch));
      }
      assert.equal(Date.parse(current[2][0].effective_from), Date.parse(baselineSeedEpoch));
      if (reference) assert.deepEqual(current, reference);
      reference = current;
      await assert.rejects(db.exec(deterministic), /require empty system tables/);
      assert.deepEqual(await snapshot(), current, 'Rejected reinstall must preserve all rows');
    } finally { await db.close(); }
  }
});

test('seed source writer will not overwrite an existing reviewed artifact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-seed-source-'));
  try {
    const output = join(directory, 'seeds.sql');
    const { spawnSync } = await import('node:child_process');
    const first = spawnSync(process.execPath, ['scripts/database/system-seed-source.mjs', output], { encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr);
    assert.match(await readFile(output, 'utf8'), /predictor_genomes/);
    const second = spawnSync(process.execPath, ['scripts/database/system-seed-source.mjs', output], { encoding: 'utf8' });
    assert.notEqual(second.status, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
