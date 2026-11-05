import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** Paired, equal-subject losses. Prolific readers cannot dominate this target. */
export function compareRatingSubjects(journal, { control, challenger, bootstrapReplicates, seed }) {
  assert.ok(journal.length > 0 && journal.length <= 100000, 'Comparison row budget');
  assert.ok(Number.isInteger(bootstrapReplicates) && bootstrapReplicates >= 100 && bootstrapReplicates <= 10000);
  assert.ok(typeof seed === 'string' && seed.length > 0 && seed.length <= 256);
  assert.ok(typeof control === 'string' && typeof challenger === 'string' && control !== challenger);
  const bySubject = new Map(), pairs = new Set();
  for (const row of journal) {
    assert.ok(Number.isSafeInteger(row.user) && row.user >= 0 && Number.isSafeInteger(row.item) && row.item >= 0);
    const key = `${row.user}:${row.item}`;
    assert.ok(!pairs.has(key), 'Duplicate comparison pair'); pairs.add(key);
    const values = [row.actual, row.prediction.values[control], row.prediction.values[challenger]];
    assert.ok(values.every(v => Number.isFinite(v) && v >= 0 && v <= 10), 'Missing or invalid paired prediction');
    const errors = values.slice(1).map(v => v - row.actual);
    const totals = bySubject.get(row.user) ?? [0, 0, 0, 0, 0];
    totals[0]++;
    for (let i = 0; i < 2; i++) { totals[1 + 2 * i] += errors[i] ** 2; totals[2 + 2 * i] += Math.abs(errors[i]); }
    bySubject.set(row.user, totals);
  }
  assert.ok(bySubject.size >= 2 && bySubject.size <= 500, 'Comparison subject budget');
  const subjects = [...bySubject].sort((a, b) => a[0] - b[0])
    .map(([, [n, ...losses]]) => losses.map(x => x / n));
  const summarize = sums => ({ control: { macroRmse10: Math.sqrt(sums[0] / subjects.length), macroMae10: sums[1] / subjects.length },
    challenger: { macroRmse10: Math.sqrt(sums[2] / subjects.length), macroMae10: sums[3] / subjects.length } });
  const observed = summarize(subjects.reduce((sum, x) => sum.map((s, i) => s + x[i]), [0, 0, 0, 0]));
  let state = createHash('sha256').update(seed).digest().readUInt32LE(0) || 1;
  const next = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const deltas = [];
  for (let b = 0; b < bootstrapReplicates; b++) {
    const sums = [0, 0, 0, 0];
    for (let i = 0; i < subjects.length; i++) {
      const losses = subjects[Math.floor(next() * subjects.length)];
      for (let k = 0; k < 4; k++) sums[k] += losses[k];
    }
    const sample = summarize(sums);
    deltas.push(sample.challenger.macroRmse10 - sample.control.macroRmse10);
  }
  deltas.sort((a, b) => a - b);
  const quantile = p => {
    const i = (deltas.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return deltas[lo] + (deltas[hi] - deltas[lo]) * (i - lo);
  };
  return { control, challenger, subjects: subjects.length, ratings: journal.length, losses: observed,
    macroRmseDelta10: observed.challenger.macroRmse10 - observed.control.macroRmse10,
    macroMaeDelta10: observed.challenger.macroMae10 - observed.control.macroMae10,
    pairedRmseDelta95: [quantile(.025), quantile(.975)],
    predictionCoverage: 1, bootstrapReplicates, bootstrapSeed: seed,
    interpretation: 'EQUAL_SUBJECT_PAIRED_DEVELOPMENT_COMPARISON_NOT_CALIBRATED_PERSONAL_CONFIDENCE' };
}

export function checkRatingComparison(comparison, rule) {
  assert.ok([rule.minMacroRmseGain10, rule.maxMacroMaeIncrease10].every(x => Number.isFinite(x) && x >= 0));
  assert.equal(rule.requiredPredictionCoverage, 1);
  assert.equal(rule.requireUpperPairedDeltaBelowZero, true);
  const checks = {
    usefulGain: comparison.macroRmseDelta10 <= -rule.minMacroRmseGain10,
    pairedInterval: comparison.pairedRmseDelta95[1] < 0,
    maeNoninferiority: comparison.macroMaeDelta10 <= rule.maxMacroMaeIncrease10,
    coverage: comparison.predictionCoverage === rule.requiredPredictionCoverage,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function decideBookDevelopment(selection, holdout, cold, protocol) {
  const holdoutChecks = checkRatingComparison(holdout, protocol.decision);
  assert.deepEqual(Object.keys(cold).map(Number), protocol.coldEvidenceBudgets, 'Incomplete cold guards');
  const coldChecks = Object.fromEntries(Object.entries(cold).map(([budget, c]) => [budget, {
    passed: c.predictionCoverage === 1 && (Number(budget) === 0
      ? c.equalControlEveryTarget === true
      : c.macroRmseDelta10 <= protocol.decision.maxColdMacroRmseIncrease10
        && c.macroMaeDelta10 <= protocol.decision.maxColdMacroMaeIncrease10),
    macroRmseDelta10: c.macroRmseDelta10, macroMaeDelta10: c.macroMaeDelta10,
  }]));
  const passes = selection.selected === protocol.challenger && selection.eligibility.passed
    && holdoutChecks.passed && Object.values(coldChecks).every(x => x.passed);
  return { disposition: passes ? 'RETAIN_PROFILE_OFFSET_FOR_RESEARCH' : 'RETAIN_ITEM_MEAN_CONTROL',
    validationEligible: selection.eligibility.passed, holdout: holdoutChecks, cold: coldChecks,
    qualityAdmission: 'NONE', servingActivation: 'NONE' };
}
