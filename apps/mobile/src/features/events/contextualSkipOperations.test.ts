import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeContextualSkipReceipt, decodeDiscoverySkipSource, decodeTasteSkipCapability, isNativeContextualSkipCommand,
  loadDiscoverySkipSource, sendContextualSkip, type ContextualSkipRpc, type KajoSkipCommand, type KajoSkipReceipt } from './contextualSkipOperations';
import { createDiscoverySkipOutbox } from './contextualSkipOutbox';
import { getBootstrapEvidenceRevision, getContextualSkipRevision } from '../discovery/predictionRefresh';

const id = (n: number) => `ab157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = { actorUserId: id(1), profileId: id(2) };
const discovery = { surface: 'DISCOVERY' as const, sessionId: id(5), predictionId: id(6), deliveryRequestId: id(7), impressionEventId: id(8) };
const taste = { surface: 'TASTE' as const, sessionId: id(5), questionId: id(6), panelId: id(7), prefixRevision: 2 };
const command: KajoSkipCommand = { version: 'kajo-contextual-skip-v1', kind: 'CONTEXTUAL_SKIP', ...scope,
  actionId: id(3), itemId: id(4), occurredAt: '1792144800000001', contextRef: null, reversesActionId: null, origin: discovery };
const receipt = (c = command): KajoSkipReceipt => ({ version: c.version, ...scope, actionId: c.actionId, itemId: c.itemId,
  acceptedAt: '1792144800000019', policyVersion: 'contextual-skip-cooldown-v1', semantic: c.kind, reversesActionId: c.reversesActionId,
  evidence: c.origin.surface === 'TASTE' ? 'PRIVATE_TASTE_RESPONSE' : 'CANONICAL_DISCOVERY_EVENT' });
const sourceRequest = { ...scope, itemId: command.itemId, origin: discovery };
const source = { ...sourceRequest, version: command.version, policyVersion: 'contextual-skip-cooldown-v1',
  contextChangePolicy: 'NO_TRUSTED_CONTEXT_CHANGE_V1', contextRef: null, acceptsNewSkip: true };
const capability = { version: command.version, policyVersion: 'contextual-skip-cooldown-v1', contextRef: null, origin: taste };
const queues: ReturnType<typeof createDiscoverySkipOutbox>[] = [];
afterEach(() => { queues.splice(0).forEach(q => q.stop()); });
function setup(rpc: ContextualSkipRpc, rows = new Map<string, string>(), options: { namespace?: string; scope?: typeof scope; isCurrent?: () => boolean } = {}) {
  const storage = { getItemSync: (key: string) => rows.get(key) ?? null, setItemSync: (key: string, value: string) => { rows.set(key, value); } };
  const onCommitted = vi.fn();
  const queue = createDiscoverySkipOutbox({ namespace: options.namespace ?? 'test', scope: options.scope ?? scope,
    isCurrent: options.isCurrent ?? (() => true), storage, rpc, onChange: vi.fn(), onCommitted });
  queues.push(queue); queue.start(); return { queue, rows, storage, onCommitted };
}

describe('native contextual skip protocol boundary', () => {
  it('routes private Taste and canonical Discovery to separate writers with exact microseconds', async () => {
    const rpc = vi.fn<ContextualSkipRpc>(async (_name, args) => ({ data: receipt('command' in args ? args.command : command), error: null }));
    expect(await sendContextualSkip(rpc, command)).toEqual({ status: 'success', receipt: receipt() });
    const privateCommand = { ...command, origin: taste };
    expect(await sendContextualSkip(rpc, privateCommand)).toEqual({ status: 'success', receipt: receipt(privateCommand) });
    expect(rpc.mock.calls.map(c => c[0])).toEqual(['commit_discovery_contextual_skip_v1', 'commit_taste_contextual_skip_v1']);
    expect(rpc.mock.calls[0]?.[1]).toEqual({ command });
  });
  it('matches every receipt binding and preserves uncertain acknowledgements', async () => {
    for (const change of [{ actorUserId: id(99) }, { profileId: id(99) }, { itemId: id(99) }, { actionId: id(99) },
      { version: 'v2' }, { policyVersion: 'v2' }, { evidence: 'PRIVATE_TASTE_RESPONSE' }, { semantic: 'WITHDRAW_CONTEXTUAL_SKIP' },
      { reversesActionId: id(99) }, { acceptedAt: '01792144800000019' }, { acceptedAt: '1' }, { other: true }]) {
      expect(decodeContextualSkipReceipt({ ...receipt(), ...change }, command)).toBeNull();
    }
    const rpc = vi.fn<ContextualSkipRpc>(async () => ({ data: { ...receipt(), actorUserId: id(99) }, error: null }));
    expect(await sendContextualSkip(rpc, command)).toMatchObject({ status: 'error', retryable: false });
    expect(await sendContextualSkip(rpc, command)).not.toHaveProperty('rejectedAction');
  });
  it('does not admit caller context tokens, unknown keys, uppercase IDs or legacy commands', async () => {
    for (const invalid of [{ ...command, contextRef: id(99) }, { ...command, extra: true },
      { ...command, actionId: command.actionId.toUpperCase() }, { ...command, kind: 'SET_NOT_INTERESTED' },
      { ...command, occurredAt: '253402300800000000' }]) expect(isNativeContextualSkipCommand(invalid)).toBe(false);
    const rpc = vi.fn<ContextualSkipRpc>();
    await sendContextualSkip(rpc, { ...command, contextRef: id(99) }); expect(rpc).not.toHaveBeenCalled();
  });
  it('negotiates only exact native source bindings and retains unavailable context', async () => {
    expect(decodeTasteSkipCapability(capability, taste.sessionId, taste.questionId)).toEqual(capability);
    expect(decodeTasteSkipCapability(capability, taste.sessionId, id(99))).toBeNull();
    expect(decodeTasteSkipCapability({ ...capability, contextRef: id(99) }, taste.sessionId, taste.questionId)).toBeNull();
    expect(decodeDiscoverySkipSource(source, sourceRequest)).toEqual(source);
    expect(decodeDiscoverySkipSource({ ...source, acceptsNewSkip: false }, sourceRequest)?.acceptsNewSkip).toBe(false);
    for (const change of [{ actorUserId: id(99) }, { profileId: id(99) }, { itemId: id(99) },
      { contextChangePolicy: 'CLIENT_CHANGED' }, { contextRef: id(99) }, { extra: true }, { acceptsNewSkip: 'true' },
      { origin: { ...discovery, impressionEventId: id(99) } }, { origin: { ...discovery, deliveryRequestId: id(99) } }]) {
      expect(decodeDiscoverySkipSource({ ...source, ...change }, sourceRequest)).toBeNull();
    }
    const rpc = vi.fn<ContextualSkipRpc>().mockResolvedValueOnce({ data: source, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' } });
    expect(await loadDiscoverySkipSource(rpc, sourceRequest)).toEqual(source);
    expect(rpc.mock.calls[0]?.slice(0, 2)).toEqual(['discovery_contextual_skip_source_v1', { request: sourceRequest }]);
    expect(await loadDiscoverySkipSource(rpc, sourceRequest)).toBeNull();
  });
  it('retries not-yet-committed sources and preserves missing writers without reinterpreting the command', async () => {
    const rpc = vi.fn<ContextualSkipRpc>();
    for (const code of ['40001', '25001', '08006']) {
      rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'retry' } });
      expect(await sendContextualSkip(rpc, command)).toMatchObject({ status: 'error', retryable: true });
    }
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' } });
    expect(await sendContextualSkip(rpc, command)).toMatchObject({ status: 'error', retryable: false });
    for (const code of ['22023', '42501', 'KJ002', 'KJ003']) {
      rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'rejected' } });
      expect(await sendContextualSkip(rpc, command)).toMatchObject({ status: 'error', retryable: false, rejectedAction: true });
    }
  });
});

describe('dedicated native Discovery skip durable route', () => {
  it('replays the original source after a lost reply and restart, with no bootstrap mutation', async () => {
    let lost = true;
    const rpc = vi.fn<ContextualSkipRpc>(async () => { if (lost) { lost = false; throw Error('lost acknowledgement'); } return { data: receipt(), error: null }; });
    const first = setup(rpc); const before = getContextualSkipRevision(), bootstrap = getBootstrapEvidenceRevision();
    first.queue.enqueue({ command }); await first.queue.waitForIdle(); first.queue.stop();
    expect(getContextualSkipRevision()).toBe(before); expect(first.queue.pending()[0]?.command).toEqual(command);
    const restarted = setup(rpc, first.rows); await restarted.queue.waitForIdle();
    expect(rpc.mock.calls[0]?.[1]).toEqual(rpc.mock.calls[1]?.[1]);
    expect(restarted.onCommitted).toHaveBeenCalledExactlyOnceWith(receipt());
    expect(getContextualSkipRevision()).toBe(before + 1); expect(getBootstrapEvidenceRevision()).toBe(bootstrap);
  });
  it('retains a locally unacknowledged receipt and isolates actor, Profile and backend scopes', async () => {
    const rpc = vi.fn<ContextualSkipRpc>(async () => ({ data: receipt(), error: null }));
    const first = setup(rpc); const write = first.storage.setItemSync;
    first.storage.setItemSync = (key, value) => { if (value === '[]') throw Error('disk'); write(key, value); };
    first.queue.enqueue({ command }); await first.queue.waitForIdle(); first.queue.stop();
    expect(first.onCommitted).not.toHaveBeenCalled(); rpc.mockClear();
    for (const options of [{ namespace: 'another' }, { scope: { ...scope, profileId: id(90) } }, { scope: { ...scope, actorUserId: id(90) } }]) {
      const other = setup(rpc, first.rows, options); await other.queue.waitForIdle(); other.queue.stop();
    }
    expect(rpc).not.toHaveBeenCalled();
    const resumed = setup(rpc, first.rows); await resumed.queue.waitForIdle(); expect(resumed.queue.pending()).toEqual([]);
  });
  it('preserves old queue bytes, blocks corrupt skip payloads and suppresses stale callbacks', async () => {
    const rows = new Map([['kajo:item-actions:v1:test:' + scope.actorUserId + ':' + scope.profileId, '[{"legacy":"unchanged"}]']]);
    let release!: (value: Awaited<ReturnType<ContextualSkipRpc>>) => void; let current = true;
    const rpc = vi.fn<ContextualSkipRpc>(() => new Promise(resolve => { release = resolve; }));
    const first = setup(rpc, rows, { isCurrent: () => current }); first.queue.enqueue({ command }); await Promise.resolve();
    current = false; release({ data: receipt(), error: null }); await first.queue.waitForIdle();
    expect(first.onCommitted).not.toHaveBeenCalled(); expect(first.queue.pending()).toEqual([]); first.queue.stop();
    expect([...rows.values()]).toContain('[{"legacy":"unchanged"}]');
    const key = [...rows.keys()].find(k => k.includes('discovery-contextual-skip-v1'))!;
    const invalid = JSON.stringify([{ command: { ...command, origin: taste } }]); rows.set(key, invalid); rpc.mockClear();
    const restarted = setup(rpc, rows); await restarted.queue.waitForIdle(); expect(restarted.queue.snapshot().ready).toBe(false);
    expect(rows.get(key)).toBe(invalid); expect(rpc).not.toHaveBeenCalled();
  });
});
