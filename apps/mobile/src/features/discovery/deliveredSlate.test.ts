import { describe, expect, it } from 'vitest';
import { buildCollectionSequence, rememberCollectionSlate, buildDeliveredItemOrigins, getDeliveredItemOrigin, canUseDeliveredSlate, getDeliveredSlate, rememberDeliveredSlate, type DeliveredSlate } from './deliveredSlate';

const slate = (id: string): DeliveredSlate => ({ id, scopeKey: 'env:actor:profile', sessionId: 'session',
  predictionId: `prediction-${id}`, source: 'hosted', mode: 'SURPRISE', origins: {},
  items: [{ id: 'a', title: 'A', itemType: 'BOOK', tags: ['quiet'] },
    { id: 'b', title: 'B', itemType: 'BOOK', tags: [] }] });

describe('delivered navigation origin', () => {
  it('retains the clicked order/mode/run when the same Items are reranked', () => {
    rememberDeliveredSlate(slate('first'));
    const opened = getDeliveredSlate('first')!;
    rememberDeliveredSlate({ ...slate('second'), mode: 'RISK', items: [...slate('second').items].reverse() });
    expect(opened.items.map(item => item.id)).toEqual(['a', 'b']);
    expect(opened.predictionId).toBe('prediction-first');
    expect(opened.mode).toBe('SURPRISE');
  });
  it('copies the input so later presentation updates cannot change a delivery', () => {
    const tags = ['quiet'];
    const input = slate('copy');
    input.items[0]!.tags = tags;
    rememberDeliveredSlate(input);
    input.items[0]!.title = 'Changed';
    tags.push('new');
    expect(getDeliveredSlate('copy')!.items[0]).toMatchObject({ title: 'A', tags: ['quiet'] });
  });
  it('rejects another actor, Profile, environment or session and Items outside the slate', () => {
    const origin = slate('scope');
    for (const scope of ['env:other:profile', 'env:actor:other', 'other:actor:profile']) {
      expect(canUseDeliveredSlate(origin, scope, 'session', 'a')).toBe(false);
    }
    expect(canUseDeliveredSlate(origin, origin.scopeKey, 'other-session', 'a')).toBe(false);
    expect(canUseDeliveredSlate(origin, origin.scopeKey, 'session', 'not-delivered')).toBe(false);
    expect(canUseDeliveredSlate(origin, origin.scopeKey, 'session', 'a')).toBe(true);
  });
  it('never accepts a hosted origin without an authenticated scope/session', () => {
    expect(canUseDeliveredSlate({ ...slate('missing'), scopeKey: null, sessionId: null }, null, null, 'a')).toBe(false);
  });
  it('fails closed after eviction without replacing a mounted snapshot', () => {
    rememberDeliveredSlate(slate('evicted'));
    const mounted = getDeliveredSlate('evicted')!;
    for (let i = 0; i < 8; i++) rememberDeliveredSlate(slate(`new-${i}`));
    expect(getDeliveredSlate('evicted')).toBeUndefined();
    expect(getDeliveredSlate('unknown')).toBeUndefined();
    expect(mounted.predictionId).toBe('prediction-evicted');
    expect(canUseDeliveredSlate(mounted, mounted.scopeKey, 'session', 'a')).toBe(true);
  });
  it('rejects reuse of a delivery token instead of replacing its origin', () => {
    rememberDeliveredSlate(slate('duplicate'));
    expect(() => rememberDeliveredSlate({ ...slate('duplicate'), mode: 'RISK' })).toThrow();
    expect(getDeliveredSlate('duplicate')!.mode).toBe('SURPRISE');
  });
});

describe('Shared per-Item delivery origin', () => {
  const ranked = { id: 'ranked', title: 'Ranked', itemType: 'BOOK' as const };
  const pending = { id: 'pending', title: 'Pending', itemType: 'BOOK' as const };
  const history = { id: 'history', title: 'History', itemType: 'BOOK' as const };
  const state = (item: typeof ranked, pendingEndorsement: boolean) => ({
    item, pendingEndorsement, ineligibleForDiscovery: false, currentActorEndorsed: false,
    consensusSaved: false, memberConsumedUserIds: pendingEndorsement ? [] : ['private-member'],
    memberMaxRating: 5, endorserUserIds: ['private-endorser'], firstEndorsedAt: null,
    proposedListId: 'private-list', proposedListName: 'Private list', proposedByUserId: 'private-author',
  });

  it('does not assign a ranking Prediction to injected pending/history Items', () => {
    const origins = buildDeliveredItemOrigins([ranked, pending, history], [ranked], 'run', 'hosted', {
      pending: state(pending, true), history: state(history, false),
    });
    expect(origins.ranked).toEqual({ predictionId: 'run', properties: { predictionSource: 'hosted', deliveryTier: 'RANKED' } });
    expect(origins.pending).toEqual({ properties: { predictionSource: 'shared_overlay', deliveryTier: 'SHARED_PENDING' } });
    expect(origins.history).toEqual({ properties: { predictionSource: 'shared_overlay', deliveryTier: 'SHARED_MEMBER_HISTORY' } });
    expect(JSON.stringify(origins)).not.toContain('private');
  });

  it('retains selected-run provenance when Shared reorders an actual ranked Item', () => {
    const origins = buildDeliveredItemOrigins([pending], [pending], 'run', 'hosted', { pending: state(pending, true) });
    expect(origins.pending).toEqual({ predictionId: 'run', properties: { predictionSource: 'hosted', deliveryTier: 'SHARED_PENDING' } });
  });

  it('freezes the opened tier and Prediction through Shared updates and reranking', () => {
    const shared = { pending: state(pending, true) };
    const origins = buildDeliveredItemOrigins([pending], [], 'old-run', 'hosted', shared);
    rememberDeliveredSlate({ ...slate('shared-frozen'), items: [pending], origins });
    shared.pending.pendingEndorsement = false;
    const next = buildDeliveredItemOrigins([pending], [pending], 'new-run', 'hosted', shared);
    expect(next.pending?.predictionId).toBe('new-run');
    expect(getDeliveredSlate('shared-frozen')!.origins.pending).toEqual({ properties: { predictionSource: 'shared_overlay', deliveryTier: 'SHARED_PENDING' } });
    expect(Object.isFrozen(getDeliveredSlate('shared-frozen')!.origins.pending!.properties)).toBe(true);
  });

  it('fails closed for missing origins without borrowing the slate Prediction', () => {
    expect(getDeliveredItemOrigin({}, 'missing')).toEqual({ properties: { predictionSource: 'unattributed', deliveryTier: 'UNATTRIBUTED' } });
    expect(getDeliveredItemOrigin({}, 'toString').predictionId).toBeUndefined();
  });

  it('keeps fallback correlation local to Items actually in the fallback ranking', () => {
    const origins = buildDeliveredItemOrigins([ranked, pending], [ranked], 'local-run', 'fallback', { pending: state(pending, true) });
    expect(origins.ranked?.predictionId).toBe('local-run');
    expect(origins.ranked?.properties.predictionSource).toBe('fallback');
    expect(origins.pending?.predictionId).toBeUndefined();
  });

  it('copies caller-owned origin properties and excludes Items outside the delivered slate', () => {
    const origin = { predictionId: 'run', properties: { predictionSource: 'hosted' as const, deliveryTier: 'RANKED' as const } };
    const origins = { ranked: origin, other: origin };
    rememberDeliveredSlate({ ...slate('origin-copy'), items: [ranked], origins });
    origin.predictionId = 'changed';
    expect(getDeliveredSlate('origin-copy')!.origins.ranked?.predictionId).toBe('run');
    expect(getDeliveredSlate('origin-copy')!.origins.other).toBeUndefined();
  });
});

describe('loaded collection navigation', () => {
  it('carries server-only Items without a borrowed Prediction or mock lookup', () => {
    rememberCollectionSlate({ id: 'collection-one', scopeKey: 'env:actor:profile', sessionId: 'session',
      mode: 'RISK', collectionTitle: 'Luetut', items: [{ id: 'server-book', title: 'Server book', itemType: 'BOOK' }] });
    const result = getDeliveredSlate('collection-one')!;
    expect(result.items[0]?.title).toBe('Server book');
    expect(result.predictionId).toBeNull();
    expect(getDeliveredItemOrigin(result.origins, 'server-book')).toEqual({
      properties: { predictionSource: 'collection', deliveryTier: 'COLLECTION' },
    });
    expect(canUseDeliveredSlate(result, 'env:actor:profile', 'session', 'server-book')).toBe(true);
    expect(canUseDeliveredSlate(result, 'env:actor:other', 'session', 'server-book')).toBe(false);
    expect(canUseDeliveredSlate(result, 'env:actor:profile', 'new-session', 'server-book')).toBe(false);
  });

  it('retains every collection Item for swiping, including previously consumed Items', () => {
    const items = slate('collection-order').items;
    expect(buildCollectionSequence(items[1]!, items).map(item => item.id)).toEqual(['b', 'a']);
    expect(items.map(item => item.id)).toEqual(['a', 'b']);
  });
});
