import type { Observation, TargetDefinition } from '../contracts.js';

export const movieLensTarget: TargetDefinition = {
  id: 'movielens:explicit-rating', version: '1', scale: { min: 0.5, max: 5 },
  conditioning: 'object-observation', exposure: 'not-required', objective: 'maximize',
};

export interface MovieLensSource {
  readonly datasetId: 'movielens';
  readonly releaseId: 'ml-32m' | 'ml-latest-small-2018-kaggle-v2';
  readonly archiveSha256: string;
  readonly purpose: 'NONCOMMERCIAL_RESEARCH_ONLY';
}

export interface MovieLensRating {
  readonly userId: string;
  readonly movieId: string;
  readonly rating: number;
  readonly timestamp: number;
}

function positiveId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
    && Number.isSafeInteger(Number(value));
}

/** Pure research adapter; no source person becomes a native account or Event. */
export function interpretMovieLensRating(input: unknown, source: MovieLensSource): Observation {
  if (source.datasetId !== 'movielens' || !['ml-32m', 'ml-latest-small-2018-kaggle-v2'].includes(source.releaseId)
    || source.purpose !== 'NONCOMMERCIAL_RESEARCH_ONLY' || !/^[a-f0-9]{64}$/.test(source.archiveSha256)) {
    throw new Error('A verified research source identity is required');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid rating record');
  const row = input as Record<string, unknown>;
  if (!positiveId(row.userId) || !positiveId(row.movieId) || typeof row.rating !== 'number'
    || !Number.isFinite(row.rating) || row.rating < 0.5 || row.rating > 5 || !Number.isInteger(row.rating * 2)
    || typeof row.timestamp !== 'number' || !Number.isSafeInteger(row.timestamp) || row.timestamp < 0
    || !Number.isSafeInteger(row.timestamp * 1000)) throw new Error('Invalid MovieLens rating fields');
  const sourceId = `${source.datasetId}:${source.releaseId}`;
  const subjectId = `${sourceId}:subject:${row.userId}`;
  return {
    subjectId, actingIdentityRef: null, objectId: `${sourceId}:movie:${row.movieId}`,
    actionId: null, predictionId: null, targetId: movieLensTarget.id, targetVersion: movieLensTarget.version,
    measurement: { status: 'observed', value: row.rating }, raw: { value: row.rating, scale: { ...movieLensTarget.scale } },
    occurredAt: row.timestamp * 1000, availableAt: row.timestamp * 1000, exposure: 'unknown',
    access: { kind: 'subject', subjectId }, provenance: {
      origin: 'observed', source: { kind: 'external', id: sourceId, release: source.releaseId,
        manifestId: `${sourceId}:sha256:${source.archiveSha256}`, availability: 'assumed-at-occurrence' },
      recordId: `ratings/${row.userId}/${row.movieId}`, revision: 1,
    },
  };
}
