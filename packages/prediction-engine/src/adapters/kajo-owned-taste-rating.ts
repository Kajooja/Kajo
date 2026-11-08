import type { PersonalContentRatingInput } from '../personal-content-rating.js';
import type { PersonalRatingBaselineInput } from '../personal-rating.js';
import type { KajoPersonalContentRatingPrefix } from './kajo-personal-content-rating.js';
import { normalizeKajoPersonalContentFeatures } from './kajo-personal-content-rating.js';
import { normalizeKajoPersonalRatingProspectivePrefix } from './kajo-personal-rating-prospective.js';

export interface KajoOwnedTasteRatingLabel {
  readonly itemId: string;
  readonly sourceStatus: 'OWNED_TASTE_RATING';
  readonly sourceBootstrapId: string;
  readonly orderingBasis: 'ACCEPTED_SEQUENTIAL_TASTE_RESPONSE';
  readonly bootstrap: Readonly<{
    id: string; actorUserId: string; profileId: string; itemId: string; itemType: 'BOOK' | 'MOVIE';
    sourceProvider: 'KAJO_CALIBRATION'; datasetKind: 'TASTE_SESSION_V2'; evidenceKind: 'RATED'; rating: number;
    sourceJobId: string; sessionId: string; sessionVersion: 'personal-taste-session-v2'; questionId: string;
    panelId: string; responseId: string; responseRevision: number; commandHash: string;
    acceptedAtMicros: string; availableAtMicros: string; experienceTime: 'UNKNOWN';
  }>;
}
export interface KajoOwnedTasteRatingPrefix extends Omit<KajoPersonalContentRatingPrefix, 'version' | 'labels'> {
  readonly version: 'kajo-personal-content-rating-prefix-v2';
  readonly trainingSource: Readonly<{
    signature: 'private.personal_rating_training_sources_v2(uuid,text,timestamp with time zone)'; bodyMd5: string;
  }>;
  readonly labels: readonly (KajoPersonalContentRatingPrefix['labels'][number] | KajoOwnedTasteRatingLabel)[];
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Invalid Kajo owned Taste numeric prefix: ${message}`);
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
}
function micros(value: unknown): bigint {
  check(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/u.test(value)
    && BigInt(value) <= 253402300799999999n, 'source clock');
  return BigInt(value);
}
function shape(value: unknown, keys: readonly string[]): void {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), 'source shape');
}

/** Shape checks are not database authorization. Only the locked trusted capture
 * supplies committed source lineage. Accepted-at is a report clock, never an
 * invented experience date; retained raw bootstrap provenance makes that explicit. */
export function normalizeKajoOwnedTasteRatingLabels(input: KajoOwnedTasteRatingPrefix): PersonalRatingBaselineInput {
  check(input?.version === 'kajo-personal-content-rating-prefix-v2'
    && new TextEncoder().encode(JSON.stringify(input)).byteLength <= 4 * 1024 * 1024, 'version/input budget');
  check(input.trainingSource?.signature === 'private.personal_rating_training_sources_v2(uuid,text,timestamp with time zone)'
    && /^[0-9a-f]{32}$/u.test(input.trainingSource.bodyMd5), 'training resolver identity');
  check(typeof input.snapshotId === 'string' && /^native-owned-content:[0-9a-f]{32}$/u.test(input.snapshotId)
    && input.candidatePool?.snapshotId === input.snapshotId, 'snapshot identity');
  check(Array.isArray(input.labels) && input.labels.length <= 8192, 'complete bounded labels');
  const native = input.labels.filter(label => label.sourceStatus !== 'OWNED_TASTE_RATING');
  const snapshot = input.snapshotId.replace('native-owned-content:', 'native-prospective:');
  const projected = normalizeKajoPersonalRatingProspectivePrefix({ ...input,
    version: 'kajo-personal-rating-prospective-prefix-v1', labels: native,
    snapshotId: snapshot, candidatePool: { ...input.candidatePool, snapshotId: snapshot } });
  const cutoff = micros(input.cutoffMicros), items = new Set(projected.prefix.ratings.map(row => row.objectId));
  const sources = new Set<string>(), responses = new Set<string>();
  const taste = input.labels.filter((label): label is KajoOwnedTasteRatingLabel => label.sourceStatus === 'OWNED_TASTE_RATING').map(label => {
    shape(label, ['itemId', 'sourceStatus', 'sourceBootstrapId', 'orderingBasis', 'bootstrap']);
    const b = label.bootstrap;
    shape(b, ['id', 'actorUserId', 'profileId', 'itemId', 'itemType', 'sourceProvider', 'datasetKind', 'evidenceKind', 'rating',
      'sourceJobId', 'sessionId', 'sessionVersion', 'questionId', 'panelId', 'responseId', 'responseRevision', 'commandHash',
      'acceptedAtMicros', 'availableAtMicros', 'experienceTime']);
    check([b.id, b.sourceJobId, b.sessionId, b.questionId, b.panelId, b.responseId, b.itemId].every(uuid)
      && label.itemId === b.itemId && label.sourceBootstrapId === b.id
      && b.actorUserId === input.actorUserId && b.profileId === input.profile.id && b.itemType === input.itemType
      && label.orderingBasis === 'ACCEPTED_SEQUENTIAL_TASTE_RESPONSE', 'owned lineage binding');
    check(b.sourceProvider === 'KAJO_CALIBRATION' && b.datasetKind === 'TASTE_SESSION_V2'
      && b.evidenceKind === 'RATED' && b.sessionVersion === 'personal-taste-session-v2'
      && b.experienceTime === 'UNKNOWN' && /^[0-9a-f]{32}$/u.test(b.commandHash)
      && Number.isInteger(b.responseRevision) && b.responseRevision >= 1 && b.responseRevision <= 8, 'accepted Taste lineage');
    check(Number.isInteger(b.rating) && b.rating >= 0 && b.rating <= 10, 'original integer grade');
    check(micros(b.acceptedAtMicros) <= cutoff && b.acceptedAtMicros === b.availableAtMicros, 'available accepted response');
    check(!items.has(b.itemId) && !sources.has(b.id) && !responses.has(b.responseId) && b.itemId !== input.targetItemId,
      'distinct effective Item/response; target absent');
    items.add(b.itemId); sources.add(b.id); responses.add(b.responseId);
    // The portable core's historical field name is generic source identity;
    // this explicit namespace cannot impersonate a native Event UUID.
    return { sourceEventId: `taste:${b.id}:${b.responseId}`, subjectId: b.profileId, domainId: b.itemType,
      objectId: b.itemId, value: b.rating, occurredAtMicros: b.acceptedAtMicros, availableAtMicros: b.availableAtMicros };
  });
  const baseline = { ...projected,
    prefix: { ...projected.prefix, snapshotId: input.snapshotId, ratings: [...projected.prefix.ratings, ...taste] },
    candidatePool: { ...projected.candidatePool, snapshotId: input.snapshotId } };
  return baseline;
}

export function normalizeKajoOwnedTasteRatingPrefix(input: KajoOwnedTasteRatingPrefix): PersonalContentRatingInput {
  const content = normalizeKajoPersonalContentFeatures(input, normalizeKajoOwnedTasteRatingLabels(input));
  return { ...content, prefix: { ...content.prefix, sourceId: 'kajo-owned-native-and-taste-ratings',
    sourceVersion: `owned-rating-source-v2:${input.trainingSource.bodyMd5}:${input.source.bodyMd5}:${content.content.sourceVersion}` } };
}
