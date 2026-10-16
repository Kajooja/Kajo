// The production queue is exercised against the pure protocol oracle. No RPC or
// UI is enabled by this fixture; native SQL locking and source adapters are later gates.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyKajoContextualSkip, isKajoSkipCommand } from '../../../../../packages/prediction-engine/src/adapters/kajo-contextual-skip';
import type { KajoSkipAuthority, KajoSkipCommand, KajoSkipEntry, KajoSkipReceipt } from '../../../../../packages/prediction-engine/src/adapters/kajo-contextual-skip';
import { createItemActionOutbox } from './itemActionOutbox';
import type { ItemActionOutbox, ItemActionStorage } from './itemActionOutbox';
import type { ItemActionResult } from './itemActionPersistence';
import type { ItemActionScope } from './itemActionCommands';

type Pending = { command: KajoSkipCommand };
const id = (n: number) => `ab157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = { actorUserId: id(1), profileId: id(2) };
const command: KajoSkipCommand = { version: 'kajo-contextual-skip-v1', kind: 'CONTEXTUAL_SKIP', ...scope,
  actionId: id(3), itemId: id(4), occurredAt: '101', contextRef: null, reversesActionId: null,
  origin: { surface: 'DISCOVERY', sessionId: id(5), predictionId: id(6), deliveryRequestId: id(7), impressionEventId: id(8) } };
const authority: KajoSkipAuthority = { role: 'authenticated', isAnonymous: false, actorUserId: scope.actorUserId,
  profile: { id: scope.profileId, type: 'PERSONAL', ownerUserId: scope.actorUserId, acceptedMemberIds: [scope.actorUserId] },
  source: { ...scope, itemId: command.itemId, origin: command.origin, contextRef: null, committedAt: '100', available: true }, acceptedAt: '102' };
const queues: ItemActionOutbox<Pending>[] = [];
afterEach(() => { queues.splice(0).forEach(q => q.stop()); vi.useRealTimers(); });
const store = (): ItemActionStorage & { rows: Map<string, string> } => {
  const rows = new Map<string, string>();
  return { rows, getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { rows.set(key, value); } };
};
function pending(value: unknown, target: ItemActionScope): value is Pending {
  if (!value || typeof value !== 'object' || !('command' in value) || !isKajoSkipCommand(value.command)) return false;
  return value.command.actorUserId === target.actorUserId && value.command.profileId === target.profileId;
}
function setup(storage: ItemActionStorage, send: (c: KajoSkipCommand) => Promise<ItemActionResult<KajoSkipReceipt>>,
  options: { scope?: ItemActionScope; namespace?: string; isCurrent?: () => boolean } = {}) {
  const onCommitted = vi.fn();
  const queue = createItemActionOutbox<Pending, KajoSkipReceipt>({ storage, send, onCommitted, onChange: () => {},
    scope: options.scope ?? scope, namespace: options.namespace ?? 'skip-contract-fixture',
    isPendingAction: pending, ...(options.isCurrent ? { isCurrent: options.isCurrent } : {}) });
  queues.push(queue); queue.start(); return { queue, onCommitted };
}
describe('neutral skip recovery through the existing durable queue', () => {
  it('keeps one exact command after a committed but lost reply and process restart', async () => {
    const storage = store(); let entries: readonly KajoSkipEntry[] = []; let lose = true;
    const send = vi.fn(async (c: KajoSkipCommand): Promise<ItemActionResult<KajoSkipReceipt>> => {
      expect([...storage.rows.values()].some(row => row.includes(c.actionId))).toBe(true);
      const result = applyKajoContextualSkip(entries, c, authority); entries = result.entries;
      if (lose) { lose = false; throw new Error('response lost after commit'); }
      return { status: 'success', receipt: result.receipt };
    });
    const first = setup(storage, send); first.queue.enqueue({ command }); await first.queue.waitForIdle(); first.queue.stop();
    expect(entries).toHaveLength(1); expect(first.onCommitted).not.toHaveBeenCalled(); expect(first.queue.pending()).toHaveLength(1);
    const restarted = setup(storage, send); await restarted.queue.waitForIdle();
    expect(entries).toHaveLength(1); expect(send.mock.calls[0]?.[0]).toEqual(send.mock.calls[1]?.[0]);
    expect(restarted.onCommitted).toHaveBeenCalledOnce(); expect(restarted.queue.pending()).toEqual([]);
  });
  it('local acknowledgement failure retains the exact receipt for retry', async () => {
    const storage = store(); let fail = true; let entries: readonly KajoSkipEntry[] = [];
    const send = vi.fn(async (c: KajoSkipCommand): Promise<ItemActionResult<KajoSkipReceipt>> => {
      const result = applyKajoContextualSkip(entries, c, authority); entries = result.entries;
      return { status: 'success', receipt: result.receipt };
    });
    const guarded = { ...storage, setItemSync(key: string, value: string) {
      if (value === '[]' && fail) { fail = false; throw new Error('local disk failure'); }
      storage.setItemSync(key, value);
    } };
    const first = setup(guarded, send); first.queue.enqueue({ command }); await first.queue.waitForIdle();
    expect(first.onCommitted).not.toHaveBeenCalled(); expect(first.queue.pending()).toHaveLength(1);
    first.queue.retry(); await first.queue.waitForIdle();
    expect(entries).toHaveLength(1); expect(first.onCommitted).toHaveBeenCalledOnce();
  });
  it('never dispatches an old actor/Profile/backend command in a new scope', async () => {
    const storage = store(), send = vi.fn(async (): Promise<ItemActionResult<KajoSkipReceipt>> => ({ status: 'error', retryable: true, message: 'offline' }));
    const first = setup(storage, send); first.queue.enqueue({ command }); await first.queue.waitForIdle(); first.queue.stop(); send.mockClear();
    for (const options of [{ scope: { ...scope, actorUserId: id(90) } }, { scope: { ...scope, profileId: id(90) } }, { namespace: 'other-backend' }]) {
      const other = setup(storage, send, options); await other.queue.waitForIdle(); expect(other.queue.pending()).toEqual([]); other.queue.stop();
    }
    expect(send).not.toHaveBeenCalled(); expect(first.queue.pending()[0]?.command).toEqual(command);
  });
  it('keeps conflicts pending for explicit recovery and preserves corrupt/legacy payloads without dispatch', async () => {
    const storage = store(), send = vi.fn(async (): Promise<ItemActionResult<KajoSkipReceipt>> => ({ status: 'error', retryable: false,
      rejectedAction: true, message: 'source withdrawn or origin conflict' }));
    const first = setup(storage, send); first.queue.enqueue({ command }); await first.queue.waitForIdle();
    expect(first.onCommitted).not.toHaveBeenCalled(); expect(first.queue.snapshot().canDiscardAction).toBe(true);
    first.queue.stop(); const key = [...storage.rows.keys()][0]!;
    const bad = JSON.stringify([{ command: { ...command, kind: 'SET_RATING', rating: 0 } }]); storage.rows.set(key, bad); send.mockClear();
    const restarted = setup(storage, send); await restarted.queue.waitForIdle();
    expect(restarted.queue.snapshot().ready).toBe(false); expect(send).not.toHaveBeenCalled(); expect(storage.rows.get(key)).toBe(bad);
  });
  it('suspends stale callbacks after scope changes while safely acknowledging their own stored command', async () => {
    let current = true; let resolve!: (result: ItemActionResult<KajoSkipReceipt>) => void;
    const send = vi.fn(() => new Promise<ItemActionResult<KajoSkipReceipt>>(done => { resolve = done; }));
    const { queue, onCommitted } = setup(store(), send, { isCurrent: () => current });
    queue.enqueue({ command }); await Promise.resolve(); current = false;
    resolve({ status: 'success', receipt: applyKajoContextualSkip([], command, authority).receipt }); await queue.waitForIdle();
    expect(onCommitted).not.toHaveBeenCalled(); expect(queue.pending()).toEqual([]);
  });
});
