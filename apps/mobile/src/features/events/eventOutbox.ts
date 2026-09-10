import type { ItemActionResult } from './itemActionPersistence';
import type { Event, EventSession } from '../../domain/contracts';
import { isRecord, isTimestamp, isUuid, type ItemActionScope } from './itemActionCommands';
import { createItemActionOutbox, type ItemActionStorage } from './itemActionOutbox';
import { persistEvent, persistEventSession, type EventPersistenceApi } from './eventPersistence';
import type { EventActionOrigin, EventWriteCoordinator, EventWriteSnapshot } from './eventTracking';

interface PendingEvent {
  command: ItemActionScope & {
    kind: 'APPEND_EVENT';
    actionId: string;
    session: EventSession;
    event: Event;
  };
}

const eventTypes = new Set(['ITEM_IMPRESSION', 'ITEM_OPENED', 'ITEM_DWELL', 'ITEM_LIKED',
  'ITEM_DISLIKED', 'ITEM_INTEREST_CLEARED', 'ITEM_NOT_INTERESTED', 'ITEM_SAVED', 'ITEM_UNSAVED',
  'ITEM_SUGGESTED', 'ITEM_ENDORSED', 'ITEM_ENDORSEMENT_REVERSED', 'ITEM_CONSUMED',
  'ITEM_CONSUMPTION_REVERSED', 'ITEM_INTERACTION_UNDONE', 'ITEM_RATED', 'ITEM_ADDED_TO_LIST',
  'ITEM_REMOVED_FROM_LIST', 'LIST_CREATED', 'LIST_RENAMED', 'LIST_DELETED', 'SEARCH_PERFORMED',
  'DISCOVERY_MODE_CHANGED']);

function isPendingEvent(value: unknown, scope: ItemActionScope): value is PendingEvent {
  if (!isRecord(value) || !isRecord(value.command)) return false;
  const c = value.command;
  if (c.kind !== 'APPEND_EVENT' || c.actorUserId !== scope.actorUserId || c.profileId !== scope.profileId
    || !isUuid(c.actionId) || !isRecord(c.session) || !isRecord(c.event)) return false;
  const s = c.session, e = c.event;
  return isUuid(s.sessionId) && isUuid(s.actorUserId) && isUuid(s.profileId)
    && s.actorUserId === scope.actorUserId && s.profileId === scope.profileId
    && isTimestamp(s.startedAt) && isRecord(s.context)
    && e.eventId === c.actionId && e.actorUserId === s.actorUserId && e.profileId === s.profileId
    && e.sessionId === s.sessionId && isTimestamp(e.timestamp)
    && Date.parse(e.timestamp) >= Date.parse(s.startedAt) && isRecord(e.context)
    && typeof e.eventType === 'string' && eventTypes.has(e.eventType)
    && (e.itemId === undefined || isUuid(e.itemId))
    && (e.predictionId === undefined || isUuid(e.predictionId))
    && (e.itemType === undefined || ['BOOK', 'MOVIE'].includes(String(e.itemType)))
    && (e.discoveryMode === undefined || ['FOR_YOU', 'SURPRISE', 'RISK'].includes(String(e.discoveryMode)))
    && (e.properties === undefined || isRecord(e.properties));
}

export function createEventWriteCoordinator(
  api: EventPersistenceApi,
  session: EventSession,
  onChange: (snapshot: EventWriteSnapshot) => void,
  options: { namespace: string; storage: ItemActionStorage; isCurrent?: () => boolean },
): EventWriteCoordinator {
  let active = false;
  let sessionPersisted = false;
  const isCurrent = () => active && options.isCurrent?.() !== false;
  const queue = createItemActionOutbox<PendingEvent, string>({
    // Separate storage identity, same bounded/retry-safe queue implementation.
    namespace: JSON.stringify(['event-evidence-v1', options.namespace]),
    scope: { actorUserId: session.actorUserId, profileId: session.profileId },
    storage: options.storage,
    isPendingAction: isPendingEvent,
    isCurrent,
    async send(command) {
      const sessionResult = await persistEventSession(api, command.session);
      if (sessionResult.status === 'error') return { ...sessionResult, retryable: true };
      if (!isCurrent()) return { status: 'error', retryable: true, message: 'Tapahtuma odottaa alkuperäistä profiilia.' };
      if (command.session.sessionId === session.sessionId) sessionPersisted = true;
      const result = await persistEvent(api, command.event);
      return result.status === 'success'
        ? { status: 'success', receipt: command.actionId }
        : { ...result, retryable: true };
    },
    onCommitted() {},
    onChange(snapshot) {
      onChange({ sessionPersisted, pendingEventCount: snapshot.pendingCount,
        message: snapshot.message ? 'Tapahtumien tallennus odottaa. Tarkista yhteys ja yritä uudelleen.' : null });
    },
  });
  return {
    canSendAction(origin) {
      if (!isCurrent() || origin.actorUserId !== session.actorUserId || origin.profileId !== session.profileId) return false;
      if (!origin.predictionId || !origin.itemId) return true;
      // Read durable state on every dispatch, including after restart or a lost
      // acknowledgement. Removal happens only after the Event is acknowledged.
      const pending = queue.pending();
      if (!queue.snapshot().ready) return false;
      return !pending.some(({ command: { event } }) => event.eventType === 'ITEM_IMPRESSION'
        && event.sessionId === origin.session.sessionId && event.itemId === origin.itemId
        && event.predictionId === origin.predictionId
        && Date.parse(event.timestamp) <= Date.parse(origin.occurredAt));
    },
    start() { active = true; queue.start(); },
    enqueue(event) {
      if (event.sessionId !== session.sessionId || event.actorUserId !== session.actorUserId
        || event.profileId !== session.profileId) return false;
      return queue.enqueue({ command: { kind: 'APPEND_EVENT', actionId: event.eventId,
        actorUserId: session.actorUserId, profileId: session.profileId, session, event } });
    },
    retry: () => queue.retry(),
    waitForIdle: () => queue.waitForIdle(),
    dispose() { active = false; queue.stop(); },
  };
}


export function createExposureOrderedSender<T extends EventActionOrigin, R>(
  canSendAction: (origin: EventActionOrigin) => boolean,
  send: (command: T) => Promise<ItemActionResult<R>>,
  isCurrent: () => boolean,
): (command: T) => Promise<ItemActionResult<R>> {
  return async command => {
    if (!isCurrent() || !canSendAction(command)) {
      return { status: 'error', retryable: true,
        message: 'Valinta odottaa suosituksen näyttötiedon tallennusta. Yritämme uudelleen.' };
    }
    return send(command);
  };
}
