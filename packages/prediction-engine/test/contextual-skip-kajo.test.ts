import { describe, expect, it } from 'vitest';
import { applyKajoContextualSkip, ContextualSkipError, isKajoSkipCommand, kajoContextualSkipRecords } from '../src/adapters/kajo-contextual-skip.js';
import type { KajoSkipAuthority, KajoSkipCommand, KajoSkipEntry, KajoSkipOrigin } from '../src/adapters/kajo-contextual-skip.js';
import { decideContextualSkip } from '../src/contextual-skip.js';

const id = (n: number) => `ab157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const taste: KajoSkipOrigin = { surface: 'TASTE', sessionId: id(4), questionId: id(5), panelId: id(6), prefixRevision: 1 };
const discovery: KajoSkipOrigin = { surface: 'DISCOVERY', sessionId: id(7), predictionId: id(8), deliveryRequestId: id(9), impressionEventId: id(10) };
const command = (origin: KajoSkipOrigin = taste): KajoSkipCommand => ({ version: 'kajo-contextual-skip-v1', kind: 'CONTEXTUAL_SKIP',
  actionId: id(20), actorUserId: id(1), profileId: id(2), itemId: id(3), occurredAt: '101', origin, contextRef: null, reversesActionId: null });
const authority = (c = command()): KajoSkipAuthority => ({ role: 'authenticated', isAnonymous: false, actorUserId: c.actorUserId,
  profile: { id: c.profileId, type: 'PERSONAL', ownerUserId: c.actorUserId, acceptedMemberIds: [c.actorUserId] },
  source: { actorUserId: c.actorUserId, profileId: c.profileId, itemId: c.itemId, origin: c.origin, contextRef: c.contextRef,
    committedAt: '100', available: true, acceptsNewSkip: true }, acceptedAt: '102' });
const rejects = (fn: () => unknown, code: ContextualSkipError['code']) => {
  try { fn(); throw new Error('Unexpected acceptance'); } catch (error) {
    expect(error).toBeInstanceOf(ContextualSkipError); expect((error as ContextualSkipError).code).toBe(code);
  }
};
describe('Kajo neutral skip command conformance reference', () => {
  it.each([taste, discovery])('retains exact source/retry semantics for $surface', origin => {
    const c = command(origin), a = authority(c), first = applyKajoContextualSkip([], c, a);
    const restored = JSON.parse(JSON.stringify(first.entries)) as KajoSkipEntry[];
    const retry = applyKajoContextualSkip(restored, { ...c, origin: { ...c.origin } }, { ...a, acceptedAt: '900000' });
    expect(retry).toEqual(first); expect(retry.entries).toHaveLength(1);
    expect(first.receipt.evidence).toBe(origin.surface === 'TASTE' ? 'PRIVATE_TASTE_RESPONSE' : 'CANONICAL_DISCOVERY_EVENT');
    expect(first.receipt).not.toHaveProperty('rating'); expect(first.receipt).not.toHaveProperty('recognized');
    expect(first.receipt).not.toHaveProperty('reward'); expect(first.receipt).not.toHaveProperty('selectedForDelivery');
    expect(Object.isFrozen(first.entries[0]?.command.origin)).toBe(true);
  });
  it('compares semantic JSON exactly, including origin, body, scope, occurrence and missing context', () => {
    const c = command(), a = authority(), { entries } = applyKajoContextualSkip([], c, a);
    const reordered = JSON.parse('{"prefixRevision":1,"panelId":"'+id(6)+'","questionId":"'+id(5)+'","sessionId":"'+id(4)+'","surface":"TASTE"}') as KajoSkipOrigin;
    expect(applyKajoContextualSkip(entries, { ...c, origin: reordered }, a).entries).toEqual(entries);
    for (const changed of [{ itemId: id(99) }, { occurredAt: '100' }, { contextRef: id(98) }, { origin: { ...taste, prefixRevision: 2 } }]) {
      rejects(() => applyKajoContextualSkip(entries, { ...c, ...changed } as KajoSkipCommand, a), 'IDENTITY_CONFLICT');
    }
    for (const kind of ['RATING', 'UNKNOWN', 'NOT_INTERESTED']) expect(isKajoSkipCommand({ ...c, kind })).toBe(false);
    for (const rating of [0, 5, 10]) expect(isKajoSkipCommand({ ...c, rating })).toBe(false);
    expect(isKajoSkipCommand({ ...c, origin: { ...taste, predictionId: id(8) } })).toBe(false);
  });
  it('authorizes again on retry, denies anonymous/service/foreign owners and Shared Taste', () => {
    const c = command(), a = authority(), { entries } = applyKajoContextualSkip([], c, a);
    for (const denied of [{ ...a, role: 'anon' }, { ...a, role: 'service_role' }, { ...a, isAnonymous: true }, { ...a, actorUserId: id(99) },
      { ...a, profile: { ...a.profile, ownerUserId: id(99) } }, { ...a, profile: { ...a.profile, acceptedMemberIds: [] } },
      { ...a, profile: { ...a.profile, type: 'SHARED' } }]) {
      for (const prefix of [[], entries]) rejects(() => applyKajoContextualSkip(prefix, c, denied as KajoSkipAuthority), 'ACCESS_DENIED');
    }
  });
  it('binds Discovery to the shown actor/Profile/Item/delivery and allows accepted Shared membership', () => {
    const c = command(discovery), a = authority(c);
    for (const changed of [{ itemId: id(99) }, { actorUserId: id(99) }, { profileId: id(99) }, { origin: taste }, { contextRef: id(99) }]) {
      rejects(() => applyKajoContextualSkip([], c, { ...a, source: { ...a.source, ...changed } }), 'ORIGIN_CONFLICT');
    }
    const shared = { ...a, profile: { ...a.profile, type: 'SHARED' as const, ownerUserId: id(99) } };
    expect(applyKajoContextualSkip([], c, shared).entries).toHaveLength(1);
  });
  it('source withdrawal prevents cached replay and another request ID cannot duplicate the shown opportunity', () => {
    const c = command(), a = authority(), { entries } = applyKajoContextualSkip([], c, a);
    rejects(() => applyKajoContextualSkip(entries, c, { ...a, source: { ...a.source, available: false } }), 'SOURCE_WITHDRAWN');
    rejects(() => applyKajoContextualSkip(entries, { ...c, actionId: id(99) }, a), 'ORIGIN_CONFLICT');
    rejects(() => applyKajoContextualSkip(entries, { ...c, actionId: id(99), contextRef: id(98) },
      { ...a, source: { ...a.source, contextRef: id(98) } }), 'ORIGIN_CONFLICT');
    rejects(() => applyKajoContextualSkip([], c, { ...a, source: { ...a.source, committedAt: a.acceptedAt } }), 'INVALID_COMMAND');
    rejects(() => applyKajoContextualSkip([], c, { ...a, acceptedAt: '100' }), 'INVALID_COMMAND');
  });
  it('preserves reported occurrence but orders only trusted receipts despite client clock skew', () => {
    const c = command(), a = authority();
    for (const occurredAt of ['0', '300000102']) {
      const result = applyKajoContextualSkip([], { ...c, occurredAt }, a);
      expect(kajoContextualSkipRecords(result.entries)[0]?.acceptedAt).toBe('102');
      expect(result.entries[0]?.command.occurredAt).toBe(occurredAt);
    }
    rejects(() => applyKajoContextualSkip([], { ...c, occurredAt: '300000103' }, a), 'INVALID_COMMAND');
  });
  it('cannot turn acknowledged positive-action advance into a fresh skip, while exact retries and withdrawal survive', () => {
    const c = command(), a = authority(), first = applyKajoContextualSkip([], c, a);
    const closed = { ...a, source: { ...a.source, acceptsNewSkip: false } };
    rejects(() => applyKajoContextualSkip([], c, closed), 'ORIGIN_CONFLICT');
    expect(applyKajoContextualSkip(first.entries, c, closed)).toEqual(first);
    const withdraw: KajoSkipCommand = { ...c, kind: 'WITHDRAW_CONTEXTUAL_SKIP', actionId: id(21),
      reversesActionId: c.actionId, occurredAt: '103' };
    expect(applyKajoContextualSkip(first.entries, withdraw, { ...closed, acceptedAt: '104' }).receipt.semantic)
      .toBe('WITHDRAW_CONTEXTUAL_SKIP');
  });
  it('withdraws only the exact actor-owned skip and never changes a rating or another skip', () => {
    const c = command(), a = authority(), first = applyKajoContextualSkip([], c, a);
    const withdraw: KajoSkipCommand = { ...c, kind: 'WITHDRAW_CONTEXTUAL_SKIP', actionId: id(21), reversesActionId: c.actionId, occurredAt: '103' };
    const second = applyKajoContextualSkip(first.entries, withdraw, { ...a, acceptedAt: '104' });
    expect(kajoContextualSkipRecords(second.entries)).toEqual([{ id: c.actionId, subjectId: c.profileId, objectId: c.itemId,
      acceptedAt: '102', withdrawnAt: '104' }]);
    expect(applyKajoContextualSkip(second.entries, withdraw, { ...a, acceptedAt: '105' })).toEqual(second);
    rejects(() => applyKajoContextualSkip(second.entries, { ...withdraw, actionId: id(22) }, { ...a, acceptedAt: '105' }), 'WITHDRAWAL_CONFLICT');
    rejects(() => applyKajoContextualSkip(first.entries, { ...withdraw, reversesActionId: id(99) }, { ...a, acceptedAt: '104' }), 'WITHDRAWAL_CONFLICT');
  });
  it('retains Taste suppression across PAUSE → Discovery, restart and a different Event session', () => {
    const c = command(), result = applyKajoContextualSkip([], c, authority());
    const records = kajoContextualSkipRecords(JSON.parse(JSON.stringify(result.entries)) as KajoSkipEntry[]);
    expect(decideContextualSkip({ subjectId: c.profileId, objectId: c.itemId, asOf: '1000', records, otherwiseEligible: true }).eligible).toBe(false);
    expect(decideContextualSkip({ subjectId: id(99), objectId: c.itemId, asOf: '1000', records, otherwiseEligible: true }).eligible).toBe(true);
  });
  it('rejects corrupt receipt bindings and duplicate source history instead of fabricating learning', () => {
    const c = command(), first = applyKajoContextualSkip([], c, authority());
    rejects(() => kajoContextualSkipRecords([{ command: c, receipt: { ...first.receipt, itemId: id(99) } }]), 'INCOMPLETE_PREFIX');
    rejects(() => kajoContextualSkipRecords([...first.entries, ...first.entries]), 'INCOMPLETE_PREFIX');
    rejects(() => kajoContextualSkipRecords([...first.entries,
      { command: { ...c, actionId: id(98) }, receipt: { ...first.receipt, actionId: id(98) } }]), 'INCOMPLETE_PREFIX');
    const foreign = { ...c, profileId: id(99), actionId: id(98) };
    rejects(() => applyKajoContextualSkip(first.entries, foreign, authority(foreign)), 'ACCESS_DENIED');
    expect(kajoContextualSkipRecords([])).toEqual([]);
  });
});
