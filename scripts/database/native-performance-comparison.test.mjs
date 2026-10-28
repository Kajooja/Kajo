import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { performanceProtocol, summarizePerformance } from './native-prediction-performance.mjs';
import { performanceComparisonProtocol, performanceComparisonInstallations, skipPrefilterMigration,
  summarizePerformanceComparison } from './native-performance-comparison.mjs';

// Synthetic parser fixtures, never native timing evidence.
function runs() {
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const collection = (variant, diagnostic = false) => {
    const protocol = performanceProtocol({ profileFunctions: diagnostic });
    return { status: 'PASS', cleanup: 'ALL_CANONICAL_ROWS_RESTORED', canonicalTablesVerified: 91,
      protocol, protocolSha256: hash(protocol), sourceSha256: 'source', fixtureSha256: 'fixture',
      environment: { observedAt: '2026-10-28T00:00:00Z', serverVersion: '17.6', defaultTrackFunctions: 'none' },
      cohorts: protocol.catalogSizes.flatMap(catalogSize => protocol.operations.flatMap(operation =>
        protocol.requestKinds.map(requestKind => {
          const target = catalogSize === 1000 && operation.startsWith('discovery-') && requestKind === 'fresh';
          const executionMs = requestKind === 'exact-retry' ? 2 : target ? variant === 'BASELINE' ? 170 : 140 : 100;
          const samples = Array.from({ length: protocol.samplesPerCohort }, () => ({ executionMs, planningMs: 1,
            sharedHitBlocks: 2, sharedReadBlocks: 0, sharedDirtiedBlocks: 0, sharedWrittenBlocks: 0,
            tempReadBlocks: 0, tempWrittenBlocks: 0, walRecords: 1, walFullPageImages: 0, walBytes: 20, candidates: 15,
            ...(diagnostic ? { functionTiming: {
              root: { calls: 1, name: operation === 'taste-personal-next' ? 'taste_session_v2' : 'rank_items_feed_v1' },
              skipDecision: { calls: operation.startsWith('discovery-') && variant === 'BASELINE' ? catalogSize / 2 + 1 : 1 },
            } } : {}) }));
          return { catalogSize, operation, requestKind, warmupsCompleted: protocol.warmupsPerCohort,
            attempted: samples.length, samples, failures: [],
            summary: summarizePerformance(samples, samples.length, samples.length, [], { quantiles: !diagnostic }) };
        }))) };
  };
  return performanceComparisonProtocol().order.map((variant, n) => {
    const files = [{ name: 'previous.sql', sha256: 'a'.repeat(64) }], history = [{ version: 'previous', name: 'previous' }];
    if (variant === 'CANDIDATE') {
      files.push({ name: skipPrefilterMigration, sha256: 'b'.repeat(64) });
      history.push({ version: skipPrefilterMigration.slice(0, 14), name: skipPrefilterMigration.slice(15, -4) });
    }
    const runtime = { cleanup: 'PASS', containerId: 'container-' + n,
      image: 'registry/postgres sha256:' + 'a'.repeat(64), commit: 'commit', configSha256: 'config', cliVersion: '2.117.0', architecture: 'x64' };
    return { index: n + 1, variant, runtime, host: { cpuModel: 'fixture CPU', logicalCpus: 4 },
      installed: { runtime, manifest: { files }, history, applicationSnapshotSha256: variant },
      performance: collection(variant), diagnostics: collection(variant, true) };
  });
}
function retime(run, index, value) {
  const cohort = run.performance.cohorts[index];
  cohort.samples.forEach(sample => { sample.executionMs = value; });
  cohort.summary = summarizePerformance(cohort.samples, 20, 20, []);
}

test('paired comparison admits only declared effects with exact installation difference and no pooling', () => {
  const result = summarizePerformanceComparison(runs());
  assert.equal(result.decision, 'ADMITTED_IN_DECLARED_SYNTHETIC_SCOPE');
  assert.equal(result.plannedMeasurements, 1440);
  assert.equal(result.warmupsCompleted, 144);
  assert.equal(result.diagnosticObservations, 36);
  assert.deepEqual(result.pairs.map(p => [p.baselineRun, p.candidateRun]), [[1, 2], [4, 3], [5, 6]]);
  assert.equal(result.pairs[0].cohorts[6].reductionMs, 30);
  assert.equal(result.pairs[0].cohorts[6].requiredReductionMs, 8.5);
  assert.equal(result.pairs[0].mechanisms[3].baselineCalls, 501);
  assert.equal(result.pairs[0].mechanisms[3].candidateCalls, 1);
});

test('a complete losing comparison remains truthful NOT_ADMITTED instead of moving thresholds', () => {
  for (const mutate of [
    values => retime(values[1], 6, 165), // below minimum effect
    values => retime(values[2], 0, 106), // small catalogue regression
    values => retime(values[5], 1, 2.31), // exact-retry regression
    values => { values[1].diagnostics.cohorts[3].samples[0].functionTiming.skipDecision.calls = 2; },
    values => {
      const cohort = values[1].performance.cohorts[0];
      cohort.samples[0].tempWrittenBlocks = 1;
      cohort.summary = summarizePerformance(cohort.samples, 20, 20, []);
    },
  ]) {
    const values = runs(); mutate(values);
    assert.equal(summarizePerformanceComparison(values).decision, 'NOT_ADMITTED');
  }
});

test('comparison rejects missing runs, source/host drift and incomplete or altered raw data', () => {
  for (const mutate of [
    values => values.pop(), values => { values[1].variant = 'BASELINE'; },
    values => { values[1].host.cpuModel = 'different'; },
    values => { values[1].runtime.containerId = values[0].runtime.containerId; },
    values => { values[1].installed.manifest.files[0].sha256 = 'c'.repeat(64); },
    values => { values[1].installed.history.pop(); },
    values => { values[2].installed.applicationSnapshotSha256 = 'changed'; },
    values => { values[1].performance.sourceSha256 = 'changed'; },
    values => { values[1].performance.cohorts[0].samples.pop(); },
    values => { values[1].performance.cohorts[0].summary.metrics.executionMs.p50 = 0; },
    values => { values[1].diagnostics.cohorts[0].samples[0].functionTiming.skipDecision = undefined; },
    values => { values[1].diagnostics.cleanup = 'FAIL'; },
  ]) {
    const values = runs(); mutate(values); assert.throws(() => summarizePerformanceComparison(values));
  }
});

test('comparison freezes the reviewed prefix instead of silently measuring later forwards', () => {
  const installation = { files: [{ name: 'old.sql' }, { name: skipPrefilterMigration }, { name: 'later.sql' }],
    history: ['old', 'candidate', 'later'], manifest: { files: ['old', 'candidate', 'later'] } };
  const variants = performanceComparisonInstallations(installation);
  assert.equal(variants.BASELINE.files.length, 1);
  assert.equal(variants.CANDIDATE.files.length, 2);
  assert.deepEqual(variants.CANDIDATE.manifest.files, ['old', 'candidate']);
  assert.deepEqual(variants.BASELINE.history, ['old']);
  assert.throws(() => performanceComparisonInstallations({ files: [{ name: 'old.sql' }] }));
});
