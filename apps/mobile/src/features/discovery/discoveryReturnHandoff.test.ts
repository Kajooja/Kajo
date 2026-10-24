import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiscoveryReturnHandoff, takeDiscoveryReturnHandoff, type DiscoveryReturnScope } from './discoveryReturnHandoff';
import type { FeedDelivery } from './discoveryFeed';

const scope: DiscoveryReturnScope = { environment: 'https://fixture.invalid', actorUserId: 'actor', profileId: 'profile',
  sessionId: 'session', itemType: 'MOVIE', mode: 'FOR_YOU', bootstrapRevision: 0 };
const delivery = (id: string): FeedDelivery => ({ item: { id, itemType: 'MOVIE', title: id }, returnExpiresAt: Date.now() + 840_000,
  origin: { predictionId: `prediction:${id}`, deliveryRequestId: `request:${id}`,
    properties: { predictionSource: 'hosted', deliveryTier: 'RANKED' } } });

afterEach(() => { takeDiscoveryReturnHandoff(scope); vi.useRealTimers(); });

describe('bounded Discovery return handoff', () => {
  it('transfers at most five exact origins once without exposing mutable publisher objects', () => {
    const publisher = createDiscoveryReturnHandoff(scope);
    const values = Array.from({ length: 8 }, (_, i) => delivery(`${i}`));
    publisher.publish(values); publisher.release();
    values[0]!.item.title = 'changed';
    const result = takeDiscoveryReturnHandoff(scope)!;
    expect(result.deliveries).toHaveLength(5);
    expect(result.deliveries[0]!.item.title).toBe('0');
    expect(result.deliveries[0]!.origin).toEqual(values[0]!.origin);
    expect(Object.isFrozen(result.deliveries[0]!.origin.properties)).toBe(true);
    expect(takeDiscoveryReturnHandoff(scope)).toBeNull();
    publisher.publish([delivery('late')]);
    expect(takeDiscoveryReturnHandoff(scope)).toBeNull();
  });

  it.each(['environment', 'actorUserId', 'profileId', 'sessionId', 'itemType', 'mode', 'bootstrapRevision'] as const)(
    'rejects a changed %s and cannot restore the slot on A -> B -> A', key => {
      createDiscoveryReturnHandoff(scope).publish([delivery('item')]);
      expect(takeDiscoveryReturnHandoff({ ...scope, [key]: key === 'bootstrapRevision' ? 1 : 'other' })).toBeNull();
      expect(takeDiscoveryReturnHandoff(scope)).toBeNull();
    });

  it('ignores replaced owners and clears invalidated, consumed or empty windows', () => {
    const old = createDiscoveryReturnHandoff(scope);
    const current = createDiscoveryReturnHandoff(scope);
    current.publish([delivery('current')]);
    old.publish([delivery('old')]); old.clear(); old.release();
    expect(takeDiscoveryReturnHandoff(scope)!.deliveries[0]!.item.id).toBe('current');
    const next = createDiscoveryReturnHandoff(scope);
    next.publish([delivery('next')]); next.publish([]);
    expect(takeDiscoveryReturnHandoff(scope)).toBeNull();
  });

  it('rejects missing, unattributed, wrong-domain and expired delivery sources', () => {
    const wrong = delivery('wrong'); wrong.item.itemType = 'BOOK';
    const missing = delivery('missing'); delete missing.returnExpiresAt;
    const expired = { ...delivery('expired'), returnExpiresAt: Date.now() };
    const unattributed = { ...delivery('unattributed'), origin: { properties: { predictionSource: 'unattributed', deliveryTier: 'UNATTRIBUTED' } } } as FeedDelivery;
    createDiscoveryReturnHandoff(scope).publish([wrong, missing, expired, unattributed, delivery('valid')]);
    expect(takeDiscoveryReturnHandoff(scope)!.deliveries.map(entry => entry.item.id)).toEqual(['valid']);
  });

  it('caps the handoff by the original source age and never renews it through repeated publication', () => {
    vi.useFakeTimers(); vi.setSystemTime(100_000);
    const publisher = createDiscoveryReturnHandoff(scope);
    const old = delivery('old'); old.returnExpiresAt = 125_000;
    publisher.publish([old]); vi.setSystemTime(120_000); publisher.publish([old]);
    expect(takeDiscoveryReturnHandoff(scope)!.expiresAt).toBe(125_000);
    const next = createDiscoveryReturnHandoff(scope); const fresh = delivery('fresh');
    next.publish([fresh]); vi.setSystemTime(170_000); next.publish([fresh]);
    expect(takeDiscoveryReturnHandoff(scope)!.expiresAt).toBe(180_000);
    const expiring = createDiscoveryReturnHandoff(scope); expiring.publish([fresh]);
    vi.setSystemTime(230_000);
    expect(takeDiscoveryReturnHandoff(scope)).toBeNull();
  });
});
