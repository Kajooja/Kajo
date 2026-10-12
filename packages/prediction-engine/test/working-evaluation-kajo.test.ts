import { describe, expect, it } from 'vitest';
import { normalizeKajoWorkingEvaluationPlan, KajoWorkingEvaluationSnapshotError } from '../src/adapters/kajo-working-evaluation.js';
import type { KajoWorkingEvaluationSnapshots } from '../src/adapters/kajo-working-evaluation.js';
import { normalizeKajoWorkingSession } from '../src/adapters/kajo-working-state.js';
import type { KajoWorkingEvent, KajoWorkingSessionInput } from '../src/adapters/kajo-working-state.js';
import type { PredictionObject } from '../src/contracts.js';
import { deriveWorkingState, scoreWorkingAdjustment } from '../src/working-state.js';
import type { WorkingFeatureSchema } from '../src/working-state.js';
import { evaluateWorkingPlan, freezeWorkingEvaluationPlan } from '../src/working-evaluation.js';
import type { WorkingEvaluationPlan, WorkingOutcomeCapture } from '../src/working-evaluation.js';

// Generated row shapes test the boundary. The full-schema producer test is
// scripts/database/working-evaluation-kajo.test.mjs; these are not native evidence.
type Row = Record<string, unknown>;
type Fixture = { -readonly [K in keyof KajoWorkingEvaluationSnapshots]: KajoWorkingEvaluationSnapshots[K] };
const id = (n: number) => `a9150000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1), profile = id(2), session = id(3), prediction = id(4), captureId = id(5);
const controls = ['OFF', 'STATIC', 'ORDERED'] as const;
function fixture(generation = 'v2'): Fixture {
  const policy = `personal-persona-v1+personal-working-off-${generation}`;
  const capture: Row = { captureId, version: `native-working-capture-${generation}`, kind: 'working-state',
    stateVersion: 'working-state-v1', actorUserId: actor, profile: { id: profile, type: 'PERSONAL', ownerUserId: actor },
    session: { id: session, actor_user_id: actor, profile_id: profile }, cutoff: 100, asOf: 100,
    learnable: false, historicalFeatureEligible: false, nativeActivated: false, commitAvailability: 'UNKNOWN',
    availabilityBasis: 'STORED_CREATED_TIME', featureAvailabilityBasis: 'CURRENT_MVCC_SNAPSHOT_KNOWN_AT_CAPTURE',
    prefixComplete: true, status: 'ACTIVE', rawEvents: [], records: [], items: [], itemFeatures: [],
    featureSchema: { dimensions: ['warm'] }, ...(generation === 'v2' ? { resetAt: 50, resetControls: [], resetSourceRefs: [] } : {}) };
  const sourceCandidates = [20, 21, 22].map((n, i) => ({ prediction_id: prediction, item_id: id(n),
    source_score: [0.8, 0.7, 0.1][i], final_score: [0.8, 0.7, 0.1][i], source_rank: i + 1, final_rank: i + 1,
    selected_for_delivery: i < 2, created_at: 90, explanation: { policyVersion: policy,
      resurfacingPolicy: { eligible: true, classification: 'UNSEEN' },
      workingIntent: { version: `personal-working-features-${generation}`, captureId, stateVersion: 'working-state-v1',
        policyVersion: 'working-policy-v1', control: 'OFF', staticAdjustment: 0.1, orderedAdjustment: 0.1,
        learnable: false, historicalFeatureEligible: false, nativeActivated: false,
        ...(generation === 'v2' ? { captureVersion: capture.version, resetAt: 50, resetSourceRefs: [] } : {}) } } }));
  const comparisons = controls.map(control => ({ source_prediction_id: prediction, control, created_at: 95,
    result: { version: `personal-working-shadow-${generation}`, sourcePredictionId: prediction, captureId, control,
      sourceModelVersion: 'native-model-v1', sourcePolicyVersion: policy, policyVersion: 'working-policy-v1',
      servingControl: 'OFF', comparisonScope: 'FROZEN_CANDIDATE_POOL_AND_FINAL_DELIVERY_POLICY',
      commitAvailability: 'UNKNOWN', observedEvaluationCount: 0, calibration: 'uncalibrated', uncertainty: 'unavailable',
      asOf: 100, candidateCount: 3, learnable: false, historicalFeatureEligible: false, nativeActivated: false,
      ...(generation === 'v2' ? { captureVersion: capture.version, resetAt: 50, resetSourceRefs: [] } : {}),
      candidates: sourceCandidates.map((candidate, i) => ({ itemId: candidate.item_id, eligible: true, tier: 0,
        selected: i < 2, adjustment: control === 'OFF' ? 0 : 0.1,
        score: control === 'OFF' ? candidate.final_score : control === 'STATIC' ? [0.82, 0.72, 0.12][i] : [0.5, 0.6, 0.1][i],
        rank: control === 'ORDERED' ? [2, 1, 3][i] : i + 1 })) } }));
  return { actorUserId: actor, profile: { id: profile, type: 'PERSONAL', ownerUserId: actor },
    sourceRun: { id: prediction, actor_user_id: actor, profile_id: profile, session_id: session, genome_id: id(6),
      requested_at: 120, created_at: 80, discovery_mode: 'FOR_YOU', requested_item_type: 'BOOK',
      model_version: 'native-model-v1', base_model_version: 'native-base-v1', policy_version: policy,
      candidate_count: 3, result_count: 2, state_snapshot: { workingState: capture } },
    sourceCandidates, comparisons, snapshotObservedAt: 200,
    planning: { id: 'fixture:plan', createdAt: 210, horizon: { startAt: 210, endAt: 310 },
      pairs: [{ pairId: 'fixture:pair', leftItemId: id(20), rightItemId: id(21) }] },
    references: { scopeId: 'fixture', subjectRef: 'fixture:subject', actorRef: 'fixture:actor', sessionRef: 'fixture:session',
      sourcePredictionRef: 'fixture:prediction', captureRef: 'fixture:capture', controlRefs: {
        OFF: 'fixture:off', STATIC: 'fixture:static', ORDERED: 'fixture:ordered' },
      objects: sourceCandidates.map((candidate, i) => ({ itemId: candidate.item_id, objectRef: `fixture:item-${2 - i}` })) } };
}
function source(input: KajoWorkingEvaluationSnapshots): Row { return input.sourceRun as Row; }
function capture(input: KajoWorkingEvaluationSnapshots): Row { return ((source(input).state_snapshot as Row).workingState as Row); }
function comparison(input: KajoWorkingEvaluationSnapshots, index = 0): Row { return input.comparisons[index] as Row; }
function result(input: KajoWorkingEvaluationSnapshots, index = 0): Row { return comparison(input, index).result as Row; }
function pool(input: KajoWorkingEvaluationSnapshots, index = 0): Row[] { return result(input, index).candidates as Row[]; }
const rejected = (input: KajoWorkingEvaluationSnapshots) => expect(() => normalizeKajoWorkingEvaluationPlan(input))
  .toThrow(KajoWorkingEvaluationSnapshotError);
function intent(input: KajoWorkingEvaluationSnapshots, index = 0): Row {
  return ((input.sourceCandidates[index] as Row).explanation as Row).workingIntent as Row;
}
function candidateFeatures(input: KajoWorkingEvaluationSnapshots, index = 0): Row {
  return intent(input, index).candidateFeatures as Row;
}
function nativeEvent(n: number, item: number, rating: number, at: number): KajoWorkingEvent {
  return { id: id(n), actor_user_id: actor, profile_id: profile, session_id: session, item_id: id(item),
    item_type: 'BOOK', event_type: 'ITEM_RATED', occurred_at: at, created_at: at, properties: { rating } };
}
function schemaReference(input: KajoWorkingEvaluationSnapshots): Row {
  const schema = capture(input).featureSchema as Row, artifact = schema.artifact as Row;
  return { id: schema.id, version: schema.version, artifactId: artifact.id, artifactVersion: artifact.version,
    representationVersion: artifact.representationVersion, dimensionCount: (schema.dimensions as unknown[]).length };
}
/** Rebuild producer-shaped diagnostics from the full canonical frozen prefix. */
function refreshV3Diagnostics(input: Fixture): void {
  const frozen = capture(input);
  const normalized = normalizeKajoWorkingSession({ profile: input.profile, actorUserId: input.actorUserId,
    session: frozen.session as KajoWorkingSessionInput['session'], events: frozen.rawEvents as KajoWorkingEvent[],
    objects: frozen.itemFeatures as PredictionObject[], featureSchema: frozen.featureSchema as unknown as WorkingFeatureSchema,
    asOf: frozen.asOf as number, prefixComplete: frozen.prefixComplete as boolean,
    resetAt: frozen.resetAt as number | null,
    refs: { scopeId: input.references.scopeId, subjectRef: input.references.subjectRef,
      actorRef: input.references.actorRef, sessionRef: input.references.sessionRef } });
  const state = deriveWorkingState(normalized);
  Object.assign(frozen, { status: state.status, config: structuredClone(state.config),
    support: structuredClone(state.support), vectors: structuredClone(state.vectors),
    records: state.records.map(record => ({ eventId: record.observation.provenance.recordId,
      itemId: record.observation.objectId, kind: record.kind })),
    items: structuredClone(state.items), groups: structuredClone(state.groups) });
  for (let i = 0; i < input.sourceCandidates.length; i++) {
    const workingIntent = intent(input, i), envelope = candidateFeatures(input, i);
    const dimensions = (frozen.featureSchema as unknown as WorkingFeatureSchema).dimensions;
    const object: PredictionObject = { id: (input.sourceCandidates[i] as Row).item_id as string,
      features: Object.fromEntries(dimensions.map((key, index) => [key, (envelope.features as number[])[index]!])),
      availableAt: frozen.asOf as number,
      artifact: (frozen.featureSchema as unknown as WorkingFeatureSchema).artifact };
    for (const control of ['STATIC', 'ORDERED'] as const) {
      const adjustment = scoreWorkingAdjustment({ state, object, control }).value;
      workingIntent[control === 'STATIC' ? 'staticAdjustment' : 'orderedAdjustment'] = adjustment;
      pool(input, control === 'STATIC' ? 1 : 2)[i]!.adjustment = adjustment;
    }
  }
}
function v3Fixture(): Fixture {
  const input = fixture('v3'), frozen = capture(input);
  const artifact = { id: 'native-working-tags', version: '1', representationVersion: 'native-binary-tags-v1',
    availableAt: 100, trainedThrough: null, sourceRefs: ['kajo-canonical-events-v1'], use: 'research-only' } as const;
  const schema = { id: 'native-working-tags', version: '1', dimensions: ['dark', 'warm'], artifact };
  Object.assign(frozen, { session: { id: session, actor_user_id: actor, profile_id: profile, started_at: 0, created_at: 0 },
    featureSchema: schema, resetAt: null, resetControls: [], resetSourceRefs: [],
    rawEvents: [nativeEvent(11, 30, 0, 10), nativeEvent(12, 31, 10, 20)],
    itemFeatures: [30, 31].map(n => ({ id: id(n), availableAt: 100, artifact,
      tags: ['dark', 'warm'], sourceCreatedAt: 0, sourceUpdatedAt: 0, features: { dark: 1, warm: 1 } })) });
  for (let i = 0; i < input.sourceCandidates.length; i++) Object.assign(intent(input, i), {
    captureVersion: frozen.version, resetAt: null, resetSourceRefs: [], status: 'ACTIVE',
    candidateFeatures: { version: 'native-working-candidate-features-v1', status: 'AVAILABLE', captureId,
      asOf: 100, featureSchemaRef: schemaReference(input), featureEncoding: 'CAPTURE_DIMENSION_ORDER_BINARY_V1',
      availabilityBasis: 'SOURCE_RANKING_STATEMENT_SNAPSHOT', availableAt: null,
      commitAvailability: 'UNKNOWN', historicalFeatureEligible: false, learnable: false, nativeActivated: false,
      features: [[1, 1], [0, 0], [0, 1]][i], unavailableReason: null } });
  for (const comparison of input.comparisons as Row[]) Object.assign(comparison.result as Row,
    { captureVersion: frozen.version, resetAt: null, resetSourceRefs: [] });
  input.references = { ...input.references,
    inputObjects: [30, 31].map((n, i) => ({ itemId: id(n), objectRef: `fixture:input-${i}` })),
    inputRecords: [11, 12].map((n, i) => ({ recordId: id(n), recordRef: `fixture:event-${i}` })) };
  refreshV3Diagnostics(input);
  return input;
}
function availablePlan(input: Fixture): WorkingEvaluationPlan & { working: { status: 'available' } } {
  const plan = freezeWorkingEvaluationPlan(normalizeKajoWorkingEvaluationPlan(input));
  expect(plan.working.status).toBe('available');
  if (plan.working.status !== 'available') throw new Error('Expected complete v3 Working fixture');
  return plan as WorkingEvaluationPlan & { working: { status: 'available' } };
}
function enrolledFixture(): Fixture {
  const input = v3Fixture(); input.snapshotObservedAt = 400;
  input.enrollment = { version: 'personal-working-enrollment-v1', enrollmentId: id(70), sourcePredictionId: prediction,
    actorUserId: actor, profileId: profile, sessionId: session, declaredAt: input.planning.createdAt,
    horizon: { ...input.planning.horizon }, matureAt: input.planning.horizon.endAt + 30,
    pairs: input.planning.pairs.map((pair, index) => ({ pairId: id(71 + index),
      leftItemId: pair.leftItemId, rightItemId: pair.rightItemId })),
    controls: controls.map((control, index) => ({ control, comparisonId: id(80 + index), createdAt: comparison(input, index).created_at })),
    commitAvailability: 'UNKNOWN', historicalFeatureEligible: false, learnable: false, nativeActivated: false };
  return input;
}

describe('native Personal Working evaluation snapshot adapter', () => {
  it('retains the actual later read clock when an immutable native enrollment fixes the earlier plan', () => {
    const input = enrolledFixture(), before = structuredClone(input), plan = availablePlan(input);
    expect(input).toEqual(before); expect(plan.createdAt).toBe(210); expect(plan.sourceBinding!.snapshotObservedAt).toBe(400);
    expect(plan.sourceBinding!.prospectiveDeclaration).toEqual({ basis: 'STORED_PROSPECTIVE_DECLARATION',
      declarationRef: 'fixture:plan', declaredAt: 210, commitAvailability: 'UNKNOWN' });
    expect(plan.controls.OFF.createdAt).toBe(95); expect(freezeWorkingEvaluationPlan(plan)).toEqual(plan);
    expect(plan.availabilityBasis).toBe('STORED_CREATED_TIME');
    for (const raw of [id(70), id(71), id(80), id(81), id(82)]) expect(JSON.stringify(plan)).not.toContain(raw);
    const undeclared = enrolledFixture(); delete undeclared.enrollment; rejected(undeclared);
  });

  it('requires exact native enrollment scope, closed versions/flags, declaration, horizon, pair orientation and actual control clocks', () => {
    for (const [key, value] of [['version', 'personal-working-enrollment-v2'], ['actorUserId', id(99)], ['profileId', id(99)],
      ['sessionId', id(99)], ['sourcePredictionId', id(99)], ['declaredAt', 211], ['matureAt', 309],
      ['commitAvailability', 'CERTIFIED'], ['learnable', true], ['historicalFeatureEligible', true], ['nativeActivated', true]] as const) {
      const input = enrolledFixture(); (input.enrollment as Row)[key] = value; rejected(input);
    }
    const horizon = enrolledFixture(); ((horizon.enrollment as Row).horizon as Row).endAt = 311; rejected(horizon);
    const pair = enrolledFixture(); ((pair.enrollment as Row).pairs as Row[])[0]!.leftItemId = id(21); rejected(pair);
    const control = enrolledFixture(); ((control.enrollment as Row).controls as Row[])[0]!.createdAt = 94; rejected(control);
    const duplicate = enrolledFixture(); ((duplicate.enrollment as Row).controls as Row[])[2]!.control = 'OFF'; rejected(duplicate);
    const earlierRead = enrolledFixture(); earlierRead.snapshotObservedAt = 200; rejected(earlierRead);
    const leaked = enrolledFixture(); leaked.planning = { ...leaked.planning, id: `fixture:${id(70)}` }; rejected(leaked);
  });

  it.each(['v1', 'v2'])('retains actual %s source and three control scores, with honest proxy clocks and missing candidate features', generation => {
    const raw = fixture(generation), before = structuredClone(raw), normalized = normalizeKajoWorkingEvaluationPlan(raw);
    const frozen = freezeWorkingEvaluationPlan(normalized);
    expect(normalized.sourceCutoff).toBe(100); expect(normalized.controls.OFF.createdAt).toBe(95);
    expect(normalized.createdAt).toBe(210); expect(normalized.availabilityBasis).toBe('STORED_CREATED_TIME');
    expect(normalized.controls.ORDERED.candidates.map(candidate => candidate.score)).toEqual([0.5, 0.6, 0.1]);
    expect(normalized.controls.STATIC.candidates[0]?.score).toBe(0.82); // Not 0.8+0.1.
    expect(normalized.working).toEqual({ status: 'unavailable', reason: 'FROZEN_CANDIDATE_FEATURES_UNAVAILABLE' });
    expect(frozen.support).toBeNull(); expect(frozen.integrityBasis).toBe('TRUSTED_CALLER_SNAPSHOT_NOT_AUTHORIZATION_CERTIFICATE');
    expect(frozen.sourceBinding).toMatchObject({ captureRef: 'fixture:capture', requestedAt: 120,
      storedSourceCreatedAt: 80, snapshotObservedAt: 200, commitAvailability: 'UNKNOWN', historicalFeatureEligible: false });
    expect(raw).toEqual(before); expect(Object.isFrozen(frozen.controls.OFF.candidates)).toBe(true);
    for (const rawId of [actor, profile, session, prediction, captureId, id(6), id(20), id(21), id(22)]) {
      expect(JSON.stringify(frozen).toLowerCase()).not.toContain(rawId);
    }
  });

  it('accepts a frozen child request later than its inherited capture, and source creation before the cutoff', () => {
    const input = fixture(); source(input).requested_at = 190;
    source(input).policy_version = `${String(source(input).policy_version)}+frozen-page-v1`;
    for (const candidate of input.sourceCandidates as Row[]) (candidate.explanation as Row).policyVersion = source(input).policy_version;
    for (const comparison of input.comparisons as Row[]) (comparison.result as Row).sourcePolicyVersion = source(input).policy_version;
    expect(normalizeKajoWorkingEvaluationPlan(input).sourceCutoff).toBe(100);
  });

  it('requires complete and unique three-control rows and the complete original pool', () => {
    rejected({ ...fixture(), comparisons: fixture().comparisons.slice(0, 2) });
    const duplicate = fixture(); comparison(duplicate, 2).control = 'OFF'; rejected(duplicate);
    const missing = fixture(); (result(missing).candidates as unknown[]).pop(); rejected(missing);
    const extra = fixture(); pool(extra)[2]!.itemId = id(24); rejected(extra);
    rejected({ ...fixture(), sourceCandidates: fixture().sourceCandidates.slice(0, 2) });
  });

  it('binds OFF scores, ranks and selections exactly and verifies native UUID ordering before aliases', () => {
    for (const field of ['score', 'rank', 'selected'] as const) {
      const input = fixture(); pool(input)[0]![field] = field === 'selected' ? false : 2; rejected(input);
    }
    const tie = fixture(); (tie.sourceCandidates[1] as Row).final_score = 0.8; pool(tie)[1]!.score = 0.8;
    expect(freezeWorkingEvaluationPlan(normalizeKajoWorkingEvaluationPlan(tie)).controls.OFF.candidates[0]?.objectId).toBe('fixture:item-0');
    pool(tie)[0]!.rank = 2; pool(tie)[1]!.rank = 1; rejected(tie);
  });

  it('rejects mismatched source, actor, profile, capture, feature, policy and reset lineage', () => {
    const owner = fixture(); owner.profile = { ...owner.profile, ownerUserId: id(9) }; rejected(owner);
    const otherSource = fixture(); comparison(otherSource).source_prediction_id = id(9); rejected(otherSource);
    const mismatched = fixture(); result(mismatched).captureId = id(9); rejected(mismatched);
    const feature = fixture(); ((feature.sourceCandidates[0] as Row).explanation as Row).workingIntent = {
      ...(((feature.sourceCandidates[0] as Row).explanation as Row).workingIntent as Row), version: 'personal-working-features-v1' }; rejected(feature);
    const policy = fixture(); result(policy).sourcePolicyVersion = 'other'; rejected(policy);
    const reset = fixture(); result(reset).resetAt = 51; rejected(reset);
    const active = fixture(); result(active).nativeActivated = true; rejected(active);
  });

  it('checks fixed eligibility/tier, exact adjustment provenance, and native rank permutations', () => {
    const eligibility = fixture(); pool(eligibility, 1)[0]!.eligible = false; rejected(eligibility);
    const changedTier = fixture(); pool(changedTier, 1)[0]!.tier = 1; rejected(changedTier);
    const adjusted = fixture(); pool(adjusted, 1)[0]!.adjustment = 0.2; rejected(adjusted);
    const ranks = fixture(); pool(ranks, 1)[0]!.rank = 2; rejected(ranks);
  });

  it('requires actual table artifact creation and observation before plan creation; asOf alone is insufficient', () => {
    const late = fixture(); comparison(late).created_at = 201; rejected(late);
    const absent = fixture(); delete comparison(absent).created_at; rejected(absent);
    const olderInput = fixture(); capture(olderInput).cutoff = 150; capture(olderInput).asOf = 150; rejected(olderInput);
    rejected({ ...fixture(), snapshotObservedAt: 220 });
    const futureSource = fixture(); source(futureSource).created_at = 201; rejected(futureSource);
  });

  it('rejects raw UUIDs in scoped aliases regardless of case and rejects alias collisions', () => {
    const raw = fixture(); raw.references = { ...raw.references, actorRef: `fixture:${actor.toUpperCase()}` }; rejected(raw);
    const genome = fixture(); genome.references = { ...genome.references, actorRef: `fixture:${id(6)}` }; rejected(genome);
    const model = fixture(); source(model).base_model_version = `model:${actor.toUpperCase()}`; rejected(model);
    const pair = fixture(); pair.planning = { ...pair.planning, pairs: [{ pairId: `fixture:${profile.toUpperCase()}`, leftItemId: id(20), rightItemId: id(21) }] }; rejected(pair);
    const duplicate = fixture(); duplicate.references = { ...duplicate.references, captureRef: duplicate.references.actorRef }; rejected(duplicate);
    const missing = fixture(); missing.references = { ...missing.references, objects: missing.references.objects.slice(0, 2) }; rejected(missing);
  });

  it('uses the structured rejection boundary for missing planning, references and control-reference envelopes', () => {
    for (const field of ['planning', 'references'] as const) {
      const input = fixture() as unknown as Row; delete input[field]; rejected(input as unknown as KajoWorkingEvaluationSnapshots);
    }
    const input = fixture() as unknown as Row; delete (input.references as Row).controlRefs;
    rejected(input as unknown as KajoWorkingEvaluationSnapshots);
  });

  it('fails bounded inputs rather than truncating large pools, prefix evidence or pairs', () => {
    const large = fixture(); capture(large).rawEvents = Array.from({ length: 129 }, () => ({})); rejected(large);
    const oversized = fixture(); capture(oversized).padding = 'x'.repeat(8_388_609); rejected(oversized);
    const repeated = fixture(); repeated.planning = { ...repeated.planning, pairs: [repeated.planning.pairs[0]!, repeated.planning.pairs[0]!] }; rejected(repeated);
  });

  it('checks stored calendars and rejects unsupported precision instead of conflating clocks', () => {
    const invalid = fixture(); comparison(invalid).created_at = '2024-02-30T00:00:00Z'; rejected(invalid);
    const precision = fixture(); comparison(precision).created_at = '2500-01-01T00:00:00.000001Z'; rejected(precision);
  });
});

describe('v3 frozen candidate features and portable native support', () => {
  it('uses the complete frozen prefix for independent Item concentration and retains actual control scores', () => {
    const input = v3Fixture(), before = structuredClone(input), plan = availablePlan(input);
    const candidate = plan.support!.STATIC.find(row => row.objectId === 'fixture:item-2')!;
    const ordered = plan.support!.ORDERED.find(row => row.objectId === 'fixture:item-2')!;
    expect(candidate.coefficients).toEqual([{ objectId: 'fixture:input-0', weight: 0.5 },
      { objectId: 'fixture:input-1', weight: 0.5 }]);
    expect(candidate.effectiveItems).toBe(2); expect(candidate.contributingTimeGroups).toBe(2);
    const recency = Math.SQRT1_2;
    expect(ordered.coefficients[0]!.weight).toBeCloseTo(recency / (recency + 1), 12);
    expect(ordered.coefficients[1]!.weight).toBeCloseTo(1 / (recency + 1), 12);
    expect(ordered.effectiveItems).toBeCloseTo((1 + recency) ** 2 / (1 + recency ** 2), 12);
    expect(ordered.featureCoverage).toBe(1);
    expect(ordered.interpretation).toBe('ITEM_WEIGHT_CONCENTRATION_NOT_OUTCOME_SAMPLE_SIZE');
    expect(ordered.uncertainty).toBe('unavailable');
    expect(plan.controls.STATIC.candidates.find(row => row.objectId === 'fixture:item-2')!.score).toBe(0.82);
    expect(plan.controls.ORDERED.candidates.find(row => row.objectId === 'fixture:item-2')!.score).toBe(0.5);
    expect(plan.working.state.support).toMatchObject({ distinctItems: 2, nativeItems: 2, syntheticItems: 0, observedRatings: 2 });
    expect(plan.working.state.target).toEqual(plan.target);
    expect(plan.working.state.records.every(row => row.observation.targetId === plan.target.id)).toBe(true);
    expect(plan.sourceBinding!.candidateFeatureSnapshot).toEqual({ availabilityBasis: 'SOURCE_RANKING_STATEMENT_SNAPSHOT',
      availableAt: null, inputReferenceAt: 100 });
    expect(input).toEqual(before); expect(freezeWorkingEvaluationPlan(plan)).toEqual(plan);
    const tampered = structuredClone(plan); (tampered.sourceBinding!.candidateFeatureSnapshot as unknown as Row).inputReferenceAt = 99;
    expect(() => freezeWorkingEvaluationPlan(tampered)).toThrow();
    const missing = structuredClone(plan); (missing.sourceBinding as unknown as Row).candidateFeatureSnapshot = null;
    expect(() => freezeWorkingEvaluationPlan(missing)).toThrow(/invalid candidate feature snapshot binding/);
  });

  it('distinguishes a complete all-zero candidate vector from unavailable features and keeps OFF exact', () => {
    const plan = availablePlan(v3Fixture());
    for (const control of ['STATIC', 'ORDERED'] as const) {
      const noCoverage = plan.support![control].find(row => row.objectId === 'fixture:item-1')!;
      expect(noCoverage.reason).toBe('NO_FEATURE_COVERAGE'); expect(noCoverage.coefficients).toEqual([]);
      expect(noCoverage.effectiveItems).toBe(0); expect(noCoverage.featureCoverage).toBe(0);
    }
    expect(plan.support!.OFF.every(row => row.reason === 'OFF' && row.effectiveItems === 0)).toBe(true);
    expect(plan.controls.OFF.candidates.map(row => row.score)).toEqual([0.1, 0.7, 0.8]);
    const changed = v3Fixture(); pool(changed)[0]!.score = 0.8 + Number.EPSILON; rejected(changed);
  });

  it.each(['NO_SESSION', 'RESET_EMPTY', 'INPUT_UNAVAILABLE', 'BUDGET_EXCEEDED'])
  ('retains honest inert %s source envelopes without inventing candidate support', status => {
    const input = v3Fixture(), frozen = capture(input);
    Object.assign(frozen, { status, prefixComplete: false, rawEvents: [], itemFeatures: [], records: [], items: [],
      groups: [], vectors: { static: {}, ordered: {} }, featureSchema: { ...(frozen.featureSchema as Row), dimensions: [] },
      ...(status === 'NO_SESSION' ? { session: null } : {}) });
    for (let i = 0; i < input.sourceCandidates.length; i++) {
      Object.assign(candidateFeatures(input, i), { status: 'UNAVAILABLE', features: null,
        unavailableReason: 'CAPTURE_INACTIVE', featureSchemaRef: schemaReference(input) });
      Object.assign(intent(input, i), { status, staticAdjustment: 0, orderedAdjustment: 0 });
      pool(input, 1)[i]!.adjustment = 0; pool(input, 2)[i]!.adjustment = 0;
    }
    delete (input.references as unknown as Row).inputObjects; delete (input.references as unknown as Row).inputRecords;
    const plan = freezeWorkingEvaluationPlan(normalizeKajoWorkingEvaluationPlan(input));
    expect(plan.working).toEqual({ status: 'unavailable', reason: 'FROZEN_CANDIDATE_FEATURES_CAPTURE_INACTIVE' });
    expect(plan.support).toBeNull(); expect(plan.controls.OFF.candidates.map(row => row.score)).toEqual([0.1, 0.7, 0.8]);
  });

  it('binds compact binary projections to the complete schema reference, cutoff and source capture', () => {
    const mutations: ((input: Fixture) => void)[] = [
      input => { delete intent(input).candidateFeatures; },
      input => { candidateFeatures(input).version = 'other'; },
      input => { candidateFeatures(input).status = 'UNAVAILABLE'; },
      input => { candidateFeatures(input).captureId = id(99); },
      input => { candidateFeatures(input).asOf = 99; },
      input => { candidateFeatures(input).availableAt = 100; },
      input => { candidateFeatures(input).availabilityBasis = 'CURRENT_MVCC_SNAPSHOT_KNOWN_AT_CAPTURE'; },
      input => { candidateFeatures(input).commitAvailability = 'KNOWN'; },
      input => { candidateFeatures(input).historicalFeatureEligible = true; },
      input => { candidateFeatures(input).learnable = true; },
      input => { candidateFeatures(input).nativeActivated = true; },
      input => { candidateFeatures(input).unavailableReason = 'CAPTURE_INACTIVE'; },
      input => { candidateFeatures(input).featureEncoding = 'SORTED_BINARY'; },
      input => { delete candidateFeatures(input).featureEncoding; },
      input => { candidateFeatures(input).features = [1]; },
      input => { candidateFeatures(input).features = [1, 1, 0]; },
      input => { candidateFeatures(input).features = [0.5, 1]; },
      input => { candidateFeatures(input).features = [1, null]; },
      input => { candidateFeatures(input).features = [1, '1']; },
      input => { candidateFeatures(input).features = Array<number>(2); },
      input => { candidateFeatures(input).features = Object.assign([1, 1], { extra: 0 }); },
      input => { candidateFeatures(input).features = { dark: 1, warm: 1 }; },
      input => { candidateFeatures(input).features = null; },
      ...['id', 'version', 'artifactId', 'artifactVersion', 'representationVersion', 'dimensionCount']
        .map(key => (input: Fixture) => { (candidateFeatures(input).featureSchemaRef as Row)[key] = key === 'dimensionCount' ? 1 : 'other'; }),
      input => { (candidateFeatures(input).featureSchemaRef as Row).extra = 'other'; },
      input => { delete candidateFeatures(input).featureSchemaRef; },
    ];
    for (const mutate of mutations) { const input = v3Fixture(); mutate(input); rejected(input); }
  });

  it('decodes binary positions in the original capture dimension order without resorting names', () => {
    const input = v3Fixture(), frozen = capture(input);
    (frozen.featureSchema as Row).dimensions = ['warm', 'dark'];
    (frozen.itemFeatures as Row[])[0]!.features = { warm: 1, dark: 0 };
    (frozen.itemFeatures as Row[])[1]!.features = { warm: 0, dark: 1 };
    refreshV3Diagnostics(input);
    const plan = availablePlan(input), candidate = plan.working.objects.find(object => object.id === 'fixture:item-0')!;
    expect(candidate.features).toEqual({ warm: 0, dark: 1 });
    expect(intent(input, 2).staticAdjustment).toBe(0.25);
    expect(plan.support!.STATIC.find(row => row.objectId === candidate.id)!.coefficients)
      .toEqual([{ objectId: 'fixture:input-1', weight: 1 }]);
  });

  it('creates own binary feature keys for prototype-like dimensions from compact vectors', () => {
    const input = v3Fixture(), frozen = capture(input), dimensions = ['constructor', '__proto__', 'toString'];
    (frozen.featureSchema as Row).dimensions = dimensions;
    for (const item of frozen.itemFeatures as Row[]) {
      item.features = Object.fromEntries(dimensions.map(key => [key, 1])); item.tags = [...dimensions];
    }
    for (let i = 0; i < input.sourceCandidates.length; i++) Object.assign(candidateFeatures(input, i), {
      featureSchemaRef: schemaReference(input), features: [[1, 1, 1], [0, 0, 0], [0, 1, 0]][i] });
    refreshV3Diagnostics(input);
    const plan = availablePlan(input), features = plan.working.objects.find(object => object.id === 'fixture:item-0')!.features;
    expect(features).toEqual(Object.fromEntries([['constructor', 0], ['__proto__', 1], ['toString', 0]]));
    for (const key of dimensions) expect(Object.hasOwn(features, key)).toBe(true);
    expect(plan.support!.ORDERED.find(row => row.objectId === 'fixture:item-0')!.effectiveItems).toBeGreaterThan(1);
    expect(freezeWorkingEvaluationPlan(plan)).toEqual(plan);
  });

  it('requires the exact complete input Item and source-record alias closures', () => {
    const mutations: ((input: Fixture) => void)[] = [
      input => { delete (input.references as unknown as Row).inputObjects; },
      input => { delete (input.references as unknown as Row).inputRecords; },
      input => { input.references = { ...input.references, inputObjects: input.references.inputObjects!.slice(0, 1) }; },
      input => { input.references = { ...input.references, inputRecords: input.references.inputRecords!.slice(0, 1) }; },
      input => { input.references = { ...input.references, inputObjects: [...input.references.inputObjects!,
        { itemId: id(99), objectRef: 'fixture:extra-item' }] }; },
      input => { input.references = { ...input.references, inputRecords: [...input.references.inputRecords!,
        { recordId: id(99), recordRef: 'fixture:extra-record' }] }; },
      input => { input.references = { ...input.references, inputRecords: [input.references.inputRecords![0]!,
        { ...input.references.inputRecords![1]!, recordRef: input.references.inputRecords![0]!.recordRef }] }; },
    ];
    for (const mutate of mutations) { const input = v3Fixture(); mutate(input); rejected(input); }
  });

  it('reuses the ranked alias when an input Item also belongs to the frozen pool', () => {
    const input = v3Fixture(), frozen = capture(input);
    (frozen.rawEvents as Row[])[0]!.item_id = id(20); (frozen.itemFeatures as Row[])[0]!.id = id(20);
    input.references = { ...input.references, inputObjects: [{ itemId: id(20), objectRef: 'fixture:item-2' },
      input.references.inputObjects![1]!] };
    refreshV3Diagnostics(input);
    expect(availablePlan(input).working.state.items.map(row => row.objectId)).toContain('fixture:item-2');
    input.references = { ...input.references, inputObjects: [{ itemId: id(20), objectRef: 'fixture:other-alias' },
      input.references.inputObjects![1]!] }; rejected(input);
  });

  it('preserves exact Undo lineage using aliases, including a target outside the captured prefix', () => {
    const input = v3Fixture(), frozen = capture(input), outsideTarget = id(99), foreignSession = id(98);
    const replaced = nativeEvent(13, 30, 10, 30);
    const undo: KajoWorkingEvent = { ...nativeEvent(14, 30, 0, 40), event_type: 'ITEM_INTERACTION_UNDONE',
      session_id: foreignSession, properties: { reversedEventId: id(13) } };
    const outside: KajoWorkingEvent = { ...undo, id: id(15), occurred_at: 45, created_at: 45,
      properties: { reversedEventId: outsideTarget } };
    frozen.rawEvents = [...frozen.rawEvents as KajoWorkingEvent[], replaced, undo, outside];
    input.references = { ...input.references, inputRecords: [11, 12, 13, 14, 15, 99]
      .map(n => ({ recordId: id(n), recordRef: `fixture:event-${n}` })) };
    refreshV3Diagnostics(input);
    const plan = availablePlan(input);
    expect(plan.working.state.items.find(row => row.objectId === 'fixture:input-0')!.direction).toBe(-1);
    const invalidates = plan.working.state.records.filter(row => row.kind === 'UNDO').flatMap(row => row.invalidates!);
    expect(invalidates).toEqual([{ sourceId: 'kajo-canonical-events-v1', recordId: 'fixture:event-13' },
      { sourceId: 'kajo-canonical-events-v1', recordId: 'fixture:event-99' }]);
    for (const raw of [actor, profile, session, prediction, captureId, id(6), id(20), id(21), id(22), id(30), id(31),
      id(11), id(12), id(13), id(14), id(15), outsideTarget, foreignSession]) expect(JSON.stringify(plan)).not.toContain(raw);
    input.references = { ...input.references, inputRecords: input.references.inputRecords!.slice(0, -1) }; rejected(input);
  });

  it('does not allow any captured native Item, Event or Undo target to leak through an alias', () => {
    for (const raw of [id(30), id(31), id(11), id(12)]) {
      const input = v3Fixture(); input.references = { ...input.references, actorRef: `fixture:${raw.toUpperCase()}` };
      rejected(input);
    }
  });

  it('rejects a tampered input feature snapshot, native vector, support count or candidate adjustment', () => {
    const mutations: ((input: Fixture) => void)[] = [
      input => { ((capture(input).itemFeatures as Row[])[0]!.features as Row).warm = 0.5; },
      input => { (capture(input).itemFeatures as Row[])[0]!.availableAt = 101; },
      input => { ((capture(input).itemFeatures as Row[])[0]!.artifact as Row).version = 'other'; },
      input => { (capture(input).support as Row).distinctItems = 3; },
      input => { (capture(input).support as Row).nativeItems = 0; },
      input => { ((capture(input).vectors as Row).ordered as Row).warm = 0.2; },
      input => { (capture(input).config as Row).maxAdjustment = 0.2; },
      input => { (capture(input).rawEvents as Row[])[0]!.actor_user_id = id(99); },
      input => { (capture(input).rawEvents as Row[])[0]!.occurred_at = 'not-a-date'; },
      input => { intent(input).orderedAdjustment = 0.2; pool(input, 2)[0]!.adjustment = 0.2; },
    ];
    for (const mutate of mutations) { const input = v3Fixture(); mutate(input); rejected(input); }
  });

  it('retains source-record aliases so later reuse cannot become a new observed pair', () => {
    const input = v3Fixture(), plan = availablePlan(input);
    const labels: WorkingOutcomeCapture['labels'] = plan.pairs.flatMap(pair => [pair.leftObjectId, pair.rightObjectId])
      .map((objectId, index) => ({ objectId, experienceId: `fixture:experience-${index}`, exposedAt: 230 + index * 10,
        status: 'observed', observation: { subjectId: plan.scope.subject.id, actingIdentityRef: plan.scope.actingIdentityRef!,
          objectId, actionId: `fixture:experience-${index}`, predictionId: plan.sourcePredictionId,
          targetId: plan.target.id, targetVersion: plan.target.version, measurement: { status: 'observed', value: index ? 10 : 0 },
          raw: { value: index ? 10 : 0, scale: plan.target.scale }, occurredAt: 250 + index * 10, availableAt: 260 + index * 10,
          exposure: 'verified', access: { kind: 'subject', subjectId: plan.scope.subject.id },
          provenance: { origin: 'observed', source: { kind: 'native', id: 'kajo-canonical-events-v1' },
            recordId: index ? 'fixture:new-outcome' : input.references.inputRecords![0]!.recordRef, revision: 2 } } }));
    const outcome: WorkingOutcomeCapture = { id: 'fixture:outcome', sourcePredictionId: plan.sourcePredictionId,
      subjectId: plan.scope.subject.id, actingIdentityRef: plan.scope.actingIdentityRef!, sessionRef: plan.scope.sessionRef,
      revision: 1, createdAt: 320, availableAt: 320, matureAt: 310, availabilityBasis: 'STORED_CREATED_TIME',
      complete: true, resolutionVersion: 'fixture-terminal-v1', labels };
    const report = evaluateWorkingPlan(plan, outcome, 330);
    expect(report.pairs[0]!.reasons).toContain('input-outcome-reuse');
    expect(report.unscoredPairUnits).toBe(1); expect(report.observed.nativePairUnits).toBe(0);
  });
});
