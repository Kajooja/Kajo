import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { performanceProtocol, summarizePerformance } from './native-prediction-performance.mjs';
import { summarizePerformanceSeries } from './native-performance-series.mjs';

// Numeric parser fixtures only: these values are not native performance evidence.
function series() {
  const collection = (index, profileFunctions = false) => {
    const protocol = performanceProtocol({ profileFunctions });
    return { status: 'PASS', cleanup: 'ALL_CANONICAL_ROWS_RESTORED', canonicalTablesVerified: 91,
      protocol, protocolSha256: createHash('sha256').update(JSON.stringify(protocol)).digest('hex'),
      sourceSha256: 'source', fixtureSha256: 'fixture',
      environment: { observedAt: `2026-10-28T00:00:0${index}Z`, serverVersion: '17.6', defaultTrackFunctions: 'none' },
      cohorts: protocol.catalogSizes.flatMap(catalogSize => protocol.operations.flatMap(operation =>
        protocol.requestKinds.map(requestKind => {
          const samples = Array.from({ length: protocol.samplesPerCohort }, (_, n) => ({
            executionMs: n + index * 10, planningMs: 1, sharedHitBlocks: 2, sharedReadBlocks: 0,
            sharedDirtiedBlocks: 0, sharedWrittenBlocks: 0, tempReadBlocks: 0, tempWrittenBlocks: 0,
            walRecords: 1, walFullPageImages: 0, walBytes: 20, candidates: 15,
            ...(profileFunctions ? { functionTiming: { root: { calls: 1,
              name: operation === 'taste-personal-next' ? 'taste_session_v2' : 'rank_items_feed_v1' } } } : {}),
          }));
          return { catalogSize, operation, requestKind, warmupsCompleted: protocol.warmupsPerCohort,
            attempted: samples.length, samples, failures: [],
            summary: summarizePerformance(samples, samples.length, samples.length, [], { quantiles: !profileFunctions }) };
        }))) };
  };
  return [1, 2, 3].map(index => ({ index,
    host: { cpuModel: 'fixture CPU', logicalCpus: 4, kernel: 'fixture kernel', totalHostMemoryBytes: 100 },
    runtime: { cleanup: 'PASS', containerId: 'container-' + index, image: 'mirror/postgres sha256:' + 'a'.repeat(64),
      commit: 'commit', configSha256: 'config', cliVersion: '2.117.0', architecture: 'x64' },
    installed: { runtime: { containerId: 'container-' + index, image: 'mirror/postgres sha256:' + 'a'.repeat(64) },
      manifest: { files: [{ name: 'fixture.sql', sha256: 'migration' }] }, history: ['fixture'], applicationSnapshotSha256: 'snapshot' },
    performance: collection(index), ...(index === 3 ? { diagnostics: collection(index, true) } : {}),
  }));
}

test('same-worker series reports ranges of run quantiles without pooling trials or diagnostics', () => {
  const runs = series();
  runs[1].runtime.image = runs[1].runtime.image.replace('mirror/', 'another-mirror/');
  const summary = summarizePerformanceSeries(runs);
  assert.equal(summary.plannedMeasurements, 720);
  assert.equal(summary.warmupsCompleted, 72);
  assert.equal(summary.diagnosticObservations, 6);
  assert.equal(summary.cohorts.length, 12);
  assert.deepEqual(summary.cohorts[0].runP50Ms, [19, 29, 39]);
  assert.deepEqual(summary.cohorts[0].runP95Ms, [28, 38, 48]);
  assert.deepEqual(summary.cohorts[0].p50RangeMs, { min: 19, max: 39, spread: 20 });
  assert.deepEqual(summary.cohorts[0].p95RangeMs, { min: 28, max: 48, spread: 20 });
});

test('series refuses changed sources, hardware, protocol, incomplete cohorts and mixed diagnostic timings', () => {
  for (const mutate of [
    runs => runs.pop(),
    runs => { runs[1].host.cpuModel = 'different CPU'; },
    runs => { runs[1].runtime.image = 'mirror/postgres sha256:' + 'b'.repeat(64); },
    runs => { runs[1].runtime.containerId = runs[0].runtime.containerId; },
    runs => { runs[1].runtime.configSha256 = 'changed'; },
    runs => { runs[1].installed.manifest.files[0].sha256 = 'changed'; },
    runs => { runs[1].performance.sourceSha256 = 'changed'; },
    runs => { runs[1].performance.fixtureSha256 = 'changed'; },
    runs => { runs[1].performance.environment.defaultTrackFunctions = 'all'; },
    runs => { runs[1].performance.protocol.trackFunctions = 'all'; },
    runs => { runs[1].performance.cohorts.pop(); },
    runs => { runs[1].performance.cohorts[0].samples.pop(); },
    runs => { runs[1].performance.cohorts[0].failures.push('TIMEOUT'); },
    runs => { runs[1].performance.cohorts[0].summary.metrics.executionMs.p95 = 0; },
    runs => { runs[1].performance.cleanup = 'NOT_VERIFIED'; },
    runs => { runs[2].diagnostics.status = 'FAIL'; },
    runs => { runs[0].diagnostics = runs[2].diagnostics; },
    runs => { runs[2].diagnostics.cohorts[0].samples[0].functionTiming.root.calls = 3; },
    runs => { runs[2].diagnostics.cohorts[0].summary.metrics = { executionMs: { p95: 1 } }; },
  ]) {
    const runs = series(); mutate(runs); assert.throws(() => summarizePerformanceSeries(runs));
  }
});
