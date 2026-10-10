import { describe, expect, it } from 'vitest';
import { normalizeKajoWorkingEvaluationPlan, KajoWorkingEvaluationSnapshotError } from '../src/adapters/kajo-working-evaluation.js';
import type { KajoWorkingEvaluationSnapshots } from '../src/adapters/kajo-working-evaluation.js';
import { freezeWorkingEvaluationPlan } from '../src/working-evaluation.js';

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

describe('native Personal Working evaluation snapshot adapter', () => {
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
