// Reconstruct the reviewed SleepLayer system seeds from immutable migration source.
// This never reads a database and never copies hosted data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const migration = new URL('../../supabase/migrations/20260904170000_sleep_layer_v1_foundation.sql', import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function loadSystemSeedSource() {
  const source = await readFile(migration, 'utf8');
  const start = source.indexOf('\ninsert into private.predictor_genomes (');
  const endMarker = "where genome.genome_key = 'prediction-v1-baseline';";
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'Canonical SleepLayer seed boundaries not found');
  const sql = source.slice(start, end + endMarker.length) + '\n';
  assert.equal((sql.match(/^insert into /gm) ?? []).length, 3,
    'Expected exactly genome, promotion and policy seed statements');
  for (const key of ['prediction-v1-baseline', 'short-term-tilt-v1', 'scenario-tilt-v1', 'novelty-tilt-v1']) {
    assert.match(sql, new RegExp(`'${key}'`), `Missing canonical genome ${key}`);
  }
  assert.match(sql, /md5\('kajo:predictor-genome:prediction-v1-baseline'\)::uuid/,
    'Baseline genome identity must remain semantic and deterministic');
  assert.match(sql, /'GLOBAL',\n  'GLOBAL',\n  genome\.id,\n  clock_timestamp\(\)/,
    'Canonical baseline PolicyAssignment source changed; review install timing semantics');
  return {
    sourceMigration: '20260904170000_sleep_layer_v1_foundation.sql',
    sourceSha256: sha256(source),
    seedSha256: sha256(sql),
    sql,
    expected: { predictorGenomes: 4, promotionDecisions: 4, policyAssignments: 1 },
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    assert.ok(process.argv.length === 2 || process.argv.length === 3,
      'Usage: node scripts/database/system-seed-source.mjs [output.sql]');
    const seed = await loadSystemSeedSource();
    if (process.argv[2]) await writeFile(process.argv[2], seed.sql, { flag: 'wx' });
    console.log(JSON.stringify({ ...seed, sql: undefined }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
