import { expect, it } from 'vitest';
import type { Observation } from '../src/contracts.js';
import { interpretMovieLensRating, movieLensTarget } from '../src/adapters/movielens.js';
import { fitRatingArtifact, forecastRatingBatch, useOptionalRatingArtifact, validateRatingArtifact } from '../src/research.js';
import type { RatingConfig, RatingFitSpec, RatingQuery } from '../src/research.js';

// Invented external-shaped records exercise code only; they are not real evaluation evidence.
const source = { datasetId: 'movielens', releaseId: 'ml-32m', archiveSha256: 'f'.repeat(64), purpose: 'NONCOMMERCIAL_RESEARCH_ONLY' } as const;
const sourceId = 'movielens:ml-32m';
const row = (user: number, item: number, time: number, rating = item % 2 ? 2 : 4) =>
  interpretMovieLensRating({ userId: String(user), movieId: String(item), timestamp: time, rating }, source);
const config: RatingConfig = { seed: 237, itemShrinkage: 10, subjectShrinkage: 10, recentGroups: 3, recentWeight: 0.35,
  neighbors: { maxItems: 20, minSupport: 2, minOverlap: 2, shrinkage: 10, topK: 5 },
  factorization: { dimensions: 3, epochs: 3, learningRate: 0.01, regularization: 0.05, foldInRidge: 10 },
  retrieval: { maxMemories: 100, perItem: 10, topK: 3, maxDistance: 0.35, weight: 0.35, minPrefixGroups: 3 } };
const rows = Array.from({ length: 12 }, (_, i) => Array.from({ length: 6 }, (_, u) => row(u + 1, i + 1, i * 10 + 1))).flat();
const spec: RatingFitSpec = { id: 'invented-fixture', sourceId, manifestId: `${sourceId}:sha256:${source.archiveSha256}`,
  subjectIds: Array.from({ length: 6 }, (_, i) => row(i + 1, 1, 1).subjectId), trainBefore: 120000, target: movieLensTarget, config };
const prefix = Array.from({ length: 6 }, (_, i) => row(100, i + 1, i * 10 + 1));
const query: RatingQuery = { scope: { subject: { id: prefix[0]!.subjectId, kind: 'individual' }, actingIdentityRef: null,
  sessionRef: 'invented-fixture', evidence: { sourceIds: [sourceId, 'native-fixture'], cohortIds: [], synthetic: 'exclude' } },
asOf: 130000, prefix, objectIds: [row(100, 9, 130).objectId, row(100, 999, 130).objectId] };
const artifact = () => fitRatingArtifact(rows, spec);

it('replays fitted parameters and scores deterministically, with real neighbor/memory matches and cold fallback', () => {
  const first = artifact(), second = artifact();
  expect({ ...first, fitCostMs: null }).toEqual({ ...second, fitCostMs: null });
  expect(validateRatingArtifact(JSON.parse(JSON.stringify(first)))).toBe(true);
  const predictions = forecastRatingBatch(first, query);
  expect(predictions).toEqual(forecastRatingBatch(second, query));
  expect(predictions[0]!['item-neighbor'].componentSupport).toBeGreaterThan(0);
  expect(predictions[0]!.trajectory.componentSupport).toBeGreaterThan(0);
  expect(predictions[1]!.trajectory).toMatchObject({ fallback: true, eligibleMemories: 0 });
  expect(predictions[1]!['item-mean'].value).toBe(first.globalMean);
  for (const model of predictions) for (const estimate of Object.values(model)) {
    expect(estimate.value).toBeGreaterThanOrEqual(0.5); expect(estimate.value).toBeLessThanOrEqual(5);
    expect(estimate.calibration).toBe('uncalibrated');
  }
});
it('rejects held-out subjects, cutoff-time labels and synthetic evidence before fitting any component', () => {
  expect(() => fitRatingArtifact([...rows, row(100, 3, 115)], spec)).toThrow('held-out');
  expect(() => fitRatingArtifact([...rows, row(1, 20, 120)], spec)).toThrow('Future');
  expect(() => fitRatingArtifact([{ ...rows[0]!, availableAt: 115000 }, ...rows.slice(1)], spec)).toThrow('availability assumption');
  const synthetic: Observation = { ...rows[0]!, provenance: { origin: 'synthetic', source: {
    kind: 'generator', id: 'invented', version: '1', parentRefs: [] }, recordId: 'x', revision: 1 } };
  expect(() => fitRatingArtifact([synthetic, ...rows.slice(1)], spec)).toThrow('synthetic');
});
it('rejects equal-time/future targets, foreign subjects, duplicate and missing prefix evidence', () => {
  const a = artifact();
  for (const extra of [row(100, 20, 130), row(100, 20, 131), row(1, 20, 110), prefix[0]!]) {
    expect(() => forecastRatingBatch(a, { ...query, prefix: [...prefix, extra] })).toThrow();
  }
  expect(() => forecastRatingBatch(a, { ...query, prefix: [{ ...prefix[0]!, measurement: { status: 'missing', reason: 'unknown' } }] })).toThrow('missing');
});
it('never encodes the continuation or later train labels into that memory prefix', () => {
  const first = artifact(), changed = fitRatingArtifact(rows.map(r => r.occurredAt >= 31000 ?
    { ...r, measurement: { status: 'observed', value: 0.5 }, raw: { ...r.raw, value: 0.5 } } : r), spec);
  const id = row(1, 4, 31).objectId;
  const before = first.memories[id]!.find(m => m.subjectId === rows[0]!.subjectId)!;
  const after = changed.memories[id]!.find(m => m.subjectId === rows[0]!.subjectId)!;
  expect(before.mean).toBe(after.mean); expect(before.recent).toEqual(after.recent);
  expect(before.value).not.toBe(after.value); expect(before.key).toBe(after.key);
});
it('static state ignores order while recent state and ordered retrieval can distinguish it', () => {
  const a = artifact();
  const reordered = [...prefix].reverse().map((r, i) => ({ ...r, occurredAt: i * 10000 + 1000, availableAt: i * 10000 + 1000 }));
  const first = forecastRatingBatch(a, query)[0]!, second = forecastRatingBatch(a, { ...query, prefix: reordered })[0]!;
  expect(first['state-static'].value).toBe(second['state-static'].value);
  expect(first['state-recent'].value).not.toBe(second['state-recent'].value);
  expect(first.trajectory.value).not.toBe(second.trajectory.value);
});
it('groups tied ratings before recent encoding, rather than inventing their internal order', () => {
  const a = artifact(), tied = prefix.map((r, i) => ({ ...r, occurredAt: Math.floor(i / 2) * 10000, availableAt: Math.floor(i / 2) * 10000 }));
  const reversed = [tied[1]!, tied[0]!, tied[3]!, tied[2]!, tied[5]!, tied[4]!];
  expect(forecastRatingBatch(a, { ...query, prefix: tied })).toEqual(forecastRatingBatch(a, { ...query, prefix: reversed }));
});
it('fails absent, invalid, withdrawn, disallowed and out-of-domain artifacts closed to native-only evidence', () => {
  const a = artifact(), native: Observation = { ...prefix[0]!, measurement: { status: 'observed', value: 4 }, raw: { ...prefix[0]!.raw, value: 4 },
    provenance: { origin: 'observed', source: { kind: 'native', id: 'native-fixture' }, recordId: 'native-1', revision: 1 } };
  const q = { ...query, prefix: [...prefix, native] };
  for (const bad of [null, { ...a, schema: 'bad' }, { ...a, status: 'withdrawn' }, { ...a, manifestId: 'changed' },
    { ...a, version: { ...a.version, use: 'production' } }, { ...a, items: { ...a.items, bad: { mean: NaN } } }]) {
    expect(useOptionalRatingArtifact(bad, q, movieLensTarget)).toMatchObject({ mode: 'native-only-fallback', value: 4, nativeSupport: 1 });
    expect(useOptionalRatingArtifact(bad, query, movieLensTarget)).toMatchObject({ mode: 'native-only-fallback', value: null, nativeSupport: 0 });
  }
  expect(useOptionalRatingArtifact(a, { ...q, objectIds: ['other-domain:1'] }, movieLensTarget)).toMatchObject({ mode: 'native-only-fallback', value: 4 });
  expect(useOptionalRatingArtifact(a, { ...q, scope: { ...q.scope, evidence: { ...q.scope.evidence, sourceIds: ['native-fixture'] } } }, movieLensTarget))
    .toMatchObject({ mode: 'native-only-fallback', value: 4 });
  expect(useOptionalRatingArtifact(a, query, movieLensTarget).mode).toBe('research');
  for (const badTime of [NaN, Infinity, -1, 1.5]) {
    expect(useOptionalRatingArtifact(null, { ...q, asOf: badTime }, movieLensTarget))
      .toMatchObject({ mode: 'native-only-fallback', value: null, nativeSupport: 0 });
    for (const field of ['occurredAt', 'availableAt']) {
      expect(useOptionalRatingArtifact(null, { ...query, prefix: [{ ...native, [field]: badTime }] }, movieLensTarget))
        .toMatchObject({ mode: 'native-only-fallback', value: null, nativeSupport: 0 });
    }
  }
});
it('rejects incompatible factors, invalid support, future memories and oversized configurations', () => {
  const a = artifact(), id = Object.keys(a.items)[0]!;
  a.items[id]!.vector.push(1); expect(validateRatingArtifact(a)).toBe(false);
  const b = artifact(); b.subjectSupport[Object.keys(b.subjectSupport)[0]!] = 0; expect(validateRatingArtifact(b)).toBe(false);
  const c = artifact(); Object.values(c.memories)[0]![0]!.availableAt = 999999; expect(validateRatingArtifact(c)).toBe(false);
  expect(() => fitRatingArtifact(rows, { ...spec, config: { ...config, neighbors: { ...config.neighbors, maxItems: 1001 } } })).toThrow('budget');
});
