import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemInteractionProvider, type useItemInteractions } from './ItemInteractionContext';
import { getInteractionEvidenceKey } from './predictionRefresh';
import { projectPendingItemActions, type ItemActionCommand } from '../events/itemActionCommands';
import type { ItemActionResult } from '../events/itemActionPersistence';
import type { ItemActionOutbox } from '../events/itemActionOutbox';

const fixture = vi.hoisted(() => ({
  actor: '00000000-0000-4000-8000-000000000001', profile: '00000000-0000-4000-8000-000000000002',
  sessionId: '00000000-0000-4000-8000-000000000003',
  send: vi.fn(), load: vi.fn(), queues: [] as Pick<ItemActionOutbox, 'stop' | 'waitForIdle' | 'retry'>[], rows: new Map<string, string>(),
  connection: { status: 'configured', client: {}, config: { url: 'https://fixture.invalid' } },
  api: {}, active: {} as Record<string, unknown>, tracking: {} as Record<string, unknown>,
}));
const hooks = vi.hoisted(() => ({
  states: [] as unknown[], memos: [] as { deps: readonly unknown[]; value: unknown }[],
  effects: [] as { deps: readonly unknown[] | undefined; cleanup: (() => void) | undefined }[],
  pending: new Map<number, () => void>(), stateIndex: 0, memoIndex: 0, effectIndex: 0,
}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const same = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) =>
    Boolean(a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index])));
  const effect = (run: () => void | (() => void), deps?: readonly unknown[]) => {
    const index = hooks.effectIndex++, previous = hooks.effects[index];
    if (same(previous?.deps, deps)) return;
    hooks.effects[index] = { deps, cleanup: previous?.cleanup };
    hooks.pending.set(index, () => {
      previous?.cleanup?.(); const cleanup = run();
      hooks.effects[index]!.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
    });
  };
  return { ...actual,
    useState: (initial: unknown) => {
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.states[index], (next: unknown) => {
        hooks.states[index] = typeof next === 'function' ? next(hooks.states[index]) : next;
      }];
    },
    useRef: (initial: unknown) => {
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = { current: initial };
      return hooks.states[index];
    },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
      const index = hooks.memoIndex++;
      if (!same(hooks.memos[index]?.deps, deps)) hooks.memos[index] = { deps, value: factory() };
      return hooks.memos[index]!.value;
    },
    useCallback: (callback: unknown) => callback,
    useEffect: effect, useLayoutEffect: effect,
  };
});
vi.mock('@/data/SupabaseProvider', () => ({ useSupabaseConnection: () => fixture.connection }));
vi.mock('@/features/profiles/ActiveProfileContext', () => ({ useActiveProfile: () => fixture.active }));
vi.mock('@/features/events/eventTracking', async () => await vi.importActual('../events/eventTracking'));
vi.mock('@/features/events/EventTrackingContext', () => ({ useEventTracking: () => fixture.tracking }));
vi.mock('expo-sqlite/kv-store', () => ({ default: {
  getItemSync: (key: string) => fixture.rows.get(key) ?? null,
  setItemSync: (key: string, value: string) => { fixture.rows.set(key, value); },
} }));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock('./itemInteractionPersistence', async () => ({
  ...await vi.importActual<typeof import('./itemInteractionPersistence')>('./itemInteractionPersistence'),
  createSupabaseItemInteractionPersistenceApi: () => fixture.api,
  loadPersistedItemInteractions: (...args: unknown[]) => fixture.load(...args),
}));
vi.mock('@/features/events/collectionActions', async () => ({
  ...await vi.importActual<typeof import('../events/collectionActions')>('../events/collectionActions'),
  createProfileActionSender: () => fixture.send,
}));
vi.mock('@/features/events/itemActionOutbox', async () => {
  const actual = await vi.importActual<typeof import('../events/itemActionOutbox')>('../events/itemActionOutbox');
  return { ...actual, createItemActionOutbox: (...args: Parameters<typeof actual.createItemActionOutbox>) => {
    const queue = actual.createItemActionOutbox(...args); fixture.queues.push(queue); return queue;
  } };
});

type State = ReturnType<typeof useItemInteractions>;
const itemId = '00000000-0000-4000-8000-000000000004';
function render(): State {
  hooks.stateIndex = hooks.memoIndex = hooks.effectIndex = 0;
  const tree = ItemInteractionProvider({ children: null }) as React.ReactElement<{ value: State }>;
  for (const run of hooks.pending.values()) run(); hooks.pending.clear();
  return tree.props.value;
}
async function ready() {
  render(); await Promise.resolve(); await Promise.resolve();
  const state = render(); expect(state.persistenceStatus).toBe('ready'); return state;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}
function receipt(command: ItemActionCommand): ItemActionResult {
  return { status: 'success', receipt: { version: 1, actionId: command.actionId,
    profileId: command.profileId, itemId: command.itemId,
    interaction: projectPendingItemActions({}, [{ command }])[command.itemId]! } };
}
beforeEach(() => {
  vi.stubGlobal('React', React);
  hooks.states = []; hooks.memos = []; hooks.effects = []; hooks.pending.clear();
  fixture.rows.clear(); fixture.send.mockReset(); fixture.load.mockReset();
  fixture.load.mockResolvedValue({ status: 'success', interactions: {} });
  fixture.active = { status: 'ready', actorUserId: fixture.actor, activeProfile: { id: fixture.profile, type: 'PERSONAL' } };
  fixture.tracking = { sessionId: fixture.sessionId, session: { sessionId: fixture.sessionId, actorUserId: fixture.actor,
    profileId: fixture.profile, startedAt: '2026-10-15T00:00:00.000Z', context: {} },
  canSendAction: () => true, subscribeToAcknowledgements: () => () => {} };
});
afterEach(() => {
  hooks.effects.forEach(effect => effect.cleanup?.()); fixture.queues.splice(0).forEach(queue => queue.stop());
  vi.unstubAllGlobals();
});

describe('committed Discovery evidence refresh', () => {
  it.each([0, 5, 10])('invalidates an earlier ranking when rating %s commits unchanged after optimistic refresh', async rating => {
    const reply = deferred<ItemActionResult>(); fixture.send.mockReturnValue(reply.promise);
    const initial = await ready();
    expect(initial.setRating(itemId, rating)).toBe(true);
    const optimistic = render();
    expect(optimistic.collectionRevision).toBe(initial.collectionRevision);
    expect(optimistic.interactions[itemId]!.rating).toBe(rating);
    await Promise.resolve();
    const command = fixture.send.mock.calls[0]![0] as ItemActionCommand;
    const result = receipt(command);
    if (result.status !== 'success') throw Error('fixture failure');
    fixture.load.mockResolvedValue({ status: 'success', interactions: { [itemId]: result.receipt.interaction } });
    reply.resolve(result); await fixture.queues[0]!.waitForIdle(); await Promise.resolve();
    const committed = render();
    expect(getInteractionEvidenceKey(committed.interactions)).toBe(getInteractionEvidenceKey(optimistic.interactions));
    expect(committed.collectionRevision).toBe(initial.collectionRevision + 1);
    fixture.queues[0]!.retry(); await fixture.queues[0]!.waitForIdle();
    expect(render().collectionRevision).toBe(committed.collectionRevision);
    expect(fixture.send).toHaveBeenCalledOnce();
  });

  it('does not advance committed evidence for a rejected write', async () => {
    fixture.send.mockResolvedValue({ status: 'error', retryable: false, message: 'Rejected' });
    const initial = await ready(); initial.setRating(itemId, 8);
    await fixture.queues[0]!.waitForIdle();
    expect(render().collectionRevision).toBe(initial.collectionRevision);
  });

  it('does not let a late old-Profile receipt invalidate the new Profile', async () => {
    const reply = deferred<ItemActionResult>(); fixture.send.mockReturnValue(reply.promise);
    const initial = await ready(); initial.setRating(itemId, 8); render(); await Promise.resolve();
    const command = fixture.send.mock.calls[0]![0] as ItemActionCommand;
    fixture.active = { ...fixture.active, activeProfile: { id: 'other-profile', type: 'PERSONAL' } };
    const switched = render(); reply.resolve(receipt(command)); await fixture.queues[0]!.waitForIdle();
    expect(render().collectionRevision).toBe(switched.collectionRevision);
    expect(render().interactions[itemId]).toBeUndefined();
  });
});
