import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import type { Event, EventSession } from '../../domain/contracts';
import {
  createSupabaseEventPersistenceApi,
  persistEvent,
  persistEventSession,
  serializeEvent,
  serializeEventSession,
  type EventPersistenceApi,
} from './eventPersistence';

const session: EventSession = {
  sessionId: 'session-1',
  actorUserId: 'user-1',
  profileId: 'profile-1',
  startedAt: '2026-08-29T21:20:00.000Z',
  context: { locale: 'fi-FI', timezone: 'Europe/Helsinki' },
};

const event: Event = {
  eventId: 'event-1',
  actorUserId: 'user-1',
  profileId: 'profile-1',
  itemId: 'item-1',
  itemType: 'BOOK',
  eventType: 'ITEM_SAVED',
  timestamp: '2026-08-29T21:21:00.000Z',
  sessionId: 'session-1',
  predictionId: 'prediction-1',
  discoveryMode: 'SURPRISE',
  context: { locale: 'fi-FI' },
  properties: { source: 'ITEM_DETAIL' },
};

function createApi(): EventPersistenceApi {
  return {
    appendSession: vi.fn(async () => ({ error: null })),
    appendEvent: vi.fn(async () => ({ error: null })),
  };
}

describe('Event persistence serialization', () => {
  it('maps a session to the database contract', () => {
    expect(serializeEventSession(session)).toEqual({
      id: 'session-1',
      actor_user_id: 'user-1',
      profile_id: 'profile-1',
      started_at: '2026-08-29T21:20:00.000Z',
      context: { locale: 'fi-FI', timezone: 'Europe/Helsinki' },
    });
  });

  it('maps one generic Item Event with traceability fields', () => {
    expect(serializeEvent(event)).toEqual({
      id: 'event-1',
      actor_user_id: 'user-1',
      profile_id: 'profile-1',
      item_id: 'item-1',
      item_type: 'BOOK',
      event_type: 'ITEM_SAVED',
      occurred_at: '2026-08-29T21:21:00.000Z',
      session_id: 'session-1',
      prediction_id: 'prediction-1',
      discovery_mode: 'SURPRISE',
      context: { locale: 'fi-FI' },
      properties: { source: 'ITEM_DETAIL' },
    });
  });

  it('uses explicit nulls/default properties for a non-Item Event', () => {
    const modeEvent: Event = {
      eventId: 'event-2',
      actorUserId: 'user-1',
      profileId: 'profile-1',
      eventType: 'DISCOVERY_MODE_CHANGED',
      timestamp: '2026-08-29T21:22:00.000Z',
      discoveryMode: 'RISK',
      context: {},
    };

    expect(serializeEvent(modeEvent)).toMatchObject({
      item_id: null,
      item_type: null,
      session_id: null,
      prediction_id: null,
      discovery_mode: 'RISK',
      properties: {},
    });
  });
});

describe('Event persistence boundary', () => {
  it('appends the mapped session and Event', async () => {
    const api = createApi();

    await expect(persistEventSession(api, session)).resolves.toEqual({
      status: 'success',
    });
    await expect(persistEvent(api, event)).resolves.toEqual({
      status: 'success',
    });
    expect(api.appendSession).toHaveBeenCalledWith(serializeEventSession(session));
    expect(api.appendEvent).toHaveBeenCalledWith(serializeEvent(event));
  });

  it('returns one deterministic result for backend and connection failures', async () => {
    const api = createApi();
    vi.mocked(api.appendEvent).mockResolvedValueOnce({
      error: { message: 'database error' },
    });

    await expect(persistEvent(api, event)).resolves.toMatchObject({
      status: 'error',
    });

    vi.mocked(api.appendEvent).mockRejectedValueOnce(new Error('offline'));

    await expect(persistEvent(api, event)).resolves.toMatchObject({
      status: 'error',
    });
  });

  it('uses insert-or-ignore by stable ID for retry-safe append behavior', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ upsert }));
    const api = createSupabaseEventPersistenceApi({
      from,
    } as unknown as SupabaseClient);

    await api.appendSession(serializeEventSession(session));
    await api.appendEvent(serializeEvent(event));

    expect(from).toHaveBeenNthCalledWith(1, 'event_sessions');
    expect(from).toHaveBeenNthCalledWith(2, 'events');
    expect(upsert).toHaveBeenNthCalledWith(1, serializeEventSession(session), {
      onConflict: 'id',
      ignoreDuplicates: true,
    });
    expect(upsert).toHaveBeenNthCalledWith(2, serializeEvent(event), {
      onConflict: 'id',
      ignoreDuplicates: true,
    });
  });
});
