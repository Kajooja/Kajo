import type { DomainRatingPrior, PersonalRatingBaselineInput } from '../personal-rating.js';

interface NativeRatingLabel {
  readonly itemId: string;
  readonly sourceEventId: string;
  readonly sourceStatus: 'NATIVE_RATING';
  readonly orderingBasis: 'CANONICAL_RECEIPT_LINEAGE' | 'LATEST_ELIGIBLE_OCCURRENCE_TIME';
  readonly event: {
    readonly id: string;
    readonly actorUserId: string;
    readonly profileId: string;
    readonly itemId: string;
    readonly itemType: 'BOOK' | 'MOVIE';
    readonly eventType: 'ITEM_RATED';
    readonly rating: number;
    readonly occurredAtMicros: string;
    readonly availableAtMicros: string;
  };
}

/** A complete resolved snapshot supplied by the trusted native fixture reader.
 * This portable boundary neither queries nor authorizes a live database.
 * Retained copies do not establish ongoing permission after source withdrawal. */
export interface KajoPersonalRatingPrefix {
  readonly version: 'kajo-personal-rating-prefix-v1';
  readonly captureScope: 'ISOLATED_NATIVE_FIXTURE';
  readonly snapshotId: string;
  readonly complete: true;
  readonly profile: { readonly id: string; readonly type: 'PERSONAL'; readonly ownerUserId: string };
  readonly actorUserId: string;
  readonly itemType: 'BOOK' | 'MOVIE';
  readonly cutoffMicros: string;
  readonly source: {
    readonly signature: 'private.personal_source_evidence_v1(uuid,timestamp with time zone)';
    readonly bodyMd5: string;
  };
  readonly labels: readonly NativeRatingLabel[];
  readonly candidatePool: {
    readonly snapshotId: string;
    readonly cutoffMicros: string;
    readonly kind: 'DECLARED_CANONICAL_ITEM_SNAPSHOT';
    readonly items: readonly { readonly id: string; readonly itemType: 'BOOK' | 'MOVIE';
      readonly availableAtMicros: string; readonly discoverable: true }[];
  };
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid Kajo Personal numeric prefix: ${message}`);
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
}
function micros(value: unknown): bigint {
  requireValue(typeof value === 'string' && /^(0|[1-9][0-9]*)$/u.test(value), 'microsecond clock');
  const parsed = BigInt(value);
  requireValue(parsed <= 253402300799999999n, 'microsecond range');
  return parsed;
}

export function normalizeKajoPersonalRatingPrefix(input: KajoPersonalRatingPrefix,
  options: { readonly config: PersonalRatingBaselineInput['config']; readonly prior?: DomainRatingPrior | null },
): PersonalRatingBaselineInput {
  requireValue(input?.version === 'kajo-personal-rating-prefix-v1'
    && input.captureScope === 'ISOLATED_NATIVE_FIXTURE' && input.complete === true, 'supported complete native fixture');
  requireValue(uuid(input.profile?.id) && input.profile.type === 'PERSONAL'
    && uuid(input.actorUserId) && input.profile.ownerUserId === input.actorUserId, 'Personal owner');
  requireValue(input.itemType === 'BOOK' || input.itemType === 'MOVIE', 'domain');
  const cutoff = micros(input.cutoffMicros);
  requireValue(input.source?.signature === 'private.personal_source_evidence_v1(uuid,timestamp with time zone)'
    && /^[0-9a-f]{32}$/u.test(input.source.bodyMd5), 'canonical resolver identity');
  requireValue(typeof input.snapshotId === 'string' && /^native-numeric:[0-9a-f]{32}$/u.test(input.snapshotId), 'snapshot identity');
  requireValue(Array.isArray(input.labels), 'complete raw label list');
  const items = new Set<string>(), sources = new Set<string>();
  const ratings = input.labels.map(label => {
    const event = label?.event;
    requireValue(uuid(label?.itemId) && uuid(label.sourceEventId) && label.sourceStatus === 'NATIVE_RATING'
      && ['CANONICAL_RECEIPT_LINEAGE', 'LATEST_ELIGIBLE_OCCURRENCE_TIME'].includes(label.orderingBasis), 'resolved native label');
    requireValue(event && event.id === label.sourceEventId && event.itemId === label.itemId
      && event.profileId === input.profile.id && event.actorUserId === input.actorUserId
      && event.itemType === input.itemType && event.eventType === 'ITEM_RATED', 'original Event join/scope');
    requireValue(Number.isInteger(event.rating) && event.rating >= 0 && event.rating <= 10, 'original numeric Event rating');
    requireValue(micros(event.occurredAtMicros) <= cutoff && micros(event.availableAtMicros) <= cutoff, 'available native prefix');
    requireValue(!items.has(label.itemId) && !sources.has(label.sourceEventId), 'distinct resolved Item/source');
    items.add(label.itemId); sources.add(label.sourceEventId);
    return { sourceEventId: event.id, subjectId: event.profileId, domainId: event.itemType,
      objectId: event.itemId, value: event.rating, occurredAtMicros: event.occurredAtMicros,
      availableAtMicros: event.availableAtMicros };
  });
  const pool = input.candidatePool;
  requireValue(pool?.kind === 'DECLARED_CANONICAL_ITEM_SNAPSHOT' && pool.cutoffMicros === input.cutoffMicros
    && pool.snapshotId === input.snapshotId && Array.isArray(pool.items), 'same-snapshot candidate pool');
  const candidateIds = pool.items.map(item => {
    requireValue(uuid(item?.id) && item.itemType === input.itemType && item.discoverable === true
      && micros(item.availableAtMicros) <= cutoff, 'available canonical candidate');
    return item.id;
  });
  requireValue(new Set(candidateIds).size === candidateIds.length, 'distinct candidates');
  return {
    subjectId: input.profile.id, domainId: input.itemType, cutoffMicros: input.cutoffMicros,
    prefix: { sourceId: 'kajo-canonical-native-rating-events', sourceVersion: `personal-source-evidence-v1:${input.source.bodyMd5}`,
      snapshotId: input.snapshotId, complete: true,
      provenance: { origin: 'synthetic', captureScope: input.captureScope }, ratings },
    candidatePool: { snapshotId: pool.snapshotId, cutoffMicros: pool.cutoffMicros, candidateIds },
    config: options.config, prior: options.prior ?? null,
  };
}
