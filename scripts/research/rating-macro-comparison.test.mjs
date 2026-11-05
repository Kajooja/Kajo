import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compareRatingSubjects, checkRatingComparison, decideBookDevelopment } from './rating-macro-comparison.mjs';
import { verifyBookExclusion } from './evaluate-books.mjs';

const protocol = JSON.parse(await readFile('research/manifests/book-genome-development-v2.json', 'utf8'));
const opts = { ...protocol, bootstrapReplicates: 500, seed: 'artificial-comparison' };
const row = (user, item, control, challenger) => ({ user, item, actual: 5,
  prediction: { values: { 'item-mean': control, 'profile-offset': challenger } } });

test('equal-subject error and paired bootstrap resist prolific-subject dominance', () => {
  const data = [...Array.from({ length: 100 }, (_, i) => row(0, i, 6, 5)), row(1, 0, 8, 7)];
  const result = compareRatingSubjects(data, opts);
  assert.equal(result.losses.control.macroRmse10, Math.sqrt(5));
  assert.equal(result.losses.challenger.macroRmse10, Math.sqrt(2));
  assert.equal(result.losses.control.macroMae10, 2);
  assert.equal(result.losses.challenger.macroMae10, 1);
  assert.deepEqual(result, compareRatingSubjects([...data].reverse(), opts));
  const balanced = compareRatingSubjects([row(0, 0, 6, 5), row(1, 0, 8, 7)], opts);
  assert.deepEqual(result.losses, balanced.losses);
  assert.deepEqual(result.pairedRmseDelta95, balanced.pairedRmseDelta95);
  assert.ok(result.pairedRmseDelta95[1] < 0);
});

test('missing, nonfinite, duplicate and under-supported pairs fail instead of becoming coverage', () => {
  const data = [row(0, 0, 6, 5), row(1, 0, 8, 7)];
  for (const bad of [undefined, NaN, Infinity, -1, 11]) {
    assert.throws(() => compareRatingSubjects([row(0, 0, bad, 5), data[1]], opts), /paired prediction/);
  }
  assert.throws(() => compareRatingSubjects([...data, data[0]], opts), /Duplicate/);
  assert.throws(() => compareRatingSubjects([data[0]], opts), /subject budget/);
  assert.throws(() => compareRatingSubjects([], opts), /row budget/);
});

test('validation decision requires gain, interval, MAE and complete coverage; ties keep control', () => {
  const c = compareRatingSubjects([row(0, 0, 6, 5), row(1, 0, 8, 7)], opts);
  assert.equal(checkRatingComparison(c, protocol.decision).passed, true);
  for (const changes of [{ macroRmseDelta10: -.01 }, { pairedRmseDelta95: [-.1, 0] },
    { macroMaeDelta10: .03 }, { predictionCoverage: .99 }]) {
    assert.equal(checkRatingComparison({ ...c, ...changes }, protocol.decision).passed, false);
  }
  const tied = compareRatingSubjects([row(0, 0, 6, 6), row(1, 0, 8, 8)], opts);
  assert.deepEqual(tied.pairedRmseDelta95, [0, 0]);
  assert.equal(checkRatingComparison(tied, protocol.decision).passed, false);
});

test('held-out success cannot replace failed validation; every cold guard is mandatory', () => {
  const c = compareRatingSubjects([row(0, 0, 6, 5), row(1, 0, 8, 7)], opts);
  const selection = { selected: protocol.challenger, eligibility: checkRatingComparison(c, protocol.decision) };
  const cold = Object.fromEntries(protocol.coldEvidenceBudgets.map(n => [n, { ...c, equalControlEveryTarget: n === 0 }]));
  const accepted = decideBookDevelopment(selection, c, cold, protocol);
  assert.equal(accepted.disposition, 'RETAIN_PROFILE_OFFSET_FOR_RESEARCH');
  assert.equal(accepted.qualityAdmission, 'NONE'); assert.equal(accepted.servingActivation, 'NONE');
  const rejected = decideBookDevelopment({ selected: protocol.control, eligibility: { passed: false } }, c, cold, protocol);
  assert.equal(rejected.disposition, 'RETAIN_ITEM_MEAN_CONTROL');
  for (const budget of [5, 10, 20]) {
    const bad = { ...cold, [budget]: { ...cold[budget], macroRmseDelta10: .051 } };
    assert.equal(decideBookDevelopment(selection, c, bad, protocol).disposition, 'RETAIN_ITEM_MEAN_CONTROL');
  }
  assert.equal(decideBookDevelopment(selection, c, { ...cold, 0: { ...cold[0], equalControlEveryTarget: false } }, protocol).disposition, 'RETAIN_ITEM_MEAN_CONTROL');
  const missing = { ...cold }; delete missing[10];
  assert.throws(() => decideBookDevelopment(selection, c, missing, protocol), /Incomplete/);
});

test('private exclusion witness is hash-bound and prevents every prior subject including zero', () => {
  const bytes = Buffer.from([0, 17].map(user_id => JSON.stringify({ record: { user_id } })).join('\n') + '\n');
  const expected = { sha256: createHash('sha256').update(bytes).digest('hex'), subjects: 2, ratings: 2 };
  assert.equal(verifyBookExclusion(bytes, expected, [{ user: 1 }]).overlapSubjects, 0);
  for (const user of [0, 17]) assert.throws(() => verifyBookExclusion(bytes, expected, [{ user }]), /overlap/);
  assert.throws(() => verifyBookExclusion(Buffer.concat([bytes, bytes]), expected, []), /integrity/);
  assert.throws(() => verifyBookExclusion(bytes, { ...expected, subjects: 3 }, []), /subject count/);
});
