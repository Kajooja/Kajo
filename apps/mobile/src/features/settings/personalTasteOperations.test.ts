import { describe, expect, it } from 'vitest';
import { sendTasteCommand, isTasteCommand, challengeResultCopy, type TasteCommand } from './personalTasteOperations';
import { id, profileId, sessionId, challengeId, sessionResponse, challengeResponse } from './personalTasteTestFixtures';

const start: TasteCommand = { functionName: 'taste_session_v1', request: { operation: 'START', profileId, requestId: id(1) } };
const challenge: TasteCommand = { functionName: 'taste_challenge_v1', request: { operation: 'START', profileId, sessionId, requestId: id(2) } };
const map = (data: unknown, command = start) => sendTasteCommand(async () => ({ data, error: null }), command, new AbortController().signal);
describe('owned mobile Taste protocol', () => {
  it('consumes actual zero, neutral and unknown semantics without substituting a client stop rule', async () => {
    const result = await map(sessionResponse([{ kind: 'RATING', value: 0 }, { kind: 'RATING', value: 5 }, { kind: 'UNKNOWN' }]));
    expect(result.status).toBe('success');
    if (result.status === 'success' && result.response.kind === 'session') {
      expect(result.response.value.status).toBe('ACTIVE');
      expect(result.response.value.counts).toMatchObject({ knownRatings: 2, unknown: 1 });
      expect(result.response.value.presentations[0]?.answer).toEqual({ kind: 'RATING', value: 0 });
    }
    expect((await map(sessionResponse(Array.from({ length: 6 }, () => ({ kind: 'RATING', value: 8 }))))).status).toBe('success');
  });
  it('rejects foreign identities, malformed counts, changed versions and an unexpected next Item', async () => {
    for (const bad of [
      { ...sessionResponse(), profileId: id(999) }, { ...sessionResponse(), sessionId: 'not-uuid' },
      { ...sessionResponse(), version: 'unreviewed-v2' },
      { ...sessionResponse(), currentItem: { id: id(999), itemType: 'MOVIE', title: 'Wrong Item' } },
      { ...sessionResponse(), selection: { ...sessionResponse().selection, counts: { ...sessionResponse().selection.counts, knownRatings: 3 } } },
    ]) expect((await map(bad)).status).toBe('error');
  });
  it('accepts minimal terminal/withdrawal replies only in the requested session/challenge scope', async () => {
    expect((await map({ version: 'personal-taste-session-v1', profileId, sessionId, status: 'REMOVED' })).status).toBe('success');
    expect((await map({ version: 'personal-taste-challenge-v1', sessionId, challengeId, status: 'REMOVED' }, challenge)).status).toBe('success');
    expect((await map({ version: 'personal-taste-challenge-v1', sessionId: id(999), challengeId, status: 'REMOVED' }, challenge)).status).toBe('error');
    expect((await map({ version: 'personal-taste-challenge-v1', sessionId, challengeId, status: 'CATALOG_UNAVAILABLE', revision: 0 }, challenge)).status).toBe('success');
  });
  it('refuses leaked forecasts and partial metrics until every immutable answer is locked', async () => {
    const active = challengeResponse();
    expect((await map(active, challenge)).status).toBe('success');
    expect((await map({ ...active, forecasts: [] }, challenge)).status).toBe('error');
    expect((await map({ ...active, metric: { knownRatings: 0 } }, challenge)).status).toBe('error');
    expect((await map({ ...active, items: active.items.map(item => ({ ...item, forecast: { score: 0.9 } })) }, challenge)).status).toBe('error');
  });
  it('renders ordinal sample/missing/tie copy without translating a score into a rating or percentage', async () => {
    const result = await map(challengeResponse([{ kind: 'RATING', value: 0 }, { kind: 'RATING', value: 5 }, { kind: 'UNKNOWN' }]), challenge);
    expect(result.status).toBe('success');
    if (result.status === 'success' && result.response.kind === 'challenge') {
      const copy = challengeResultCopy(result.response.value.metric!);
      expect(copy.join(' ')).toContain('Arvioit 2 teosta 3 teoksesta');
      expect(copy.join(' ')).toContain('1 parissa');
      expect(copy.join(' ')).toContain('Puuttuva ennuste');
      expect(copy.join(' ')).not.toMatch(/\d\s*%|ennusti arvosan/);
    }
    const bad = challengeResponse([{ kind: 'RATING', value: 0 }, { kind: 'RATING', value: 5 }, { kind: 'UNKNOWN' }]);
    expect((await map({ ...bad, metric: { ...bad.metric, accuracyPercent: 90 } }, challenge)).status).toBe('error');
  });
  it('bounds persisted commands and preserves the distinction between missing and a zero rating', () => {
    const command: TasteCommand = { functionName: 'taste_session_v1', request: { operation: 'ANSWER', profileId,
      sessionId, requestId: id(5), expectedRevision: 1, questionIndex: 0, answer: { kind: 'RATING', value: 0 } } };
    expect(isTasteCommand(command, profileId)).toBe(true);
    expect(isTasteCommand({ ...command, request: { ...command.request, answer: { kind: 'RATING' } } }, profileId)).toBe(false);
    expect(isTasteCommand({ ...command, request: { ...command.request, extra: true } }, profileId)).toBe(false);
    expect(isTasteCommand(command, id(999))).toBe(false);
  });
  it('distinguishes missing RPC, confirmed revision conflict and ambiguous network failure', async () => {
    for (const [code, kind] of [['PGRST202', 'unavailable'], ['40001', 'conflict'], ['42501', 'invalid'], ['', 'retry']]) {
      expect(await sendTasteCommand(async () => ({ data: null, error: { code: code!, message: 'not user copy' } }), start, new AbortController().signal))
        .toMatchObject({ status: 'error', kind });
    }
    expect(await sendTasteCommand(async () => { throw Error('private transport details'); }, start, new AbortController().signal))
      .toMatchObject({ status: 'error', kind: 'retry' });
  });
});
