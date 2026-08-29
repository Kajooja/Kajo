import type { SupabaseClient } from '@supabase/supabase-js';

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

interface PersistenceErrorLike {
  message: string;
}

interface MutationResponse {
  error: PersistenceErrorLike | null;
}

export interface PersistedEventSessionRow {
  id: SessionId;
  actor_user_id: UserId;
  profile_id: ProfileId;
  started_at: string;
  context: Context;
}

export interface PersistedEventRow {
  id: EventId;
  actor_user_id: UserId;
  profile_id: ProfileId;
  item_id: ItemId | null;
  item_type: ItemType | null;
  event_type: EventType;
  occurred_at: string;
  session_id: SessionId | null;
  prediction_id: PredictionId | null;
  discovery_mode: DiscoveryMode | null;
  context: Context;
  properties: Readonly<Record<string, unknown>>;
}

export interface EventPersistenceApi {
  appendSession(row: PersistedEventSessionRow): PromiseLike<MutationResponse>;
  appendEvent(row: PersistedEventRow): PromiseLike<MutationResponse>;
}

export type EventPersistenceResult =
  | { status: 'success' }
  | { status: 'error'; message: string };

const EVENT_PERSISTENCE_ERROR_MESSAGE =
  'Tapahtumaa ei voitu tallentaa. Tarkista yhteys ja yritä uudelleen.';

export function createSupabaseEventPersistenceApi(
  client: SupabaseClient,
): EventPersistenceApi {
  return {
    async appendSession(row) {
      const { error } = await client
        .from('event_sessions')
        .upsert(row, { onConflict: 'id', ignoreDuplicates: true });

      return { error: error ? { message: error.message } : null };
    },
    async appendEvent(row) {
      const { error } = await client
        .from('events')
        .upsert(row, { onConflict: 'id', ignoreDuplicates: true });

      return { error: error ? { message: error.message } : null };
    },
  };
}

export async function persistEventSession(
  api: EventPersistenceApi,
  session: EventSession,
): Promise<EventPersistenceResult> {
  return persist(() => api.appendSession(serializeEventSession(session)));
}

export async function persistEvent(
  api: EventPersistenceApi,
  event: Event,
): Promise<EventPersistenceResult> {
  return persist(() => api.appendEvent(serializeEvent(event)));
}

export function serializeEventSession(
  session: EventSession,
): PersistedEventSessionRow {
  return {
    id: session.sessionId,
    actor_user_id: session.actorUserId,
    profile_id: session.profileId,
    started_at: session.startedAt,
    context: session.context,
  };
}

export function serializeEvent(event: Event): PersistedEventRow {
  return {
    id: event.eventId,
    actor_user_id: event.actorUserId,
    profile_id: event.profileId,
    item_id: event.itemId ?? null,
    item_type: event.itemType ?? null,
    event_type: event.eventType,
    occurred_at: event.timestamp,
    session_id: event.sessionId ?? null,
    prediction_id: event.predictionId ?? null,
    discovery_mode: event.discoveryMode ?? null,
    context: event.context,
    properties: event.properties ?? {},
  };
}

async function persist(
  operation: () => PromiseLike<MutationResponse>,
): Promise<EventPersistenceResult> {
  try {
    const response = await operation();

    return response.error
      ? { status: 'error', message: EVENT_PERSISTENCE_ERROR_MESSAGE }
      : { status: 'success' };
  } catch {
    return { status: 'error', message: EVENT_PERSISTENCE_ERROR_MESSAGE };
  }
}
