import assert from 'node:assert/strict';
import { performanceComparisonProtocol, summarizePerformanceComparison } from './native-performance-comparison.mjs';
import { verifyPerformanceCollection } from './native-performance-series.mjs';

export function skipHistoryComparisonProtocol() {
  const original = performanceComparisonProtocol();
  return { version: 'native-skip-history-envelope-v1', order: original.order,
    installation: 'UNCHANGED_53_ENTRY_PREDECESSOR_VERSUS_SINGLE_54TH_FORWARD',
    emptyHistory: original,
    historyRegression: original.regression,
    historyEffect: 'NO_MINIMUM_SPEEDUP_REQUIRED_EVERY_COHORT_EVERY_PAIR_MUST_AVOID_REGRESSION',
    mechanism: 'CATALOGUE_HISTORY_EQUAL_CALLS_OFF_CATALOGUE_DISCOVERY_MINUS_500_TASTE_UNCHANGED',
    resources: 'NO_CANDIDATE_TEMP_READS_OR_WRITES',
    orderWithinStack: ['EMPTY_HISTORY_BASELINE', 'EMPTY_HISTORY_DIAGNOSTICS', 'HISTORY_BASELINE', 'HISTORY_DIAGNOSTICS'],
    decision: 'EMPTY_HISTORY_RULES_AND_ALL_HISTORY_PAIRS_PASS_OTHERWISE_NOT_ADMITTED',
    limits: 'TWO_DECLARED_SYNTHETIC_HISTORIES_NO_PRODUCTION_PHONE_QUALITY_OR_TAIL_ADMISSION' };
}

export function summarizeSkipHistoryComparison(runs) {
  // Reuse the original prefix, worker, source and empty-history validators.
  const emptyHistory = summarizePerformanceComparison(runs);
  const protocol = skipHistoryComparisonProtocol();
  const fixture = runs[0].historyPerformance?.historyFixtureSha256;
  for (const run of runs) for (const [field, diagnostic] of [['historyPerformance', false], ['historyDiagnostics', true]]) {
    const collection = run[field];
    verifyPerformanceCollection(collection, diagnostic, true);
    for (const key of ['sourceSha256', 'fixtureSha256', 'canonicalTablesVerified']) {
      assert.equal(collection[key], run.performance[key], 'History collection changed its source or installation');
    }
    assert.equal(collection.historyFixtureSha256, fixture, 'History fixture changed within comparison');
    const { observedAt, ...settings } = collection.environment;
    const { observedAt: originalTime, ...originalSettings } = run.performance.environment;
    assert.ok(Number.isFinite(Date.parse(observedAt)) && Number.isFinite(Date.parse(originalTime)));
    assert.deepEqual(settings, originalSettings);
  }
  const pairs = [];
  for (let n = 0; n < runs.length; n += 2) {
    const pair = runs.slice(n, n + 2), before = pair.find(r => r.variant === 'BASELINE'), after = pair.find(r => r.variant === 'CANDIDATE');
    const cohorts = before.historyPerformance.cohorts.map((b, i) => {
      const c = after.historyPerformance.cohorts[i];
      assert.deepEqual(c.historyInventory, b.historyInventory);
      assert.equal(c.samples[0].candidates, b.samples[0].candidates, 'History candidate count changed');
      const b50 = b.summary.metrics.executionMs.p50, c50 = c.summary.metrics.executionMs.p50;
      const budget = protocol.historyRegression[b.requestKind];
      const allowedIncreaseMs = Math.max(budget.maximumP50IncreaseMs, b50 * budget.maximumP50IncreaseFraction);
      return { skipHistory: b.skipHistory, catalogSize: b.catalogSize, operation: b.operation, requestKind: b.requestKind,
        baselineP50Ms: b50, candidateP50Ms: c50, increaseMs: c50 - b50, allowedIncreaseMs,
        baselineP95Ms: b.summary.metrics.executionMs.p95, candidateP95Ms: c.summary.metrics.executionMs.p95,
        regressionPass: c50 - b50 <= allowedIncreaseMs,
        resourcePass: c.samples.every(s => s.tempReadBlocks === 0 && s.tempWrittenBlocks === 0) };
    });
    const mechanisms = before.historyDiagnostics.cohorts.map((b, i) => {
      const c = after.historyDiagnostics.cohorts[i];
      assert.deepEqual(c.historyInventory, b.historyInventory);
      assert.equal(c.samples[0].candidates, b.samples[0].candidates);
      const bt = b.samples[0].functionTiming.skipDecision, ct = c.samples[0].functionTiming.skipDecision;
      assert.notEqual(bt, undefined); assert.notEqual(ct, undefined);
      const baselineCalls = bt?.calls ?? 0, candidateCalls = ct?.calls ?? 0;
      const expectedReduction = b.skipHistory === 'OFF_CATALOGUE_HISTORY' && b.operation.startsWith('discovery-')
        ? b.catalogSize / 2 : 0;
      return { skipHistory: b.skipHistory, catalogSize: b.catalogSize, operation: b.operation,
        baselineCalls, candidateCalls, expectedReduction, pass: baselineCalls - candidateCalls === expectedReduction };
    });
    pairs.push({ pair: n / 2 + 1, baselineRun: before.index, candidateRun: after.index, cohorts, mechanisms,
      accepted: cohorts.every(c => c.regressionPass && c.resourcePass) && mechanisms.every(m => m.pass) });
  }
  return { status: 'PASS', decision: emptyHistory.decision === 'ADMITTED_IN_DECLARED_SYNTHETIC_SCOPE' && pairs.every(p => p.accepted)
    ? 'ADMITTED_IN_DECLARED_HISTORY_ENVELOPE' : 'NOT_ADMITTED',
  plannedMeasurements: 2880, warmupsCompleted: 288, diagnosticObservations: 72, emptyHistory, pairs };
}
