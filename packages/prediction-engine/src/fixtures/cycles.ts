import type { Action, ArtifactVersion, Observation, PredictionScope, TargetDefinition } from '../contracts.js';
import { choose, compare, learn, predict, represent } from '../engine.js';
import { createKajoAdapter } from '../adapters/kajo.js';
import { maintenanceAdapter } from './maintenance.js';

export const fixtureArtifact: ArtifactVersion = {
  id: 'transparent-fixture', version: '1', representationVersion: 'ordered-prefix-v1',
  availableAt: 0, trainedThrough: null, sourceRefs: ['hand-authored-fixtures-v1'], use: 'fixture-only',
};
export const fixtureBudget = { maxScanned: 100, topK: 3, maxDistance: 1 };

function cycle(input: { scope: PredictionScope; target: TargetDefinition; actions: readonly Action[];
  observations: readonly Observation[]; outcome: Observation }) {
  const state = represent({ ...input, artifact: fixtureArtifact, asOf: 30 });
  const constraints = { version: 'fixture-eligible-v1', allowedActionIds: input.actions.map(a => a.id) };
  const before = predict({ id: 'fixture-decision-1', state, actions: input.actions, constraints,
    model: fixtureArtifact, horizon: { startAt: 30, endAt: 50 }, memory: [], budget: fixtureBudget });
  const actionId = choose(before, constraints);
  if (!actionId) throw new Error('Fixture must produce a supported action');
  const outcome = { ...input.outcome, actionId, predictionId: before.id };
  const comparison = compare(before, actionId, outcome, 50);
  const memory = learn(before, actionId, outcome, 50);
  if (!memory) throw new Error('Fixture must learn one explicitly synthetic episode');
  const nextState = represent({ scope: input.scope, target: input.target,
    observations: [...input.observations, outcome], artifact: fixtureArtifact, asOf: 60 });
  const after = predict({ id: 'fixture-decision-2', state: nextState, actions: input.actions, constraints,
    model: fixtureArtifact, horizon: { startAt: 60, endAt: 80 }, memory: [memory], budget: fixtureBudget });
  return { before, actionId, comparison, memory, after };
}

export function runMediaFixture() {
  const adapter = createKajoAdapter({ kind: 'generator', id: 'media-fixture', version: '1', parentRefs: [] });
  const scope = adapter.encodeScope({ profile: { id: 'fixture-profile', type: 'PERSONAL', ownerUserId: 'fixture-user' },
    user: { id: 'fixture-user' }, sessionId: 'fixture-session' });
  const object = adapter.encodeObject({ item: { id: 'fixture-movie', itemType: 'MOVIE' },
    features: { pace: 0.4 }, availableAt: 0, artifact: fixtureArtifact });
  const reading = (id: string, rating: number | null, at: number) => adapter.interpretObservation({ eventId: id,
    revision: 1, profileId: scope.subject.id, actorUserId: 'fixture-user', itemId: object.id,
    rating, occurredAt: at, availableAt: at, actionId: null, predictionRunId: null, exposureVerified: true });
  return cycle({ scope, target: adapter.target, actions: adapter.enumerateActions([object]),
    observations: [reading('first', 6, 10), reading('second', 8, 20)], outcome: reading('later', 9, 40) });
}

export function runMaintenanceFixture() {
  const adapter = maintenanceAdapter;
  const scope = adapter.encodeScope({ machineId: 'fixture-machine', operatorId: 'fixture-operator', sessionId: 'fixture-shift' });
  const object = adapter.encodeObject({ id: 'fixture-configuration', load: 0.5, availableAt: 0, artifact: fixtureArtifact });
  const reading = (id: string, kwh: number | null, at: number) => adapter.interpretObservation({ id,
    machineId: scope.subject.id, operatorId: 'fixture-operator', configurationId: object.id, kwh,
    occurredAt: at, availableAt: at, actionId: null, predictionId: null });
  return cycle({ scope, target: adapter.target, actions: adapter.enumerateActions([object]),
    observations: [reading('first', 40, 10), reading('second', 60, 20)], outcome: reading('later', 45, 40) });
}

export function runFixtures() {
  return [runMediaFixture(), runMaintenanceFixture()].map(result => ({
    subjectKind: result.before.state.scope.subject.kind, data: 'synthetic-fixture-only',
    firstEstimate: result.before.branches[0]?.outcome.estimate.value,
    comparison: result.comparison.kind === 'scored' ? {
      absoluteError: result.comparison.absoluteError, evidence: result.comparison.evidence,
    } : result.comparison,
    nextEstimate: result.after.branches[0]?.outcome.estimate.value,
    recall: result.after.branches[0]?.recall.status,
    observedEvaluationCount: 0,
  }));
}
