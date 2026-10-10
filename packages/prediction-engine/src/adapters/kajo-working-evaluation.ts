import type { WorkingEvaluationPlanInput } from '../working-evaluation.js';
import type { PredictionObject } from '../contracts.js';
import { deriveWorkingState, scoreWorkingAdjustment, workingConfigDefaults } from '../working-state.js';
import type { WorkingFeatureSchema } from '../working-state.js';
import { normalizeKajoWorkingSession } from './kajo-working-state.js';
import type { KajoWorkingSessionInput } from './kajo-working-state.js';

type Row = Record<string, unknown>;
type Control = 'OFF' | 'STATIC' | 'ORDERED';
const controls: readonly Control[] = ['OFF', 'STATIC', 'ORDERED'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** A trusted caller supplies already-authorized immutable native snapshots. */
export interface KajoWorkingEvaluationSnapshots {
  readonly actorUserId: string;
  readonly profile: { readonly id: string; readonly type: 'PERSONAL'; readonly ownerUserId: string };
  readonly sourceRun: unknown;
  readonly sourceCandidates: readonly unknown[];
  /** Complete table rows, including created_at; result.asOf is the input cutoff. */
  readonly comparisons: readonly unknown[];
  /** Owner-observed read clock, not a commit-time certificate. */
  readonly snapshotObservedAt: number;
  readonly planning: { readonly id: string; readonly createdAt: number;
    readonly horizon: { readonly startAt: number; readonly endAt: number };
    readonly pairs: readonly { readonly pairId: string; readonly leftItemId: string; readonly rightItemId: string }[] };
  readonly references: { readonly scopeId: string; readonly subjectRef: string; readonly actorRef: string;
    readonly sessionRef: string; readonly sourcePredictionRef: string; readonly captureRef: string;
    readonly controlRefs: Readonly<Record<Control, string>>;
    readonly objects: readonly { readonly itemId: string; readonly objectRef: string }[];
    /** Complete frozen input closure; overlapping ranked Items reuse the alias. */
    readonly inputObjects?: readonly { readonly itemId: string; readonly objectRef: string }[];
    /** Owner-stable aliases for raw input Events and exact UNDO targets. */
    readonly inputRecords?: readonly { readonly recordId: string; readonly recordRef: string }[] };
}

export class KajoWorkingEvaluationSnapshotError extends Error {
  constructor(readonly code: 'invalid-snapshot' | 'budget-exceeded' | 'incompatible-snapshots'
    | 'artifact-unavailable' | 'invalid-aliases') {
    super(`Kajo Working evaluation snapshot rejected: ${code}`);
    this.name = 'KajoWorkingEvaluationSnapshotError';
  }
}
function check(value: unknown, code: KajoWorkingEvaluationSnapshotError['code'] = 'invalid-snapshot'): asserts value {
  if (!value) throw new KajoWorkingEvaluationSnapshotError(code);
}
function row(value: unknown): Row {
  check(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Row;
}
function list(value: unknown, maximum: number, minimum = 0): unknown[] {
  check(Array.isArray(value)); check(value.length <= maximum, 'budget-exceeded'); check(value.length >= minimum);
  return value;
}
function text(value: unknown, maximum = 256): string {
  check(typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f]/u.test(value));
  return value;
}
function uuid(value: unknown): string { const result = text(value, 36); check(uuidPattern.test(result)); return result; }
function finite(value: unknown): number { check(typeof value === 'number' && Number.isFinite(value)); return value; }
function clock(value: unknown): number {
  const result = finite(value); check(result >= 0 && result <= Number.MAX_SAFE_INTEGER); return result;
}
function integer(value: unknown, maximum: number, minimum = 0): number {
  const result = finite(value); check(Number.isInteger(result) && result >= minimum && result <= maximum); return result;
}
function instant(value: unknown): number {
  if (typeof value === 'number') return clock(value);
  const raw = text(value, 40);
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/u.exec(raw);
  check(match);
  const offset = match[4] === 'Z' ? 'Z' : match[4]!.length === 3 ? `${match[4]}:00`
    : match[4]!.length === 5 ? `${match[4]!.slice(0, 3)}:${match[4]!.slice(3)}` : match[4]!;
  const base = Date.parse(`${match[1]}T${match[2]}.000${offset}`);
  const local = Date.parse(`${match[1]}T${match[2]}.000Z`);
  check(Number.isFinite(base) && base >= 0 && Number.isFinite(local)
    && new Date(local).toISOString().slice(0, 19) === `${match[1]}T${match[2]}`);
  const micros = Number((match[3] ?? '').padEnd(6, '0'));
  const result = base + micros / 1000;
  check(result <= Number.MAX_SAFE_INTEGER && (micros === 0 || (result > base
    && base + (micros - 1) / 1000 < result && base + (micros + 1) / 1000 > result)));
  return result;
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return false;
  const left = row(a), right = row(b), keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
}
function bounded(value: unknown): void {
  let nodes = 0, bytes = 0;
  const active = new Set<object>(); const encoder = new TextEncoder();
  const visit = (v: unknown, depth: number): void => {
    check(++nodes <= 500_000 && depth <= 40, 'budget-exceeded');
    if (v === null || typeof v === 'boolean') bytes += 5;
    else if (typeof v === 'number') { finite(v); bytes += String(v).length; }
    else if (typeof v === 'string') bytes += encoder.encode(JSON.stringify(v)).length;
    else {
      check(v !== null && typeof v === 'object' && !active.has(v)); active.add(v);
      if (Array.isArray(v)) { check(v.length <= 2048, 'budget-exceeded'); v.forEach(x => visit(x, depth + 1)); bytes += v.length + 2; }
      else {
        check(Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
        const entries = Object.entries(v); check(entries.length <= 4096, 'budget-exceeded');
        for (const [key, x] of entries) { bytes += encoder.encode(JSON.stringify(key)).length + 2; visit(x, depth + 1); }
      }
      active.delete(v);
    }
    check(bytes <= 8_388_608, 'budget-exceeded');
  };
  visit(value, 0);
}
function flags(value: Row): void {
  check(value.learnable === false && value.historicalFeatureEligible === false && value.nativeActivated === false);
}
function ranks(pool: Row[], scoreKey: string, rankKey: string, idKey: string, tier: (r: Row) => number): void {
  const sorted = [...pool].sort((a, b) => tier(a) - tier(b) || finite(b[scoreKey]) - finite(a[scoreKey])
    || (String(a[idKey]) < String(b[idKey]) ? -1 : String(a[idKey]) > String(b[idKey]) ? 1 : 0));
  sorted.forEach((candidate, i) => check(integer(candidate[rankKey], pool.length, 1) === i + 1, 'incompatible-snapshots'));
}
function tier(candidate: Row): number {
  const policy = row(row(candidate.explanation).resurfacingPolicy);
  check(typeof policy.eligible === 'boolean'); text(policy.classification);
  return !policy.eligible ? 2 : policy.classification === 'SAVED_REMINDER' ? 1 : 0;
}
function binaryFeatures(value: unknown, dimensions: readonly string[]): Record<string, number> {
  const features = row(value);
  check(Object.keys(features).length === dimensions.length && dimensions.every(key => Object.hasOwn(features, key))
    && Object.values(features).every(v => v === 0 || v === 1), 'incompatible-snapshots');
  return Object.fromEntries(dimensions.map(key => [key, features[key] as number]));
}
function candidateFeatureVector(value: unknown, dimensions: readonly string[]): Record<string, number> {
  check(Array.isArray(value) && value.length === dimensions.length && Object.keys(value).length === dimensions.length
    && dimensions.every((_, i) => Object.hasOwn(value, i) && (value[i] === 0 || value[i] === 1)), 'incompatible-snapshots');
  // Native schema order is the encoding. Core derivation may sort its copy.
  return Object.fromEntries(dimensions.map((key, i) => [key, value[i] as number]));
}
function featureSchemaRef(value: unknown): Row {
  const schema = row(value), artifact = row(schema.artifact);
  return { id: schema.id, version: schema.version, artifactId: artifact.id, artifactVersion: artifact.version,
    representationVersion: artifact.representationVersion, dimensionCount: list(schema.dimensions, 32).length };
}
function candidateUnavailableReason(capture: Row): string | null {
  if (capture.status !== 'ACTIVE') return 'CAPTURE_INACTIVE';
  if (capture.prefixComplete !== true) return 'INCOMPLETE_CAPTURE';
  const dimensions = row(capture.featureSchema).dimensions;
  if (!Array.isArray(dimensions) || dimensions.length > 32) return 'INVALID_FEATURE_SCHEMA';
  if (dimensions.length === 0) return 'EMPTY_FEATURE_SCHEMA';
  if (dimensions.some(key => typeof key !== 'string' || !key || key.length > 256 || /[\u0000-\u001f]/u.test(key))
    || new Set(dimensions).size !== dimensions.length) return 'INVALID_FEATURE_SCHEMA';
  return null;
}
function close(a: unknown, b: number): boolean { return Math.abs(finite(a) - b) <= 1e-12; }

/** No database, credentials, outcome reconciliation, feature lookup or ON policy. */
export function normalizeKajoWorkingEvaluationPlan(input: KajoWorkingEvaluationSnapshots): WorkingEvaluationPlanInput {
  bounded(input);
  check(input && input.profile?.type === 'PERSONAL');
  const planning = row(input.planning), refs = row(input.references), controlRefs = row(refs.controlRefs);
  const actor = uuid(input.actorUserId), profile = uuid(input.profile.id);
  check(uuid(input.profile.ownerUserId) === actor, 'incompatible-snapshots');
  const source = row(input.sourceRun), sourceId = uuid(source.id);
  check(uuid(source.actor_user_id) === actor && uuid(source.profile_id) === profile, 'incompatible-snapshots');
  const session = source.session_id === null ? null : uuid(source.session_id);
  const genomeId = uuid(source.genome_id);
  const requestedAt = instant(source.requested_at), storedSourceAt = instant(source.created_at);
  const observedAt = clock(input.snapshotObservedAt), plannedAt = clock(planning.createdAt);
  check(observedAt >= requestedAt && observedAt >= storedSourceAt && plannedAt >= observedAt, 'artifact-unavailable');
  check(['FOR_YOU', 'SURPRISE', 'RISK'].includes(text(source.discovery_mode)));
  check(source.requested_item_type === null || ['BOOK', 'MOVIE'].includes(text(source.requested_item_type)));
  const model = text(source.model_version), sourcePolicy = text(source.policy_version);
  const baseModel = text(source.base_model_version);
  const capture = row(row(source.state_snapshot).workingState), captureId = uuid(capture.captureId);
  const captureVersion = text(capture.version);
  check(['native-working-capture-v1', 'native-working-capture-v2', 'native-working-capture-v3'].includes(captureVersion), 'incompatible-snapshots');
  const generation = captureVersion.slice(-2);
  const featureVersion = `personal-working-features-${generation}`, comparisonVersion = `personal-working-shadow-${generation}`;
  check(sourcePolicy.split('+').includes(`personal-working-off-${generation}`), 'incompatible-snapshots');
  check(capture.kind === 'working-state' && capture.stateVersion === 'working-state-v1'); flags(capture);
  check(capture.commitAvailability === 'UNKNOWN' && capture.availabilityBasis === 'STORED_CREATED_TIME'
    && capture.featureAvailabilityBasis === 'CURRENT_MVCC_SNAPSHOT_KNOWN_AT_CAPTURE');
  check(uuid(capture.actorUserId) === actor, 'incompatible-snapshots');
  const capturedProfile = row(capture.profile);
  check(uuid(capturedProfile.id) === profile && capturedProfile.type === 'PERSONAL'
    && uuid(capturedProfile.ownerUserId) === actor, 'incompatible-snapshots');
  const cutoff = instant(capture.cutoff);
  check(cutoff === clock(capture.asOf) && cutoff <= requestedAt, 'incompatible-snapshots');
  check(typeof capture.prefixComplete === 'boolean'); text(capture.status);
  if (capture.session !== null) {
    const capturedSession = row(capture.session);
    check(uuid(capturedSession.id) === session && uuid(capturedSession.actor_user_id) === actor
      && uuid(capturedSession.profile_id) === profile, 'incompatible-snapshots');
  }
  list(capture.rawEvents, 128); list(capture.records, 128); list(capture.items, 32); list(capture.itemFeatures, 32);
  list(row(capture.featureSchema).dimensions, 32);
  if (generation !== 'v1') {
    list(capture.resetControls, 128); list(capture.resetSourceRefs, 128);
    check(capture.resetAt === null || clock(capture.resetAt) <= cutoff);
  }
  const featureUnavailable = generation === 'v3' ? candidateUnavailableReason(capture) : null;
  const count = integer(source.candidate_count, 50, 1), delivered = integer(source.result_count, count);
  const candidates = list(input.sourceCandidates, 50, 1).map(row);
  check(candidates.length === count, 'incompatible-snapshots');
  const candidateIds = candidates.map(candidate => uuid(candidate.item_id));
  check(new Set(candidateIds).size === count, 'incompatible-snapshots');
  for (const candidate of candidates) {
    check(uuid(candidate.prediction_id) === sourceId, 'incompatible-snapshots');
    check(instant(candidate.created_at) <= observedAt, 'artifact-unavailable');
    finite(candidate.final_score); finite(candidate.source_score);
    integer(candidate.source_rank, count, 1); integer(candidate.final_rank, count, 1);
    check(typeof candidate.selected_for_delivery === 'boolean');
    const explanation = row(candidate.explanation), intent = row(explanation.workingIntent);
    check(explanation.policyVersion === sourcePolicy, 'incompatible-snapshots');
    check(intent.version === featureVersion && uuid(intent.captureId) === captureId
      && intent.stateVersion === 'working-state-v1' && intent.policyVersion === 'working-policy-v1' && intent.control === 'OFF',
    'incompatible-snapshots'); flags(intent);
    check(Math.abs(finite(intent.staticAdjustment)) <= 0.25 && Math.abs(finite(intent.orderedAdjustment)) <= 0.25);
    if (generation === 'v3') {
      const snapshot = row(intent.candidateFeatures); flags(snapshot);
      check(snapshot.version === 'native-working-candidate-features-v1' && snapshot.captureId === captureId
        && snapshot.asOf === cutoff && same(snapshot.featureSchemaRef, featureSchemaRef(capture.featureSchema))
        && snapshot.featureEncoding === 'CAPTURE_DIMENSION_ORDER_BINARY_V1'
        && snapshot.availabilityBasis === 'SOURCE_RANKING_STATEMENT_SNAPSHOT' && snapshot.availableAt === null
        && snapshot.commitAvailability === 'UNKNOWN' && snapshot.unavailableReason === featureUnavailable
        && snapshot.status === (featureUnavailable === null ? 'AVAILABLE' : 'UNAVAILABLE'), 'incompatible-snapshots');
      if (featureUnavailable === null) candidateFeatureVector(snapshot.features, row(capture.featureSchema).dimensions as string[]);
      else check(snapshot.features === null, 'incompatible-snapshots');
    }
    check(candidate.selected_for_delivery === (tier(candidate) < 2 && integer(candidate.final_rank, count, 1) <= delivered),
      'incompatible-snapshots');
    if (generation !== 'v1') check(intent.captureVersion === captureVersion && same(intent.resetAt, capture.resetAt)
      && same(intent.resetSourceRefs, capture.resetSourceRefs), 'incompatible-snapshots');
  }
  check(new Set(candidates.map(c => c.source_rank)).size === count, 'incompatible-snapshots');
  check(candidates.filter(c => c.selected_for_delivery).length === delivered, 'incompatible-snapshots');
  ranks(candidates, 'final_score', 'final_rank', 'item_id', tier);
  const namespace = text(refs.scopeId, 128);
  const rawIds = [actor, profile, sourceId, captureId, genomeId, ...candidateIds, ...(session ? [session] : [])];
  const rawEvents = list(capture.rawEvents, 128).map(row), inputItems = list(capture.itemFeatures, 32).map(row);
  const inputIds = generation === 'v3' ? inputItems.map(item => uuid(item.id)) : [];
  const recordIds = generation === 'v3' ? [...new Set(rawEvents.flatMap(event => {
    const ids = [uuid(event.id)];
    if (event.event_type === 'ITEM_INTERACTION_UNDONE') ids.push(uuid(row(event.properties).reversedEventId));
    return ids;
  }))] : [];
  if (generation === 'v3') {
    check(new Set(inputIds).size === inputIds.length, 'incompatible-snapshots');
    rawIds.push(...inputIds, ...recordIds);
    for (const event of rawEvents) {
      rawIds.push(uuid(event.actor_user_id), uuid(event.profile_id));
      if (event.session_id !== null) rawIds.push(uuid(event.session_id));
      if (event.item_id !== null) rawIds.push(uuid(event.item_id));
    }
    for (const reset of list(capture.resetControls, 128).map(row)) rawIds.push(uuid(reset.resetId));
    for (const reset of list(capture.resetSourceRefs, 128).map(row)) rawIds.push(uuid(reset.recordId));
  }
  const aliases = [refs.subjectRef, refs.actorRef, refs.sessionRef, refs.sourcePredictionRef, refs.captureRef,
    planning.id, ...controls.map(control => controlRefs[control])];
  const objectReferences = list(refs.objects, 50, 1).map(row);
  check(objectReferences.length === count && new Set(objectReferences.map(r => uuid(r.itemId))).size === count
    && objectReferences.every(r => candidateIds.includes(uuid(r.itemId))), 'invalid-aliases');
  aliases.push(...objectReferences.map(r => text(r.objectRef)));
  const objects = new Map(objectReferences.map(r => [uuid(r.itemId), text(r.objectRef)]));
  const inputObjects = new Map<string, string>(), inputRecords = new Map<string, string>();
  if (generation === 'v3' && featureUnavailable === null) {
    const itemAliases = list(refs.inputObjects, 32).map(row), recordAliases = list(refs.inputRecords, 256).map(row);
    check(itemAliases.length === inputIds.length && recordAliases.length === recordIds.length, 'invalid-aliases');
    for (const reference of itemAliases) {
      const nativeId = uuid(reference.itemId), alias = text(reference.objectRef);
      check(inputIds.includes(nativeId) && !inputObjects.has(nativeId)
        && (!objects.has(nativeId) || objects.get(nativeId) === alias), 'invalid-aliases');
      inputObjects.set(nativeId, alias);
      if (!objects.has(nativeId)) aliases.push(alias);
    }
    for (const reference of recordAliases) {
      const nativeId = uuid(reference.recordId), alias = text(reference.recordRef);
      check(recordIds.includes(nativeId) && !inputRecords.has(nativeId), 'invalid-aliases');
      inputRecords.set(nativeId, alias); aliases.push(alias);
    }
  }
  check(new Set(aliases).size === aliases.length && aliases.every(value => {
    const alias = text(value); return alias.startsWith(`${namespace}:`) && alias.length > namespace.length + 1
      && rawIds.every(raw => !alias.toLowerCase().includes(raw));
  }) && rawIds.every(raw => !namespace.toLowerCase().includes(raw)), 'invalid-aliases');
  const controlRows = list(input.comparisons, 3, 3).map(row);
  check(new Set(controlRows.map(r => r.control)).size === 3, 'incompatible-snapshots');
  const normalizeControl = (control: Control): WorkingEvaluationPlanInput['controls'][Control] => {
    const comparison = controlRows.find(r => r.control === control); check(comparison, 'incompatible-snapshots');
    check(uuid(comparison.source_prediction_id) === sourceId, 'incompatible-snapshots');
    const createdAt = instant(comparison.created_at); check(createdAt <= observedAt, 'artifact-unavailable');
    const result = row(comparison.result); flags(result);
    check(result.version === comparisonVersion && uuid(result.sourcePredictionId) === sourceId && result.control === control
      && uuid(result.captureId) === captureId && result.sourceModelVersion === model && result.sourcePolicyVersion === sourcePolicy
      && result.policyVersion === 'working-policy-v1' && result.servingControl === 'OFF'
      && result.comparisonScope === 'FROZEN_CANDIDATE_POOL_AND_FINAL_DELIVERY_POLICY'
      && result.commitAvailability === 'UNKNOWN' && result.observedEvaluationCount === 0
      && result.calibration === 'uncalibrated' && result.uncertainty === 'unavailable'
      && instant(result.asOf) === cutoff && integer(result.candidateCount, 50, 1) === count, 'incompatible-snapshots');
    if (generation !== 'v1') check(result.captureVersion === captureVersion && same(result.resetAt, capture.resetAt)
      && same(result.resetSourceRefs, capture.resetSourceRefs), 'incompatible-snapshots');
    const pool = list(result.candidates, 50, 1).map(row);
    check(pool.length === count && new Set(pool.map(c => uuid(c.itemId))).size === count, 'incompatible-snapshots');
    for (const candidate of pool) {
      const original = candidates.find(c => c.item_id === uuid(candidate.itemId)); check(original, 'incompatible-snapshots');
      finite(candidate.score); integer(candidate.rank, count, 1);
      check(typeof candidate.eligible === 'boolean' && candidate.eligible === row(row(original.explanation).resurfacingPolicy).eligible
        && integer(candidate.tier, 2) === tier(original)
        && typeof candidate.selected === 'boolean' && candidate.selected === (tier(original) < 2 && (candidate.rank as number) <= delivered),
      'incompatible-snapshots');
      const intent = row(row(original.explanation).workingIntent);
      check(finite(candidate.adjustment) === (control === 'OFF' ? 0 : finite(intent[control === 'STATIC' ? 'staticAdjustment' : 'orderedAdjustment'])),
        'incompatible-snapshots');
      if (control === 'OFF') check(candidate.score === original.final_score && candidate.rank === original.final_rank
        && candidate.selected === original.selected_for_delivery, 'incompatible-snapshots');
      // STATIC/ORDERED totals are the real frozen producer scores, not a
      // reconstructed final_score + adjustment approximation.
    }
    ranks(pool, 'score', 'rank', 'itemId', r => integer(r.tier, 2));
    return { id: text(controlRefs[control]), version: comparisonVersion, createdAt, availableAt: createdAt,
      availabilityBasis: 'STORED_CREATED_TIME', candidates: pool.map(c => ({ objectId: objects.get(uuid(c.itemId))!,
        score: finite(c.score), rank: integer(c.rank, count, 1), eligible: c.eligible as boolean,
        tier: integer(c.tier, 2), selected: c.selected as boolean })) };
  };
  const normalizedControls = { OFF: normalizeControl('OFF'), STATIC: normalizeControl('STATIC'), ORDERED: normalizeControl('ORDERED') };
  const pairs = list(planning.pairs, 25).map(row).map(pair => {
    const pairId = text(pair.pairId), left = uuid(pair.leftItemId), right = uuid(pair.rightItemId);
    check(objects.has(left) && objects.has(right) && left !== right, 'invalid-aliases');
    check(pairId.startsWith(`${namespace}:`) && pairId.length > namespace.length + 1 && !aliases.includes(pairId)
      && rawIds.every(raw => !pairId.toLowerCase().includes(raw)), 'invalid-aliases');
    return { pairId, leftObjectId: objects.get(left)!, rightObjectId: objects.get(right)! };
  });
  const pairObjects = pairs.flatMap(pair => [pair.leftObjectId, pair.rightObjectId]);
  check(new Set(pairObjects).size === pairObjects.length && new Set(pairs.map(pair => pair.pairId)).size === pairs.length,
    'incompatible-snapshots');
  const suppliedHorizon = row(planning.horizon);
  const horizon = { startAt: clock(suppliedHorizon.startAt), endAt: clock(suppliedHorizon.endAt) };
  check(horizon.startAt >= plannedAt && horizon.endAt > horizon.startAt);
  const normalized: WorkingEvaluationPlanInput = { id: text(planning.id), sourcePredictionId: text(refs.sourcePredictionRef),
    scope: { subject: { id: text(refs.subjectRef), kind: 'individual' }, actingIdentityRef: text(refs.actorRef),
      sessionRef: text(refs.sessionRef), evidence: { sourceIds: ['kajo-canonical-events-v1'], cohortIds: [], synthetic: 'exclude' } },
    target: { id: 'kajo:personal-exposed-rating-order', version: '1', scale: { min: 0, max: 10 },
      conditioning: 'object-observation', exposure: 'required', objective: 'maximize' },
    sourceCutoff: cutoff, createdAt: plannedAt, availableAt: plannedAt, availabilityBasis: 'STORED_CREATED_TIME',
    selectionBasis: 'PREDECLARED_DISJOINT_PAIRS', horizon,
    sourceBinding: { kind: 'kajo-native-personal-working', captureRef: text(refs.captureRef),
      modelVersion: model, baseModelVersion: baseModel, mode: source.discovery_mode as string,
      objectType: source.requested_item_type === null ? 'ANY' : source.requested_item_type as string,
      requestedAt, storedSourceCreatedAt: storedSourceAt, snapshotObservedAt: observedAt,
      commitAvailability: 'UNKNOWN', historicalFeatureEligible: false,
      ...(generation !== 'v3' ? {} : { candidateFeatureSnapshot: {
        availabilityBasis: 'SOURCE_RANKING_STATEMENT_SNAPSHOT', availableAt: null, inputReferenceAt: cutoff } }) },
    versions: { capture: captureVersion, features: featureVersion, scorer: 'prediction-candidate-score-working-v1', policy: sourcePolicy },
    controls: normalizedControls, pairs,
    // Input closure features do not certify the different admitted candidates'
    // features. Current Item lookup or guessing tags would leak later knowledge.
    working: { status: 'unavailable', reason: generation === 'v3'
      ? `FROZEN_CANDIDATE_FEATURES_${featureUnavailable ?? 'UNAVAILABLE'}` : 'FROZEN_CANDIDATE_FEATURES_UNAVAILABLE' } };
  let working = normalized.working;
  if (generation === 'v3' && featureUnavailable === null) {
    try {
      const schema = row(capture.featureSchema) as unknown as WorkingFeatureSchema;
      check(schema.id === 'native-working-tags' && schema.version === '1' && same(schema.artifact, {
        id: 'native-working-tags', version: '1', representationVersion: 'native-binary-tags-v1', availableAt: cutoff,
        trainedThrough: null, use: 'research-only', sourceRefs: ['kajo-canonical-events-v1'],
      }) && same(capture.config, workingConfigDefaults), 'incompatible-snapshots');
      const frozenItems: PredictionObject[] = inputItems.map(item => {
        const id = uuid(item.id);
        check(item.availableAt === cutoff && same(item.artifact, schema.artifact), 'incompatible-snapshots');
        return { id, availableAt: cutoff, artifact: schema.artifact, features: binaryFeatures(item.features, schema.dimensions) };
      });
      check(rawEvents.every(event => event.actor_user_id === actor && event.profile_id === profile), 'incompatible-snapshots');
      const nativeInput = normalizeKajoWorkingSession({ profile: input.profile, actorUserId: actor,
        session: capture.session as KajoWorkingSessionInput['session'],
        events: rawEvents as unknown as KajoWorkingSessionInput['events'], objects: frozenItems, featureSchema: schema,
        asOf: cutoff, prefixComplete: true, resetAt: capture.resetAt as number | null,
        refs: { scopeId: namespace, subjectRef: text(refs.subjectRef), actorRef: text(refs.actorRef), sessionRef: text(refs.sessionRef) } });
      const records = nativeInput.records.map(record => {
        const objectId = inputObjects.get(record.observation.objectId), recordId = inputRecords.get(record.observation.provenance.recordId);
        check(objectId && recordId, 'invalid-aliases');
        return { ...record, observation: { ...record.observation, objectId,
          targetId: normalized.target.id, targetVersion: normalized.target.version,
          provenance: { ...record.observation.provenance, recordId } },
        object: record.object === null ? null : { ...record.object, id: objectId },
        ...(record.invalidates === undefined ? {} : { invalidates: record.invalidates.map(ref => {
          const alias = inputRecords.get(ref.recordId); check(alias, 'invalid-aliases'); return { ...ref, recordId: alias };
        }) }) };
      });
      const state = deriveWorkingState({ ...nativeInput, scope: normalized.scope, target: normalized.target, records });
      check(state.status === capture.status && same(state.support, capture.support), 'incompatible-snapshots');
      for (const control of ['static', 'ordered'] as const) {
        const vector = row(row(capture.vectors)[control]);
        check(Object.keys(vector).length === schema.dimensions.length
          && schema.dimensions.every(key => Object.hasOwn(vector, key) && close(vector[key], state.vectors[control][key]!)),
        'incompatible-snapshots');
      }
      const candidateObjects: PredictionObject[] = candidates.map(candidate => {
        const intent = row(row(candidate.explanation).workingIntent);
        // This clock is an arithmetic input reference, not candidate availability.
        // The retained source binding explicitly keeps that availability unknown.
        const object = { id: objects.get(uuid(candidate.item_id))!, availableAt: cutoff, artifact: schema.artifact,
          features: candidateFeatureVector(row(intent.candidateFeatures).features, schema.dimensions) };
        check(close(intent.staticAdjustment, scoreWorkingAdjustment({ state, object, control: 'STATIC' }).value)
          && close(intent.orderedAdjustment, scoreWorkingAdjustment({ state, object, control: 'ORDERED' }).value), 'incompatible-snapshots');
        return object;
      });
      working = { status: 'available', state, objects: candidateObjects };
    } catch (error) {
      if (error instanceof KajoWorkingEvaluationSnapshotError) throw error;
      throw new KajoWorkingEvaluationSnapshotError('incompatible-snapshots');
    }
  }
  const result = { ...normalized, working };
  const serialized = JSON.stringify(result).toLowerCase();
  check(rawIds.every(raw => !serialized.includes(raw)), 'invalid-aliases');
  return result;
}
