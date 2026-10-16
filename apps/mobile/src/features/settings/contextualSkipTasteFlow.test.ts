import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPersonalTasteFlow, type PersonalTasteFlow } from './personalTasteFlow';
import { sendTasteCommand, type TasteRpc } from './personalTasteOperations';
import { id, profileId, sessionId, sequentialResponse } from './personalTasteTestFixtures';
import type { ContextualSkipRpc, KajoSkipCommand, KajoSkipReceipt } from '../events/contextualSkipOperations';
import { getBootstrapEvidenceRevision, getContextualSkipRevision } from '../discovery/predictionRefresh';

const flows: PersonalTasteFlow[] = [];
afterEach(() => { flows.splice(0).forEach(flow => flow.stop()); });
const capability = (questionId = id(300)) => ({ version: 'kajo-contextual-skip-v1', policyVersion: 'contextual-skip-cooldown-v1',
  contextRef: null, origin: { surface: 'TASTE', sessionId, questionId, panelId: id(400), prefixRevision: 1 } });
function response(status = 'QUESTION', revision = 2, answered = 0) {
  return { ...sequentialResponse(status, revision, answered), contextualSkip: status === 'QUESTION' ? capability(id(300 + answered)) : null };
}
function receipt(command: KajoSkipCommand): KajoSkipReceipt {
  return { version: command.version, actionId: command.actionId, actorUserId: command.actorUserId, profileId: command.profileId,
    itemId: command.itemId, acceptedAt: '1792144800000002', policyVersion: 'contextual-skip-cooldown-v1',
    evidence: 'PRIVATE_TASTE_RESPONSE', semantic: command.kind, reversesActionId: command.reversesActionId };
}
let sequence = 1000;
function server() {
  let data = response();
  const order: string[] = [];
  const rpc = vi.fn<TasteRpc>(async (_name, { request }) => {
    order.push(request.operation);
    if (request.operation === 'NEXT') data = response('QUESTION', data.revision + 1, data.answered);
    if (request.operation === 'PAUSE') data = response('PAUSED', data.revision + 1, data.answered);
    return { data, error: null };
  });
  const skipRpc = vi.fn<ContextualSkipRpc>(async (_name, args) => {
    if (!('command' in args)) throw Error('Wrong RPC');
    order.push(args.command.kind);
    data = response('NEEDS_NEXT', data.revision + 1, data.answered + 1);
    return { data: receipt(args.command), error: null };
  });
  return { rpc, skipRpc, order, get: () => data, set: (next: ReturnType<typeof response>) => { data = next; } };
}
function setup(s: ReturnType<typeof server>, rows = new Map<string, string>(), extra: Partial<Parameters<typeof createPersonalTasteFlow>[0]> = {}) {
  const storage = { getItemSync: (key: string) => rows.get(key) ?? null,
    setItemSync: (key: string, value: string) => { rows.set(key, value); } };
  const flow = createPersonalTasteFlow({ namespace: 'native-test', actorUserId: id(1), profileId, storage,
    rpc: s.rpc, contextualSkipRpc: s.skipRpc, onChange: vi.fn(), createId: () => id(sequence++),
    nowMicros: () => '1792144800000001', ...extra });
  flows.push(flow); return { flow, rows, storage };
}

describe('native Taste skip controller without presentation activation', () => {
  it('negotiates optional capability without relabeling old v2 responses', async () => {
    const command = { functionName: 'taste_session_v2' as const, request: { operation: 'RESUME' as const, profileId, sessionId } };
    const rpc = vi.fn<TasteRpc>(async () => ({ data: sequentialResponse(), error: null }));
    expect(await sendTasteCommand(rpc, command, new AbortController().signal)).toMatchObject({ status: 'success',
      response: { kind: 'sequential', value: { contextualSkip: null } } });
    rpc.mockResolvedValueOnce({ data: response(), error: null });
    expect(await sendTasteCommand(rpc, command, new AbortController().signal)).toMatchObject({ status: 'success',
      response: { value: { contextualSkip: capability() } } });
    for (const invalid of [capability(id(999)), { ...capability(), contextRef: id(999) },
      { ...capability(), policyVersion: 'later' }, { ...capability(), origin: { ...capability().origin, prefixRevision: 257 } }]) {
      rpc.mockResolvedValueOnce({ data: { ...response(), contextualSkip: invalid }, error: null });
      expect(await sendTasteCommand(rpc, command, new AbortController().signal)).toMatchObject({ status: 'error' });
    }
    const s = server(); s.rpc.mockResolvedValue({ data: sequentialResponse(), error: null });
    const { flow } = setup(s); flow.start(); await flow.waitForIdle();
    expect(flow.skipCurrent(id(100), 2)).toBe(false); expect(s.skipRpc).not.toHaveBeenCalled();
  });
  it('serializes skip against ANSWER and PAUSE, then resumes before a separate NEXT', async () => {
    const s = server(), { flow, rows } = setup(s); flow.start(); await flow.waitForIdle(); s.order.length = 0;
    let release!: (value: Awaited<ReturnType<ContextualSkipRpc>>) => void;
    s.skipRpc.mockImplementationOnce(async (_name, args) => {
      if (!('command' in args)) throw Error('Wrong RPC'); s.order.push(args.command.kind);
      return new Promise(resolve => { release = resolve; });
    });
    const bootstrap = getBootstrapEvidenceRevision(), revision = getContextualSkipRevision();
    expect(flow.skipCurrent(id(100), 2)).toBe(true); await Promise.resolve();
    const pending = JSON.parse([...rows.values()][0]!).pending;
    expect(pending).toMatchObject({ functionName: 'commit_taste_contextual_skip_v1', command: {
      kind: 'CONTEXTUAL_SKIP', actorUserId: id(1), profileId, itemId: id(100), contextRef: null, origin: capability().origin } });
    expect(flow.answerTraining({ kind: 'RATING', value: 0 }, id(100), 2)).toBe(false);
    expect(flow.skipCurrent(id(100), 2)).toBe(false); expect(flow.dismiss()).toBe(false);
    expect(getContextualSkipRevision()).toBe(revision); expect(s.order).toEqual(['CONTEXTUAL_SKIP']);
    s.set(response('NEEDS_NEXT', 3, 1)); release({ data: receipt(pending.command), error: null }); await flow.waitForIdle();
    expect(s.order).toEqual(['CONTEXTUAL_SKIP', 'RESUME', 'NEXT', 'RESUME']);
    expect(getContextualSkipRevision()).toBe(revision + 1); expect(getBootstrapEvidenceRevision()).toBe(bootstrap);
    expect(flow.snapshot()).toMatchObject({ pending: false, sequential: { item: { id: id(101) }, revision: 4 } });
    expect(flow.skipCurrent(id(100), 2)).toBe(false);
  });
  it('replays a lost acknowledgement exactly after restart and does not use a cached question', async () => {
    const s = server(), { flow, rows } = setup(s); flow.start(); await flow.waitForIdle();
    s.skipRpc.mockImplementationOnce(async () => { s.set(response('NEEDS_NEXT', 3, 1)); throw Error('reply lost'); });
    flow.skipCurrent(id(100), 2); await flow.waitForIdle(); flow.stop();
    const retained = JSON.parse([...rows.values()][0]!).pending.command;
    s.set(response('QUESTION', 6, 2)); // Another device has advanced further.
    s.skipRpc.mockResolvedValueOnce({ data: receipt(retained), error: null }); s.order.length = 0;
    const resumed = setup(s, rows); resumed.flow.start(); await resumed.flow.waitForIdle();
    expect(s.skipRpc.mock.calls[0]?.[1]).toEqual(s.skipRpc.mock.calls[1]?.[1]);
    expect(s.order).toEqual(['RESUME']); expect(resumed.flow.snapshot().sequential?.item?.id).toBe(id(102));
  });
  it('retains exact pending bytes on local acknowledgement failure and missing writer', async () => {
    const s = server(), { flow, rows, storage } = setup(s); flow.start(); await flow.waitForIdle();
    const write = storage.setItemSync;
    storage.setItemSync = (key, value) => { if (JSON.parse(value).pending === null) throw Error('disk'); write(key, value); };
    flow.skipCurrent(id(100), 2); await flow.waitForIdle(); expect(flow.snapshot()).toMatchObject({ pending: true, blocked: true });
    const retained = [...rows.values()][0]!; flow.stop();
    s.skipRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing writer' } });
    const resumed = setup(s, rows); resumed.flow.start(); await resumed.flow.waitForIdle();
    expect([...rows.values()][0]).toBe(retained); expect(resumed.flow.snapshot()).toMatchObject({ pending: true, blocked: true, legacy: false, conflict: false });
    expect(s.rpc.mock.calls.every(call => call[0] === 'taste_session_v2')).toBe(true);
  });
  it('retries an uncommitted source, but requires explicit recovery after source erasure', async () => {
    const s = server(), { flow } = setup(s); flow.start(); await flow.waitForIdle();
    s.skipRpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'SOURCE_NOT_COMMITTED' } });
    flow.skipCurrent(id(100), 2); await flow.waitForIdle();
    expect(flow.snapshot()).toMatchObject({ pending: true, conflict: false, blocked: false });
    s.skipRpc.mockResolvedValueOnce({ data: null, error: { code: 'KJ002', message: 'SOURCE_WITHDRAWN' } });
    flow.retry(); await flow.waitForIdle(); expect(flow.snapshot()).toMatchObject({ pending: true, conflict: true, blocked: true });
    const sent = s.skipRpc.mock.calls.length; flow.retry(); await flow.waitForIdle(); expect(s.skipRpc).toHaveBeenCalledTimes(sent);
    s.set(response('STOPPED', 3)); flow.recoverConflict(); await flow.waitForIdle();
    expect(flow.snapshot()).toMatchObject({ pending: false, sequential: { status: 'STOPPED' } });
  });
  it('withdraws only the captured Taste source and preserves scope on restart', async () => {
    const s = server(), { flow, rows } = setup(s); flow.start(); await flow.waitForIdle();
    flow.skipCurrent(id(100), 2); await flow.waitForIdle();
    const args = s.skipRpc.mock.calls[0]![1]; if (!('command' in args)) throw Error('Wrong command');
    const original = args.command;
    expect(flow.withdrawContextualSkip({ ...original, actorUserId: id(99) })).toBe(false);
    s.skipRpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'offline' } });
    expect(flow.withdrawContextualSkip(original)).toBe(true); await flow.waitForIdle(); flow.stop();
    const withdrawal = s.skipRpc.mock.calls[1]![1];
    expect(withdrawal).toMatchObject({ command: { kind: 'WITHDRAW_CONTEXTUAL_SKIP', reversesActionId: original.actionId, origin: original.origin } });
    const before = s.skipRpc.mock.calls.length;
    for (const extra of [{ actorUserId: id(99) }, { profileId: id(99) }, { namespace: 'another' }]) {
      const other = setup(s, rows, { ...extra, autoStart: false }); other.flow.start(); await other.flow.waitForIdle(); other.flow.stop();
    }
    expect(s.skipRpc).toHaveBeenCalledTimes(before);
  });
});
