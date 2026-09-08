import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadSystemSeedSource } from './system-seed-source.mjs';

test('SleepLayer system seeds are reconstructed only from reviewed migration source', async () => {
  const seed = await loadSystemSeedSource();
  assert.match(seed.sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(seed.seedSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(seed.expected, { predictorGenomes: 4, promotionDecisions: 4, policyAssignments: 1 });
  assert.equal((seed.sql.match(/^insert into /gm) ?? []).length, 3);
  assert.match(seed.sql, /'prediction-v1-baseline'/);
  assert.doesNotMatch(seed.sql, /profile_bootstrap_evidence|prediction_runs|auth\.users/);
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
