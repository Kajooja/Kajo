import { describe, expect, it } from 'vitest';

import type { Event, EventSession } from '../../domain/contracts';
import {
  canUseEventOrigin,
  createEventSession,
  createCorrelationId,
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


describe('deferred Event/action origin admission', () => {
  const origin = { eventType: 'ITEM_LIKED' as const, itemId: 'item-a',
    predictionId: 'run-a', originSessionId: 'session-a' };

  it('accepts a retained destination only for its original session and Item', () => {
    expect(canUseEventOrigin(origin, 'session-a', 'item-a')).toBe(true);
    expect(canUseEventOrigin(origin, 'session-b', 'item-a')).toBe(false);
    expect(canUseEventOrigin(origin, 'session-a', 'item-b')).toBe(false);
    expect(canUseEventOrigin(origin, 'session-a', null)).toBe(false);
  });

  it('rejects a delayed origin even when submitted through a new-session callback', async () => {
    let currentSession = 'session-a';
    const accepted: string[] = [];
    let finish!: () => void;
    const delayedDestination = new Promise<void>(resolve => { finish = resolve; });
    const complete = delayedDestination.then(() => {
      if (canUseEventOrigin(origin, currentSession, 'item-a')) accepted.push(currentSession);
    });
    currentSession = 'session-b';
    finish();
    await complete;
    expect(accepted).toEqual([]);
  });

  it('does not attach a local origin to a later authenticated session', () => {
    const local = { ...origin, originSessionId: null };
    expect(canUseEventOrigin(local, null, 'item-a')).toBe(true);
    expect(canUseEventOrigin(local, 'session-a', 'item-a')).toBe(false);
  });

  it('leaves fresh non-delivered actions available without claiming a frozen session', () => {
    expect(canUseEventOrigin(undefined, 'session-b', 'item-b')).toBe(true);
    expect(canUseEventOrigin({ eventType: 'ITEM_LIKED', itemId: 'item-b' }, 'session-b', 'item-b')).toBe(true);
  });

  it('keeps the admission token out of persisted Event properties and identity', () => {
    const tracked = createTrackedEvent(session, { ...origin, originSessionId: session.sessionId, properties: { source: 'ITEM_DETAIL' } },
      'event-id', '2026-09-10T08:00:00.000Z', {});
    expect(tracked.sessionId).toBe(session.sessionId);
    expect(tracked).not.toHaveProperty('originSessionId');
    expect(tracked.properties).not.toHaveProperty('originSessionId');
  });
});
