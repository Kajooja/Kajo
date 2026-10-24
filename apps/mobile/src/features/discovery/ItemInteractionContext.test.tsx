import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemInteractionProvider, type useItemInteractions } from './ItemInteractionContext';
import { getInteractionEvidenceKey } from './predictionRefresh';
import { projectPendingItemActions, type ItemActionCommand } from '../events/itemActionCommands';
import type { ItemActionResult } from '../events/itemActionPersistence';
import type { ItemActionOutbox } from '../events/itemActionOutbox';
import type { CollectionActionCommand, CollectionActionIntent, CollectionActionReceipt } from '../events/collectionActions';
import { getItemInteraction } from './itemInteraction';

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
  it.each<CollectionActionIntent>([
    { kind: 'CREATE_LIST', itemId: null, name: 'Weekend' },
    { kind: 'SET_LIST_ENTRY', itemId, listId: '00000000-0000-4000-8000-000000000077', present: true, positive: false },
    { kind: 'ENDORSE_SHARED_ITEM', itemId, listId: null },
    { kind: 'CLEAR_HISTORY', itemId },
  ])('refreshes List membership only after a $kind receipt is acknowledged', async intent => {
    const reply = deferred<ItemActionResult<CollectionActionReceipt>>();
    fixture.send.mockReturnValue(reply.promise);
    const initial = await ready();
    const submitted = initial.submitCollectionAction(intent, 'LISTS');
    const optimistic = render();
    expect(optimistic.collectionRevision).toBe(initial.collectionRevision);
    expect(optimistic.listMembershipRevision).toBe(initial.listMembershipRevision);
    const command = fixture.send.mock.calls[0]![0] as CollectionActionCommand;
    reply.resolve({ status: 'success', receipt: {
      version: 1, actionId: command.actionId, profileId: fixture.profile,
      kind: intent.kind, itemId: intent.itemId, listId: 'listId' in intent ? intent.listId : null,
      result: true, eventIds: [command.actionId], changed: true, undoable: false,
      interaction: intent.itemId ? getItemInteraction({}, intent.itemId) : null,
      beforeInteraction: intent.itemId ? getItemInteraction({}, intent.itemId) : null,
      predictionId: null, discoveryMode: null,
    } });
    await fixture.queues[0]!.waitForIdle(); await submitted;
    const committed = render();
    expect(committed.collectionRevision).toBe(initial.collectionRevision + 1);
    expect(committed.listMembershipRevision).toBe(initial.listMembershipRevision + 1);
    fixture.queues[0]!.retry(); await fixture.queues[0]!.waitForIdle();
    expect(render().listMembershipRevision).toBe(committed.listMembershipRevision);
    expect(fixture.send).toHaveBeenCalledOnce();
  });

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
    expect(committed.listMembershipRevision).toBe(initial.listMembershipRevision);
    fixture.queues[0]!.retry(); await fixture.queues[0]!.waitForIdle();
    expect(render().collectionRevision).toBe(committed.collectionRevision);
    expect(fixture.send).toHaveBeenCalledOnce();
  });

  it('guards feed undo by exact Item/action and returns the immutable undo ID', async () => {
    fixture.send.mockImplementation(async (command: ItemActionCommand) => receipt(command));
    const initial = await ready();
    const ratingId = '00000000-0000-4000-8000-000000000080';
    const undoId = '00000000-0000-4000-8000-000000000081';
    expect(initial.setRating(itemId, 8, ratingId)).toBe(true); render();
    await fixture.queues[0]!.waitForIdle();
    const committed = render();
    expect(committed.undo({ itemId, actionId: undoId }, undoId)).toBeNull();
    expect(committed.undo({ itemId: fixture.profile, actionId: ratingId }, undoId)).toBeNull();
    expect(fixture.send).toHaveBeenCalledOnce();
    const result = committed.undo({ itemId, actionId: ratingId }, undoId);
    expect(result).toMatchObject({ itemId, actionId: undoId, atomic: true });
    await fixture.queues[0]!.waitForIdle();
    expect(fixture.send.mock.calls[1]![0]).toMatchObject({ kind: 'UNDO', actionId: undoId,
      itemId, reversesActionId: ratingId });
  });

  it('does not advance committed evidence for a rejected write', async () => {
    fixture.send.mockResolvedValue({ status: 'error', retryable: false, message: 'Rejected' });
    const initial = await ready(); initial.setRating(itemId, 8);
    await fixture.queues[0]!.waitForIdle();
    expect(render().collectionRevision).toBe(initial.collectionRevision);
    expect(render().listMembershipRevision).toBe(initial.listMembershipRevision);
  });

  it('returns only the exact durably discarded undo ID and keeps ordinary pending work out of failure state', async () => {
    const reply = deferred<ItemActionResult>(); fixture.send.mockReturnValueOnce(reply.promise);
    const initial = await ready();
    expect(initial.discardRejectedAction()).toBeNull();
    expect(initial.setRating(itemId, 8)).toBe(true);
    expect(render()).toMatchObject({ atomicPendingCount: 1, persistenceFailure: null });
    const rating = fixture.send.mock.calls[0]![0] as ItemActionCommand;
    reply.resolve(receipt(rating)); await fixture.queues[0]!.waitForIdle();
    fixture.send.mockResolvedValueOnce({ status: 'error', retryable: false, rejectedUndo: true, message: 'Conflicted undo' });
    const undo = render().undo();
    expect(undo).not.toBeNull(); await fixture.queues[0]!.waitForIdle();
    const conflicted = render();
    expect(conflicted).toMatchObject({ canDiscardUndo: true, persistenceFailure: 'Conflicted undo' });
    expect(conflicted.discardRejectedAction()).toBe(undo!.actionId);
    expect(conflicted.discardRejectedAction()).toBeNull();
    expect([...fixture.rows.values()].flatMap(value => JSON.parse(value))).toEqual([]);
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


describe('never-dispatched feed rating cancellation', () => {
  it('restores the preceding optimistic state without a server Event and keeps the next choice durable', async () => {
    fixture.send.mockImplementation(async (command: ItemActionCommand) => receipt(command));
    const initial = await ready();
    const ratingId = '00000000-0000-4000-8000-000000000090';
    expect(initial.reserveFeedAction!(ratingId)).toBe(true);
    expect(initial.setRating(itemId, 9, ratingId)).toBe(true);
    let current = render();
    expect(current.interactions[itemId]?.rating).toBe(9);
    expect(current.atomicPendingCount).toBe(1);
    expect(fixture.send).not.toHaveBeenCalled();
    expect(current.canCancelFeedAction!(ratingId)).toBe(true);
    expect(current.cancelFeedAction!(ratingId)).toBe(true);
    current = render();
    expect(current.interactions[itemId]?.rating ?? null).toBeNull();
    expect(current.atomicPendingCount).toBe(0);
    expect(current.collectionRevision).toBe(initial.collectionRevision);
    expect(fixture.send).not.toHaveBeenCalled();
    expect(current.cancelFeedAction!(ratingId)).toBe(false);
    const replacementId = '00000000-0000-4000-8000-000000000091';
    expect(current.reserveFeedAction!(replacementId)).toBe(true);
    expect(current.setRating(itemId, 5, replacementId)).toBe(true);
    current = render(); current.releaseFeedAction!(replacementId);
    await fixture.queues[0]!.waitForIdle();
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ actionId: replacementId, kind: 'SET_RATING', rating: 5 }));
    expect(render().canCancelFeedAction!(replacementId)).toBe(false);
  });
});
