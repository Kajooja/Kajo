import type {
  Action, ArtifactVersion, Comparison, Estimate, FrozenPrediction, HardConstraints,
  Horizon, Observation, PredictionScope, Provenance, RecallResult, RetrievalBudget,
  Scenario, State, TargetDefinition, AccessScope,
} from './contracts.js';

// This bounded reference estimator proves contracts; it is not the Kajo SQL scorer.
const MAX_RECORDS = 10_000;
const RECENT_LENGTH = 3;

function requireContract(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function instant(value: number): void {
  requireContract(Number.isSafeInteger(value) && value >= 0, 'Invalid instant');
}

function frozen<T>(value: T): T {
  const copy = structuredClone(value);
  const visit = (node: unknown): void => {
    if (node && typeof node === 'object') {
      Object.values(node).forEach(visit);
      Object.freeze(node);
    }
  };
  visit(copy);
  return copy;
}

function validTarget(target: TargetDefinition): void {
  requireContract(Boolean(target.id && target.version), 'Target identity is required');
  requireContract(Number.isFinite(target.scale.min) && Number.isFinite(target.scale.max)
    && target.scale.max > target.scale.min, 'Invalid target scale');
}

function validArtifact(artifact: ArtifactVersion, asOf: number, representation?: string): void {
  instant(artifact.availableAt);
  requireContract(Boolean(artifact.id && artifact.version && artifact.representationVersion), 'Artifact identity is required');
  requireContract(artifact.availableAt <= asOf, 'Artifact unavailable at decision');
  if (artifact.trainedThrough !== null) {
    instant(artifact.trainedThrough);
    requireContract(artifact.trainedThrough <= artifact.availableAt, 'Artifact training cutoff follows availability');
  }
  if (representation !== undefined) {
    requireContract(artifact.representationVersion === representation, 'Incompatible representation');
  }
}

function recordKey(provenance: Provenance): string {
  return JSON.stringify([provenance.origin, provenance.source.kind, provenance.source.id,
    provenance.source.kind === 'external' ? provenance.source.release : null, provenance.recordId]);
}

function recordRef(observation: Observation): string {
  return `${recordKey(observation.provenance)}:${observation.provenance.revision}`;
}

function channel(observation: Observation): 'native' | 'external' | 'synthetic' {
  return observation.provenance.origin === 'synthetic' ? 'synthetic'
    : observation.provenance.source.kind === 'external' ? 'external' : 'native';
}

function canRead(access: AccessScope, scope: PredictionScope): boolean {
  return access.kind === 'subject' ? access.subjectId === scope.subject.id
    : scope.evidence.cohortIds.includes(access.cohortId);
}

function admitted(observation: Observation, scope: PredictionScope): boolean {
  return canRead(observation.access, scope)
    && scope.evidence.sourceIds.includes(observation.provenance.source.id)
    && (observation.provenance.origin !== 'synthetic' || scope.evidence.synthetic === 'fixture-only');
}

function validObservation(observation: Observation, target: TargetDefinition): void {
  instant(observation.occurredAt);
  instant(observation.availableAt);
  requireContract(observation.availableAt >= observation.occurredAt, 'Observation available before occurrence');
  const provenance = observation.provenance;
  requireContract(Boolean(provenance.recordId && provenance.source.id)
    && Number.isSafeInteger(provenance.revision) && provenance.revision > 0, 'Invalid source record');
  if (provenance.source.kind === 'external') {
    requireContract(Boolean(provenance.source.release && provenance.source.manifestId), 'External release and manifest required');
  }
  if (provenance.source.kind === 'generator') {
    requireContract(Boolean(provenance.source.version), 'Generator version required');
  }
  const { min, max } = observation.raw.scale;
  requireContract(Number.isFinite(min) && Number.isFinite(max) && max > min, 'Invalid raw scale');
  const raw = observation.raw.value;
  requireContract(raw === null || (Number.isFinite(raw) && raw >= min && raw <= max), 'Raw value outside declared scale');
  if (observation.measurement.status === 'observed') {
    const value = observation.measurement.value;
    requireContract(Number.isFinite(value) && value >= target.scale.min && value <= target.scale.max,
      'Measurement outside target scale');
  }
}

function sameTarget(observation: Observation, target: TargetDefinition): boolean {
  return observation.targetId === target.id && observation.targetVersion === target.version;
}

function mean(observations: readonly Observation[]): number | null {
  const values = observations.flatMap(o => o.measurement.status === 'observed' ? [o.measurement.value] : []);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function represent(input: {
  scope: PredictionScope; observations: readonly Observation[]; target: TargetDefinition;
  asOf: number; artifact: ArtifactVersion;
}): State {
  const { scope, target, asOf, artifact } = input;
  instant(asOf);
  validTarget(target);
  validArtifact(artifact, asOf);
  requireContract(Boolean(scope.subject.id && scope.sessionRef), 'Subject and session required');
  requireContract(input.observations.length <= MAX_RECORDS, 'Observation budget exceeded');
  const latest = new Map<string, Observation>();
  for (const observation of input.observations) {
    // Scope/source/time filtering precedes selection or summary statistics.
    if (observation.subjectId !== scope.subject.id || !admitted(observation, scope)
      || !sameTarget(observation, target) || observation.occurredAt > asOf || observation.availableAt > asOf) continue;
    validObservation(observation, target);
    const key = recordKey(observation.provenance);
    const prior = latest.get(key);
    if (prior?.provenance.revision === observation.provenance.revision) {
      requireContract(JSON.stringify(prior) === JSON.stringify(observation), 'Conflicting source revision');
    }
    if (!prior || observation.provenance.revision > prior.provenance.revision) latest.set(key, observation);
  }
  const prefix = [...latest.values()].sort((a, b) => a.occurredAt - b.occurredAt
    || a.availableAt - b.availableAt || recordRef(a).localeCompare(recordRef(b), 'en'));
  return frozen({
    kind: 'state', scope, asOf, target, artifact, prefix,
    longTermMean: mean(prefix), recentMean: mean(prefix.slice(-RECENT_LENGTH)),
    hypotheses: [{ kind: 'state-hypothesis', id: 'unresolved-intent-v1',
      interpretation: 'Recent observations do not identify durable preference versus temporary intent.',
      supportRefs: prefix.map(recordRef), probability: null }],
  });
}

function checkedState(state: State): void {
  // Do not trust precomputed summaries/prefixes supplied by a caller or storage port.
  const rebuilt = represent({ scope: state.scope, observations: state.prefix, target: state.target,
    asOf: state.asOf, artifact: state.artifact });
  requireContract(JSON.stringify(rebuilt) === JSON.stringify(state), 'State does not match its available prefix');
}

function validAction(action: Action, state: State): void {
  requireContract(Boolean(action.id && action.kind && action.object.id), 'Action identity required');
  instant(action.object.availableAt);
  requireContract(action.object.availableAt <= state.asOf, 'Object unavailable at decision');
  validArtifact(action.object.artifact, state.asOf, state.artifact.representationVersion);
  requireContract(Object.values(action.object.features).every(v => v === null || Number.isFinite(v)), 'Invalid object feature');
}

function distance(current: State, prior: State, action: Action, priorAction: Action): number {
  const values = (state: State) => state.prefix.slice(-RECENT_LENGTH)
    .map(o => o.measurement.status === 'observed' ? o.measurement.value : null);
  const a = values(current);
  const b = values(prior);
  const count = Math.min(a.length, b.length);
  if (!count || current.longTermMean === null || prior.longTermMean === null) return Infinity;
  let total = Math.abs(current.longTermMean - prior.longTermMean) / (current.target.scale.max - current.target.scale.min);
  let dimensions = 1;
  for (let i = 1; i <= count; i++) {
    const x = a[a.length - i]; const y = b[b.length - i];
    if (x != null && y != null) {
      total += Math.abs(x - y) / (current.target.scale.max - current.target.scale.min);
      dimensions++;
    }
  }
  // Only frozen BEFORE/action features enter the key; never Outcome/After/Error.
  for (const key of Object.keys(action.object.features).sort()) {
    const x = action.object.features[key]; const y = priorAction.object.features[key];
    if (x != null && y != null) { total += Math.abs(x - y); dimensions++; }
  }
  return total / dimensions;
}

export function recall(input: {
  state: State; action: Action; horizon: Horizon; memory: readonly Scenario[]; budget: RetrievalBudget;
}): RecallResult {
  const { state, action, horizon, budget } = input;
  checkedState(state);
  validAction(action, state);
  requireContract(Number.isSafeInteger(budget.maxScanned) && budget.maxScanned >= 0
    && budget.maxScanned <= MAX_RECORDS && input.memory.length <= budget.maxScanned, 'Memory scan budget exceeded');
  requireContract(Number.isSafeInteger(budget.topK) && budget.topK >= 0 && budget.topK <= 100
    && Number.isFinite(budget.maxDistance) && budget.maxDistance >= 0, 'Invalid retrieval budget');
  const latestRevisions = new Map<string, number>();
  for (const scenario of input.memory) {
    const outcome = scenario.outcome;
    if (!canRead(scenario.access, state.scope) || !admitted(outcome, state.scope)
      || scenario.availableAt > state.asOf || outcome.availableAt > state.asOf
      || outcome.occurredAt > state.asOf || !sameTarget(outcome, state.target)) continue;
    validObservation(outcome, state.target);
    const key = recordKey(outcome.provenance);
    latestRevisions.set(key, Math.max(latestRevisions.get(key) ?? 0, outcome.provenance.revision));
  }
  const candidates: RecallResult['matches'][number][] = [];
  for (const scenario of input.memory) {
    if (!canRead(scenario.access, state.scope) || !admitted(scenario.outcome, state.scope)
      || scenario.availableAt > state.asOf || scenario.prediction.state.asOf >= state.asOf
      || scenario.prediction.state.artifact.representationVersion !== state.artifact.representationVersion
      || JSON.stringify(scenario.prediction.state.target) !== JSON.stringify(state.target)
      || scenario.prediction.state.prefix.some(o => !admitted(o, state.scope))
      || scenario.outcome.provenance.revision !== latestRevisions.get(recordKey(scenario.outcome.provenance))) continue;
    const priorBranch = scenario.prediction.branches.find(b => b.action.id === scenario.actionId);
    if (!priorBranch || priorBranch.action.kind !== action.kind
      || priorBranch.outcome.horizon.endAt - priorBranch.outcome.horizon.startAt !== horizon.endAt - horizon.startAt) continue;
    checkedState(scenario.prediction.state);
    validAction(priorBranch.action, scenario.prediction.state);
    const comparison = compare(scenario.prediction, scenario.actionId, scenario.outcome,
      Math.min(state.asOf, scenario.availableAt));
    if (comparison.kind !== 'scored') continue;
    const difference = distance(state, scenario.prediction.state, action, priorBranch.action);
    if (difference <= budget.maxDistance) candidates.push({ scenarioId: scenario.id, distance: difference, outcome: scenario.outcome });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.scenarioId.localeCompare(b.scenarioId, 'en'));
  // Replaying the same observed label cannot increase independent support.
  const seen = new Set<string>();
  const unique = candidates.filter(candidate => {
    const key = recordKey(candidate.outcome.provenance);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const matches = unique.slice(0, budget.topK);
  return frozen({ status: matches.length ? 'matched' : 'no-useful-match', matches });
}

function estimate(state: State, recalled: RecallResult): Estimate {
  const observations = recalled.matches.length ? recalled.matches.map(m => m.outcome) : state.prefix;
  const support = { native: 0, external: 0, synthetic: 0 };
  for (const observation of observations) if (observation.measurement.status === 'observed') support[channel(observation)]++;
  return { value: mean(observations), kind: 'numeric-estimate', calibration: 'uncalibrated', uncertainty: 'unavailable',
    method: recalled.matches.length ? 'recalled-mean' : mean(observations) === null ? 'unavailable' : 'prefix-mean', support };
}

export function predict(input: {
  id: string; state: State; actions: readonly Action[]; constraints: HardConstraints;
  model: ArtifactVersion; horizon: Horizon; memory: readonly Scenario[]; budget: RetrievalBudget;
}): FrozenPrediction {
  const { state, model, horizon } = input;
  checkedState(state);
  validArtifact(model, state.asOf, state.artifact.representationVersion);
  instant(horizon.startAt); instant(horizon.endAt);
  requireContract(horizon.startAt === state.asOf && horizon.endAt > horizon.startAt, 'Invalid forecast horizon');
  requireContract(Boolean(input.id && input.constraints.version) && input.actions.length <= 100, 'Invalid prediction identity/budget');
  requireContract(new Set(input.actions.map(a => a.id)).size === input.actions.length, 'Duplicate action identity');
  const eligible = input.actions.filter(a => input.constraints.allowedActionIds.includes(a.id));
  const branches = eligible.map(action => {
    validAction(action, state);
    const recalled = recall({ state, action, horizon, memory: input.memory, budget: input.budget });
    return { kind: 'action-branch' as const, action, recall: recalled, outcome: {
      kind: 'outcome-branch' as const, target: state.target, horizon, estimate: estimate(state, recalled),
    } };
  });
  return frozen({ id: input.id, kind: 'frozen-prediction', state, model, constraints: input.constraints, branches });
}

/** Policy is separate from prediction. New constraints may remove, never add, actions. */
export function choose(prediction: FrozenPrediction, currentConstraints: HardConstraints): string | null {
  const eligible = prediction.branches.filter(b => prediction.constraints.allowedActionIds.includes(b.action.id)
    && currentConstraints.allowedActionIds.includes(b.action.id) && b.outcome.estimate.value !== null);
  eligible.sort((a, b) => {
    const direction = prediction.state.target.objective === 'maximize' ? -1 : 1;
    return direction * ((a.outcome.estimate.value ?? 0) - (b.outcome.estimate.value ?? 0))
      || a.action.id.localeCompare(b.action.id, 'en');
  });
  return eligible[0]?.action.id ?? null;
}

export function compare(prediction: FrozenPrediction, actionId: string, outcome: Observation | null, asOf: number): Comparison {
  instant(asOf);
  requireContract(asOf >= prediction.state.asOf, 'Evaluation precedes decision');
  const branch = prediction.branches.find(b => b.action.id === actionId);
  requireContract(branch !== undefined, 'Action was not an eligible frozen alternative');
  const unknown = (reason: string): Comparison => frozen({ kind: 'unscored', reason });
  if (!outcome) return unknown('missing-outcome');
  if (outcome.subjectId !== prediction.state.scope.subject.id || !admitted(outcome, prediction.state.scope)) return unknown('scope-or-source');
  if (outcome.objectId !== branch.action.object.id || !sameTarget(outcome, branch.outcome.target)) return unknown('target-mismatch');
  if ((outcome.predictionId !== null && outcome.predictionId !== prediction.id)
    || (branch.outcome.target.conditioning === 'action-outcome' && outcome.actionId !== actionId)) return unknown('unobserved-action');
  validObservation(outcome, branch.outcome.target);
  if (outcome.availableAt > asOf || outcome.occurredAt > asOf) return unknown('not-yet-available');
  if (outcome.occurredAt <= branch.outcome.horizon.startAt || outcome.occurredAt > branch.outcome.horizon.endAt) return unknown('outside-horizon');
  if (outcome.measurement.status !== 'observed') return unknown(outcome.measurement.reason);
  if (branch.outcome.target.exposure === 'required' && outcome.exposure !== 'verified') return unknown('unverified-exposure');
  if (branch.outcome.estimate.value === null) return unknown('prediction-unavailable');
  const signedError = outcome.measurement.value - branch.outcome.estimate.value;
  return frozen({ kind: 'scored', signedError, absoluteError: Math.abs(signedError), evidence: channel(outcome), observation: outcome });
}

/** Return a rebuildable local episode; never overwrite source observations or a forecast. */
export function learn(prediction: FrozenPrediction, actionId: string, outcome: Observation | null, asOf: number): Scenario | null {
  const comparison = compare(prediction, actionId, outcome, asOf);
  if (comparison.kind !== 'scored') return null;
  return frozen({ id: JSON.stringify([prediction.id, actionId, recordRef(comparison.observation)]),
    access: { kind: 'subject', subjectId: prediction.state.scope.subject.id }, availableAt: asOf,
    prediction, actionId, outcome: comparison.observation });
}
