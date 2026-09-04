import { describe, expect, it, vi } from 'vitest';

import type { Event, EventSession } from '../../domain/contracts';
import type { EventPersistenceApi } from './eventPersistence';
import {
  createEventSession,
  createCorrelationId,
  createEventWriteCoordinator,
  createTrackedEvent,
  createUuidV7,
  getDwellEventProperties,
  getImpressionDeduplicationKey,
} from './eventTracking';

const session: EventSession = createEventSession(
  { actorUserId: 'user-1', profileId: 'profile-1' },
  '01994b4c-2a00-7000-8000-000000000001',
  '2026-08-29T21:45:00.000Z',
  { locale: 'fi-FI' },
);

const event: Event = createTrackedEvent(
  session,
  {
    eventType: 'ITEM_IMPRESSION',
    itemId: 'item-1',
    itemType: 'BOOK',
    predictionId: 'prediction-1',
    discoveryMode: 'FOR_YOU',
  },
  '01994b4c-2a01-7000-8000-000000000002',
  '2026-08-29T21:45:01.000Z',
  { locale: 'fi-FI' },
);

function createApi(): EventPersistenceApi {
  return {
    appendSession: vi.fn(async () => ({ error: null })),
    appendEvent: vi.fn(async () => ({ error: null })),
  };
}

describe('Event tracking contracts', () => {
  it('creates time-ordered UUIDv7-compatible identifiers', () => {
    const first = createUuidV7(1_700_000_000_000, () => 0);
    const second = createUuidV7(1_700_000_000_001, () => 0);

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(first < second).toBe(true);
  });

  it('derives stable and distinct UUID correlations for ranked contexts', () => {
    const seed = createUuidV7(1_700_000_000_000, () => 0.5);

    expect(createCorrelationId(seed, 'BOOK:FOR_YOU')).toBe(
      createCorrelationId(seed, 'BOOK:FOR_YOU'),
    );
    expect(createCorrelationId(seed, 'BOOK:FOR_YOU')).not.toBe(
      createCorrelationId(seed, 'BOOK:RISK'),
    );
    expect(createCorrelationId(seed, 'BOOK:FOR_YOU')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('maps actor, Profile, session and default Context into every Event', () => {
    expect(event).toMatchObject({
      actorUserId: 'user-1',
      profileId: 'profile-1',
      sessionId: session.sessionId,
      eventType: 'ITEM_IMPRESSION',
      itemId: 'item-1',
      itemType: 'BOOK',
      predictionId: 'prediction-1',
      context: { locale: 'fi-FI' },
    });
  });

  it('deduplicates only traceable Item impressions', () => {
    expect(
      getImpressionDeduplicationKey({
        eventType: 'ITEM_IMPRESSION',
        itemId: 'item-1',
        itemType: 'BOOK',
        predictionId: 'prediction-1',
      }),
    ).toBe('prediction-1:item-1');
    expect(
      getImpressionDeduplicationKey({
        eventType: 'ITEM_OPENED',
        itemId: 'item-1',
        itemType: 'BOOK',
        predictionId: 'prediction-1',
      }),
    ).toBeNull();
  });

  it('records bounded meaningful dwell without treating a flash as evidence', () => {
    expect(getDwellEventProperties(1_000, 1_999, 'ITEM_CHANGED')).toBeNull();
    expect(getDwellEventProperties(1_000, 16_000, 'ITEM_CHANGED')).toEqual({
      source: 'ITEM_DETAIL',
      dwellMs: 15_000,
      endReason: 'ITEM_CHANGED',
    });
    expect(
      getDwellEventProperties(0, 60 * 60 * 1_000, 'SCREEN_EXIT'),
    ).toMatchObject({ dwellMs: 30 * 60 * 1_000 });
  });
});

describe('Event write coordinator', () => {
  it('persists the session before flushing queued Events', async () => {
    let finishSession: (() => void) | undefined;
    const order: string[] = [];
    const api = createApi();
    vi.mocked(api.appendSession).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          order.push('session:start');
          finishSession = () => {
            order.push('session:finish');
            resolve({ error: null });
          };
        }),
    );
    vi.mocked(api.appendEvent).mockImplementation(async () => {
      order.push('event');
      return { error: null };
    });
    const coordinator = createEventWriteCoordinator(api, session, vi.fn());

    coordinator.enqueue(event);
    await Promise.resolve();
    expect(order).toEqual(['session:start']);

    finishSession?.();
    await coordinator.waitForIdle();

    expect(order).toEqual(['session:start', 'session:finish', 'event']);
  });

  it('retries the same stable Event after a transient failure', async () => {
    const api = createApi();
    vi.mocked(api.appendEvent)
      .mockResolvedValueOnce({ error: { message: 'offline' } })
      .mockResolvedValueOnce({ error: null });
    const snapshots: unknown[] = [];
    const coordinator = createEventWriteCoordinator(
      api,
      session,
      (snapshot) => snapshots.push(snapshot),
    );

    coordinator.enqueue(event);
    await coordinator.waitForIdle();
    coordinator.retry();
    await coordinator.waitForIdle();

    expect(api.appendEvent).toHaveBeenCalledTimes(2);
    expect(api.appendEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      id: event.eventId,
    }));
    expect(api.appendEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      id: event.eventId,
    }));
    expect(snapshots).toContainEqual({
      sessionPersisted: true,
      pendingEventCount: 0,
      message: null,
    });
  });
});
