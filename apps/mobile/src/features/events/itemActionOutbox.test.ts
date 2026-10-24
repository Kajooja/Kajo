import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ITEM_INTERACTION } from '../discovery/itemInteraction';
import { projectPendingItemActions, type ItemActionCommand, type PendingItemAction } from './itemActionCommands';
import { createItemActionOutbox, type ItemActionOutbox, type ItemActionStorage } from './itemActionOutbox';
import type { ItemActionResult } from './itemActionPersistence';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = { actorUserId: id(1), profileId: id(2) };
const queues: ItemActionOutbox[] = [];
afterEach(() => { queues.splice(0).forEach(q => q.stop()); vi.useRealTimers(); });

function entry(n: number, rating = 8): PendingItemAction {
  return { command: { version: 1, ...scope, actionId: id(n), itemId: id(3), kind: 'SET_RATING', rating,
    occurredAt: '2026-09-09T12:01:00.000Z', session: { sessionId: id(4), startedAt: '2026-09-09T12:00:00.000Z', context: {} },
    discoveryMode: 'FOR_YOU', predictionId: null } };
}
function success(command: ItemActionCommand): ItemActionResult {
  return { status: 'success', receipt: { version: 1, actionId: command.actionId,
    profileId: command.profileId, itemId: command.itemId,
    interaction: projectPendingItemActions({}, [{ command }])[command.itemId] ?? EMPTY_ITEM_INTERACTION } };
}
function storage() {
  const rows = new Map<string, string>();
  return { rows, getItemSync: vi.fn((key: string) => rows.get(key) ?? null),
    setItemSync: vi.fn((key: string, value: string) => { rows.set(key, value); }) };
}
function setup(store: ItemActionStorage = storage(), send = vi.fn(async (command: ItemActionCommand) => success(command)), actorScope = scope) {
  const onCommitted = vi.fn();
  const onChange = vi.fn();
  const queue = createItemActionOutbox({ namespace: 'test', scope: actorScope, storage: store, send, onCommitted, onChange });
  queues.push(queue);
  queue.start();
  return { queue, send, onCommitted, onChange };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('durable actor/Profile Item action outbox', () => {
  it('holds a durably admitted newest choice while older work drains in FIFO order', async () => {
    const store = storage();
    const wait = deferred<ItemActionResult>();
    const send = vi.fn(async (command: ItemActionCommand) => success(command));
    send.mockReturnValueOnce(wait.promise);
    const { queue, onCommitted } = setup(store, send);
    await queue.waitForIdle();
    expect(queue.reserve(id(10))).toBe(true);
    expect(queue.enqueue(entry(10))).toBe(true);
    await queue.waitForIdle();
    expect(send).not.toHaveBeenCalled();
    expect([...store.rows.values()][0]).toContain(id(10));
    expect(queue.snapshot()).toMatchObject({ ready: true, pendingCount: 1, message: null });
    expect(queue.reserve(id(11))).toBe(true);
    expect(queue.enqueue(entry(11))).toBe(true);
    queue.release(id(10));
    await Promise.resolve();
    expect(send.mock.calls.map(([command]) => command.actionId)).toEqual([id(10)]);
    expect(queue.canCancelReserved(id(11))).toBe(true);
    wait.resolve(success(entry(10).command));
    await queue.waitForIdle();
    expect(onCommitted).toHaveBeenCalledOnce();
    expect(queue.pending().map(row => row.command.actionId)).toEqual([id(11)]);
    queue.release(id(11));
    await queue.waitForIdle();
    expect(send.mock.calls.map(([command]) => command.actionId)).toEqual([id(10), id(11)]);
    expect(queue.pending()).toEqual([]);
  });

  it('cancels only an admitted held choice durably without sending or inventing a receipt', async () => {
    const store = storage();
    const { queue, send, onCommitted, onChange } = setup(store);
    await queue.waitForIdle();
    expect(queue.reserve(id(10))).toBe(true);
    expect(queue.canCancelReserved(id(10))).toBe(false);
    expect(queue.cancelReserved(id(10))).toBe(false);
    queue.enqueue(entry(10));
    const readsAfterAdmission = store.getItemSync.mock.calls.length;
    expect(queue.canCancelReserved(id(10))).toBe(true);
    expect(queue.canCancelReserved(id(10))).toBe(true);
    expect(store.getItemSync).toHaveBeenCalledTimes(readsAfterAdmission);
    expect(queue.cancelReserved(id(10))).toBe(true);
    await queue.waitForIdle();
    expect(queue.pending()).toEqual([]);
    expect([...store.rows.values()][0]).toBe('[]');
    expect(send).not.toHaveBeenCalled();
    expect(onCommitted).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ pendingCount: 0 }));
    expect(queue.cancelReserved(id(10))).toBe(false);
    expect(queue.reserve(id(10))).toBe(false);
  });

  it('retains held bytes and refuses local cancellation when the durable removal fails', async () => {
    const store = storage();
    const { queue, send, onCommitted } = setup(store);
    queue.reserve(id(10)); queue.enqueue(entry(10));
    await queue.waitForIdle();
    const admitted = [...store.rows.values()][0];
    store.setItemSync.mockImplementationOnce(() => { throw new Error('disk full'); });
    expect(queue.cancelReserved(id(10))).toBe(false);
    expect([...store.rows.values()][0]).toBe(admitted);
    expect(queue.snapshot()).toMatchObject({ ready: false, pendingCount: 1 });
    expect(send).not.toHaveBeenCalled(); expect(onCommitted).not.toHaveBeenCalled();
    queue.stop();
    const resumed = setup(store);
    await resumed.queue.waitForIdle();
    expect(resumed.send).toHaveBeenCalledWith(entry(10).command);
    expect(resumed.queue.pending()).toEqual([]);
  });

  it('replays held commands unchanged after stop/restart or process recovery', async () => {
    const store = storage();
    const first = setup(store);
    first.queue.reserve(id(10)); first.queue.enqueue(entry(10));
    first.queue.reserve(id(11)); first.queue.enqueue(entry(11));
    await first.queue.waitForIdle();
    first.queue.stop();
    expect(first.queue.canCancelReserved(id(10))).toBe(false);
    expect(first.queue.reserve(id(12))).toBe(false);
    first.queue.release();
    expect(first.send).not.toHaveBeenCalled();
    const resumed = setup(store);
    await resumed.queue.waitForIdle();
    expect(resumed.send.mock.calls.map(([command]) => command)).toEqual([entry(10).command, entry(11).command]);
    expect(resumed.queue.pending()).toEqual([]);
  });

  it('cannot reserve or cancel dispatched, uncertain, rejected or previously acknowledged IDs', async () => {
    vi.useFakeTimers();
    const wait = deferred<ItemActionResult>();
    const send = vi.fn(async (command: ItemActionCommand) => success(command));
    send.mockReturnValueOnce(wait.promise);
    const { queue } = setup(storage(), send);
    queue.enqueue(entry(10)); await Promise.resolve();
    expect(queue.reserve(id(10))).toBe(false);
    expect(queue.canCancelReserved(id(10))).toBe(false);
    expect(queue.cancelReserved(id(10))).toBe(false);
    wait.resolve({ status: 'error', retryable: true, message: 'lost reply' });
    await queue.waitForIdle();
    expect(queue.reserve(id(10))).toBe(false);
    expect(queue.cancelReserved(id(10))).toBe(false);
    send.mockResolvedValueOnce({ status: 'error', retryable: false, rejectedAction: true, message: 'rejected' });
    queue.retry(); await queue.waitForIdle();
    expect(queue.reserve(id(10))).toBe(false);
    expect(queue.cancelReserved(id(10))).toBe(false);
    queue.retry(); await queue.waitForIdle();
    expect(queue.pending()).toEqual([]);
    expect(queue.reserve(id(10))).toBe(false);
    expect(queue.cancelReserved(id(10))).toBe(false);
  });

  it('does not let retry or exposure wakeups release held work or spin the drain', async () => {
    vi.useFakeTimers();
    const { queue, send } = setup();
    queue.reserve(id(10)); queue.enqueue(entry(10));
    await queue.waitForIdle();
    queue.retry(); queue.resumeAfterExposure();
    await queue.waitForIdle();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    queue.release(); await queue.waitForIdle();
    expect(send).toHaveBeenCalledOnce();
  });

  it('checks current scope before reservation and cancellation', async () => {
    let current = true;
    const store = storage();
    const send = vi.fn(async (command: ItemActionCommand) => success(command));
    const queue = createItemActionOutbox({ namespace: 'test', scope, storage: store, send,
      onChange: vi.fn(), onCommitted: vi.fn(), isCurrent: () => current });
    queues.push(queue); queue.start();
    queue.reserve(id(10)); queue.enqueue(entry(10));
    await queue.waitForIdle(); current = false;
    expect(queue.reserve(id(11))).toBe(false);
    expect(queue.canCancelReserved(id(10))).toBe(false);
    expect(queue.cancelReserved(id(10))).toBe(false);
    queue.release(); await queue.waitForIdle();
    expect(send).not.toHaveBeenCalled();
    expect(queue.pending()).toEqual([entry(10)]);
  });

  it('revokes local cancellation proof when another coordinator starts the same durable queue', async () => {
    const store = storage();
    const first = setup(store);
    first.queue.reserve(id(10)); first.queue.enqueue(entry(10));
    await first.queue.waitForIdle();
    const wait = deferred<ItemActionResult>();
    const second = setup(store, vi.fn(async () => wait.promise));
    await Promise.resolve();
    expect(second.send).toHaveBeenCalledOnce();
    expect(first.queue.canCancelReserved(id(10))).toBe(false);
    expect(first.queue.cancelReserved(id(10))).toBe(false);
    expect(first.queue.reserve(id(11))).toBe(false);
    expect(first.queue.pending()).toEqual([entry(10)]);
    first.queue.start();
    expect(first.queue.cancelReserved(id(10))).toBe(false);
    first.queue.stop();
    wait.resolve(success(entry(10).command));
    await second.queue.waitForIdle(); await first.queue.waitForIdle();
    expect(second.queue.pending()).toEqual([]);
  });

  it('checks exact durable payload at cancellation even when the in-memory hint is still true', async () => {
    const store = storage();
    const { queue, send } = setup(store);
    queue.reserve(id(10)); queue.enqueue(entry(10));
    await queue.waitForIdle();
    const key = [...store.rows.keys()][0]!;
    store.rows.set(key, JSON.stringify([entry(10, 2)]));
    expect(queue.canCancelReserved(id(10))).toBe(true);
    expect(queue.cancelReserved(id(10))).toBe(false);
    expect(store.rows.get(key)).toBe(JSON.stringify([entry(10, 2)]));
    expect(send).not.toHaveBeenCalled();
  });

  it('does not lose exposure acknowledgement arriving while the waiting result is in flight', async () => {
    vi.useFakeTimers();
    const deferredResult = deferred<ItemActionResult>();
    const send = vi.fn(async (command: ItemActionCommand) => success(command));
    send.mockReturnValueOnce(deferredResult.promise);
    const { queue } = setup(storage(), send);
    queue.enqueue(entry(10)); await Promise.resolve();
    queue.resumeAfterExposure();
    deferredResult.resolve({ status: 'error', retryable: true, waitingForExposure: true, message: 'Wait' });
    await queue.waitForIdle();
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.pending()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('exposure acknowledgement cannot bypass network backoff or a rejected action', async () => {
    vi.useFakeTimers();
    for (const retryable of [true, false]) {
      const send = vi.fn(async (): Promise<ItemActionResult> => ({ status: 'error', retryable,
        rejectedAction: !retryable, message: 'Actual failure' }));
      const { queue } = setup(storage(), send);
      queue.enqueue(entry(10)); await queue.waitForIdle();
      queue.resumeAfterExposure(); await queue.waitForIdle();
      expect(send).toHaveBeenCalledOnce();
      expect(queue.snapshot().message).toBe('Actual failure');
      queue.stop();
    }
  });

  it('does not resume stopped exposure work when its old Event acknowledgement arrives', async () => {
    const send = vi.fn(async (): Promise<ItemActionResult> => ({ status: 'error', retryable: true,
      waitingForExposure: true, message: 'Wait' }));
    const { queue } = setup(storage(), send);
    queue.enqueue(entry(10)); await queue.waitForIdle(); queue.stop();
    queue.resumeAfterExposure(); await queue.waitForIdle();
    expect(send).toHaveBeenCalledOnce(); expect(queue.pending()).toHaveLength(1);
  });

  it('persists before dispatch/optimistic acceptance and freezes the caller payload', async () => {
    const store = storage();
    const sent = deferred<ItemActionResult>();
    const send = vi.fn(async (command: ItemActionCommand) => {
      expect([...store.rows.values()][0]).toContain(command.actionId);
      return sent.promise;
    });
    const { queue } = setup(store, send);
    const original = entry(10);
    expect(queue.enqueue(original)).toBe(true);
    original.command.itemId = id(99);
    await Promise.resolve();
    expect(queue.pending()[0]?.command.itemId).toBe(id(3));
    sent.resolve(success(entry(10).command));
    await queue.waitForIdle();
    expect(queue.pending()).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not strand an enqueue during the initial empty drain', async () => {
    const { queue, send } = setup();
    queue.enqueue(entry(10));
    await queue.waitForIdle();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('stops FIFO at failure and retries the exact head before later actions', async () => {
    vi.useFakeTimers();
    const send = vi.fn(async (command: ItemActionCommand) => success(command));
    send.mockResolvedValueOnce({ status: 'error', retryable: true, message: 'offline' });
    const { queue } = setup(storage(), send);
    queue.enqueue(entry(10)); queue.enqueue(entry(11, 3));
    await queue.waitForIdle();
    expect(send.mock.calls.map(([cmd]) => cmd.actionId)).toEqual([id(10)]);
    expect(queue.pending()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1000);
    await queue.waitForIdle();
    expect(send.mock.calls.map(([cmd]) => cmd.actionId)).toEqual([id(10), id(10), id(11)]);
    expect(queue.pending()).toEqual([]);
  });

  it('restarts after a lost acknowledgement without changing command/session/occurrence', async () => {
    vi.useFakeTimers();
    const store = storage();
    const accepted = new Map<string, ItemActionResult>();
    const send = vi.fn(async (command: ItemActionCommand): Promise<ItemActionResult> => {
      const existing = accepted.get(command.actionId);
      if (existing) return existing;
      accepted.set(command.actionId, success(command));
      return { status: 'error', retryable: true, message: 'acknowledgement lost' };
    });
    const first = setup(store, send);
    first.queue.enqueue(entry(10));
    await first.queue.waitForIdle();
    first.queue.stop();
    const restarted = setup(store, send);
    await restarted.queue.waitForIdle();
    expect(accepted.size).toBe(1);
    expect(send.mock.calls[1]?.[0]).toEqual(send.mock.calls[0]?.[0]);
    expect(restarted.queue.pending()).toEqual([]);
  });

  it('retains later old-scope work and suppresses callbacks after an account switch', async () => {
    const store = storage();
    const pending = deferred<ItemActionResult>();
    const send = vi.fn(async () => pending.promise);
    const first = setup(store, send);
    first.queue.enqueue(entry(10)); first.queue.enqueue(entry(11));
    await Promise.resolve();
    first.queue.stop(); first.onCommitted.mockClear(); first.onChange.mockClear();
    const other = setup(store, vi.fn(async command => success(command)), { ...scope, actorUserId: id(9) });
    pending.resolve(success(entry(10).command));
    await first.queue.waitForIdle(); await other.queue.waitForIdle();
    expect(first.onCommitted).not.toHaveBeenCalled(); expect(first.onChange).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1); expect(other.send).not.toHaveBeenCalled();
    expect(first.queue.pending().map(row => row.command.actionId)).toEqual([id(11)]);
    const resumed = setup(store);
    await resumed.queue.waitForIdle();
    expect(resumed.send.mock.calls[0]?.[0].actionId).toBe(id(11));
  });

  it('does not let an old acknowledgement erase a new coordinator append', async () => {
    const store = storage(); const wait = deferred<ItemActionResult>();
    const first = setup(store, vi.fn(async () => wait.promise));
    first.queue.enqueue(entry(10)); await Promise.resolve(); first.queue.stop();
    const secondWait = deferred<ItemActionResult>();
    const second = setup(store, vi.fn(async () => secondWait.promise));
    second.queue.enqueue(entry(11));
    wait.resolve(success(entry(10).command)); await first.queue.waitForIdle();
    expect(second.queue.pending().map(row => row.command.actionId)).toEqual([id(11)]);
    second.queue.stop(); secondWait.resolve(success(entry(10).command)); await second.queue.waitForIdle();
    expect(second.queue.pending().map(row => row.command.actionId)).toEqual([id(11)]);
  });

  it('blocks authorization failures without dropping them or overtaking the head', async () => {
    vi.useFakeTimers();
    const send = vi.fn(async (command: ItemActionCommand) => success(command));
    send.mockResolvedValueOnce({ status: 'error', retryable: false, message: 'revoked' });
    const { queue } = setup(storage(), send);
    queue.enqueue(entry(10)); queue.enqueue(entry(11)); await queue.waitForIdle();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(send).toHaveBeenCalledTimes(1); expect(queue.pending()).toHaveLength(2);
    queue.retry(); await queue.waitForIdle(); expect(queue.pending()).toEqual([]);
  });

  it('rejects storage failure before accepting/sending a new action', async () => {
    const store = storage(); store.setItemSync.mockImplementation(() => { throw new Error('disk full'); });
    const { queue, send } = setup(store);
    expect(queue.enqueue(entry(10))).toBe(false); await queue.waitForIdle();
    expect(send).not.toHaveBeenCalled(); expect(store.rows.size).toBe(0);
    expect(queue.snapshot().message).toContain('Valintajonon');
  });

  it('keeps an acknowledged command if persisting its removal fails', async () => {
    const store = storage(); const wait = deferred<ItemActionResult>();
    const { queue, send, onCommitted } = setup(store, vi.fn(async () => wait.promise));
    queue.enqueue(entry(10)); await Promise.resolve();
    store.setItemSync.mockImplementationOnce(() => { throw new Error('ack write failed'); });
    wait.resolve(success(entry(10).command)); await queue.waitForIdle();
    expect(queue.pending()).toHaveLength(1); expect(onCommitted).not.toHaveBeenCalled();
    queue.retry(); await queue.waitForIdle();
    expect(send).toHaveBeenCalledTimes(2); expect(queue.pending()).toEqual([]);
  });

  it('preserves corrupt storage and refuses another scope or reused ID payload', async () => {
    const store = storage();
    const key = `kajo:item-actions:v1:test:${scope.actorUserId}:${scope.profileId}`;
    store.rows.set(key, '{broken');
    const broken = setup(store);
    expect(broken.queue.enqueue(entry(10))).toBe(false);
    expect(store.rows.get(key)).toBe('{broken'); expect(broken.send).not.toHaveBeenCalled();
    const otherStore = storage(); const wait = deferred<ItemActionResult>();
    const current = setup(otherStore, vi.fn(async () => wait.promise));
    current.queue.enqueue(entry(10));
    const before = [...otherStore.rows.values()][0];
    expect(current.queue.enqueue(entry(10, 1))).toBe(false);
    expect([...otherStore.rows.values()][0]).toBe(before);
    const wrong = entry(12); wrong.command.profileId = id(90);
    current.queue.retry(); expect(current.queue.enqueue(wrong)).toBe(false);
    current.queue.stop(); wait.resolve(success(entry(10).command)); await current.queue.waitForIdle();
  });

  it('projects pending ratings/not-interest/undo over hydration without borrowing another Item', () => {
    const first = entry(10);
    const second: PendingItemAction = { command: { ...entry(11).command, kind: 'SET_NOT_INTERESTED', notInterested: true } };
    const undo: PendingItemAction = { command: { ...entry(12).command, kind: 'UNDO', reversesActionId: id(11) },
      restoredInteraction: { ...EMPTY_ITEM_INTERACTION, saved: true, consumed: true, rating: 8 } };
    const initial = { [id(3)]: { ...EMPTY_ITEM_INTERACTION, saved: true }, [id(99)]: EMPTY_ITEM_INTERACTION };
    expect(projectPendingItemActions(initial, [first, second])[id(3)]).toMatchObject({ saved: true, rating: null, notInterested: true });
    expect(projectPendingItemActions(initial, [first, second, undo])[id(3)]).toEqual(undo.restoredInteraction);
    expect(projectPendingItemActions(initial, [first])[id(99)]).toBe(EMPTY_ITEM_INTERACTION);
  });

  it('allows explicit discard only for a definitively rejected undo and stops for reconciliation', async () => {
    const store = storage();
    const send = vi.fn(async (): Promise<ItemActionResult> => ({ status: 'error', retryable: false,
      rejectedUndo: true, message: 'undo conflict' }));
    const current = setup(store, send);
    const undo: PendingItemAction = { command: { ...entry(10).command, kind: 'UNDO', reversesActionId: id(9) },
      restoredInteraction: EMPTY_ITEM_INTERACTION };
    current.queue.enqueue(undo); current.queue.enqueue(entry(11)); await current.queue.waitForIdle();
    expect(current.queue.snapshot().canDiscardUndo).toBe(true);
    expect(current.queue.discardRejectedUndo()).toBe(true);
    expect(current.queue.pending().map(row => row.command.actionId)).toEqual([id(11)]);
    expect(current.queue.enqueue(entry(12))).toBe(false);
    const resumed = setup(store); await resumed.queue.waitForIdle();
    expect(resumed.send.mock.calls.map(([cmd]) => cmd.actionId)).toEqual([id(11)]);
    const permission = setup(storage(), vi.fn(async (): Promise<ItemActionResult> => ({ status: 'error', retryable: false, message: 'revoked' })));
    permission.queue.enqueue(entry(13)); await permission.queue.waitForIdle();
    expect(permission.queue.discardRejectedUndo()).toBe(false);
  });

  it('keeps identical actor/Profile IDs isolated between backend environments', async () => {
    const store = storage(); const wait = deferred<ItemActionResult>();
    const first = setup(store, vi.fn(async () => wait.promise));
    first.queue.enqueue(entry(10)); await Promise.resolve(); first.queue.stop();
    const send = vi.fn(async (command: ItemActionCommand) => success(command));
    const other = createItemActionOutbox({ namespace: 'other-backend', scope, storage: store, send,
      onChange: vi.fn(), onCommitted: vi.fn() });
    queues.push(other); other.start(); await other.waitForIdle();
    expect(other.pending()).toEqual([]); expect(send).not.toHaveBeenCalled();
    wait.resolve(success(entry(10).command)); await first.queue.waitForIdle();
  });

  it('checks current scope before each dispatch, even before effect cleanup can stop it', async () => {
    let current = true;
    const wait = deferred<ItemActionResult>();
    const send = vi.fn(async () => wait.promise);
    const onCommitted = vi.fn();
    const queue = createItemActionOutbox({ namespace: 'test', scope, storage: storage(), send,
      onChange: vi.fn(), onCommitted, isCurrent: () => current });
    queues.push(queue); queue.start(); queue.enqueue(entry(10)); queue.enqueue(entry(11));
    await Promise.resolve(); current = false;
    wait.resolve(success(entry(10).command)); await queue.waitForIdle();
    expect(send).toHaveBeenCalledTimes(1); expect(onCommitted).not.toHaveBeenCalled();
    expect(queue.pending().map(row => row.command.actionId)).toEqual([id(11)]);
    expect(queue.enqueue(entry(12))).toBe(false);
  });
});
