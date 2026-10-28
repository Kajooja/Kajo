import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { runIsolatedSqlProbe } from './ci-supabase-stack.mjs';
import { collectNativePredictionPerformance, explainMetrics, performanceProtocol,
  summarizeFunctionTiming, summarizePerformance } from './native-prediction-performance.mjs';

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
  assert.equal(protocol.trackFunctions, 'none');
  assert.deepEqual(summarizePerformance([sample], 1, 1, [], { quantiles: false }),
    { planned: 1, attempted: 1, succeeded: 1, failed: 0, cancelled: 0, missing: 0 });
});

test('function diagnosis preserves inclusive root and bounded self-time ordering without summing totals', () => {
  const root = { schema: 'public', name: 'rank_items_feed_v1', arguments: 'jsonb', calls: 1, totalMs: 50, selfMs: 0.1 };
  const rows = [root, ...Array.from({ length: 30 }, (_, index) => ({ schema: 'private', name: 'helper_' + index,
    arguments: '', calls: 2, totalMs: 10, selfMs: index / 10 }))];
  const timing = summarizeFunctionTiming(rows, root.name);
  assert.deepEqual(timing.root, root); assert.equal(timing.trackedFunctions, 31);
  assert.equal(timing.omittedFunctions, 6); assert.equal(timing.topSelfTime.length, 25);
  assert.equal(timing.topSelfTime[0].name, 'helper_29');
  assert.throws(() => summarizeFunctionTiming(rows.slice(1), root.name));
  assert.throws(() => summarizeFunctionTiming([{ ...root, calls: 3 }], root.name));
  assert.throws(() => summarizeFunctionTiming([root, root], root.name));
  assert.throws(() => summarizeFunctionTiming([{ ...root, selfMs: NaN }], root.name));
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
    const diagnostics = await collectNativePredictionPerformance(exec, { contractTest: true, profileFunctions: true });
    assert.equal(diagnostics.status, 'PASS');
    assert.equal(diagnostics.protocol.trackFunctions, 'all');
    assert.equal(diagnostics.cohorts.length, 6);
    for (const cohort of diagnostics.cohorts) {
      assert.equal(cohort.summary.succeeded, 1);
      assert.equal(cohort.summary.metrics, undefined, 'Single diagnostic observations have no quantiles');
      const timing = cohort.samples[0].functionTiming;
      assert.equal(timing.root.calls, 1, 'Function capture precedes the two verification retries');
      assert.ok(timing.trackedFunctions > 1);
      assert.ok(timing.topSelfTime.length <= 25);
      assert.ok(timing.topSelfTime.some(row => row.schema === 'private'));
    }
    assert.equal(diagnostics.cleanup, 'ALL_CANONICAL_ROWS_RESTORED');
    for (const profileFunctions of [false, true]) {
      let observations = 0;
      const observeHistoryCohort = profileFunctions ? async context => {
        observations++;
        assert.equal(context.catalogSize, 40);
        assert.equal(context.request.profileId, context.profileId);
        assert.equal(context.request.itemType, 'MOVIE');
        assert.equal(context.originalSample.functionTiming.root.calls, 1);
        assert.ok(context.originalSample.functionTiming.skipDecision.calls >= 20);
        assert.match(context.call, /select public.rank_items_feed_v1/);
        assert.match(context.auditSql, /skipSources/);
      } : undefined;
      const history = await collectNativePredictionPerformance(exec,
        { contractTest: true, skipHistory: true, profileFunctions, observeHistoryCohort });
      assert.equal(observations, profileFunctions ? 1 : 0, 'Observe only the original affected cohort');
      assert.equal(history.status, 'PASS');
      assert.equal(history.cohorts.length, profileFunctions ? 6 : 12);
      assert.ok(history.cohorts.every(c => c.historyPreserved && c.summary.succeeded === 1));
      assert.ok(history.cohorts.every(c => c.historyInventory.commands === (c.skipHistory === 'CATALOGUE_HISTORY' ? 460 : 120)));
      assert.ok(history.cohorts.some(c => c.historyInventory.erased > 0));
      assert.ok(history.cohorts.some(c => c.historyInventory.offCatalogueItems > 0));
      assert.equal(history.cleanup, 'ALL_CANONICAL_ROWS_RESTORED');
    }
    await assert.rejects(collectNativePredictionPerformance(exec, { contractTest: true,
      skipHistory: true, profileFunctions: true,
      observeHistoryCohort() { throw new Error('Injected observer failure'); } }), error => {
      assert.match(error.message, /Injected observer failure/);
      assert.equal(error.performanceReport.status, 'FAIL');
      assert.equal(error.performanceReport.failure.phase, 'OBSERVER');
      assert.equal(error.performanceReport.cohorts[0].summary.succeeded, 1);
      assert.equal(error.performanceReport.cohorts[1].summary.missing, 1);
      assert.equal(error.performanceReport.cleanup, 'ALL_CANONICAL_ROWS_RESTORED');
      return true;
    });
    injectFailure = true;
    const failed = await collectNativePredictionPerformance(exec, { contractTest: true, skipHistory: true });
    assert.equal(failed.status, 'FAIL');
    assert.equal(failed.cohorts[0].summary.cancelled, 1);
    assert.equal(failed.cohorts[1].summary.missing, 1);
    assert.equal(failed.cohorts[0].summary.metrics.executionMs, null);
    assert.equal(failed.cleanup, 'ALL_CANONICAL_ROWS_RESTORED');
  } finally { await db.close(); }
});

test('scoped history observer cannot be attached to ordinary timing collections', async () => {
  let executed = false;
  await assert.rejects(collectNativePredictionPerformance(async () => { executed = true; },
    { observeHistoryCohort() {} }), /separate function-diagnostic/);
  assert.equal(executed, false);
});
