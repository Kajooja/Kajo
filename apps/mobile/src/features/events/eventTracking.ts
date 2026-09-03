import type {
  Context,
  DiscoveryMode,
  Event,
  EventId,
  EventSession,
  EventType,
  ItemId,
  ItemType,
  PredictionId,
  ProfileId,
  SessionId,
  UserId,
} from '../../domain/contracts';
import {
  persistEvent,
  persistEventSession,
  type EventPersistenceApi,
} from './eventPersistence';

export interface EventTrackingScope {
  actorUserId: UserId;
  profileId: ProfileId;
}

export interface EventRecordInput {
  eventType: EventType;
  itemId?: ItemId;
  itemType?: ItemType;
  predictionId?: PredictionId;
  discoveryMode?: DiscoveryMode;
  context?: Context;
  properties?: Readonly<Record<string, unknown>>;
}

export interface EventWriteSnapshot {
  sessionPersisted: boolean;
  pendingEventCount: number;
  message: string | null;
}

export interface EventWriteCoordinator {
  enqueue(event: Event): void;
  retry(): void;
  waitForIdle(): Promise<void>;
  dispose(): void;
}

export const MIN_MEANINGFUL_DWELL_MS = 1_000;
export const MAX_RECORDED_DWELL_MS = 30 * 60 * 1_000;

export function getDwellEventProperties(
  startedAtMs: number,
  endedAtMs: number,
  endReason: 'ITEM_CHANGED' | 'SCREEN_EXIT' | 'APP_BACKGROUND',
): Readonly<Record<string, unknown>> | null {
  const dwellMs = Math.min(
    MAX_RECORDED_DWELL_MS,
    Math.max(0, Math.round(endedAtMs - startedAtMs)),
  );

  if (dwellMs < MIN_MEANINGFUL_DWELL_MS) {
    return null;
  }

  return {
    source: 'ITEM_DETAIL',
    dwellMs,
    endReason,
  };
}

export function createEventSession(
  scope: EventTrackingScope,
  sessionId: SessionId,
  startedAt: string,
  context: Context,
): EventSession {
  return {
    sessionId,
    actorUserId: scope.actorUserId,
    profileId: scope.profileId,
    startedAt,
    context,
  };
}

export function createTrackedEvent(
  session: EventSession,
  input: EventRecordInput,
  eventId: EventId,
  timestamp: string,
  defaultContext: Context,
): Event {
  return {
    eventId,
    actorUserId: session.actorUserId,
    profileId: session.profileId,
    eventType: input.eventType,
    timestamp,
    sessionId: session.sessionId,
    context: input.context ?? defaultContext,
    ...(input.itemId ? { itemId: input.itemId } : {}),
    ...(input.itemType ? { itemType: input.itemType } : {}),
    ...(input.predictionId ? { predictionId: input.predictionId } : {}),
    ...(input.discoveryMode ? { discoveryMode: input.discoveryMode } : {}),
    ...(input.properties ? { properties: input.properties } : {}),
  };
}

export function getImpressionDeduplicationKey(
  input: EventRecordInput,
): string | null {
  if (
    input.eventType !== 'ITEM_IMPRESSION' ||
    !input.itemId ||
    !input.predictionId
  ) {
    return null;
  }

  return `${input.predictionId}:${input.itemId}`;
}

export function createUuidV7(
  nowMs = Date.now(),
  random: () => number = Math.random,
): string {
  const bytes = new Uint8Array(16);
  let timestamp = Math.max(0, Math.floor(nowMs));

  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }

  for (let index = 6; index < bytes.length; index += 1) {
    const value = Math.max(0, Math.min(0.9999999999999999, random()));
    bytes[index] = Math.floor(value * 256);
  }

  bytes[6] = (bytes[6] ?? 0) | 0x70;
  bytes[6] &= 0x7f;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join(''),
  ].join('-');
}

export function createCorrelationId(seed: string, key: string): string {
  const bytes = seed
    .replaceAll('-', '')
    .match(/.{2}/g)
    ?.map((value) => Number.parseInt(value, 16));

  if (!bytes || bytes.length !== 16) {
    throw new Error('Correlation seed must be a UUID.');
  }

  for (let index = 0; index < key.length; index += 1) {
    const byteIndex = index % bytes.length;
    bytes[byteIndex] =
      (bytes[byteIndex] ?? 0) ^ (key.charCodeAt(index) & 0xff);
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join(''),
  ].join('-');
}

export function createEventWriteCoordinator(
  api: EventPersistenceApi,
  session: EventSession,
  onChange: (snapshot: EventWriteSnapshot) => void,
): EventWriteCoordinator {
  let active = true;
  let sessionPersisted = false;
  let sessionInFlight = false;
  let message: string | null = null;
  let tail: Promise<void> = Promise.resolve();
  const pendingEvents = new Map<EventId, Event>();
  const inFlightEvents = new Set<EventId>();

  function publish() {
    if (!active) return;

    onChange({
      sessionPersisted,
      pendingEventCount: pendingEvents.size,
      message,
    });
  }

  function schedule(
    operation: () => Promise<void>,
  ): void {
    const next = tail.then(operation);
    tail = next.catch(() => undefined);
  }

  function ensureSession() {
    if (!active || sessionPersisted || sessionInFlight) return;

    sessionInFlight = true;
    publish();

    schedule(async () => {
      const result = await persistEventSession(api, session);

      if (!active) return;

      sessionInFlight = false;

      if (result.status === 'error') {
        message = result.message;
        publish();
        return;
      }

      sessionPersisted = true;
      message = null;
      publish();
      flushEvents();
    });
  }

  function flushEvents() {
    if (!active || !sessionPersisted) return;

    for (const event of pendingEvents.values()) {
      if (inFlightEvents.has(event.eventId)) continue;

      inFlightEvents.add(event.eventId);
      schedule(async () => {
        const result = await persistEvent(api, event);

        if (!active) return;

        inFlightEvents.delete(event.eventId);

        if (result.status === 'error') {
          message = result.message;
          publish();
          return;
        }

        pendingEvents.delete(event.eventId);

        if (pendingEvents.size === 0) {
          message = null;
        }

        publish();
      });
    }
  }

  return {
    enqueue(event) {
      if (!active) return;

      pendingEvents.set(event.eventId, event);
      publish();
      ensureSession();

      if (sessionPersisted) {
        flushEvents();
      }
    },
    retry() {
      if (!active) return;

      message = null;

      if (!sessionPersisted) {
        ensureSession();
      } else {
        flushEvents();
      }

      publish();
    },
    async waitForIdle() {
      while (active) {
        const observedTail = tail;
        await observedTail;

        if (observedTail === tail) {
          return;
        }
      }
    },
    dispose() {
      active = false;
      pendingEvents.clear();
      inFlightEvents.clear();
    },
  };
}
