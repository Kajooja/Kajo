import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { summarizeSkipHistoryComparison } from './native-skip-history-comparison.mjs';
import { skipCallDiagnosticProtocol } from './native-skip-call-diagnostics.mjs';
import { performanceComparisonProtocol, skipPrefilterMigration } from './native-performance-comparison.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sha = value => assert.match(value, /^[0-9a-f]{64}$/);
const range = values => ({ min: Math.min(...values), max: Math.max(...values),
  spread: Math.max(...values) - Math.min(...values) });
const affected = [
  { history: 'EMPTY', operation: 'taste-personal-next', requestKind: 'fresh' },
  { history: 'OFF_CATALOGUE_HISTORY', operation: 'taste-personal-next', requestKind: 'exact-retry' },
  { history: 'CATALOGUE_HISTORY', operation: 'discovery-personal-movie', requestKind: 'fresh' },
  { history: 'CATALOGUE_HISTORY', operation: 'discovery-shared-movie', requestKind: 'fresh' },
];

function verifyRoot(observation) {
  assert.equal(observation.functionTiming.root.name, 'rank_items_feed_v1');
  assert.equal(observation.functionTiming.root.calls, 1);
  for (const key of ['totalMs', 'selfMs']) {
    assert.ok(Number.isFinite(observation.functionTiming.root[key]) && observation.functionTiming.root[key] >= 0);
  }
  assert.ok(Number.isInteger(observation.functionTiming.skipDecision.calls)
    && observation.functionTiming.skipDecision.calls > 0);
  assert.equal(observation.exactRetries, 2);
  sha(observation.frozenSourceSha256);
  assert.ok(Number.isInteger(observation.candidates) && observation.candidates > 0);
  assert.equal(observation.selectedItemIds.length, 5);
  assert.equal(new Set(observation.selectedItemIds).size, 5);
  for (const id of observation.selectedItemIds) assert.match(id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(observation.selectedScores.map(row => row.itemId), observation.selectedItemIds);
  assert.ok(observation.selectedScores.every(row => Number.isFinite(row.score)));
  assert.equal(typeof observation.availability, 'string');
  assert.equal(typeof observation.continuationState, 'string');
}

// The original validator retains every measured denominator, identity and rule.
// Its decisions are intentionally not promoted into this diagnostic protocol.
export function summarizeSkipCallSeries(runs) {
  const { decision: ignoredDecision, emptyHistory, ...checks } = summarizeSkipHistoryComparison(runs);
  const { decision: ignoredEmptyDecision, ...emptyChecks } = emptyHistory;
  assert.deepEqual(runs.map(run => run.variant), performanceComparisonProtocol().order);
  const protocol = skipCallDiagnosticProtocol();
  const first = runs[0].skipCallDiagnostics;
  assert.ok(first, 'Missing scoped diagnostic report');
  const candidate = runs.find(run => run.variant === 'CANDIDATE');
  const forward = candidate.installed.manifest.files.at(-1);
  assert.equal(forward.name, skipPrefilterMigration);
  const definitions = new Map();
  for (const run of runs) {
    assert.equal(run.installed.manifest.files.length, run.variant === 'BASELINE' ? 53 : 54,
      'Scoped diagnosis requires the declared immutable installation prefix');
    const report = run.skipCallDiagnostics;
    assert.equal(report?.status, 'PASS', 'Incomplete scoped diagnostic report');
    assert.equal(report.decision, undefined, 'Scoped diagnostics cannot carry a performance admission');
    assert.ok(report.admission === undefined || report.admission === 'NONE', 'Unexpected diagnostic admission');
    assert.deepEqual(report.protocol, protocol);
    assert.equal(report.protocolSha256, hash(protocol));
    for (const field of ['sourceSha256', 'baselineDefinitionSha256', 'forwardSha256']) {
      sha(report[field]);
      assert.equal(report[field], first[field], 'Diagnostic identity changed: ' + field);
    }
    assert.equal(report.forwardSha256, forward.sha256, 'Diagnostic forward differs from installed comparison');
    sha(report.installedDefinitionSha256);
    if (definitions.has(run.variant)) assert.equal(report.installedDefinitionSha256, definitions.get(run.variant));
    else definitions.set(run.variant, report.installedDefinitionSha256);
    if (run.variant === 'BASELINE') assert.equal(report.installedDefinitionSha256, report.baselineDefinitionSha256);
    const original = run.historyDiagnostics.cohorts.find(cohort => cohort.skipHistory === 'CATALOGUE_HISTORY'
      && cohort.operation === 'discovery-personal-movie' && cohort.catalogSize === 1000 && cohort.requestKind === 'fresh');
    assert.deepEqual(report.originalSample, original.samples[0], 'Diagnostic lost its original prelude observation');
    assert.equal(report.functionsRestored, true);
    assert.equal(report.failure, undefined);
    assert.equal(report.restorationFailure, undefined);
    assert.equal(report.completedControls, protocol.repetitions);
    assert.equal(report.completedTraces, protocol.repetitions);
    assert.equal(report.missingControls, 0); assert.equal(report.missingTraces, 0);
    assert.equal(report.controls.length, protocol.repetitions);
    assert.equal(report.repetitions.length, protocol.repetitions);
    assert.deepEqual(report.attempts, ['CONTROL', 'TRACE'].flatMap(phase => Array.from(
      { length: protocol.repetitions }, (_, index) => ({ phase, repetition: index + 1, status: 'PASS' }))));
    for (const [index, repetition] of report.repetitions.entries()) {
      const control = report.controls[index], { traced, replay } = repetition;
      assert.equal(repetition.repetition, index + 1);
      assert.deepEqual(repetition.control, control);
      verifyRoot(control); verifyRoot(traced);
      assert.deepEqual(traced.selectedItemIds, control.selectedItemIds, 'Instrumentation changed selected identities');
      assert.equal(traced.availability, control.availability);
      assert.equal(traced.continuationState, control.continuationState);
      assert.equal(traced.candidates, control.candidates);
      assert.equal(traced.acquisitionCalls, 500);
      assert.ok(Number.isInteger(traced.availabilityCalls) && traced.availabilityCalls > 0);
      assert.equal(traced.functionTiming.skipDecision.calls, traced.acquisitionCalls + traced.availabilityCalls);
      assert.equal(replay.calls.length, traced.functionTiming.skipDecision.calls);
      for (const [scope, expected] of [['ACQUISITION', 500], ['AVAILABILITY', traced.availabilityCalls]]) {
        const calls = replay.calls.filter(call => call.scope === scope);
        assert.equal(calls.length, expected);
        assert.ok(calls.every(call => call.profileId === replay.input.scope.profileId
          && Number.isFinite(Date.parse(call.cutoff))));
      }
      assert.equal(replay.rows, 500); assert.equal(replay.exactRowsEqual, true);
      sha(replay.rowsSha256);
      assert.equal(replay.clockWitnessPrecision, 'POSTGRES_TIMESTAMP_MICROSECONDS');
      assert.equal(replay.invalidClockRejections, 2);
      assert.equal(replay.availabilityReplayResult, replay.availabilityObserved.remaining);
      for (const field of ['baselineAcquisitionPlan', 'candidateAcquisitionPlan', 'availabilityReplayPlan']) {
        assert.equal(replay[field].length, 1);
        assert.ok(replay[field][0].Plan && typeof replay[field][0].Plan === 'object', 'Missing diagnostic query plan');
      }
    }
  }
  assert.notEqual(definitions.get('BASELINE'), definitions.get('CANDIDATE'), 'Candidate body must contain the declared forward');
  return { status: 'PASS', admission: 'NONE',
    referenceRuleChecks: { ...checks, emptyHistory: emptyChecks,
      interpretation: 'DESCRIPTIVE_ONLY_NEW_DIAGNOSTIC_PROTOCOL_NO_V1_ADMISSION' },
    interpretation: 'SAME_WORKER_SAME_VARIANT_CONTROLS_NO_POOLED_QUANTILES_NO_CAUSAL_TIMING_ADMISSION',
    variants: ['BASELINE', 'CANDIDATE'].map(variant => {
      const counterparts = runs.filter(run => run.variant === variant);
      assert.equal(counterparts.length, 3);
      const observations = counterparts.map(run => {
        const report = run.skipCallDiagnostics;
        return { run: run.index, originalRootCalls: report.originalSample.functionTiming.skipDecision.calls,
          controlRootRangeMs: range(report.controls.map(control => control.functionTiming.root.totalMs)),
          tracedRootRangeMs: range(report.repetitions.map(({ traced }) => traced.functionTiming.root.totalMs)),
          controls: report.controls.map((control, index) => ({ repetition: index + 1,
            calls: control.functionTiming.skipDecision.calls, rootMs: control.functionTiming.root.totalMs })),
          traces: report.repetitions.map(({ repetition, traced }) => ({ repetition,
            calls: traced.functionTiming.skipDecision.calls, acquisitionCalls: traced.acquisitionCalls,
            availabilityCalls: traced.availabilityCalls, rootMs: traced.functionTiming.root.totalMs })) };
      });
      const controls = observations.flatMap(observation => observation.controls);
      const traces = observations.flatMap(observation => observation.traces);
      return { variant, stacks: counterparts.length, observations,
        originalRootCallRange: range(observations.map(observation => observation.originalRootCalls)),
        controlCallRange: range(controls.map(observation => observation.calls)),
        tracedCallRange: range(traces.map(observation => observation.calls)),
        acquisitionCallRange: range(traces.map(observation => observation.acquisitionCalls)),
        availabilityCallRange: range(traces.map(observation => observation.availabilityCalls)),
        controlRootRangeMs: range(controls.map(observation => observation.rootMs)),
        tracedRootRangeMs: range(traces.map(observation => observation.rootMs)),
        affectedTimingCohorts: affected.map(scope => {
          const observations = counterparts.map(run => {
            const collection = scope.history === 'EMPTY' ? run.performance : run.historyPerformance;
            const cohort = collection.cohorts.find(cohort => (cohort.skipHistory ?? 'EMPTY') === scope.history
              && cohort.catalogSize === 1000 && cohort.operation === scope.operation && cohort.requestKind === scope.requestKind);
            const { p50, p95 } = cohort.summary.metrics.executionMs;
            return { run: run.index, p50Ms: p50, p95Ms: p95 };
          });
          return { ...scope, catalogSize: 1000, observations,
            p50RangeMs: range(observations.map(observation => observation.p50Ms)),
            p95RangeMs: range(observations.map(observation => observation.p95Ms)) };
        }) };
    }) };
}
