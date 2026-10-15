import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPersonalTasteFlow, type PersonalTasteFlow } from './personalTasteFlow';
import type { TasteCommand, TasteRpc } from './personalTasteOperations';
import { id, profileId, sessionId, challengeId, sessionResponse, challengeResponse } from './personalTasteTestFixtures';

const flows: PersonalTasteFlow[] = [];
afterEach(() => { flows.forEach(f => f.stop()); flows.length = 0; });
function setup(rpc: TasteRpc, rows = new Map<string, string>(), extras: Partial<Parameters<typeof createPersonalTasteFlow>[0]> = {}) {
  // Retained v1 installation: migration must preserve the original writer/queue.
  if (rows.size === 0) rows.set(`kajo:personal-taste:v1:${encodeURIComponent('https://test.invalid')}:${id(1)}:${profileId}`,
    JSON.stringify({ version: 1, sessionId: null, challengeId: null, pending: null, dismissed: false }));
  let sequence = 1000;
  const storage = { getItemSync: (key: string) => rows.get(key) ?? null,
    setItemSync: (key: string, value: string) => { rows.set(key, value); } };
  const flow = createPersonalTasteFlow({ namespace: 'https://test.invalid', actorUserId: id(1), profileId, storage,
    rpc, onChange: vi.fn(), createId: () => id(sequence++), ...extras });
  flows.push(flow); return { flow, rows, storage };
}
const ok = (data: unknown) => ({ data, error: null });
const deferred = () => {
  let resolve!: (value: Awaited<ReturnType<TasteRpc>>) => void;
  return { promise: new Promise<Awaited<ReturnType<TasteRpc>>>(done => { resolve = done; }), resolve: (v: Awaited<ReturnType<TasteRpc>>) => resolve(v) };
};

describe('durable owned mobile Taste flow', () => {
  it('creates no session before explicit start when offering a new cold-start test', async () => {
    const rpc = vi.fn<TasteRpc>().mockResolvedValue(ok(sessionResponse()));
    const { flow } = setup(rpc, undefined, { autoStart: false }); flow.start();
    expect(flow.snapshot().needsStart).toBe(true); expect(rpc).not.toHaveBeenCalled();
    expect(flow.begin()).toBe(true); await flow.waitForIdle();
    expect(rpc.mock.calls[0]?.[1].request.operation).toBe('START');
    expect(flow.snapshot().session?.item?.id).toBe(id(100));
  });
  it('persists an immutable answer before dispatch and retries the same ID after a lost acknowledgement/restart', async () => {
    let accepted = false; const commands: TasteCommand['request'][] = [];
    const rpc = vi.fn<TasteRpc>(async (_name, { request }) => {
      commands.push(structuredClone(request));
      if (request.operation === 'ANSWER') {
        if (!accepted) { accepted = true; throw Error('ack lost after server commit'); }
        return ok(sessionResponse([{ kind: 'RATING', value: 0 }]));
      }
      return ok(accepted ? sessionResponse([{ kind: 'RATING', value: 0 }]) : sessionResponse());
    });
    const first = setup(rpc); first.flow.start(); await first.flow.waitForIdle();
    expect(first.flow.answerTraining({ kind: 'RATING', value: 0 }, id(100), 1)).toBe(true);
    const persisted = JSON.parse([...first.rows.values()][0]!);
    expect(persisted.pending.request.answer).toEqual({ kind: 'RATING', value: 0 });
    await first.flow.waitForIdle(); expect(first.flow.snapshot().pending).toBe(true); first.flow.stop();
    const second = setup(rpc, first.rows); second.flow.start(); await second.flow.waitForIdle();
    const answers = commands.filter(c => c.operation === 'ANSWER'); expect(answers).toHaveLength(2); expect(answers[1]).toEqual(answers[0]);
    expect(second.flow.snapshot()).toMatchObject({ pending: false, session: { counts: { knownRatings: 1 }, revision: 2 } });
    expect(JSON.parse([...second.rows.values()][0]!).pending).toBeNull();
  });
  it('does not send an answer when persistence fails and retains the original ID when acknowledgement persistence fails', async () => {
    const rpc = vi.fn<TasteRpc>().mockResolvedValue(ok(sessionResponse()));
    const first = setup(rpc); first.flow.start(); await first.flow.waitForIdle();
    first.storage.setItemSync = () => { throw Error('disk unavailable'); };
    expect(first.flow.answerTraining({ kind: 'UNKNOWN' }, id(100), 1)).toBe(false);
    expect(rpc.mock.calls.filter(c => c[1].request.operation === 'ANSWER')).toHaveLength(0);
    first.flow.stop();
    let writes = 0; let answerId = '';
    const secondRpc = vi.fn<TasteRpc>(async (_name, { request }) => {
      if (request.operation === 'ANSWER') { answerId = request.requestId!; writes = 1; }
      return ok(writes ? sessionResponse([{ kind: 'UNKNOWN' }]) : sessionResponse());
    });
    const rows = new Map<string, string>();
    const storage = { getItemSync: (key: string) => rows.get(key) ?? null,
      setItemSync: (key: string, value: string) => { if (writes) throw Error('ack cannot persist'); rows.set(key, value); } };
    const second = setup(secondRpc, rows, { storage }); second.flow.start(); await second.flow.waitForIdle();
    second.flow.answerTraining({ kind: 'UNKNOWN' }, id(100), 1); await second.flow.waitForIdle();
    expect(JSON.parse([...rows.values()][0]!).pending.request.requestId).toBe(answerId);
  });
  it('requires explicit current-state reload after conflict and never rebases the old answer automatically', async () => {
    const rpc = vi.fn<TasteRpc>(async (_name, { request }) => request.operation === 'ANSWER'
      ? { data: null, error: { code: '40001', message: 'conflict' } } : ok(sessionResponse()));
    const { flow } = setup(rpc); flow.start(); await flow.waitForIdle();
    flow.answerTraining({ kind: 'RATING', value: 5 }, id(100), 1); await flow.waitForIdle();
    expect(flow.snapshot().conflict).toBe(true); flow.retry(); await flow.waitForIdle();
    expect(rpc.mock.calls.filter(c => c[1].request.operation === 'ANSWER')).toHaveLength(1);
    flow.recoverConflict(); await flow.waitForIdle();
    expect(flow.snapshot()).toMatchObject({ conflict: false, pending: false });
    expect(rpc.mock.calls.at(-1)?.[1].request.operation).toBe('RESUME');
  });
  it('keeps the longer server session active after six known responses and rejects old card callbacks', async () => {
    const data = sessionResponse(Array.from({ length: 6 }, () => ({ kind: 'RATING', value: 8 })));
    const rpc = vi.fn<TasteRpc>().mockResolvedValue(ok(data)); const { flow } = setup(rpc);
    flow.start(); await flow.waitForIdle(); expect(flow.snapshot().session?.status).toBe('ACTIVE');
    expect(flow.answerTraining({ kind: 'UNKNOWN' }, id(100), 1)).toBe(false);
    expect(flow.answerTraining({ kind: 'RATING', value: 0 }, id(106), 7)).toBe(true); await flow.waitForIdle();
    expect(rpc.mock.calls.filter(c => c[1].request.operation === 'ANSWER')).toHaveLength(1);
  });
  it('recovers a confirmed first START rejection without requiring a nonexistent session ID', async () => {
    const rpc = vi.fn<TasteRpc>().mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'creation rolled back' } })
      .mockResolvedValue(ok(sessionResponse()));
    const { flow } = setup(rpc); flow.start(); await flow.waitForIdle();
    expect(flow.snapshot()).toMatchObject({ conflict: true, session: null, pending: true });
    flow.recoverConflict(); await flow.waitForIdle();
    expect(flow.snapshot()).toMatchObject({ conflict: false, pending: false, session: { sessionId } });
    const starts = rpc.mock.calls.filter(c => c[1].request.operation === 'START');
    expect(starts).toHaveLength(2); expect(starts[1]?.[1].request.requestId).not.toBe(starts[0]?.[1].request.requestId);
    expect(rpc.mock.calls.every(c => c[1].request.operation !== 'ANSWER')).toBe(true);
  });
  it('preserves completed setup without starting a challenge or old static calibration', async () => {
    const rpc = vi.fn<TasteRpc>().mockResolvedValue(ok(sessionResponse([], 'STOP', 'EXISTING_COMPLETION')));
    const { flow } = setup(rpc); flow.start(); await flow.waitForIdle();
    expect(flow.snapshot().dismissed).toBe(true); expect(flow.startChallenge()).toBe(false);
    expect(rpc.mock.calls.every(c => c[0] === 'taste_session_v1')).toBe(true);
  });
  it('falls back only for a confirmed missing first RPC, never for a later outage', async () => {
    const missing = vi.fn<TasteRpc>().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } });
    const first = setup(missing); first.flow.start(); await first.flow.waitForIdle();
    expect(first.flow.snapshot()).toMatchObject({ legacy: true, pending: false }); first.flow.stop();
    const rpc = vi.fn<TasteRpc>().mockResolvedValue(ok(sessionResponse())); const second = setup(rpc);
    second.flow.start(); await second.flow.waitForIdle(); rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'later outage' } });
    second.flow.answerTraining({ kind: 'UNKNOWN' }, id(100), 1); await second.flow.waitForIdle();
    expect(second.flow.snapshot()).toMatchObject({ legacy: false, pending: true });
  });
  it('cancels stale completions across stop/restart and still recovers the same pending command', async () => {
    const delayed = deferred(); const rpc = vi.fn<TasteRpc>().mockReturnValueOnce(delayed.promise).mockResolvedValue(ok(sessionResponse()));
    const { flow, rows } = setup(rpc); flow.start(); await Promise.resolve();
    const original = JSON.parse([...rows.values()][0]!).pending.request;
    flow.stop(); flow.start(); await flow.waitForIdle();
    const accepted = [...rows.values()][0]; delayed.resolve(ok({ ...sessionResponse(), profileId: id(999) })); await Promise.resolve(); await Promise.resolve();
    expect([...rows.values()][0]).toBe(accepted); expect(rpc.mock.calls[1]?.[1].request).toEqual(original);
    expect(flow.snapshot().session?.sessionId).toBe(sessionId);
  });
  it('isolates actor, Profile and backend ledgers and rejects corrupt persisted commands before network dispatch', async () => {
    const rows = new Map<string, string>(); const rpc = vi.fn<TasteRpc>().mockResolvedValue(ok(sessionResponse()));
    const a = setup(rpc, rows); a.flow.start(); await a.flow.waitForIdle(); a.flow.stop();
    const b = setup(rpc, rows, { actorUserId: id(2), autoStart: false }); b.flow.start();
    expect(b.flow.snapshot().session).toBeNull(); b.flow.stop();
    const key = [...rows.keys()][0]!; rows.set(key, JSON.stringify({ version: 1, sessionId, challengeId: null, dismissed: false,
      pending: { functionName: 'taste_session_v1', request: { operation: 'START', profileId: id(999), requestId: id(1) } } }));
    rpc.mockClear(); const c = setup(rpc, rows); c.flow.start();
    expect(c.flow.snapshot().blocked).toBe(true); expect(c.flow.dismiss()).toBe(false); expect(rpc).not.toHaveBeenCalled();
    expect(JSON.parse(rows.get(key)!).pending.request.profileId).toBe(id(999));
  });
  it('acknowledges book transition explicitly and resumes an existing frozen challenge after restart', async () => {
    let books = false;
    const rpc = vi.fn<TasteRpc>(async (name, { request }) => {
      if (name === 'taste_challenge_v1') return ok(challengeResponse());
      if (request.operation === 'ACK_TRANSITION') books = true;
      return ok(sessionResponse([], books ? 'STOP' : 'TRANSITION'));
    });
    const { flow, rows } = setup(rpc); flow.start(); await flow.waitForIdle();
    expect(flow.acknowledgeBooks(1)).toBe(true); await flow.waitForIdle();
    expect(flow.startChallenge()).toBe(true); await flow.waitForIdle(); expect(flow.snapshot().challenge?.metric).toBeNull();
    flow.stop(); const next = setup(rpc, rows); next.flow.start(); await next.flow.waitForIdle();
    expect(rpc.mock.calls.at(-1)?.[1].request).toEqual({ operation: 'RESUME', profileId, sessionId, challengeId });
  });
  it('retains a removed v1 challenge across repeated restarts instead of reopening its training session', async () => {
    let removed = false;
    const rpc = vi.fn<TasteRpc>(async (name, { request }) => {
      if (name !== 'taste_challenge_v1') return ok(sessionResponse([], 'STOP'));
      if (request.operation === 'REMOVE') removed = true;
      return ok(removed ? { version: 'personal-taste-challenge-v1', profileId, sessionId, challengeId, status: 'REMOVED' }
        : challengeResponse());
    });
    const first = setup(rpc); first.flow.start(); await first.flow.waitForIdle();
    first.flow.startChallenge(); await first.flow.waitForIdle(); first.flow.remove(0); await first.flow.waitForIdle(); first.flow.stop();
    for (let n = 0; n < 2; n++) {
      const resumed = setup(rpc, first.rows); resumed.flow.start(); await resumed.flow.waitForIdle();
      expect(resumed.flow.snapshot().challenge?.status).toBe('REMOVED');
      expect(JSON.parse([...first.rows.values()][0]!).challengeId).toBe(challengeId);
      expect(rpc.mock.calls.at(-1)?.[1].request).toEqual({ operation: 'RESUME', profileId, sessionId, challengeId });
      resumed.flow.stop();
    }
  });
  it('removes the current source, clears retained local commands and never resurrects it', async () => {
    const rpc = vi.fn<TasteRpc>(async (_name, { request }) => request.operation === 'REMOVE'
      ? ok({ version: 'personal-taste-session-v1', profileId, sessionId, status: 'REMOVED' }) : ok(sessionResponse()));
    const { flow, rows } = setup(rpc); flow.start(); await flow.waitForIdle(); expect(flow.remove(1)).toBe(true); await flow.waitForIdle();
    expect(flow.snapshot().session?.status).toBe('REMOVED'); expect(flow.answerTraining({ kind: 'RATING', value: 0 }, id(100), 1)).toBe(false);
    expect(JSON.parse([...rows.values()][0]!).pending).toBeNull();
  });
});
