import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performanceProtocol, summarizePerformance } from './native-prediction-performance.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = cohort => JSON.stringify([cohort.catalogSize, cohort.operation, cohort.requestKind]);

export function performanceSeriesProtocol() {
  return {
    version: 'native-prediction-performance-series-v1', baselineRuns: 3,
    execution: 'SERIAL_FRESH_OWNED_STACKS_IN_ONE_CI_JOB_PROCESS',
    comparison: 'PER_COHORT_RANGE_OF_RUN_P50_AND_P95_NO_POOLED_QUANTILES',
    admission: 'COMPLETENESS_SOURCE_IDENTITY_AND_CLEANUP_ONLY_NO_LATENCY_BUDGET',
    diagnostics: 'SIX_FRESH_SINGLE_OBSERVATIONS_AFTER_THIRD_BASELINE_CLEANUP',
    limits: 'SAME_WORKER_NOT_FIXED_FREQUENCY_OR_LOAD_NO_CROSS_JOB_HARDWARE_EQUIVALENCE',
  };
}

function imageDigest(image) {
  assert.match(image, /^\S+ sha256:[0-9a-f]{64}$/);
  return image.split(' ')[1]; // Reviewed registry mirrors may name identical bytes differently.
}

export function performanceRunIdentity(run) {
  const { runtime, installed, performance, host } = run;
  assert.equal(runtime.cleanup, 'PASS');
  assert.equal(installed.runtime.containerId, runtime.containerId);
  assert.equal(imageDigest(installed.runtime.image), imageDigest(runtime.image));
  const { observedAt, ...settings } = performance.environment;
  assert.ok(Number.isFinite(Date.parse(observedAt)));
  return {
    host, cliVersion: runtime.cliVersion, imageDigest: imageDigest(runtime.image),
    architecture: runtime.architecture, commit: runtime.commit, configSha256: runtime.configSha256,
    manifest: installed.manifest, history: installed.history,
    applicationSnapshotSha256: installed.applicationSnapshotSha256,
    protocol: performance.protocol, protocolSha256: performance.protocolSha256,
    sourceSha256: performance.sourceSha256, fixtureSha256: performance.fixtureSha256, settings,
    canonicalTablesVerified: performance.canonicalTablesVerified,
  };
}

export function verifyPerformanceCollection(report, profileFunctions = false) {
  assert.equal(report.status, 'PASS');
  assert.equal(report.cleanup, 'ALL_CANONICAL_ROWS_RESTORED');
  assert.ok(Number.isInteger(report.canonicalTablesVerified) && report.canonicalTablesVerified > 0);
  const protocol = performanceProtocol({ profileFunctions });
  assert.deepEqual(report.protocol, protocol, 'Unexpected measurement protocol');
  assert.equal(report.protocolSha256, hash(protocol));
  const expectedKeys = protocol.catalogSizes.flatMap(catalogSize => protocol.operations.flatMap(operation =>
    protocol.requestKinds.map(requestKind => key({ catalogSize, operation, requestKind }))));
  assert.deepEqual(report.cohorts.map(key), expectedKeys, 'Incomplete or reordered cohort matrix');
  for (const cohort of report.cohorts) {
    assert.equal(cohort.warmupsCompleted, protocol.warmupsPerCohort);
    assert.equal(cohort.warmupFailure, undefined);
    assert.equal(cohort.samples.length, protocol.samplesPerCohort);
    assert.deepEqual(cohort.failures, []);
    assert.equal(cohort.attempted, protocol.samplesPerCohort);
    assert.deepEqual(cohort.summary, summarizePerformance(cohort.samples, protocol.samplesPerCohort,
      cohort.attempted, cohort.failures, { quantiles: !profileFunctions }));
    assert.ok(cohort.samples.every(sample => Number.isInteger(sample.candidates) && sample.candidates > 0));
    assert.equal(new Set(cohort.samples.map(sample => sample.candidates)).size, 1);
    if (profileFunctions) {
      const timing = cohort.samples[0].functionTiming;
      assert.equal(timing?.root.calls, 1);
      assert.equal(timing.root.name, cohort.operation === 'taste-personal-next' ? 'taste_session_v2' : 'rank_items_feed_v1');
    }
  }
}

export function summarizePerformanceSeries(runs) {
  assert.equal(runs.length, performanceSeriesProtocol().baselineRuns, 'Incomplete baseline series');
  assert.equal(new Set(runs.map(run => run.runtime.containerId)).size, runs.length, 'Each run requires a fresh stack');
  const reference = performanceRunIdentity(runs[0]);
  for (const [index, run] of runs.entries()) {
    assert.equal(run.index, index + 1);
    verifyPerformanceCollection(run.performance);
    assert.deepEqual(performanceRunIdentity(run), reference, 'Sources, settings or worker changed within baseline series');
    if (index < runs.length - 1) assert.equal(run.diagnostics, undefined, 'Diagnostics must follow all baselines');
  }
  const last = runs.at(-1);
  verifyPerformanceCollection(last.diagnostics, true);
  for (const field of ['sourceSha256', 'fixtureSha256', 'canonicalTablesVerified']) {
    assert.equal(last.diagnostics[field], last.performance[field]);
  }
  const { observedAt: diagnosticTime, ...diagnosticSettings } = last.diagnostics.environment;
  assert.ok(Number.isFinite(Date.parse(diagnosticTime)));
  assert.deepEqual(diagnosticSettings, reference.settings);
  const range = values => ({ min: Math.min(...values), max: Math.max(...values),
    spread: Math.max(...values) - Math.min(...values) });
  return {
    status: 'PASS', baselineRuns: runs.length,
    plannedMeasurements: runs.length * runs[0].performance.cohorts.length * reference.protocol.samplesPerCohort,
    warmupsCompleted: runs.length * runs[0].performance.cohorts.length * reference.protocol.warmupsPerCohort,
    diagnosticObservations: last.diagnostics.cohorts.length,
    cohorts: runs[0].performance.cohorts.map((cohort, index) => {
      const counterparts = runs.map(run => run.performance.cohorts[index]);
      assert.equal(new Set(counterparts.map(value => value.samples[0].candidates)).size, 1);
      const runP50Ms = counterparts.map(value => value.summary.metrics.executionMs.p50);
      const runP95Ms = counterparts.map(value => value.summary.metrics.executionMs.p95);
      return { catalogSize: cohort.catalogSize, operation: cohort.operation, requestKind: cohort.requestKind,
        runP50Ms, runP95Ms, p50RangeMs: range(runP50Ms), p95RangeMs: range(runP95Ms) };
    }),
  };
}
