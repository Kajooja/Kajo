import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPersonalTasteFlow, type PersonalTasteFlow } from './personalTasteFlow';
import { getBootstrapEvidenceRevision } from '../discovery/predictionRefresh';
import { isTasteCommand, sendTasteCommand, type TasteCommand, type TasteRpc } from './personalTasteOperations';
import { id, profileId, sessionId, sequentialResponse, sessionResponse } from './personalTasteTestFixtures';

const flows: PersonalTasteFlow[] = [];
afterEach(() => { flows.forEach(f => f.stop()); flows.length = 0; });
const ok = (data: unknown) => ({ data, error: null });
let sequence = 1000;
function setup(rpc: TasteRpc, rows = new Map<string, string>(), extras: Partial<Parameters<typeof createPersonalTasteFlow>[0]> = {}) {
  const storage = { getItemSync: (key: string) => rows.get(key) ?? null,
    setItemSync: (key: string, value: string) => { rows.set(key, value); } };
  const flow = createPersonalTasteFlow({ namespace: 'https://test.invalid', actorUserId: id(1), profileId, storage,
    rpc, onChange: vi.fn(), createId: () => id(sequence++), ...extras });
  flows.push(flow); return { flow, rows, storage };
}
function server() {
  let data = sequentialResponse('NEEDS_NEXT', 1);
  const rpc = vi.fn<TasteRpc>(async (_name, { request }) => {
    if (request.operation === 'NEXT') data = sequentialResponse('QUESTION', data.revision + 1, data.answered);
    if (request.operation === 'ANSWER') data = sequentialResponse('NEEDS_NEXT', data.revision + 1, data.answered + 1);
    if (request.operation === 'PAUSE') data = sequentialResponse('PAUSED', data.revision + 1, data.answered);
    if (request.operation === 'CONTINUE') data = sequentialResponse('QUESTION', data.revision + 1, data.answered);
    return ok(data);
  });
  return { rpc, get: () => data, set: (next: ReturnType<typeof sequentialResponse>) => { data = next; } };
}
const operations = (rpc: ReturnType<typeof server>['rpc']) => rpc.mock.calls.map(c => c[1].request.operation);

describe('sequential Taste mobile persistence and committed command ordering', () => {
  it('creates no session until Begin, then uses separate START, RESUME, NEXT and RESUME calls', async () => {
    const { rpc } = server(); const { flow, rows } = setup(rpc, undefined, { autoStart: false });
    flow.start(); expect(rpc).not.toHaveBeenCalled(); expect(flow.snapshot().needsStart).toBe(true);
    flow.begin(); await flow.waitForIdle();
    expect(operations(rpc)).toEqual(['START', 'RESUME', 'NEXT', 'RESUME']);
    expect(rpc.mock.calls.every(c => c[0] === 'taste_session_v2')).toBe(true);
    expect(flow.snapshot().sequential).toMatchObject({ status: 'QUESTION', questionId: id(300), revision: 2 });
    expect(JSON.parse([...rows.values()][0]!)).toEqual({ version: 2, protocol: 'v2', sessionId, challengeId: null, pending: null, dismissed: false });
  });
  it('does not request another forecast until the exact answer is acknowledged and reloaded', async () => {
    const s = server(); let release!: (v: Awaited<ReturnType<TasteRpc>>) => void;
    const { flow, rows } = setup(s.rpc); flow.start(); await flow.waitForIdle(); s.rpc.mockClear();
    s.rpc.mockImplementationOnce(async () => new Promise(resolve => { release = resolve; }));
    expect(flow.answerTraining({ kind: 'RATING', value: 0 }, id(100), 2)).toBe(true); await Promise.resolve();
    expect(JSON.parse([...rows.values()][0]!).pending.request).toMatchObject({ operation: 'ANSWER', questionId: id(300), expectedRevision: 2, answer: { kind: 'RATING', value: 0 } });
    expect(flow.answerTraining({ kind: 'UNKNOWN' }, id(100), 2)).toBe(false); expect(flow.dismiss()).toBe(false);
    expect(operations(s.rpc)).toEqual(['ANSWER']);
    const before = getBootstrapEvidenceRevision();
    s.set(sequentialResponse('NEEDS_NEXT', 3, 1)); release(ok(s.get())); await flow.waitForIdle();
    expect(operations(s.rpc)).toEqual(['ANSWER', 'RESUME', 'NEXT', 'RESUME']);
    expect(s.rpc.mock.calls[2]?.[1].request.expectedRevision).toBe(3);
    expect(getBootstrapEvidenceRevision()).toBe(before + 1);
    expect(flow.snapshot().sequential?.item?.id).toBe(id(101));
    expect(flow.answerTraining({ kind: 'RATING', value: 10 }, id(100), 2)).toBe(false);
  });
  it('replays a lost ANSWER acknowledgement exactly after restart, before NEXT', async () => {
    const s = server(); const { flow, rows } = setup(s.rpc); flow.start(); await flow.waitForIdle(); s.rpc.mockClear();
    s.rpc.mockImplementationOnce(async () => { s.set(sequentialResponse('NEEDS_NEXT', 3, 1)); throw Error('lost response'); });
    flow.answerTraining({ kind: 'NOT_INTERESTED' }, id(100), 2); await flow.waitForIdle();
    expect(flow.snapshot().pending).toBe(true); expect(operations(s.rpc)).toEqual(['ANSWER']); flow.stop();
    s.rpc.mockImplementationOnce(async () => ok(s.get()));
    const resumed = setup(s.rpc, rows); resumed.flow.start(); await resumed.flow.waitForIdle();
    expect(s.rpc.mock.calls[1]?.[1].request).toEqual(s.rpc.mock.calls[0]?.[1].request);
    expect(operations(s.rpc)).toEqual(['ANSWER', 'ANSWER', 'RESUME', 'NEXT', 'RESUME']);
    expect(resumed.flow.snapshot()).toMatchObject({ pending: false, sequential: { answered: 1, status: 'QUESTION' } });
  });
  it('replays NEXT with its retained ID and reloads current server state instead of rendering a stale cached card', async () => {
    const s = server(); const { flow, rows } = setup(s.rpc); flow.start(); await flow.waitForIdle();
    const original = s.rpc.getMockImplementation()!;
    let cached: ReturnType<typeof sequentialResponse> | null = null;
    s.rpc.mockImplementation(async (name, args, signal) => {
      if (args.request.operation === 'NEXT') {
        if (!cached) { await original(name, args, signal); cached = s.get(); throw Error('NEXT ack lost'); }
        return ok(cached);
      }
      return original(name, args, signal);
    });
    flow.answerTraining({ kind: 'UNKNOWN' }, id(100), 2); await flow.waitForIdle();
    expect(flow.snapshot().pending).toBe(true); flow.stop();
    s.set(sequentialResponse('QUESTION', 6, 2)); // Another device answered the cached question.
    const resumed = setup(s.rpc, rows); resumed.flow.start(); await resumed.flow.waitForIdle();
    expect(resumed.flow.snapshot().sequential?.item?.id).toBe(id(102));
    const calls = s.rpc.mock.calls.filter(c => c[1].request.operation === 'NEXT');
    expect(calls.at(-1)?.[1].request).toEqual(calls.at(-2)?.[1].request);
  });
  it('cannot advance after a failed local acknowledgement and retries that original command', async () => {
    const s = server(); const { flow, rows, storage } = setup(s.rpc); flow.start(); await flow.waitForIdle(); s.rpc.mockClear();
    const originalWrite = storage.setItemSync; let writes = 0;
    storage.setItemSync = (key, value) => { if (++writes > 1) throw Error('disk full'); originalWrite(key, value); };
    flow.answerTraining({ kind: 'UNKNOWN' }, id(100), 2); await flow.waitForIdle();
    expect(operations(s.rpc)).toEqual(['ANSWER']); expect(flow.snapshot()).toMatchObject({ pending: true, blocked: true });
    const retained = JSON.parse([...rows.values()][0]!).pending.request;
    storage.setItemSync = originalWrite; s.rpc.mockImplementationOnce(async () => ok(s.get())); flow.retry(); await flow.waitForIdle();
    expect(s.rpc.mock.calls[1]?.[1].request).toEqual(retained); expect(flow.snapshot().pending).toBe(false);
  });
  it('requires deliberate reload after a conflict and never submits the old answer against a new revision', async () => {
    const s = server(); const { flow } = setup(s.rpc); flow.start(); await flow.waitForIdle(); s.rpc.mockClear();
    s.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'stale' } });
    flow.answerTraining({ kind: 'RATING', value: 5 }, id(100), 2); await flow.waitForIdle();
    flow.retry(); expect(flow.dismiss()).toBe(false); expect(operations(s.rpc)).toEqual(['ANSWER']);
    s.set(sequentialResponse('QUESTION', 4, 1)); flow.recoverConflict(); await flow.waitForIdle();
    expect(operations(s.rpc)).toEqual(['ANSWER', 'RESUME']); expect(flow.snapshot().sequential?.item?.id).toBe(id(101));
  });
  it('keeps a source-rejected answer unchanged until explicit reload, then permits Discovery without acknowledging a rating', async () => {
    const s = server(); const { flow, rows } = setup(s.rpc); flow.start(); await flow.waitForIdle(); s.rpc.mockClear();
    const evidenceBefore = getBootstrapEvidenceRevision();
    const originalQuestion = flow.snapshot().sequential;
    s.rpc.mockRejectedValueOnce(Error('ambiguous connection loss'));
    expect(flow.answerTraining({ kind: 'RATING', value: 5 }, id(100), 2)).toBe(true); await flow.waitForIdle();
    const retained = [...rows.values()][0];
    const originalCommand = s.rpc.mock.calls[0]?.[1].request;
    s.rpc.mockResolvedValueOnce({ data: null, error: { code: 'KJ002', message: 'SOURCE_WITHDRAWN' } });
    flow.retry(); await flow.waitForIdle();
    expect(s.rpc.mock.calls[1]?.[1].request).toEqual(originalCommand);
    expect([...rows.values()][0]).toBe(retained);
    expect(flow.snapshot()).toMatchObject({ pending: true, conflict: true, blocked: true, sequential: originalQuestion });
    expect(getBootstrapEvidenceRevision()).toBe(evidenceBefore);
    flow.retry(); expect(flow.dismiss()).toBe(false); expect(flow.remove(2)).toBe(false);
    expect(operations(s.rpc)).toEqual(['ANSWER', 'ANSWER']);

    s.set(sequentialResponse('STOPPED', 2, 0)); flow.recoverConflict(); await flow.waitForIdle();
    expect(operations(s.rpc)).toEqual(['ANSWER', 'ANSWER', 'RESUME']);
    expect(flow.snapshot()).toMatchObject({ pending: false, conflict: false, blocked: false,
      sequential: { status: 'STOPPED', revision: 2, item: null, answered: 0 } });
    expect(getBootstrapEvidenceRevision()).toBe(evidenceBefore);
    expect(flow.answerTraining({ kind: 'RATING', value: 5 }, id(100), 2)).toBe(false);
    expect(flow.dismiss()).toBe(true);
  });
  it('reloads a source-rejected Continue into a stopped session with removal reachable', async () => {
    const s = server(); s.set(sequentialResponse('PAUSED', 3)); const { flow } = setup(s.rpc);
    flow.start(); await flow.waitForIdle(); s.rpc.mockClear();
    s.rpc.mockResolvedValueOnce({ data: null, error: { code: 'KJ002', message: 'SOURCE_WITHDRAWN' } });
    expect(flow.begin()).toBe(true); await flow.waitForIdle();
    expect(flow.snapshot()).toMatchObject({ pending: true, conflict: true, blocked: true });
    s.set(sequentialResponse('STOPPED', 3)); flow.recoverConflict(); await flow.waitForIdle();
    s.rpc.mockResolvedValueOnce(ok({ version: 'personal-taste-session-v2', profileId, sessionId, status: 'REMOVED' }));
    expect(flow.remove(3)).toBe(true); await flow.waitForIdle();
    expect(operations(s.rpc)).toEqual(['CONTINUE', 'RESUME', 'REMOVE']);
    expect(flow.snapshot()).toMatchObject({ pending: false, blocked: false, sequential: { status: 'REMOVED' } });
  });
  it('permits Discovery after a cold RESUME returns the stopped stale-source session', async () => {
    const s = server(); const first = setup(s.rpc); first.flow.start(); await first.flow.waitForIdle(); first.flow.stop();
    s.rpc.mockClear(); s.set(sequentialResponse('STOPPED', 2));
    const resumed = setup(s.rpc, first.rows); resumed.flow.start(); await resumed.flow.waitForIdle();
    expect(operations(s.rpc)).toEqual(['RESUME']);
    expect(resumed.flow.snapshot()).toMatchObject({ pending: false, blocked: false, conflict: false,
      sequential: { status: 'STOPPED', item: null, revision: 2 } });
    expect(resumed.flow.dismiss()).toBe(true);
  });
  it('acknowledges PAUSE before Discovery, retains the Profile and dismissal through restart, and recovers a lost pause reply', async () => {
    const s = server(); const { flow, rows } = setup(s.rpc); flow.start(); await flow.waitForIdle(); s.rpc.mockClear();
    s.rpc.mockImplementationOnce(async () => { s.set(sequentialResponse('PAUSED', 3)); throw Error('pause response lost'); });
    expect(flow.dismiss()).toBe(false); await flow.waitForIdle(); expect(flow.snapshot().dismissed).toBe(false); flow.stop();
    s.rpc.mockImplementationOnce(async () => ok(s.get())); const resumed = setup(s.rpc, rows); resumed.flow.start(); await resumed.flow.waitForIdle();
    expect(resumed.flow.snapshot()).toMatchObject({ dismissed: true, pending: false });
    expect(s.rpc.mock.calls[1]?.[1].request).toEqual(s.rpc.mock.calls[0]?.[1].request);
    expect(s.rpc.mock.calls.every(c => c[1].request.profileId === profileId)).toBe(true);
    resumed.flow.stop(); s.rpc.mockClear(); const third = setup(s.rpc, rows); third.flow.start(); await third.flow.waitForIdle();
    expect(third.flow.snapshot().dismissed).toBe(true); expect(s.rpc).not.toHaveBeenCalled();
  });
  it('resumes a remotely paused session only after an explicit Continue', async () => {
    const s = server(); s.set(sequentialResponse('PAUSED', 3)); const { flow } = setup(s.rpc); flow.start(); await flow.waitForIdle();
    expect(operations(s.rpc)).toEqual(['START', 'RESUME']); expect(flow.snapshot().sequential?.status).toBe('PAUSED');
    expect(flow.begin()).toBe(true); await flow.waitForIdle();
    expect(operations(s.rpc)).toEqual(['START', 'RESUME', 'CONTINUE', 'RESUME']);
  });
  it('does not resurrect a withdrawn cached source or externally removed session', async () => {
    const s = server(); const { flow } = setup(s.rpc); flow.start(); await flow.waitForIdle(); s.rpc.mockClear();
    s.rpc.mockResolvedValueOnce(ok({ version: 'personal-taste-session-v2', profileId, sessionId, status: 'SOURCE_WITHDRAWN', reloadRequired: true }))
      .mockResolvedValueOnce(ok({ version: 'personal-taste-session-v2', profileId, sessionId, status: 'REMOVED' }));
    flow.answerTraining({ kind: 'RATING', value: 10 }, id(100), 2); await flow.waitForIdle();
    expect(operations(s.rpc)).toEqual(['ANSWER', 'RESUME']);
    expect(flow.snapshot()).toMatchObject({ pending: false, sequential: { status: 'REMOVED', item: null } });
    expect(flow.answerTraining({ kind: 'RATING', value: 10 }, id(100), 2)).toBe(false);
  });
  it('migrates an already pending v1 answer without changing its request or starting v2', async () => {
    const command = { functionName: 'taste_session_v1', request: { operation: 'ANSWER', profileId, sessionId,
      requestId: id(900), expectedRevision: 1, questionIndex: 0, answer: { kind: 'RATING', value: 5 } } };
    const rows = new Map([[`kajo:personal-taste:v1:${encodeURIComponent('https://test.invalid')}:${id(1)}:${profileId}`,
      JSON.stringify({ version: 1, sessionId, challengeId: null, dismissed: false, pending: command })]]);
    const rpc = vi.fn<TasteRpc>().mockResolvedValue(ok(sessionResponse([{ kind: 'RATING', value: 5 }])));
    const { flow } = setup(rpc, rows); flow.start(); await flow.waitForIdle();
    expect(rpc.mock.calls[0]?.[1].request).toEqual(command.request);
    expect(rpc.mock.calls.every(c => c[0] === 'taste_session_v1')).toBe(true);
    expect(flow.snapshot()).toMatchObject({ sequential: null, pending: false, session: { counts: { knownRatings: 1 } } });
    expect(JSON.parse([...rows.values()][0]!)).toMatchObject({ version: 2, protocol: 'v1', sessionId, pending: null });
  });
  it('uses v1 only for a confirmed first RPC absence or preserved legacy session, and never for a retained v2 outage', async () => {
    const rpc = vi.fn<TasteRpc>().mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' } })
      .mockResolvedValue(ok(sessionResponse()));
    const first = setup(rpc); first.flow.start(); await first.flow.waitForIdle();
    expect(rpc.mock.calls.map(c => c[0])).toEqual(['taste_session_v2', 'taste_session_v1', 'taste_session_v1']); first.flow.stop();
    rpc.mockClear().mockResolvedValueOnce(ok({ version: 'personal-taste-session-v2', profileId, status: 'LEGACY_V1_PRESERVED', legacySessionId: sessionId, canContinueDiscovery: true }));
    const second = setup(rpc); second.flow.start(); await second.flow.waitForIdle();
    expect(rpc.mock.calls.map(c => c[1].request.operation)).toEqual(['START', 'RESUME']); second.flow.stop();
    const s = server(); const third = setup(s.rpc); third.flow.start(); await third.flow.waitForIdle(); s.rpc.mockClear();
    s.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'later outage' } });
    third.flow.answerTraining({ kind: 'UNKNOWN' }, id(100), 2); await third.flow.waitForIdle();
    expect(third.flow.snapshot()).toMatchObject({ pending: true, legacy: false }); expect(s.rpc.mock.calls[0]?.[0]).toBe('taste_session_v2');
  });
  it('leaves a concurrent post-NEXT advance retryable without looping automatic commands', async () => {
    const s = server(); let advanced = false; const original = s.rpc.getMockImplementation()!;
    s.rpc.mockImplementation(async (name, args, signal) => {
      const result = await original(name, args, signal);
      if (args.request.operation === 'NEXT' && !advanced) { advanced = true; s.set(sequentialResponse('NEEDS_NEXT', 3, 1)); }
      return result;
    });
    const { flow } = setup(s.rpc); flow.start(); await flow.waitForIdle();
    expect(flow.snapshot()).toMatchObject({ pending: false, sequential: { status: 'NEEDS_NEXT', revision: 3 } });
    expect(operations(s.rpc).filter(o => o === 'NEXT')).toHaveLength(1);
    flow.retry(); await flow.waitForIdle(); expect(flow.snapshot().sequential?.status).toBe('QUESTION');
  });
  it('preserves completed setup without creating a replacement session or challenge', async () => {
    const rpc = vi.fn<TasteRpc>().mockResolvedValue(ok({ version: 'personal-taste-session-v2', profileId, status: 'EXISTING_COMPLETION', canContinueDiscovery: true }));
    const { flow } = setup(rpc); flow.start(); await flow.waitForIdle();
    expect(flow.snapshot()).toMatchObject({ dismissed: true, pending: false, sequential: null }); expect(rpc).toHaveBeenCalledOnce();
  });
  it('rejects malformed, cross-profile and misleading readiness replies without acknowledging a pending command', async () => {
    const s = server(); const { flow } = setup(s.rpc); flow.start(); await flow.waitForIdle();
    for (const data of [{ ...sequentialResponse(), profileId: id(999) }, { ...sequentialResponse(), questionId: null },
      { ...sequentialResponse(), readiness: { status: 'READY', uncertainty: 1 } }]) {
      s.rpc.mockResolvedValueOnce(ok(data));
      if (!flow.snapshot().pending) flow.answerTraining({ kind: 'RATING', value: 0 }, id(100), 2); else flow.retry();
      await flow.waitForIdle(); expect(flow.snapshot().pending).toBe(true);
    }
  });
  it('cannot send NEXT from a cancelled generation while a restarted current-state read is still pending', async () => {
    const s = server(); const original = s.rpc.getMockImplementation()!;
    const reads: ((v: Awaited<ReturnType<TasteRpc>>) => void)[] = [];
    s.rpc.mockImplementation(async (name, args, signal) => {
      if (args.request.operation === 'RESUME' && reads.length < 2)
        return new Promise(resolve => { reads.push(resolve); });
      return original(name, args, signal);
    });
    async function drain() { for (let n = 0; n < 30; n++) await Promise.resolve(); }
    const { flow } = setup(s.rpc); flow.start(); await drain(); expect(reads).toHaveLength(1);
    flow.stop(); flow.start(); await drain(); expect(reads).toHaveLength(2);
    reads[0]!(ok(s.get())); await drain(); expect(operations(s.rpc)).toEqual(['START', 'RESUME', 'RESUME']);
    reads[1]!(ok(s.get())); await flow.waitForIdle();
    expect(operations(s.rpc)).toEqual(['START', 'RESUME', 'RESUME', 'NEXT', 'RESUME']);
    expect(flow.snapshot().sequential?.status).toBe('QUESTION');
  });
  it('invalidates stale owners and keeps actor/Profile/backend persistence scopes distinct', async () => {
    const s = server(); const first = setup(s.rpc); first.flow.start(); await first.flow.waitForIdle();
    const replacement = setup(s.rpc, first.rows); replacement.flow.start(); await replacement.flow.waitForIdle();
    expect(first.flow.answerTraining({ kind: 'UNKNOWN' }, id(100), 2)).toBe(false);
    for (const extras of [{ actorUserId: id(2) }, { profileId: id(11) }, { namespace: 'https://other.invalid' }]) {
      const isolated = setup(s.rpc, first.rows, { ...extras, autoStart: false }); isolated.flow.start();
      expect(isolated.flow.snapshot()).toMatchObject({ sequential: null, needsStart: true });
    }
  });
});

describe('sequential request boundary', () => {
  it('accepts only question-bound integer ratings/recognition/interest and bounded mutation revisions', async () => {
    const command: TasteCommand = { functionName: 'taste_session_v2', request: { operation: 'ANSWER', profileId,
      sessionId, requestId: id(50), expectedRevision: 2, questionId: id(300), answer: { kind: 'RATING', value: 0 } } };
    expect(isTasteCommand(command, profileId)).toBe(true);
    for (const answer of [{ kind: 'RATING', value: 5 }, { kind: 'RATING', value: 10 }, { kind: 'UNKNOWN' }, { kind: 'NOT_INTERESTED' }])
      expect(isTasteCommand({ ...command, request: { ...command.request, answer } }, profileId)).toBe(true);
    for (const request of [{ ...command.request, answer: { kind: 'WITHDRAWN' } }, { ...command.request, questionId: undefined },
      { ...command.request, expectedRevision: 257 }, { ...command.request, answer: { kind: 'RATING', value: 0.5 } },
      { ...command.request, itemId: id(100) }, { ...command.request, operation: 'ACK_TRANSITION' }])
      expect(isTasteCommand({ ...command, request }, profileId)).toBe(false);
    const response = await sendTasteCommand(async () => ok(sequentialResponse()), command, new AbortController().signal);
    expect(response.status).toBe('success');
  });
});
