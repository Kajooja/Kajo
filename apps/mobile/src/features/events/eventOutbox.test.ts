import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event, EventSession } from '../../domain/contracts';
import type { PersistedEventRow, PersistedEventSessionRow } from './eventPersistence';
import type { ItemActionStorage } from './itemActionOutbox';
import type { EventWriteCoordinator } from './eventTracking';
import { createEventWriteCoordinator } from './eventOutbox';

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
function setup(store: ItemActionStorage, connection = api(), s = session(), namespace = 'env', isCurrent?: () => boolean) {
  const onChange = vi.fn();
  const coordinator = createEventWriteCoordinator(connection, s, onChange,
    { storage: store, namespace, ...(isCurrent ? { isCurrent } : {}) });
  coordinators.push(coordinator); coordinator.start();
  return { coordinator, connection, onChange };
}
afterEach(() => { coordinators.splice(0).forEach(c => c.dispose()); vi.useRealTimers(); });

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
