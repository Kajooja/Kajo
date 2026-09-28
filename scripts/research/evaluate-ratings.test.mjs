import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { partitionRatings, boundedPrefix, evaluateWindow, chooseOnValidation, digest } from './evaluate-ratings.mjs';
import { fitRatingArtifact, ratingVariants } from '@kajo/prediction-engine/research';
import { interpretMovieLensRating, movieLensTarget } from '@kajo/prediction-engine/adapters/movielens';

const protocol = JSON.parse(await readFile(new URL('../../research/manifests/movielens-small-d2.json', import.meta.url), 'utf8'));
const source = { datasetId: 'movielens', releaseId: 'ml-32m', archiveSha256: 'e'.repeat(64), purpose: 'NONCOMMERCIAL_RESEARCH_ONLY' };
const row = (u, i, t, rating = i % 2 ? 2 : 4) => interpretMovieLensRating({ userId: String(u), movieId: String(i), timestamp: t, rating }, source);
const rows = Array.from({ length: 15 }, (_, i) => Array.from({ length: 20 }, (_, u) => row(u + 1, i + 1, (i + 1) * 10))).flat();
const small = { ...protocol, models: { ...protocol.models, factorization: { ...protocol.models.factorization, dimensions: 3, epochs: 2 } },
  metrics: { ...protocol.metrics, bootstrapReplicates: 20 } };
const fit = training => fitRatingArtifact(training, { id: 'invented-runner-fixture', sourceId: 'movielens:ml-32m',
  manifestId: `movielens:ml-32m:sha256:${source.archiveSha256}`, subjectIds: [...new Set(training.map(r => r.subjectId))],
  trainBefore: 110000, target: movieLensTarget, config: small.models });

test('global temporal partitions and held-out subject membership are label-blind and keep ties intact', () => {
  const first = partitionRatings(rows, protocol), changed = partitionRatings(rows.map(r => ({ ...r,
    measurement: { status: 'observed', value: 0.5 }, raw: { ...r.raw, value: 0.5 } })), protocol);
  assert.equal(first.trainBefore, changed.trainBefore); assert.equal(first.testFrom, changed.testFrom);
  assert.deepEqual(first.heldOut, changed.heldOut); assert.equal(first.heldOut.length, 4);
  assert.equal(first.parts.train.length + first.parts.validation.length + first.parts.test.length + first.parts.heldout.length, rows.length);
  const held = new Set(first.heldOut);
  for (const name of ['train', 'validation', 'test']) assert.ok(first.parts[name].every(r => !held.has(r.subjectId)));
  assert.ok(first.parts.train.every(r => r.availableAt < first.trainBefore));
  assert.ok(first.parts.validation.every(r => r.occurredAt >= first.trainBefore && r.availableAt < first.testFrom));
  assert.ok(first.parts.test.every(r => r.occurredAt >= first.testFrom));
  assert.throws(() => partitionRatings(rows.map(r => ({ ...r, occurredAt: 0, availableAt: 0 })), protocol), /distinct/);
});
test('cold prefixes never split an oversized group or reveal a test-boundary group', () => {
  const history = [row(1, 1, 10), row(1, 2, 10), row(1, 3, 10), row(1, 4, 20), row(1, 5, 20), row(1, 6, 30)];
  assert.equal(boundedPrefix(history, 2, 30000).length, 0);
  assert.equal(boundedPrefix(history, 4, 30000).length, 3);
  assert.equal(boundedPrefix(history, 5, 30000).length, 5);
  assert.equal(boundedPrefix(history, 20, 20000).length, 3);
});
test('prequential scoring excludes every tied current label and updates only strictly later state', () => {
  const a = fit(rows.filter(r => r.occurredAt < 110000)), before = digest(a);
  const targets = [row(100, 11, 120, 1), row(100, 12, 120, 2), row(100, 13, 130, 3)];
  const changed = [row(100, 11, 120, 5), ...targets.slice(1)];
  const score = (data, prequential) => evaluateWindow(a, [], data, { prequential, protocol: small });
  const lines = result => result.journal.trim().split('\n').map(s => JSON.parse(s).slice(4));
  const first = lines(score(targets, true)), second = lines(score(changed, true));
  assert.deepEqual(first.slice(0, 2), second.slice(0, 2));
  assert.notDeepEqual(first[2], second[2]);
  assert.deepEqual(lines(score(targets, false)), lines(score(changed, false)));
  assert.equal(digest(a), before, 'no global refit or memory insertion during test');
});
test('built-engine integration uses a common denominator and paired, repeatable subject uncertainty', () => {
  const training = rows.filter(r => r.occurredAt < 110000), a = fit(training);
  const targets = rows.filter(r => r.occurredAt >= 110000).concat([row(100, 999, 160)]);
  const first = evaluateWindow(a, training, targets, { protocol: small });
  const second = evaluateWindow(a, training, targets, { protocol: small });
  assert.deepEqual(first.metrics, second.metrics); assert.equal(digest(first.journal), digest(second.journal));
  for (const variant of ratingVariants) {
    assert.equal(first.metrics.all[variant].rows, targets.length);
    assert.equal(first.metrics['item-cold'][variant].rows, targets.length);
    assert.equal(first.metrics.all[variant].subjects, 21);
    assert.equal(first.metrics.all[variant].predictionCoverage, 1);
    assert.ok(first.metrics.all[variant].ci95SubjectBootstrap.rmse.length === 2);
  }
  assert.deepEqual(first.metrics.all['state-static'].ci95SubjectBootstrap.pairedRmseDelta, [0, 0]);
  const selection = chooseOnValidation(first, protocol);
  assert.equal(selection.finalLabelsUsed, false);
  assert.equal(selection.reference, 'state-static');
  assert.equal(selection.selected, chooseOnValidation(second, protocol).selected);
});
