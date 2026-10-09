import { describe, expect, it } from 'vitest';
import type { ArtifactVersion, PredictionObject } from '../src/contracts.js';
import { normalizeKajoWorkingSession } from '../src/adapters/kajo-working-state.js';
import type { KajoWorkingSessionInput } from '../src/adapters/kajo-working-state.js';
import { deriveWorkingState, scoreWorkingAdjustment } from '../src/working-state.js';

// Generated canonical row shapes establish mapper behavior, not device evidence.
const id = (n: number) => `a9140000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1); const profile = id(2); const session = id(3);
const sourceId = 'kajo-canonical-events-v1';
const artifact: ArtifactVersion = { id: 'declared-kajo-features', version: '1', representationVersion: 'normalized-v1',
  availableAt: 0, trainedThrough: null, sourceRefs: [sourceId], use: 'fixture-only' };
const item = (n: number, features: Record<string, number | null> = { warm: 1 }): PredictionObject =>
  ({ id: id(n), features, availableAt: 0, artifact });
type RawEvent = KajoWorkingSessionInput['events'][number];
function event(n: number, itemNumber: number, rating: unknown, occurredAt: number, changes: Partial<RawEvent> = {}): RawEvent {
  return { id: id(n), actor_user_id: actor, profile_id: profile, session_id: session, item_id: id(itemNumber),
    item_type: 'BOOK', event_type: 'ITEM_RATED', occurred_at: occurredAt, created_at: occurredAt,
    properties: { rating }, ...changes };
}
function fixture(events: readonly RawEvent[] = [event(11, 21, 0, 10), event(12, 22, 10, 20)],
  changes: Partial<KajoWorkingSessionInput> = {}): KajoWorkingSessionInput {
  return { profile: { id: profile, type: 'PERSONAL', ownerUserId: actor }, actorUserId: actor,
    session: { id: session, actor_user_id: actor, profile_id: profile, started_at: 0, created_at: 0 },
    events, objects: [item(21), item(22)], featureSchema: { id: artifact.id, version: '1', dimensions: ['warm', 'dark'], artifact },
    asOf: 100, prefixComplete: true,
    refs: { scopeId: 'test', subjectRef: 'test:subject', actorRef: 'test:actor', sessionRef: 'test:session' }, ...changes };
}
const state = (input: KajoWorkingSessionInput) => deriveWorkingState(normalizeKajoWorkingSession(input));

describe('strict Personal canonical-session working-state mapper', () => {
  it('maps real row identities into explicit scoped handles and retains rating zero and immutable Event IDs', () => {
    const raw = fixture(); const before = structuredClone(raw); const normalized = normalizeKajoWorkingSession(raw);
    expect(normalized.scope.subject).toEqual({ id: 'test:subject', kind: 'individual' });
    expect(normalized.scope.actingIdentityRef).toBe('test:actor'); expect(normalized.scope.sessionRef).toBe('test:session');
    expect(normalized.records[0]?.observation.raw.value).toBe(0);
    expect(normalized.records[0]?.observation.provenance).toEqual({ origin: 'observed',
      source: { kind: 'native', id: sourceId }, recordId: id(11), revision: 1 });
    expect(normalized.records[0]?.observation.exposure).toBe('unknown');
    expect(normalized.availabilityBasis).toBe('STORED_CREATED_TIME');
    const serialized = JSON.stringify(normalized);
    for (const rawIdentity of [actor, profile, session]) expect(serialized).not.toContain(rawIdentity);
    expect(raw).toEqual(before);
  });

  it('uses the declared numeric oracle and keeps the default control exactly off', () => {
    const working = state(fixture()); const candidate = item(30);
    const oracle = 0.25 * (1 - Math.SQRT1_2) / (1 + Math.SQRT1_2);
    expect(scoreWorkingAdjustment({ state: working, object: candidate }).value).toBe(0);
    expect(scoreWorkingAdjustment({ state: working, object: candidate, control: 'ORDERED' }).value).toBeCloseTo(oracle, 12);
    expect(working.support.distinctItems).toBe(2); expect(working.support.observedRatings).toBe(2);
  });

  it('keeps occurrence and stored creation time separate, including representable submillisecond prefixes', () => {
    const events = [event(11, 21, 0, 10, { occurred_at: '2024-01-01T00:00:00.000001+00:00',
      created_at: '2024-01-01T00:00:00.000000+00:00' }),
    event(12, 22, 10, 20, { occurred_at: '2024-01-01T00:00:00.000002+00:00',
      created_at: '2024-01-01T00:00:00.000000+00:00' })];
    const start = Date.UTC(2024, 0, 1);
    const raw = fixture(events, { asOf: start + 10, session: { id: session, actor_user_id: actor, profile_id: profile,
      started_at: '2024-01-01T00:00:00.000000+00:00', created_at: '2024-01-01T00:00:00.000000+00:00' } });
    const normalized = normalizeKajoWorkingSession(raw);
    expect(normalized.records[0]!.observation.occurredAt).toBeGreaterThan(normalized.records[0]!.observation.availableAt);
    expect(normalized.records[1]!.observation.occurredAt).toBeGreaterThan(normalized.records[0]!.observation.occurredAt);
    expect(deriveWorkingState(normalized).groups).toHaveLength(2);
  });

  it('does not let an available-at-future correction hide the known original zero rating', () => {
    const raw = fixture([event(11, 21, 0, 10), event(12, 22, 10, 20), event(13, 21, 10, 30, { created_at: 200 })]);
    expect(state(raw).vectors).toEqual(state(fixture()).vectors);
    expect(state(raw).items.find(i => i.objectId === id(21))?.direction).toBe(-1);
    const later = state({ ...raw, asOf: 200 });
    expect(later.items.find(i => i.objectId === id(21))?.direction).toBe(1);
    expect(later.support.distinctItems).toBe(2);
  });

  it('reconciles actual new Event IDs as Item corrections rather than independent repeated ratings', () => {
    const raw = fixture([event(11, 21, 0, 10), event(12, 22, 10, 20), event(13, 21, 10, 30)]);
    const working = state(raw);
    expect(working.support.distinctItems).toBe(2);
    expect(working.support.observedRatings).toBe(2);
    expect(working.items.find(i => i.objectId === id(21))?.direction).toBe(1);
    expect(scoreWorkingAdjustment({ state: working, object: item(30), control: 'ORDERED' }).value).toBe(0.25);
  });

  it('neutralizes a latest unknown or malformed rating instead of retaining stale preference or inventing a negative', () => {
    for (const rating of [null, 'unknown', undefined, 11, 1.5]) {
      const working = state(fixture([event(11, 21, 10, 10), event(12, 22, 10, 20), event(13, 21, rating, 30)]));
      expect(working.support.distinctItems).toBe(1);
      expect(working.items.some(i => i.objectId === id(21))).toBe(false);
      expect(scoreWorkingAdjustment({ state: working, object: item(30), control: 'ORDERED' }).value).toBe(0);
    }
  });

  it('applies an exact same-owner cross-session Undo without borrowing the other session’s positive taste', () => {
    const undo = event(14, 21, null, 40, { session_id: id(4), event_type: 'ITEM_INTERACTION_UNDONE',
      properties: { reversedEventId: id(13) } });
    const otherSessionValue = event(15, 23, 0, 50, { session_id: id(4) });
    const working = state(fixture([event(11, 21, 0, 10), event(12, 22, 10, 20), event(13, 21, 10, 30), undo, otherSessionValue]));
    expect(working.items.find(i => i.objectId === id(21))?.direction).toBe(-1);
    expect(working.items.find(i => i.objectId === id(22))?.direction).toBe(1);
    expect(working.support.distinctItems).toBe(2);
    const foreignUndo = { ...undo, actor_user_id: id(99) };
    expect(state(fixture([event(11, 21, 0, 10), event(12, 22, 10, 20), event(13, 21, 10, 30), foreignUndo]))
      .items.find(i => i.objectId === id(21))?.direction).toBe(1);
  });

  it('invalidates a selected-session Item after a later own cross-session canonical replacement while retaining unavailable or foreign changes outside the prefix', () => {
    const original = [event(11, 21, 10, 10), event(12, 22, 10, 20)];
    for (const replacement of [event(13, 21, 0, 30, { session_id: id(4) }),
      event(13, 21, null, 30, { session_id: id(4), event_type: 'ITEM_NOT_INTERESTED', properties: {} })]) {
      const working = state(fixture([...original, replacement]));
      expect(working.support.distinctItems).toBe(1);
      expect(working.items.some(i => i.objectId === id(21))).toBe(false);
      for (const excluded of [{ ...replacement, created_at: 101 }, { ...replacement, occurred_at: 101 },
        { ...replacement, actor_user_id: id(99) }, { ...replacement, profile_id: id(99) }]) {
        expect(state(fixture([...original, excluded])).support.distinctItems).toBe(2);
      }
    }
  });

  it('keeps history clear neutral, including cross-session removal of current rated intent', () => {
    for (const sessionId of [session, id(4)]) {
      const cleared = state(fixture([event(11, 21, 0, 10), event(12, 22, 10, 20),
        event(13, 21, null, 30, { event_type: 'ITEM_HISTORY_CLEARED', session_id: sessionId, properties: {} })]));
      expect(cleared.support.distinctItems).toBe(1);
      expect(cleared.items.some(i => i.objectId === id(21))).toBe(false);
    }
  });

  it('preserves canonical selective clear semantics instead of erasing unrelated rating or not-interest state', () => {
    const rated = event(11, 21, 10, 10); const other = event(12, 22, 10, 20);
    const negative = event(13, 21, null, 30, { event_type: 'ITEM_NOT_INTERESTED', properties: {} });
    const historyClear = event(14, 21, null, 40, { event_type: 'ITEM_HISTORY_CLEARED', properties: {} });
    const interestClear = event(15, 21, null, 50, { event_type: 'ITEM_INTEREST_CLEARED', properties: {} });
    expect(state(fixture([negative, other, historyClear])).items.find(i => i.objectId === id(21))?.direction).toBe(-1);
    expect(state(fixture([rated, other, interestClear])).items.find(i => i.objectId === id(21))?.direction).toBe(1);
    // Clearing the negative does not resurrect the rating that SET_NOT_INTERESTED removed.
    expect(state(fixture([rated, other, negative, interestClear])).items.some(i => i.objectId === id(21))).toBe(false);
  });

  it('uses explicit not-interest without labeling saved, impression, dwell, unknown or bootstrap rows as ratings', () => {
    const ignored = ['ITEM_SAVED', 'ITEM_IMPRESSION', 'ITEM_DWELL', 'SEARCH_PERFORMED', 'KAJO_CALIBRATION', 'BOOTSTRAP_IMPORT']
      .map((eventType, i) => event(40 + i, 21, 10, 30 + i, { event_type: eventType }));
    expect(state(fixture(ignored)).support.distinctItems).toBe(0);
    const negative = [event(11, 21, null, 10, { event_type: 'ITEM_NOT_INTERESTED', properties: {} }),
      event(12, 22, null, 20, { event_type: 'ITEM_NOT_INTERESTED', properties: {} })];
    const working = state(fixture(negative));
    expect(working.support.observedRatings).toBe(0); expect(working.support.explicitNegativeItems).toBe(2);
    expect(scoreWorkingAdjustment({ state: working, object: item(30), control: 'ORDERED' }).value).toBe(-0.25);
  });

  it.each([
    ['foreign actor', { actor_user_id: id(99) }],
    ['foreign Profile', { profile_id: id(99) }],
    ['foreign session', { session_id: id(99) }],
    ['missing session', { session_id: null }],
    ['future occurrence', { occurred_at: 101 }],
    ['late stored time', { created_at: 101 }],
  ] as const)('excludes %s before native support', (_label, changes) => {
    const working = state(fixture([event(11, 21, 0, 10), event(12, 22, 10, 20, changes)]));
    expect(working.support.distinctItems).toBe(1);
    expect(scoreWorkingAdjustment({ state: working, object: item(30), control: 'ORDERED' }).value).toBe(0);
  });

  it('requires the exact current owned session snapshot; null or mismatched session never borrows another cache', () => {
    const original = fixture();
    for (const current of [null, { ...original.session!, actor_user_id: id(99) },
      { ...original.session!, profile_id: id(99) }]) {
      const normalized = normalizeKajoWorkingSession({ ...original, session: current });
      expect(normalized.session).toBeNull(); expect(normalized.records).toEqual([]);
      expect(deriveWorkingState(normalized).status).toBe('NO_SESSION');
    }
  });

  it('fails closed on actor authorization, SharedProfile input, invalid aliases and oversized canonical prefix', () => {
    const raw = fixture();
    expect(() => normalizeKajoWorkingSession({ ...raw, actorUserId: id(99) })).toThrow();
    expect(() => normalizeKajoWorkingSession({ ...raw, profile: { ...raw.profile, type: 'SHARED' as 'PERSONAL' } })).toThrow();
    for (const refs of [{ ...raw.refs, actorRef: raw.refs.subjectRef }, { ...raw.refs, sessionRef: 'other:session' },
      { ...raw.refs, subjectRef: profile }, { ...raw.refs, subjectRef: `test:${profile}` },
      { ...raw.refs, actorRef: `test:${actor.toUpperCase()}` }, { ...raw.refs, sessionRef: `test:${session}` }]) {
      expect(() => normalizeKajoWorkingSession({ ...raw, refs })).toThrow();
    }
    expect(() => normalizeKajoWorkingSession({ ...raw, events: Array.from({ length: 129 }, (_, i) => event(100 + i, 21, 10, 10)) })).toThrow();
  });

  it('rejects invalid timestamp representations and keeps missing declared Item features neutral', () => {
    for (const occurred_at of ['infinity', '-infinity', 'not-a-date', NaN]) {
      expect(() => normalizeKajoWorkingSession(fixture([event(11, 21, 10, 10, { occurred_at })]))).toThrow();
    }
    const working = state(fixture(undefined, { objects: [item(21)] }));
    expect(working.support.distinctItems).toBe(1);
    expect(scoreWorkingAdjustment({ state: working, object: item(30), control: 'ORDERED' }).value).toBe(0);
  });
});
