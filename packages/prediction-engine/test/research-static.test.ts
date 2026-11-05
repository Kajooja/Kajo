import { expect, it } from 'vitest';
import type { Observation } from '../src/contracts.js';
import { fitStaticRatings, predictStaticRatings, type StaticResearchRating } from '../src/research-static.js';
import { interpretBookGenomeRating, bookGenomeRatingsSha256, bookGenomeStaticSpec } from '../src/adapters/book-genome.js';

const book = (u: number, i: number, rating: number) =>
  interpretBookGenomeRating({ user_id: u, item_id: i, rating }, bookGenomeRatingsSha256);
const training = [book(0, 1, 1), book(0, 2, 3), book(1, 1, 5)];

it('retains source zero IDs, all original grades and unknown time without constructing temporal evidence', () => {
  for (let grade = 1; grade <= 5; grade++) {
    const row = book(0, 0, grade);
    expect(row.original).toEqual({ value: grade, min: 1, max: 5 });
    expect(row.value).toBe(grade * 2);
    expect(row.sourceOccurredAt).toBeNull();
    // @ts-expect-error An undated record cannot enter the E1 temporal contract.
    const temporal: Observation = row;
    expect(temporal.occurredAt).toBeUndefined();
    expect(temporal.availableAt).toBeUndefined();
    expect(row.subjectId).toBe('grouplens-book-genome:2021-12-30:user:0');
  }
});

it.each([0, -1, 6, 2.5, null, undefined, '5', NaN, Infinity, true])('does not turn unsupported %s into an observed grade', rating => {
  expect(() => interpretBookGenomeRating({ user_id: 1, item_id: 1, rating }, bookGenomeRatingsSha256)).toThrow();
});

it('rejects changed source, invented times, ambiguous fields and unsafe identities', () => {
  expect(() => interpretBookGenomeRating({ user_id: 1, item_id: 1, rating: 5 }, 'a'.repeat(64))).toThrow('snapshot');
  for (const change of [{ user_id: '1' }, { item_id: -1 }, { user_id: Number.MAX_SAFE_INTEGER + 1 },
    { timestamp: 0 }, { rating10: 10 }]) {
    expect(() => interpretBookGenomeRating({ user_id: 1, item_id: 1, rating: 5, ...change }, bookGenomeRatingsSha256)).toThrow();
  }
});

it('matches independent hand arithmetic and backs off on unsupported items and empty evidence', () => {
  const model = fitStaticRatings(training, bookGenomeStaticSpec);
  expect(model.globalMean).toBe(6);
  const visible = [book(2, 1, 5)], subject = visible[0]!.subjectId;
  const result = predictStaticRatings(model, subject, visible, [book(2, 99, 1).objectId])[0]!;
  expect(result.values['global-mean']).toBe(6);
  expect(result.values['item-mean']).toBe(6);
  expect(result.values['profile-offset']).toBeCloseTo(6 + 4 / 11, 14);
  expect(result.itemSupport).toBe(0);
  expect(result.visibleSupport).toBe(1);
  expect(predictStaticRatings(model, subject, [], [book(2, 99, 1).objectId])[0]!.values['profile-offset']).toBe(6);
});

it('guards duplicate, target, subject, source, scale and time leakage', () => {
  const model = fitStaticRatings(training, bookGenomeStaticSpec), target = book(2, 4, 5), visible = book(2, 3, 4);
  expect(() => fitStaticRatings([...training, training[0]!], bookGenomeStaticSpec)).toThrow('Duplicate');
  expect(() => predictStaticRatings(model, target.subjectId, [target], [target.objectId])).toThrow('Target');
  expect(() => predictStaticRatings(model, training[0]!.subjectId, [], [training[0]!.objectId])).toThrow('Target');
  expect(() => predictStaticRatings(model, target.subjectId, [visible, visible], [target.objectId])).toThrow('duplicate');
  expect(() => predictStaticRatings(model, target.subjectId, [book(3, 3, 4)], [target.objectId])).toThrow('subject');
  for (const change of [{ sourceId: 'movielens:2018' }, { snapshotId: 'b'.repeat(64) },
    { subjectId: 'native:person' }, { objectId: 'native:item' }, { sourceOccurredAt: 0 },
    { value: 0 }, { original: { value: 4, min: 0, max: 5 } }]) {
    expect(() => fitStaticRatings([{ ...visible, ...change } as StaticResearchRating], bookGenomeStaticSpec)).toThrow();
  }
  expect(() => predictStaticRatings(model, target.subjectId, [], [target.objectId, target.objectId])).toThrow('Target');
});

it('supports a non-media outcome including genuine zero without changing native 0–10 semantics', () => {
  const spec = { ...bookGenomeStaticSpec, sourceId: 'maintenance:v1', originalScale: { min: 0, max: 10 },
    scale: { min: 0, max: 10 }, multiplier: 1 };
  const row = (n: number): StaticResearchRating => ({ kind: 'undated-external-rating', sourceId: spec.sourceId,
    snapshotId: spec.snapshotId, sourceOccurredAt: null, subjectId: 'maintenance:v1:machine:1',
    objectId: `maintenance:v1:setting:${n}`, value: n, original: { min: 0, max: 10, value: n } });
  const ratings = Array.from({ length: 11 }, (_, n) => row(n));
  const model = fitStaticRatings(ratings, spec);
  expect(model.trainingCount).toBe(11);
  expect(model.globalMean).toBe(5);
  expect(predictStaticRatings(model, 'maintenance:v1:machine:2', [], ['maintenance:v1:setting:new'])[0]!.values['profile-offset']).toBe(5);
});

it('copies and freezes fitted evidence and never learns from target labels', () => {
  const rows = structuredClone(training), spec = { ...bookGenomeStaticSpec, scale: { ...bookGenomeStaticSpec.scale } };
  const model = fitStaticRatings(rows, spec), serialized = JSON.stringify(model);
  rows.splice(0); spec.scale.min = -100;
  predictStaticRatings(model, book(9, 0, 1).subjectId, [], [book(9, 100, 1).objectId]);
  expect(JSON.stringify(model)).toBe(serialized);
  expect(Object.isFrozen(model.items)).toBe(true);
  expect(() => fitStaticRatings([], bookGenomeStaticSpec)).toThrow();
  expect(() => fitStaticRatings(training, { ...bookGenomeStaticSpec, itemShrinkage: 0 })).toThrow();
});
