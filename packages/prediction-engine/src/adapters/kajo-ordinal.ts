import type { Observation, TargetDefinition } from '../contracts.js';
import type { OrdinalPairInput, OrdinalParticipant, OrdinalRound } from '../ordinal.js';

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DIGEST = /^[0-9a-f]{32}$/;
const MAX_BYTES = 8_388_608;
const MODES = ['FOR_YOU', 'SURPRISE', 'RISK'];
const target: TargetDefinition = { id: 'kajo:shared-ordinal-experience', version: '1',
  scale: { min: 0, max: 10 }, conditioning: 'action-outcome', exposure: 'required', objective: 'maximize' };
Object.freeze(target.scale); Object.freeze(target);

export interface KajoOrdinalSnapshots {
  readonly pairId: string;
  readonly leftComparison: unknown;
  readonly rightComparison: unknown;
  readonly anchor: { readonly sourcePredictionId: string; readonly actorUserId: string };
  readonly evaluationAsOf: number;
  /** Explicit owner-supplied scoped handles; these are not pseudonymous IDs. */
  readonly references: { readonly scopeId: string; readonly subjectRef: string; readonly members: readonly {
    readonly actorUserId: string; readonly membershipGeneration: string;
    readonly memberRef: string; readonly enrollmentRef: string;
  }[] };
}

export class KajoOrdinalSnapshotError extends Error {
  constructor(readonly code: 'invalid-snapshot' | 'budget-exceeded' | 'incompatible-snapshots' | 'anchor-unavailable' | 'anchor-late') {
    super(`Kajo ordinal snapshot rejected: ${code}`);
    this.name = 'KajoOrdinalSnapshotError';
  }
}
function check(value: unknown, code: KajoOrdinalSnapshotError['code'] = 'invalid-snapshot'): asserts value {
  if (!value) throw new KajoOrdinalSnapshotError(code);
}
function row(value: unknown): Row {
  check(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Row;
}
function list(value: unknown, maximum: number, minimum = 0): unknown[] {
  check(Array.isArray(value));
  check(value.length <= maximum, 'budget-exceeded');
  check(value.length >= minimum);
  return value;
}
function text(value: unknown, maximum = 256): string {
  check(typeof value === 'string' && value.length > 0 && value.length <= maximum);
  return value;
}
function uuid(value: unknown): string { const result = text(value, 36); check(UUID.test(result)); return result; }
function digest(value: unknown): string { const result = text(value, 32); check(DIGEST.test(result)); return result; }
function finite(value: unknown): number { check(typeof value === 'number' && Number.isFinite(value)); return value; }
function integer(value: unknown, maximum: number, minimum = 0): number {
  const result = finite(value); check(Number.isInteger(result) && result >= minimum && result <= maximum); return result;
}
function instant(value: unknown): number {
  const result = text(value, 40);
  // Preserve microseconds: Date.parse alone truncates legitimate pre-OPEN gaps.
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|\+00:00)$/.exec(result);
  check(match);
  const base = Date.parse(`${match[1]}T${match[2]}Z`);
  check(Number.isFinite(base) && new Date(base).toISOString().slice(0, 19) === `${match[1]}T${match[2]}`);
  return base + Number(`0.${match[3] ?? '0'}`) * 1000;
}
function same(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, i) => same(item, right[i]));
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  const a = row(left); const b = row(right); const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
function boundedJson(value: unknown): void {
  let nodes = 0; let bytes = 0;
  const active = new Set<object>();
  const encoder = new TextEncoder();
  const visit = (item: unknown, depth: number): void => {
    check(++nodes <= 1_000_000 && depth <= 48, 'budget-exceeded');
    if (item === null || typeof item === 'boolean') bytes += 5;
    else if (typeof item === 'number') { finite(item); bytes += String(item).length; }
    else if (typeof item === 'string') bytes += encoder.encode(JSON.stringify(item)).length;
    else {
      check(typeof item === 'object' && item !== null);
      check(!active.has(item)); active.add(item);
      if (Array.isArray(item)) { check(item.length <= 2048, 'budget-exceeded'); item.forEach(entry => visit(entry, depth + 1)); bytes += item.length + 2; }
      else {
        check(Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null);
        const entries = Object.entries(item); check(entries.length <= 4096, 'budget-exceeded');
        for (const [key, entry] of entries) { bytes += encoder.encode(JSON.stringify(key)).length + 2; visit(entry, depth + 1); }
      }
      active.delete(item);
    }
    check(bytes <= MAX_BYTES, 'budget-exceeded');
  };
  visit(value, 0);
  check(encoder.encode(JSON.stringify(value)).length <= MAX_BYTES, 'budget-exceeded');
}
function flags(value: Row): void {
  check(value.historicalFeatureEligible === false && value.learnable === false && value.groupReward === null);
}
function participants(value: unknown): OrdinalParticipant[] {
  const result = list(value, 32, 2).map(member => {
    const p = row(member); return { actorId: uuid(p.actorUserId), enrollmentId: uuid(p.membershipGeneration) };
  }).sort((a, b) => a.actorId.localeCompare(b.actorId));
  check(new Set(result.map(p => p.actorId)).size === result.length);
  return result;
}
function rankSet(pool: Row[], key: string): void {
  const ranks = pool.map(candidate => integer(candidate[key], pool.length, 1));
  check(new Set(ranks).size === pool.length);
}
interface FrozenPair { readonly actorId: string; readonly source: Row; readonly shadow: Row;
  readonly sourcePool: Row[]; readonly shadowPool: Row[]; readonly mode: string; readonly domain: string }
interface Snapshot { readonly artifact: Row; readonly outcome: Row; readonly round: OrdinalRound;
  readonly profileId: string; readonly window: Row; readonly genome: Row; readonly pairs: FrozenPair[] }

function normalizeComparison(value: unknown, evaluationAsOf: number): Snapshot {
  boundedJson(value);
  const artifact = row(value); flags(artifact);
  check(artifact.contractVersion === 'shared-round-vector-comparison-v1'
    && artifact.interpretationVersion === 'shared-round-outcome-v1'
    && artifact.metricVersion === 'shared-round-paired-support-v1'
    && artifact.usage === 'OUTCOME_EVIDENCE_ONLY'
    && artifact.comparisonBasis === 'SAME_FROZEN_VECTOR_AND_COMMON_SUPPORT_MASK'
    && artifact.supportStatus === 'COMPLETE_VECTOR_SUPPORTED' && artifact.vectorComparisonEligible === true
    && artifact.productionMetric === null && artifact.challengerMetric === null && artifact.advantage === null);
  const captureId = uuid(artifact.captureId); const comparisonId = uuid(artifact.comparisonId);
  const observedAt = instant(artifact.observedAt); check(observedAt <= evaluationAsOf);
  const window = row(artifact.evaluationWindow); const genome = row(artifact.genome);
  check(uuid(window.id) === uuid(artifact.evaluationWindowId) && uuid(genome.id) === uuid(artifact.genomeId));
  const predictionFrom = instant(window.prediction_from); const predictionUntil = instant(window.prediction_until);
  const inputCutoff = instant(window.input_cutoff); const outcomeCutoff = instant(window.outcome_cutoff);
  check(predictionFrom < predictionUntil && predictionUntil <= inputCutoff && inputCutoff < outcomeCutoff
    && outcomeCutoff <= observedAt && instant(genome.created_at) <= inputCutoff);
  for (const key of ['memory_version', 'outcome_version', 'reward_version', 'code_version', 'feature_version']) text(genome[key]);
  check(window.metric_version === 'signed-exposed-rank-utility-v1' && window.reward_version === 'outcome-reward-v1');
  const outcome = row(artifact.capturedOutcome); flags(outcome);
  check(outcome.contractVersion === 'shared-round-outcome-v1' && outcome.sourceBasis === 'COMMAND_RECEIPT_PREFIX'
    && outcome.availabilityBasis === 'SERVER_COMMAND_ACCEPTED_AT' && outcome.membershipValidity === 'HISTORICAL_MEMBERSHIP_UNKNOWN'
    && outcome.commitVisibility === 'UNKNOWN' && outcome.vectorStatus === 'READY_FOR_VECTOR_REVIEW'
    && instant(outcome.outcomeCutoff) === outcomeCutoff);
  const evidenceCutoff = instant(outcome.evidenceCutoff); check(evidenceCutoff <= observedAt);
  const frozen = row(outcome.round);
  check(frozen.version === 1 && frozen.state === 'COMPLETED' && frozen.learnable === false && frozen.groupReward === null);
  const enrolled = participants(frozen.participants); const profileId = uuid(frozen.profileId);
  const roundId = uuid(frozen.roundId); const experienceId = uuid(frozen.experienceId); const objectId = uuid(frozen.itemId);
  const revision = integer(frozen.revision, 4096, 1); const setVersion = integer(frozen.participantSetVersion, 4096, 1);
  const openedAt = instant(frozen.createdAt); check(instant(frozen.updatedAt) >= openedAt);
  const source = row(outcome.source); uuid(source.commandId);
  check(source.revision === revision && source.participantSetVersion === setVersion);
  const acceptedAt = instant(source.acceptedAt); check(acceptedAt <= Math.min(outcomeCutoff, evidenceCutoff));
  check(acceptedAt === instant(frozen.updatedAt));
  const maturity = row(outcome.maturity); const seconds = finite(maturity.intervalSeconds);
  check(seconds >= 0 && seconds <= 7_776_000 && maturity.isMature === true);
  const maturityAnchor = instant(maturity.anchorAt); const matureAt = instant(maturity.matureAt);
  check(maturityAnchor >= acceptedAt && maturityAnchor >= openedAt
    && Math.abs(matureAt - maturityAnchor - seconds * 1000) <= 0.001
    && matureAt <= Math.min(outcomeCutoff, evidenceCutoff));
  const coverage = row(outcome.coverage); const count = enrolled.length;
  check(coverage.participantCount === count && coverage.ratedCount === count && coverage.attributedRatingCount === count
    && coverage.eligibleVectorResponseCount === count && coverage.unansweredCount === 0 && coverage.unknownCount === 0 && coverage.clearedCount === 0);
  const pairedCoverage = row(artifact.coverage);
  check(pairedCoverage.participantCount === count && pairedCoverage.supportedParticipantCount === count
    && pairedCoverage.unsupportedParticipantCount === 0 && pairedCoverage.roundObservationCount === 1);
  const mask = list(artifact.commonSupportMask, 32, 2).map(uuid);
  check(same(mask, enrolled.map(p => p.actorId)));
  const outcomeDigest = digest(artifact.outcomeDigest); const maskDigest = digest(artifact.commonSupportDigest);
  for (const key of ['production', 'shadow']) {
    const binding = row(artifact[key]);
    check(binding.captureId === captureId && digest(binding.outcomeDigest) === outcomeDigest
      && digest(binding.supportDigest) === maskDigest && same(binding.supportMask, mask));
  }
  const responses = list(outcome.responses, 32, 2).map(row); const raw = list(frozen.responses, 32, 2).map(row);
  const pairs = list(artifact.pairs, 32, 2).map(row);
  check(responses.length === count && raw.length === count && pairs.length === count);
  for (const rows of [responses, raw, pairs]) check(new Set(rows.map(response => uuid(response.actorUserId))).size === count
    && rows.every(response => enrolled.some(p => p.actorId === response.actorUserId)));
  const normalizedPairs: FrozenPair[] = [];
  const normalizedResponses = enrolled.map(member => {
    const response = responses.find(r => r.actorUserId === member.actorId)!;
    const original = raw.find(r => r.actorUserId === member.actorId)!;
    const pair = pairs.find(p => p.actorUserId === member.actorId)!;
    check(Object.keys(original).every(key => same(original[key], response[key])) && response.status === 'RATED'
      && pair.supportStatus === 'SUPPORTED');
    const rating = integer(response.rating, 10); const responseRevision = integer(response.responseRevision, revision, 1);
    check(pair.rating === rating && pair.responseRevision === responseRevision);
    const receivedAt = instant(response.receivedAt); check(receivedAt >= openedAt && receivedAt <= maturityAnchor
      && receivedAt <= Math.min(outcomeCutoff, evidenceCutoff));
    const origin = row(response.origin); const attribution = row(response.attribution);
    const sourceId = uuid(pair.sourcePredictionId); const shadowId = uuid(pair.shadowPredictionId);
    check(uuid(attribution.predictionId) === sourceId && uuid(origin.claimedPredictionId) === sourceId);
    if (attribution.status === 'VALIDATED_TRACE') {
      check(origin.status === 'VALIDATED_TRACE' && uuid(origin.predictionId) === sourceId
        && attribution.proofEventId === null && attribution.proofOccurredAt === null
        && attribution.proofAvailableAt === null && attribution.proofAvailabilityBasis === null);
    } else {
      check(attribution.status === 'LATE_EXPOSURE_V1' && origin.status === 'UNATTRIBUTED' && origin.predictionId === null
        && attribution.proofAvailabilityBasis === 'STORED_EVENT_CREATED_AT');
      uuid(attribution.proofEventId);
      check(instant(attribution.proofOccurredAt) <= receivedAt && instant(attribution.proofAvailableAt) <= evidenceCutoff);
    }
    const productionTrace = row(pair.productionTrace); const shadowTrace = row(pair.shadowTrace);
    const run = row(productionTrace.run); const shadow = row(shadowTrace.run);
    row(run.context); row(run.state_snapshot); row(shadow.context); row(shadow.state_snapshot);
    check(instant(run.created_at) <= observedAt && instant(shadow.created_at) <= observedAt);
    const at = instant(run.requested_at); const mode = text(run.discovery_mode); const domain = text(run.requested_item_type);
    check(uuid(run.id) === sourceId && uuid(run.profile_id) === profileId && uuid(run.actor_user_id) === member.actorId
      && uuid(run.session_id) === uuid(origin.sessionId) && MODES.includes(mode) && origin.discoveryMode === mode
      && (domain === 'BOOK' || domain === 'MOVIE') && at >= predictionFrom && at < predictionUntil && at <= inputCutoff && at <= receivedAt);
    if (attribution.status === 'LATE_EXPOSURE_V1') check(instant(attribution.proofOccurredAt) >= at);
    const policy = text(run.policy_version); const expectedCode = policy.split('+').includes('frozen-page-v1') ? 'shadow-page-replay-v1' : 'shadow-replay-v2';
    check(policy.split('+').includes('frozen-replay-v2'));
    check(uuid(shadow.id) === shadowId && uuid(shadow.source_prediction_id) === sourceId && uuid(shadow.genome_id) === artifact.genomeId
      && shadow.profile_id === profileId && shadow.actor_user_id === member.actorId && shadow.session_id === run.session_id
      && shadow.requested_item_type === domain && shadow.discovery_mode === mode && instant(shadow.as_of) === at
      && shadow.source_model_version === text(run.model_version) && shadow.source_policy_version === policy
      && shadow.code_version === expectedCode && shadow.feature_version === 'prediction-features-v2'
      && shadow.memory_version === genome.memory_version && shadow.outcome_version === genome.outcome_version
      && shadow.reward_version === genome.reward_version && same(shadow.context, run.context) && same(shadow.state_snapshot, run.state_snapshot));
    const sourcePool = list(productionTrace.candidates, 1000, 1).map(row); const shadowPool = list(shadowTrace.candidates, 1000, 1).map(row);
    check(sourcePool.length === shadowPool.length && integer(run.candidate_count, 1000, 1) === sourcePool.length
      && shadow.candidate_count === sourcePool.length);
    const delivered = integer(run.result_count, sourcePool.length, 1);
    check(shadow.hypothetical_result_count === delivered);
    for (const [pool, ranks] of [[sourcePool, ['sourceRank', 'finalRank']], [shadowPool, ['sourceRank', 'productionFinalRank', 'shadowRank']]] as const) {
      check(new Set(pool.map(candidate => uuid(candidate.itemId))).size === pool.length);
      for (const rank of ranks) rankSet(pool, rank);
    }
    for (const candidate of sourcePool) {
      const counterpart = shadowPool.find(c => c.itemId === candidate.itemId); check(counterpart);
      check(counterpart.sourceRank === candidate.sourceRank && counterpart.productionFinalRank === candidate.finalRank
        && finite(counterpart.sourceScore) === finite(candidate.sourceScore)
        && finite(counterpart.productionFinalScore) === finite(candidate.finalScore)
        && typeof candidate.selectedForDelivery === 'boolean' && typeof counterpart.hypotheticalSelected === 'boolean');
      finite(counterpart.shadowScore);
      for (const key of ['explanationChecksum', 'scoringFeaturesChecksum', 'resurfacingInputChecksum']) digest(candidate[key]);
      digest(counterpart.explanationChecksum);
    }
    check(sourcePool.filter(c => c.selectedForDelivery === true).length === delivered
      && shadowPool.filter(c => c.hypotheticalSelected === true).length === delivered);
    const sourceItem = sourcePool.find(c => c.itemId === objectId); const shadowItem = shadowPool.find(c => c.itemId === objectId);
    check(sourceItem && shadowItem && sourceItem.selectedForDelivery === true);
    const production = row(pair.production); const challenger = row(pair.shadow);
    check(production.rank === sourceItem.finalRank && production.selectedForDelivery === true
      && production.modelVersion === run.model_version && production.policyVersion === policy
      && challenger.rank === shadowItem.shadowRank && challenger.hypotheticalSelected === shadowItem.hypotheticalSelected
      && challenger.codeVersion === shadow.code_version && challenger.featureVersion === shadow.feature_version
      && challenger.memoryVersion === shadow.memory_version && challenger.outcomeVersion === shadow.outcome_version
      && challenger.rewardVersion === shadow.reward_version);
    normalizedPairs.push({ actorId: member.actorId, source: run, shadow, sourcePool, shadowPool, mode, domain });
    const observation: Observation = { subjectId: profileId, actingIdentityRef: member.actorId, objectId, actionId: experienceId,
      predictionId: sourceId, targetId: target.id, targetVersion: target.version, measurement: { status: 'observed', value: rating },
      raw: { value: rating, scale: target.scale }, occurredAt: receivedAt, availableAt: observedAt, exposure: 'verified',
      access: { kind: 'subject', subjectId: profileId }, provenance: { recordId: `${roundId}:response:${responseRevision}`,
        revision: responseRevision, origin: 'observed', source: { kind: 'native', id: 'kajo-shared-round-outcome-v1' } } };
    return { ...member, status: 'rated' as const, observation };
  });
  check(normalizedPairs.every(pair => pair.mode === normalizedPairs[0]?.mode && pair.domain === normalizedPairs[0]?.domain));
  return { artifact, outcome, profileId, window, genome, pairs: normalizedPairs,
    round: { roundId, experienceId, objectId, openedAt, matureAt, participants: enrolled, responses: normalizedResponses,
      capture: { id: captureId, revision, availableAt: observedAt, availabilityBasis: 'observed-comparison-time', comparisonId } } };
}

/** No reads/writes/providers. The owner supplies authorized immutable artifacts
 * and scoped handles. Declared digests are neither recomputed nor authenticated.
 * The resulting lineage is ephemeral owner audit data, not candidate/UI data. */
export function normalizeKajoOrdinalPair(input: KajoOrdinalSnapshots): OrdinalPairInput {
  check(input !== null && typeof input === 'object');
  const pairId = text(input.pairId, 128); const evaluationAsOf = finite(input.evaluationAsOf);
  const left = normalizeComparison(input.leftComparison, evaluationAsOf); const right = normalizeComparison(input.rightComparison, evaluationAsOf);
  check(left.profileId === right.profileId && same(left.window, right.window) && same(left.genome, right.genome)
    && same(left.round.participants, right.round.participants)
    && instant(left.outcome.evidenceCutoff) === instant(right.outcome.evidenceCutoff)
    && row(left.outcome.maturity).intervalSeconds === row(right.outcome.maturity).intervalSeconds
    && left.pairs[0]?.domain === right.pairs[0]?.domain && left.pairs[0]?.mode === right.pairs[0]?.mode, 'incompatible-snapshots');
  check(left.round.roundId !== right.round.roundId && left.round.experienceId !== right.round.experienceId
    && left.round.objectId !== right.round.objectId && left.round.capture.id !== right.round.capture.id, 'incompatible-snapshots');
  const references = row(input.references); const scopeId = text(references.scopeId, 64);
  check(/^[A-Za-z0-9._-]+$/.test(scopeId));
  const subjectRef = text(references.subjectRef, 128); const members = list(references.members, 32, 2).map(row);
  check(members.length === left.round.participants.length);
  const aliases = new Map<string, { actorId: string; enrollmentId: string }>();
  const rawIds = [left.profileId, ...left.round.participants.flatMap(p => [p.actorId, p.enrollmentId])];
  const used = new Set<string>();
  const handle = (value: unknown): string => {
    const ref = text(value, 128);
    check(ref.startsWith(`${scopeId}:`) && ref.length > scopeId.length + 1
      && !rawIds.some(id => ref.toLowerCase().includes(id)) && !used.has(ref));
    used.add(ref); return ref;
  };
  handle(subjectRef);
  for (const member of members) {
    const rawActor = uuid(member.actorUserId); const generation = uuid(member.membershipGeneration);
    check(!aliases.has(rawActor) && left.round.participants.some(p => p.actorId === rawActor && p.enrollmentId === generation));
    aliases.set(rawActor, { actorId: handle(member.memberRef), enrollmentId: handle(member.enrollmentRef) });
  }
  const scopedRound = (round: OrdinalRound): OrdinalRound => ({ ...round,
    participants: round.participants.map(p => aliases.get(p.actorId)!),
    responses: round.responses.map(response => ({ ...response, ...aliases.get(response.actorId)!,
      observation: response.observation === null ? null : { ...response.observation, subjectId: subjectRef,
        actingIdentityRef: aliases.get(response.actorId)!.actorId, access: { kind: 'subject' as const, subjectId: subjectRef } } })) });
  const requestedAnchor = row(input.anchor);
  const actorId = uuid(requestedAnchor.actorUserId); const sourceId = uuid(requestedAnchor.sourcePredictionId);
  const anchor = left.pairs.find(pair => pair.actorId === actorId && pair.source.id === sourceId);
  check(anchor, 'anchor-unavailable');
  const frozenAt = instant(anchor.source.requested_at);
  check(frozenAt < left.round.openedAt && frozenAt < right.round.openedAt, 'anchor-late');
  check(anchor.sourcePool.some(c => c.itemId === left.round.objectId) && anchor.sourcePool.some(c => c.itemId === right.round.objectId), 'anchor-unavailable');
  check(left.round.participants.some(p => p.actorId === actorId), 'anchor-unavailable');
  return { pairId, evaluationAsOf, target,
    integrityBasis: 'TRUSTED_OWNER_SNAPSHOT_DECLARED_DIGEST_BINDINGS',
    scope: { subject: { id: subjectRef, kind: 'group' }, actingIdentityRef: aliases.get(actorId)!.actorId, sessionRef: uuid(anchor.source.session_id),
      evidence: { sourceIds: ['kajo-shared-round-outcome-v1'], cohortIds: [], synthetic: 'exclude' } },
    left: scopedRound(left.round), right: scopedRound(right.round), anchor: { id: sourceId, subjectId: subjectRef, actorId: aliases.get(actorId)!.actorId,
      frozenAt, availableAt: left.round.capture.availableAt, timestampBasis: 'stored-request-time', sourcePredictionId: sourceId,
      shadowPredictionId: uuid(anchor.shadow.id), pool: anchor.sourcePool.map(candidate => {
        const shadow = anchor.shadowPool.find(c => c.itemId === candidate.itemId)!;
        return { objectId: uuid(candidate.itemId), production: { score: finite(candidate.finalScore), rank: integer(candidate.finalRank, 1000, 1) },
          shadow: { score: finite(shadow.shadowScore), rank: integer(shadow.shadowRank, 1000, 1) } };
      }) } };
}
