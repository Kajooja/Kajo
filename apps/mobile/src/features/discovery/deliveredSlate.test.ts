import { describe, expect, it } from 'vitest';
import { canUseDeliveredSlate, getDeliveredSlate, rememberDeliveredSlate, type DeliveredSlate } from './deliveredSlate';

const slate = (id: string): DeliveredSlate => ({ id, scopeKey: 'env:actor:profile', sessionId: 'session',
  predictionId: `prediction-${id}`, source: 'hosted', mode: 'SURPRISE',
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
