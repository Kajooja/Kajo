import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { runIsolatedSqlProbe } from './ci-supabase-stack.mjs';
import { collectNativePredictionPerformance, explainMetrics, performanceProtocol, summarizePerformance } from './native-prediction-performance.mjs';

test('performance quantiles retain sparse samples, failures, missing denominators and root-only resources', () => {
  const plan = [{ 'Planning Time': 0.2, 'Execution Time': 10, Plan: {
    'Shared Hit Blocks': 20, 'Shared Read Blocks': 2, 'Shared Dirtied Blocks': 1, 'Shared Written Blocks': 0,
    'Temp Read Blocks': 0, 'Temp Written Blocks': 0, 'WAL Records': 3, 'WAL FPI': 0, 'WAL Bytes': 500,
    Plans: [{ 'Shared Hit Blocks': 999 }],
  } }];
  const sample = explainMetrics(plan);
  assert.equal(sample.sharedHitBlocks, 20);
  const samples = Array.from({ length: 20 }, (_, index) => ({ ...sample, executionMs: index + 1 }));
  assert.deepEqual(summarizePerformance(samples, 20, 20, []).metrics.executionMs, { min: 1, p50: 10, p95: 19, max: 20 });
  const incomplete = summarizePerformance([], 20, 2, ['ERROR', 'TIMEOUT']);
  assert.equal(incomplete.failed, 1); assert.equal(incomplete.cancelled, 1); assert.equal(incomplete.missing, 18);
  assert.equal(incomplete.metrics.executionMs, null);
  assert.throws(() => summarizePerformance(samples, 20, 19, []));
  for (const invalid of [undefined, NaN, -1, Infinity, '10']) {
    assert.throws(() => explainMetrics([{ ...plan[0], 'Execution Time': invalid }]));
  }
  const protocol = performanceProtocol();
  assert.deepEqual(protocol.catalogSizes, [40, 1000]);
  assert.equal(protocol.samplesPerCohort, 20);
  assert.equal(protocol.tail, 'EXPLORATORY_NO_LATENCY_SLO');
});

test('actual RPC measurement contracts, authenticated retries and failure cleanup preserve canonical rows', async () => {
  let db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    const installation = await db.dumpDataDir();
    let fixtures = 0;
    let injectFailure = false;
    const exec = async (sql, options) => {
      // Exercise the real native caller policy as well as the database SQL.
      await runIsolatedSqlProbe(() => '', 'contract-test', '', options);
      if (options.stage === 'native-perf-fixture' && fixtures++ > 0) {
        // The collector has already verified complete canonical cleanup. Start
        // the next cohort with a fresh PGlite runtime as the native runner does
        // with connections, avoiding cross-session WASM prepared-state reuse.
        await db.close(); db = new PGlite({ loadDataDir: installation });
      }
      if (injectFailure && options.stage === 'native-perf-sample') throw new Error('Injected statement timeout');
      if (options.stage === 'native-perf-sample') {
        // Match native independent connections; do not retain PGlite's prepared
        // runtime state across rolled-back sessions (see native parity owner).
        const connection = new PGlite({ loadDataDir: await db.dumpDataDir() });
        try { return (await connection.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
        finally { await connection.close(); }
      }
      try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
      catch (error) { await db.exec('rollback;'); throw error; }
    };
    const report = await collectNativePredictionPerformance(exec, { contractTest: true });
    assert.equal(report.status, 'PASS');
    assert.equal(report.protocol.purpose, 'CONTRACT_TEST_ONLY');
    assert.equal(report.cohorts.length, 12);
    assert.ok(report.cohorts.every(cohort => cohort.summary.succeeded === 1 && cohort.summary.missing === 0));
    assert.equal(report.cleanup, 'ALL_CANONICAL_ROWS_RESTORED');
    injectFailure = true;
    const failed = await collectNativePredictionPerformance(exec, { contractTest: true });
    assert.equal(failed.status, 'FAIL');
    assert.equal(failed.cohorts[0].summary.cancelled, 1);
    assert.equal(failed.cohorts[1].summary.missing, 1);
    assert.equal(failed.cohorts[0].summary.metrics.executionMs, null);
    assert.equal(failed.cleanup, 'ALL_CANONICAL_ROWS_RESTORED');
  } finally { await db.close(); }
});
