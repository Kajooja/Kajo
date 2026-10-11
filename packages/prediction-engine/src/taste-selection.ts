import type { NumericScale, PredictionObject, PredictionScope } from './contracts.js';

export interface TasteStage {
  readonly id: string;
  readonly domains: readonly string[];
  /** Presented opportunities, including unknown answers; never required ratings. */
  readonly targetOpportunities: number;
}
export interface TasteCandidate {
  readonly object: PredictionObject;
  readonly domain: string;
  readonly eligible: boolean;
  /** A normalized catalog heuristic, not a calibrated recognition probability. */
  readonly recognitionPrior: number | null;
  readonly priorBasis: 'PROVIDER_CATALOG' | 'CURATED_RECOGNITION' | 'UNAVAILABLE';
}
export type TasteAnswer =
  | { readonly kind: 'RATING'; readonly value: number }
  | { readonly kind: 'UNKNOWN' | 'NOT_INTERESTED' | 'WITHDRAWN' };
export interface TasteResponse {
  readonly revision: number;
  readonly occurredAt: number;
  readonly availableAt: number;
  readonly answer: TasteAnswer;
}
export interface TastePresentation {
  readonly objectId: string;
  readonly stageId: string;
  readonly presentedAt: number;
  readonly responses: readonly TasteResponse[];
}
export interface TasteSelectionInput {
  readonly scope: PredictionScope;
  readonly asOf: number;
  /** One frozen catalog/feature cutoff, retained when the session is extended. */
  readonly catalogAsOf: number;
  readonly ratingScale: NumericScale;
  readonly candidates: readonly TasteCandidate[];
  readonly stages: readonly TasteStage[];
  /** Append-only presentation order. Answer revisions may correct earlier responses. */
  readonly presentations: readonly TastePresentation[];
  /** A transition must be acknowledged before presenting its first question. */
  readonly acknowledgedTransitions: readonly string[];
  readonly existingCompleted: boolean;
  readonly policy?: 'ADAPTIVE' | 'PRIOR_ONLY';
  readonly config?: Partial<TasteSelectionConfig>;
}
export interface TasteSelectionConfig {
  readonly minimumOpportunities: number;
  readonly maximumOpportunities: number;
  readonly minimumKnownRatings: number;
}
export const tasteSelectionDefaults: TasteSelectionConfig = Object.freeze({
  minimumOpportunities: 12, maximumOpportunities: 24, minimumKnownRatings: 8,
});
export interface TasteSelectionComponents {
  readonly recognitionPrior: number;
  readonly diversity: number;
  readonly informationProxy: number;
  readonly score: number;
}
export type TasteSelectionDecision =
  | { readonly kind: 'QUESTION'; readonly stageId: string; readonly candidate: TasteCandidate;
    readonly replay: boolean; readonly components: TasteSelectionComponents | null }
  | { readonly kind: 'TRANSITION'; readonly fromStageId: string; readonly stageId: string }
  | { readonly kind: 'STOP'; readonly reason: 'EXISTING_COMPLETION' | 'SUFFICIENT_RESPONSES'
    | 'OPPORTUNITY_LIMIT' | 'CATALOG_EXHAUSTED'; readonly failOpen: boolean };
export interface TasteSelectionResult {
  readonly version: 'taste-selection-v1';
  readonly policy: 'ADAPTIVE' | 'PRIOR_ONLY';
  readonly decision: TasteSelectionDecision;
  readonly counts: { readonly presented: number; readonly answered: number; readonly knownRatings: number;
    readonly unknown: number; readonly notInterested: number; readonly withdrawn: number; readonly unanswered: number };
  readonly excluded: { readonly ineligibleCandidates: number; readonly futureCandidates: number; readonly futureResponses: number };
  readonly config: TasteSelectionConfig;
  readonly informationBasis: 'UNCALIBRATED_FEATURE_COVERAGE_PROXY';
  readonly inputBasis: 'TRUSTED_AUTHORIZED_SNAPSHOT';
  readonly uncertainty: 'unavailable';
  readonly nativeActivated: false;
  readonly qualityAdmitted: false;
}
function valid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Taste selection: ${message}`);
}
function id(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f]/u.test(value);
}
function time(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function bounded(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1; }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function immutable<T>(value: T): T {
  const copy = structuredClone(value);
  const visit = (node: unknown): void => {
    if (node && typeof node === 'object') { Object.values(node).forEach(visit); Object.freeze(node); }
  };
  visit(copy); return copy;
}
function overlap(a: PredictionObject, b: PredictionObject): number {
  let common = 0, mass = 0;
  for (const key of new Set([...Object.keys(a.features), ...Object.keys(b.features)])) {
    const x = Object.hasOwn(a.features, key) ? a.features[key] ?? 0 : 0;
    const y = Object.hasOwn(b.features, key) ? b.features[key] ?? 0 : 0;
    common += Math.min(x, y); mass += Math.max(x, y);
  }
  return mass ? common / mass : 0;
}

/** Pure next-opportunity policy. The trusted server owns snapshot, ledger and persistence. */
export function selectTasteOpportunity(input: TasteSelectionInput): TasteSelectionResult {
  valid(input && time(input.asOf) && time(input.catalogAsOf) && input.catalogAsOf <= input.asOf, 'invalid catalog/session cutoff');
  const scope = input.scope;
  valid(scope && scope.subject && id(scope.subject.id) && ['individual', 'system'].includes(scope.subject.kind)
    && id(scope.actingIdentityRef) && id(scope.sessionRef), 'individual/system subject, actor and session required');
  valid(scope.evidence && Array.isArray(scope.evidence.sourceIds) && Array.isArray(scope.evidence.cohortIds)
    && scope.evidence.sourceIds.length <= 32 && scope.evidence.cohortIds.length <= 32
    && scope.evidence.sourceIds.every(id) && scope.evidence.cohortIds.every(id)
    && new Set(scope.evidence.sourceIds).size === scope.evidence.sourceIds.length
    && new Set(scope.evidence.cohortIds).size === scope.evidence.cohortIds.length
    && ['exclude', 'fixture-only'].includes(scope.evidence.synthetic), 'invalid evidence scope');
  const scale = input.ratingScale;
  valid(scale && Number.isFinite(scale.min) && Number.isFinite(scale.max) && scale.max > scale.min, 'invalid rating scale');
  valid(typeof input.existingCompleted === 'boolean', 'explicit existing-completion state required');
  const policy = input.policy ?? 'ADAPTIVE';
  valid(['ADAPTIVE', 'PRIOR_ONLY'].includes(policy), 'unsupported policy');
  const c = { ...tasteSelectionDefaults, ...input.config };
  valid(Number.isInteger(c.minimumOpportunities) && c.minimumOpportunities >= 12
    && Number.isInteger(c.maximumOpportunities) && c.maximumOpportunities <= 24 && c.maximumOpportunities >= c.minimumOpportunities
    && Number.isInteger(c.minimumKnownRatings) && c.minimumKnownRatings >= 1 && c.minimumKnownRatings <= c.minimumOpportunities,
  'invalid opportunity/recognition bounds');
  valid(Array.isArray(input.stages) && input.stages.length > 0 && input.stages.length <= 4, 'invalid stage budget');
  const stages = input.stages;
  const domains = new Set<string>();
  for (const stage of stages) {
    valid(stage && id(stage.id) && Array.isArray(stage.domains) && stage.domains.length > 0 && stage.domains.length <= 8
      && stage.domains.every(id) && new Set(stage.domains).size === stage.domains.length
      && Number.isInteger(stage.targetOpportunities) && stage.targetOpportunities >= 1 && stage.targetOpportunities <= 24,
    'invalid stage');
    for (const domain of stage.domains) { valid(!domains.has(domain), 'domain must belong to exactly one stage'); domains.add(domain); }
  }
  const targetCount = stages.reduce((sum, stage) => sum + stage.targetOpportunities, 0);
  valid(new Set(stages.map(stage => stage.id)).size === stages.length
    && targetCount >= c.minimumOpportunities && targetCount <= c.maximumOpportunities, 'invalid stage identities/total');
  valid(Array.isArray(input.candidates) && input.candidates.length <= 256, 'catalog candidate budget exceeded');
  const candidates = new Map<string, TasteCandidate>(), available = new Set<string>(), dimensions = new Set<string>();
  const excluded = { ineligibleCandidates: 0, futureCandidates: 0, futureResponses: 0 };
  let representation: string | null = null;
  for (const candidate of input.candidates) {
    const object = candidate?.object, artifact = object?.artifact;
    valid(candidate && object && id(object.id) && id(candidate.domain) && domains.has(candidate.domain)
      && typeof candidate.eligible === 'boolean' && time(object.availableAt), 'invalid candidate');
    valid(!candidates.has(object.id), 'duplicate candidate identity');
    valid(artifact && id(artifact.id) && id(artifact.version) && id(artifact.representationVersion)
      && time(artifact.availableAt) && (artifact.trainedThrough === null || (time(artifact.trainedThrough)
        && artifact.trainedThrough <= artifact.availableAt)) && Array.isArray(artifact.sourceRefs)
      && artifact.sourceRefs.length <= 32 && artifact.sourceRefs.every(id)
      && ['fixture-only', 'research-only'].includes(artifact.use), 'invalid feature artifact');
    valid(record(object.features) && Object.keys(object.features).length <= 64, 'invalid feature budget');
    for (const [key, value] of Object.entries(object.features)) {
      valid(id(key) && (value === null || bounded(value)), 'features must be normalized 0..1 or missing');
    }
    valid(['PROVIDER_CATALOG', 'CURATED_RECOGNITION', 'UNAVAILABLE'].includes(candidate.priorBasis)
      && (candidate.recognitionPrior === null ? candidate.priorBasis === 'UNAVAILABLE'
        : bounded(candidate.recognitionPrior) && candidate.priorBasis !== 'UNAVAILABLE'), 'invalid recognition prior/basis');
    candidates.set(object.id, candidate);
    if (!candidate.eligible) excluded.ineligibleCandidates++;
    else if (object.availableAt > input.catalogAsOf || artifact.availableAt > input.catalogAsOf) excluded.futureCandidates++;
    else {
      representation ??= artifact.representationVersion;
      valid(artifact.representationVersion === representation, 'incompatible feature representation');
      Object.keys(object.features).forEach(feature => dimensions.add(feature));
      valid(dimensions.size <= 64, 'combined feature budget exceeded');
      available.add(object.id);
    }
  }
  valid(Array.isArray(input.presentations) && input.presentations.length <= c.maximumOpportunities, 'presentation budget exceeded');
  valid(Array.isArray(input.acknowledgedTransitions) && input.acknowledgedTransitions.length < stages.length
    && input.acknowledgedTransitions.every(id) && new Set(input.acknowledgedTransitions).size === input.acknowledgedTransitions.length,
  'invalid transition acknowledgements');
  input.acknowledgedTransitions.forEach((stageId, index) => valid(stageId === stages[index + 1]!.id, 'transition acknowledgements must be an ordered prefix'));
  const presented = new Set<string>(), latest = new Map<string, TasteResponse>();
  const stageCounts = stages.map(() => 0);
  let previousStage = 0, previousAt = input.catalogAsOf;
  for (const [presentationIndex, presentation] of input.presentations.entries()) {
    const candidate = candidates.get(presentation?.objectId), stageIndex = stages.findIndex(stage => stage.id === presentation?.stageId);
    valid(presentation && candidate && available.has(candidate.object.id) && !presented.has(candidate.object.id), 'invalid/unavailable/repeated presentation');
    valid(stageIndex >= previousStage && stageIndex >= 0
      && stages[stageIndex]!.domains.includes(candidate.domain)
      && (stageIndex === 0 || input.acknowledgedTransitions.includes(presentation.stageId)), 'invalid presentation stage/transition');
    valid(time(presentation.presentedAt) && presentation.presentedAt >= previousAt && presentation.presentedAt <= input.asOf,
      'invalid presentation time/order');
    valid(Array.isArray(presentation.responses) && presentation.responses.length <= 8, 'response revision budget exceeded');
    const revisions = new Map<number, TasteResponse>();
    for (const response of presentation.responses) {
      valid(response && Number.isSafeInteger(response.revision) && response.revision >= 1
        && time(response.occurredAt) && time(response.availableAt) && response.occurredAt >= presentation.presentedAt
        && response.availableAt >= response.occurredAt && response.answer
        && ['RATING', 'UNKNOWN', 'NOT_INTERESTED', 'WITHDRAWN'].includes(response.answer.kind), 'invalid response revision');
      if (response.answer.kind === 'RATING') valid(Number.isFinite(response.answer.value)
        && response.answer.value >= scale.min && response.answer.value <= scale.max, 'rating outside declared scale');
      const old = revisions.get(response.revision);
      valid(!old || JSON.stringify(old) === JSON.stringify(response), 'conflicting response revision');
      revisions.set(response.revision, response);
    }
    const ordered = [...revisions.values()].sort((a, b) => a.revision - b.revision);
    for (let i = 1; i < ordered.length; i++) valid(ordered[i]!.availableAt >= ordered[i - 1]!.availableAt
      && ordered[i]!.occurredAt >= ordered[i - 1]!.occurredAt, 'response revision clocks regress');
    const visible = ordered.filter(response => {
      if (response.availableAt > input.asOf) { excluded.futureResponses++; return false; } return true;
    });
    const nextPresentation = input.presentations[presentationIndex + 1];
    if (nextPresentation) {
      const answerAtAdvance = visible.filter(response => response.availableAt <= nextPresentation.presentedAt).at(-1);
      valid(answerAtAdvance && answerAtAdvance.answer.kind !== 'WITHDRAWN', 'next presentation precedes prior answer');
    }
    if (visible.length) latest.set(candidate.object.id, visible.at(-1)!);
    presented.add(candidate.object.id); stageCounts[stageIndex]!++;
    previousStage = stageIndex; previousAt = presentation.presentedAt;
  }
  stages.slice(0, -1).forEach((stage, index) => valid(stageCounts[index]! <= stage.targetOpportunities,
    'nonfinal stage exceeds opportunity quota'));
  // A caller cannot jump past unpresented available questions merely by claiming a transition.
  input.acknowledgedTransitions.forEach((_, index) => {
    const prior = stages[index]!;
    valid(stageCounts[index]! >= prior.targetOpportunities || !input.candidates.some(candidate =>
      available.has(candidate.object.id) && !presented.has(candidate.object.id) && prior.domains.includes(candidate.domain)),
    'transition before prior stage quota/exhaustion');
  });
  const counts = { presented: input.presentations.length, answered: 0, knownRatings: 0, unknown: 0, notInterested: 0,
    withdrawn: 0, unanswered: 0 };
  for (const presentation of input.presentations) {
    const answer = latest.get(presentation.objectId)?.answer;
    if (!answer) counts.unanswered++;
    else if (answer.kind === 'WITHDRAWN') { counts.withdrawn++; counts.unanswered++; }
    else {
      counts.answered++;
      if (answer.kind === 'RATING') counts.knownRatings++;
      else if (answer.kind === 'UNKNOWN') counts.unknown++;
      else counts.notInterested++;
    }
  }
  const finish = (decision: TasteSelectionDecision): TasteSelectionResult => immutable({ version: 'taste-selection-v1', policy,
    decision, counts, excluded, config: c, informationBasis: 'UNCALIBRATED_FEATURE_COVERAGE_PROXY',
    inputBasis: 'TRUSTED_AUTHORIZED_SNAPSHOT', uncertainty: 'unavailable', nativeActivated: false, qualityAdmitted: false });
  if (input.existingCompleted) return finish({ kind: 'STOP', reason: 'EXISTING_COMPLETION', failOpen: false });
  const pending = input.presentations.at(-1);
  if (pending && (!latest.has(pending.objectId) || latest.get(pending.objectId)!.answer.kind === 'WITHDRAWN')) {
    return finish({ kind: 'QUESTION', stageId: pending.stageId, candidate: candidates.get(pending.objectId)!, replay: true, components: null });
  }
  if (counts.presented >= c.maximumOpportunities) return finish({ kind: 'STOP', reason: 'OPPORTUNITY_LIMIT',
    failOpen: counts.knownRatings < c.minimumKnownRatings });
  let currentStage = input.acknowledgedTransitions.length;
  const remaining = (index: number): TasteCandidate[] => input.candidates.filter(candidate => available.has(candidate.object.id)
    && !presented.has(candidate.object.id) && stages[index]!.domains.includes(candidate.domain));
  if (currentStage < stages.length - 1 && (stageCounts[currentStage]! >= stages[currentStage]!.targetOpportunities || !remaining(currentStage).length)) {
    return finish({ kind: 'TRANSITION', fromStageId: stages[currentStage]!.id, stageId: stages[currentStage + 1]!.id });
  }
  currentStage = Math.min(currentStage, stages.length - 1);
  if (currentStage === stages.length - 1 && stageCounts[currentStage]! >= stages[currentStage]!.targetOpportunities
    && counts.presented >= c.minimumOpportunities && counts.knownRatings >= c.minimumKnownRatings) {
    return finish({ kind: 'STOP', reason: 'SUFFICIENT_RESPONSES', failOpen: false });
  }
  const pool = remaining(currentStage);
  if (!pool.length) return finish({ kind: 'STOP', reason: 'CATALOG_EXHAUSTED',
    failOpen: counts.presented < c.minimumOpportunities || counts.knownRatings < c.minimumKnownRatings });
  const support = new Map<string, number>();
  for (const [objectId, response] of latest) {
    if (response.answer.kind !== 'RATING' && response.answer.kind !== 'NOT_INTERESTED') continue;
    for (const [feature, value] of Object.entries(candidates.get(objectId)!.object.features)) {
      support.set(feature, (support.get(feature) ?? 0) + (value ?? 0));
    }
  }
  const score = (candidate: TasteCandidate): TasteSelectionComponents => {
    const recognitionPrior = candidate.recognitionPrior ?? 0;
    const mass = Object.values(candidate.object.features).reduce<number>((sum, value) => sum + (value ?? 0), 0);
    let informationProxy = 0;
    if (mass) for (const [feature, value] of Object.entries(candidate.object.features)) {
      informationProxy += (value ?? 0) / mass / (1 + (support.get(feature) ?? 0));
    }
    const diversity = mass ? 1 - Math.max(0, ...input.presentations.map(presentation =>
      overlap(candidate.object, candidates.get(presentation.objectId)!.object))) : 0;
    return { recognitionPrior, diversity, informationProxy, score: policy === 'PRIOR_ONLY' ? recognitionPrior
      : 0.65 * recognitionPrior + 0.20 * diversity + 0.15 * informationProxy };
  };
  const ranked = pool.map(candidate => ({ candidate, components: score(candidate) })).sort((a, b) =>
    b.components.score - a.components.score || (a.candidate.object.id < b.candidate.object.id ? -1 : a.candidate.object.id > b.candidate.object.id ? 1 : 0));
  const selected = ranked[0]!;
  return finish({ kind: 'QUESTION', stageId: stages[currentStage]!.id, candidate: selected.candidate, replay: false, components: selected.components });
}
