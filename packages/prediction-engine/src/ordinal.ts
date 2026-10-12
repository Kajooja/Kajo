import type { Observation, PredictionScope, TargetDefinition } from './contracts.js';

export interface OrdinalParticipant {
  readonly actorId: string;
  /** An actor's enrollment generation, not just their identity. */
  readonly enrollmentId: string;
}
export interface OrdinalCaptureRef {
  readonly id: string;
  readonly revision: number;
  readonly availableAt: number;
  readonly availabilityBasis: 'observed-capture-time' | 'observed-comparison-time' | 'synthetic-clock';
  readonly comparisonId?: string;
}
export interface OrdinalResponse extends OrdinalParticipant {
  readonly status: 'rated' | 'unknown' | 'clear' | 'missing';
  readonly observation: Observation | null;
}
export interface OrdinalRound {
  readonly roundId: string;
  readonly experienceId: string;
  readonly objectId: string;
  readonly openedAt: number;
  readonly matureAt: number;
  readonly capture: OrdinalCaptureRef;
  readonly participants: readonly OrdinalParticipant[];
  readonly responses: readonly OrdinalResponse[];
}
export interface OrdinalAnchor {
  readonly id: string;
  readonly subjectId: string;
  readonly actorId: string;
  readonly frozenAt: number;
  readonly availableAt: number;
  readonly timestampBasis: 'stored-request-time';
  readonly sourcePredictionId: string;
  readonly shadowPredictionId: string;
  /** One complete pool binds both predictors; separate actor pools cannot join it. */
  readonly pool: readonly {
    readonly objectId: string;
    readonly production: { readonly score: number; readonly rank: number };
    readonly shadow: { readonly score: number; readonly rank: number };
  }[];
}
export interface OrdinalPairInput {
  readonly pairId: string;
  readonly scope: PredictionScope;
  readonly target: TargetDefinition;
  readonly evaluationAsOf: number;
  readonly left: OrdinalRound;
  readonly right: OrdinalRound;
  readonly anchor: OrdinalAnchor;
  /** Opaque adapter assertion, never a checksum or authorization verification. */
  readonly integrityBasis?: string;
}
export type OrdinalDirection = 'left' | 'right' | 'tie';
export type OrdinalObservedOrder = 'left-dominates' | 'right-dominates' | 'all-tied' | 'mixed';
export type OrdinalReason = 'malformed-input' | 'budget-exceeded' | 'unsupported-target' | 'duplicate-identity'
  | 'same-object' | 'same-round' | 'same-experience' | 'membership-mismatch' | 'anchor-membership-mismatch'
  | 'anchor-late' | 'anchor-unavailable' | 'anchor-pool-mismatch' | 'capture-unavailable' | 'immature-round'
  | 'missing-response' | 'unknown-response' | 'cleared-response' | 'unexposed' | 'future-observation'
  | 'incompatible-target' | 'incompatible-scale' | 'unauthorized-observation' | 'unsupported-provenance'
  | 'synthetic-excluded' | 'mixed-provenance' | 'all-tied' | 'mixed-preferences';
export interface OrdinalObservationRef {
  readonly recordId: string;
  readonly revision: number;
  readonly origin: 'observed' | 'synthetic';
  readonly sourceId: string;
  readonly predictionId: string;
  readonly availableAt: number;
}
export interface OrdinalActorReport extends OrdinalParticipant {
  readonly direction: OrdinalDirection | null;
  readonly left: OrdinalObservationRef | null;
  readonly right: OrdinalObservationRef | null;
  readonly reasons: readonly OrdinalReason[];
}
export interface OrdinalPredictorReport {
  readonly order: OrdinalDirection | null;
  readonly agreement: 'agreement' | 'tie' | 'disagreement' | 'unscored';
}
export interface OrdinalExperienceRef {
  readonly roundId: string;
  readonly experienceId: string;
  readonly objectId: string;
}
export interface OrdinalPairReport {
  readonly contractVersion: 'group-ordinal-pair-v1';
  readonly pairId: string | null;
  readonly subjectRef: string | null;
  readonly target: TargetDefinition | null;
  readonly evaluationAsOf: number | null;
  readonly experiences: { readonly left: OrdinalExperienceRef | null; readonly right: OrdinalExperienceRef | null };
  readonly status: 'comparable' | 'unscored';
  readonly reasons: readonly OrdinalReason[];
  readonly observedOrder: OrdinalObservedOrder | null;
  readonly actors: readonly OrdinalActorReport[];
  readonly production: OrdinalPredictorReport;
  readonly shadow: OrdinalPredictorReport;
  readonly captures: { readonly left: OrdinalCaptureRef | null; readonly right: OrdinalCaptureRef | null };
  readonly participants: { readonly left: readonly OrdinalParticipant[]; readonly right: readonly OrdinalParticipant[] };
  readonly anchorRef: { readonly id: string; readonly sourcePredictionId: string; readonly shadowPredictionId: string;
    readonly frozenAt: number; readonly availableAt: number; readonly timestampBasis: 'stored-request-time' } | null;
  readonly integrityBasis: string;
  readonly observedPairCount: 0 | 1;
  readonly syntheticPairCount: 0 | 1;
  readonly unit: 'one-distinct-round-experience-pair';
  readonly interpretation: 'conditional-on-observed-exposure';
  readonly historicalFeatureEligible: false;
  readonly membershipValidity: 'historical-membership-unknown';
  readonly commitVisibility: 'unknown';
  readonly uncertainty: 'unavailable';
  readonly groupReward: null;
  readonly advantage: null;
  readonly learnable: false;
}

interface AgreementCounts { readonly agreement: number; readonly tie: number; readonly disagreement: number }
export interface OrdinalBatchReport {
  readonly contractVersion: 'group-ordinal-batch-v1';
  readonly pairs: readonly OrdinalPairReport[];
  readonly comparablePairUnits: number;
  readonly unscoredPairUnits: number;
  readonly observed: { readonly pairUnits: number; readonly production: AgreementCounts; readonly shadow: AgreementCounts };
  readonly synthetic: { readonly pairUnits: number; readonly production: AgreementCounts; readonly shadow: AgreementCounts };
  readonly independence: 'not-established';
  readonly uncertainty: 'unavailable';
  readonly historicalFeatureEligible: false;
  readonly learnable: false;
}

class InvalidOrdinal extends Error {
  constructor(readonly reason: OrdinalReason) { super(reason); }
}
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
// Preserve sub-millisecond stored clocks; rounding could reverse a strict
// before-OPEN boundary. They still are not a commit/consumer-time certificate.
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
  && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const participantKey = (participant: OrdinalParticipant) => JSON.stringify([participant.actorId, participant.enrollmentId]);
function requireValue(condition: unknown, reason: OrdinalReason): asserts condition {
  if (!condition) throw new InvalidOrdinal(reason);
}
function immutable<T>(value: T): T {
  const copy = structuredClone(value);
  const visit = (node: unknown): void => {
    if (node && typeof node === 'object') { Object.values(node).forEach(visit); Object.freeze(node); }
  };
  visit(copy);
  return copy;
}
function captureRef(round: OrdinalRound): OrdinalCaptureRef {
  const capture = round.capture;
  requireValue(capture && id(capture.id) && Number.isSafeInteger(capture.revision) && capture.revision > 0
    && time(capture.availableAt) && capture.availableAt >= round.openedAt
    && ['observed-capture-time', 'observed-comparison-time', 'synthetic-clock'].includes(capture.availabilityBasis)
    && (capture.comparisonId === undefined || id(capture.comparisonId)), 'malformed-input');
  return { id: capture.id, revision: capture.revision, availableAt: capture.availableAt,
    availabilityBasis: capture.availabilityBasis,
    ...(capture.comparisonId === undefined ? {} : { comparisonId: capture.comparisonId }) };
}
function participantsOf(round: OrdinalRound): OrdinalParticipant[] {
  requireValue(round && id(round.roundId) && id(round.experienceId) && id(round.objectId)
    && time(round.openedAt) && time(round.matureAt) && round.matureAt >= round.openedAt, 'malformed-input');
  requireValue(Array.isArray(round.participants) && Array.isArray(round.responses), 'malformed-input');
  requireValue(round.participants.length >= 2 && round.participants.length <= 32 && round.responses.length <= 32,
    'budget-exceeded');
  const actors = new Set<string>();
  const participants = round.participants.map(participant => {
    requireValue(participant && id(participant.actorId) && id(participant.enrollmentId), 'malformed-input');
    requireValue(!actors.has(participant.actorId), 'duplicate-identity'); actors.add(participant.actorId);
    return { actorId: participant.actorId, enrollmentId: participant.enrollmentId };
  }).sort((a, b) => lexical(a.actorId, b.actorId));
  const responses = new Set<string>();
  for (const response of round.responses) {
    requireValue(response && id(response.actorId) && id(response.enrollmentId)
      && ['rated', 'unknown', 'clear', 'missing'].includes(response.status), 'malformed-input');
    requireValue(!responses.has(response.actorId), 'duplicate-identity'); responses.add(response.actorId);
    requireValue(participants.some(participant => participantKey(participant) === participantKey(response)), 'membership-mismatch');
  }
  return participants;
}
interface ValidResponse { value: number; ref: OrdinalObservationRef; recordKey: string }
function rating(round: OrdinalRound, participant: OrdinalParticipant, input: OrdinalPairInput): ValidResponse {
  const response = round.responses.find(candidate => participantKey(candidate) === participantKey(participant));
  requireValue(response && response.status !== 'missing', 'missing-response');
  requireValue(response.status !== 'clear', 'cleared-response');
  requireValue(response.status !== 'unknown', 'unknown-response');
  const observation = response.observation;
  requireValue(observation && observation.measurement && observation.raw && observation.raw.scale
    && observation.provenance && observation.provenance.source && observation.access, 'malformed-input');
  if (observation.measurement.status !== 'observed') {
    const reason = observation.measurement.reason;
    throw new InvalidOrdinal(reason === 'unknown' ? 'unknown-response' : reason === 'unexposed' ? 'unexposed'
      : reason === 'immature' ? 'immature-round' : reason === 'censored' ? 'missing-response' : 'malformed-input');
  }
  requireValue(observation.targetId === input.target.id && observation.targetVersion === input.target.version, 'incompatible-target');
  requireValue(observation.raw.scale.min === input.target.scale.min && observation.raw.scale.max === input.target.scale.max,
    'incompatible-scale');
  const value = observation.measurement.value;
  requireValue(Number.isFinite(value) && value >= input.target.scale.min && value <= input.target.scale.max
    && observation.raw.value === value, 'incompatible-scale');
  requireValue(observation.subjectId === input.scope.subject.id && observation.actingIdentityRef === participant.actorId
    && observation.objectId === round.objectId && observation.actionId === round.experienceId,
  'unauthorized-observation');
  requireValue(observation.access.kind === 'subject' ? observation.access.subjectId === input.scope.subject.id
    : observation.access.kind === 'cohort' && input.scope.evidence.cohortIds.includes(observation.access.cohortId),
  'unauthorized-observation');
  requireValue(observation.exposure === 'verified' && id(observation.predictionId), 'unexposed');
  requireValue(time(observation.occurredAt) && time(observation.availableAt)
    && observation.occurredAt >= round.openedAt && observation.availableAt >= observation.occurredAt, 'malformed-input');
  requireValue(observation.occurredAt <= round.matureAt, 'immature-round');
  requireValue(observation.occurredAt <= input.evaluationAsOf && observation.availableAt <= input.evaluationAsOf
    && observation.availableAt <= round.capture.availableAt, 'future-observation');
  const provenance = observation.provenance, source = provenance.source;
  requireValue(id(provenance.recordId) && Number.isSafeInteger(provenance.revision) && provenance.revision > 0
    && provenance.revision <= round.capture.revision && id(source.id), 'unsupported-provenance');
  requireValue(input.scope.evidence.sourceIds.includes(source.id), 'unauthorized-observation');
  if (provenance.origin === 'synthetic') {
    requireValue(source.kind === 'generator' && id(source.version) && Array.isArray(source.parentRefs)
      && source.parentRefs.length <= 1000 && source.parentRefs.every(id), 'unsupported-provenance');
    requireValue(input.scope.evidence.synthetic === 'fixture-only', 'synthetic-excluded');
  } else {
    requireValue(provenance.origin === 'observed' && (source.kind === 'native' || source.kind === 'external'), 'unsupported-provenance');
    requireValue(round.capture.availabilityBasis !== 'synthetic-clock', 'unsupported-provenance');
    if (source.kind === 'external') requireValue(id(source.release) && id(source.manifestId)
      && ['recorded', 'assumed-at-occurrence'].includes(source.availability), 'unsupported-provenance');
  }
  return { value, recordKey: JSON.stringify([provenance.origin, source.kind, source.id,
    source.kind === 'external' ? source.release : null, provenance.recordId]),
  ref: { recordId: provenance.recordId, revision: provenance.revision, origin: provenance.origin,
    sourceId: source.id, predictionId: observation.predictionId, availableAt: observation.availableAt } };
}
function anchorOrders(input: OrdinalPairInput, participants: readonly OrdinalParticipant[]): {
  production: OrdinalDirection; shadow: OrdinalDirection;
} {
  const anchor = input.anchor;
  requireValue(anchor && id(anchor.id) && id(anchor.subjectId) && id(anchor.actorId)
    && id(anchor.sourcePredictionId) && id(anchor.shadowPredictionId)
    && anchor.sourcePredictionId !== anchor.shadowPredictionId && time(anchor.frozenAt) && time(anchor.availableAt)
    && anchor.availableAt >= anchor.frozenAt && anchor.timestampBasis === 'stored-request-time', 'malformed-input');
  requireValue(anchor.subjectId === input.scope.subject.id
    && participants.some(participant => participant.actorId === anchor.actorId)
    && (input.scope.actingIdentityRef === null || input.scope.actingIdentityRef === anchor.actorId), 'anchor-membership-mismatch');
  requireValue(anchor.frozenAt < input.left.openedAt && anchor.frozenAt < input.right.openedAt, 'anchor-late');
  requireValue(anchor.availableAt <= input.evaluationAsOf, 'anchor-unavailable');
  requireValue(Array.isArray(anchor.pool) && anchor.pool.length >= 2 && anchor.pool.length <= 1000, 'anchor-pool-mismatch');
  const objects = new Set<string>(), productionRanks = new Set<number>(), shadowRanks = new Set<number>();
  for (const candidate of anchor.pool) {
    requireValue(candidate && id(candidate.objectId) && candidate.production && candidate.shadow, 'anchor-pool-mismatch');
    requireValue(!objects.has(candidate.objectId), 'anchor-pool-mismatch'); objects.add(candidate.objectId);
    for (const [prediction, ranks] of [[candidate.production, productionRanks], [candidate.shadow, shadowRanks]] as const) {
      requireValue(Number.isFinite(prediction.score) && Number.isSafeInteger(prediction.rank)
        && prediction.rank >= 1 && prediction.rank <= anchor.pool.length && !ranks.has(prediction.rank), 'anchor-pool-mismatch');
      ranks.add(prediction.rank);
    }
  }
  const left = anchor.pool.find(candidate => candidate.objectId === input.left.objectId);
  const right = anchor.pool.find(candidate => candidate.objectId === input.right.objectId);
  requireValue(left && right, 'anchor-pool-mismatch');
  // Frozen policy order is authoritative for unequal scores; exact score ties
  // remain neutral even when a deterministic identity tie-break gave two ranks.
  const order = (predictor: 'production' | 'shadow'): OrdinalDirection => left[predictor].score === right[predictor].score
    ? 'tie' : left[predictor].rank < right[predictor].rank ? 'left' : 'right';
  return { production: order('production'), shadow: order('shadow') };
}

/** A descriptive Pareto diagnostic over complete exposed group outcomes. */
export function evaluateOrdinalPair(input: OrdinalPairInput): OrdinalPairReport {
  const reasons = new Set<OrdinalReason>(), actors: OrdinalActorReport[] = [];
  let subjectRef: string | null = null, targetRef: TargetDefinition | null = null, evaluationAsOf: number | null = null;
  let experiences: OrdinalPairReport['experiences'] = { left: null, right: null };
  let captures: OrdinalPairReport['captures'] = { left: null, right: null };
  let participants: OrdinalPairReport['participants'] = { left: [], right: [] };
  let anchorRef: OrdinalPairReport['anchorRef'] = null;
  let observedOrder: OrdinalObservedOrder | null = null;
  let orders: { production: OrdinalDirection; shadow: OrdinalDirection } | null = null;
  let observedPairCount: 0 | 1 = 0, syntheticPairCount: 0 | 1 = 0;
  try {
    requireValue(input && id(input.pairId) && time(input.evaluationAsOf) && input.scope?.subject
      && input.scope.subject.kind === 'group' && id(input.scope.subject.id) && input.scope.evidence
      && Array.isArray(input.scope.evidence.sourceIds) && input.scope.evidence.sourceIds.length <= 1000
      && input.scope.evidence.sourceIds.every(id) && Array.isArray(input.scope.evidence.cohortIds)
      && input.scope.evidence.cohortIds.length <= 1000 && input.scope.evidence.cohortIds.every(id)
      && ['exclude', 'fixture-only'].includes(input.scope.evidence.synthetic) && id(input.scope.sessionRef)
      && (input.scope.actingIdentityRef === null || id(input.scope.actingIdentityRef))
      && (input.integrityBasis === undefined || id(input.integrityBasis)), 'malformed-input');
    subjectRef = input.scope.subject.id; evaluationAsOf = input.evaluationAsOf;
    const target = input.target;
    requireValue(target && id(target.id) && id(target.version) && target.scale && Number.isFinite(target.scale.min)
      && Number.isFinite(target.scale.max) && target.scale.min < target.scale.max && target.exposure === 'required'
      && ['object-observation', 'action-outcome'].includes(target.conditioning)
      && ['maximize', 'minimize'].includes(target.objective), 'unsupported-target');
    // Copy only declared validated fields, never an opaque malformed target or
    // caller-added executable properties into the immutable result.
    targetRef = { id: target.id, version: target.version, scale: { min: target.scale.min, max: target.scale.max },
      conditioning: target.conditioning, exposure: target.exposure, objective: target.objective };
    const left = participantsOf(input.left);
    experiences = { ...experiences, left: { roundId: input.left.roundId, experienceId: input.left.experienceId,
      objectId: input.left.objectId } };
    const right = participantsOf(input.right);
    experiences = { ...experiences, right: { roundId: input.right.roundId, experienceId: input.right.experienceId,
      objectId: input.right.objectId } };
    participants = { left, right };
    captures = { left: captureRef(input.left), right: captureRef(input.right) };
    requireValue(input.left.objectId !== input.right.objectId, 'same-object');
    requireValue(input.left.roundId !== input.right.roundId, 'same-round');
    requireValue(input.left.experienceId !== input.right.experienceId, 'same-experience');
    requireValue(captures.left!.id !== captures.right!.id, 'duplicate-identity');
    const sameMembership = JSON.stringify(left) === JSON.stringify(right);
    if (!sameMembership) reasons.add('membership-mismatch');
    if (input.left.capture.availableAt > input.evaluationAsOf || input.right.capture.availableAt > input.evaluationAsOf)
      reasons.add('capture-unavailable');
    if (input.left.matureAt > input.evaluationAsOf || input.right.matureAt > input.evaluationAsOf
      || input.left.capture.availableAt < input.left.matureAt || input.right.capture.availableAt < input.right.matureAt)
      reasons.add('immature-round');
    try {
      orders = anchorOrders(input, left);
      const anchor = input.anchor;
      anchorRef = { id: anchor.id, sourcePredictionId: anchor.sourcePredictionId, shadowPredictionId: anchor.shadowPredictionId,
        frozenAt: anchor.frozenAt, availableAt: anchor.availableAt, timestampBasis: anchor.timestampBasis };
    } catch (error) { reasons.add(error instanceof InvalidOrdinal ? error.reason : 'malformed-input'); }
    const records = new Set<string>(), origins = new Set<'observed' | 'synthetic'>();
    for (const participant of left) {
      const actorReasons = new Set<OrdinalReason>();
      const read = (round: OrdinalRound): ValidResponse | null => {
        try {
          const value = rating(round, participant, input);
          requireValue(!records.has(value.recordKey), 'duplicate-identity'); records.add(value.recordKey);
          origins.add(value.ref.origin); return value;
        } catch (error) { actorReasons.add(error instanceof InvalidOrdinal ? error.reason : 'malformed-input'); return null; }
      };
      const a = read(input.left), b = read(input.right);
      const direction: OrdinalDirection | null = a && b ? a.value === b.value ? 'tie'
        : (a.value > b.value) === (target.objective === 'maximize') ? 'left' : 'right' : null;
      for (const reason of actorReasons) reasons.add(reason);
      actors.push({ ...participant, direction, left: a?.ref ?? null, right: b?.ref ?? null, reasons: [...actorReasons] });
    }
    if (sameMembership && actors.every(actor => actor.direction !== null)) {
      const directions = new Set(actors.map(actor => actor.direction));
      observedOrder = directions.has('left') && directions.has('right') ? 'mixed'
        : directions.has('left') ? 'left-dominates' : directions.has('right') ? 'right-dominates' : 'all-tied';
      if (observedOrder === 'mixed') reasons.add('mixed-preferences');
      if (observedOrder === 'all-tied') reasons.add('all-tied');
    }
    if (origins.size > 1) reasons.add('mixed-provenance');
    if (!reasons.size) {
      if (origins.has('synthetic')) syntheticPairCount = 1;
      else observedPairCount = 1;
    }
  } catch (error) { reasons.add(error instanceof InvalidOrdinal ? error.reason : 'malformed-input'); }
  const comparable = !reasons.size && observedOrder !== null && orders !== null;
  const predictor = (order: OrdinalDirection | null): OrdinalPredictorReport => ({ order,
    agreement: !comparable ? 'unscored' : order === 'tie' ? 'tie'
      : order === (observedOrder === 'left-dominates' ? 'left' : 'right') ? 'agreement' : 'disagreement' });
  return immutable({ contractVersion: 'group-ordinal-pair-v1', pairId: id(input?.pairId) ? input.pairId : null,
    subjectRef, target: targetRef, evaluationAsOf, experiences,
    status: comparable ? 'comparable' : 'unscored', reasons: [...reasons], observedOrder, actors,
    production: predictor(orders?.production ?? null), shadow: predictor(orders?.shadow ?? null), captures, participants, anchorRef,
    integrityBasis: id(input?.integrityBasis) ? input.integrityBasis : 'TRUSTED_CALLER_SNAPSHOT', observedPairCount, syntheticPairCount,
    unit: 'one-distinct-round-experience-pair', interpretation: 'conditional-on-observed-exposure',
    historicalFeatureEligible: false, membershipValidity: 'historical-membership-unknown', commitVisibility: 'unknown',
    uncertainty: 'unavailable', groupReward: null, advantage: null, learnable: false });
}

/** Non-overlapping units are a counting rule, not an independence certificate. */
export function evaluateOrdinalBatch(inputs: readonly OrdinalPairInput[]): OrdinalBatchReport {
  if (!Array.isArray(inputs) || inputs.length > 256) throw new Error('Ordinal batch exceeds 256 pair units');
  const seen = new Set<string>();
  for (const input of inputs) {
    const subject = input?.scope?.subject?.id;
    const keys = id(input?.pairId) ? [JSON.stringify(['pair', input.pairId])] : [];
    for (const round of [input?.left, input?.right]) {
      if (id(round?.roundId)) keys.push(JSON.stringify(['round', round.roundId]));
      if (id(round?.experienceId)) keys.push(JSON.stringify(['experience', round.experienceId]));
    }
    if (id(subject)) {
      if (id(input?.left?.objectId) && id(input?.right?.objectId)) keys.push(JSON.stringify(
        ['objects', subject, ...[input.left.objectId, input.right.objectId].sort(lexical)]));
    }
    for (const key of new Set(keys)) {
      if (seen.has(key)) throw new Error('Ordinal batch repeats a pair ID or reuses a round, experience or unordered object pair');
      seen.add(key);
    }
  }
  const pairs = inputs.map(evaluateOrdinalPair);
  const counts = (selected: readonly OrdinalPairReport[]) => {
    const tally = (predictor: 'production' | 'shadow'): AgreementCounts => ({
      agreement: selected.filter(pair => pair[predictor].agreement === 'agreement').length,
      tie: selected.filter(pair => pair[predictor].agreement === 'tie').length,
      disagreement: selected.filter(pair => pair[predictor].agreement === 'disagreement').length,
    });
    return { pairUnits: selected.length, production: tally('production'), shadow: tally('shadow') };
  };
  return immutable({ contractVersion: 'group-ordinal-batch-v1', pairs,
    comparablePairUnits: pairs.filter(pair => pair.status === 'comparable').length,
    unscoredPairUnits: pairs.filter(pair => pair.status === 'unscored').length,
    observed: counts(pairs.filter(pair => pair.observedPairCount === 1)),
    synthetic: counts(pairs.filter(pair => pair.syntheticPairCount === 1)),
    independence: 'not-established', uncertainty: 'unavailable', historicalFeatureEligible: false, learnable: false });
}
