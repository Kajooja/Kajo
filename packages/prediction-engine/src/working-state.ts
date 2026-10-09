import type { ArtifactVersion, Observation, PredictionObject, PredictionScope, TargetDefinition } from './contracts.js';

export interface WorkingConfig {
  readonly maxRecords: number;
  readonly maxItems: number;
  readonly maxFeatures: number;
  readonly maxInvalidations: number;
  readonly idleTtlMs: number;
  readonly maxSessionMs: number;
  readonly minItems: number;
  readonly maxAdjustment: number;
  readonly recencyHalfLifeGroups: number;
}

export const workingConfigDefaults: WorkingConfig = Object.freeze({
  maxRecords: 128, maxItems: 32, maxFeatures: 32, maxInvalidations: 256,
  idleTtlMs: 30 * 60_000, maxSessionMs: 4 * 60 * 60_000, minItems: 2,
  maxAdjustment: 0.25, recencyHalfLifeGroups: 2,
});

export interface WorkingFeatureSchema {
  readonly id: string;
  readonly version: string;
  readonly dimensions: readonly string[];
  readonly artifact: ArtifactVersion;
}

export interface WorkingSourceRef { readonly sourceId: string; readonly recordId: string }

/** A clear is a tombstone, and a negative action is not an invented rating. */
export interface WorkingRecord {
  readonly observation: Observation;
  readonly sessionRef: string | null;
  readonly kind: 'VALUE' | 'NEGATIVE' | 'CLEAR' | 'UNDO' | 'ATTENTION';
  readonly object: PredictionObject | null;
  readonly invalidates?: readonly WorkingSourceRef[];
  /** Canonical history-clear and interest-clear erase different signal slots. */
  readonly clearTargets?: readonly ('VALUE' | 'NEGATIVE')[];
}

export interface WorkingStateInput {
  readonly scope: PredictionScope;
  readonly target: TargetDefinition;
  readonly asOf: number;
  readonly session: { readonly ref: string; readonly startedAt: number } | null;
  readonly resetAt?: number | null;
  /** Includes the session prefix AND all visible own correction links affecting it. */
  readonly prefixComplete: boolean;
  readonly featureSchema: WorkingFeatureSchema;
  readonly records: readonly WorkingRecord[];
  readonly config?: Partial<WorkingConfig>;
  readonly availabilityBasis?: 'DECLARED_AVAILABLE_TIME' | 'STORED_CREATED_TIME';
}

export interface WorkingItem {
  readonly objectId: string;
  readonly direction: number;
  readonly occurredAt: number;
  readonly sourceRefs: readonly { readonly sourceId: string; readonly recordId: string; readonly revision: number }[];
  readonly features: Readonly<Record<string, number | null>>;
  readonly source: 'native' | 'synthetic';
  readonly kind: 'VALUE' | 'NEGATIVE';
}

export interface WorkingState {
  readonly kind: 'working-state';
  readonly version: 'working-state-v1';
  readonly status: 'ACTIVE' | 'NO_SESSION' | 'EMPTY' | 'RESET_EMPTY' | 'INCOMPLETE_PREFIX'
    | 'SESSION_EXPIRED' | 'IDLE_EXPIRED' | 'INSUFFICIENT_SUPPORT';
  readonly scope: PredictionScope;
  readonly target: TargetDefinition;
  readonly asOf: number;
  readonly session: WorkingStateInput['session'];
  readonly resetAt: number | null;
  readonly prefixComplete: boolean;
  readonly featureSchema: WorkingFeatureSchema;
  readonly config: WorkingConfig;
  readonly records: readonly WorkingRecord[];
  readonly items: readonly WorkingItem[];
  readonly groups: readonly { readonly occurredAt: number; readonly objectIds: readonly string[] }[];
  readonly vectors: { readonly ordered: Readonly<Record<string, number>>; readonly static: Readonly<Record<string, number>> };
  readonly support: {
    readonly distinctItems: number; readonly currentSessions: number;
    readonly nativeItems: number; readonly syntheticItems: number;
    readonly observedRatings: number; readonly explicitNegativeItems: number;
  };
  readonly exclusions: Readonly<Record<string, number>>;
  readonly availabilityBasis: 'DECLARED_AVAILABLE_TIME' | 'STORED_CREATED_TIME';
  readonly completenessBasis: 'CALLER_DECLARED_SESSION_PREFIX_AND_CORRECTION_CLOSURE';
  readonly commitAvailability: 'UNKNOWN';
  readonly interpretation: 'TEMPORARY_INTENT_HYPOTHESIS';
  readonly historicalFeatureEligible: false;
  readonly learnable: false;
  readonly nativeActivated: false;
  readonly observedEvaluationCount: 0;
}

export type WorkingControl = 'OFF' | 'STATIC' | 'ORDERED';
export interface WorkingAdjustment {
  readonly version: 'working-policy-v1';
  readonly control: WorkingControl;
  readonly value: number;
  readonly reason: 'OFF' | 'INACTIVE_STATE' | 'NO_FEATURE_COVERAGE' | 'ADJUSTED';
  readonly stateVersion: WorkingState['version'];
  readonly objectId: string;
  readonly uncertainty: 'unavailable';
  readonly calibration: 'uncalibrated';
  readonly nativeActivated: false;
  readonly learnable: false;
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function id(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f]/u.test(value);
}
function instant(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}
function freeze<T>(input: T): T {
  const copy = structuredClone(input);
  const visit = (value: unknown): void => {
    if (value && typeof value === 'object') { Object.values(value).forEach(visit); Object.freeze(value); }
  };
  visit(copy); return copy;
}
function config(input: Partial<WorkingConfig> = {}): WorkingConfig {
  requireValue(input && typeof input === 'object' && !Array.isArray(input), 'Invalid WorkingState config');
  requireValue(Object.keys(input).every(key => Object.hasOwn(workingConfigDefaults, key)), 'Unknown WorkingState config field');
  const result = { ...workingConfigDefaults, ...input };
  for (const key of ['maxRecords', 'maxItems', 'maxFeatures', 'maxInvalidations'] as const) {
    requireValue(Number.isSafeInteger(result[key]) && result[key] >= 1 && result[key] <= workingConfigDefaults[key],
      `Invalid WorkingState ${key} budget`);
  }
  requireValue(Number.isSafeInteger(result.minItems) && result.minItems >= 2 && result.minItems <= result.maxItems,
    'WorkingState requires at least two distinct Items');
  requireValue(instant(result.idleTtlMs) && result.idleTtlMs > 0 && result.idleTtlMs <= workingConfigDefaults.idleTtlMs,
    'Invalid WorkingState idle expiry');
  requireValue(instant(result.maxSessionMs) && result.maxSessionMs > 0 && result.maxSessionMs <= workingConfigDefaults.maxSessionMs,
    'Invalid WorkingState session expiry');
  requireValue(Number.isFinite(result.maxAdjustment) && result.maxAdjustment >= 0 && result.maxAdjustment <= 0.25,
    'WorkingState adjustment must be bounded by 0.25');
  requireValue(Number.isFinite(result.recencyHalfLifeGroups) && result.recencyHalfLifeGroups > 0
    && result.recencyHalfLifeGroups <= 32, 'Invalid WorkingState group half-life');
  return result;
}
function targetCopy(target: TargetDefinition): TargetDefinition {
  requireValue(target && id(target.id) && id(target.version), 'WorkingState target identity required');
  requireValue(target.scale && Number.isFinite(target.scale.min) && Number.isFinite(target.scale.max)
    && target.scale.min < target.scale.max && Number.isFinite(target.scale.max - target.scale.min), 'Invalid WorkingState target scale');
  requireValue(['maximize', 'minimize'].includes(target.objective)
    && ['object-observation', 'action-outcome'].includes(target.conditioning)
    && ['required', 'not-required'].includes(target.exposure), 'Unsupported WorkingState target');
  return { id: target.id, version: target.version, scale: { min: target.scale.min, max: target.scale.max },
    objective: target.objective, conditioning: target.conditioning, exposure: target.exposure };
}
function artifactCopy(artifact: ArtifactVersion, asOf: number): ArtifactVersion {
  requireValue(artifact && id(artifact.id) && id(artifact.version) && id(artifact.representationVersion),
    'WorkingState feature artifact identity required');
  requireValue(instant(artifact.availableAt) && artifact.availableAt <= asOf, 'WorkingState feature artifact unavailable');
  requireValue(artifact.trainedThrough === null || (instant(artifact.trainedThrough)
    && artifact.trainedThrough <= artifact.availableAt), 'WorkingState feature artifact future training');
  requireValue(['fixture-only', 'research-only'].includes(artifact.use), 'Unsupported WorkingState artifact use');
  requireValue(Array.isArray(artifact.sourceRefs) && artifact.sourceRefs.length <= 32 && artifact.sourceRefs.every(id),
    'Invalid WorkingState feature artifact sources');
  return { id: artifact.id, version: artifact.version, representationVersion: artifact.representationVersion,
    availableAt: artifact.availableAt, trainedThrough: artifact.trainedThrough, use: artifact.use, sourceRefs: [...artifact.sourceRefs] };
}
function objectCopy(object: PredictionObject, schema: WorkingFeatureSchema, asOf: number): PredictionObject {
  requireValue(object && id(object.id), 'WorkingState object identity required');
  requireValue(instant(object.availableAt) && object.availableAt <= asOf, 'WorkingState object features unavailable');
  const artifact = artifactCopy(object.artifact, asOf);
  requireValue(artifact.id === schema.artifact.id && artifact.version === schema.artifact.version
    && artifact.representationVersion === schema.artifact.representationVersion
    && JSON.stringify(artifact) === JSON.stringify(schema.artifact), 'WorkingState feature artifact/schema mismatch');
  requireValue(object.features && typeof object.features === 'object' && !Array.isArray(object.features)
    && Object.keys(object.features).every(key => schema.dimensions.includes(key)), 'Unknown WorkingState feature dimension');
  const features: Record<string, number | null> = Object.create(null) as Record<string, number | null>;
  for (const key of schema.dimensions) {
    const value = Object.hasOwn(object.features, key) ? object.features[key] : null;
    requireValue(value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1),
      'WorkingState features must be finite normalized 0..1 or missing');
    features[key] = value;
  }
  return { id: object.id, availableAt: object.availableAt, artifact, features };
}
function recordKey(row: WorkingRecord): string {
  const p = row.observation.provenance;
  return JSON.stringify([p.source.id, p.recordId]);
}
function recordRef(row: WorkingRecord): { sourceId: string; recordId: string; revision: number } {
  const p = row.observation.provenance;
  return { sourceId: p.source.id, recordId: p.recordId, revision: p.revision };
}
function observationCopy(row: Observation, target: TargetDefinition): Observation {
  requireValue(id(row.subjectId) && id(row.actingIdentityRef) && id(row.objectId)
    && (row.actionId === null || id(row.actionId)) && (row.predictionId === null || id(row.predictionId)),
  'Invalid WorkingState observation identity');
  requireValue(instant(row.occurredAt) && instant(row.availableAt), 'Invalid WorkingState observation instant');
  requireValue(row.measurement && ['observed', 'missing'].includes(row.measurement.status), 'Invalid WorkingState measurement');
  if (row.measurement.status === 'observed') {
    requireValue(Number.isFinite(row.measurement.value) && row.measurement.value >= target.scale.min
      && row.measurement.value <= target.scale.max, 'WorkingState value outside target scale');
  } else requireValue(['unknown', 'unexposed', 'censored', 'immature'].includes(row.measurement.reason), 'Invalid WorkingState missing reason');
  requireValue(row.raw && row.raw.scale && Number.isFinite(row.raw.scale.min) && Number.isFinite(row.raw.scale.max)
    && row.raw.scale.max > row.raw.scale.min && (row.raw.value === null || (Number.isFinite(row.raw.value)
      && row.raw.value >= row.raw.scale.min && row.raw.value <= row.raw.scale.max)), 'Invalid WorkingState raw value/scale');
  requireValue(['verified', 'unknown', 'not-exposed'].includes(row.exposure), 'Invalid WorkingState exposure status');
  const p = row.provenance;
  requireValue(id(p.recordId) && id(p.source.id) && Number.isSafeInteger(p.revision) && p.revision > 0,
    'Invalid WorkingState provenance');
  requireValue((p.origin === 'observed' && p.source.kind === 'native')
    || (p.origin === 'synthetic' && p.source.kind === 'generator'), 'Unsupported WorkingState source provenance');
  if (p.origin === 'synthetic') requireValue(id(p.source.version) && Array.isArray(p.source.parentRefs)
    && p.source.parentRefs.length <= 32 && p.source.parentRefs.every(id), 'Invalid WorkingState generator lineage');
  const provenance = p.origin === 'synthetic'
    ? { origin: p.origin, recordId: p.recordId, revision: p.revision,
      source: { kind: 'generator' as const, id: p.source.id, version: p.source.version, parentRefs: [...p.source.parentRefs] } }
    : { origin: p.origin, recordId: p.recordId, revision: p.revision, source: { kind: 'native' as const, id: p.source.id } };
  return { subjectId: row.subjectId, actingIdentityRef: row.actingIdentityRef, objectId: row.objectId,
    actionId: row.actionId, predictionId: row.predictionId, targetId: row.targetId, targetVersion: row.targetVersion,
    measurement: row.measurement.status === 'observed' ? { status: 'observed', value: row.measurement.value }
      : { status: 'missing', reason: row.measurement.reason }, raw: { value: row.raw.value, scale: { ...row.raw.scale } },
    occurredAt: row.occurredAt, availableAt: row.availableAt, exposure: row.exposure,
    access: { kind: 'subject', subjectId: row.subjectId }, provenance };
}

/** Pure source-only hypothesis; neither this state nor its support admits native serving. */
export function deriveWorkingState(input: WorkingStateInput): WorkingState {
  requireValue(input && instant(input.asOf), 'Invalid WorkingState cutoff');
  const asOf = input.asOf, c = config(input.config), target = targetCopy(input.target);
  const s = input.scope;
  requireValue(s && s.subject && id(s.subject.id) && ['individual', 'system'].includes(s.subject.kind)
    && id(s.actingIdentityRef) && id(s.sessionRef), 'WorkingState requires an individual/system subject and acting identity; group unsupported');
  requireValue(s.evidence && Array.isArray(s.evidence.sourceIds) && s.evidence.sourceIds.length <= 32
    && s.evidence.sourceIds.every(id) && new Set(s.evidence.sourceIds).size === s.evidence.sourceIds.length
    && Array.isArray(s.evidence.cohortIds) && s.evidence.cohortIds.length <= 32 && s.evidence.cohortIds.every(id)
    && ['exclude', 'fixture-only'].includes(s.evidence.synthetic), 'Invalid WorkingState evidence scope');
  const scope: PredictionScope = { subject: { id: s.subject.id, kind: s.subject.kind }, actingIdentityRef: s.actingIdentityRef,
    sessionRef: s.sessionRef, evidence: { sourceIds: [...s.evidence.sourceIds], cohortIds: [...s.evidence.cohortIds], synthetic: s.evidence.synthetic } };
  requireValue(typeof input.prefixComplete === 'boolean', 'WorkingState needs explicit full-prefix and correction-closure declaration');
  const basis = input.availabilityBasis ?? 'DECLARED_AVAILABLE_TIME';
  requireValue(['DECLARED_AVAILABLE_TIME', 'STORED_CREATED_TIME'].includes(basis), 'Invalid WorkingState availability basis');
  requireValue(input.session === null || (input.session && id(input.session.ref) && input.session.ref === scope.sessionRef
    && instant(input.session.startedAt) && input.session.startedAt <= asOf), 'Invalid WorkingState session boundary');
  const session = input.session === null ? null : { ref: input.session.ref, startedAt: input.session.startedAt };
  const resetAt = input.resetAt ?? null;
  requireValue(resetAt === null || (instant(resetAt) && resetAt <= asOf), 'Invalid WorkingState reset cutoff');
  const schemaInput = input.featureSchema;
  requireValue(schemaInput && id(schemaInput.id) && id(schemaInput.version) && Array.isArray(schemaInput.dimensions)
    && schemaInput.dimensions.length > 0 && schemaInput.dimensions.length <= c.maxFeatures
    && schemaInput.dimensions.every(id) && new Set(schemaInput.dimensions).size === schemaInput.dimensions.length,
  'Invalid WorkingState feature schema/dimension budget');
  const schema: WorkingFeatureSchema = { id: schemaInput.id, version: schemaInput.version,
    dimensions: [...schemaInput.dimensions].sort(), artifact: artifactCopy(schemaInput.artifact, asOf) };
  requireValue(Array.isArray(input.records) && input.records.length <= c.maxRecords, 'WorkingState record budget exceeded; full prefix required');
  const exclusions: Record<string, number> = {};
  const exclude = (reason: string): void => { exclusions[reason] = (exclusions[reason] ?? 0) + 1; };
  const latest = new Map<string, WorkingRecord>();
  let invalidationCount = 0;
  for (const row of input.records) {
    requireValue(row && row.observation && row.observation.provenance && row.observation.provenance.source,
      'Invalid WorkingState record envelope');
    const o = row.observation, p = o.provenance;
    if (o.subjectId !== scope.subject.id || o.actingIdentityRef !== scope.actingIdentityRef
      || o.access?.kind !== 'subject' || o.access.subjectId !== scope.subject.id) { exclude('FOREIGN_SCOPE'); continue; }
    if (p.source.kind === 'external' || !scope.evidence.sourceIds.includes(p.source.id)
      || (p.origin === 'synthetic' && scope.evidence.synthetic !== 'fixture-only')) { exclude('SOURCE_NOT_ADMITTED'); continue; }
    if (o.targetId !== target.id || o.targetVersion !== target.version) { exclude('INCOMPATIBLE_TARGET'); continue; }
    requireValue(instant(o.occurredAt) && instant(o.availableAt), 'Invalid WorkingState observation instant');
    if (o.occurredAt > asOf || o.availableAt > asOf) { exclude('UNAVAILABLE_OR_FUTURE'); continue; }
    requireValue(['VALUE', 'NEGATIVE', 'CLEAR', 'UNDO', 'ATTENTION'].includes(row.kind), 'Unsupported WorkingState record kind');
    requireValue(row.sessionRef === null || id(row.sessionRef), 'Invalid WorkingState record session');
    // Own other-session replacements participate only in correction closure;
    // their surviving taste is never admitted as this session's evidence.
    if (row.sessionRef !== session?.ref) {
      exclude('FOREIGN_SESSION');
      if (row.kind === 'ATTENTION') continue;
    }
    const invalidates = row.invalidates ?? [];
    requireValue(Array.isArray(invalidates) && invalidates.length <= c.maxInvalidations
      && invalidates.every(ref => ref && id(ref.sourceId) && id(ref.recordId) && ref.sourceId === p.source.id),
    'Invalid WorkingState exact correction references');
    requireValue((row.kind === 'UNDO' || row.kind === 'CLEAR') || invalidates.length === 0,
      'Only WorkingState correction/tombstone records may invalidate evidence');
    requireValue(row.kind !== 'UNDO' || invalidates.length > 0, 'WorkingState UNDO requires exact source references');
    const clearTargets = row.kind === 'CLEAR' ? row.clearTargets ?? ['VALUE', 'NEGATIVE'] : [];
    requireValue(Array.isArray(clearTargets) && clearTargets.length <= 2
      && clearTargets.every(kind => ['VALUE', 'NEGATIVE'].includes(kind))
      && new Set(clearTargets).size === clearTargets.length
      && (row.kind !== 'CLEAR' || clearTargets.length > 0)
      && (row.kind === 'CLEAR' || row.clearTargets === undefined || row.clearTargets.length === 0),
    'Invalid WorkingState clear target slots');
    invalidationCount += invalidates.length;
    requireValue(invalidationCount <= c.maxInvalidations, 'WorkingState correction reference budget exceeded');
    const object = row.object === null ? null : objectCopy(row.object, schema, asOf);
    requireValue(object === null || object.id === o.objectId, 'WorkingState observation/object identity mismatch');
    const copied: WorkingRecord = { observation: observationCopy(o, target), sessionRef: row.sessionRef,
      kind: row.kind, object, invalidates: invalidates.map(ref => ({ sourceId: ref.sourceId, recordId: ref.recordId })),
      clearTargets: [...clearTargets] };
    const key = recordKey(copied), prior = latest.get(key);
    if (prior && prior.observation.provenance.revision === p.revision) {
      requireValue(JSON.stringify(prior) === JSON.stringify(copied), 'Conflicting WorkingState source revision');
      exclude('DUPLICATE_RECORD'); continue;
    }
    if (!prior || p.revision > prior.observation.provenance.revision) latest.set(key, copied);
  }
  const records = [...latest.values()].sort((a, b) => a.observation.occurredAt - b.observation.occurredAt
    || a.observation.availableAt - b.observation.availableAt || recordKey(a).localeCompare(recordKey(b), 'en'));
  const invalidated = new Set<string>();
  for (const row of records) for (const ref of row.invalidates ?? []) {
    const key = JSON.stringify([ref.sourceId, ref.recordId]), original = latest.get(key);
    requireValue(key !== recordKey(row) && original?.kind !== 'UNDO', 'WorkingState correction cannot target itself/another UNDO');
    if (original) requireValue(original.observation.objectId === row.observation.objectId,
      'WorkingState correction crosses object identity');
    invalidated.add(key);
  }
  const perItem = new Map<string, WorkingRecord[]>();
  for (const row of records) {
    if (invalidated.has(recordKey(row))) { exclude('INVALIDATED'); continue; }
    if (row.kind === 'UNDO' || row.kind === 'ATTENTION') { if (row.kind === 'ATTENTION') exclude('ATTENTION_NOT_TASTE'); continue; }
    if (!session || row.observation.occurredAt < session.startedAt
      || (resetAt !== null && row.observation.occurredAt <= resetAt)) { exclude('BEFORE_SESSION_OR_RESET'); continue; }
    const objectId = row.observation.objectId, current = perItem.get(objectId);
    if (!current) perItem.set(objectId, [row]); else current.push(row);
  }
  requireValue(perItem.size <= c.maxItems, 'WorkingState distinct Item budget exceeded');
  const items: WorkingItem[] = [];
  for (const [objectId, history] of [...perItem].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    let rows: WorkingRecord[] = [];
    // Replay the surviving per-Item transitions. A selective clear never revives
    // a value that a later negative action replaced, and never clears its other slot.
    for (const at of [...new Set(history.map(row => row.observation.occurredAt))].sort((a, b) => a - b)) {
      const group = history.filter(row => row.observation.occurredAt === at);
      const tastes = group.filter(row => row.kind === 'VALUE' || row.kind === 'NEGATIVE');
      const clears = new Set(group.flatMap(row => row.kind === 'CLEAR' ? row.clearTargets ?? [] : []));
      if (!tastes.length) {
        if (rows.length && clears.has(rows[0]!.kind as 'VALUE' | 'NEGATIVE')) rows = [];
        continue;
      }
      const signatures = tastes.map(row => JSON.stringify([row.kind, row.observation.measurement,
        row.object?.features ?? null, row.observation.provenance.origin, row.sessionRef]));
      if (new Set(signatures).size !== 1 || clears.has(tastes[0]!.kind as 'VALUE' | 'NEGATIVE')) {
        exclude('AMBIGUOUS_LATEST_TIME_GROUP'); rows = []; continue;
      }
      rows = tastes;
    }
    if (!rows.length) { exclude('CLEARED_OR_UNKNOWN_ITEM'); continue; }
    const row = rows[0]!, o = row.observation;
    if (row.sessionRef !== session?.ref) { exclude('FOREIGN_SESSION_RESOLVED_ITEM'); continue; }
    if (row.kind === 'VALUE' && o.measurement.status !== 'observed') { exclude('CLEARED_OR_UNKNOWN_ITEM'); continue; }
    if (row.kind !== 'VALUE' && row.kind !== 'NEGATIVE') continue;
    if (!row.object || !schema.dimensions.some(key => (row.object!.features[key] ?? 0) > 0)) { exclude('MISSING_FEATURES'); continue; }
    const direction = row.kind === 'NEGATIVE' ? -1 : o.measurement.status === 'observed'
      ? (2 * ((o.measurement.value - target.scale.min) / (target.scale.max - target.scale.min)) - 1)
        * (target.objective === 'maximize' ? 1 : -1) : 0;
    items.push({ objectId, direction, occurredAt: o.occurredAt, sourceRefs: rows.map(recordRef),
      features: { ...row.object.features }, source: o.provenance.origin === 'synthetic' ? 'synthetic' : 'native', kind: row.kind });
  }
  items.sort((a, b) => a.occurredAt - b.occurredAt || a.objectId.localeCompare(b.objectId, 'en'));
  const groups = [...new Set(items.map(item => item.occurredAt))].sort((a, b) => a - b)
    .map(occurredAt => ({ occurredAt, objectIds: items.filter(item => item.occurredAt === occurredAt).map(item => item.objectId).sort() }));
  const activity = records.filter(row => session && row.sessionRef === session.ref
    && row.observation.occurredAt >= session.startedAt && (resetAt === null || row.observation.occurredAt > resetAt));
  // Correction closure can erase selected-session evidence without extending its lifetime.
  const lastAt = activity.length ? Math.max(...activity.map(row => row.observation.occurredAt)) : null;
  const status: WorkingState['status'] = !session ? 'NO_SESSION' : !input.prefixComplete ? 'INCOMPLETE_PREFIX'
    : asOf - session.startedAt >= c.maxSessionMs ? 'SESSION_EXPIRED'
      : lastAt !== null && asOf - lastAt >= c.idleTtlMs ? 'IDLE_EXPIRED'
        : items.length === 0 ? (resetAt === null ? 'EMPTY' : 'RESET_EMPTY')
          : items.length < c.minItems ? 'INSUFFICIENT_SUPPORT' : 'ACTIVE';
  const vectors = { ordered: Object.create(null) as Record<string, number>, static: Object.create(null) as Record<string, number> };
  for (const feature of schema.dimensions) for (const control of ['ordered', 'static'] as const) {
    let total = 0, weight = 0;
    for (const item of items) {
      const x = item.features[feature] ?? 0;
      const groupDistance = groups.length - 1 - groups.findIndex(group => group.occurredAt === item.occurredAt);
      const w = x * (control === 'ordered' ? 2 ** (-groupDistance / c.recencyHalfLifeGroups) : 1);
      total += w * item.direction; weight += w;
    }
    vectors[control][feature] = weight === 0 ? 0 : Math.max(-1, Math.min(1, total / weight));
  }
  return freeze({ kind: 'working-state', version: 'working-state-v1', status, scope, target, asOf, session, resetAt,
    prefixComplete: input.prefixComplete, featureSchema: schema, config: c, records, items, groups, vectors,
    support: { distinctItems: items.length, currentSessions: items.length ? 1 : 0,
      nativeItems: items.filter(item => item.source === 'native').length, syntheticItems: items.filter(item => item.source === 'synthetic').length,
      observedRatings: items.filter(item => item.kind === 'VALUE').length, explicitNegativeItems: items.filter(item => item.kind === 'NEGATIVE').length },
    exclusions, availabilityBasis: basis, completenessBasis: 'CALLER_DECLARED_SESSION_PREFIX_AND_CORRECTION_CLOSURE',
    commitAvailability: 'UNKNOWN', interpretation: 'TEMPORARY_INTENT_HYPOTHESIS', historicalFeatureEligible: false,
    learnable: false, nativeActivated: false, observedEvaluationCount: 0 });
}

/** Returns only a bounded candidate component; the existing scorer/ranks are untouched. */
export function scoreWorkingAdjustment(input: {
  readonly state: WorkingState; readonly object: PredictionObject; readonly control?: WorkingControl;
}): WorkingAdjustment {
  const state = input.state;
  requireValue(state && state.kind === 'working-state' && state.version === 'working-state-v1', 'Unsupported WorkingState version');
  const rebuilt = deriveWorkingState(state);
  for (const key of ['status', 'items', 'groups', 'vectors', 'support'] as const) {
    requireValue(JSON.stringify(state[key]) === JSON.stringify(rebuilt[key]), 'WorkingState does not match its frozen prefix');
  }
  const object = objectCopy(input.object, state.featureSchema, state.asOf), control = input.control ?? 'OFF';
  requireValue(['OFF', 'STATIC', 'ORDERED'].includes(control), 'Unsupported WorkingState policy control');
  let value = 0;
  let reason: WorkingAdjustment['reason'] = control === 'OFF' ? 'OFF' : 'INACTIVE_STATE';
  if (control !== 'OFF' && state.status === 'ACTIVE') {
    let total = 0, weight = 0;
    const vector = control === 'ORDERED' ? state.vectors.ordered : state.vectors.static;
    for (const feature of state.featureSchema.dimensions) {
      const x = object.features[feature] ?? 0;
      total += x * vector[feature]!; weight += x;
    }
    reason = weight ? 'ADJUSTED' : 'NO_FEATURE_COVERAGE';
    value = weight ? Math.max(-state.config.maxAdjustment,
      Math.min(state.config.maxAdjustment, state.config.maxAdjustment * total / weight)) : 0;
    if (Object.is(value, -0)) value = 0;
  }
  return freeze({ version: 'working-policy-v1', control, value, reason, stateVersion: state.version,
    objectId: object.id, uncertainty: 'unavailable', calibration: 'uncalibrated', nativeActivated: false, learnable: false });
}
