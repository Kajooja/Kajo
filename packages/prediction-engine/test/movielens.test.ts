import { expect, it } from 'vitest';
import { interpretMovieLensRating, movieLensTarget } from '../src/adapters/movielens.js';
import { represent } from '../src/engine.js';
import { fixtureArtifact } from '../src/fixtures/cycles.js';

const source = { datasetId: 'movielens', releaseId: 'ml-32m', archiveSha256: 'a'.repeat(64), purpose: 'NONCOMMERCIAL_RESEARCH_ONLY' } as const;
const row = { userId: '1', movieId: '2', rating: 0.5, timestamp: 100 };

it('preserves raw scale, source identity and unknown native action/exposure semantics', () => {
  const observation = interpretMovieLensRating({ ...row, actorUserId: 'not-a-native-actor', exposure: 'verified' }, source);
  expect(observation).toMatchObject({ subjectId: 'movielens:ml-32m:subject:1', objectId: 'movielens:ml-32m:movie:2',
    actingIdentityRef: null, actionId: null, predictionId: null, exposure: 'unknown',
    measurement: { status: 'observed', value: 0.5 }, raw: { value: 0.5, scale: { min: 0.5, max: 5 } },
    occurredAt: 100_000, availableAt: 100_000,
    provenance: { origin: 'observed', recordId: 'ratings/1/2', source: { kind: 'external', release: 'ml-32m', availability: 'assumed-at-occurrence' } } });
  expect(movieLensTarget.conditioning).toBe('object-observation');
  expect(observation.provenance.source.kind === 'external' && observation.provenance.source.manifestId).toContain(source.archiveSha256);
});

it.each([0, -1, 1.25, 5.5, NaN, Infinity, null, '4.0'])('rejects unsupported raw rating %s rather than silently rescaling', rating => {
  expect(() => interpretMovieLensRating({ ...row, rating }, source)).toThrow('rating fields');
});

it('validates IDs, timestamp units/range and source manifest scope', () => {
  for (const change of [{ userId: '001' }, { movieId: '0' }, { userId: 'elsewhere:1' }, { timestamp: -1 },
    { timestamp: 100.5 }, { timestamp: Number.MAX_SAFE_INTEGER }]) {
    expect(() => interpretMovieLensRating({ ...row, ...change }, source)).toThrow();
  }
  expect(() => interpretMovieLensRating(row, { ...source, archiveSha256: '' })).toThrow('source identity');
  expect(() => interpretMovieLensRating(null, source)).toThrow('rating record');
});

it('excludes the entire equal-timestamp target group from a historical query prefix', () => {
  const earlier = interpretMovieLensRating({ ...row, timestamp: 99, movieId: '1' }, source);
  const target = interpretMovieLensRating(row, source);
  const tied = interpretMovieLensRating({ ...row, movieId: '3', rating: 5 }, source);
  const state = represent({ scope: { subject: { id: target.subjectId, kind: 'individual' }, actingIdentityRef: null,
    sessionRef: 'offline-simulation', evidence: { sourceIds: ['movielens:ml-32m'], cohortIds: [], synthetic: 'exclude' } },
    observations: [target, tied, earlier], target: movieLensTarget, asOf: target.occurredAt - 1, artifact: fixtureArtifact });
  expect(state.prefix).toEqual([earlier]);
  expect(state.longTermMean).toBe(0.5);
  expect(target.raw.value).toBe(0.5);
});
