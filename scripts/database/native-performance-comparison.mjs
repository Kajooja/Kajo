import assert from 'node:assert/strict';
import { performanceRunIdentity, verifyPerformanceCollection } from './native-performance-series.mjs';

export const skipPrefilterMigration = '20261028081350_native_skip_acquisition_prefilter.sql';
export function performanceComparisonProtocol() {
  return {
    version: 'native-skip-prefilter-comparison-v1',
    migration: skipPrefilterMigration,
    order: ['BASELINE', 'CANDIDATE', 'CANDIDATE', 'BASELINE', 'BASELINE', 'CANDIDATE'],
    pairing: 'ADJACENT_RUNS_BC_CB_BC_NO_POOLED_QUANTILES',
    execution: 'SIX_SERIAL_FRESH_OWNED_STACKS_ONE_CI_JOB_PROCESS',
    diagnostics: 'AFTER_EACH_RUN_CLEANUP_SIX_SEPARATE_FRESH_OBSERVATIONS',
    target: { catalogSize: 1000, operations: ['discovery-personal-movie', 'discovery-shared-movie'],
      requestKind: 'fresh', minimumP50ReductionMs: 8, minimumP50ReductionFraction: 0.05 },
    regression: { fresh: { maximumP50IncreaseMs: 5, maximumP50IncreaseFraction: 0.05 },
      'exact-retry': { maximumP50IncreaseMs: 0.3, maximumP50IncreaseFraction: 0.10 },
      rule: 'LARGER_OF_ABSOLUTE_AND_RELATIVE_ALLOWANCE_EVERY_COHORT_EVERY_PAIR' },
    mechanism: 'DISCOVERY_SKIP_DECISION_CALLS_DROP_BY_MOVIE_CATALOGUE_SIZE_IN_EACH_DIAGNOSTIC_PAIR',
    resources: 'REPORT_EACH_RUN_BUFFER_WAL_COUNTERS_NO_NEW_TEMP_READS_OR_WRITES',
    decision: 'ALL_THREE_PAIRS_MUST_PASS_EFFECT_AND_REGRESSION_RULES_OTHERWISE_NOT_ADMITTED',
    limits: 'EXPLORATORY_P95_NO_TAIL_GATE_NO_PRODUCTION_SLO_PHONE_OR_QUALITY_CLAIM',
  };
}

// Both variants use the canonical installer. The only installation difference is
// this one forward; later forwards never silently enter this frozen comparison.
export function performanceComparisonInstallations(installation) {
  const index = installation.files.findIndex(file => file.name === skipPrefilterMigration);
  assert.ok(index > 0, 'Missing declared comparison forward');
  const prefix = count => ({ ...installation, files: installation.files.slice(0, count),
    history: installation.history.slice(0, count),
    manifest: { ...installation.manifest, files: installation.manifest.files.slice(0, count) } });
  return { BASELINE: prefix(index), CANDIDATE: prefix(index + 1) };
}

export function summarizePerformanceComparison(runs) {
  const protocol = performanceComparisonProtocol();
  assert.equal(runs.length, protocol.order.length, 'Incomplete comparison');
  assert.equal(new Set(runs.map(run => run.runtime.containerId)).size, runs.length, 'Stacks must be distinct');
  const identities = runs.map((run, index) => {
    assert.equal(run.index, index + 1);
    assert.equal(run.variant, protocol.order[index], 'Comparison order changed');
    verifyPerformanceCollection(run.performance);
    verifyPerformanceCollection(run.diagnostics, true);
    const identity = performanceRunIdentity(run);
    for (const field of ['sourceSha256', 'fixtureSha256', 'canonicalTablesVerified']) {
      assert.equal(run.diagnostics[field], run.performance[field]);
    }
    const { observedAt, ...settings } = run.diagnostics.environment;
    assert.ok(Number.isFinite(Date.parse(observedAt)));
    assert.deepEqual(settings, identity.settings);
    return identity;
  });
  const baseline = identities[0], candidate = identities[1];
  assert.deepEqual(candidate.manifest, { ...baseline.manifest,
    files: [...baseline.manifest.files, candidate.manifest.files.at(-1)] });
  assert.equal(candidate.manifest.files.at(-1).name, protocol.migration);
  assert.deepEqual(candidate.history, [...baseline.history, {
    version: protocol.migration.slice(0, 14), name: protocol.migration.slice(15, -4) }]);
  assert.match(candidate.manifest.files.at(-1).sha256, /^[0-9a-f]{64}$/);
  const runtimeIdentity = ({ manifest, history, applicationSnapshotSha256, ...identity }) => identity;
  assert.deepEqual(runtimeIdentity(candidate), runtimeIdentity(baseline), 'Benchmark sources, settings or worker differ');
  for (const [index, identity] of identities.entries()) {
    assert.deepEqual(identity, runs[index].variant === 'BASELINE' ? baseline : candidate,
      'A repeated variant changed source, installation or environment');
  }
  const pairs = [];
  for (let index = 0; index < runs.length; index += 2) {
    const pair = runs.slice(index, index + 2);
    const before = pair.find(run => run.variant === 'BASELINE'), after = pair.find(run => run.variant === 'CANDIDATE');
    const cohorts = before.performance.cohorts.map((b, i) => {
      const c = after.performance.cohorts[i];
      assert.equal(c.samples[0].candidates, b.samples[0].candidates, 'Candidate count changed');
      const b50 = b.summary.metrics.executionMs.p50, c50 = c.summary.metrics.executionMs.p50;
      const target = b.catalogSize === protocol.target.catalogSize && b.requestKind === protocol.target.requestKind
        && protocol.target.operations.includes(b.operation);
      const budget = protocol.regression[b.requestKind];
      const allowedIncreaseMs = Math.max(budget.maximumP50IncreaseMs, b50 * budget.maximumP50IncreaseFraction);
      const requiredReductionMs = target ? Math.max(protocol.target.minimumP50ReductionMs,
        b50 * protocol.target.minimumP50ReductionFraction) : null;
      const resourcePass = c.samples.every(sample => sample.tempReadBlocks === 0 && sample.tempWrittenBlocks === 0);
      return { catalogSize: b.catalogSize, operation: b.operation, requestKind: b.requestKind,
        baselineP50Ms: b50, candidateP50Ms: c50, reductionMs: b50 - c50,
        baselineP95Ms: b.summary.metrics.executionMs.p95, candidateP95Ms: c.summary.metrics.executionMs.p95,
        requiredReductionMs, allowedIncreaseMs, resourcePass,
        effectPass: !target || b50 - c50 >= requiredReductionMs, regressionPass: c50 - b50 <= allowedIncreaseMs };
    });
    const mechanisms = before.diagnostics.cohorts.map((b, i) => {
      const c = after.diagnostics.cohorts[i];
      assert.equal(c.samples[0].candidates, b.samples[0].candidates);
      const beforeTiming = b.samples[0].functionTiming.skipDecision;
      const afterTiming = c.samples[0].functionTiming.skipDecision;
      // null is explicitly reported absence from the complete tracked rows,
      // not absence from the truncated top-25 display.
      assert.notEqual(beforeTiming, undefined); assert.notEqual(afterTiming, undefined);
      const baselineCalls = beforeTiming?.calls ?? 0, candidateCalls = afterTiming?.calls ?? 0;
      const discovery = b.operation.startsWith('discovery-');
      return { catalogSize: b.catalogSize, operation: b.operation, baselineCalls, candidateCalls,
        pass: discovery ? baselineCalls - candidateCalls === b.catalogSize / 2 : baselineCalls === candidateCalls };
    });
    pairs.push({ pair: index / 2 + 1, baselineRun: before.index, candidateRun: after.index, cohorts, mechanisms,
      accepted: cohorts.every(c => c.effectPass && c.regressionPass && c.resourcePass) && mechanisms.every(m => m.pass) });
  }
  return { status: 'PASS', decision: pairs.every(pair => pair.accepted) ? 'ADMITTED_IN_DECLARED_SYNTHETIC_SCOPE' : 'NOT_ADMITTED',
    plannedMeasurements: 1440, warmupsCompleted: 144, diagnosticObservations: 36, pairs };
}
