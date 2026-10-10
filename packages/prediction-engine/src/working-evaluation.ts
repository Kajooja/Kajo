import type { Horizon, Observation, PredictionObject, PredictionScope, TargetDefinition } from './contracts.js';
import { deriveWorkingState, scoreWorkingAdjustment } from './working-state.js';
import type { WorkingControl, WorkingState } from './working-state.js';

export type WorkingAvailabilityBasis = 'DECLARED_AVAILABLE_TIME' | 'STORED_CREATED_TIME' | 'SYNTHETIC_CLOCK';
export interface WorkingSupportReport {
  readonly contractVersion: 'working-support-v1';
  readonly control: WorkingControl;
  readonly objectId: string;
  readonly reason: 'OFF' | 'INACTIVE_STATE' | 'NO_FEATURE_COVERAGE' | 'SUPPORTED';
  readonly contributingItems: number;
  readonly contributingTimeGroups: number;
  readonly featureCoverage: number;
  readonly weightSum: number;
  readonly squaredWeightSum: number;
  readonly effectiveItems: number;
  readonly coefficients: readonly { readonly objectId: string; readonly weight: number }[];
  readonly interpretation: 'ITEM_WEIGHT_CONCENTRATION_NOT_OUTCOME_SAMPLE_SIZE';
  readonly uncertainty: 'unavailable';
}
export interface WorkingFrozenCandidate {
  readonly objectId: string;
  readonly score: number;
  readonly rank: number;
  readonly eligible: boolean;
  readonly tier: number;
  readonly selected: boolean;
}
export interface WorkingFrozenControl {
  readonly id: string;
  readonly version: string;
  readonly createdAt: number;
  readonly availableAt: number;
  readonly availabilityBasis: WorkingAvailabilityBasis;
  readonly candidates: readonly WorkingFrozenCandidate[];
}
export interface WorkingPlannedPair {
  readonly pairId: string;
  readonly leftObjectId: string;
  readonly rightObjectId: string;
}
/** Opaque adapter provenance; descriptor strings never constitute authorization. */
export interface WorkingSourceBinding {
  readonly kind: string;
  readonly captureRef: string;
  readonly modelVersion: string;
  readonly baseModelVersion: string;
  readonly mode: string;
  readonly objectType: string;
  readonly requestedAt: number;
  readonly storedSourceCreatedAt: number;
  readonly snapshotObservedAt: number;
  readonly commitAvailability: 'UNKNOWN';
  readonly historicalFeatureEligible: false;
}
export interface WorkingEvaluationPlanInput {
  readonly id: string;
  readonly sourcePredictionId: string;
  readonly scope: PredictionScope;
  readonly target: TargetDefinition;
  readonly sourceCutoff: number;
  readonly createdAt: number;
  readonly availableAt: number;
  readonly availabilityBasis: WorkingAvailabilityBasis;
  readonly selectionBasis: 'PREDECLARED_DISJOINT_PAIRS';
  readonly horizon: Horizon;
  readonly versions: { readonly capture: string; readonly features: string; readonly scorer: string; readonly policy: string };
  readonly sourceBinding?: WorkingSourceBinding;
  readonly controls: Readonly<Record<WorkingControl, WorkingFrozenControl>>;
  readonly pairs: readonly WorkingPlannedPair[];
  readonly working: { readonly status: 'available'; readonly state: WorkingState; readonly objects: readonly PredictionObject[] }
    | { readonly status: 'unavailable'; readonly reason: string };
}
export interface WorkingEvaluationPlan extends WorkingEvaluationPlanInput {
  readonly contractVersion: 'working-evaluation-plan-v1';
  readonly support: Readonly<Record<WorkingControl, readonly WorkingSupportReport[]>> | null;
  readonly integrityBasis: 'TRUSTED_CALLER_SNAPSHOT_NOT_AUTHORIZATION_CERTIFICATE';
}
export interface WorkingOutcomeLabel {
  readonly objectId: string;
  readonly experienceId: string;
  readonly exposedAt: number;
  readonly status: 'observed' | 'unknown' | 'clear' | 'missing' | 'undone';
  readonly observation: Observation | null;
}
/** Already reconciled terminal labels. Domain-specific priority/UNDO replay belongs to the adapter. */
export interface WorkingOutcomeCapture {
  readonly id: string;
  readonly sourcePredictionId: string;
  readonly subjectId: string;
  readonly actingIdentityRef: string;
  /** Forecast session context, not a claim about the later rating's session. */
  readonly sessionRef: string;
  readonly revision: number;
  readonly createdAt: number;
  readonly availableAt: number;
  readonly availabilityBasis: WorkingAvailabilityBasis;
  readonly matureAt: number;
  readonly complete: boolean;
  readonly resolutionVersion: string;
  readonly labels: readonly WorkingOutcomeLabel[];
}
export type WorkingEvaluationReason = 'malformed-capture' | 'capture-unavailable' | 'incomplete-capture'
  | 'capture-scope-mismatch'
  | 'immature-window' | 'capture-before-maturity' | 'missing-label' | 'unknown-label' | 'cleared-label' | 'undone-label'
  | 'late-plan' | 'outcome-not-later' | 'outside-horizon' | 'future-observation' | 'incompatible-target'
  | 'incompatible-scale' | 'scope-or-source' | 'unverified-exposure' | 'prediction-mismatch' | 'experience-mismatch'
  | 'same-experience' | 'duplicate-observation' | 'input-outcome-reuse' | 'mixed-provenance' | 'synthetic-excluded'
  | 'synthetic-plan' | 'unsupported-provenance' | 'all-tied' | 'policy-ineligible' | 'not-off-selected' | 'different-tier'
  | 'censored-label' | 'immature-label';
export type WorkingOrder = 'left' | 'right' | 'tie';
export type WorkingAgreement = 'agreement' | 'tie' | 'disagreement' | 'unscored';
export interface WorkingPairReport extends WorkingPlannedPair {
  readonly status: 'comparable' | 'unscored';
  readonly reasons: readonly WorkingEvaluationReason[];
  readonly observedOrder: WorkingOrder | null;
  readonly controls: Readonly<Record<WorkingControl, { readonly order: WorkingOrder; readonly agreement: WorkingAgreement }>>;
  readonly observedNativePairCount: 0 | 1;
  readonly observedExternalPairCount: 0 | 1;
  readonly syntheticPairCount: 0 | 1;
  readonly prospectiveDeclaredEligibility: boolean;
  readonly experienceIds: readonly string[];
  readonly observations: readonly { readonly origin: 'observed' | 'synthetic'; readonly sourceId: string;
    readonly recordId: string; readonly revision: number; readonly experienceId: string }[];
}
interface WorkingAgreementCounts { readonly agreement: number; readonly tie: number; readonly disagreement: number }
export interface WorkingEvaluationReport {
  readonly contractVersion: 'working-evaluation-report-v1';
  readonly plan: WorkingEvaluationPlan;
  readonly captureRef: Omit<WorkingOutcomeCapture, 'labels'> | null;
  readonly evaluationAsOf: number;
  readonly pairs: readonly WorkingPairReport[];
  readonly plannedPairUnits: number;
  readonly comparablePairUnits: number;
  readonly unscoredPairUnits: number;
  readonly observed: { readonly nativePairUnits: number; readonly externalPairUnits: number;
    readonly controls: Readonly<Record<WorkingControl, WorkingAgreementCounts>> };
  readonly synthetic: { readonly pairUnits: number; readonly controls: Readonly<Record<WorkingControl, WorkingAgreementCounts>> };
  readonly transitions: { readonly observedOrderedVsOff: Readonly<Record<string, number>>;
    readonly observedOrderedVsStatic: Readonly<Record<string, number>> };
  readonly independence: 'not-established';
  readonly interpretation: 'CONDITIONAL_ON_OFF_SELECTED_OBSERVED_EXPOSURE';
  readonly uncertainty: 'unavailable';
  readonly descriptiveOnly: true;
  readonly historicalFeatureEligible: false;
  readonly learnable: false;
  readonly nativeActivated: false;
  readonly qualityAdmitted: false;
}
export interface WorkingEvaluationInput {
  readonly plan: WorkingEvaluationPlan;
  readonly capture: WorkingOutcomeCapture;
  readonly evaluationAsOf: number;
}
export interface WorkingEvaluationBatchReport {
  readonly contractVersion: 'working-evaluation-batch-v1';
  readonly reports: readonly WorkingEvaluationReport[];
  readonly plannedPairUnits: number;
  readonly comparablePairUnits: number;
  readonly unscoredPairUnits: number;
  readonly observedNativePairUnits: number;
  readonly observedExternalPairUnits: number;
  readonly syntheticPairUnits: number;
  readonly clusters: { readonly subjects: number; readonly subjectSessions: number;
    readonly observedSubjects: number; readonly observedSubjectSessions: number };
  readonly independence: 'not-established';
  readonly uncertainty: 'unavailable';
  readonly descriptiveOnly: true;
  readonly historicalFeatureEligible: false;
  readonly learnable: false;
  readonly nativeActivated: false;
  readonly qualityAdmitted: false;
}
const controls = ['OFF', 'STATIC', 'ORDERED'] as const;
const bases: readonly WorkingAvailabilityBasis[] = ['DECLARED_AVAILABLE_TIME', 'STORED_CREATED_TIME', 'SYNTHETIC_CLOCK'];
function valid(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Working evaluation: ${message}`); }
function id(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f]/u.test(value); }
function time(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER; }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function immutable<T>(input: T): T {
  const copy = structuredClone(input);
  const visit = (value: unknown): void => { if (value && typeof value === 'object') { Object.values(value).forEach(visit); Object.freeze(value); } };
  visit(copy); return copy;
}
function byControl<T>(build: (control: WorkingControl) => T): Record<WorkingControl, T> {
  return { OFF: build('OFF'), STATIC: build('STATIC'), ORDERED: build('ORDERED') };
}
function labelRoot(observation: Observation): string {
  return JSON.stringify([observation.provenance.origin, observation.provenance.source.id, observation.provenance.recordId]);
}
/** Describes the existing component; no new confidence gate or scoring formula. */
export function summarizeWorkingSupport(state: WorkingState, object: PredictionObject, control: WorkingControl = 'OFF'): WorkingSupportReport {
  const adjustment = scoreWorkingAdjustment({ state, object, control }); // Existing full-prefix/scorer validation.
  let coefficients: { objectId: string; weight: number }[] = [];
  let featureCoverage = 0;
  if (control !== 'OFF' && state.status === 'ACTIVE') {
    const featureValue = (key: string): number => Object.hasOwn(object.features, key) ? object.features[key] ?? 0 : 0;
    const dimensions = state.featureSchema.dimensions, mass = dimensions.reduce((sum, key) => sum + featureValue(key), 0);
    const recency = state.items.map(item => control === 'STATIC' ? 1 : 2 ** (-(state.groups.length - 1
      - state.groups.findIndex(group => group.occurredAt === item.occurredAt)) / state.config.recencyHalfLifeGroups));
    const weights = state.items.map(() => 0);
    if (mass > 0) for (const feature of dimensions) {
      const candidateWeight = featureValue(feature) / mass;
      const total = state.items.reduce((sum, item, index) => sum + (item.features[feature] ?? 0) * recency[index]!, 0);
      if (total === 0 || candidateWeight === 0) continue;
      featureCoverage += candidateWeight;
      state.items.forEach((item, index) => { weights[index]! += candidateWeight * (item.features[feature] ?? 0) * recency[index]! / total; });
    }
    coefficients = state.items.map((item, index) => ({ objectId: item.objectId, weight: weights[index]! })).filter(row => row.weight > 0);
  }
  const weightSum = coefficients.reduce((sum, row) => sum + row.weight, 0);
  const squaredWeightSum = coefficients.reduce((sum, row) => sum + row.weight ** 2, 0);
  const effectiveItems = squaredWeightSum ? Math.min(coefficients.length, weightSum ** 2 / squaredWeightSum) : 0;
  const contributing = new Set(coefficients.map(row => row.objectId));
  return immutable({ contractVersion: 'working-support-v1', control, objectId: object.id,
    reason: adjustment.reason === 'ADJUSTED' ? weightSum ? 'SUPPORTED' : 'NO_FEATURE_COVERAGE' : adjustment.reason,
    contributingItems: coefficients.length, contributingTimeGroups: state.groups.filter(group => group.objectIds.some(item => contributing.has(item))).length,
    featureCoverage: Math.min(1, featureCoverage), weightSum, squaredWeightSum, effectiveItems, coefficients,
    interpretation: 'ITEM_WEIGHT_CONCENTRATION_NOT_OUTCOME_SAMPLE_SIZE', uncertainty: 'unavailable' });
}
function copyTarget(target: TargetDefinition): TargetDefinition {
  valid(target && id(target.id) && id(target.version) && target.scale && Number.isFinite(target.scale.min)
    && Number.isFinite(target.scale.max) && target.scale.min < target.scale.max
    && Number.isFinite(target.scale.max - target.scale.min) && target.exposure === 'required'
    && ['maximize', 'minimize'].includes(target.objective)
    && ['object-observation', 'action-outcome'].includes(target.conditioning), 'invalid explicit ordinal target');
  return { id: target.id, version: target.version, scale: { min: target.scale.min, max: target.scale.max },
    exposure: target.exposure, objective: target.objective, conditioning: target.conditioning };
}
function copyScope(scope: PredictionScope): PredictionScope {
  valid(scope?.subject && id(scope.subject.id) && ['individual', 'system'].includes(scope.subject.kind)
    && id(scope.actingIdentityRef) && id(scope.sessionRef) && scope.evidence
    && Array.isArray(scope.evidence.sourceIds) && scope.evidence.sourceIds.length <= 32 && scope.evidence.sourceIds.every(id)
    && new Set(scope.evidence.sourceIds).size === scope.evidence.sourceIds.length
    && Array.isArray(scope.evidence.cohortIds) && scope.evidence.cohortIds.length <= 32 && scope.evidence.cohortIds.every(id)
    && ['exclude', 'fixture-only'].includes(scope.evidence.synthetic), 'invalid scope');
  return { subject: { id: scope.subject.id, kind: scope.subject.kind }, actingIdentityRef: scope.actingIdentityRef,
    sessionRef: scope.sessionRef, evidence: { sourceIds: [...scope.evidence.sourceIds], cohortIds: [...scope.evidence.cohortIds], synthetic: scope.evidence.synthetic } };
}
export function freezeWorkingEvaluationPlan(input: WorkingEvaluationPlanInput): WorkingEvaluationPlan {
  valid(input && id(input.id) && id(input.sourcePredictionId) && time(input.sourceCutoff) && time(input.createdAt)
    && time(input.availableAt) && input.sourceCutoff <= input.createdAt && input.createdAt <= input.availableAt
    && bases.includes(input.availabilityBasis) && input.selectionBasis === 'PREDECLARED_DISJOINT_PAIRS', 'invalid plan identity/clock/selection');
  const scope = copyScope(input.scope), target = copyTarget(input.target);
  valid(input.horizon && time(input.horizon.startAt) && time(input.horizon.endAt)
    && input.horizon.startAt >= input.sourceCutoff && input.horizon.endAt > input.horizon.startAt, 'invalid horizon');
  valid(record(input.versions) && Object.keys(input.versions).length === 4
    && ['capture', 'features', 'scorer', 'policy'].every(key => Object.hasOwn(input.versions, key)
      && id(input.versions[key as keyof typeof input.versions])), 'invalid versions');
  let sourceBinding: WorkingSourceBinding | undefined;
  if (input.sourceBinding !== undefined) {
    const binding = input.sourceBinding;
    valid(binding && [binding.kind, binding.captureRef, binding.modelVersion, binding.baseModelVersion, binding.mode, binding.objectType].every(id)
      && time(binding.requestedAt) && time(binding.storedSourceCreatedAt) && time(binding.snapshotObservedAt)
      && input.sourceCutoff <= binding.requestedAt && binding.requestedAt <= binding.snapshotObservedAt
      && binding.storedSourceCreatedAt <= binding.snapshotObservedAt && binding.snapshotObservedAt <= input.createdAt
      && binding.commitAvailability === 'UNKNOWN' && binding.historicalFeatureEligible === false, 'invalid source binding');
    sourceBinding = { kind: binding.kind, captureRef: binding.captureRef, modelVersion: binding.modelVersion,
      baseModelVersion: binding.baseModelVersion, mode: binding.mode, objectType: binding.objectType,
      requestedAt: binding.requestedAt, storedSourceCreatedAt: binding.storedSourceCreatedAt, snapshotObservedAt: binding.snapshotObservedAt,
      commitAvailability: binding.commitAvailability, historicalFeatureEligible: false };
  }
  valid(record(input.controls) && Object.keys(input.controls).length === 3 && controls.every(control => Object.hasOwn(input.controls, control)), 'all three frozen controls required');
  const identities = new Set<string>();
  const copied = byControl(control => {
    const value = input.controls[control];
    valid(value && id(value.id) && id(value.version) && !identities.has(value.id), 'duplicate/invalid control identity');identities.add(value.id);
    // Stored creation is a proxy: it may precede sourceCutoff in one transaction.
    valid(time(value.createdAt) && time(value.availableAt) && value.createdAt <= value.availableAt
      && value.createdAt <= input.createdAt && value.availableAt <= input.availableAt && bases.includes(value.availabilityBasis), 'control unavailable at plan freeze');
    valid(Array.isArray(value.candidates) && value.candidates.length > 0 && value.candidates.length <= 50, 'candidate budget');
    const objects = new Set<string>(), ranks = new Set<number>();
    const candidates = value.candidates.map(candidate => {
      valid(candidate && id(candidate.objectId) && !objects.has(candidate.objectId) && Number.isFinite(candidate.score)
        && Number.isSafeInteger(candidate.rank) && candidate.rank >= 1 && candidate.rank <= value.candidates.length
        && !ranks.has(candidate.rank) && typeof candidate.eligible === 'boolean' && Number.isSafeInteger(candidate.tier)
        && candidate.tier >= 0 && candidate.tier <= 256 && typeof candidate.selected === 'boolean'
        && (!candidate.selected || candidate.eligible), 'invalid/duplicate frozen candidate');
      objects.add(candidate.objectId);ranks.add(candidate.rank);
      return { objectId: candidate.objectId, score: candidate.score, rank: candidate.rank,
        eligible: candidate.eligible, tier: candidate.tier, selected: candidate.selected };
    }).sort((a, b) => a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0);
    for (const left of candidates) for (const right of candidates) if (left.rank < right.rank) {
      valid(left.tier <= right.tier && (left.tier !== right.tier || left.score >= right.score), 'rank contradicts frozen tier/score order');
    }
    return { id: value.id, version: value.version, createdAt: value.createdAt, availableAt: value.availableAt,
      availabilityBasis: value.availabilityBasis, candidates };
  });
  const off = copied.OFF.candidates;
  for (const control of controls) {
    valid(copied[control].candidates.length === off.length && copied[control].candidates.every((candidate, index) => {
      const baseline = off[index]!;
      return candidate.objectId === baseline.objectId && candidate.eligible === baseline.eligible && candidate.tier === baseline.tier;
    }), 'controls must share the exact candidate pool/eligibility/tier');
    valid(copied[control].candidates.filter(candidate => candidate.selected).length === off.filter(candidate => candidate.selected).length,
      'control selection denominator changed');
  }
  valid(Array.isArray(input.pairs) && input.pairs.length <= 25, 'planned pair budget');
  const pairIds = new Set<string>(), usedObjects = new Set<string>();
  const pairs = input.pairs.map(pair => {
    valid(pair && id(pair.pairId) && !pairIds.has(pair.pairId) && id(pair.leftObjectId) && id(pair.rightObjectId)
      && pair.leftObjectId !== pair.rightObjectId && !usedObjects.has(pair.leftObjectId) && !usedObjects.has(pair.rightObjectId)
      && off.some(candidate => candidate.objectId === pair.leftObjectId) && off.some(candidate => candidate.objectId === pair.rightObjectId), 'pairs must be distinct and disjoint within the frozen pool');
    pairIds.add(pair.pairId);usedObjects.add(pair.leftObjectId);usedObjects.add(pair.rightObjectId);
    return { pairId: pair.pairId, leftObjectId: pair.leftObjectId, rightObjectId: pair.rightObjectId };
  });
  let working: WorkingEvaluationPlanInput['working'], support: WorkingEvaluationPlan['support'] = null;
  valid(input.working && ['available', 'unavailable'].includes(input.working.status), 'explicit Working availability required');
  if (input.working.status === 'unavailable') {
    valid(id(input.working.reason), 'Working unavailable reason required');working = { status: 'unavailable', reason: input.working.reason };
  } else {
    const state = input.working.state;
    valid(state && state.asOf === input.sourceCutoff && JSON.stringify(copyScope(state.scope)) === JSON.stringify(scope)
      && JSON.stringify(copyTarget(state.target)) === JSON.stringify(target), 'Working state scope/target/cutoff mismatch');
    valid(Array.isArray(input.working.objects) && input.working.objects.length === off.length, 'complete frozen candidate features required');
    const objectsById = new Map(input.working.objects.map(object => [object?.id, object]));
    valid(objectsById.size === off.length && off.every(candidate => objectsById.has(candidate.objectId)), 'Working objects differ from candidate pool');
    support = byControl(control => off.map(candidate => summarizeWorkingSupport(state, objectsById.get(candidate.objectId)!, control)));
    const rebuilt = deriveWorkingState(state);
    working = { status: 'available', state: rebuilt, objects: off.map(candidate => {
      const object = objectsById.get(candidate.objectId)!;
      return { id: object.id, availableAt: object.availableAt, artifact: rebuilt.featureSchema.artifact,
        features: Object.fromEntries(rebuilt.featureSchema.dimensions.map(key => [key, Object.hasOwn(object.features, key) ? object.features[key] ?? null : null])) };
    }) };
  }
  return immutable({ contractVersion: 'working-evaluation-plan-v1', id: input.id, sourcePredictionId: input.sourcePredictionId,
    scope, target, sourceCutoff: input.sourceCutoff, createdAt: input.createdAt, availableAt: input.availableAt,
    availabilityBasis: input.availabilityBasis, selectionBasis: input.selectionBasis,
    horizon: { startAt: input.horizon.startAt, endAt: input.horizon.endAt },
    versions: { capture: input.versions.capture, features: input.versions.features, scorer: input.versions.scorer, policy: input.versions.policy }, controls: copied, pairs,
    ...(sourceBinding ? { sourceBinding } : {}), working, support, integrityBasis: 'TRUSTED_CALLER_SNAPSHOT_NOT_AUTHORIZATION_CERTIFICATE' });
}
function captureRef(capture: WorkingOutcomeCapture): Omit<WorkingOutcomeCapture, 'labels'> {
  valid(capture && id(capture.id) && id(capture.sourcePredictionId) && id(capture.subjectId)
    && id(capture.actingIdentityRef) && id(capture.sessionRef) && Number.isSafeInteger(capture.revision) && capture.revision >= 1
    && time(capture.createdAt) && time(capture.availableAt) && capture.createdAt <= capture.availableAt && time(capture.matureAt)
    && bases.includes(capture.availabilityBasis) && typeof capture.complete === 'boolean' && id(capture.resolutionVersion)
    && Array.isArray(capture.labels) && capture.labels.length <= 50, 'malformed capture');
  const objects = new Set<string>();
  for (const label of capture.labels) {
    valid(label && id(label.objectId) && id(label.experienceId) && time(label.exposedAt)
      && ['observed', 'unknown', 'clear', 'missing', 'undone'].includes(label.status)
      && !objects.has(label.objectId) && (label.observation === null || record(label.observation)), 'malformed capture label');
    objects.add(label.objectId);
  }
  return { id: capture.id, sourcePredictionId: capture.sourcePredictionId, subjectId: capture.subjectId,
    actingIdentityRef: capture.actingIdentityRef, sessionRef: capture.sessionRef,
    revision: capture.revision, createdAt: capture.createdAt, availableAt: capture.availableAt,
    matureAt: capture.matureAt, availabilityBasis: capture.availabilityBasis, complete: capture.complete, resolutionVersion: capture.resolutionVersion };
}
function observationReasons(label: WorkingOutcomeLabel, plan: WorkingEvaluationPlan, capture: WorkingOutcomeCapture, asOf: number): WorkingEvaluationReason[] {
  const reasons = new Set<WorkingEvaluationReason>(), observation = label.observation;
  if (label.status !== 'observed') return [label.status === 'clear' ? 'cleared-label' : label.status === 'undone' ? 'undone-label'
    : label.status === 'unknown' ? 'unknown-label' : 'missing-label'];
  if (!observation) return ['missing-label'];
  const scope = plan.scope, target = plan.target;
  if (label.exposedAt <= plan.availableAt || label.exposedAt <= plan.createdAt
    || controls.some(control => label.exposedAt <= plan.controls[control].availableAt)) reasons.add('late-plan');
  if (!time(observation.occurredAt) || !time(observation.availableAt) || observation.availableAt < observation.occurredAt) reasons.add('malformed-capture');
  else {
    if (observation.occurredAt <= plan.availableAt || observation.occurredAt < label.exposedAt) reasons.add('outcome-not-later');
    if (observation.occurredAt <= plan.horizon.startAt || observation.occurredAt > plan.horizon.endAt
      || label.exposedAt <= plan.horizon.startAt || label.exposedAt > plan.horizon.endAt) reasons.add('outside-horizon');
    if (observation.occurredAt > asOf || observation.availableAt > asOf
      || observation.availableAt > capture.availableAt || observation.occurredAt > capture.createdAt) reasons.add('future-observation');
  }
  if (observation.subjectId !== scope.subject.id || observation.actingIdentityRef !== scope.actingIdentityRef
    || observation.objectId !== label.objectId || observation.access?.kind !== 'subject'
    || observation.access.subjectId !== scope.subject.id) reasons.add('scope-or-source');
  if (observation.targetId !== target.id || observation.targetVersion !== target.version) reasons.add('incompatible-target');
  if (observation.exposure !== 'verified') reasons.add('unverified-exposure');
  if (observation.predictionId !== plan.sourcePredictionId) reasons.add('prediction-mismatch');
  if (target.conditioning === 'action-outcome' && observation.actionId !== label.experienceId) reasons.add('experience-mismatch');
  if (observation.measurement?.status !== 'observed') reasons.add(observation.measurement?.status === 'missing'
    ? observation.measurement.reason === 'censored' ? 'censored-label' : observation.measurement.reason === 'immature' ? 'immature-label'
      : observation.measurement.reason === 'unexposed' ? 'unverified-exposure' : 'unknown-label' : 'unknown-label');
  else if (!Number.isFinite(observation.measurement.value) || observation.measurement.value < target.scale.min
    || observation.measurement.value > target.scale.max) reasons.add('incompatible-scale');
  if (!observation.raw || observation.raw.scale?.min !== target.scale.min || observation.raw.scale?.max !== target.scale.max
    || observation.raw.value !== (observation.measurement?.status === 'observed' ? observation.measurement.value : null)) reasons.add('incompatible-scale');
  const provenance = observation.provenance;
  if (!provenance || !id(provenance.recordId) || !Number.isSafeInteger(provenance.revision) || provenance.revision < 1
    || !provenance.source || !id(provenance.source.id)) reasons.add('unsupported-provenance');
  else {
    if (!scope.evidence.sourceIds.includes(provenance.source.id)) reasons.add('scope-or-source');
    if (provenance.origin === 'synthetic') {
      if (scope.evidence.synthetic !== 'fixture-only') reasons.add('synthetic-excluded');
      if (provenance.source.kind !== 'generator' || !id(provenance.source.version) || !Array.isArray(provenance.source.parentRefs)
        || provenance.source.parentRefs.length > 32 || !provenance.source.parentRefs.every(id)) reasons.add('unsupported-provenance');
    } else if (provenance.origin !== 'observed' || !['native', 'external'].includes(provenance.source.kind)) reasons.add('unsupported-provenance');
    else if (provenance.source.kind === 'external' && (!id(provenance.source.release) || !id(provenance.source.manifestId)
      || !['recorded', 'assumed-at-occurrence'].includes(provenance.source.availability))) reasons.add('unsupported-provenance');
    if (plan.working.status === 'available' && plan.working.state.records.some(row => labelRoot(row.observation) === labelRoot(observation))) reasons.add('input-outcome-reuse');
  }
  return [...reasons];
}
function order(control: WorkingFrozenControl, pair: WorkingPlannedPair): WorkingOrder {
  const left = control.candidates.find(candidate => candidate.objectId === pair.leftObjectId)!;
  const right = control.candidates.find(candidate => candidate.objectId === pair.rightObjectId)!;
  return left.score === right.score ? 'tie' : left.rank < right.rank ? 'left' : 'right';
}
function counts(pairs: readonly WorkingPairReport[]): Record<WorkingControl, WorkingAgreementCounts> {
  return byControl(control => ({ agreement: pairs.filter(pair => pair.controls[control].agreement === 'agreement').length,
    tie: pairs.filter(pair => pair.controls[control].agreement === 'tie').length,
    disagreement: pairs.filter(pair => pair.controls[control].agreement === 'disagreement').length }));
}
function transitions(pairs: readonly WorkingPairReport[], reference: 'OFF' | 'STATIC'): Record<string, number> {
  return Object.fromEntries(['agreement', 'tie', 'disagreement'].flatMap(before => ['agreement', 'tie', 'disagreement']
    .map(after => [`${before}->${after}`, pairs.filter(pair => pair.controls[reference].agreement === before
      && pair.controls.ORDERED.agreement === after).length])));
}
/** Evaluate every planned pair on one shared directional label mask. */
export function evaluateWorkingPlan(planInput: WorkingEvaluationPlan, capture: WorkingOutcomeCapture, evaluationAsOf: number): WorkingEvaluationReport {
  valid(time(evaluationAsOf), 'invalid evaluation clock');
  const plan = freezeWorkingEvaluationPlan(planInput), common = new Set<WorkingEvaluationReason>();
  let reference: WorkingEvaluationReport['captureRef'] = null;
  try { reference = captureRef(capture); } catch { common.add('malformed-capture'); }
  if (reference) {
    if (reference.sourcePredictionId !== plan.sourcePredictionId || reference.subjectId !== plan.scope.subject.id
      || reference.actingIdentityRef !== plan.scope.actingIdentityRef || reference.sessionRef !== plan.scope.sessionRef) common.add('capture-scope-mismatch');
    if (!reference.complete) common.add('incomplete-capture');
    if (reference.availableAt > evaluationAsOf || reference.createdAt > evaluationAsOf) common.add('capture-unavailable');
    if (reference.matureAt < plan.horizon.endAt || evaluationAsOf < reference.matureAt) common.add('immature-window');
    if (reference.createdAt < reference.matureAt || reference.availableAt < reference.matureAt) common.add('capture-before-maturity');
    const roots = new Set<string>(), experiences = new Set<string>();
    for (const label of capture.labels) {
      if (experiences.has(label.experienceId)) common.add('same-experience');experiences.add(label.experienceId);
      const observation = label.observation;
      if (observation?.provenance && id(observation.provenance.recordId) && observation.provenance.source && id(observation.provenance.source.id)) {
        const root = labelRoot(observation);
        if (roots.has(root)) common.add('duplicate-observation');roots.add(root);
      }
    }
  }
  const syntheticPlan = plan.availabilityBasis === 'SYNTHETIC_CLOCK' || reference?.availabilityBasis === 'SYNTHETIC_CLOCK'
    || controls.some(control => plan.controls[control].availabilityBasis === 'SYNTHETIC_CLOCK')
    || (plan.working.status === 'available' && (plan.working.state.featureSchema.artifact.use === 'fixture-only'
      || plan.working.state.records.some(row => row.observation.provenance.origin === 'synthetic')));
  const pairs = plan.pairs.map(pair => {
    const reasons = new Set(common), labels = reference ? [pair.leftObjectId, pair.rightObjectId]
      .map(objectId => capture.labels.find(label => label.objectId === objectId)) : [];
    const observations: WorkingPairReport['observations'][number][] = [];
    let observedOrder: WorkingOrder | null = null, channel: 'native' | 'external' | 'synthetic' | null = null;
    const baseline = [pair.leftObjectId, pair.rightObjectId].map(objectId => plan.controls.OFF.candidates.find(candidate => candidate.objectId === objectId)!);
    if (baseline.some(candidate => !candidate.eligible)) reasons.add('policy-ineligible');
    if (baseline.some(candidate => !candidate.selected)) reasons.add('not-off-selected');
    if (baseline[0]!.tier !== baseline[1]!.tier) reasons.add('different-tier');
    if (reference) {
      if (labels.some(label => !label)) reasons.add('missing-label');
      const origins = new Set<string>(), roots = new Set<string>();
      for (const label of labels) if (label) {
        observationReasons(label, plan, capture, evaluationAsOf).forEach(reason => reasons.add(reason));
        const observation = label.observation, provenance = observation?.provenance;
        if (provenance && id(provenance.recordId) && provenance.source && id(provenance.source.id)
          && ['observed', 'synthetic'].includes(provenance.origin) && Number.isSafeInteger(provenance.revision) && provenance.revision > 0) {
          const root = labelRoot(observation!);
          if (roots.has(root)) reasons.add('duplicate-observation');roots.add(root);
          origins.add(provenance.origin === 'synthetic' ? 'synthetic' : provenance.source.kind);
          observations.push({ origin: provenance.origin, sourceId: provenance.source.id, recordId: provenance.recordId,
            revision: provenance.revision, experienceId: label.experienceId });
        }
      }
      if (labels[0] && labels[1] && labels[0].experienceId === labels[1].experienceId) reasons.add('same-experience');
      if (origins.size > 1) reasons.add('mixed-provenance');
      channel = origins.size === 1 && ['native', 'external', 'synthetic'].includes([...origins][0]!)
        ? [...origins][0] as 'native' | 'external' | 'synthetic' : null;
      if (channel !== 'synthetic' && syntheticPlan) reasons.add('synthetic-plan');
      if (!reasons.size) {
        const left = labels[0]!.observation!.measurement, right = labels[1]!.observation!.measurement;
        if (left.status === 'observed' && right.status === 'observed') {
          observedOrder = left.value === right.value ? 'tie' : (left.value > right.value) === (plan.target.objective === 'maximize') ? 'left' : 'right';
          if (observedOrder === 'tie') reasons.add('all-tied');
        }
      }
    }
    const comparable = !reasons.size && observedOrder !== null;
    const eligibility = comparable && channel !== 'synthetic' && plan.availabilityBasis === 'DECLARED_AVAILABLE_TIME'
      && reference?.availabilityBasis === 'DECLARED_AVAILABLE_TIME' && controls.every(control => plan.controls[control].availabilityBasis === 'DECLARED_AVAILABLE_TIME')
      && labels.every(label => label?.observation?.provenance.source.kind !== 'external'
        || label.observation.provenance.source.availability === 'recorded')
      && (plan.working.status === 'unavailable' || plan.working.state.availabilityBasis === 'DECLARED_AVAILABLE_TIME');
    return { ...pair, status: comparable ? 'comparable' as const : 'unscored' as const, reasons: [...reasons], observedOrder,
      controls: byControl(control => { const predicted = order(plan.controls[control], pair); return { order: predicted,
        agreement: !comparable ? 'unscored' as const : predicted === 'tie' ? 'tie' as const : predicted === observedOrder ? 'agreement' as const : 'disagreement' as const }; }),
      observedNativePairCount: comparable && channel === 'native' ? 1 as const : 0 as const,
      observedExternalPairCount: comparable && channel === 'external' ? 1 as const : 0 as const,
      syntheticPairCount: comparable && channel === 'synthetic' ? 1 as const : 0 as const,
      prospectiveDeclaredEligibility: Boolean(eligibility), experienceIds: labels.filter((label): label is WorkingOutcomeLabel => Boolean(label)).map(label => label.experienceId), observations };
  });
  const observed = pairs.filter(pair => pair.observedNativePairCount || pair.observedExternalPairCount), synthetic = pairs.filter(pair => pair.syntheticPairCount);
  return immutable({ contractVersion: 'working-evaluation-report-v1', plan, captureRef: reference, evaluationAsOf, pairs,
    plannedPairUnits: pairs.length, comparablePairUnits: pairs.filter(pair => pair.status === 'comparable').length,
    unscoredPairUnits: pairs.filter(pair => pair.status === 'unscored').length,
    observed: { nativePairUnits: observed.filter(pair => pair.observedNativePairCount).length,
      externalPairUnits: observed.filter(pair => pair.observedExternalPairCount).length, controls: counts(observed) },
    synthetic: { pairUnits: synthetic.length, controls: counts(synthetic) },
    transitions: { observedOrderedVsOff: transitions(observed, 'OFF'), observedOrderedVsStatic: transitions(observed, 'STATIC') },
    independence: 'not-established', interpretation: 'CONDITIONAL_ON_OFF_SELECTED_OBSERVED_EXPOSURE', uncertainty: 'unavailable',
    descriptiveOnly: true, historicalFeatureEligible: false, learnable: false, nativeActivated: false, qualityAdmitted: false });
}
/** Nonoverlap and clusters are counting rules, never an independence certificate. */
export function evaluateWorkingBatch(inputs: readonly WorkingEvaluationInput[]): WorkingEvaluationBatchReport {
  valid(Array.isArray(inputs) && inputs.length <= 128, 'batch plan budget');
  valid(inputs.every(input => input && input.plan && Array.isArray(input.plan.pairs))
    && inputs.reduce((sum, input) => sum + input.plan.pairs.length, 0) <= 128, 'batch pair budget');
  const reports = inputs.map(input => evaluateWorkingPlan(input.plan, input.capture, input.evaluationAsOf));
  const seen = new Set<string>(), subjects = new Set<string>(), sessions = new Set<string>(), observedSubjects = new Set<string>(), observedSessions = new Set<string>();
  const claim = (key: string): void => { valid(!seen.has(key), 'batch reuses an anchor, pair, experience, source record or subject object pair');seen.add(key); };
  for (const report of reports) {
    const plan = report.plan, subject = plan.scope.subject.id, session = JSON.stringify([subject, plan.scope.sessionRef]);
    claim(JSON.stringify(['plan', plan.id]));claim(JSON.stringify(['anchor', plan.sourcePredictionId]));
    subjects.add(subject);sessions.add(session);
    if (report.observed.nativePairUnits || report.observed.externalPairUnits) { observedSubjects.add(subject);observedSessions.add(session); }
    for (const pair of report.pairs) {
      claim(JSON.stringify(['pair', pair.pairId]));claim(JSON.stringify(['objects', subject, ...[pair.leftObjectId, pair.rightObjectId].sort()]));
      for (const experience of pair.experienceIds) claim(JSON.stringify(['experience', experience]));
      for (const observation of pair.observations) {
        claim(JSON.stringify(['label', observation.origin, observation.sourceId, observation.recordId]));
      }
    }
  }
  return immutable({ contractVersion: 'working-evaluation-batch-v1', reports,
    plannedPairUnits: reports.reduce((sum, report) => sum + report.plannedPairUnits, 0),
    comparablePairUnits: reports.reduce((sum, report) => sum + report.comparablePairUnits, 0),
    unscoredPairUnits: reports.reduce((sum, report) => sum + report.unscoredPairUnits, 0),
    observedNativePairUnits: reports.reduce((sum, report) => sum + report.observed.nativePairUnits, 0),
    observedExternalPairUnits: reports.reduce((sum, report) => sum + report.observed.externalPairUnits, 0),
    syntheticPairUnits: reports.reduce((sum, report) => sum + report.synthetic.pairUnits, 0),
    clusters: { subjects: subjects.size, subjectSessions: sessions.size, observedSubjects: observedSubjects.size, observedSubjectSessions: observedSessions.size },
    independence: 'not-established', uncertainty: 'unavailable', descriptiveOnly: true,
    historicalFeatureEligible: false, learnable: false, nativeActivated: false, qualityAdmitted: false });
}
