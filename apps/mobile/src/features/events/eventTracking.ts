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


export interface EventTrackingScope {
  actorUserId: UserId;
  profileId: ProfileId;
}

export interface EventRecordInput {
  // Client admission guard only; persisted Events keep the actual session envelope.
  originSessionId?: SessionId | null;
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

export interface EventActionOrigin {
  actorUserId: string;
  profileId: string;
  itemId: string | null;
  predictionId: string | null;
  occurredAt: string;
  session: { sessionId: string };
}

export interface EventWriteCoordinator {
  canSendAction(origin: EventActionOrigin): boolean;
  subscribeToAcknowledgements(listener: () => void): () => void;
  start(): void;
  enqueue(event: Event): boolean;
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

export function canUseEventOrigin(
  origin: EventRecordInput | undefined,
  sessionId: SessionId | null,
  itemId?: ItemId | null,
): boolean {
  if (!origin) return true;
  if (origin.originSessionId !== undefined && origin.originSessionId !== sessionId) return false;
  return !origin.itemId || itemId === undefined || origin.itemId === itemId;
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
