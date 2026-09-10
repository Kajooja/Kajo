import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPTY_ITEM_INTERACTION } from '../discovery/itemInteraction';
import { createCustomItemList, setItemListEntry } from '../lists/itemListOperations';
import { createItemActionOutbox, type ItemActionOutbox } from './itemActionOutbox';
import type { ItemActionCommand } from './itemActionCommands';
import type { ItemActionResult } from './itemActionPersistence';
import {
  createCollectionMutationRpc, createProfileActionSender, isPendingProfileAction, projectPendingProfileActions,
  type CollectionActionCommand, type CollectionActionIntent, type CollectionActionReceipt,
  type PendingProfileAction, type ProfileActionReceipt,
} from './collectionActions';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = { actorUserId: id(1), profileId: id(2) };
const base = { version: 1 as const, ...scope, occurredAt: '2026-09-09T12:01:00Z',
  session: { sessionId: id(3), startedAt: '2026-09-09T12:00:00Z', context: {} },
  discoveryMode: 'FOR_YOU' as const, predictionId: id(4) };
function command(n = 10, intent: CollectionActionIntent = { kind: 'CREATE_LIST', itemId: null, name: 'Books' }): CollectionActionCommand {
  return { ...base, actionId: id(n), source: 'LISTS', ...intent };
}
const listRow = { list_id: id(5), profile_id: scope.profileId, list_kind: 'CUSTOM', name: 'Books', item_count: 0,
  contains_item: false, created_at: base.occurredAt, updated_at: base.occurredAt };
function receipt(c: CollectionActionCommand): CollectionActionReceipt {
  return { version: 1, actionId: c.actionId, profileId: c.profileId, kind: c.kind, itemId: c.itemId,
    listId: 'listId' in c ? c.listId : id(5), eventIds: [c.actionId], changed: true, undoable: c.kind === 'SET_LIST_ENTRY',
    interaction: c.itemId ? EMPTY_ITEM_INTERACTION : null, beforeInteraction: c.itemId ? EMPTY_ITEM_INTERACTION : null,
    predictionId: null, discoveryMode: c.discoveryMode,
    result: c.kind === 'CREATE_LIST' || c.kind === 'RENAME_LIST' ? [listRow] : c.kind === 'SET_LIST_ENTRY' ? c.present : true };
}
const queues: ItemActionOutbox<PendingProfileAction>[] = [];
afterEach(() => { queues.splice(0).forEach(q => q.stop()); vi.useRealTimers(); });
function storage() {
  const rows = new Map<string, string>();
  return { rows, getItemSync: (key: string) => rows.get(key) ?? null,
    setItemSync: (key: string, value: string) => { rows.set(key, value); } };
}
function setup(store: ReturnType<typeof storage>, send: (c: PendingProfileAction['command']) => Promise<ItemActionResult<ProfileActionReceipt>>,
  options: { namespace?: string; current?: () => boolean } = {}) {
  const onCommitted = vi.fn();
  const queue = createItemActionOutbox<PendingProfileAction, ProfileActionReceipt>({
    namespace: options.namespace ?? 'test', scope, storage: store, send, onCommitted, onChange: vi.fn(),
    isCurrent: options.current ?? (() => true), isPendingAction: isPendingProfileAction,
  });
  queues.push(queue); queue.start();
  return { queue, onCommitted };
}
function client(rpc: unknown) { return { rpc } as SupabaseClient; }

describe('atomic collection service and shared durable queue', () => {
  it('accepts all command kinds and keeps old persisted Item payloads compatible', () => {
    const intents: CollectionActionIntent[] = [
      { kind: 'CREATE_LIST', itemId: null, name: 'Books' },
      { kind: 'RENAME_LIST', itemId: null, listId: id(5), name: 'Films' },
      { kind: 'DELETE_LIST', itemId: null, listId: id(5) },
      { kind: 'SET_LIST_ENTRY', itemId: id(6), listId: id(5), present: true, positive: false },
      { kind: 'UNDO_LIST_ENTRY', itemId: id(6), reversesActionId: id(9) },
      { kind: 'ENDORSE_SHARED_ITEM', itemId: id(6), listId: null },
      { kind: 'REVERSE_ENDORSEMENT', itemId: id(6) },
    ];
    for (const intent of intents) expect(isPendingProfileAction({ command: command(10, intent),
      restoredInteraction: EMPTY_ITEM_INTERACTION }, scope)).toBe(true);
    expect(isPendingProfileAction({ command: { ...base, actionId: id(10), itemId: id(6), kind: 'SET_RATING', rating: 8 } }, scope)).toBe(true);
    for (const invalid of [{ profileId: id(90) }, { source: 'UNKNOWN' }, { session: {} }, { name: '' }, { itemId: id(6) }]) {
      expect(isPendingProfileAction({ command: { ...command(), ...invalid } }, scope)).toBe(false);
    }
    expect(isPendingProfileAction({ command: command(10, { kind: 'SET_LIST_ENTRY', itemId: id(6), listId: id(5),
      present: true, positive: true }) }, scope)).toBe(false);
  });

  it('persists history clear across restart and accepts only a fully cleared uncorrelated receipt', async () => {
    vi.useFakeTimers();
    const c: CollectionActionCommand = { ...command(25, { kind: 'CLEAR_HISTORY', itemId: id(6) }),
      source: 'LIST_DETAIL', predictionId: null, discoveryMode: null };
    expect(isPendingProfileAction({ command: c }, scope)).toBe(true);
    expect(isPendingProfileAction({ command: { ...c, predictionId: id(4) } }, scope)).toBe(false);
    expect(isPendingProfileAction({ command: c }, { ...scope, profileId: id(99) })).toBe(false);
    const store = storage();
    const first = setup(store, async () => ({ status: 'error', retryable: true, message: 'offline' }));
    first.queue.enqueue({ command: c }); await first.queue.waitForIdle(); first.queue.stop();
    const ack: CollectionActionReceipt = { ...receipt(c), listId: null };
    const rpc = vi.fn(async () => ({ data: ack, error: null }));
    const send = createProfileActionSender(client(rpc));
    const restarted = setup(store, send); await restarted.queue.waitForIdle();
    expect(rpc).toHaveBeenCalledExactlyOnceWith('commit_collection_action_v1', { request: c });
    expect(restarted.queue.pending()).toEqual([]);
    expect(restarted.onCommitted).toHaveBeenCalled();
    for (const invalid of [{ undoable: true }, { listId: id(5) }, { predictionId: id(4) },
      { interaction: { ...EMPTY_ITEM_INTERACTION, rating: 8 } },
      { interaction: { ...EMPTY_ITEM_INTERACTION, consumed: true } }]) {
      rpc.mockResolvedValueOnce({ data: { ...ack, ...invalid }, error: null });
      expect(await send(c)).toMatchObject({ status: 'error', retryable: false });
    }
  });

  it('uses only the atomic RPC and validates metadata acknowledgements including their List/Profile', async () => {
    const c = command();
    const rpc = vi.fn(async () => ({ data: receipt(c), error: null }));
    const send = createProfileActionSender(client(rpc));
    expect(await send(c)).toMatchObject({ status: 'success', receipt: { actionId: c.actionId } });
    expect(rpc).toHaveBeenCalledWith('commit_collection_action_v1', { request: c });
    for (const invalid of [{ actionId: id(99) }, { kind: 'DELETE_LIST' }, { eventIds: [] },
      { result: [{ ...listRow, profile_id: id(99) }] }, { result: [] }, { interaction: EMPTY_ITEM_INTERACTION }]) {
      rpc.mockResolvedValueOnce({ data: { ...receipt(c), ...invalid } as CollectionActionReceipt, error: null });
      expect(await send(c)).toMatchObject({ status: 'error', retryable: false });
    }
  });

  it('requires matching Shared actor, actual consensus counts and a complete transition receipt', async () => {
    const c = command(10, { kind: 'ENDORSE_SHARED_ITEM', itemId: id(6), listId: null });
    const row = { profile_id: scope.profileId, actor_user_id: scope.actorUserId, item_id: id(6),
      endorsement_created: true, endorsement_count: 2, required_member_count: 2, consensus_reached: true,
      consensus_saved: true, proposal_list_id: id(5), proposal_list_name: 'Books', proposed_by_user_id: id(8), list_entry_created: true };
    const data = { ...receipt(c), listId: id(5), result: [row], eventIds: [c.actionId, id(20), id(21)] };
    const rpc = vi.fn(async () => ({ data, error: null }));
    const send = createProfileActionSender(client(rpc));
    expect(await send(c)).toMatchObject({ status: 'success' });
    for (const invalid of [{ actor_user_id: id(99) }, { endorsement_count: 1 }, { consensus_saved: false }]) {
      rpc.mockResolvedValueOnce({ data: { ...data, result: [{ ...row, ...invalid }] }, error: null });
      expect(await send(c)).toMatchObject({ status: 'error', retryable: false });
    }
  });

  it('retains uncertain and permission failures; only explicit domain/undo rejection can be discarded', async () => {
    for (const [code, discardable] of [['42501', false], ['22023', false], ['KJ001', false], ['KJ002', true]]) {
      const send = createProfileActionSender(client(vi.fn(async () => ({ data: null, error: { code } }))));
      const { queue } = setup(storage(), send);
      queue.enqueue({ command: command() }); await queue.waitForIdle();
      expect(queue.snapshot().canDiscardAction).toBe(discardable);
      expect(queue.discardRejectedAction()).toBe(discardable);
      expect(queue.pending()).toHaveLength(discardable ? 0 : 1);
    }
    const send = createProfileActionSender(client(vi.fn(async () => ({ data: null, error: { code: 'KJ001' } }))));
    const { queue } = setup(storage(), send);
    queue.enqueue({ command: command(10, { kind: 'UNDO_LIST_ENTRY', itemId: id(6), reversesActionId: id(9) }),
      restoredInteraction: EMPTY_ITEM_INTERACTION }); await queue.waitForIdle();
    expect(queue.discardRejectedAction()).toBe(true);
    expect(queue.enqueue({ command: command(11) })).toBe(false); // rehydrate before resuming
  });

  it('restarts one FIFO spanning old ratings, List metadata and Shared choices with unchanged payloads', async () => {
    vi.useFakeTimers();
    const store = storage();
    const rating: ItemActionCommand = { ...base, actionId: id(9), itemId: id(6), kind: 'SET_RATING', rating: 8 };
    const shared = command(11, { kind: 'ENDORSE_SHARED_ITEM', itemId: id(7), listId: id(5) });
    const key = `kajo:item-actions:v1:test:${scope.actorUserId}:${scope.profileId}`;
    store.rows.set(key, JSON.stringify([{ command: rating }]));
    const lost = vi.fn(async (): Promise<ItemActionResult<ProfileActionReceipt>> => ({ status: 'error', retryable: true, message: 'offline' }));
    const first = setup(store, lost);
    first.queue.enqueue({ command: command() }); first.queue.enqueue({ command: shared }); await first.queue.waitForIdle(); first.queue.stop();
    expect(lost).toHaveBeenCalledTimes(1);
    const send = vi.fn(async (c: PendingProfileAction['command']): Promise<ItemActionResult<ProfileActionReceipt>> => ({ status: 'success',
      receipt: { version: 1, actionId: c.actionId, profileId: c.profileId, itemId: c.itemId ?? id(6), interaction: EMPTY_ITEM_INTERACTION } }));
    const restarted = setup(store, send); await restarted.queue.waitForIdle();
    expect(send.mock.calls.map(([c]) => c)).toEqual([rating, command(), shared]);
    expect(restarted.queue.pending()).toEqual([]);
  });

  it('times out a hung request, retries its exact ID and ignores a late acknowledgement', async () => {
    vi.useFakeTimers();
    let resolve!: (value: ItemActionResult<ProfileActionReceipt>) => void;
    const late = new Promise<ItemActionResult<ProfileActionReceipt>>(done => { resolve = done; });
    const c = command();
    const send = vi.fn(async (): Promise<ItemActionResult<ProfileActionReceipt>> => ({ status: 'success', receipt: receipt(c) }));
    send.mockReturnValueOnce(late);
    const { queue, onCommitted } = setup(storage(), send);
    queue.enqueue({ command: c }); await vi.advanceTimersByTimeAsync(20_000);
    expect(queue.snapshot().message).toContain('viipyy');
    expect(queue.pending()).toHaveLength(1); expect(queue.discardRejectedAction()).toBe(false);
    await vi.advanceTimersByTimeAsync(1000); await queue.waitForIdle();
    expect(send.mock.calls).toHaveLength(2); expect(queue.pending()).toEqual([]);
    resolve({ status: 'success', receipt: receipt(c) }); await Promise.resolve();
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it('suppresses collection callbacks after a scope switch and isolates identical IDs in another environment', async () => {
    let current = true;
    let resolve!: (value: ItemActionResult<ProfileActionReceipt>) => void;
    const late = new Promise<ItemActionResult<ProfileActionReceipt>>(done => { resolve = done; });
    const store = storage(); const c = command();
    const first = setup(store, () => late, { current: () => current });
    first.queue.enqueue({ command: c }); await Promise.resolve(); current = false;
    const otherSend = vi.fn(async (): Promise<ItemActionResult<ProfileActionReceipt>> => ({ status: 'success', receipt: receipt(c) }));
    const other = setup(store, otherSend, { namespace: 'other-backend' }); await other.queue.waitForIdle();
    resolve({ status: 'success', receipt: receipt(c) }); await first.queue.waitForIdle();
    expect(first.onCommitted).not.toHaveBeenCalled(); expect(otherSend).not.toHaveBeenCalled();
  });

  it('adapts validated UI mutations to frozen intents and does not report queued work as completed', async () => {
    const submit = vi.fn(async () => ({ status: 'error' as const, message: 'Valinta odottaa yhteyttä.' }));
    const rpc = createCollectionMutationRpc(submit, scope.profileId, 'ITEM_DESTINATION_PICKER', undefined, true);
    expect(await createCustomItemList(rpc, scope.profileId, '   ')).toMatchObject({ status: 'error' });
    expect(submit).not.toHaveBeenCalled();
    expect(await setItemListEntry(rpc, id(5), id(6), true)).toEqual({ status: 'error', message: 'Valinta odottaa yhteyttä.' });
    expect(submit).toHaveBeenCalledWith({ kind: 'SET_LIST_ENTRY', itemId: id(6), listId: id(5), present: true, positive: true },
      'ITEM_DESTINATION_PICKER', undefined);
  });

  it('does not guess List/Shared state while pending and restores only a receipt-derived Undo preview', () => {
    const initial = { [id(6)]: { ...EMPTY_ITEM_INTERACTION, saved: true, rating: 8, consumed: true } };
    const add = { command: command(10, { kind: 'SET_LIST_ENTRY', itemId: id(6), listId: id(5), present: true, positive: false }) };
    expect(projectPendingProfileActions(initial, [add])).toBe(initial);
    const undo = { command: command(11, { kind: 'UNDO_LIST_ENTRY', itemId: id(6), reversesActionId: id(10) }),
      restoredInteraction: EMPTY_ITEM_INTERACTION };
    expect(projectPendingProfileActions(initial, [undo])[id(6)]).toEqual(EMPTY_ITEM_INTERACTION);
  });
});

describe('multiple destinations with independent durable saves', () => {
  it('keeps the first acknowledged List and retries only the second after restart', async () => {
    const store = storage();
    const firstCommand = command(80, { kind: 'SET_LIST_ENTRY', itemId: id(9), listId: id(5), present: true, positive: true });
    const secondCommand = command(81, { kind: 'SET_LIST_ENTRY', itemId: id(9), listId: id(6), present: true, positive: true });
    firstCommand.source = 'ITEM_DESTINATION_PICKER';
    secondCommand.source = 'ITEM_DESTINATION_PICKER';
    const send = vi.fn(async (c: PendingProfileAction['command']): Promise<ItemActionResult<ProfileActionReceipt>> =>
      c.actionId === secondCommand.actionId
        ? { status: 'error', retryable: true, message: 'offline' }
        : { status: 'success', receipt: receipt(firstCommand) });
    const first = setup(store, send);
    expect(first.queue.enqueue({ command: firstCommand })).toBe(true);
    await first.queue.waitForIdle();
    expect(first.onCommitted).toHaveBeenCalledTimes(1);
    expect(first.queue.enqueue({ command: secondCommand })).toBe(true);
    await first.queue.waitForIdle();
    expect(first.queue.pending().map(entry => entry.command.actionId)).toEqual([secondCommand.actionId]);
    first.queue.stop();
    const retry = vi.fn(async (): Promise<ItemActionResult<ProfileActionReceipt>> => ({ status: 'success', receipt: receipt(secondCommand) }));
    const restarted = setup(store, retry);
    await restarted.queue.waitForIdle();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry.mock.calls[0]).toEqual([secondCommand]);
    expect(restarted.queue.pending()).toEqual([]);
  });
});
