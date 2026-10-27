import type { Provenance } from '../contracts.js';
import type { FrozenRanking, FrozenRankingCandidate, RankingJson } from '../ranking-conformance.js';
import { assertRankingJson } from '../ranking-conformance.js';
import { createKajoAdapter } from './kajo.js';
import type { KajoScopeInput } from './kajo.js';

type Row = Record<string, unknown>;
type Source = { readonly kind: 'native'; readonly id: string }
  | Extract<Provenance, { origin: 'synthetic' }>['source'];

/** Trusted, already-authorized reads. This adapter performs no database access. */
export interface KajoNativePredictionSnapshot {
  readonly scope: KajoScopeInput;
  readonly sourceRun: unknown;
  readonly sourceCandidates: readonly unknown[];
  /** The immutable registry row referenced by sourceRun.genome_id. */
  readonly sourceGenome: unknown;
  readonly snapshotObservedAt: string | number;
  /** Synthetic SQL fixtures must explicitly declare their generator. */
  readonly source?: Source;
}

export class KajoNativePredictionSnapshotError extends Error {
  constructor(readonly code: 'invalid-snapshot' | 'incompatible-snapshots' | 'unsupported-contract' | 'unauthorized-scope') {
    super(code); this.name = 'KajoNativePredictionSnapshotError';
  }
}
function check(value: unknown, code: KajoNativePredictionSnapshotError['code'] = 'invalid-snapshot'): asserts value {
  if (!value) throw new KajoNativePredictionSnapshotError(code);
}
function row(value: unknown): Row { check(value !== null && typeof value === 'object' && !Array.isArray(value)); return value as Row; }
function text(value: unknown, maximum = 512): string { check(typeof value === 'string' && value.length > 0 && value.length <= maximum); return value; }
function uuid(value: unknown): string {
  const result = text(value, 36); check(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(result)); return result;
}
function finite(value: unknown): number { check(typeof value === 'number' && Number.isFinite(value)); return value; }
function integer(value: unknown, maximum: number, minimum = 0): number {
  const result = finite(value); check(Number.isInteger(result) && result >= minimum && result <= maximum); return result;
}
function list(value: unknown, maximum: number): unknown[] { check(Array.isArray(value) && value.length <= maximum); return value; }
function ids(value: unknown, maximum: number): string[] {
  const result = list(value, maximum).map(uuid); check(new Set(result).size === result.length); return result;
}
function keys(value: Row, names: readonly string[]): void {
  check(Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key)), 'unsupported-contract');
}
// Preserve native microseconds; never silently floor two different SQL cutoffs.
function instant(value: unknown): number {
  if (typeof value === 'number') { check(Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER); return value; }
  const raw = text(value, 40), match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/u.exec(raw);
  check(match);
  const zone = match[4] === 'Z' ? 'Z' : match[4]!.length === 3 ? `${match[4]}:00`
    : match[4]!.length === 5 ? `${match[4]!.slice(0, 3)}:${match[4]!.slice(3)}` : match[4]!;
  const base = Date.parse(`${match[1]}T${match[2]}.000${zone}`), local = Date.parse(`${match[1]}T${match[2]}.000Z`);
  check(Number.isFinite(base) && base >= 0 && Number.isFinite(local)
    && new Date(local).toISOString().slice(0, 19) === `${match[1]}T${match[2]}`);
  const micros = Number((match[3] ?? '').padEnd(6, '0')), result = base + micros / 1000;
  check(result <= Number.MAX_SAFE_INTEGER && (micros === 0 || (result > base
    && base + (micros - 1) / 1000 < result && base + (micros + 1) / 1000 > result)));
  return result;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') { for (const v of Object.values(value)) freeze(v); Object.freeze(value); }
  return value;
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => sameJson(value, right[index]));
  const a = left as Row, b = right as Row;
  return Object.keys(a).length === Object.keys(b).length
    && Object.keys(a).every(key => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
}

// Validate the producer's retained command-entry visibility fact. This is not
// authentication of an export, a historical reconstruction or a global prefix.
function validateV4Receipt(source: Row, state: Row): void {
  const marked = text(source.policy_version).split('+').includes('v4-receipt-input-v1');
  if (!Object.hasOwn(state, 'nativeV4Receipt')) { check(!marked, 'incompatible-snapshots'); return; }
  check(marked && Object.hasOwn(state, 'finalScoringInput'), 'incompatible-snapshots');
  const receipt = row(state.nativeV4Receipt);
  keys(receipt, ['version', 'policy', 'profileId', 'actorUserId', 'sessionId', 'receiptRevision',
    'receiptTransaction', 'receiptAt', 'forecastTransaction', 'forecastAsOf', 'entrySnapshot']);
  check(receipt.version === 'native-v4-receipt-v1' && receipt.policy === 'CANONICAL_FORECAST_POOL_V4', 'unsupported-contract');
  check(uuid(receipt.profileId) === source.profile_id && uuid(receipt.actorUserId) === source.actor_user_id
    && uuid(receipt.sessionId) === source.session_id, 'incompatible-snapshots');
  integer(receipt.receiptRevision, 255);
  const xid = (value: unknown): bigint => {
    const raw = text(value, 20); check(/^[1-9][0-9]{0,19}$/u.test(raw));
    const result = BigInt(raw); check(result <= 18_446_744_073_709_551_615n); return result;
  };
  const receiptXid = xid(receipt.receiptTransaction), forecastXid = xid(receipt.forecastTransaction);
  const snapshot = text(receipt.entrySnapshot, 65_536);
  const match = /^([1-9][0-9]{0,19}):([1-9][0-9]{0,19}):((?:[1-9][0-9]{0,19})(?:,[1-9][0-9]{0,19})*)?$/u.exec(snapshot);
  check(match);
  const xmin = xid(match[1]), xmax = xid(match[2]), active = match[3]?.split(',').map(xid) ?? [];
  check(xmin <= xmax && active.every((value, i) => value >= xmin && value < xmax
    && (i === 0 || value > active[i - 1]!)));
  check(receiptXid !== forecastXid && receiptXid < xmax && !active.includes(receiptXid), 'incompatible-snapshots');
  for (const key of ['receiptAt', 'forecastAsOf']) {
    check(typeof receipt[key] === 'string' && receipt[key].length <= 32
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.test(receipt[key]));
  }
  const accepted = instant(receipt.receiptAt), forecast = instant(receipt.forecastAsOf);
  const request = row(state.candidateRequest), clocks = row(state.predictionInput);
  check(request.intent === 'EVALUATION' && request.acquisition === 'EXPLICIT_CANONICAL'
    && source.discovery_mode === 'FOR_YOU' && source.requested_item_type === null
    && accepted < forecast && forecast === instant(source.requested_at)
    && forecast === instant(clocks.nativeEvidenceAsOf) && accepted === instant(request.requiredAfter)
    && accepted === instant(clocks.requiredAfter), 'incompatible-snapshots');
}

// This is a trusted native producer binding, not authentication of arbitrary
// JSON or a claim that its source vector was available at a historical anchor.
function validateSharedConsumption(source: Row, state: Row): boolean {
  const marked = text(source.policy_version).split('+').includes('shared-prepared-input-v1');
  if (!Object.hasOwn(state, 'sharedPreparedInput')) { check(!marked, 'incompatible-snapshots'); return false; }
  check(marked && Object.hasOwn(state, 'finalScoringInput') && !Object.hasOwn(state, 'nativeV4Receipt'), 'incompatible-snapshots');
  const input = row(state.sharedPreparedInput), request = row(state.candidateRequest);
  keys(input, ['version', 'inputCaptureId', 'inputDigest', 'targetRoundId', 'targetExperienceId', 'targetItemId',
    'targetSourceCommandId', 'targetRevision', 'targetPrefixDigest', 'profileId', 'actorUserId', 'inputObservedAt',
    'consumedAt', 'featureVersion', 'featureInputDigest', 'fallback', 'predictorConsumption', 'forecastKind',
    'membershipValidity', 'commitVisibility']);
  check(input.version === 'shared-prepared-consumption-v1' && input.featureVersion === 'shared-prepared-ordinal-tags-v1'
    && input.predictorConsumption === 'RECORDED' && input.forecastKind === 'UNCALIBRATED_ORDINAL'
    && input.membershipValidity === 'CURRENT_FULL_ENROLLMENT_AT_CONSUMPTION'
    && input.commitVisibility === 'OWN_TRANSACTION_MVCC_VISIBLE_NOT_COMMIT_TIME'
    && ['SUPPORTED_ORDINAL_TAGS', 'NEUTRAL_COLD_START'].includes(text(input.fallback)), 'unsupported-contract');
  for (const key of ['inputCaptureId', 'targetRoundId', 'targetExperienceId', 'targetItemId', 'targetSourceCommandId']) uuid(input[key]);
  for (const key of ['inputDigest', 'targetPrefixDigest', 'featureInputDigest']) check(/^[0-9a-f]{32}$/u.test(text(input[key], 32)));
  integer(input.targetRevision, 4096, 1);
  check(uuid(input.profileId) === source.profile_id && uuid(input.actorUserId) === source.actor_user_id
    && source.session_id === null && source.discovery_mode === 'FOR_YOU' && source.requested_item_type === null
    && request.intent === 'EVALUATION' && request.acquisition === 'EXPLICIT_CANONICAL'
    && sameJson(request.itemIds, [input.targetItemId])
    && instant(input.inputObservedAt) === instant(request.requiredAfter)
    && instant(input.inputObservedAt) < instant(source.requested_at)
    && instant(input.consumedAt) >= instant(source.requested_at), 'incompatible-snapshots');
  return true;
}

// Optional historical generation, mandatory complete binding when marked. This
// validates the frozen input; the adapter still does not independently rescore.
function validateFinalInput(source: Row, state: Row, genome: Row, candidates: readonly unknown[]): void {
  if (!Object.hasOwn(state, 'finalScoringInput')) {
    check(candidates.every(candidate => !Object.hasOwn(row(row(candidate).explanation), 'finalScoringInput')),
      'incompatible-snapshots');
    return;
  }
  const marker = row(state.finalScoringInput);
  check(marker.version === 'native-final-scoring-input-v1' && marker.stage === 'FINAL'
    && marker.computation === 'FRESH_FINAL', 'unsupported-contract');
  check(instant(marker.requestedAt) === instant(source.requested_at), 'incompatible-snapshots');
  // The database limits its JSONB text envelope to 2 MiB. Exported JSON uses
  // compact UTF-8 encoding; independently bound that representation as well.
  const encoder = new TextEncoder();
  let inputBytes = encoder.encode(JSON.stringify(marker)).length;
  const expected = {
    version: 'native-final-scoring-input-v1', stage: 'FINAL', computation: 'FRESH_FINAL',
    predictionId: source.id, featureSourcePredictionId: source.id,
    actorUserId: source.actor_user_id, profileId: source.profile_id, sessionId: source.session_id,
    requestedAt: marker.requestedAt, itemType: source.requested_item_type, mode: source.discovery_mode,
    modelVersion: source.model_version, baseModelVersion: source.base_model_version, policyVersion: source.policy_version,
    context: source.context, candidateRequest: state.candidateRequest, predictionInput: state.predictionInput,
    sourceGenome: { id: source.genome_id, config: genome.config }, candidateCount: source.candidate_count,
    candidateIds: candidates.map(candidate => uuid(row(candidate).item_id)).sort(),
    ...(Object.hasOwn(state, 'nativeV4Receipt') ? { nativeV4Receipt: state.nativeV4Receipt } : {}),
    ...(Object.hasOwn(state, 'sharedPreparedInput') ? { sharedPreparedInput: state.sharedPreparedInput } : {}),
  };
  check(sameJson(marker, expected), 'incompatible-snapshots');
  for (const value of candidates) {
    const candidate = row(value), explanation = row(candidate.explanation), input = row(explanation.finalScoringInput);
    inputBytes += encoder.encode(JSON.stringify(input)).length;
    check(input.version === marker.version && input.stage === 'FINAL', 'unsupported-contract');
    const consumed: Row = {};
    for (const key of ['scoringFeatures', 'sharedCommonFit', 'resurfacingInput', 'resurfacingPolicy']) {
      consumed[key] = row(explanation[key]);
    }
    finite(row(consumed.sharedCommonFit).contribution);
    check(typeof row(consumed.resurfacingInput).eligible === 'boolean');
    if (Object.hasOwn(explanation, 'workingIntent')) consumed.workingIntent = row(explanation.workingIntent);
    check(sameJson(input, { version: marker.version, stage: 'FINAL', predictionId: source.id,
      itemId: candidate.item_id, sourceGenomeId: source.genome_id, scenarioScore: candidate.scenario_score,
      explanation: consumed }), 'incompatible-snapshots');
  }
  check(inputBytes <= 2_097_152);
}

/** Normalize complete fresh native rows; frozen-page continuation is a different contract. */
export function normalizeKajoNativePrediction(input: KajoNativePredictionSnapshot): FrozenRanking {
  assertRankingJson(input);
  const source = row(input.sourceRun), genome = row(input.sourceGenome), state = row(source.state_snapshot);
  validateV4Receipt(source, state);
  const sharedPrepared = validateSharedConsumption(source, state);
  validateFinalInput(source, state, genome, list(input.sourceCandidates, 50));
  const request = row(state.candidateRequest), clocks = row(state.predictionInput);
  keys(request, ['version', 'acquisition', 'intent', 'itemIds', 'seenItemIds', 'reminderSpent', 'requiredAfter']);
  keys(clocks, ['version', 'nativeEvidenceAsOf', 'memoryStateAsOf', 'scenarioAsOf', 'requestAsOf', 'workingStateAsOf',
    'arithmeticClock', 'eligibilityClock', 'dataSnapshot', 'historicalReconstruction', 'commitVisibility', 'candidateAcquisition', 'requiredAfter']);
  check(request.version === 'native-candidate-request-v1' && clocks.version === 'native-prediction-clocks-v1', 'unsupported-contract');
  const acquisition = text(request.acquisition), evaluation = request.intent === 'EVALUATION';
  check((evaluation && acquisition === 'EXPLICIT_CANONICAL') || (request.intent === 'DELIVERY'
    && (acquisition === 'LEGACY_DISCOVERY' || acquisition === 'CATALOG_CHAIN')), 'unsupported-contract');
  const requestedIds = request.itemIds === null ? null : ids(request.itemIds, 50), seen = ids(request.seenItemIds, 1000);
  check(typeof request.reminderSpent === 'boolean');
  check(evaluation ? requestedIds !== null && requestedIds.length > 0 : requestedIds === null, 'incompatible-snapshots');
  check(acquisition === 'CATALOG_CHAIN' || (seen.length === 0 && request.reminderSpent === false), 'incompatible-snapshots');
  if (request.requiredAfter !== null) check(typeof request.requiredAfter === 'string' && request.requiredAfter.length <= 32
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.test(request.requiredAfter));
  const observedAt = instant(input.snapshotObservedAt), requestedAt = instant(source.requested_at), recordedAt = instant(source.created_at);
  const evidenceAt = instant(clocks.nativeEvidenceAsOf), memoryAt = instant(clocks.memoryStateAsOf), scenarioAt = instant(clocks.scenarioAsOf);
  const workingAt = clocks.workingStateAsOf === null ? null : instant(clocks.workingStateAsOf);
  const requiredAfter = request.requiredAfter === null ? null : instant(request.requiredAfter);
  check(evidenceAt === memoryAt && evidenceAt === scenarioAt && evidenceAt <= requestedAt
    && instant(clocks.requestAsOf) === requestedAt && requestedAt <= observedAt && recordedAt <= observedAt
    && clocks.arithmeticClock === 'TRANSACTION_START' && clocks.dataSnapshot === 'CURRENT_STATEMENT_SNAPSHOTS'
    && clocks.commitVisibility === 'UNKNOWN' && clocks.historicalReconstruction === 'UNAVAILABLE'
    && clocks.candidateAcquisition === acquisition
    && (clocks.requiredAfter === null ? null : instant(clocks.requiredAfter)) === requiredAfter
    && clocks.eligibilityClock === (evaluation ? 'TRANSACTION_START' : 'CURRENT_WALL_TIME'), 'incompatible-snapshots');
  check(evaluation ? requiredAfter !== null && requiredAfter < evidenceAt && requestedAt === evidenceAt
    : requiredAfter === null, 'incompatible-snapshots');
  if (state.asOf !== undefined) check(instant(state.asOf) === memoryAt, 'incompatible-snapshots');
  if (workingAt !== null) {
    const working = row(state.workingState);
    check(instant(working.cutoff) === workingAt && instant(working.asOf) === workingAt && workingAt <= requestedAt,
      'incompatible-snapshots');
  } else check(state.workingState === undefined || state.workingState === null, 'incompatible-snapshots');
  const predictionId = uuid(source.id), profileId = uuid(source.profile_id), actorId = uuid(source.actor_user_id);
  const sessionId = source.session_id === null ? null : uuid(source.session_id), genomeId = uuid(source.genome_id);
  check(uuid(input.scope.profile.id) === profileId && uuid(input.scope.user.id) === actorId
    && input.scope.sessionId === (sessionId ?? ''), 'unauthorized-scope');
  check(input.scope.profile.type === 'PERSONAL' || input.scope.profile.type === 'SHARED');
  if (input.scope.profile.type === 'PERSONAL') uuid(input.scope.profile.ownerUserId);
  else ids(input.scope.profile.memberUserIds, 1000);
  check(sharedPrepared ? input.scope.profile.type === 'SHARED'
    : !evaluation || input.scope.profile.type === 'PERSONAL', 'unauthorized-scope');
  if (sharedPrepared) check(instant(row(state.sharedPreparedInput).consumedAt) <= observedAt, 'incompatible-snapshots');
  if (workingAt !== null) {
    const working = row(state.workingState), profile = row(working.profile);
    check(working.version === 'native-working-capture-v3' && uuid(working.captureId)
      && working.actorUserId === actorId && profile.id === profileId && profile.type === 'PERSONAL'
      && profile.ownerUserId === actorId, 'incompatible-snapshots');
    // The run retains the requested session reference. A missing/not-yet-available
    // owned session legitimately produces a NO_SESSION capture with session=null.
    if (working.session !== null) check(row(working.session).id === sessionId, 'incompatible-snapshots');
  }
  const provenanceSource = input.source ?? { kind: 'native', id: 'kajo' };
  text(provenanceSource.id);
  check(provenanceSource.kind === 'native' || provenanceSource.kind === 'generator');
  if (provenanceSource.kind === 'generator') { text(provenanceSource.version); list(provenanceSource.parentRefs, 1000).forEach(ref => text(ref)); }
  let scope: FrozenRanking['scope'];
  try { scope = createKajoAdapter(provenanceSource).encodeScope(input.scope); }
  catch { throw new KajoNativePredictionSnapshotError('unauthorized-scope'); }
  check(uuid(genome.id) === genomeId && instant(genome.created_at) <= requestedAt, 'incompatible-snapshots');
  const scoringArtifact: Record<string, RankingJson> = {};
  for (const key of ['id', 'genome_key', 'model_family', 'code_version', 'feature_version', 'memory_version', 'outcome_version', 'reward_version']) {
    scoringArtifact[key] = text(genome[key]);
  }
  scoringArtifact.config = row(genome.config) as { readonly [key: string]: RankingJson };
  scoringArtifact.recordedAt = instant(genome.created_at);
  const config = row(genome.config);
  check(config.schemaVersion === 'scalar-genome-v1' && genome.feature_version === 'prediction-features-v1'
    && genome.memory_version === 'memory-state-v1' && genome.outcome_version === 'outcome-precedence-v1'
    && genome.reward_version === 'outcome-reward-v1'
    && ((genome.model_family === 'PREDICTION_V1_BASELINE' && genome.genome_key === 'prediction-v1-baseline'
      && genome.code_version === 'prediction-v1.0+sleep-layer-v1')
      || (genome.model_family === 'SCALAR_V1' && genome.code_version === 'sleep-layer-scalar-v1')), 'unsupported-contract');
  const weights = row(config.modeWeights);
  for (const mode of ['FOR_YOU', 'SURPRISE', 'RISK']) {
    const modeWeights = row(weights[mode]);
    for (const key of ['direct', 'longTerm', 'shortTerm', 'novelty', 'exploration', 'scenario', 'reactionPenalty', 'impressionCooldown']) {
      const weight = finite(modeWeights[key]); check(weight >= 0 && weight <= 4);
    }
  }
  const model = text(source.model_version), baseModel = text(source.base_model_version), policy = text(source.policy_version);
  check(model === 'prediction-v1.0' && baseModel === (state.sourceFusion !== undefined
    ? 'prediction-v0.6-personal-source-fusion' : 'prediction-v0.5-native-decay'), 'unsupported-contract');
  const sharedFit = policy.includes('+shared-common-fit-v1.1');
  check(sharedFit === (input.scope.profile.type === 'SHARED') && (workingAt !== null) === (input.scope.profile.type === 'PERSONAL'),
    'incompatible-snapshots');
  const expectedPolicy = `scenario-memory-v1+resurfacing-v1${sharedFit ? '+shared-common-fit-v1.1' : ''}`
    + '+outcome-attribution-v1+frozen-replay-v2+eligibility-first-v1'
    + (acquisition === 'CATALOG_CHAIN' ? '+catalog-chain-v1' : '')
    + (evaluation ? '+evaluation-candidates-v1' : '') + (workingAt !== null ? '+personal-working-off-v3' : '')
    + (sharedPrepared ? '+shared-prepared-input-v1' : '')
    + (Object.hasOwn(state, 'nativeV4Receipt') ? '+v4-receipt-input-v1' : '');
  check(policy === expectedPolicy, 'unsupported-contract');
  const mode = text(source.discovery_mode); check(['FOR_YOU', 'SURPRISE', 'RISK'].includes(mode));
  const itemType = source.requested_item_type; check(itemType === null || itemType === 'BOOK' || itemType === 'MOVIE');
  const count = integer(source.candidate_count, 50), delivered = integer(source.result_count, count);
  check(!evaluation || delivered === 0, 'incompatible-snapshots');
  if (sharedPrepared) check(count === 1, 'incompatible-snapshots');
  if (evaluation) {
    const evaluationInput = row(state.evaluationInput);
    check(evaluationInput.version === (sharedPrepared ? 'shared-round-evaluation-v1' : 'personal-evaluation-v1')
      && evaluationInput.scope === 'REQUESTED_CANDIDATES'
      && evaluationInput.calibration === 'UNCALIBRATED_ORDINAL'
      && instant(evaluationInput.evidenceCutoff) === evidenceAt && instant(evaluationInput.requiredAfter) === requiredAfter
      && JSON.stringify(ids(evaluationInput.candidateIds, 50)) === JSON.stringify(requestedIds), 'incompatible-snapshots');
  }
  const candidates: FrozenRankingCandidate[] = list(input.sourceCandidates, 50).map(value => {
    const candidate = row(value), objectId = uuid(candidate.item_id), explanation = row(candidate.explanation);
    if (sharedPrepared) {
      const prepared = row(state.sharedPreparedInput), fit = row(explanation.sharedCommonFit);
      check(objectId === prepared.targetItemId && fit.sourceBasis === 'SHARED_PREPARED_ORDINAL_TAGS_V1'
        && fit.preparedInputDigest === prepared.inputDigest && fit.featureInputDigest === prepared.featureInputDigest
        && fit.fallback === prepared.fallback, 'incompatible-snapshots');
    }
    check(uuid(candidate.prediction_id) === predictionId && instant(candidate.created_at) <= observedAt
      && explanation.policyVersion === policy && explanation.version === model && explanation.baseVersion === baseModel,
    'incompatible-snapshots');
    check((requestedIds === null || requestedIds.includes(objectId)) && !seen.includes(objectId), 'incompatible-snapshots');
    const scalar = row(explanation.scalarGenome), features = row(explanation.scoringFeatures), pool = row(explanation.candidatePool);
    if (workingAt !== null) {
      const working = row(state.workingState), intent = row(explanation.workingIntent);
      check(intent.version === 'personal-working-features-v3' && intent.captureVersion === working.version
        && intent.captureId === working.captureId && intent.control === 'OFF', 'incompatible-snapshots');
    } else check(explanation.workingIntent === undefined, 'incompatible-snapshots');
    check(uuid(scalar.genomeId) === genomeId && scalar.genomeKey === genome.genome_key
      && scalar.baselineEquivalent === (genome.genome_key === 'prediction-v1-baseline'), 'incompatible-snapshots');
    check(features.version === 'prediction-features-v2' && features.nativeDecayVersion === 'native-long-term-decay-v2'
      && instant(features.nativeEvidenceAsOf) === evidenceAt, 'incompatible-snapshots');
    for (const key of ['direct', 'longTerm', 'shortTerm', 'novelty', 'exploration', 'reactionQueuePenalty', 'impressionCooldownPenalty']) finite(features[key]);
    const eligibilityAt = instant(pool.eligibilityAt), retainedLimit = integer(pool.retainedLimit, 50, 1);
    const retainedCount = integer(pool.retainedCount, 50);
    const considered = integer(pool.consideredCount, Number.MAX_SAFE_INTEGER);
    // Base acquisition can be larger than the identity owner's final shortlist.
    check(pool.version === 'eligibility-first-v1' && count <= retainedCount
      && retainedCount === Math.min(retainedLimit, considered)
      && (evaluation ? eligibilityAt === evidenceAt : eligibilityAt >= requestedAt && eligibilityAt <= observedAt),
    'incompatible-snapshots');
    integer(pool.baselineScoreRank, considered, 1); integer(pool.admissionRank, retainedCount, 1);
    for (const key of ['ordinaryCount', 'reminderEligibleCount', 'suppressedCount']) integer(pool[key], considered);
    if (acquisition === 'CATALOG_CHAIN') {
      check(pool.catalogChainVersion === 'catalog-chain-v1' && pool.seenCount === seen.length
        && pool.reminderPreviouslyDelivered === request.reminderSpent
        && /^[0-9a-f]{32}$/u.test(text(pool.seenPrefixHash, 32)), 'incompatible-snapshots');
    } else check(pool.catalogChainVersion === undefined && pool.seenCount === undefined
      && pool.reminderPreviouslyDelivered === undefined && pool.seenPrefixHash === undefined, 'incompatible-snapshots');
    if (evaluation) {
      const evaluationFeatures = row(explanation.evaluationFeatures);
      check(evaluationFeatures.version === 'canonical-item-tags-v1'
        && ['MOVIE', 'BOOK'].includes(text(evaluationFeatures.itemType))
        && (itemType === null || evaluationFeatures.itemType === itemType), 'incompatible-snapshots');
      list(evaluationFeatures.tags, 2048).forEach(tag => text(tag));
    } else check(explanation.evaluationFeatures === undefined, 'incompatible-snapshots');
    const resurfacing = row(explanation.resurfacingPolicy); check(typeof resurfacing.eligible === 'boolean');
    const eligible = resurfacing.eligible, tier = !eligible ? 2 : resurfacing.classification === 'SAVED_REMINDER' ? 1 : 0;
    const rank = integer(candidate.final_rank, count, 1), selected = candidate.selected_for_delivery;
    check(typeof selected === 'boolean' && selected === (!evaluation && tier < 2 && rank <= delivered), 'incompatible-snapshots');
    for (const key of ['confidence', 'scenario_max_similarity', 'selection_probability']) {
      if (key === 'selection_probability' && candidate[key] === null) continue;
      const value = finite(candidate[key]); check(value >= 0 && value <= 1);
    }
    return { actionId: `recommend:${objectId}`, objectId, sourceScore: finite(candidate.source_score),
      sourceRank: integer(candidate.source_rank, count, 1), score: finite(candidate.final_score), rank, eligible, tier, selected,
      inputs: { explanation: explanation as { readonly [key: string]: RankingJson }, scenarioScore: finite(candidate.scenario_score),
        confidence: finite(candidate.confidence), scenarioSupport: integer(candidate.scenario_support, Number.MAX_SAFE_INTEGER),
        scenarioMaxSimilarity: finite(candidate.scenario_max_similarity), selectionProbability: candidate.selection_probability === null
          ? null : finite(candidate.selection_probability), recordedAt: instant(candidate.created_at), sourcePredictionId: predictionId } };
  });
  check(candidates.length === count && new Set(candidates.map(c => c.objectId)).size === count
    && new Set(candidates.map(c => c.rank)).size === count && new Set(candidates.map(c => c.sourceRank)).size === count
    && candidates.filter(c => c.selected).length === delivered, 'incompatible-snapshots');
  const sourceOrder = [...candidates].sort((a, b) => a.tier - b.tier || b.sourceScore - a.sourceScore
    || (a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0));
  check(sourceOrder.every((candidate, index) => candidate.sourceRank === index + 1), 'incompatible-snapshots');
  candidates.sort((a, b) => a.tier - b.tier || b.score - a.score || (a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0));
  check(candidates.every((candidate, index) => candidate.rank === index + 1), 'incompatible-snapshots');
  const record: Provenance = provenanceSource.kind === 'generator'
    ? { recordId: predictionId, revision: 1, origin: 'synthetic', source: provenanceSource }
    : { recordId: predictionId, revision: 1, origin: 'observed', source: provenanceSource };
  const result: FrozenRanking = { version: 'frozen-ranking-v1', predictionId, scope, sessionBinding: sessionId,
    acquisition: { version: request.version, policy: acquisition, requestedObjectIds: requestedIds, seenObjectIds: seen,
      reminderSpent: request.reminderSpent }, intent: evaluation ? 'EVALUATION' : 'DELIVERY', mode, itemType,
    versions: { model, baseModel, policy, genome: genomeId },
    clocks: { version: clocks.version, evidenceAsOf: evidenceAt, memoryAsOf: memoryAt, scenarioAsOf: scenarioAt,
      requestAsOf: requestedAt, workingAsOf: workingAt, requiredAfter, arithmeticClock: 'TRANSACTION_START',
      eligibilityClock: evaluation ? 'TRANSACTION_START' : 'CURRENT_WALL_TIME', dataSnapshot: 'CURRENT_STATEMENT_SNAPSHOTS',
      commitVisibility: 'UNKNOWN', historicalReconstruction: 'UNAVAILABLE' },
    provenance: { record, recordedAt, snapshotObservedAt: observedAt, observation: 'frozen-records', availability: 'stored-timestamps-only' },
    scoringArtifact, inputSnapshot: source as { readonly [key: string]: RankingJson },
    constraints: { version: 'native-retained-eligibility-v1', allowedActionIds: candidates.filter(c => c.eligible).map(c => c.actionId) },
    scoreMeaning: 'ordinal-ranking-score', calibration: 'uncalibrated', candidates };
  return freeze(structuredClone(result));
}
