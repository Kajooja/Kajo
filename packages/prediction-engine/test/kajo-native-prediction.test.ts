import { describe, expect, it } from 'vitest';
import { normalizeKajoNativePrediction, KajoNativePredictionSnapshotError } from '../src/adapters/kajo-native-prediction.js';
import { compareFrozenRankings } from '../src/ranking-conformance.js';

// Producer-shaped boundary fixtures; actual SQL is covered by the database/CLI verifier.
const id = (n: number) => `a9150000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1), profile = id(2), session = id(3), genome = id(4), prediction = id(5), capture = id(6);
const at = (n: number) => `2026-10-26T00:00:00.${String(n).padStart(6, '0')}Z`;
function fixture() {
  const policy = 'scenario-memory-v1+resurfacing-v1+outcome-attribution-v1+frozen-replay-v2+eligibility-first-v1+personal-working-off-v3';
  const weights = { direct: 1, longTerm: 1, shortTerm: 1, novelty: 1, exploration: 1, scenario: 1, reactionPenalty: 1, impressionCooldown: 1 };
  const features = { version: 'prediction-features-v2', nativeDecayVersion: 'native-long-term-decay-v2', nativeEvidenceAsOf: at(100),
    direct: 1, longTerm: 1, shortTerm: 1, novelty: 1, exploration: 1, reactionQueuePenalty: 0, impressionCooldownPenalty: 0 };
  return { scope: { profile: { id: profile, type: 'PERSONAL' as const, ownerUserId: actor }, user: { id: actor }, sessionId: session },
    source: { kind: 'generator' as const, id: 'native-adapter-unit-fixture', version: '1', parentRefs: [] },
    snapshotObservedAt: at(200),
    sourceRun: { id: prediction, actor_user_id: actor, profile_id: profile, session_id: session as string | null, genome_id: genome,
      requested_at: at(120), created_at: at(100), discovery_mode: 'FOR_YOU', requested_item_type: 'MOVIE',
      model_version: 'prediction-v1.0', base_model_version: 'prediction-v0.6-personal-source-fusion', policy_version: policy,
      candidate_count: 3, result_count: 2,
      state_snapshot: { asOf: at(100), sourceFusion: {},
        candidateRequest: { version: 'native-candidate-request-v1', acquisition: 'LEGACY_DISCOVERY', intent: 'DELIVERY',
          itemIds: null as string[] | null, seenItemIds: [] as string[], reminderSpent: false, requiredAfter: null as string | null },
        predictionInput: { version: 'native-prediction-clocks-v1', nativeEvidenceAsOf: at(100), memoryStateAsOf: at(100), scenarioAsOf: at(100),
          requestAsOf: at(120), workingStateAsOf: at(120), arithmeticClock: 'TRANSACTION_START', eligibilityClock: 'CURRENT_WALL_TIME',
          dataSnapshot: 'CURRENT_STATEMENT_SNAPSHOTS', historicalReconstruction: 'UNAVAILABLE', commitVisibility: 'UNKNOWN',
          candidateAcquisition: 'LEGACY_DISCOVERY', requiredAfter: null as string | null },
        workingState: { version: 'native-working-capture-v3', captureId: capture, actorUserId: actor,
          profile: { id: profile, type: 'PERSONAL', ownerUserId: actor }, session: { id: session } as { id: string } | null,
          cutoff: at(120), asOf: at(120) } } },
    sourceGenome: { id: genome, genome_key: 'prediction-v1-baseline', model_family: 'PREDICTION_V1_BASELINE',
      code_version: 'prediction-v1.0+sleep-layer-v1', feature_version: 'prediction-features-v1', memory_version: 'memory-state-v1',
      outcome_version: 'outcome-precedence-v1', reward_version: 'outcome-reward-v1', created_at: at(50),
      config: { schemaVersion: 'scalar-genome-v1', modeWeights: { FOR_YOU: weights, SURPRISE: weights, RISK: weights } } },
    sourceCandidates: [0, 1, 2].map((i) => ({ prediction_id: prediction, item_id: id(11 + i), created_at: at(100),
      source_rank: i + 1, final_rank: i + 1, source_score: [1, 2, 0][i]!, final_score: [0.9, 100, 1000][i]!,
      selected_for_delivery: i < 2, confidence: 0.2, scenario_score: 0.1, scenario_support: 1, scenario_max_similarity: 0.4,
      selection_probability: null, explanation: { version: 'prediction-v1.0', baseVersion: 'prediction-v0.6-personal-source-fusion',
        policyVersion: policy, scalarGenome: { genomeId: genome, genomeKey: 'prediction-v1-baseline', baselineEquivalent: true },
        scoringFeatures: { ...features }, candidatePool: { version: 'eligibility-first-v1', eligibilityAt: at(130),
          retainedLimit: 50, retainedCount: 3, consideredCount: 3, ordinaryCount: 1, reminderEligibleCount: 1, suppressedCount: 1,
          admissionRank: i + 1, baselineScoreRank: i + 1 },
        resurfacingPolicy: { eligible: i < 2, classification: ['ORDINARY', 'SAVED_REMINDER', 'SUPPRESSED'][i]! },
        workingIntent: { version: 'personal-working-features-v3', captureVersion: 'native-working-capture-v3', captureId: capture, control: 'OFF' } } })) };
}
type Fixture = ReturnType<typeof fixture>;
function markedFixture(input = fixture()) {
  const source = input.sourceRun, state = source.state_snapshot;
  const finalScoringInput = {
    version: 'native-final-scoring-input-v1', stage: 'FINAL', computation: 'FRESH_FINAL',
    predictionId: source.id, featureSourcePredictionId: source.id,
    actorUserId: source.actor_user_id, profileId: source.profile_id, sessionId: source.session_id,
    requestedAt: source.requested_at, itemType: source.requested_item_type, mode: source.discovery_mode,
    context: {}, candidateRequest: structuredClone(state.candidateRequest), predictionInput: structuredClone(state.predictionInput),
    sourceGenome: { id: source.genome_id, config: structuredClone(input.sourceGenome.config) },
    modelVersion: source.model_version, baseModelVersion: source.base_model_version, policyVersion: source.policy_version,
    candidateCount: source.candidate_count, candidateIds: input.sourceCandidates.map(candidate => candidate.item_id).sort(),
  };
  return { ...input, sourceRun: { ...source, context: {}, state_snapshot: { ...state, finalScoringInput } },
    sourceCandidates: input.sourceCandidates.map(candidate => {
      const explanation = { ...candidate.explanation, sharedCommonFit: { applicable: false, contribution: 0 },
        resurfacingInput: { ...candidate.explanation.resurfacingPolicy } };
      return { ...candidate, explanation: { ...explanation, finalScoringInput: {
        version: 'native-final-scoring-input-v1', stage: 'FINAL', predictionId: source.id,
        itemId: candidate.item_id, sourceGenomeId: source.genome_id, scenarioScore: candidate.scenario_score,
        explanation: structuredClone({ scoringFeatures: explanation.scoringFeatures, sharedCommonFit: explanation.sharedCommonFit,
          resurfacingInput: explanation.resurfacingInput, resurfacingPolicy: explanation.resurfacingPolicy,
          workingIntent: explanation.workingIntent }),
      } } };
    }) };
}
function evaluationFixture(): Fixture {
  const input = fixture(), state = input.sourceRun.state_snapshot;
  const requested = [id(13), id(99), id(11), id(12)];
  Object.assign(state.candidateRequest, { acquisition: 'EXPLICIT_CANONICAL', intent: 'EVALUATION', itemIds: requested, requiredAfter: at(50) });
  Object.assign(state.predictionInput, { candidateAcquisition: 'EXPLICIT_CANONICAL', eligibilityClock: 'TRANSACTION_START',
    requiredAfter: at(50), requestAsOf: at(100), workingStateAsOf: at(100) });
  Object.assign(state, { evaluationInput: { version: 'personal-evaluation-v1', scope: 'REQUESTED_CANDIDATES',
    calibration: 'UNCALIBRATED_ORDINAL', candidateIds: requested, evidenceCutoff: at(100), requiredAfter: at(50) } });
  state.workingState.asOf = at(100); state.workingState.cutoff = at(100);
  input.sourceRun.result_count = 0; input.sourceRun.requested_at = at(100);
  input.sourceRun.policy_version = input.sourceRun.policy_version.replace('+personal-working', '+evaluation-candidates-v1+personal-working');
  for (const candidate of input.sourceCandidates) {
    candidate.selected_for_delivery = false; candidate.explanation.candidatePool.eligibilityAt = at(100);
    candidate.explanation.policyVersion = input.sourceRun.policy_version;
    Object.assign(candidate.explanation, { evaluationFeatures: { version: 'canonical-item-tags-v1', itemType: 'MOVIE', tags: [] } });
  }
  return input;
}
const rejected = (mutate: (input: Fixture) => void) => {
  const input = fixture(); mutate(input); expect(() => normalizeKajoNativePrediction(input)).toThrow(KajoNativePredictionSnapshotError);
};
function receiptFixture() {
  const input = evaluationFixture();
  Object.assign(input.sourceRun, { requested_item_type: null });
  input.sourceRun.policy_version += '+v4-receipt-input-v1';
  for (const c of input.sourceCandidates) c.explanation.policyVersion = input.sourceRun.policy_version;
  const marked = markedFixture(input);
  const nativeV4Receipt = { version: 'native-v4-receipt-v1', policy: 'CANONICAL_FORECAST_POOL_V4',
    profileId: profile, actorUserId: actor, sessionId: session, receiptRevision: 3,
    receiptTransaction: '9007199254740993', receiptAt: at(50),
    forecastTransaction: '9007199254740995', forecastAsOf: at(100),
    entrySnapshot: '9007199254740992:9007199254740995:9007199254740992,9007199254740994' };
  return { ...marked, sourceRun: { ...marked.sourceRun, state_snapshot: { ...marked.sourceRun.state_snapshot,
    nativeV4Receipt, finalScoringInput: { ...marked.sourceRun.state_snapshot.finalScoringInput,
      nativeV4Receipt: structuredClone(nativeV4Receipt) } } } };
}
describe('native prediction snapshot adapter', () => {
  it('binds owned V4 receipt visibility with exact 64-bit transaction identities and retained microseconds', () => {
    const input = receiptFixture();
    expect(normalizeKajoNativePrediction(input).intent).toBe('EVALUATION');
    const empty = receiptFixture(); empty.sourceCandidates = [];
    empty.sourceRun.candidate_count = 0; empty.sourceRun.state_snapshot.finalScoringInput.candidateCount = 0;
    empty.sourceRun.state_snapshot.finalScoringInput.candidateIds = [];
    expect(normalizeKajoNativePrediction(empty).candidates).toEqual([]);
    expect(normalizeKajoNativePrediction(markedFixture(evaluationFixture())).intent).toBe('EVALUATION');
  });
  it('rejects receipt corruption even when the FINAL copy is changed to match', () => {
    type Receipt = ReturnType<typeof receiptFixture>['sourceRun']['state_snapshot']['nativeV4Receipt'];
    for (const mutate of [
      (r: Receipt) => { r.version = 'future'; },
      (r: Receipt) => { r.policy = 'CANONICAL_FORECAST_V3'; },
      (r: Receipt) => { r.profileId = id(99); },
      (r: Receipt) => { r.actorUserId = id(99); },
      (r: Receipt) => { r.sessionId = id(99); },
      (r: Receipt) => { r.receiptRevision = 256; },
      (r: Receipt) => { r.receiptRevision = 0.5; },
      (r: Receipt) => { Object.assign(r, { receiptRevision: '3' }); },
      (r: Receipt) => { r.receiptAt = at(51); },
      (r: Receipt) => { r.receiptAt = 'infinity'; },
      (r: Receipt) => { r.forecastAsOf = at(101); },
      (r: Receipt) => { r.receiptTransaction = r.forecastTransaction; },
      (r: Receipt) => { r.receiptTransaction = '9007199254740994'; },
      (r: Receipt) => { r.receiptTransaction = '9007199254740996'; },
      (r: Receipt) => { r.receiptTransaction = '18446744073709551616'; },
      (r: Receipt) => { r.receiptTransaction = 'not-a-transaction'; },
      (r: Receipt) => { r.entrySnapshot = '10:5:'; },
      (r: Receipt) => { r.entrySnapshot = '10:20:15,14'; },
      (r: Receipt) => { r.entrySnapshot = '10:20:10,10'; },
      (r: Receipt) => { r.entrySnapshot = '10:20:21'; },
      (r: Receipt) => { r.entrySnapshot = 'broken'; },
      (r: Receipt) => { Object.assign(r, { futureField: true }); },
      (r: Receipt) => { delete (r as Record<string, unknown>).receiptAt; },
    ]) {
      const input = receiptFixture(), state = input.sourceRun.state_snapshot;
      mutate(state.nativeV4Receipt);
      state.finalScoringInput.nativeV4Receipt = structuredClone(state.nativeV4Receipt);
      expect(() => normalizeKajoNativePrediction(input)).toThrow(KajoNativePredictionSnapshotError);
    }
  });
  it('rejects incomplete receipt markers and their FINAL binding', () => {
    for (const mutate of [
      (x: ReturnType<typeof receiptFixture>) => { delete (x.sourceRun.state_snapshot as Record<string, unknown>).nativeV4Receipt; },
      (x: ReturnType<typeof receiptFixture>) => { delete (x.sourceRun.state_snapshot as Record<string, unknown>).finalScoringInput; },
      (x: ReturnType<typeof receiptFixture>) => { delete (x.sourceRun.state_snapshot.finalScoringInput as Record<string, unknown>).nativeV4Receipt; },
      (x: ReturnType<typeof receiptFixture>) => { x.sourceRun.policy_version = x.sourceRun.policy_version.replace('+v4-receipt-input-v1', ''); },
    ]) {
      const input = receiptFixture(); mutate(input);
      expect(() => normalizeKajoNativePrediction(input)).toThrow(KajoNativePredictionSnapshotError);
    }
  });
  it('admits a complete frozen FINAL input while retaining unmarked historical contracts', () => {
    const old = fixture(), input = markedFixture();
    expect(normalizeKajoNativePrediction(input).candidates.map(c => c.score))
      .toEqual(normalizeKajoNativePrediction(old).candidates.map(c => c.score));
    input.sourceCandidates.reverse();
    expect(normalizeKajoNativePrediction(input).candidates).toHaveLength(3);
    const empty = fixture(); empty.sourceCandidates = []; empty.sourceRun.candidate_count = 0; empty.sourceRun.result_count = 0;
    expect(normalizeKajoNativePrediction(markedFixture(empty)).candidates).toEqual([]);
    expect(normalizeKajoNativePrediction(markedFixture(evaluationFixture())).intent).toBe('EVALUATION');
    const zoned = markedFixture();
    zoned.sourceRun.requested_at = '2026-10-26T02:00:00.000120+02:00';
    expect(normalizeKajoNativePrediction(zoned).candidates).toHaveLength(3);
  });
  it('bounds the marked UTF-8 input even when the surrounding snapshot fits its larger export budget', () => {
    const input = markedFixture(), context = { detail: 'é'.repeat(1_048_577) };
    Object.assign(input.sourceRun.context, context);
    Object.assign(input.sourceRun.state_snapshot.finalScoringInput.context, context);
    expect(() => normalizeKajoNativePrediction(input)).toThrow(KajoNativePredictionSnapshotError);
  });
  it('rejects missing, mixed, unsupported and contradictory marked source bindings including suppressed candidates', () => {
    type Marked = ReturnType<typeof markedFixture>;
    for (const mutate of [
      (x: Marked) => { delete (x.sourceRun.state_snapshot as Record<string, unknown>).finalScoringInput; },
      (x: Marked) => { delete (x.sourceCandidates[2]!.explanation as Record<string, unknown>).finalScoringInput; },
      (x: Marked) => { x.sourceRun.state_snapshot.finalScoringInput.version = 'future'; },
      (x: Marked) => { x.sourceCandidates[2]!.explanation.finalScoringInput.version = 'future'; },
      (x: Marked) => { x.sourceRun.state_snapshot.finalScoringInput.computation = 'FROZEN_PAGE_REUSE'; },
      (x: Marked) => { x.sourceRun.state_snapshot.finalScoringInput.predictionId = id(999); },
      (x: Marked) => { x.sourceRun.state_snapshot.finalScoringInput.actorUserId = id(999); },
      (x: Marked) => { x.sourceRun.state_snapshot.finalScoringInput.profileId = id(999); },
      (x: Marked) => { x.sourceRun.state_snapshot.finalScoringInput.requestedAt = at(121); },
      (x: Marked) => { x.sourceRun.state_snapshot.finalScoringInput.predictionInput.scenarioAsOf = at(101); },
      (x: Marked) => { x.sourceRun.state_snapshot.finalScoringInput.candidateRequest.reminderSpent = true; },
      (x: Marked) => { x.sourceRun.state_snapshot.finalScoringInput.sourceGenome.config.modeWeights.FOR_YOU.direct = 2; },
      (x: Marked) => { x.sourceCandidates.pop(); x.sourceRun.candidate_count = 2; },
      (x: Marked) => { x.sourceCandidates[2]!.explanation.finalScoringInput.itemId = id(999); },
      (x: Marked) => { x.sourceCandidates[2]!.explanation.finalScoringInput.sourceGenomeId = id(999); },
      (x: Marked) => { x.sourceCandidates[2]!.explanation.finalScoringInput.scenarioScore += 0.1; },
      (x: Marked) => { x.sourceCandidates[2]!.explanation.finalScoringInput.explanation.scoringFeatures.direct += 0.1; },
      (x: Marked) => { x.sourceCandidates[2]!.explanation.finalScoringInput.explanation.resurfacingPolicy.eligible = true; },
      (x: Marked) => { Object.assign(x.sourceCandidates[2]!.explanation.finalScoringInput, { futureField: true }); },
      (x: Marked) => { Object.assign(x.sourceRun.state_snapshot.finalScoringInput, { futureField: true }); },
    ]) {
      const input = markedFixture(); mutate(input);
      expect(() => normalizeKajoNativePrediction(input)).toThrow(KajoNativePredictionSnapshotError);
    }
    const empty = fixture(); empty.sourceCandidates = []; empty.sourceRun.candidate_count = 0; empty.sourceRun.result_count = 0;
    const input = markedFixture(empty); input.sourceRun.state_snapshot.finalScoringInput.candidateIds.push(id(999));
    expect(() => normalizeKajoNativePrediction(input)).toThrow(KajoNativePredictionSnapshotError);
  });
  it('preserves microsecond clocks, tier-first identities, immutable genome inputs and synthetic origin', () => {
    const input = fixture(), output = normalizeKajoNativePrediction(input);
    expect(output.scope.subject).toEqual({ id: profile, kind: 'individual' });
    expect(output.candidates.map(c => c.score)).toEqual([0.9, 100, 1000]);
    expect(output.clocks.evidenceAsOf).toBeLessThan(output.clocks.requestAsOf);
    expect(output.provenance.recordedAt).toBeLessThan(output.clocks.requestAsOf);
    expect(output.provenance.record.origin).toBe('synthetic');
    expect(output.scope.evidence.synthetic).toBe('fixture-only');
    expect(output.constraints.allowedActionIds).toHaveLength(2);
    expect(compareFrozenRankings(output, output, { absoluteTolerance: 0 }).conforms).toBe(true);
    input.sourceCandidates[0]!.explanation.scoringFeatures.longTerm = 100;
    expect(Object.isFrozen(output.candidates[0]!.inputs)).toBe(true);
    expect(JSON.stringify(output)).not.toContain('"longTerm":100');
  });
  it('preserves true empty retained pools and explicit absence of a session', () => {
    const input = fixture(); input.sourceCandidates = []; input.sourceRun.candidate_count = 0; input.sourceRun.result_count = 0;
    input.sourceRun.session_id = null; input.scope.sessionId = ''; input.sourceRun.state_snapshot.workingState.session = null;
    const output = normalizeKajoNativePrediction(input);
    expect(output.candidates).toEqual([]); expect(output.sessionBinding).toBeNull(); expect(output.scope.sessionRef).toBe('');
  });
  it('accepts an exact numeric microsecond Working clock and rejects its lossy 15-digit serialization', () => {
    const input = fixture(), state = input.sourceRun.state_snapshot;
    const cutoff = at(123), exact = Date.parse('2026-10-26T00:00:00Z') + 0.123;
    input.sourceRun.requested_at = cutoff;
    state.predictionInput.requestAsOf = cutoff; state.predictionInput.workingStateAsOf = cutoff;
    state.workingState.cutoff = cutoff;
    Object.assign(state.workingState, { asOf: exact });
    const normalized = normalizeKajoNativePrediction(input);
    expect(normalized.clocks.workingAsOf).toBe(exact);
    expect(state.workingState.cutoff).toBe(cutoff);
    // PostgreSQL extra_float_digits=0 can retain only 15 significant decimal
    // digits. The immutable cutoff does not repair that rounded numeric field.
    const rounded = Number(exact.toPrecision(15));
    expect(rounded).not.toBe(exact);
    Object.assign(state.workingState, { asOf: rounded });
    expect(() => normalizeKajoNativePrediction(input)).toThrow(KajoNativePredictionSnapshotError);
    expect(state.workingState.cutoff).toBe(cutoff);
    expect(state.workingState.asOf).toBe(rounded);
  });
  it('retains a requested session reference when the owned Working session was unavailable', () => {
    const input = fixture(); input.sourceRun.state_snapshot.workingState.session = null;
    Object.assign(input.sourceRun.state_snapshot.workingState, { status: 'NO_SESSION' });
    const output = normalizeKajoNativePrediction(input);
    expect(output.sessionBinding).toBe(session); expect(output.scope.sessionRef).toBe(session);
  });
  it('keeps explicit evaluation non-delivery and the requested order separate from retained ranks', () => {
    const output = normalizeKajoNativePrediction(evaluationFixture());
    expect(output.intent).toBe('EVALUATION'); expect(output.acquisition.requestedObjectIds).toEqual([id(13), id(99), id(11), id(12)]);
    expect(output.candidates.map(c => c.objectId)).toEqual([id(11), id(12), id(13)]);
    expect(output.candidates.some(c => c.eligible)).toBe(true); expect(output.candidates.every(c => !c.selected)).toBe(true);
    for (const requiredAfter of [100, 'yesterday', '2026-10-26 00:00:00Z', '2026-10-26T00:00:00.000100Z']) {
      const input = evaluationFixture(); Object.assign(input.sourceRun.state_snapshot.candidateRequest, { requiredAfter });
      Object.assign(input.sourceRun.state_snapshot.predictionInput, { requiredAfter });
      expect(() => normalizeKajoNativePrediction(input)).toThrow(KajoNativePredictionSnapshotError);
    }
  });
  it('fails closed on mixed identity, clocks, native versions and unsupported continuation', () => {
    for (const mutate of [
      (x: Fixture) => { x.scope.profile.ownerUserId = id(99); },
      (x: Fixture) => { x.sourceCandidates[0]!.prediction_id = id(99); },
      (x: Fixture) => { x.sourceGenome.id = id(99); },
      (x: Fixture) => { x.sourceGenome.created_at = at(121); },
      (x: Fixture) => { x.sourceGenome.feature_version = 'future'; },
      (x: Fixture) => { x.sourceGenome.config.modeWeights.FOR_YOU.scenario = 5; },
      (x: Fixture) => { x.sourceRun.policy_version += '+frozen-page-v1'; },
      (x: Fixture) => { x.sourceRun.state_snapshot.predictionInput.memoryStateAsOf = at(101); },
      (x: Fixture) => { x.sourceRun.state_snapshot.candidateRequest.version = 'future'; },
      (x: Fixture) => { x.sourceRun.state_snapshot.candidateRequest.acquisition = 'EXPLICIT_CANONICAL'; },
      (x: Fixture) => { x.sourceRun.state_snapshot.workingState.profile.id = id(99); },
      (x: Fixture) => { x.sourceCandidates[0]!.explanation.workingIntent.captureId = id(99); },
      (x: Fixture) => { x.sourceCandidates[0]!.explanation.scalarGenome.genomeId = id(99); },
      (x: Fixture) => { x.sourceCandidates[0]!.explanation.scalarGenome.baselineEquivalent = false; },
      (x: Fixture) => { x.sourceCandidates[0]!.explanation.scoringFeatures.nativeEvidenceAsOf = at(101); },
      (x: Fixture) => { x.sourceCandidates[0]!.explanation.candidatePool.eligibilityAt = at(119); },
      (x: Fixture) => { x.sourceCandidates[0]!.explanation.candidatePool.retainedCount = 2; },
    ]) rejected(mutate);
  });
  it('rejects incomplete/duplicate pools, rank corruption, false delivery and invalid native bounds', () => {
    for (const mutate of [
      (x: Fixture) => { x.sourceCandidates.pop(); },
      (x: Fixture) => { x.sourceCandidates[1]!.item_id = x.sourceCandidates[0]!.item_id; },
      (x: Fixture) => { x.sourceCandidates[1]!.source_rank = x.sourceCandidates[0]!.source_rank; },
      (x: Fixture) => { x.sourceCandidates[0]!.source_rank = 2; x.sourceCandidates[1]!.source_rank = 1; },
      (x: Fixture) => { x.sourceCandidates[1]!.final_rank = 1; },
      (x: Fixture) => { x.sourceCandidates[2]!.selected_for_delivery = true; },
      (x: Fixture) => { x.sourceCandidates[0]!.confidence = 2; },
      (x: Fixture) => { x.sourceCandidates[0]!.scenario_max_similarity = -1; },
      (x: Fixture) => { x.sourceRun.state_snapshot.candidateRequest.seenItemIds = [id(99)]; },
    ]) rejected(mutate);
  });
});
