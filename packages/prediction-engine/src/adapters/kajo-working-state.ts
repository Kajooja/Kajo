import type { PredictionObject } from '../contracts.js';
import type { WorkingConfig, WorkingFeatureSchema, WorkingRecord, WorkingStateInput } from '../working-state.js';
import { createKajoAdapter } from './kajo.js';

type StoredInstant = string | number;
export interface KajoWorkingEvent {
  readonly id: string;
  readonly actor_user_id: string;
  readonly profile_id: string;
  readonly session_id: string | null;
  readonly item_id: string | null;
  readonly item_type: 'BOOK' | 'MOVIE' | null;
  readonly event_type: string;
  readonly occurred_at: StoredInstant;
  readonly created_at: StoredInstant;
  readonly properties: Readonly<Record<string, unknown>>;
}
export interface KajoWorkingSessionInput {
  readonly profile: { readonly id: string; readonly type: 'PERSONAL'; readonly ownerUserId: string };
  readonly actorUserId: string;
  readonly session: { readonly id: string; readonly actor_user_id: string; readonly profile_id: string;
    readonly started_at: StoredInstant; readonly created_at: StoredInstant } | null;
  readonly events: readonly KajoWorkingEvent[];
  readonly objects: readonly PredictionObject[];
  readonly featureSchema: WorkingFeatureSchema;
  readonly asOf: number;
  /** Trusted caller supplies the visible session prefix and same-Item correction closure. */
  readonly prefixComplete: boolean;
  readonly refs: { readonly scopeId: string; readonly subjectRef: string; readonly actorRef: string; readonly sessionRef: string };
  readonly resetAt?: number | null;
  readonly config?: Partial<WorkingConfig>;
}

const sourceId = 'kajo-canonical-events-v1';
const adapter = createKajoAdapter({ kind: 'native', id: sourceId });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const attentionTypes = new Set(['ITEM_IMPRESSION', 'ITEM_OPENED', 'ITEM_DWELL', 'ITEM_LIKED', 'ITEM_DISLIKED',
  'ITEM_SAVED', 'ITEM_UNSAVED', 'ITEM_CONSUMED', 'ITEM_CONSUMPTION_REVERSED', 'ITEM_SUGGESTED',
  'ITEM_ADDED_TO_LIST', 'ITEM_REMOVED_FROM_LIST', 'ITEM_ENDORSED', 'SEARCH_PERFORMED', 'DISCOVERY_MODE_CHANGED']);
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function uuid(value: unknown): string | null {
  return typeof value === 'string' && uuidPattern.test(value) ? value.toLowerCase() : null;
}
function instant(value: StoredInstant): number {
  if (typeof value === 'number') {
    requireValue(Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER, 'Invalid Kajo working instant');
    return value;
  }
  // Date.parse alone truncates PostgreSQL microseconds. Keep the stored fraction,
  // validate its calendar and offset, and reject epochs unable to distinguish it.
  requireValue(typeof value === 'string', 'Invalid Kajo working timestamp');
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/u.exec(value);
  requireValue(match, 'Invalid Kajo working timestamp representation');
  const offset = match[4] === 'Z' ? 'Z' : match[4]!.length === 3 ? `${match[4]}:00`
    : match[4]!.length === 5 ? `${match[4]!.slice(0, 3)}:${match[4]!.slice(3)}` : match[4]!;
  const base = Date.parse(`${match[1]}T${match[2]}.000${offset}`);
  requireValue(Number.isFinite(base) && base >= 0, 'Invalid Kajo working timestamp');
  // Roundtrip the local calendar rather than accepting Date.parse's normalization.
  const local = Date.parse(`${match[1]}T${match[2]}.000Z`);
  requireValue(Number.isFinite(local) && new Date(local).toISOString().slice(0, 19) === `${match[1]}T${match[2]}`,
    'Invalid Kajo working calendar timestamp');
  const micros = Number((match[3] ?? '').padEnd(6, '0'));
  const result = base + micros / 1000;
  requireValue(result <= Number.MAX_SAFE_INTEGER && (micros === 0 || result > base),
    'Kajo working timestamp precision collapse');
  // At this epoch an adjacent stored microsecond must remain a distinct instant.
  requireValue(micros === 0 || (base + (micros - 1) / 1000 < result && base + (micros + 1) / 1000 > result),
    'Kajo working timestamp precision collapse');
  return result;
}

/** No credentials, reads, writes, feature lookup or native-policy activation. */
export function normalizeKajoWorkingSession(input: KajoWorkingSessionInput): WorkingStateInput {
  requireValue(input && input.profile?.type === 'PERSONAL', 'Kajo WorkingState supports only PersonalProfile');
  const profileId = uuid(input.profile.id), actorId = uuid(input.actorUserId);
  requireValue(profileId && actorId && uuid(input.profile.ownerUserId) === actorId, 'Actor is outside the supplied PersonalProfile snapshot');
  const refs = input.refs;
  const rawIdentityIds = [profileId, actorId, uuid(input.session?.id)].filter((value): value is string => value !== null);
  requireValue(refs && typeof refs.scopeId === 'string' && refs.scopeId.length > 0 && refs.scopeId.length <= 128
    && !/[\u0000-\u001f]/u.test(refs.scopeId)
    && rawIdentityIds.every(raw => !refs.scopeId.toLowerCase().includes(raw)), 'Kajo working namespace required');
  const aliases = [refs.subjectRef, refs.actorRef, refs.sessionRef];
  requireValue(aliases.every(ref => typeof ref === 'string' && ref.startsWith(`${refs.scopeId}:`)
    && ref.length > refs.scopeId.length + 1 && ref.length <= 256 && !/[\u0000-\u001f]/u.test(ref))
    && new Set(aliases).size === 3 && aliases.every(ref => rawIdentityIds.every(raw => !ref.toLowerCase().includes(raw))),
  'Kajo working scoped aliases must be distinct and inside the namespace');
  requireValue(Number.isFinite(input.asOf) && input.asOf >= 0 && input.asOf <= Number.MAX_SAFE_INTEGER,
    'Invalid Kajo working cutoff');
  requireValue(typeof input.prefixComplete === 'boolean', 'Kajo working requires explicit complete-prefix/correction closure declaration');
  requireValue(Array.isArray(input.events) && input.events.length <= Math.min(input.config?.maxRecords ?? 128, 128),
    'Kajo working Event prefix budget exceeded');
  requireValue(Array.isArray(input.objects) && input.objects.length <= Math.min(input.config?.maxItems ?? 32, 32),
    'Kajo working Item feature budget exceeded');
  const objects = new Map<string, PredictionObject>();
  for (const object of input.objects) {
    const objectId = uuid(object.id);
    requireValue(objectId && !objects.has(objectId), 'Kajo working Item snapshots must have unique canonical IDs');
    objects.set(objectId, { ...object, id: objectId });
  }
  const current = input.session;
  const ownedSession = current !== null && uuid(current.id) && uuid(current.actor_user_id) === actorId
    && uuid(current.profile_id) === profileId;
  const startedAt = ownedSession ? instant(current!.started_at) : null;
  const createdAt = ownedSession ? instant(current!.created_at) : null;
  const session = ownedSession && startedAt !== null && createdAt !== null && startedAt <= input.asOf && createdAt <= input.asOf
    ? { ref: refs.sessionRef, startedAt } : null;
  const result: WorkingStateInput = {
    scope: { subject: { id: refs.subjectRef, kind: 'individual' }, actingIdentityRef: refs.actorRef,
      sessionRef: refs.sessionRef, evidence: { sourceIds: [sourceId], cohortIds: [], synthetic: 'exclude' } },
    target: adapter.target, asOf: input.asOf, session, prefixComplete: input.prefixComplete,
    featureSchema: input.featureSchema, records: [], availabilityBasis: 'STORED_CREATED_TIME',
    ...(input.resetAt === undefined ? {} : { resetAt: input.resetAt }),
    ...(input.config === undefined ? {} : { config: input.config }),
  };
  if (!session) return result;
  const records: WorkingRecord[] = [];
  for (const event of input.events) {
    // Never copy another actor/Profile or interpret its corrections as ours.
    if (uuid(event.actor_user_id) !== actorId || uuid(event.profile_id) !== profileId) continue;
    const eventId = uuid(event.id), objectId = uuid(event.item_id);
    requireValue(eventId && (event.session_id === null || uuid(event.session_id)), 'Invalid Kajo working Event identity');
    if (!objectId) {
      requireValue(event.item_id === null && event.item_type === null, 'Invalid Kajo working Event Item identity');
      continue; // This first component observes Item-linked session activity only.
    }
    requireValue(event.item_type === 'BOOK' || event.item_type === 'MOVIE', 'Invalid Kajo working Event Item type');
    requireValue(event.properties && typeof event.properties === 'object' && !Array.isArray(event.properties),
      'Invalid Kajo working Event properties');
    const occurredAt = instant(event.occurred_at), availableAt = instant(event.created_at);
    let kind: WorkingRecord['kind'];
    let rating: number | null = null;
    let clearTargets: WorkingRecord['clearTargets'];
    let invalidates: WorkingRecord['invalidates'];
    if (event.event_type === 'ITEM_RATED') {
      kind = 'VALUE';
      const raw = event.properties.rating;
      rating = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 10 ? raw : null;
    } else if (event.event_type === 'ITEM_NOT_INTERESTED') kind = 'NEGATIVE';
    else if (event.event_type === 'ITEM_INTEREST_CLEARED') { kind = 'CLEAR'; clearTargets = ['NEGATIVE']; }
    else if (event.event_type === 'ITEM_HISTORY_CLEARED') { kind = 'CLEAR'; clearTargets = ['VALUE']; }
    else if (event.event_type === 'ITEM_INTERACTION_UNDONE') {
      kind = 'UNDO';
      const original = uuid(event.properties.reversedEventId);
      requireValue(original && original !== eventId, 'Kajo working UNDO requires an exact original Event ID');
      invalidates = [{ sourceId, recordId: original }];
    } else if (attentionTypes.has(event.event_type)) kind = 'ATTENTION';
    else continue; // Bootstrap/calibration/unknown types never become native evidence.
    const observation = adapter.interpretObservation({ eventId, revision: 1, profileId: refs.subjectRef,
      actorUserId: refs.actorRef, itemId: objectId, rating, occurredAt, availableAt,
      actionId: null, predictionRunId: null, exposureVerified: false });
    records.push({ observation, sessionRef: uuid(event.session_id) === uuid(current!.id) ? refs.sessionRef : null,
      kind, object: objects.get(objectId) ?? null,
      ...(clearTargets === undefined ? {} : { clearTargets }), ...(invalidates === undefined ? {} : { invalidates }) });
  }
  return { ...result, records };
}
