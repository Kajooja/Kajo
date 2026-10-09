import { expect, it } from 'vitest';
import type { Observation, TargetDefinition } from '../src/contracts.js';
import { evaluateOrdinalBatch, evaluateOrdinalPair } from '../src/ordinal.js';
import type { OrdinalPairInput, OrdinalRound } from '../src/ordinal.js';

// Every fixture observation is explicitly generated, including media-shaped
// records. None of these deterministic diagnostics supplies observed evidence.
const source = { kind: 'generator', id: 'ordinal-fixture', version: '1', parentRefs: [] } as const;
const participants = ['actor-a', 'actor-b', 'actor-c'].map(actorId => ({ actorId, enrollmentId: `${actorId}:generation-1` }));
function fixture(domain = 'media', objective: 'maximize' | 'minimize' = 'maximize'): OrdinalPairInput {
  const target: TargetDefinition = { id: `${domain}:post-experience`, version: '1', scale: { min: 0, max: 10 },
    conditioning: 'action-outcome', exposure: 'required', objective };
  const round = (side: 'left' | 'right', values: number[]): OrdinalRound => ({
    roundId: `${domain}:${side}:round`, experienceId: `${domain}:${side}:experience`, objectId: `${domain}:${side}:object`,
    openedAt: side === 'left' ? 100 : 200, matureAt: side === 'left' ? 400 : 500,
    capture: { id: `${domain}:${side}:capture`, revision: 5, availableAt: side === 'left' ? 500 : 600,
      availabilityBasis: 'synthetic-clock', comparisonId: `${domain}:${side}:comparison` },
    participants,
    responses: participants.map((participant, index) => {
      const value = values[index]!, occurredAt = (side === 'left' ? 110 : 210) + index;
      const observation: Observation = { subjectId: `${domain}:group`, actingIdentityRef: participant.actorId,
        objectId: `${domain}:${side}:object`, actionId: `${domain}:${side}:experience`,
        predictionId: `${domain}:${side}:${participant.actorId}:own-prediction`, targetId: target.id, targetVersion: target.version,
        measurement: { status: 'observed', value }, raw: { value, scale: target.scale }, occurredAt,
        availableAt: side === 'left' ? 500 : 600, exposure: 'verified', access: { kind: 'subject', subjectId: `${domain}:group` },
        provenance: { origin: 'synthetic', source, recordId: `${domain}:${side}:${participant.actorId}:response`, revision: index + 2 } };
      return { ...participant, status: 'rated', observation };
    }),
  });
  const left = round('left', [0, 2, 4]), right = round('right', [0, 1, 3]);
  return { pairId: `${domain}:pair`, scope: { subject: { id: `${domain}:group`, kind: 'group' },
    actingIdentityRef: participants[0]!.actorId, sessionRef: `${domain}:evaluation`,
    evidence: { sourceIds: [source.id], cohortIds: [], synthetic: 'fixture-only' } }, target, evaluationAsOf: 700,
  left, right, anchor: { id: `${domain}:anchor`, subjectId: `${domain}:group`, actorId: participants[0]!.actorId,
    frozenAt: 90, availableAt: 650, timestampBasis: 'stored-request-time', sourcePredictionId: `${domain}:production`,
    shadowPredictionId: `${domain}:shadow`, pool: [
      { objectId: left.objectId, production: { score: 4, rank: 1 }, shadow: { score: 2, rank: 2 } },
      { objectId: right.objectId, production: { score: 2, rank: 2 }, shadow: { score: 4, rank: 1 } },
    ] }, integrityBasis: 'SYNTHETIC_FIXTURE' };
}
function values(input: OrdinalPairInput, side: 'left' | 'right', ratings: number[]): OrdinalPairInput {
  const round = input[side];
  return { ...input, [side]: { ...round, responses: round.responses.map((response, index) => ({ ...response,
    observation: { ...response.observation!, measurement: { status: 'observed', value: ratings[index]! },
      raw: { ...response.observation!.raw, value: ratings[index]! } } })) } };
}
function responseChange(input: OrdinalPairInput, change: Partial<OrdinalRound['responses'][number]>): OrdinalPairInput {
  return { ...input, left: { ...input.left, responses: [{ ...input.left.responses[0]!, ...change }, ...input.left.responses.slice(1)] } };
}
function observationChange(input: OrdinalPairInput, change: Partial<Observation>): OrdinalPairInput {
  return responseChange(input, { observation: { ...input.left.responses[0]!.observation!, ...change } });
}
function reason(input: OrdinalPairInput, expected: string): void {
  const report = evaluateOrdinalPair(input);
  expect(report.status).toBe('unscored'); expect(report.reasons).toContain(expected);
  expect(report.production.agreement).toBe('unscored'); expect(report.shadow.agreement).toBe('unscored');
  expect(report.observedPairCount).toBe(0); expect(report.syntheticPairCount).toBe(0);
}

it('compares unanimous media directions on one group pair, retaining zero/ties and every own actor trace', () => {
  const input = fixture(), report = evaluateOrdinalPair(input);
  expect(report).toMatchObject({ status: 'comparable', observedOrder: 'left-dominates', reasons: [],
    production: { order: 'left', agreement: 'agreement' }, shadow: { order: 'right', agreement: 'disagreement' },
    observedPairCount: 0, syntheticPairCount: 1, historicalFeatureEligible: false, membershipValidity: 'historical-membership-unknown',
    commitVisibility: 'unknown', uncertainty: 'unavailable', learnable: false, groupReward: null, advantage: null });
  expect(report.actors.map(actor => actor.direction)).toEqual(['tie', 'left', 'left']);
  expect(new Set(report.actors.flatMap(actor => [actor.left!.predictionId, actor.right!.predictionId])).size).toBe(6);
  expect(report.captures).toEqual({ left: input.left.capture, right: input.right.capture });
  expect(report.subjectRef).toBe(input.scope.subject.id); expect(report.target).toEqual(input.target);
  expect(report.evaluationAsOf).toBe(input.evaluationAsOf);
  expect(report.experiences).toEqual({ left: { roundId: input.left.roundId, experienceId: input.left.experienceId, objectId: input.left.objectId },
    right: { roundId: input.right.roundId, experienceId: input.right.experienceId, objectId: input.right.objectId } });
  expect(report.participants).toEqual({ left: participants, right: participants });
  expect(report.actors.map(actor => [actor.left!.revision, actor.right!.revision])).toEqual([[2, 2], [3, 3], [4, 4]]);
  expect(evaluateOrdinalPair(input)).toEqual(report);
  expect(Object.isFrozen(report)).toBe(true); expect(Object.isFrozen(report.actors[0])).toBe(true);
  expect(Object.isFrozen(report.target!.scale)).toBe(true); expect(Object.isFrozen(report.experiences.left)).toBe(true);
});
it('uses the same generic contracts for non-media costs and reverses observed dominance when lower is preferred', () => {
  const report = evaluateOrdinalPair(fixture('maintenance', 'minimize'));
  expect(report).toMatchObject({ status: 'comparable', observedOrder: 'right-dominates',
    production: { agreement: 'disagreement' }, shadow: { agreement: 'agreement' }, observedPairCount: 0, syntheticPairCount: 1 });
});
it('keeps opposing actor preferences and all-member ties as explicit unscored partial-order cases', () => {
  const input = fixture();
  const mixed = values(input, 'right', [0, 3, 3]);
  reason(mixed, 'mixed-preferences');
  expect(evaluateOrdinalPair(mixed)).toMatchObject({ observedOrder: 'mixed',
    actors: [{ direction: 'tie' }, { direction: 'right' }, { direction: 'left' }] });
  const tied = values(input, 'right', [0, 2, 4]); reason(tied, 'all-tied');
  expect(evaluateOrdinalPair(tied).observedOrder).toBe('all-tied');
});
it('treats equal predicted scores as neutral despite different ranks, and otherwise respects frozen policy rank', () => {
  const input = fixture();
  const equal = { ...input, anchor: { ...input.anchor, pool: input.anchor.pool.map(candidate => ({ ...candidate,
    production: { ...candidate.production, score: 0 } })) } };
  expect(evaluateOrdinalPair(equal).production).toEqual({ order: 'tie', agreement: 'tie' });
  const policyOrder = { ...input, anchor: { ...input.anchor, pool: input.anchor.pool.map((candidate, index) => ({ ...candidate,
    production: { ...candidate.production, score: index ? 999 : -999 } })) } };
  expect(evaluateOrdinalPair(policyOrder).production).toEqual({ order: 'left', agreement: 'agreement' });
});
it('never silently intersects changed actors or enrollment generations, including a removed last responder', () => {
  const input = fixture(), replacement = { actorId: 'actor-other', enrollmentId: 'actor-other:g1' };
  reason({ ...input, right: { ...input.right, participants: [replacement, ...participants.slice(1)],
    responses: input.right.responses.slice(1) } }, 'membership-mismatch');
  const changed = { ...participants[0]!, enrollmentId: 'actor-a:g2' };
  const mismatch = { ...input, right: { ...input.right, participants: [changed, ...participants.slice(1)],
    responses: [{ ...input.right.responses[0]!, ...changed }, ...input.right.responses.slice(1)] } };
  reason(mismatch, 'membership-mismatch'); expect(evaluateOrdinalPair(mismatch).observedOrder).toBe(null);
  expect(evaluateOrdinalPair(mismatch).participants.right[0]!.enrollmentId).toBe('actor-a:g2');
});
it('distinguishes missing, unknown, cleared, unexposed and immature responses without turning them into zero', () => {
  const input = fixture();
  reason(responseChange(input, { status: 'missing', observation: null }), 'missing-response');
  reason(responseChange(input, { status: 'unknown', observation: null }), 'unknown-response');
  reason(responseChange(input, { status: 'clear', observation: null }), 'cleared-response');
  reason({ ...input, left: { ...input.left, responses: input.left.responses.slice(1) } }, 'missing-response');
  reason(observationChange(input, { exposure: 'unknown' }), 'unexposed');
  reason(observationChange(input, { predictionId: null }), 'unexposed');
  reason(observationChange(input, { measurement: { status: 'missing', reason: 'immature' } }), 'immature-round');
  reason({ ...input, left: { ...input.left, matureAt: 701 } }, 'immature-round');
  reason({ ...input, left: { ...input.left, matureAt: 550 } }, 'immature-round');
  reason(observationChange(input, { occurredAt: 450, availableAt: 500 }), 'immature-round');
  expect(evaluateOrdinalPair(input).actors[0]!.direction).toBe('tie');
});
it('requires a common finite ranked anchor strictly before both OPEN boundaries with honest availability', () => {
  const input = fixture();
  for (const frozenAt of [100, 200, 300]) reason({ ...input, anchor: { ...input.anchor, frozenAt } }, 'anchor-late');
  reason({ ...input, anchor: { ...input.anchor, availableAt: 701 } }, 'anchor-unavailable');
  reason({ ...input, anchor: { ...input.anchor, actorId: 'foreign-actor' } }, 'anchor-membership-mismatch');
  reason({ ...input, anchor: { ...input.anchor, pool: input.anchor.pool.slice(0, 1) } }, 'anchor-pool-mismatch');
  for (const score of [NaN, Infinity]) reason({ ...input, anchor: { ...input.anchor, pool: [
    { ...input.anchor.pool[0]!, production: { score, rank: 1 } }, input.anchor.pool[1]!,
  ] } }, 'anchor-pool-mismatch');
  reason({ ...input, anchor: { ...input.anchor, pool: input.anchor.pool.map(candidate => ({ ...candidate,
    shadow: { ...candidate.shadow, rank: 1 } })) } }, 'anchor-pool-mismatch');
  // A later real observation boundary does not claim the old request was consumed prospectively.
  expect(evaluateOrdinalPair(input)).toMatchObject({ historicalFeatureEligible: false, commitVisibility: 'unknown' });
  const subMillisecond = { ...input, anchor: { ...input.anchor, frozenAt: 99.999 },
    left: { ...input.left, openedAt: 100.001 } };
  expect(evaluateOrdinalPair(subMillisecond).status).toBe('comparable');
  reason({ ...subMillisecond, anchor: { ...subMillisecond.anchor, frozenAt: 100.002 } }, 'anchor-late');
});
it('does not admit corrections whose response or frozen capture became available after evaluation', () => {
  const input = fixture();
  reason(observationChange(input, { availableAt: 701 }), 'future-observation');
  reason({ ...input, right: { ...input.right, capture: { ...input.right.capture, revision: 6, availableAt: 701 } } }, 'capture-unavailable');
  reason(observationChange(input, { provenance: { ...input.left.responses[0]!.observation!.provenance, revision: 6 } }), 'unsupported-provenance');
  const corrected = values(input, 'left', [0, 0, 0]);
  expect(evaluateOrdinalPair(corrected).observedOrder).toBe('right-dominates');
  expect(evaluateOrdinalPair(input).observedOrder).toBe('left-dominates');
});
it('fails incompatible targets, scales, unauthorized scopes and malformed provenance closed', () => {
  const input = fixture();
  reason(observationChange(input, { targetVersion: 'unsupported' }), 'incompatible-target');
  reason(observationChange(input, { raw: { value: 0, scale: { min: 1, max: 5 } } }), 'incompatible-scale');
  reason(observationChange(input, { measurement: { status: 'observed', value: NaN } }), 'incompatible-scale');
  reason(observationChange(input, { actingIdentityRef: 'another-actor' }), 'unauthorized-observation');
  reason(observationChange(input, { access: { kind: 'subject', subjectId: 'another-group' } }), 'unauthorized-observation');
  reason(observationChange(input, { actionId: 'another-experience' }), 'unauthorized-observation');
  reason(observationChange(input, { provenance: { origin: 'synthetic', source, recordId: '', revision: 1 } }), 'unsupported-provenance');
  reason({ ...input, scope: { ...input.scope, evidence: { ...input.scope.evidence, synthetic: 'exclude' } } }, 'synthetic-excluded');
  reason({ ...input, target: { ...input.target, exposure: 'not-required' } }, 'unsupported-target');
  reason({ ...input, evaluationAsOf: Infinity }, 'malformed-input');
  const invalidPolicy = { ...input, scope: { ...input.scope, evidence: { ...input.scope.evidence, synthetic: 'yes' } } };
  reason(invalidPolicy as unknown as OrdinalPairInput, 'malformed-input');
  reason({ ...input, anchor: null } as unknown as OrdinalPairInput, 'malformed-input');
  reason(null as unknown as OrdinalPairInput, 'malformed-input');
  expect(evaluateOrdinalPair(null as unknown as OrdinalPairInput)).toMatchObject({ subjectRef: null, target: null,
    evaluationAsOf: null, experiences: { left: null, right: null } });
  const targetWithExtraFunction = { ...input.target, extraExecutable: () => 1 };
  expect(evaluateOrdinalPair({ ...input, target: targetWithExtraFunction }).target).toEqual(input.target);
  expect(evaluateOrdinalPair({ ...input, target: { ...targetWithExtraFunction, version: '' } }).target).toBe(null);
});
it('rejects reused observations and mixed generated/observed outcomes while retaining generated provenance', () => {
  const input = fixture(), first = input.left.responses[0]!.observation!;
  reason({ ...input, right: { ...input.right, responses: [{ ...input.right.responses[0]!, observation: {
    ...input.right.responses[0]!.observation!, provenance: first.provenance,
  } }, ...input.right.responses.slice(1)] } }, 'duplicate-identity');
  // This deliberately invalid observed-shaped record tests refusal only; it is not evidence.
  const observedBoundary = { ...input, left: { ...input.left, capture: { ...input.left.capture,
    availabilityBasis: 'observed-comparison-time' as const } } };
  const mixed = observationChange(observedBoundary, { provenance: { origin: 'observed', source: { kind: 'native', id: source.id },
    recordId: first.provenance.recordId, revision: first.provenance.revision } });
  reason(mixed, 'mixed-provenance');
  expect(evaluateOrdinalPair(input).actors.every(actor => actor.left!.origin === 'synthetic' && actor.right!.origin === 'synthetic')).toBe(true);
});
it('counts non-overlapping pair units separately from member count and refuses duplicate pseudo-samples', () => {
  const input = fixture(), report = evaluateOrdinalBatch([input, fixture('maintenance', 'minimize')]);
  expect(report).toMatchObject({ comparablePairUnits: 2, unscoredPairUnits: 0, observed: { pairUnits: 0 },
    synthetic: { pairUnits: 2, production: { agreement: 1, tie: 0, disagreement: 1 },
      shadow: { agreement: 1, tie: 0, disagreement: 1 } }, independence: 'not-established', uncertainty: 'unavailable', learnable: false });
  expect(() => evaluateOrdinalBatch([input, input])).toThrow('reuses');
  const reusedRound = { ...fixture('maintenance'), pairId: 'another', scope: input.scope,
    left: { ...fixture('maintenance').left, roundId: input.left.roundId } };
  expect(() => evaluateOrdinalBatch([input, reusedRound])).toThrow('reuses');
  const relabeled = { ...fixture('maintenance'), left: { ...fixture('maintenance').left, roundId: input.left.roundId } };
  expect(() => evaluateOrdinalBatch([input, relabeled])).toThrow('reuses');
  const reversed = { ...input, pairId: 'reversed', left: { ...input.right, roundId: 'new-round-a', experienceId: 'new-exp-a' },
    right: { ...input.left, roundId: 'new-round-b', experienceId: 'new-exp-b' } };
  expect(() => evaluateOrdinalBatch([input, reversed])).toThrow('unordered object');
  expect(() => evaluateOrdinalBatch(Array.from({ length: 257 }, () => input))).toThrow('256');
  expect(evaluateOrdinalBatch([])).toMatchObject({ comparablePairUnits: 0, observed: { pairUnits: 0 }, synthetic: { pairUnits: 0 } });
  expect(evaluateOrdinalBatch([{ ...input, right: { ...input.right, experienceId: input.left.experienceId } }]))
    .toMatchObject({ unscoredPairUnits: 1 });
});
it('admits complete two-member and bounded 32-member rosters as one unit, rejecting a 33rd member', () => {
  const input = fixture();
  const two = { ...input, left: { ...input.left, participants: participants.slice(0, 2), responses: input.left.responses.slice(0, 2) },
    right: { ...input.right, participants: participants.slice(0, 2), responses: input.right.responses.slice(0, 2) } };
  expect(evaluateOrdinalPair(two)).toMatchObject({ status: 'comparable', syntheticPairCount: 1 });
  const expanded = (size: number): OrdinalPairInput => {
    const roster = Array.from({ length: size }, (_, index) => ({ actorId: `member-${index}`, enrollmentId: `generation-${index}` }));
    const round = (original: OrdinalRound, value: number): OrdinalRound => ({ ...original, participants: roster,
      capture: { ...original.capture, revision: 40 }, responses: roster.map((participant, index) => ({ ...participant, status: 'rated',
        observation: { ...original.responses[0]!.observation!, actingIdentityRef: participant.actorId,
          measurement: { status: 'observed', value }, raw: { ...original.responses[0]!.observation!.raw, value },
          predictionId: `${original.roundId}:${participant.actorId}:own`,
          provenance: { origin: 'synthetic', source, recordId: `${original.roundId}:response-${index}`, revision: index + 2 } } })) });
    return { ...input, scope: { ...input.scope, actingIdentityRef: roster[0]!.actorId },
      anchor: { ...input.anchor, actorId: roster[0]!.actorId }, left: round(input.left, 0), right: round(input.right, 1) };
  };
  const maximum = evaluateOrdinalPair(expanded(32));
  expect(maximum).toMatchObject({ status: 'comparable', observedOrder: 'right-dominates', observedPairCount: 0, syntheticPairCount: 1 });
  expect(maximum.actors).toHaveLength(32); expect(maximum.actors.every(actor => actor.direction === 'right')).toBe(true);
  reason(expanded(33), 'budget-exceeded');
});
