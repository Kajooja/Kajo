import type { WorkingEvaluationPlan, WorkingOutcomeCapture, WorkingOutcomeLabel } from '../working-evaluation.js';
import { freezeWorkingEvaluationPlan } from '../working-evaluation.js';

type Row = Record<string, unknown>;
type Control = 'OFF' | 'STATIC' | 'ORDERED';
const controls = ['OFF', 'STATIC', 'ORDERED'] as const;
const sourceId = 'kajo-canonical-events-v1';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const embeddedUuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;

/** Result envelopes already read under current native owner authorization. */
export interface KajoWorkingOutcomeSnapshots {
  readonly native: { readonly actorUserId: string; readonly profileId: string; readonly sessionId: string;
    readonly sourcePredictionId: string };
  readonly enrollment: unknown;
  readonly capture: unknown;
  readonly plan: WorkingEvaluationPlan;
  readonly references: {
    readonly scopeId: string;
    readonly enrollmentRef: string;
    readonly captureRef: string;
    readonly controls: Readonly<Record<Control, { readonly comparisonId: string; readonly controlRef: string }>>;
    readonly pairs: readonly { readonly pairId: string; readonly pairRef: string }[];
    readonly objects: readonly { readonly itemId: string; readonly objectRef: string }[];
    readonly events: readonly { readonly eventId: string; readonly recordRef: string }[];
    readonly exposures: readonly { readonly exposureId: string; readonly experienceRef: string }[];
  };
}

export class KajoWorkingOutcomeSnapshotError extends Error {
  constructor(readonly code: 'invalid-snapshot' | 'budget-exceeded' | 'incompatible-snapshots' | 'invalid-aliases') {
    super(`Kajo Working outcome snapshot rejected: ${code}`);
    this.name = 'KajoWorkingOutcomeSnapshotError';
  }
}
function check(value: unknown, code: KajoWorkingOutcomeSnapshotError['code'] = 'invalid-snapshot'): asserts value {
  if (!value) throw new KajoWorkingOutcomeSnapshotError(code);
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
function clock(value: unknown): number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER);
  return value;
}
function nullableUuid(value: unknown): string | null { return value === null ? null : uuid(value); }
function nullableClock(value: unknown): number | null { return value === null ? null : clock(value); }
function flags(value: Row): void {
  check(value.commitAvailability === 'UNKNOWN' && value.historicalFeatureEligible === false
    && value.learnable === false && value.nativeActivated === false, 'incompatible-snapshots');
}
/** Reject cyclic/oversized caller values and collect even nested origin identifiers. */
function bounded(value: unknown): Set<string> {
  let nodes = 0, bytes = 0;
  const rawIds = new Set<string>(), active = new Set<object>(), encoder = new TextEncoder();
  const visit = (v: unknown, depth: number): void => {
    check(++nodes <= 500_000 && depth <= 40, 'budget-exceeded');
    if (v === null || typeof v === 'boolean') bytes += 5;
    else if (typeof v === 'number') { check(Number.isFinite(v)); bytes += String(v).length; }
    else if (typeof v === 'string') {
      bytes += encoder.encode(JSON.stringify(v)).length;
      for (const match of v.matchAll(embeddedUuidPattern)) rawIds.add(match[0].toLowerCase());
    } else {
      check(v !== null && typeof v === 'object' && !active.has(v)); active.add(v);
      if (Array.isArray(v)) {
        check(v.length <= 2048, 'budget-exceeded'); v.forEach(x => visit(x, depth + 1)); bytes += v.length + 2;
      } else {
        check(Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
        const entries = Object.entries(v); check(entries.length <= 4096, 'budget-exceeded');
        for (const [key, x] of entries) { bytes += encoder.encode(JSON.stringify(key)).length + 2; visit(x, depth + 1); }
      }
      active.delete(v);
    }
    check(bytes <= 8_388_608, 'budget-exceeded');
  };
  visit(value, 0); return rawIds;
}
function immutable<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

/** No reads, credentials, chronology replay, causal reward attribution or activation. */
export function normalizeKajoWorkingOutcomeCapture(input: KajoWorkingOutcomeSnapshots): WorkingOutcomeCapture {
  const rawIds = bounded(input), native = row(input.native), enrollment = row(input.enrollment), capture = row(input.capture);
  check(enrollment.version === 'personal-working-enrollment-v1' && capture.version === 'personal-working-outcomes-v1',
    'incompatible-snapshots'); flags(enrollment); flags(capture);
  const enrollmentId = uuid(enrollment.enrollmentId), captureId = uuid(capture.captureId);
  for (const key of ['actorUserId', 'profileId', 'sessionId', 'sourcePredictionId'] as const) {
    const expected = uuid(native[key]);
    check(uuid(enrollment[key]) === expected && uuid(capture[key]) === expected, 'incompatible-snapshots');
  }
  check(uuid(capture.enrollmentId) === enrollmentId && captureId !== enrollmentId, 'incompatible-snapshots');
  let plan: WorkingEvaluationPlan;
  try { plan = freezeWorkingEvaluationPlan(input.plan); } catch { throw new KajoWorkingOutcomeSnapshotError('incompatible-snapshots'); }
  check(plan.contractVersion === 'working-evaluation-plan-v1' && plan.availabilityBasis === 'STORED_CREATED_TIME'
    && plan.scope.subject.kind === 'individual' && plan.scope.actingIdentityRef !== null
    && plan.scope.evidence.synthetic === 'exclude' && plan.scope.evidence.sourceIds.length === 1
    && plan.scope.evidence.sourceIds[0] === sourceId
    && plan.target.id === 'kajo:personal-exposed-rating-order' && plan.target.version === '1'
    && plan.target.scale.min === 0 && plan.target.scale.max === 10 && plan.target.conditioning === 'object-observation'
    && plan.target.exposure === 'required' && plan.target.objective === 'maximize'
    && plan.sourceBinding?.kind === 'kajo-native-personal-working', 'incompatible-snapshots');
  const declaredAt = clock(enrollment.declaredAt), capturedAt = clock(capture.capturedAt), matureAt = clock(enrollment.matureAt);
  const horizon = row(enrollment.horizon);
  check(declaredAt === plan.createdAt && declaredAt === plan.availableAt
    && clock(horizon.startAt) === plan.horizon.startAt && clock(horizon.endAt) === plan.horizon.endAt
    && plan.horizon.startAt >= declaredAt && matureAt >= plan.horizon.endAt && clock(capture.matureAt) === matureAt
    && capturedAt >= declaredAt, 'incompatible-snapshots');
  check(typeof capture.complete === 'boolean' && capture.resolutionVersion === 'personal-latest-terminal-v1');
  const revision = capture.revision;
  check(typeof revision === 'number' && Number.isInteger(revision) && revision >= 1 && revision <= 16);

  const refs = row(input.references), namespace = text(refs.scopeId, 128);
  check(text(refs.enrollmentRef) === plan.id, 'invalid-aliases');
  const resultId = text(refs.captureRef);
  const baseAliases = [plan.id, plan.sourcePredictionId, plan.scope.subject.id, plan.scope.actingIdentityRef!, plan.scope.sessionRef,
    plan.sourceBinding!.captureRef, ...controls.map(control => plan.controls[control].id),
    ...plan.controls.OFF.candidates.map(candidate => candidate.objectId), ...plan.pairs.map(pair => pair.pairId)];
  check(new Set(baseAliases).size === baseAliases.length, 'invalid-aliases');
  const inputObjects = new Set<string>(), inputRecords = new Set<string>();
  if (plan.working.status === 'available') {
    for (const record of plan.working.state.records) {
      inputObjects.add(record.observation.objectId);
      if (record.object !== null) inputObjects.add(record.object.id);
      inputRecords.add(record.observation.provenance.recordId);
      for (const source of record.invalidates ?? []) inputRecords.add(source.recordId);
    }
    for (const item of plan.working.state.items) {
      inputObjects.add(item.objectId);
      for (const source of item.sourceRefs) inputRecords.add(source.recordId);
    }
  }
  const candidateAliases = new Set(plan.controls.OFF.candidates.map(candidate => candidate.objectId));
  check([...inputObjects].every(alias => !baseAliases.includes(alias) || candidateAliases.has(alias)), 'invalid-aliases');
  // An overlapping ranked/input Item deliberately reuses its Object alias.
  // Input record aliases may also recur as exact later correction identities,
  // but neither is available to another kind of source reference.
  const aliases = [...baseAliases, ...[...inputObjects].filter(alias => !candidateAliases.has(alias)), resultId];
  const controlRows = list(enrollment.controls, 3, 3).map(row), controlRefs = row(refs.controls);
  check(new Set(controlRows.map(control => control.control)).size === 3 && Object.keys(controlRefs).length === 3,
    'incompatible-snapshots');
  const comparisonIds = new Set<string>();
  for (const control of controls) {
    const original = controlRows.find(value => value.control === control); check(original, 'incompatible-snapshots');
    const reference = row(controlRefs[control]), comparisonId = uuid(original.comparisonId);
    check(!comparisonIds.has(comparisonId), 'incompatible-snapshots'); comparisonIds.add(comparisonId);
    check(uuid(reference.comparisonId) === comparisonId && text(reference.controlRef) === plan.controls[control].id,
      'invalid-aliases');
    check(clock(original.createdAt) === plan.controls[control].createdAt
      && clock(original.createdAt) === plan.controls[control].availableAt
      && plan.controls[control].availabilityBasis === 'STORED_CREATED_TIME', 'incompatible-snapshots');
  }

  const pairs = list(enrollment.pairs, 25, 1).map(row), pairRefs = list(refs.pairs, 25, 1).map(row);
  check(pairs.length === plan.pairs.length && pairRefs.length === pairs.length, 'incompatible-snapshots');
  const pairIds = pairs.map(pair => uuid(pair.pairId));
  check(new Set(pairIds).size === pairIds.length, 'incompatible-snapshots');
  const objects = new Map<string, string>();
  for (const reference of list(refs.objects, 50, 2).map(row)) {
    const nativeId = uuid(reference.itemId), alias = text(reference.objectRef);
    check(!objects.has(nativeId), 'invalid-aliases'); objects.set(nativeId, alias);
  }
  const usedPairs = new Set<string>(), usedObjects = new Set<string>();
  for (const pair of pairs) {
    const nativePair = uuid(pair.pairId), reference = pairRefs.find(value => uuid(value.pairId) === nativePair);
    check(reference && !usedPairs.has(nativePair), 'invalid-aliases'); usedPairs.add(nativePair);
    const plannedPair = plan.pairs.find(value => value.pairId === text(reference.pairRef));
    check(plannedPair, 'invalid-aliases');
    const left = uuid(pair.leftItemId), right = uuid(pair.rightItemId);
    check(left !== right && !usedObjects.has(left) && !usedObjects.has(right), 'incompatible-snapshots');
    usedObjects.add(left); usedObjects.add(right);
    check(objects.get(left) === plannedPair.leftObjectId && objects.get(right) === plannedPair.rightObjectId, 'invalid-aliases');
    const candidates = [plannedPair.leftObjectId, plannedPair.rightObjectId].map(objectId =>
      plan.controls.OFF.candidates.find(candidate => candidate.objectId === objectId)!);
    check(candidates.every(candidate => candidate.eligible && candidate.selected && candidate.tier < 2)
      && candidates[0]!.tier === candidates[1]!.tier, 'incompatible-snapshots');
  }
  check(objects.size === usedObjects.size && [...objects.keys()].every(nativeId => usedObjects.has(nativeId)), 'invalid-aliases');
  check(new Set(pairRefs.map(reference => text(reference.pairRef))).size === pairs.length
    && new Set(pairRefs.map(reference => uuid(reference.pairId))).size === pairs.length, 'invalid-aliases');
  const nativeLabels = list(capture.labels, 50, 2).map(row);
  check(nativeLabels.length === objects.size && new Set(nativeLabels.map(label => uuid(label.itemId))).size === objects.size
    && nativeLabels.every(label => objects.has(uuid(label.itemId))), 'incompatible-snapshots');
  const mapped = (references: unknown, idKey: string, aliasKey: string, expected: Set<string>): Map<string, string> => {
    const result = new Map<string, string>();
    for (const reference of list(references, 50).map(row)) {
      const nativeId = uuid(reference[idKey]), alias = text(reference[aliasKey]);
      check(expected.has(nativeId) && !result.has(nativeId), 'invalid-aliases'); result.set(nativeId, alias); aliases.push(alias);
    }
    check(result.size === expected.size, 'invalid-aliases'); return result;
  };
  const eventIds = nativeLabels.map(label => nullableUuid(label.eventId)).filter((value): value is string => value !== null);
  const exposureIds = nativeLabels.map(label => nullableUuid(label.exposureId)).filter((value): value is string => value !== null);
  check(new Set(eventIds).size === eventIds.length && new Set(exposureIds).size === exposureIds.length, 'incompatible-snapshots');
  const events = mapped(refs.events, 'eventId', 'recordRef', new Set(eventIds));
  const exposures = mapped(refs.exposures, 'exposureId', 'experienceRef', new Set(exposureIds));
  const nonRecordAliases = new Set([...baseAliases, ...inputObjects, resultId, ...exposures.values()]);
  check([...inputRecords].every(alias => !nonRecordAliases.has(alias)), 'invalid-aliases');
  check(new Set(aliases).size === aliases.length && [...aliases, ...inputRecords].every(value => {
    const alias = text(value); return alias.startsWith(`${namespace}:`) && alias.length > namespace.length + 1
      && [...rawIds].every(raw => !alias.toLowerCase().includes(raw));
  }) && [...rawIds].every(raw => !namespace.toLowerCase().includes(raw)), 'invalid-aliases');

  const labels: WorkingOutcomeLabel[] = nativeLabels.map(label => {
    const objectId = objects.get(uuid(label.itemId))!, eventId = nullableUuid(label.eventId), exposureId = nullableUuid(label.exposureId);
    const occurredAt = nullableClock(label.occurredAt), exposedAt = nullableClock(label.exposedAt);
    nullableUuid(label.eventSessionId); nullableUuid(label.originPredictionId);
    check(label.reason === null || typeof label.reason === 'string' && text(label.reason));
    check(eventId === null ? occurredAt === null : occurredAt !== null);
    check(exposureId === null ? exposedAt === null : exposedAt !== null);
    check((occurredAt === null || occurredAt <= capturedAt) && (exposedAt === null || exposedAt <= capturedAt));
    check(['observed', 'unknown', 'clear', 'missing', 'undone'].includes(text(label.status)));
    const status = label.status as WorkingOutcomeLabel['status'];
    // No exposure exists for a missing label: an Object alias is only a unique
    // placeholder, and its horizon-start clock cannot become observed evidence.
    const experienceId = exposureId === null ? objectId : exposures.get(exposureId)!;
    if (status !== 'observed') {
      check(label.rating === null);
      return { objectId, experienceId, exposedAt: exposedAt ?? plan.horizon.startAt, status, observation: null };
    }
    check(eventId !== null && exposureId !== null && occurredAt !== null && exposedAt !== null);
    check(typeof label.rating === 'number' && Number.isInteger(label.rating) && label.rating >= 0 && label.rating <= 10);
    check(exposedAt > declaredAt && exposedAt > plan.horizon.startAt && exposedAt <= plan.horizon.endAt
      && controls.every(control => exposedAt > plan.controls[control].availableAt)
      && occurredAt >= exposedAt && occurredAt > declaredAt && occurredAt > plan.horizon.startAt
      && occurredAt <= plan.horizon.endAt, 'incompatible-snapshots');
    return { objectId, experienceId, exposedAt, status, observation: {
      subjectId: plan.scope.subject.id, actingIdentityRef: plan.scope.actingIdentityRef, objectId,
      actionId: null, predictionId: plan.sourcePredictionId, targetId: plan.target.id, targetVersion: plan.target.version,
      measurement: { status: 'observed', value: label.rating }, raw: { value: label.rating, scale: { min: 0, max: 10 } },
      occurredAt, availableAt: capturedAt, exposure: 'verified', access: { kind: 'subject', subjectId: plan.scope.subject.id },
      provenance: { origin: 'observed', source: { kind: 'native', id: sourceId }, recordId: events.get(eventId)!, revision: 1 },
    } };
  });
  // predictionId is the exposed forecast being compared with an Object label;
  // it does not rewrite the native rating's origin or assert causal attribution.
  return immutable({ id: resultId, sourcePredictionId: plan.sourcePredictionId, subjectId: plan.scope.subject.id,
    actingIdentityRef: plan.scope.actingIdentityRef!, sessionRef: plan.scope.sessionRef, revision, createdAt: capturedAt,
    availableAt: capturedAt, availabilityBasis: 'STORED_CREATED_TIME', matureAt, complete: capture.complete,
    resolutionVersion: 'personal-latest-terminal-v1', labels });
}
