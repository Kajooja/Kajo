import { describe, expect, expectTypeOf, it } from 'vitest';
import { choose, compare, learn, predict, recall, represent } from '../src/index.js';
import type { ActionBranch, ModelChallenger, Observation, Scenario, StateHypothesis } from '../src/index.js';
import { createKajoAdapter } from '../src/adapters/kajo.js';
import { fixtureArtifact, fixtureBudget, runFixtures, runMediaFixture } from '../src/fixtures/cycles.js';

// Native-shaped, invented records test mapping; they are not real device evidence.
function setup() {
  const adapter = createKajoAdapter();
  const scope = adapter.encodeScope({ profile: { id: 'p', type: 'PERSONAL', ownerUserId: 'u' }, user: { id: 'u' }, sessionId: 's' });
  const actions = adapter.enumerateActions(['a', 'b'].map(id => adapter.encodeObject({
    item: { id, itemType: id === 'a' ? 'MOVIE' : 'BOOK' }, features: { pace: 0.5 }, availableAt: 0, artifact: fixtureArtifact,
  })));
  const constraints = adapter.defineHardConstraints(actions, []);
  const observation = (id: string, value: number | null, at: number, changes: Partial<Observation> = {}): Observation => ({
    ...adapter.interpretObservation({ eventId: id, revision: 1, profileId: 'p', actorUserId: 'u', itemId: 'a', rating: value,
      occurredAt: at, availableAt: at, actionId: 'recommend:a', predictionRunId: null, exposureVerified: true }), ...changes,
  });
  const prefix = [observation('one', 6, 10), observation('two', 8, 20)];
  const state = (observations = prefix, asOf = 30, currentScope = scope) => represent({
    scope: currentScope, observations, asOf, artifact: fixtureArtifact, target: adapter.target,
  });
  const forecast = (memory: readonly Scenario[] = [], asOf = 30) => predict({ id: `prediction-${asOf}`,
    state: state(prefix, asOf), actions, constraints, model: fixtureArtifact,
    horizon: { startAt: asOf, endAt: asOf + 20 }, memory, budget: fixtureBudget,
  });
  return { adapter, scope, actions, constraints, observation, prefix, state, forecast };
}

describe('portable contracts and executable cycles', () => {
  it('runs the same cycle for media and a synthetic non-media machine', () => {
    expect(runFixtures()).toEqual([
      { subjectKind: 'individual', data: 'synthetic-fixture-only', firstEstimate: 7,
        comparison: { absoluteError: 2, evidence: 'synthetic' }, nextEstimate: 9, recall: 'matched', observedEvaluationCount: 0 },
      { subjectKind: 'system', data: 'synthetic-fixture-only', firstEstimate: 50,
        comparison: { absoluteError: 5, evidence: 'synthetic' }, nextEstimate: 45, recall: 'matched', observedEvaluationCount: 0 },
    ]);
    expect(runFixtures()).toEqual(runFixtures());
  });

  it('keeps present-state hypotheses, action alternatives, outcomes and challengers distinct', () => {
    const prediction = runMediaFixture().before;
    const branch = prediction.branches[0];
    expect(branch?.kind).toBe('action-branch');
    expect(branch?.outcome.kind).toBe('outcome-branch');
    expect(prediction.state.hypotheses[0]?.probability).toBeNull();
    expectTypeOf<ActionBranch>().not.toMatchTypeOf<StateHypothesis>();
    expectTypeOf<ModelChallenger>().not.toMatchTypeOf<ActionBranch>();
    expectTypeOf<StateHypothesis>().not.toMatchTypeOf<ModelChallenger>();
  });

  it('maps SharedProfile to its own subject without importing member Personal history', () => {
    const x = setup();
    const shared = x.adapter.encodeScope({ profile: { id: 'group', type: 'SHARED', memberUserIds: ['u', 'v'] },
      user: { id: 'u' }, sessionId: 'shared-session' });
    expect(shared.subject).toEqual({ id: 'group', kind: 'group' });
    expect(shared.actingIdentityRef).toBe('u');
    expect(x.state(x.prefix, 30, shared).prefix).toEqual([]);
    expect(() => x.adapter.encodeScope({ profile: { id: 'group', type: 'SHARED', memberUserIds: ['v'] },
      user: { id: 'u' }, sessionId: 's' })).toThrow('outside');
  });

  it('keeps missing, zero and raw scale separate and rejects invalid Kajo ratings', () => {
    const x = setup();
    const state = x.state([x.observation('zero', 0, 10), x.observation('missing', null, 20)]);
    expect(state.longTermMean).toBe(0);
    expect(state.prefix[1]?.raw).toEqual({ value: null, scale: { min: 0, max: 10 } });
    expect(x.state([x.observation('unknown', null, 10)]).longTermMean).toBeNull();
    expect(() => x.observation('bad', 2.5, 10)).toThrow('integer');
    expect(() => x.state([x.observation('bad', 2, 10, { raw: { value: 20, scale: { min: 0, max: 10 } } })])).toThrow('Raw value');
  });
});

describe('available prefix and source boundaries', () => {
  it('excludes future occurrence and late availability without changing an earlier state', () => {
    const x = setup();
    const future = x.observation('future', 0, 40);
    const late = x.observation('late', 0, 15, { availableAt: 40 });
    expect(x.state([...x.prefix, future, late])).toEqual(x.state());
    expect(x.state([...x.prefix, future, late], 50).longTermMean).toBe(3.5);
  });

  it('deduplicates available revisions, applies a later correction only later, and retains unknown', () => {
    const x = setup(); const first = x.prefix[0]!;
    const correction = x.observation('one', null, 10, { availableAt: 40, provenance: { ...first.provenance, revision: 2 } });
    expect(x.state([first, first, correction]).longTermMean).toBe(6);
    expect(x.state([first, correction], 50).longTermMean).toBeNull();
    expect(() => x.state([first, { ...first, measurement: { status: 'observed', value: 0 } }])).toThrow('Conflicting');
  });

  it('rejects later-trained artifacts, later features and incompatible representations', () => {
    const x = setup();
    expect(() => represent({ scope: x.scope, observations: [], target: x.adapter.target, asOf: 30,
      artifact: { ...fixtureArtifact, availableAt: 40, trainedThrough: 35 } })).toThrow('unavailable');
    expect(() => represent({ scope: x.scope, observations: [], target: x.adapter.target, asOf: 30,
      artifact: { ...fixtureArtifact, trainedThrough: 35 } })).toThrow('training cutoff');
    const attempt = (action = x.actions[0]!, model = fixtureArtifact) => predict({ id: 'p', state: x.state(), actions: [action],
      constraints: x.constraints, model, horizon: { startAt: 30, endAt: 50 }, memory: [], budget: fixtureBudget });
    const first = x.actions[0]!;
    expect(() => attempt({ ...first, object: { ...first.object, availableAt: 31 } })).toThrow('Object unavailable');
    expect(() => attempt({ ...first, object: { ...first.object, artifact: { ...fixtureArtifact, availableAt: 31 } } })).toThrow('Artifact unavailable');
    expect(() => attempt(first, { ...fixtureArtifact, representationVersion: 'incompatible' })).toThrow('Incompatible');
  });

  it('rejects a stored state with a forged summary or a leaked future prefix', () => {
    const x = setup();
    for (const state of [{ ...x.state(), longTermMean: 0 },
      { ...x.state(), prefix: [...x.prefix, x.observation('future', 0, 40)] }]) {
      expect(() => predict({ id: 'p', state, actions: x.actions, constraints: x.constraints,
        model: fixtureArtifact, horizon: { startAt: 30, endAt: 50 }, memory: [], budget: fixtureBudget })).toThrow('available prefix');
    }
  });

  it('requires explicit external source admission and preserves release, raw scale and unknown exposure', () => {
    const x = setup();
    const external = x.observation('external', 8, 10, {
      provenance: { origin: 'observed', source: { kind: 'external', id: 'research:example:r1', release: 'r1',
        manifestId: 'manifest-r1', availability: 'assumed-at-occurrence' }, recordId: 'ratings/1', revision: 1 },
      raw: { value: 4, scale: { min: 0.5, max: 5 } }, actionId: null, predictionId: null, exposure: 'unknown',
    });
    expect(x.state([external]).prefix).toEqual([]);
    const externalScope = { ...x.scope, evidence: { ...x.scope.evidence, sourceIds: ['research:example:r1'] } };
    const state = x.state([external], 30, externalScope);
    expect(state.prefix[0]?.raw.value).toBe(4);
    expect(state.prefix[0]?.actionId).toBeNull();
    expect(state.prefix[0]?.exposure).toBe('unknown');
    const prediction = predict({ id: 'external-research', state, actions: x.actions, constraints: x.constraints,
      model: fixtureArtifact, horizon: { startAt: 30, endAt: 50 }, memory: [], budget: fixtureBudget });
    expect(prediction.branches[0]?.outcome.estimate.support).toEqual({ native: 0, external: 1, synthetic: 0 });
  });

  it('excludes synthetic evidence by default even when its source is listed', () => {
    const x = setup(); const synthetic = runMediaFixture().memory.outcome;
    const adapted = { ...synthetic, subjectId: 'p', access: { kind: 'subject' as const, subjectId: 'p' }, occurredAt: 10, availableAt: 10 };
    const scope = { ...x.scope, evidence: { ...x.scope.evidence, sourceIds: ['media-fixture'] } };
    expect(x.state([adapted], 30, scope).prefix).toEqual([]);
  });
});

describe('frozen forecasts, policy and evaluation', () => {
  it('freezes independent copies including original numeric estimates and eligibility', () => {
    const x = setup(); const prediction = x.forecast(); const serialized = JSON.stringify(prediction);
    const changed = structuredClone(x.prefix);
    changed[0] = x.observation('one', 0, 10);
    expect(x.state(changed).longTermMean).toBe(4);
    expect(() => Object.assign(prediction.branches[0]!.outcome.estimate, { value: 0 })).toThrow();
    expect(() => Object.assign(prediction.state.prefix[0]!.raw.scale, { min: -1 })).toThrow();
    learn(prediction, 'recommend:a', x.observation('later', 9, 40), 50);
    expect(JSON.stringify(prediction)).toBe(serialized);
  });

  it('enforces original hard constraints and current exclusions at choice', () => {
    const x = setup();
    const prediction = predict({ id: 'constrained', state: x.state(), actions: x.actions,
      constraints: x.adapter.defineHardConstraints(x.actions, ['a']), model: fixtureArtifact,
      horizon: { startAt: 30, endAt: 50 }, memory: [], budget: fixtureBudget });
    expect(prediction.branches.map(b => b.action.object.id)).toEqual(['b']);
    expect(choose(prediction, x.constraints)).toBe('recommend:b');
    expect(choose(prediction, { version: 'changed', allowedActionIds: ['recommend:a'] })).toBeNull();
    expect(() => compare(prediction, 'recommend:a', null, 50)).toThrow('not an eligible');
  });

  it('abstains when no supported estimate exists instead of inventing certainty', () => {
    const x = setup();
    const prediction = predict({ id: 'cold', state: x.state([]), actions: x.actions, constraints: x.constraints,
      model: fixtureArtifact, horizon: { startAt: 30, endAt: 50 }, memory: [], budget: fixtureBudget });
    expect(choose(prediction, x.constraints)).toBeNull();
    expect(prediction.branches[0]?.outcome.estimate).toMatchObject({ value: null, calibration: 'uncalibrated', uncertainty: 'unavailable' });
  });

  it.each(['unknown', 'unexposed', 'censored', 'immature'] as const)('does not score a %s label as negative', reason => {
    const x = setup(); const outcome = x.observation('missing', null, 40, { measurement: { status: 'missing', reason } });
    expect(compare(x.forecast(), 'recommend:a', outcome, 50)).toEqual({ kind: 'unscored', reason });
    expect(learn(x.forecast(), 'recommend:a', outcome, 50)).toBeNull();
  });

  it('scores an observed zero against the original value, without scoring the unchosen action', () => {
    const x = setup(); const outcome = x.observation('later', 0, 40);
    expect(compare(x.forecast(), 'recommend:a', outcome, 50)).toMatchObject({ kind: 'scored', signedError: -7, absoluteError: 7, evidence: 'native' });
    expect(compare(x.forecast(), 'recommend:b', outcome, 50).kind).toBe('unscored');
    expect(compare(x.forecast(), 'recommend:a', { ...outcome, actionId: 'different-action' }, 50))
      .toEqual({ kind: 'unscored', reason: 'unobserved-action' });
    expect(compare(x.forecast(), 'recommend:a', { ...outcome, predictionId: 'different-prediction' }, 50).kind).toBe('unscored');
  });

  it('checks subject, target, exposure, availability and the open/closed horizon edges', () => {
    const x = setup(); const prediction = x.forecast();
    const cases: Partial<Observation>[] = [
      { subjectId: 'someone-else' }, { targetVersion: 'future' }, { exposure: 'unknown' },
      { availableAt: 60 }, { occurredAt: 30 }, { occurredAt: 51, availableAt: 51 },
    ];
    for (const changes of cases) expect(compare(prediction, 'recommend:a', x.observation('later', 9, 40, changes), 50).kind).toBe('unscored');
    expect(compare(prediction, 'recommend:a', x.observation('edge', 9, 50), 50).kind).toBe('scored');
    expect(compare(prediction, 'recommend:a', null, 50)).toEqual({ kind: 'unscored', reason: 'missing-outcome' });
  });
});

describe('prefix retrieval and rebuildable memory', () => {
  it('returns no useful match when none is eligible, enforces budgets and deduplicates replay', () => {
    const x = setup(); const prediction = x.forecast(); const outcome = x.observation('later', 9, 40);
    const memory = learn(prediction, 'recommend:a', outcome, 50)!;
    expect(learn(prediction, 'recommend:a', outcome, 50)).toEqual(memory);
    const next = x.forecast([memory, { ...memory, id: 'replayed-copy' }], 60);
    expect(next.branches[0]?.outcome.estimate.support.native).toBe(1);
    expect(x.forecast([{ ...memory, availableAt: 61 }], 60).branches[0]?.recall.status).toBe('no-useful-match');
    const request = { state: x.state(x.prefix, 60), action: x.actions[0]!, horizon: { startAt: 60, endAt: 80 }, memory: [memory], budget: fixtureBudget };
    expect(() => recall({ ...request, budget: { ...fixtureBudget, maxScanned: 0 } })).toThrow('budget');
    expect(recall({ ...request, budget: { ...fixtureBudget, topK: 0 } }).status).toBe('no-useful-match');
    expect(recall({ ...request, state: x.state([x.observation('opposite', 0, 10)], 60),
      budget: { ...fixtureBudget, maxDistance: 0 } }).status).toBe('no-useful-match');
  });

  it('filters private/cohort and source records before top-K so they cannot crowd out permitted memory', () => {
    const x = setup(); const memory = learn(x.forecast(), 'recommend:a', x.observation('later', 9, 40), 50)!;
    const foreign = { ...memory, id: 'a-private', access: { kind: 'subject' as const, subjectId: 'other' } };
    const cohort = { ...memory, id: 'b-cohort', access: { kind: 'cohort' as const, cohortId: 'unadmitted' } };
    const recalled = recall({ state: x.state(x.prefix, 60), action: x.actions[0]!, horizon: { startAt: 60, endAt: 80 },
      memory: [foreign, cohort, memory], budget: { ...fixtureBudget, topK: 1 } });
    expect(recalled.matches.map(m => m.scenarioId)).toEqual([memory.id]);
  });

  it('does not use a future continuation or its label/error in the similarity key', () => {
    const x = setup(); const prediction = x.forecast();
    const make = (value: number) => learn(prediction, 'recommend:a', x.observation('later', value, 40), 50)!;
    const a = x.forecast([make(0)], 60).branches[0]!;
    const b = x.forecast([make(10)], 60).branches[0]!;
    expect(a.recall.matches[0]?.distance).toBe(b.recall.matches[0]?.distance);
    expect(a.outcome.estimate.value).toBe(0); expect(b.outcome.estimate.value).toBe(10);
    expect(x.forecast([make(9)], 45).branches[0]?.recall.status).toBe('no-useful-match');
    const missing = { ...make(9), outcome: x.observation('missing', null, 40) };
    expect(x.forecast([missing], 60).branches[0]?.recall.status).toBe('no-useful-match');
  });

  it('uses the latest available correction once rather than a more similar obsolete label', () => {
    const x = setup(); const prediction = x.forecast(); const outcome = x.observation('later', 9, 40);
    const first = learn(prediction, 'recommend:a', outcome, 50)!;
    const correction = learn(prediction, 'recommend:a', { ...outcome, measurement: { status: 'observed', value: 2 },
      raw: { value: 2, scale: { min: 0, max: 10 } }, availableAt: 55, provenance: { ...outcome.provenance, revision: 2 } }, 55)!;
    expect(x.forecast([first, correction], 60).branches[0]?.outcome.estimate.value).toBe(2);
  });
});
