import { describe, expect, it } from 'vitest';
import { assertRankingJson, compareFrozenRankings, RankingConformanceError } from '../src/ranking-conformance.js';
import type { FrozenRanking } from '../src/ranking-conformance.js';
import { runMediaFixture, runMaintenanceFixture } from '../src/fixtures/cycles.js';

// Independent media/non-media records, with explicit synthetic provenance.
// No rating estimator or domain scorer is invoked by this comparator.
function fixture(domain: 'media' | 'maintenance'): FrozenRanking {
  const predictionId = `${domain}:forecast`, sourceId = `${domain}:fixture`;
  return { version: 'frozen-ranking-v1', predictionId,
    scope: { subject: { id: `${domain}:subject`, kind: domain === 'media' ? 'individual' : 'system' },
      actingIdentityRef: null, sessionRef: '', evidence: { sourceIds: [sourceId], cohortIds: [], synthetic: 'fixture-only' } },
    sessionBinding: null, acquisition: { version: 'fixture-pool-v1', policy: 'DECLARED_OBJECTS',
      requestedObjectIds: [`${domain}:a`, `${domain}:b`], seenObjectIds: [], reminderSpent: false },
    intent: 'DELIVERY', mode: 'default', itemType: null,
    versions: { model: 'frozen-fixture-v1', baseModel: 'fixture-base-v1', policy: 'fixture-policy-v1', genome: 'fixture-genome' },
    clocks: { version: 'fixture-clock-v1', evidenceAsOf: 10, memoryAsOf: 10, scenarioAsOf: 10,
      requestAsOf: 20, workingAsOf: null, requiredAfter: null, arithmeticClock: 'FIXTURE', eligibilityClock: 'FIXTURE',
      dataSnapshot: 'DECLARED_FIXTURE', commitVisibility: 'UNKNOWN', historicalReconstruction: 'UNAVAILABLE' },
    provenance: { record: { recordId: predictionId, revision: 1, origin: 'synthetic',
      source: { kind: 'generator', id: sourceId, version: '1', parentRefs: [] } }, recordedAt: 20, snapshotObservedAt: 30,
    observation: 'frozen-records', availability: 'stored-timestamps-only' },
    scoringArtifact: { id: 'fixture-genome', config: { version: 1 } },
    inputSnapshot: { context: { domain }, state: { version: 'fixture-state-v1' } },
    constraints: { version: 'fixture-eligibility-v1', allowedActionIds: [`choose:${domain}:a`] },
    scoreMeaning: 'ordinal-ranking-score', calibration: 'uncalibrated',
    candidates: [
      { actionId: `choose:${domain}:a`, objectId: `${domain}:a`, sourceScore: 2, sourceRank: 2,
        score: 3, rank: 1, eligible: true, tier: 0, selected: true, inputs: { frozen: 'a' } },
      { actionId: `choose:${domain}:b`, objectId: `${domain}:b`, sourceScore: 4, sourceRank: 1,
        score: 4, rank: 2, eligible: false, tier: 2, selected: false, inputs: { frozen: 'b' } },
    ] };
}
const tolerance = { absoluteTolerance: 1e-12 };
describe('frozen ranking conformance', () => {
  it.each([runMediaFixture, runMaintenanceFixture])('reuses the existing independent cycle scope/actions without reinterpreting its target', run => {
    const { before } = run(), base = fixture('media'), action = before.branches[0]!.action;
    // This declared order is fixture-only. The original expected rating/energy
    // estimate stays opaque in the snapshot, never relabelled as a native score.
    assertRankingJson(before);
    const source: FrozenRanking = { ...base, predictionId: before.id, scope: before.state.scope,
      sessionBinding: before.state.scope.sessionRef, inputSnapshot: before,
      acquisition: { ...base.acquisition, requestedObjectIds: [action.object.id] }, constraints: before.constraints,
      provenance: { ...base.provenance, record: { ...before.state.prefix[0]!.provenance, recordId: before.id } },
      candidates: [{ actionId: action.id, objectId: action.object.id, sourceScore: 1, sourceRank: 1, score: 1, rank: 1,
        eligible: true, tier: 0, selected: true, inputs: { fixtureOrder: 1 } }] };
    expect(compareFrozenRankings(source, structuredClone(source), { absoluteTolerance: 0 }).conforms).toBe(true);
    expect(source.inputSnapshot).toBe(before);
  });
  it.each(['media', 'maintenance'] as const)('compares independent %s records without computing another score', domain => {
    const source = fixture(domain), replay = fixture(domain);
    expect(compareFrozenRankings(source, replay, tolerance)).toEqual({ conforms: true, mismatches: [],
      comparedCandidates: 2, maxAbsoluteScoreDifference: 0 });
    const close = { ...replay, candidates: replay.candidates.map(c => ({ ...c, score: c.score + 5e-13 })) };
    expect(compareFrozenRankings(source, close, tolerance).conforms).toBe(true);
    expect(compareFrozenRankings(source, close, { absoluteTolerance: 0 }).conforms).toBe(false);
    const changed = { ...replay, candidates: replay.candidates.map(c => ({ ...c, score: c.score + 1e-6 })) };
    expect(compareFrozenRankings(source, changed, tolerance).mismatches.every(m => m.kind === 'score')).toBe(true);
  });
  it('does not excuse changes in frozen inputs, policy, clock, provenance or rank', () => {
    const source = fixture('media');
    for (const changed of [
      { ...source, versions: { ...source.versions, policy: 'another-policy' } },
      { ...source, clocks: { ...source.clocks, evidenceAsOf: 11 } },
      { ...source, scoringArtifact: { id: 'fixture-genome', config: { version: 2 } } },
      { ...source, inputSnapshot: { context: 'changed' } },
      { ...source, provenance: { ...source.provenance, recordedAt: 19 } },
      { ...source, acquisition: { ...source.acquisition, policy: 'ANOTHER_POOL' } },
      { ...source, candidates: source.candidates.map(c => ({ ...c, inputs: { frozen: 'different' } })) },
    ]) expect(compareFrozenRankings(source, changed, { absoluteTolerance: 100 }).conforms).toBe(false);
    const reversed = { ...source, candidates: [...source.candidates].reverse().map((c, i) => ({ ...c, rank: i + 1 })),
      constraints: source.constraints };
    expect(compareFrozenRankings(source, reversed, tolerance).conforms).toBe(false);
  });
  it('rejects malformed same-to-same inputs, including incomplete identity and rank bindings', () => {
    const source = fixture('media');
    for (const changed of [
      { ...source, scope: null }, { ...source, provenance: {} }, { ...source, clocks: {} },
      { ...source, provenance: { ...source.provenance, record: { ...source.provenance.record, revision: Number.MAX_SAFE_INTEGER + 1 } } },
      { ...source, sessionBinding: 'invented-session' }, { ...source, constraints: { version: 'x', allowedActionIds: [] } },
      { ...source, candidates: source.candidates.map(c => ({ ...c, rank: 1 })) },
      { ...source, candidates: source.candidates.map(c => ({ ...c, sourceRank: 1 })) },
      { ...source, candidates: source.candidates.map(c => ({ ...c, selected: true })) },
      { ...source, candidates: [source.candidates[0], source.candidates[0]] },
      { ...source, intent: 'EVALUATION' },
    ]) expect(() => compareFrozenRankings(changed as FrozenRanking, changed as FrozenRanking, tolerance)).toThrow(RankingConformanceError);
  });
  it('compares true empty pools and requires an explicit finite nonnegative tolerance', () => {
    const source = { ...fixture('maintenance'), candidates: [], constraints: { version: 'empty', allowedActionIds: [] } };
    expect(compareFrozenRankings(source, source, tolerance).comparedCandidates).toBe(0);
    for (const absoluteTolerance of [-1, NaN, Infinity]) {
      expect(() => compareFrozenRankings(source, source, { absoluteTolerance })).toThrow(RankingConformanceError);
    }
  });
  it('rejects cycles, sparse arrays, getters and oversized input without invoking accessors', () => {
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    const getter = Object.defineProperty({}, 'data', { enumerable: true, get() { throw new Error('invoked'); } });
    const arrayGetter = Object.defineProperty([], '0', { enumerable: true, get() { throw new Error('invoked'); } });
    const inheritedGetter = Object.setPrototypeOf([], Object.defineProperty(Object.create(Array.prototype), Symbol.iterator,
      { get() { throw new Error('invoked'); } }));
    for (const input of [cyclic, getter, arrayGetter, inheritedGetter, new Array(1), [Infinity], Array(2049).fill(0), '\0'.repeat(1_500_000)]) {
      expect(() => assertRankingJson(input)).toThrow(RankingConformanceError);
    }
  });
});
