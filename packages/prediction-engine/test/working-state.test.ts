import { describe, expect, it } from 'vitest';
import type { ArtifactVersion, Observation, PredictionObject, PredictionScope, TargetDefinition } from '../src/contracts.js';
import { represent } from '../src/engine.js';
import { deriveWorkingState, scoreWorkingAdjustment } from '../src/working-state.js';
import type { WorkingRecord, WorkingStateInput } from '../src/working-state.js';

// Declared generated fixtures test a source hypothesis, never recommendation quality.
const scope: PredictionScope = {
  subject: { id: 'subject', kind: 'individual' }, actingIdentityRef: 'actor', sessionRef: 'session',
  evidence: { sourceIds: ['native'], cohortIds: [], synthetic: 'exclude' },
};
const target: TargetDefinition = { id: 'rating', version: '1', scale: { min: 0, max: 10 },
  conditioning: 'object-observation', exposure: 'not-required', objective: 'maximize' };
const artifact: ArtifactVersion = { id: 'features', version: '1', representationVersion: 'normalized-v1',
  availableAt: 0, trainedThrough: null, sourceRefs: ['native'], use: 'fixture-only' };
const featureSchema = { id: 'features', version: '1', dimensions: ['warm', 'dark'], artifact };
const object = (id: string, features: Record<string, number | null> = { warm: 1 }): PredictionObject =>
  ({ id, features, availableAt: 0, artifact });
function record(id: string, item: string, rating: number | null, occurredAt: number, changes: Partial<WorkingRecord> = {}): WorkingRecord {
  const observation: Observation = {
    subjectId: scope.subject.id, actingIdentityRef: scope.actingIdentityRef, objectId: item,
    actionId: null, predictionId: null, targetId: target.id, targetVersion: target.version,
    measurement: rating === null ? { status: 'missing', reason: 'unknown' } : { status: 'observed', value: rating },
    raw: { value: rating, scale: target.scale }, occurredAt, availableAt: occurredAt,
    exposure: 'unknown', access: { kind: 'subject', subjectId: scope.subject.id },
    provenance: { origin: 'observed', source: { kind: 'native', id: 'native' }, recordId: id, revision: 1 },
  };
  return { observation, sessionRef: 'session', kind: 'VALUE', object: object(item), ...changes };
}
const input = (records: readonly WorkingRecord[], changes: Partial<WorkingStateInput> = {}): WorkingStateInput =>
  ({ scope, target, asOf: 100, session: { ref: 'session', startedAt: 0 }, prefixComplete: true,
    featureSchema, records, ...changes });
const withObservation = (r: WorkingRecord, change: Partial<Observation>): WorkingRecord =>
  ({ ...r, observation: { ...r.observation, ...change } });

describe('bounded ordered WorkingState hypothesis', () => {
  it('keeps the durable prefix identical while ordered recent groups produce opposite bounded adjustments', () => {
    const negative = record('negative', 'one', 0, 10);
    const positive = record('positive', 'two', 10, 20);
    const reversed = [withObservation(negative, { occurredAt: 20, availableAt: 20 }),
      withObservation(positive, { occurredAt: 10, availableAt: 10 })];
    const forward = [negative, positive];
    const durable = (records: readonly WorkingRecord[]) => represent({ scope, target, asOf: 100, artifact,
      observations: records.map(r => r.observation) });
    expect(durable(forward).longTermMean).toBe(5);
    expect(durable(reversed).longTermMean).toBe(5);
    const state = deriveWorkingState(input(forward));
    const reverseState = deriveWorkingState(input(reversed));
    // This oracle follows the declared two-group half-life, independently of the implementation.
    const expected = 0.25 * (1 - Math.SQRT1_2) / (1 + Math.SQRT1_2);
    expect(scoreWorkingAdjustment({ state, object: object('candidate'), control: 'ORDERED' }).value).toBeCloseTo(expected, 12);
    expect(scoreWorkingAdjustment({ state: reverseState, object: object('candidate'), control: 'ORDERED' }).value).toBeCloseTo(-expected, 12);
    expect(scoreWorkingAdjustment({ state, object: object('candidate'), control: 'STATIC' }).value).toBe(0);
    expect(Math.abs(expected)).toBeLessThan(0.25);
  });

  it('defaults OFF and preserves exact baseline scores and ranks even when the hypothesis would invert them', () => {
    const state = deriveWorkingState(input([
      record('warm', 'one', 10, 10, { object: object('one', { warm: 1 }) }),
      record('dark', 'two', 0, 20, { object: object('two', { dark: 1 }) }),
    ]));
    const candidates = [{ item: object('warm-candidate', { warm: 1 }), base: 1 },
      { item: object('dark-candidate', { dark: 1 }), base: 1.1 }];
    const baseline = candidates.map(c => [c.item.id, c.base] as const).sort((a, b) => b[1] - a[1]);
    const off = candidates.map(c => [c.item.id, c.base + scoreWorkingAdjustment({ state, object: c.item }).value] as const)
      .sort((a, b) => b[1] - a[1]);
    expect(off).toEqual(baseline);
    expect(scoreWorkingAdjustment({ state, object: candidates[0]!.item, control: 'OFF' }).value).toBe(0);
    expect(scoreWorkingAdjustment({ state, object: candidates[0]!.item, control: 'ORDERED' }).value).toBe(0.25);
    expect(scoreWorkingAdjustment({ state, object: candidates[1]!.item, control: 'ORDERED' }).value).toBe(-0.25);
  });

  it('counts independent Items rather than repeated actions, corrections or a large number of tags', () => {
    const one = record('one', 'same', 10, 10, { object: object('same', { warm: 1, dark: 1 }) });
    const repeated = record('again', 'same', 10, 20, { object: one.object });
    const corrected = record('corrected', 'same', 0, 30, { object: one.object });
    const state = deriveWorkingState(input([one, one, repeated, corrected]));
    expect(state.support.distinctItems).toBe(1);
    expect(state.status).toBe('INSUFFICIENT_SUPPORT');
    expect(scoreWorkingAdjustment({ state, object: object('candidate'), control: 'ORDERED' }).value).toBe(0);
  });

  it('treats equal-time Items as one unordered group and never invents recency from record IDs or input order', () => {
    const first = record('zzz', 'one', 0, 10);
    const second = record('aaa', 'two', 10, 10);
    const a = deriveWorkingState(input([first, second]));
    const b = deriveWorkingState(input([second, first]));
    expect(a.groups).toHaveLength(1);
    expect(a.vectors).toEqual(b.vectors);
    expect(scoreWorkingAdjustment({ state: a, object: object('candidate'), control: 'ORDERED' }).value).toBe(0);
    expect(scoreWorkingAdjustment({ state: b, object: object('candidate'), control: 'ORDERED' }).value).toBe(0);
  });

  it('drops conflicting same-Item same-time values instead of choosing a lexicographic winner', () => {
    const conflict = [record('zzz', 'one', 0, 10), record('aaa', 'one', 10, 10), record('other', 'two', 10, 20)];
    const state = deriveWorkingState(input(conflict));
    expect(state.support.distinctItems).toBe(1);
    expect(state.items.some(i => i.objectId === 'one')).toBe(false);
    expect(deriveWorkingState(input([...conflict].reverse())).vectors).toEqual(state.vectors);
    expect(scoreWorkingAdjustment({ state, object: object('candidate'), control: 'ORDERED' }).value).toBe(0);
  });

  it('retains a known zero-rating revision before a future correction becomes available', () => {
    const zero = record('rating', 'one', 0, 10);
    const correction = withObservation(record('rating', 'one', 10, 10), { availableAt: 200,
      provenance: { ...zero.observation.provenance, revision: 2 } });
    const other = record('other', 'two', 10, 20);
    const early = deriveWorkingState(input([zero, other, correction]));
    expect(early.vectors).toEqual(deriveWorkingState(input([zero, other])).vectors);
    expect(early.items.find(i => i.objectId === 'one')?.direction).toBe(-1);
    expect(early.support.observedRatings).toBe(2);
    const later = deriveWorkingState(input([zero, other, correction], { asOf: 200 }));
    expect(later.items.find(i => i.objectId === 'one')?.direction).toBe(1);
    expect(later.support.distinctItems).toBe(2);
    expect(scoreWorkingAdjustment({ state: later, object: object('candidate'), control: 'ORDERED' }).value).toBe(0.25);
  });

  it('applies only available exact-source Undo while retaining earlier frozen state and immutable references', () => {
    const zero = record('zero', 'one', 0, 10);
    const correction = record('corrected', 'one', 10, 20);
    const other = record('other', 'two', 10, 30);
    const undo = record('undo', 'one', null, 40, { kind: 'UNDO', object: null, sessionRef: 'another-session',
      invalidates: [{ sourceId: 'native', recordId: 'corrected' }] });
    const records = [zero, correction, other, undo]; const before = structuredClone(records);
    const frozen = deriveWorkingState(input(records, { asOf: 35 }));
    expect(frozen.items.find(i => i.objectId === 'one')?.direction).toBe(1);
    const corrected = deriveWorkingState(input(records));
    expect(corrected.items.find(i => i.objectId === 'one')?.direction).toBe(-1);
    expect(frozen.items.find(i => i.objectId === 'one')?.direction).toBe(1);
    expect(records).toEqual(before);
    const borrowed = withObservation(undo, { actingIdentityRef: 'another-actor' });
    expect(deriveWorkingState(input([zero, correction, other, borrowed])).vectors).toEqual(frozen.vectors);
  });

  it('rejects an invalidation borrowed from another source instead of removing native evidence', () => {
    const first = record('one', 'one', 10, 10); const second = record('two', 'two', 10, 20);
    const undo = record('undo', 'one', null, 30, { kind: 'UNDO', object: null,
      invalidates: [{ sourceId: 'external', recordId: 'one' }] });
    expect(() => deriveWorkingState(input([first, second, undo]))).toThrow('correction references');
  });

  it('removes cleared current Item intent without treating unknown or attention as a negative rating', () => {
    const first = record('one', 'one', 10, 10); const second = record('two', 'two', 10, 20);
    const clear = record('clear', 'one', null, 30, { kind: 'CLEAR', object: null });
    const state = deriveWorkingState(input([first, second, clear]));
    expect(state.support.distinctItems).toBe(1);
    expect(state.items.some(i => i.objectId === 'one')).toBe(false);
    const unknown = record('unknown', 'unknown', null, 40);
    const attention = record('attention', 'viewed', null, 50, { kind: 'ATTENTION' });
    expect(deriveWorkingState(input([second, unknown, attention])).support.distinctItems).toBe(1);
  });

  it('retains explicit native not-interest as a policy signal without inventing rating support', () => {
    const negatives = ['one', 'two'].map((id, i) => record(id, id, null, 10 + i, { kind: 'NEGATIVE' }));
    const state = deriveWorkingState(input(negatives));
    expect(state.support.distinctItems).toBe(2);
    expect(state.support.observedRatings).toBe(0);
    expect(state.support.explicitNegativeItems).toBe(2);
    expect(scoreWorkingAdjustment({ state, object: object('candidate'), control: 'ORDERED' }).value).toBe(-0.25);
  });

  it.each([
    ['future occurrence', (r: WorkingRecord) => withObservation(r, { occurredAt: 101 })],
    ['late availability', (r: WorkingRecord) => withObservation(r, { availableAt: 101 })],
    ['foreign actor', (r: WorkingRecord) => withObservation(r, { actingIdentityRef: 'foreign' })],
    ['foreign subject', (r: WorkingRecord) => withObservation(r, { subjectId: 'foreign' })],
    ['private foreign access', (r: WorkingRecord) => withObservation(r, { access: { kind: 'subject', subjectId: 'foreign' } })],
    ['cohort access', (r: WorkingRecord) => withObservation(r, { access: { kind: 'cohort', cohortId: 'cohort' } })],
    ['other session', (r: WorkingRecord) => ({ ...r, sessionRef: 'other' })],
    ['unadmitted source', (r: WorkingRecord) => withObservation(r, { provenance: { origin: 'observed', recordId: r.observation.provenance.recordId,
      revision: r.observation.provenance.revision, source: { kind: 'native', id: 'foreign' } } })],
    ['external bootstrap', (r: WorkingRecord) => withObservation(r, { provenance: { origin: 'observed', recordId: 'import', revision: 1,
      source: { kind: 'external', id: 'native', release: 'release', manifestId: 'manifest', availability: 'recorded' } } })],
    ['synthetic generator', (r: WorkingRecord) => withObservation(r, { provenance: { origin: 'synthetic', recordId: 'synthetic', revision: 1,
      source: { kind: 'generator', id: 'native', version: '1', parentRefs: [] } } })],
  ] as const)('excludes %s without adding independent support', (_label, mutate) => {
    const first = record('one', 'one', 10, 10); const excluded = mutate(record('two', 'two', 10, 20));
    const state = deriveWorkingState(input([first, excluded]));
    expect(state.support.distinctItems).toBe(1);
    expect(scoreWorkingAdjustment({ state, object: object('candidate'), control: 'ORDERED' }).value).toBe(0);
  });

  it('does not pool a Shared/group subject or a missing acting identity into Personal WorkingState', () => {
    const records = [record('one', 'one', 10, 10), record('two', 'two', 10, 20)];
    for (const changedScope of [{ ...scope, subject: { ...scope.subject, kind: 'group' as const } },
      { ...scope, actingIdentityRef: null }]) {
      expect(() => deriveWorkingState(input(records, { scope: changedScope }))).toThrow();
    }
  });

  it.each([
    ['NO_SESSION', { session: null }],
    ['INCOMPLETE_PREFIX', { prefixComplete: false }],
    ['RESET_EMPTY', { resetAt: 20 }],
    ['SESSION_EXPIRED', { asOf: 14_400_001 }],
    ['IDLE_EXPIRED', { asOf: 1_800_021 }],
  ] as const)('abstains on %s at the explicit boundary', (status, changes) => {
    const state = deriveWorkingState(input([record('one', 'one', 10, 10), record('two', 'two', 10, 20)], changes));
    expect(state.status).toBe(status);
    for (const control of ['OFF', 'STATIC', 'ORDERED'] as const) {
      expect(scoreWorkingAdjustment({ state, object: object('candidate'), control }).value).toBe(0);
    }
  });

  it('fails closed on record, distinct-Item, feature and exact-invalidation budget overflow', () => {
    const records = [record('one', 'one', 10, 10), record('two', 'two', 10, 20)];
    for (const changes of [{ config: { maxRecords: 1 } },
      { config: { maxFeatures: 1 } }]) {
      expect(() => deriveWorkingState(input(records, changes))).toThrow();
    }
    expect(() => deriveWorkingState(input([...records, record('three', 'three', 10, 30)], { config: { maxItems: 2 } }))).toThrow('Item budget');
    const undo = record('undo', 'one', null, 30, { kind: 'UNDO', object: null,
      invalidates: [{ sourceId: 'native', recordId: 'one' }, { sourceId: 'native', recordId: 'two' }] });
    expect(() => deriveWorkingState(input([...records, undo], { config: { maxInvalidations: 1 } }))).toThrow();
  });

  it('rejects nonfinite clocks, undeclared versions, invalid rating scales and unnormalized features', () => {
    const records = [record('one', 'one', 10, 10), record('two', 'two', 10, 20)];
    for (const value of [NaN, Infinity, -1]) expect(() => deriveWorkingState(input(records, { asOf: value }))).toThrow();
    expect(() => deriveWorkingState(input(records, { config: { version: 'guessed-version' } as unknown as NonNullable<WorkingStateInput['config']> }))).toThrow();
    const invalidScale = withObservation(records[0]!, { raw: { value: 10, scale: { min: 0, max: 0 } } });
    expect(() => deriveWorkingState(input([invalidScale, records[1]!]))).toThrow();
    for (const features of [{ warm: 1.01 }, { warm: -0.01 }, { warm: Infinity }, { undeclared: 1 }]) {
      expect(() => deriveWorkingState(input([{ ...records[0]!, object: object('one', features) }, records[1]!]))).toThrow();
    }
  });

  it('checks feature/artifact cutoffs and compatibility again for the candidate', () => {
    const state = deriveWorkingState(input([record('one', 'one', 10, 10), record('two', 'two', 10, 20)]));
    for (const candidate of [
      { ...object('candidate'), availableAt: 101 },
      { ...object('candidate'), artifact: { ...artifact, availableAt: 101 } },
      { ...object('candidate'), artifact: { ...artifact, trainedThrough: 101 } },
      { ...object('candidate'), artifact: { ...artifact, representationVersion: 'other' } },
      object('candidate', { unknown: 1 }),
    ]) expect(() => scoreWorkingAdjustment({ state, object: candidate, control: 'ORDERED' })).toThrow();
    expect(scoreWorkingAdjustment({ state, object: object('candidate', { warm: null, dark: 0 }), control: 'ORDERED' }).value).toBe(0);
  });

  it('returns an explicit uncalibrated source-only adjustment and never mutates its inputs', () => {
    const supplied = input([record('one', 'one', 10, 10), record('two', 'two', 10, 20)]);
    const before = structuredClone(supplied); const candidate = object('candidate'); const candidateBefore = structuredClone(candidate);
    const state = deriveWorkingState(supplied);
    const result = scoreWorkingAdjustment({ state, object: candidate, control: 'ORDERED' });
    expect(result.uncertainty).toBe('unavailable'); expect(result.calibration).toBe('uncalibrated');
    expect(result.nativeActivated).toBe(false); expect(result.stateVersion).toBe('working-state-v1');
    expect(supplied).toEqual(before); expect(candidate).toEqual(candidateBefore);
  });

  it('uses the same ordered formula for a non-media maintenance system without Kajo identities or a maximize-only assumption', () => {
    const machineScope: PredictionScope = { subject: { id: 'machine-7', kind: 'system' }, actingIdentityRef: 'configuration-controller',
      sessionRef: 'maintenance-window', evidence: { sourceIds: ['maintenance-fixture'], cohortIds: [], synthetic: 'fixture-only' } };
    const energyTarget: TargetDefinition = { id: 'energy-used', version: '1', scale: { min: 0, max: 100 },
      conditioning: 'object-observation', exposure: 'not-required', objective: 'minimize' };
    const records = [record('old', 'configuration-one', 90, 10), record('new', 'configuration-two', 10, 20)].map(r => ({
      ...r, sessionRef: machineScope.sessionRef, observation: { ...r.observation,
        subjectId: machineScope.subject.id, actingIdentityRef: machineScope.actingIdentityRef,
        targetId: energyTarget.id, targetVersion: energyTarget.version, raw: { value: r.observation.raw.value, scale: energyTarget.scale },
        access: { kind: 'subject' as const, subjectId: machineScope.subject.id },
        provenance: { origin: 'synthetic' as const, source: { kind: 'generator' as const, id: 'maintenance-fixture', version: '1', parentRefs: [] },
          recordId: r.observation.provenance.recordId, revision: 1 } } }));
    const working = deriveWorkingState(input(records, { scope: machineScope, target: energyTarget,
      session: { ref: machineScope.sessionRef, startedAt: 0 } }));
    const oracle = 0.25 * 0.8 * (1 - Math.SQRT1_2) / (1 + Math.SQRT1_2);
    expect(scoreWorkingAdjustment({ state: working, object: object('configuration-candidate'), control: 'ORDERED' }).value).toBeCloseTo(oracle, 12);
    expect(scoreWorkingAdjustment({ state: working, object: object('configuration-candidate'), control: 'STATIC' }).value).toBe(0);
    expect(scoreWorkingAdjustment({ state: working, object: object('configuration-candidate') }).value).toBe(0);
    expect(working.support.nativeItems).toBe(0); expect(working.support.syntheticItems).toBe(2);
    expect(working.observedEvaluationCount).toBe(0); expect(working.learnable).toBe(false);
  });

  it('does not renew selected-session idle expiry from a foreign-session administrative clear', () => {
    const own = [record('one', 'one', 10, 10), record('two', 'two', 10, 20)];
    const foreignClear = record('clear', 'third', null, 1_800_010, { kind: 'CLEAR', object: null, sessionRef: 'another-session' });
    const working = deriveWorkingState(input([...own, foreignClear], { asOf: 1_800_020 }));
    expect(working.support.distinctItems).toBe(2);
    expect(working.status).toBe('IDLE_EXPIRED');
    expect(scoreWorkingAdjustment({ state: working, object: object('candidate'), control: 'ORDERED' }).value).toBe(0);
  });

  it('invalidates stale same-Item selected-session intent after an available own cross-session replacement without importing its taste', () => {
    const first = record('one', 'one', 10, 10); const other = record('two', 'two', 10, 20);
    for (const replacement of [record('later-rating', 'one', 0, 30, { sessionRef: 'another-session' }),
      record('later-negative', 'one', null, 30, { sessionRef: 'another-session', kind: 'NEGATIVE' })]) {
      const working = deriveWorkingState(input([first, other, replacement]));
      expect(working.items.some(i => i.objectId === 'one')).toBe(false);
      expect(working.support.distinctItems).toBe(1);
      for (const unavailable of [withObservation(replacement, { availableAt: 101 }),
        withObservation(replacement, { occurredAt: 101 }), withObservation(replacement, { actingIdentityRef: 'foreign' })]) {
        expect(deriveWorkingState(input([first, other, unavailable])).support.distinctItems).toBe(2);
      }
    }
    expect(deriveWorkingState(input([first, other, record('older', 'one', 0, 5, { sessionRef: 'another-session' })]))
      .items.find(i => i.objectId === 'one')?.direction).toBe(1);
  });

  it('permits a current-session attention record to retain activity without inventing independent taste support', () => {
    const own = [record('one', 'one', 10, 10), record('two', 'two', 10, 20)];
    const attention = record('attention', 'viewed', null, 1_800_010, { kind: 'ATTENTION', object: null });
    const working = deriveWorkingState(input([...own, attention], { asOf: 1_800_020 }));
    expect(working.support.distinctItems).toBe(2);
    expect(working.support.observedRatings).toBe(2);
    expect(working.status).toBe('ACTIVE');
    expect(scoreWorkingAdjustment({ state: working, object: object('candidate'), control: 'ORDERED' }).value).toBe(0.25);
  });

  it.each(['__proto__', 'constructor', 'prototype'])('handles own normalized feature key %s without inherited values or nonfinite arithmetic', dimension => {
    const features = JSON.parse(`{"warm":1,"${dimension}":1}`) as Record<string, number>;
    const working = deriveWorkingState(input([record('one', 'one', 10, 10, { object: object('one', features) }),
      record('two', 'two', 10, 20, { object: object('two', features) })],
    { featureSchema: { ...featureSchema, dimensions: ['warm', dimension] } }));
    expect(working.vectors.ordered[dimension]).toBe(1);
    expect(scoreWorkingAdjustment({ state: working, object: object('own', features), control: 'ORDERED' }).value).toBe(0.25);
    expect(scoreWorkingAdjustment({ state: working, object: object('missing', { warm: 1 }), control: 'ORDERED' }).value).toBe(0.25);
    expect(Object.hasOwn(working.items[0]!.features, dimension)).toBe(true);
    expect(Object.hasOwn({}, dimension)).toBe(false);
  });

  it('rejects target scales whose finite endpoints have an overflowing normalization width', () => {
    const hugeTarget = { ...target, scale: { min: -1e308, max: 1e308 } };
    expect(() => deriveWorkingState(input([], { target: hugeTarget }))).toThrow();
  });

  it('normalizes a valid very wide finite scale without overflow before division or zero-feature NaN', () => {
    const wideTarget = { ...target, scale: { min: 0, max: 1e308 } };
    const wide = [record('low', 'one', 0, 10, { object: object('one', { warm: 1, dark: 0 }) }),
      record('high', 'two', 1e308, 20, { object: object('two', { warm: 1, dark: 0 }) })]
      .map(r => withObservation(r, { raw: { value: r.observation.raw.value, scale: wideTarget.scale } }));
    const working = deriveWorkingState(input(wide, { target: wideTarget }));
    expect(working.items.map(i => i.direction)).toEqual([-1, 1]);
    expect(working.vectors.ordered.dark).toBe(0);
    expect(scoreWorkingAdjustment({ state: working, object: object('candidate'), control: 'ORDERED' }).value)
      .toBeCloseTo(0.25 * (1 - Math.SQRT1_2) / (1 + Math.SQRT1_2), 12);
  });

  it('rejects a forged summary or vector instead of trusting copied WorkingState metadata', () => {
    const working = deriveWorkingState(input([record('one', 'one', 10, 10), record('two', 'two', 10, 20)]));
    for (const forged of [{ ...working, support: { ...working.support, distinctItems: 200 } },
      { ...working, vectors: { ...working.vectors, ordered: { ...working.vectors.ordered, warm: 1_000 } } }]) {
      expect(() => scoreWorkingAdjustment({ state: forged, object: object('candidate'), control: 'ORDERED' })).toThrow('frozen prefix');
    }
  });
});
