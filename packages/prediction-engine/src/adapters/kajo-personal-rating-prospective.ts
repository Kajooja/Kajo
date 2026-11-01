import type { PersonalRatingBaselineInput } from '../personal-rating.js';
import type { KajoPersonalRatingPrefix } from './kajo-personal-rating.js';

/** Supplied only by the private, locked native preparation transaction.
 * Validation checks shape and bindings, not database authorization or commit order.
 * Synthetic integration fixtures must keep their declared synthetic origin. */
export interface KajoPersonalRatingProspectivePrefix extends Omit<KajoPersonalRatingPrefix,
  'version' | 'captureScope' | 'candidatePool'> {
  readonly version: 'kajo-personal-rating-prospective-prefix-v1';
  readonly captureScope: 'PRIVATE_NATIVE_EVALUATION';
  readonly evidenceOrigin: 'observed' | 'synthetic';
  readonly forecastId: string;
  readonly sourcePredictionId: string;
  readonly targetItemId: string;
  readonly candidatePool: {
    readonly kind: 'FROZEN_DELIVERED_PERSONAL_POOL';
    readonly snapshotId: string;
    readonly cutoffMicros: string;
    readonly sourcePredictionId: string;
    readonly items: KajoPersonalRatingPrefix['candidatePool']['items'];
  };
}

export const personalRatingProspectiveConfig = Object.freeze({
  version: 'personal-native-location-v1', shrinkage: 2,
});

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid Kajo prospective numeric prefix: ${message}`);
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
}
function micros(value: unknown): bigint {
  requireValue(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/u.test(value)
    && BigInt(value) <= 253402300799999999n, 'native microsecond clock');
  return BigInt(value);
}

/** Native-only mean fallback: this source packet admits no external/domain prior.
 * The trusted caller runs the unchanged numerical core before native finalization
 * in the same transaction. This function alone cannot establish prospectivity. */
export function normalizeKajoPersonalRatingProspectivePrefix(
  input: KajoPersonalRatingProspectivePrefix,
): PersonalRatingBaselineInput {
  requireValue(input?.version === 'kajo-personal-rating-prospective-prefix-v1'
    && input.captureScope === 'PRIVATE_NATIVE_EVALUATION' && input.complete === true
    && ['observed', 'synthetic'].includes(input.evidenceOrigin), 'complete trusted native capture and origin');
  requireValue(uuid(input.forecastId) && uuid(input.sourcePredictionId) && uuid(input.targetItemId), 'forecast/target binding');
  requireValue(uuid(input.profile?.id) && input.profile.type === 'PERSONAL'
    && uuid(input.actorUserId) && input.profile.ownerUserId === input.actorUserId, 'Personal owner');
  requireValue(input.itemType === 'BOOK' || input.itemType === 'MOVIE', 'domain');
  const cutoff = micros(input.cutoffMicros);
  requireValue(input.source?.signature === 'private.personal_source_evidence_v1(uuid,timestamp with time zone)'
    && /^[0-9a-f]{32}$/u.test(input.source.bodyMd5), 'canonical resolver identity');
  requireValue(typeof input.snapshotId === 'string' && /^native-prospective:[0-9a-f]{32}$/u.test(input.snapshotId), 'snapshot identity');
  requireValue(Array.isArray(input.labels) && input.labels.length <= 8192, 'bounded complete raw labels');
  const items = new Set<string>(), sources = new Set<string>();
  const ratings = input.labels.map(label => {
    const event = label?.event;
    requireValue(uuid(label?.itemId) && uuid(label.sourceEventId) && label.sourceStatus === 'NATIVE_RATING'
      && ['CANONICAL_RECEIPT_LINEAGE', 'LATEST_ELIGIBLE_OCCURRENCE_TIME'].includes(label.orderingBasis), 'resolved native source');
    requireValue(event && event.id === label.sourceEventId && event.itemId === label.itemId
      && event.profileId === input.profile.id && event.actorUserId === input.actorUserId
      && event.itemType === input.itemType && event.eventType === 'ITEM_RATED', 'original Event join/scope');
    requireValue(Number.isInteger(event.rating) && event.rating >= 0 && event.rating <= 10, 'original integer rating');
    requireValue(micros(event.occurredAtMicros) <= cutoff && micros(event.availableAtMicros) <= cutoff, 'available prefix');
    requireValue(!items.has(label.itemId) && !sources.has(label.sourceEventId), 'distinct Item/source support');
    requireValue(label.itemId !== input.targetItemId, 'target answer absent from prefix');
    items.add(label.itemId); sources.add(label.sourceEventId);
    return { sourceEventId: event.id, subjectId: event.profileId, domainId: event.itemType,
      objectId: event.itemId, value: event.rating, occurredAtMicros: event.occurredAtMicros,
      availableAtMicros: event.availableAtMicros };
  });
  const pool = input.candidatePool;
  requireValue(pool?.kind === 'FROZEN_DELIVERED_PERSONAL_POOL' && pool.snapshotId === input.snapshotId
    && pool.cutoffMicros === input.cutoffMicros && pool.sourcePredictionId === input.sourcePredictionId
    && Array.isArray(pool.items) && pool.items.length >= 1 && pool.items.length <= 50, 'bound delivered pool');
  const candidateIds = pool.items.map(item => {
    requireValue(uuid(item?.id) && item.itemType === input.itemType && item.discoverable === true
      && micros(item.availableAtMicros) <= cutoff, 'available delivered candidate');
    return item.id;
  });
  requireValue(new Set(candidateIds).size === candidateIds.length && candidateIds.includes(input.targetItemId),
    'distinct pool containing selected target');
  return {
    subjectId: input.profile.id, domainId: input.itemType, cutoffMicros: input.cutoffMicros,
    prefix: { sourceId: 'kajo-canonical-native-rating-events', sourceVersion: `personal-source-evidence-v1:${input.source.bodyMd5}`,
      snapshotId: input.snapshotId, complete: true,
      provenance: { origin: input.evidenceOrigin, captureScope: input.captureScope }, ratings },
    candidatePool: { snapshotId: pool.snapshotId, cutoffMicros: pool.cutoffMicros, candidateIds },
    config: personalRatingProspectiveConfig, prior: null,
  };
}
