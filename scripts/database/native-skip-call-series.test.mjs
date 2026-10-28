import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { performanceProtocol, summarizePerformance } from './native-prediction-performance.mjs';
import { performanceComparisonProtocol, skipPrefilterMigration } from './native-performance-comparison.mjs';
import { expectedSkipHistoryInventory } from './native-skip-history-fixture.mjs';
import { skipCallDiagnosticProtocol } from './native-skip-call-diagnostics.mjs';
import { summarizeSkipCallSeries } from './native-skip-call-series.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id = value => 'ab157000-0000-4000-8000-' + String(value).padStart(12, '0');

// Generated parser fixtures only. They are not native timing or admission evidence.
function fixture() {
  const collection = (variant, index, diagnostic, skipHistory) => {
    const protocol = performanceProtocol({ profileFunctions: diagnostic, skipHistory });
    return { status: 'PASS', cleanup: 'ALL_CANONICAL_ROWS_RESTORED', canonicalTablesVerified: 91,
      protocol, protocolSha256: hash(protocol), sourceSha256: 'a'.repeat(64), fixtureSha256: 'b'.repeat(64),
      ...(skipHistory ? { historyFixtureSha256: 'c'.repeat(64) } : {}),
      environment: { observedAt: '2026-10-28T00:00:00Z', serverVersion: '17.6', defaultTrackFunctions: 'none' },
      cohorts: (protocol.skipHistories ?? [null]).flatMap(history => protocol.catalogSizes.flatMap(catalogSize =>
        protocol.operations.flatMap(operation => protocol.requestKinds.map(requestKind => {
          const discovery = operation.startsWith('discovery-');
          const skipCalls = discovery
            ? (history === 'CATALOGUE_HISTORY' || variant === 'BASELINE' ? catalogSize / 2 + 1 : 1) : 50;
          const executionMs = requestKind === 'exact-retry' ? 2 : discovery && catalogSize === 1000
            ? (variant === 'BASELINE' ? 170 : 140) + index : 100 + index;
          const samples = Array.from({ length: protocol.samplesPerCohort }, () => ({ executionMs, planningMs: 1,
            sharedHitBlocks: 2, sharedReadBlocks: 0, sharedDirtiedBlocks: 0, sharedWrittenBlocks: 0,
            tempReadBlocks: 0, tempWrittenBlocks: 0, walRecords: 1, walFullPageImages: 0, walBytes: 20, candidates: 15,
            ...(diagnostic ? { functionTiming: {
              root: { name: discovery ? 'rank_items_feed_v1' : 'taste_session_v2', calls: 1, totalMs: executionMs, selfMs: 1 },
              skipDecision: { calls: skipCalls },
            } } : {}) }));
          return { catalogSize, operation, requestKind, warmupsCompleted: protocol.warmupsPerCohort,
            ...(history ? { skipHistory: history, historyInventory: expectedSkipHistoryInventory(history, catalogSize), historyPreserved: true } : {}),
            attempted: samples.length, samples, failures: [],
            summary: summarizePerformance(samples, samples.length, samples.length, [], { quantiles: !diagnostic }) };
        })))) };
  };
  return performanceComparisonProtocol().order.map((variant, index) => {
    const files = Array.from({ length: 53 }, (_, n) => ({ name: 'previous-' + n + '.sql', sha256: 'a'.repeat(64) }));
    const history = files.map((file, n) => ({ version: String(n), name: file.name }));
    if (variant === 'CANDIDATE') {
      files.push({ name: skipPrefilterMigration, sha256: 'b'.repeat(64) });
      history.push({ version: skipPrefilterMigration.slice(0, 14), name: skipPrefilterMigration.slice(15, -4) });
    }
    const runtime = { cleanup: 'PASS', containerId: 'container-' + index,
      image: 'registry/postgres sha256:' + 'a'.repeat(64), commit: 'commit', configSha256: 'config', cliVersion: '2.117.0', architecture: 'x64' };
    const run = { index: index + 1, variant, runtime, host: { cpuModel: 'fixture CPU', logicalCpus: 4 },
      installed: { runtime, manifest: { files }, history, applicationSnapshotSha256: variant },
      performance: collection(variant, index, false, false), diagnostics: collection(variant, index, true, false),
      historyPerformance: collection(variant, index, false, true), historyDiagnostics: collection(variant, index, true, true) };
    const protocol = skipCallDiagnosticProtocol();
    const root = repetition => ({ functionTiming: {
      root: { name: 'rank_items_feed_v1', calls: 1, totalMs: 100 + index + repetition, selfMs: 1 },
      skipDecision: { calls: 501 + repetition } }, exactRetries: 2, frozenSourceSha256: 'f'.repeat(64), candidates: 15,
    selectedItemIds: [1, 2, 3, 4, 5].map(id), selectedScores: [1, 2, 3, 4, 5].map(n => ({ itemId: id(n), score: 10 - n })),
    availability: 'ITEMS', continuationState: 'MORE' });
    const controls = [0, 1, 2].map(root);
    run.skipCallDiagnostics = { status: 'PASS', protocol, protocolSha256: hash(protocol),
      sourceSha256: 'd'.repeat(64), baselineDefinitionSha256: 'e'.repeat(64), forwardSha256: 'b'.repeat(64),
      installedDefinitionSha256: (variant === 'BASELINE' ? 'e' : 'f').repeat(64),
      originalSample: structuredClone(run.historyDiagnostics.cohorts[0].samples[0]),
      functionsRestored: true, completedControls: 3, completedTraces: 3, missingControls: 0, missingTraces: 0, controls,
      attempts: ['CONTROL', 'TRACE'].flatMap(phase => [1, 2, 3].map(repetition => ({ phase, repetition, status: 'PASS' }))),
      repetitions: controls.map((control, n) => ({ repetition: n + 1, control: structuredClone(control),
        traced: { ...structuredClone(control), acquisitionCalls: 500, availabilityCalls: n + 1 },
        replay: { rows: 500, exactRowsEqual: true, rowsSha256: 'a'.repeat(64), invalidClockRejections: 2,
          clockWitnessPrecision: 'POSTGRES_TIMESTAMP_MICROSECONDS',
          input: { scope: { profileId: id(900) } }, availabilityReplayResult: true, availabilityObserved: { remaining: true },
          baselineAcquisitionPlan: [{ Plan: { 'Node Type': 'Result' } }], candidateAcquisitionPlan: [{ Plan: { 'Node Type': 'Result' } }],
          availabilityReplayPlan: [{ Plan: { 'Node Type': 'Result' } }],
          calls: ['ACQUISITION', 'AVAILABILITY'].flatMap(scope => Array.from({ length: scope === 'ACQUISITION' ? 500 : n + 1 },
            (_, i) => ({ scope, profileId: id(900), itemId: id(i + 1000), cutoff: '2026-10-28T00:00:00Z' }))) } })) };
    return run;
  });
}

test('scoped series retains same-variant observations and ranges without issuing either v1 admission', () => {
  const result = summarizeSkipCallSeries(fixture());
  assert.equal(result.status, 'PASS'); assert.equal(result.admission, 'NONE');
  assert.equal(result.referenceRuleChecks.plannedMeasurements, 2880);
  assert.equal(result.referenceRuleChecks.decision, undefined);
  assert.equal(result.referenceRuleChecks.emptyHistory.decision, undefined);
  assert.doesNotMatch(JSON.stringify(result), /ADMITTED_IN_DECLARED/);
  const [baseline, candidate] = result.variants;
  assert.deepEqual(baseline.observations.map(row => row.run), [1, 4, 5]);
  assert.deepEqual(candidate.observations.map(row => row.run), [2, 3, 6]);
  assert.equal(baseline.observations.flatMap(row => row.controls).length, 9);
  assert.equal(candidate.observations.flatMap(row => row.traces).length, 9);
  assert.deepEqual(baseline.acquisitionCallRange, { min: 500, max: 500, spread: 0 });
  assert.deepEqual(candidate.availabilityCallRange, { min: 1, max: 3, spread: 2 });
  assert.deepEqual(baseline.affectedTimingCohorts[0].observations,
    [{ run: 1, p50Ms: 100, p95Ms: 100 }, { run: 4, p50Ms: 103, p95Ms: 103 }, { run: 5, p50Ms: 104, p95Ms: 104 }]);
  assert.deepEqual(baseline.affectedTimingCohorts[0].p50RangeMs, { min: 100, max: 104, spread: 4 });
  const losing = fixture();
  losing[1].historyDiagnostics.cohorts[0].samples[0].functionTiming.skipDecision.calls++;
  losing[1].skipCallDiagnostics.originalSample = structuredClone(losing[1].historyDiagnostics.cohorts[0].samples[0]);
  const failedReference = summarizeSkipCallSeries(losing);
  assert.equal(failedReference.referenceRuleChecks.pairs[0].accepted, false);
  assert.equal(failedReference.admission, 'NONE');
});

test('scoped series rejects incomplete, misattributed, drifted and falsely admitted evidence', () => {
  for (const mutate of [
    runs => runs.pop(),
    runs => { runs[0].variant = 'CANDIDATE'; },
    runs => { runs[1].skipCallDiagnostics.sourceSha256 = 'a'.repeat(64); },
    runs => { runs[2].skipCallDiagnostics.forwardSha256 = 'a'.repeat(64); },
    runs => { runs[3].skipCallDiagnostics.baselineDefinitionSha256 = 'a'.repeat(64); },
    runs => { runs[4].skipCallDiagnostics.installedDefinitionSha256 = 'a'.repeat(64); },
    runs => { runs[5].skipCallDiagnostics.protocol.repetitions = 2; },
    runs => { runs[0].skipCallDiagnostics.functionsRestored = false; },
    runs => { runs[0].skipCallDiagnostics.missingTraces = 1; },
    runs => { runs[0].skipCallDiagnostics.repetitions.pop(); },
    runs => { runs[0].skipCallDiagnostics.attempts[5].status = 'FAIL'; },
    runs => { runs[0].skipCallDiagnostics.repetitions[0].traced.acquisitionCalls--; },
    runs => { runs[0].skipCallDiagnostics.repetitions[0].replay.calls.pop(); },
    runs => { runs[0].skipCallDiagnostics.repetitions[0].replay.calls[0].scope = 'OTHER'; },
    runs => { runs[0].skipCallDiagnostics.repetitions[0].traced.selectedItemIds[0] = id(99); },
    runs => { runs[0].skipCallDiagnostics.repetitions[0].replay.exactRowsEqual = false; },
    runs => { runs[0].skipCallDiagnostics.repetitions[0].replay.invalidClockRejections = 1; },
    runs => { runs[0].skipCallDiagnostics.repetitions[0].replay.clockWitnessPrecision = 'MILLISECONDS'; },
    runs => { runs[0].skipCallDiagnostics.repetitions[0].replay.baselineAcquisitionPlan = []; },
    runs => { runs[0].skipCallDiagnostics.originalSample.executionMs = 0; },
    runs => { runs[0].skipCallDiagnostics.decision = 'ADMITTED_IN_DECLARED_HISTORY_ENVELOPE'; },
    runs => { runs[0].skipCallDiagnostics.admission = 'ADMITTED'; },
  ]) {
    const runs = fixture(); mutate(runs); assert.throws(() => summarizeSkipCallSeries(runs));
  }
});
