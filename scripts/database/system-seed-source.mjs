// Reconstruct the reviewed SleepLayer system seeds from immutable migration source.
// This never reads a database and never copies hosted data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const migration = new URL('../../supabase/migrations/20260904170000_sleep_layer_v1_foundation.sql', import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex');

export function verifySystemSeedSource(source) {
  assert.equal(sha256(source), '77a0a81ed37552003c62fd13cbdd557d8795feb87cda796c3965cb27da014ade',
    'SleepLayer source checksum changed; review before generating executable seeds');
  const start = source.indexOf('\ninsert into private.predictor_genomes (');
  const endMarker = "where genome.genome_key = 'prediction-v1-baseline';";
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'Canonical SleepLayer seed boundaries not found');
  const sql = source.slice(start, end + endMarker.length) + '\n';
  assert.equal(sha256(sql), '8fc0a15d9769715152985f46cde3e73edb7f441ef25eccb857aaae288f91689d',
    'System seed checksum mismatch');
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

export async function loadSystemSeedSource() {
  return verifySystemSeedSource(await readFile(migration, 'utf8'));
}

// Empty-install proposal only. This timestamp is the schema cutoff, not a claim
// about a real promotion or installation event in an existing database.
export const baselineSeedEpoch = '2026-09-07T15:52:01Z';
export async function buildDeterministicSeedSql() {
  const { sql } = await loadSystemSeedSource();
  const promotionStart = sql.indexOf('insert into private.promotion_decisions (');
  const policyStart = sql.indexOf('insert into private.policy_assignments (');
  const epoch = `'${baselineSeedEpoch}'::timestamptz`;
  const genomes = sql.slice(0, promotionStart)
    .replace('  created_by\n', '  created_by,\n  created_at\n')
    .replaceAll("'migration:20260904170000_sleep_layer_v1_foundation'\n)",
      `'migration:20260904170000_sleep_layer_v1_foundation',\n  ${epoch}\n)`);
  const promotions = sql.slice(promotionStart, policyStart)
    .replace('  genome_id,', '  id,\n  created_at,\n  genome_id,')
    .replace('select\n  genome.id,', `select\n  md5('kajo:baseline-v1:promotion:' || genome.genome_key)::uuid,\n  ${epoch},\n  genome.id,`);
  const policy = sql.slice(policyStart)
    .replace('  scope_type,', '  id,\n  created_at,\n  scope_type,')
    .replace("select\n  'GLOBAL',", `select\n  md5('kajo:baseline-v1:global-policy')::uuid,\n  ${epoch},\n  'GLOBAL',`)
    .replace('clock_timestamp()', epoch);
  return `-- Proposed empty-install seeds; logical epoch is the schema cutoff.
do $seed_guard$
begin
  if exists(select 1 from private.predictor_genomes)
    or exists(select 1 from private.promotion_decisions)
    or exists(select 1 from private.policy_assignments) then
    raise exception 'Baseline system seeds require empty system tables';
  end if;
end;
$seed_guard$;
${genomes}${promotions}${policy}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
