import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event, EventSession } from '../../domain/contracts';
import type { PersistedEventRow, PersistedEventSessionRow } from './eventPersistence';
import type { ItemActionStorage } from './itemActionOutbox';
import type { EventWriteCoordinator } from './eventTracking';
import { createItemActionOutbox, type ItemActionOutbox } from './itemActionOutbox';
import type { PendingItemAction, ItemActionCommand } from './itemActionCommands';
import { createEventWriteCoordinator, createExposureOrderedSender } from './eventOutbox';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const session = (n = 3): EventSession => ({ actorUserId: id(1), profileId: id(2), sessionId: id(n),
  startedAt: '2026-09-10T00:00:00Z', context: { locale: 'fi-FI' } });
const event = (s = session(), n = 4): Event => ({ actorUserId: s.actorUserId, profileId: s.profileId,
  sessionId: s.sessionId, eventId: id(n), eventType: 'ITEM_IMPRESSION', timestamp: '2026-09-10T00:01:00Z',
  itemId: id(5), itemType: 'BOOK', predictionId: id(6), discoveryMode: 'SURPRISE', context: {} });
const storage = () => {
  const rows = new Map<string, string>();
  return { rows, getItemSync: (key: string) => rows.get(key) ?? null,
    setItemSync: (key: string, value: string) => { rows.set(key, value); } };
};
const api = () => ({ appendSession: vi.fn<(row: PersistedEventSessionRow) => Promise<{ error: { message: string } | null }>>(async () => ({ error: null })),
  appendEvent: vi.fn<(row: PersistedEventRow) => Promise<{ error: { message: string } | null }>>(async () => ({ error: null })) });
const coordinators: EventWriteCoordinator[] = [];
const actionQueues: ItemActionOutbox[] = [];
function setup(store: ItemActionStorage, connection = api(), s = session(), namespace = 'env', isCurrent?: () => boolean) {
  const onChange = vi.fn();
  const coordinator = createEventWriteCoordinator(connection, s, onChange,
    { storage: store, namespace, ...(isCurrent ? { isCurrent } : {}) });
  coordinators.push(coordinator); coordinator.start();
  return { coordinator, connection, onChange };
}
afterEach(() => { coordinators.splice(0).forEach(c => c.dispose()); actionQueues.splice(0).forEach(q => q.stop()); vi.useRealTimers(); });

describe('durable event delivery', () => {
  it('persists before acceptance and sends original session before Event', async () => {
    const store = storage(), connection = api(), order: string[] = [];
    connection.appendSession.mockImplementation(async () => { order.push('session'); return { error: null }; });
    connection.appendEvent.mockImplementation(async () => { order.push('event'); return { error: null }; });
    const { coordinator } = setup(store, connection);
    expect(coordinator.enqueue(event())).toBe(true);
    expect([...store.rows.values()][0]).toContain(id(4));
    await coordinator.waitForIdle();
    expect(order).toEqual(['session', 'event']);
    expect([...store.rows.values()]).toEqual(['[]']);
  });
  it('restarts under a new session but retries the exact old Event/session before new evidence', async () => {
    const store = storage(), firstApi = api();
    firstApi.appendEvent.mockResolvedValue({ error: { message: 'lost acknowledgement' } });
    const first = setup(store, firstApi);
    first.coordinator.enqueue(event()); await first.coordinator.waitForIdle(); first.coordinator.dispose();
    const second = setup(store, api(), session(30));
    second.coordinator.enqueue(event(session(30), 40)); await second.coordinator.waitForIdle();
    expect(second.connection.appendSession.mock.calls.map(c => c[0])).toEqual([
      expect.objectContaining({ id: id(3) }), expect.objectContaining({ id: id(30) })]);
    expect(second.connection.appendEvent).toHaveBeenNthCalledWith(1, firstApi.appendEvent.mock.calls[0]![0]);
    expect(second.connection.appendEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: id(40), session_id: id(30) }));
  });
  it('does not send an Event after scope changes while session persistence is in flight', async () => {
    let current = true;
    let resolve!: (result: { error: null }) => void;
    const connection = api();
    connection.appendSession.mockImplementation(() => new Promise(r => { resolve = r; }));
    const store = storage(), first = setup(store, connection, session(), 'env', () => current);
    first.coordinator.enqueue(event());
    await vi.waitFor(() => expect(connection.appendSession).toHaveBeenCalledOnce());
    current = false; first.coordinator.dispose();
    resolve({ error: null }); await first.coordinator.waitForIdle();
    expect(connection.appendEvent).not.toHaveBeenCalled();
    expect([...store.rows.values()][0]).toContain(id(4));
    const resumed = setup(store); await resumed.coordinator.waitForIdle();
    expect(resumed.connection.appendEvent).toHaveBeenCalledOnce();
  });
  it('isolates environment, actor and Profile and retains another scope pending data', async () => {
    const store = storage(), connection = api();
    connection.appendSession.mockResolvedValue({ error: { message: 'offline' } });
    const first = setup(store, connection); first.coordinator.enqueue(event());
    await first.coordinator.waitForIdle(); first.coordinator.dispose();
    for (const [s, env] of [[session(), 'other-env'], [{ ...session(), actorUserId: id(99) }, 'env'],
      [{ ...session(), profileId: id(98) }, 'env']] as const) {
      const other = setup(store, api(), s, env); await other.coordinator.waitForIdle();
      expect(other.connection.appendSession).not.toHaveBeenCalled();
      expect(other.coordinator.enqueue(event())).toBe(s.actorUserId === id(1) && s.profileId === id(2));
      other.coordinator.dispose();
    }
    const resumed = setup(store); await resumed.coordinator.waitForIdle();
    expect(resumed.connection.appendEvent).toHaveBeenCalledOnce();
  });
  it('does not accept storage failure and can recover without losing the same Event ID', async () => {
    const store = storage(); let broken = true;
    const originalWrite = store.setItemSync;
    store.setItemSync = (key, value) => { if (broken) throw new Error('disk'); originalWrite(key, value); };
    const current = setup(store);
    expect(current.coordinator.enqueue(event())).toBe(false);
    expect(current.connection.appendSession).not.toHaveBeenCalled();
    expect(current.onChange.mock.lastCall?.[0].message).toBeTruthy();
    broken = false; current.coordinator.retry();
    expect(current.coordinator.enqueue(event())).toBe(true); await current.coordinator.waitForIdle();
    expect(current.connection.appendEvent).toHaveBeenCalledOnce();
  });
  it('freezes payload and rejects foreign sessions or malformed restored data', async () => {
    const store = storage(), connection = api();
    connection.appendSession.mockResolvedValue({ error: { message: 'offline' } });
    const current = setup(store, connection); const input = event();
    expect(current.coordinator.enqueue(event(session(90)))).toBe(false);
    expect(current.coordinator.enqueue(input)).toBe(true); input.timestamp = '2027-01-01T00:00:00Z';
    await current.coordinator.waitForIdle(); current.coordinator.dispose();
    const key = [...store.rows.keys()][0]!;
    expect(store.rows.get(key)).toContain('2026-09-10T00:01:00Z');
    const corrupt = JSON.parse(store.rows.get(key)!); corrupt[0].command.event.actorUserId = id(99);
    store.rows.set(key, JSON.stringify(corrupt));
    const restarted = setup(store); await restarted.coordinator.waitForIdle();
    expect(restarted.connection.appendSession).not.toHaveBeenCalled();
    expect(restarted.coordinator.enqueue(event())).toBe(false);
  });
  it('retains the exact Event on reply timeout and ignores a late duplicate acknowledgement', async () => {
    vi.useFakeTimers(); const connection = api();
    let resolve!: (result: { error: null }) => void;
    connection.appendEvent.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const store = storage(), current = setup(store, connection); current.coordinator.enqueue(event());
    await vi.advanceTimersByTimeAsync(20_000);
    expect([...store.rows.values()][0]).toContain(id(4));
    current.coordinator.retry(); await current.coordinator.waitForIdle();
    expect(connection.appendEvent).toHaveBeenCalledTimes(2);
    expect(connection.appendEvent.mock.calls[0]).toEqual(connection.appendEvent.mock.calls[1]);
    resolve({ error: null }); await Promise.resolve();
    expect([...store.rows.values()]).toEqual(['[]']);
  });
});


const action = (): ItemActionCommand => ({ version: 1, actionId: id(70), actorUserId: id(1), profileId: id(2),
  itemId: id(5), kind: 'SET_RATING', rating: 8, predictionId: id(6), discoveryMode: 'SURPRISE',
  occurredAt: '2026-09-10T00:02:00Z', session: session() });

function actionQueue(store: ItemActionStorage, evidence: EventWriteCoordinator, send: (c: ItemActionCommand) => Promise<{ status: 'success'; receipt: string }>) {
  const q = createItemActionOutbox<PendingItemAction, string>({ namespace: 'env', storage: store,
    scope: { actorUserId: id(1), profileId: id(2) }, onChange() {}, onCommitted() {},
    send: createExposureOrderedSender(origin => evidence.canSendAction(origin), send, () => true) });
  actionQueues.push(q); q.start(); return q;
}

describe('exposure before action delivery', () => {
  it('persists the action but does not dispatch it until its impression acknowledgement', async () => {
    const store = storage(), connection = api(); let resolve!: (result: { error: null }) => void;
    connection.appendEvent.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const evidence = setup(store, connection); evidence.coordinator.enqueue(event());
    await vi.waitFor(() => expect(connection.appendEvent).toHaveBeenCalledOnce());
    const send = vi.fn(async () => ({ status: 'success' as const, receipt: 'ok' }));
    const q = actionQueue(store, evidence.coordinator, send); q.enqueue({ command: action() });
    await q.waitForIdle(); expect(send).not.toHaveBeenCalled(); expect(q.pending()).toHaveLength(1);
    expect(q.snapshot()).toMatchObject({ pendingCount: 1, message: null,
      canDiscardAction: false, canDiscardUndo: false });
    resolve({ error: null }); await evidence.coordinator.waitForIdle();
    q.retry(); await q.waitForIdle();
    expect(send).toHaveBeenCalledWith(action()); expect(q.pending()).toEqual([]);
  });
  it('retries normal exposure waiting automatically, without asking the user to retry', async () => {
    vi.useFakeTimers();
    const store = storage(), connection = api();
    let release!: (result: { error: null }) => void;
    connection.appendEvent.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const evidence = setup(store, connection);
    evidence.coordinator.enqueue(event());
    await vi.advanceTimersByTimeAsync(0);
    const send = vi.fn(async () => ({ status: 'success' as const, receipt: 'ok' }));
    const q = actionQueue(store, evidence.coordinator, send);
    q.enqueue({ command: action() }); await q.waitForIdle();
    expect(q.snapshot().message).toBeNull();
    release({ error: null }); await evidence.coordinator.waitForIdle();
    await vi.advanceTimersByTimeAsync(1000); await q.waitForIdle();
    expect(send).toHaveBeenCalledOnce();
    expect(q.pending()).toEqual([]);
  });

  it('still exposes a real action persistence error after exposure is acknowledged', async () => {
    const store = storage(), evidence = setup(store);
    evidence.coordinator.enqueue(event()); await evidence.coordinator.waitForIdle();
    const q = createItemActionOutbox({ namespace: 'real-failure', storage: store,
      scope: { actorUserId: id(1), profileId: id(2) }, onChange() {}, onCommitted() {},
      send: createExposureOrderedSender(origin => evidence.coordinator.canSendAction(origin),
        async () => ({ status: 'error' as const, retryable: true, message: 'Network unavailable' }), () => true) });
    actionQueues.push(q); q.start(); q.enqueue({ command: action() }); await q.waitForIdle();
    expect(q.snapshot().message).toBe('Network unavailable');
    expect(q.pending()).toHaveLength(1);
  });

  it('restores both queues and orders an old-session action behind its lost-reply impression', async () => {
    const store = storage(), firstApi = api();
    firstApi.appendEvent.mockResolvedValue({ error: { message: 'lost reply' } });
    const first = setup(store, firstApi); first.coordinator.enqueue(event()); await first.coordinator.waitForIdle();
    const send = vi.fn(async () => ({ status: 'success' as const, receipt: 'ok' }));
    const oldQueue = actionQueue(store, first.coordinator, send); oldQueue.enqueue({ command: action() });
    await oldQueue.waitForIdle(); oldQueue.stop(); first.coordinator.dispose();
    let resolve!: (result: { error: null }) => void; const nextApi = api();
    nextApi.appendEvent.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const next = setup(store, nextApi, session(30));
    await vi.waitFor(() => expect(nextApi.appendEvent).toHaveBeenCalledOnce());
    const nextQueue = actionQueue(store, next.coordinator, send); await nextQueue.waitForIdle();
    expect(send).not.toHaveBeenCalled();
    expect(nextApi.appendEvent.mock.calls[0]).toEqual(firstApi.appendEvent.mock.calls[0]);
    resolve({ error: null }); await next.coordinator.waitForIdle(); nextQueue.retry(); await nextQueue.waitForIdle();
    expect(send).toHaveBeenCalledOnce(); expect(send).toHaveBeenCalledWith(action());
  });
  it('only waits for the original matching exposure, never manufactures missing exposure', async () => {
    const connection = api(); connection.appendSession.mockResolvedValue({ error: { message: 'offline' } });
    const evidence = setup(storage(), connection); evidence.coordinator.enqueue(event()); await evidence.coordinator.waitForIdle();
    expect(evidence.coordinator.canSendAction(action())).toBe(false);
    for (const change of [{ predictionId: null }, { itemId: null }, { itemId: id(80) },
      { predictionId: id(81) }, { session: { sessionId: id(82) } }, { occurredAt: '2026-09-10T00:00:30Z' }]) {
      expect(evidence.coordinator.canSendAction({ ...action(), ...change })).toBe(true);
    }
    expect(evidence.coordinator.canSendAction({ ...action(), profileId: id(99) })).toBe(false);
    evidence.coordinator.dispose(); expect(evidence.coordinator.canSendAction(action())).toBe(false);
  });
  it('blocks correlated actions if persisted exposure cannot be read', async () => {
    const store = storage(), evidence = setup(store);
    store.getItemSync = () => { throw new Error('disk unavailable'); };
    expect(evidence.coordinator.canSendAction(action())).toBe(false);
    expect(evidence.coordinator.canSendAction({ ...action(), predictionId: null })).toBe(true);
  });
  it('does not dispatch through a stale action coordinator even when exposure is ready', async () => {
    const send = vi.fn(async () => ({ status: 'success' as const, receipt: 'ok' }));
    const guarded = createExposureOrderedSender(() => true, send, () => false);
    expect(await guarded(action())).toMatchObject({ status: 'error', retryable: true });
    expect(send).not.toHaveBeenCalled();
  });
});
