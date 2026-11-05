import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fitResponseBase, scoreResponse, partitionMovies, coldMoviePrefix, movieRecords, decideResponse } from './evaluate-response.mjs';
import { fitStaticRatings, predictStaticRatings } from '@kajo/prediction-engine/research-static';
import { interpretBookGenomeRating, bookGenomeStaticSpec } from '@kajo/prediction-engine/adapters/book-genome';
const protocol = JSON.parse(await readFile(new URL('../../research/manifests/rating-response-spread-v1.json', import.meta.url)));
const row = (u, i, value, at = null) => ({ user: u, item: i, value, original: value / 2, at });
test('location control exactly matches accepted static engine on identical evidence', () => {
  const training = Array.from({ length: 100 }, (_, i) => row(Math.floor(i / 20), i % 20, (i % 5 + 1) * 2));
  const model = fitResponseBase(training, protocol, 'book');
  const adapted = training.map(r => interpretBookGenomeRating({ user_id: r.user, item_id: r.item, rating: r.original }, bookGenomeStaticSpec.snapshotId));
  const old = fitStaticRatings(adapted, bookGenomeStaticSpec);
  const target = interpretBookGenomeRating({ user_id: 0, item_id: 99, rating: 1 }, bookGenomeStaticSpec.snapshotId);
  const expected = predictStaticRatings(old, target.subjectId, adapted.filter(r => r.subjectId === target.subjectId), [target.objectId])[0];
  const result = scoreResponse(model, [row(0, 99, 2)], training, protocol, 'book');
  assert.equal(result.journal[0].prediction.values['profile-offset'], expected.values['profile-offset']);
  assert.equal(model.global, old.globalMean);
});
test('global temporal splits are label-blind and keep held-out users out of shared fits', () => {
  const p = structuredClone(protocol); p.cohortSubjects = 4; p.heldOutSubjects = 1;
  const { trainBefore: a, testFrom: b } = p.movie.cohort.temporalSupport;
  const rows = Array.from({ length: 4 }, (_, u) => [row(u, 1, 2, a - 1), row(u, 2, 4, a), row(u, 3, 6, b - 1), row(u, 4, 8, b)]).flat();
  const parts = partitionMovies(rows, p);
  const other = partitionMovies(rows.map(r => ({ ...r, value: 10 })), p);
  for (const k of Object.keys(parts)) assert.deepEqual(parts[k].map(r => [r.user, r.item]), other[k].map(r => [r.user, r.item]));
  assert.equal(parts.train.length, 3); assert.equal(parts.validation.length, 6); assert.equal(parts.test.length, 3);
  const cold = new Set(parts.coldTargets.map(r => r.user));
  assert.ok(parts.train.concat(parts.validation, parts.test).every(r => !cold.has(r.user)));
  assert.equal(parts.coldVisible.length, 3);
});
test('cold prefixes retain complete contiguous groups and never leak a cutoff/equal-time answer', () => {
  const rows = [row(1, 1, 2, 1), row(1, 2, 4, 2), row(1, 3, 6, 2), row(1, 4, 8, 3)];
  assert.deepEqual(coldMoviePrefix(rows, 2, 4).map(r => r.item), [4]);
  assert.deepEqual(coldMoviePrefix(rows, 3, 4).map(r => r.item), [2, 3, 4]);
  assert.deepEqual(coldMoviePrefix(rows, 0, 4), []);
  assert.throws(() => coldMoviePrefix(rows, 5, 3), /Future/);
  const model = fitResponseBase([row(0, 1, 2, 1)], protocol, 'movie');
  assert.throws(() => scoreResponse(model, [row(2, 9, 6, 2)], [row(2, 3, 4, 2)], protocol, 'movie'), /equal-time/);
  assert.throws(() => fitResponseBase([row(0, 1, 2, protocol.movie.cohort.temporalSupport.trainBefore)], protocol, 'movie'), /cutoff/);
});
test('target labels cannot affect forecasts or fitted parameters; leakage and invented dates are rejected', () => {
  const train = [row(0, 1, 2), row(1, 2, 8)], model = fitResponseBase(train, protocol, 'book');
  const before = JSON.stringify(model), evidence = [row(2, 1, 10)];
  const low = scoreResponse(model, [row(2, 3, 2)], evidence, protocol, 'book');
  const high = scoreResponse(model, [row(2, 3, 10)], evidence, protocol, 'book');
  assert.deepEqual(low.journal[0].prediction, high.journal[0].prediction); assert.equal(JSON.stringify(model), before);
  assert.throws(() => scoreResponse(model, [row(2, 1, 2)], evidence, protocol, 'book'), /leakage/);
  assert.throws(() => scoreResponse(model, [row(0, 1, 2)], [], protocol, 'book'), /leakage/);
  assert.throws(() => scoreResponse(model, [row(2, 3, 2, 0)], evidence, protocol, 'book'), /Invented/);
});
test('movie input preserves original grades/timestamps and rejects fabricated zeros or duplicate identities', () => {
  const data = [{ userId: '1', movieId: '1', rating: .5, timestamp: 1 }, { userId: '1', movieId: '2', rating: 5, timestamp: 2 }, { userId: '1', movieId: '3', rating: 3, timestamp: 3 }];
  const source = { budgets: { maxCohortRatings: 100 }, cohort: { size: 1, temporalSupport: { trainBefore: 2, testFrom: 3, minimumTrainRatings: 1, minimumValidationRatings: 1, minimumTestRatings: 1, maximumHistoryRatings: 10 } } };
  const parse = xs => { const bytes = Buffer.from(xs.map(r => JSON.stringify(r)).join('\n') + '\n'); return movieRecords(bytes, {
    outputFiles: { 'ratings.jsonl': { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length } },
    sourceTimestampRange: { max: 3 }, cohort: { ratings: xs.length } }, source); };
  assert.equal(parse(data)[0].original, .5); assert.equal(parse(data)[0].value, 1); assert.equal(parse(data)[0].at, 1);
  assert.throws(() => parse([{ ...data[0], rating: 0 }, ...data.slice(1)]));
  assert.throws(() => parse([data[0], data[0], ...data.slice(1)]));
  assert.throws(() => parse([{ ...data[0], timestamp: null }, ...data.slice(1)]));
});
test('any failed domain gate retains control, while insufficient slope support is reported explicitly', () => {
  const passing = { macroRmseDelta10: -.03, macroMaeDelta10: 0, pairedRmseDelta95: [-.05, -.01], predictionCoverage: 1, equalControlEveryTarget: true };
  const selection = { selected: protocol.challenger, eligibility: { passed: true } };
  const cold = Object.fromEntries(protocol.coldEvidenceBudgets.map(n => [n, passing]));
  const good = { regular: 100, cold20: 30 };
  assert.equal(decideResponse(selection, passing, cold, good, protocol).disposition, 'RETAIN_RESPONSE_SPREAD_FOR_RESEARCH');
  assert.equal(decideResponse(selection, passing, cold, { regular: 1, cold20: 30 }, protocol).disposition, 'INSUFFICIENT_SUPPORT_RETAIN_LOCATION');
  assert.equal(decideResponse(selection, { ...passing, macroRmseDelta10: -.001 }, cold, good, protocol).disposition, 'RETAIN_LOCATION_ONLY_CONTROL');
  assert.equal(decideResponse(selection, passing, { ...cold, 0: { ...passing, equalControlEveryTarget: false } }, good, protocol).disposition, 'RETAIN_LOCATION_ONLY_CONTROL');
});
