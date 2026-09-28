import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fitRatingArtifact, ratingVariants } from '@kajo/prediction-engine/research';
import { interpretMovieLensRating, movieLensTarget } from '@kajo/prediction-engine/adapters/movielens';
import { digest, partitionRatings } from './evaluate-ratings.mjs';
import { evaluatePrefixStudy, selectTemporalPrefix, verifyParentSplit } from './evaluate-prefixes.mjs';

// Invented records test code. No public dataset, research run or network request is used in CI.
const protocol = JSON.parse(await readFile(new URL('../../research/manifests/movielens-small-prefix-study.json', import.meta.url), 'utf8'));
const parent = JSON.parse(await readFile(new URL('../../research/manifests/movielens-small-d2.json', import.meta.url), 'utf8'));
const small = { ...parent, models: { ...parent.models, factorization: { ...parent.models.factorization, dimensions: 3, epochs: 3 } },
  metrics: { ...parent.metrics, bootstrapReplicates: 20 } };
const source = { datasetId: 'movielens', releaseId: 'ml-32m', archiveSha256: 'd'.repeat(64), purpose: 'NONCOMMERCIAL_RESEARCH_ONLY' };
const row = (u, i, t, rating = i % 2 ? 2 : 4) => interpretMovieLensRating({ userId: String(u), movieId: String(i), timestamp: t, rating }, source);
const training = Array.from({ length: 20 }, (_, i) => Array.from({ length: 6 }, (_, u) => row(u + 1, i + 1, i + 1))).flat();
const initial = [100, 101].flatMap(u => Array.from({ length: 15 }, (_, i) => row(u, i + 1, i + 1)));
const targets = [100, 101].flatMap(u => [row(u, 16, 22, 1), row(u, 17, 22, 2), row(u, 18, 23, 3), row(u, 19, 24, 4), row(u, 20, 25, 5)]);
const fit = () => fitRatingArtifact(training, { id: 'invented-prefix-study', sourceId: 'movielens:ml-32m',
  manifestId: `movielens:ml-32m:sha256:${source.archiveSha256}`, subjectIds: [...new Set(training.map(r => r.subjectId))],
  trainBefore: 21000, target: movieLensTarget, config: small.models });
const choose = (rows, budget, policy, asOf = 50000) => selectTemporalPrefix(rows,
  { subjectId: row(100, 1, 1).subjectId, budget, policy, asOf });

test('whole-group earliest/recent policies stop at the boundary without skipping or splitting', () => {
  const history = [row(100, 1, 1), row(100, 2, 1), row(100, 3, 2), row(100, 4, 3), row(100, 5, 3), row(100, 6, 3)];
  assert.deepEqual(choose(history, 3, 'earliest').rows, history.slice(0, 3));
  assert.deepEqual(choose(history, 3, 'recent').rows, history.slice(3));
  assert.equal(choose(history, 1, 'earliest').rows.length, 0);
  assert.equal(choose(history, 1, 'earliest').blockedGroupSize, 2);
  assert.equal(choose(history, 2, 'recent').rows.length, 0);
  assert.equal(choose(history, 2, 'recent').blockedGroupSize, 3);
  assert.equal(choose(history, 0, 'recent').blockedGroupSize, 0);
  assert.equal(choose(history, 0, 'recent').rows.length, 0);
  assert.deepEqual(choose(history, 5, 'recent').rows, history.slice(2));
  assert.deepEqual(choose(history, 20, 'recent').rows, history);
});

test('selectors exclude equal/future timestamps, reject foreign/unordered history and ignore values', () => {
  const history = [row(100, 1, 1), row(100, 2, 2), row(100, 3, 3), row(100, 4, 4)];
  for (const policy of ['earliest', 'recent']) {
    assert.deepEqual(choose(history, 20, policy, 3000).rows, history.slice(0, 2));
    const changed = history.map(r => ({ ...r, measurement: { status: 'observed', value: 0.5 } }));
    assert.deepEqual(choose(changed, 2, policy).rows.map(r => r.objectId), choose(history, 2, policy).rows.map(r => r.objectId));
    assert.throws(() => choose([...history, row(101, 5, 5)], 20, policy), /Foreign/);
    assert.throws(() => choose([...history].reverse(), 20, policy), /unordered/);
    assert.throws(() => choose(history, 21, policy), /budget/);
  }
});

test('parent split verification binds original identities, labels, cutoffs and every partition', () => {
  const rows = Array.from({ length: 15 }, (_, i) => Array.from({ length: 20 }, (_, u) => row(u + 1, i + 1, i + 1))).flat();
  const split = partitionRatings(rows, parent);
  const expected = { manifest: { protocol: parent, split: { trainBefore: split.trainBefore, testFrom: split.testFrom,
    membershipSha256: digest(JSON.stringify({ heldOut: split.heldOut, regularSubjects: split.regularSubjects }, null, 2) + '\n'),
    partitions: Object.fromEntries(Object.entries(split.parts).map(([name, records]) => [name,
      { rows: records.length, sha256: digest(records.map(r => JSON.stringify(r) + '\n').join('')) }])) } } };
  assert.equal(verifyParentSplit(rows, parent, expected).trainBefore, split.trainBefore);
  const changed = rows.map((r, i) => i ? r : { ...r, measurement: { status: 'observed', value: 0.5 } });
  assert.throws(() => verifyParentSplit(changed, parent, expected), /partition changed/);
  assert.throws(() => verifyParentSplit(rows, parent, { manifest: { ...expected.manifest, split: { ...expected.manifest.split, membershipSha256: '0'.repeat(64) } } }), /membership changed/);
  assert.throws(() => verifyParentSplit(rows, parent, { manifest: { ...expected.manifest, split: { ...expected.manifest.split, testFrom: 123 } } }), /cutoffs changed/);
  assert.throws(() => verifyParentSplit(rows, { ...parent, models: { ...parent.models, itemShrinkage: 20 } }, expected), /protocol\/configuration changed/);
});

test('all policies share exact targets, retain cold fallback and replay metrics/parameters without global mutation', () => {
  const a = fit(), before = digest(a), expanded = [...targets, row(101, 999, 26, 0.5)];
  const first = evaluatePrefixStudy(a, initial, expanded, protocol, small);
  const second = evaluatePrefixStudy(fit(), initial, expanded, protocol, small);
  const stable = result => JSON.parse(JSON.stringify(result, (key, value) => key === 'cost' ? undefined : value));
  assert.deepEqual(stable(first), stable(second)); assert.equal(digest(a), before);
  const hashes = new Set();
  for (const result of Object.values(first.results)) {
    hashes.add(result.targetIdentitySha256);
    for (const variant of ratingVariants) {
      assert.equal(result.metrics.all[variant].rows, expanded.length);
      assert.equal(result.metrics['item-cold'][variant].rows, 1);
      assert.equal(result.metrics.all[variant].predictionCoverage, 1);
    }
    assert.ok(result.prefix.queryWeighted.selectedRatings.max <= result.budget);
    assert.equal(result.prefix.targets, expanded.length);
  }
  assert.equal(hashes.size, 1);
  assert.deepEqual(first.results['recent-0'].metrics.all['state-static'].ci95SubjectBootstrap.pairedRmseDelta, [0, 0]);
  assert.equal(first.primary.rows, expanded.length);
  assert.equal(first.primary.minimumSubjectSupportMet, false);
});

test('current tied labels enter only later forecasts and never refit the global model', () => {
  const a = fit(), before = digest(a), changed = targets.map((r, i) => i ? r : row(100, 16, 22, 5));
  const first = evaluatePrefixStudy(a, initial, targets, protocol, small);
  const second = evaluatePrefixStudy(a, initial, changed, protocol, small);
  const predictions = journal => journal.trim().split('\n').map(line => JSON.parse(line).slice(4));
  for (const id of Object.keys(first.journals)) {
    assert.deepEqual(predictions(first.journals[id]).slice(0, 2), predictions(second.journals[id]).slice(0, 2));
  }
  assert.notDeepEqual(predictions(first.journals['recent-10'])[2], predictions(second.journals['recent-10'])[2]);
  assert.deepEqual(predictions(first.journals['earliest-10']), predictions(second.journals['earliest-10']));
  assert.equal(digest(a), before);
  assert.throws(() => evaluatePrefixStudy(a, initial, [row(1, 21, 22)], protocol, small), /global fit/);
  assert.throws(() => evaluatePrefixStudy(a, [...initial, row(100, 21, 22)], targets, protocol, small), /before training cutoff/);
});
