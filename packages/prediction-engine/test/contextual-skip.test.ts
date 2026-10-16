import { describe, expect, it } from 'vitest';
import { contextualSkipPolicy, decideContextualSkip, skipInstant } from '../src/contextual-skip.js';
import type { ContextualSkipInput, ContextualSkipRecord } from '../src/contextual-skip.js';

const receipt: ContextualSkipRecord = { id: 'taste-answer', subjectId: 'personal', objectId: 'book',
  acceptedAt: '1792152000000001', withdrawnAt: null };
const until = (BigInt(receipt.acceptedAt) + BigInt(contextualSkipPolicy.cooldownMicros)).toString();
const input = (extra: Partial<ContextualSkipInput> = {}): ContextualSkipInput => ({
  subjectId: 'personal', objectId: 'book', asOf: receipt.acceptedAt, otherwiseEligible: true, records: [receipt], ...extra,
});
describe('neutral contextual skip policy reference', () => {
  it('suppresses through the final microsecond and permits ranking at exactly 24 hours', () => {
    expect(decideContextualSkip(input())).toMatchObject({ eligible: false, reason: 'SKIP_COOLDOWN', reconsiderAt: until });
    expect(decideContextualSkip(input({ asOf: (BigInt(until) - 1n).toString() })).eligible).toBe(false);
    expect(decideContextualSkip(input({ asOf: until }))).toMatchObject({ eligible: true, reason: 'SKIP_COOLDOWN_ELAPSED' });
  });
  it('has no session/surface/mode/context-token shortcut; missing context uses the whole cooldown', () => {
    expect(contextualSkipPolicy.contextChangePolicy).toBe('NO_TRUSTED_CONTEXT_CHANGE_V1');
    for (const change of [{ sessionId: 'new' }, { surface: 'DISCOVERY' }, { scenarioId: 'different' }, { discoveryMode: 'RISK' }]) {
      expect(decideContextualSkip({ ...input(), ...change })).toEqual(decideContextualSkip(input()));
    }
  });
  it('respects other hard policies before and after cooldown, including saved/reminder eligibility', () => {
    for (const asOf of [receipt.acceptedAt, until]) expect(decideContextualSkip(input({ asOf, otherwiseEligible: false })))
      .toMatchObject({ eligible: false, reason: 'OTHER_POLICY_SUPPRESSED', sourceIds: [receipt.id] });
    expect(decideContextualSkip(input({ records: [], otherwiseEligible: false })).eligible).toBe(false);
  });
  it('isolates Personal/Shared and other Objects while remaining domain neutral', () => {
    for (const change of [{ subjectId: 'shared' }, { objectId: 'movie' }, { objectId: 'training-task' }]) {
      expect(decideContextualSkip(input(change))).toMatchObject({ eligible: true, reason: 'NO_ACTIVE_SKIP' });
    }
    expect(decideContextualSkip(input({ subjectId: 'team', objectId: 'exercise', records: [
      { ...receipt, subjectId: 'team', objectId: 'exercise' },
    ] })).eligible).toBe(false);
  });
  it('uses available source and withdrawal clocks without borrowing the future', () => {
    const withdrawal = (BigInt(receipt.acceptedAt) + 1n).toString();
    expect(decideContextualSkip(input({ asOf: (BigInt(receipt.acceptedAt) - 1n).toString() })).eligible).toBe(true);
    const records = [{ ...receipt, withdrawnAt: withdrawal }];
    expect(decideContextualSkip(input({ records })).eligible).toBe(false);
    expect(decideContextualSkip(input({ records, asOf: withdrawal })).reason).toBe('NO_ACTIVE_SKIP');
    expect(decideContextualSkip(input({ records: [] })).reason).toBe('NO_ACTIVE_SKIP');
  });
  it('uses the latest active receipt, preserves tied reasons, and withdrawal reveals an earlier active skip', () => {
    const second = { ...receipt, id: 'discovery-action', acceptedAt: (BigInt(receipt.acceptedAt) + 100n).toString() };
    const asOf = (BigInt(receipt.acceptedAt) + 200n).toString();
    expect(decideContextualSkip(input({ asOf, records: [receipt, second] })).sourceIds).toEqual([second.id]);
    expect(decideContextualSkip(input({ asOf, records: [second, { ...second, id: 'a' }] })).sourceIds).toEqual(['a', second.id]);
    expect(decideContextualSkip(input({ asOf, records: [receipt, { ...second, withdrawnAt: asOf }] })).sourceIds).toEqual([receipt.id]);
  });
  it('rejects malformed clocks, incomplete/duplicate prefixes and inverted withdrawals', () => {
    for (const clock of [null, '', '01', '-1', 'NaN', '1.1', '1e3', 123, '253402300800000000']) expect(() => skipInstant(clock)).toThrow();
    expect(skipInstant('0')).toBe(0n);
    expect(() => decideContextualSkip(input({ records: [receipt, receipt] }))).toThrow(/duplicate/);
    expect(() => decideContextualSkip(input({ records: Array.from({ length: 257 }, (_, n) => ({ ...receipt, id: String(n) })) }))).toThrow();
    expect(() => decideContextualSkip(input({ records: [{ ...receipt, withdrawnAt: '0' }] }))).toThrow(/precedes/);
  });
});
