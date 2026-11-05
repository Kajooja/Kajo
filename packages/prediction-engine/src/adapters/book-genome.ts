import type { StaticResearchRating, StaticRatingSpec } from '../research-static.js';

export const bookGenomeSourceId = 'grouplens-book-genome:2021-12-30';
export const bookGenomeRatingsSha256 = '1524ea4ad61da974b5f36c6968befcc98163514113f7ee8c06dc0c2b81e37444';
export const bookGenomeStaticSpec: StaticRatingSpec = Object.freeze({
  sourceId: bookGenomeSourceId, snapshotId: bookGenomeRatingsSha256,
  originalScale: Object.freeze({ min: 1, max: 5 }), scale: Object.freeze({ min: 2, max: 10 }),
  multiplier: 2, itemShrinkage: 10, subjectShrinkage: 10,
});

/** Only the reviewed ratings member; this creates neither native Events nor timed Observations. */
export function interpretBookGenomeRating(input: unknown, memberSha256: string): StaticResearchRating {
  if (memberSha256 !== bookGenomeRatingsSha256) throw new Error('Unreviewed Book Genome snapshot');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid book rating');
  const r = input as Record<string, unknown>;
  if (Object.keys(r).sort().join(',') !== 'item_id,rating,user_id'
    || ![r.user_id, r.item_id].every(x => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0)
    || typeof r.rating !== 'number' || !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) {
    throw new Error('Invalid Book Genome fields');
  }
  return { kind: 'undated-external-rating', sourceId: bookGenomeSourceId, snapshotId: memberSha256,
    subjectId: `${bookGenomeSourceId}:user:${r.user_id}`, objectId: `${bookGenomeSourceId}:book:${r.item_id}`,
    sourceOccurredAt: null, original: { value: r.rating, min: 1, max: 5 }, value: 2 * r.rating };
}
