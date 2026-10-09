import { describe, expect, it } from 'vitest';
import { KajoOrdinalSnapshotError, normalizeKajoOrdinalPair } from '../src/adapters/kajo-ordinal.js';
import type { KajoOrdinalSnapshots } from '../src/adapters/kajo-ordinal.js';
import { evaluateOrdinalPair } from '../src/ordinal.js';

// Invented structural envelopes exercise rejection, never native efficacy.
const id = (family: string, n: number) => `${family}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = Date.UTC(2024, 0, 1);
const at = (milliseconds: number) => new Date(base + milliseconds).toISOString();
const checksum = '1'.repeat(32);
type Row = Record<string, unknown>;
function get(value: unknown, ...path: string[]): unknown {
  return path.reduce((parent, key) => (parent as Row)[key], value);
}
function set(value: unknown, path: string[], replacement: unknown): void {
  const parent = get(value, ...path.slice(0, -1)) as Row;
  parent[path.at(-1)!] = replacement;
}
function fixture(): KajoOrdinalSnapshots {
  const members = [1, 2].map(n => ({ actorUserId: id('1', n), membershipGeneration: id('2', n) }));
  const window = { id: id('c', 1), prediction_from: at(1000), prediction_until: at(5000), input_cutoff: at(5000),
    outcome_cutoff: at(11_000), metric_version: 'signed-exposed-rank-utility-v1', reward_version: 'outcome-reward-v1' };
  const genome = { id: id('b', 1), created_at: at(0), code_version: 'scalar-genome-v1', feature_version: 'prediction-features-v1',
    memory_version: 'memory-state-v1', outcome_version: 'outcome-precedence-v1', reward_version: 'outcome-reward-v1' };
  const comparison = (side: number, ratings: number[]) => {
    const objectId = id('4', side); const opened = side === 1 ? 6000 : 7000; const received = side === 1 ? 8000 : 9000;
    const captureId = id('7', side); const mask = members.map(p => p.actorUserId);
    const projected = members.map((member, i) => ({ actorUserId: member.actorUserId, status: 'RATED', rating: ratings[i],
      responseRevision: i + 2, receivedAt: at(received + i * 100), origin: { status: 'VALIDATED_TRACE',
        predictionId: id('9', side * 10 + i), claimedPredictionId: id('9', side * 10 + i),
        sessionId: id('d', side * 10 + i), discoveryMode: 'FOR_YOU' },
      attribution: { status: 'VALIDATED_TRACE', predictionId: id('9', side * 10 + i), proofEventId: null,
        proofOccurredAt: null, proofAvailableAt: null, proofAvailabilityBasis: null } }));
    const raw = projected.map(response => ({ actorUserId: response.actorUserId, status: response.status,
      rating: response.rating, responseRevision: response.responseRevision, receivedAt: response.receivedAt, origin: response.origin }));
    const outcome = { contractVersion: 'shared-round-outcome-v1', sourceBasis: 'COMMAND_RECEIPT_PREFIX',
      availabilityBasis: 'SERVER_COMMAND_ACCEPTED_AT', membershipValidity: 'HISTORICAL_MEMBERSHIP_UNKNOWN', commitVisibility: 'UNKNOWN',
      historicalFeatureEligible: false, learnable: false, groupReward: null, outcomeCutoff: at(11_000), evidenceCutoff: at(11_000),
      source: { commandId: id('e', side), revision: 3, participantSetVersion: 1, acceptedAt: at(received + 100) },
      round: { version: 1, state: 'COMPLETED', profileId: id('3', 1), roundId: id('5', side), experienceId: id('6', side), itemId: objectId,
        revision: 3, participantSetVersion: 1, createdAt: at(opened), updatedAt: at(received + 100), participants: members,
        responses: raw, learnable: false, groupReward: null }, responses: projected,
      maturity: { intervalSeconds: 1, anchorAt: at(received + 100), matureAt: at(received + 1100), isMature: true },
      vectorStatus: 'READY_FOR_VECTOR_REVIEW', coverage: { participantCount: 2, ratedCount: 2, attributedRatingCount: 2,
        eligibleVectorResponseCount: 2, unansweredCount: 0, unknownCount: 0, clearedCount: 0 } };
    return { contractVersion: 'shared-round-vector-comparison-v1', interpretationVersion: 'shared-round-outcome-v1',
      metricVersion: 'shared-round-paired-support-v1', usage: 'OUTCOME_EVIDENCE_ONLY',
      comparisonBasis: 'SAME_FROZEN_VECTOR_AND_COMMON_SUPPORT_MASK', comparisonId: id('8', side), captureId,
      genomeId: genome.id, evaluationWindowId: window.id, observedAt: at(12_000), evaluationWindow: window, genome,
      capturedOutcome: outcome, supportStatus: 'COMPLETE_VECTOR_SUPPORTED', vectorComparisonEligible: true,
      historicalFeatureEligible: false, learnable: false, groupReward: null, productionMetric: null, challengerMetric: null, advantage: null,
      outcomeDigest: checksum, commonSupportDigest: checksum, commonSupportMask: mask,
      production: { captureId, outcomeDigest: checksum, supportDigest: checksum, supportMask: mask },
      shadow: { captureId, outcomeDigest: checksum, supportDigest: checksum, supportMask: mask },
      coverage: { participantCount: 2, supportedParticipantCount: 2, unsupportedParticipantCount: 0, roundObservationCount: 1 },
      pairs: projected.map((response, i) => {
        const run = { id: response.origin.predictionId, profile_id: id('3', 1), actor_user_id: response.actorUserId,
          session_id: response.origin.sessionId, requested_at: at(side === 1 ? 2000 : 4000), requested_item_type: 'BOOK',
          discovery_mode: 'FOR_YOU', model_version: 'prediction-v1', policy_version: 'policy+frozen-replay-v2+catalog-chain-v1',
          context: {}, state_snapshot: {}, candidate_count: 2, result_count: 2, created_at: at(1000) };
        const sourcePool = [1, 2].map(n => ({ itemId: id('4', n), sourceRank: n, finalRank: n,
          sourceScore: n === 1 ? 6 : 4, finalScore: n === 1 ? 6 : 4, selectedForDelivery: true,
          explanationChecksum: checksum, scoringFeaturesChecksum: checksum, resurfacingInputChecksum: checksum }));
        const shadowPool = sourcePool.map(c => ({ itemId: c.itemId, sourceRank: c.sourceRank, productionFinalRank: c.finalRank,
          sourceScore: c.sourceScore, productionFinalScore: c.finalScore, shadowRank: 3 - c.finalRank,
          shadowScore: c.finalRank === 1 ? 3 : 8, hypotheticalSelected: true, explanationChecksum: checksum }));
        const shadow = { id: id('a', side * 10 + i), source_prediction_id: run.id, genome_id: genome.id, profile_id: run.profile_id,
          actor_user_id: run.actor_user_id, session_id: run.session_id, requested_item_type: 'BOOK', discovery_mode: 'FOR_YOU',
          as_of: run.requested_at, source_model_version: run.model_version, source_policy_version: run.policy_version,
          context: {}, state_snapshot: {}, code_version: 'shadow-replay-v2', feature_version: 'prediction-features-v2',
          memory_version: genome.memory_version, outcome_version: genome.outcome_version, reward_version: genome.reward_version,
          candidate_count: 2, hypothetical_result_count: 2, created_at: at(1100) };
        return { actorUserId: response.actorUserId, responseRevision: response.responseRevision, rating: response.rating,
          sourcePredictionId: run.id, shadowPredictionId: shadow.id, supportStatus: 'SUPPORTED',
          production: { rank: side, selectedForDelivery: true, modelVersion: run.model_version, policyVersion: run.policy_version },
          shadow: { rank: 3 - side, hypotheticalSelected: true, codeVersion: shadow.code_version,
            featureVersion: shadow.feature_version, memoryVersion: shadow.memory_version, outcomeVersion: shadow.outcome_version,
            rewardVersion: shadow.reward_version }, productionTrace: { run, candidates: sourcePool }, shadowTrace: { run: shadow, candidates: shadowPool } };
      }) };
  };
  return { pairId: 'scoped-pair', evaluationAsOf: base + 13_000, leftComparison: structuredClone(comparison(1, [0, 8])),
    rightComparison: structuredClone(comparison(2, [0, 5])), anchor: { actorUserId: id('1', 1), sourcePredictionId: id('9', 10) },
    references: { scopeId: 'audit', subjectRef: 'audit:subject', members: members.map((p, i) => ({ ...p,
      memberRef: `audit:member-${i}`, enrollmentRef: `audit:enrollment-${i}` })) } };
}

describe('strict owner-read Kajo ordinal snapshots', () => {
  it('maps both own outcome vectors into scoped handles, preserving zero and immutable revision lineage', () => {
    const input = fixture(); const before = structuredClone(input);
    const normalized = normalizeKajoOrdinalPair(input); const report = evaluateOrdinalPair(normalized);
    expect(report.status).toBe('comparable'); expect(report.observedOrder).toBe('left-dominates');
    expect(report.production.agreement).toBe('agreement'); expect(report.shadow.agreement).toBe('disagreement');
    expect(normalized.left.responses[0]?.observation?.raw.value).toBe(0);
    expect(normalized.left.responses[0]?.observation?.provenance.revision).toBe(2);
    expect(normalized.left.capture.comparisonId).toBe(id('8', 1));
    expect(report.integrityBasis).toBe('TRUSTED_OWNER_SNAPSHOT_DECLARED_DIGEST_BINDINGS');
    expect(report.learnable).toBe(false); expect(report.groupReward).toBeNull(); expect(report.uncertainty).toBe('unavailable');
    const emitted = JSON.stringify([normalized, report]);
    for (const raw of [id('3', 1), ...input.references.members.flatMap(p => [p.actorUserId, p.membershipGeneration])]) expect(emitted).not.toContain(raw);
    expect(input).toEqual(before);
  });
  it('predicts ties for equal scores even when Item ID tie-break ranks differ', () => {
    const input = fixture();
    set(input.leftComparison, ['pairs', '0', 'productionTrace', 'candidates', '1', 'finalScore'], 6);
    set(input.leftComparison, ['pairs', '0', 'shadowTrace', 'candidates', '1', 'productionFinalScore'], 6);
    expect(evaluateOrdinalPair(normalizeKajoOrdinalPair(input)).production.order).toBe('tie');
  });
  it('retains policy rank order when unequal scalar scores are inverted by eligibility tiers', () => {
    const input = fixture();
    set(input.leftComparison, ['pairs', '0', 'productionTrace', 'candidates', '1', 'finalScore'], 9);
    set(input.leftComparison, ['pairs', '0', 'shadowTrace', 'candidates', '1', 'productionFinalScore'], 9);
    expect(evaluateOrdinalPair(normalizeKajoOrdinalPair(input)).production.order).toBe('left');
  });
  it('preserves sub-millisecond pre-OPEN ordering and rejects equality or anchors after original OPEN', () => {
    const input = fixture(); const before = '2024-01-01T00:00:06.000001+00:00';
    const opened = '2024-01-01T00:00:06.000002+00:00';
    // Put the anchor inside its existing prediction window as well.
    for (const comparison of [input.leftComparison, input.rightComparison]) {
      set(comparison, ['evaluationWindow', 'prediction_until'], at(6500));
      set(comparison, ['evaluationWindow', 'input_cutoff'], at(6500));
    }
    set(input.leftComparison, ['pairs', '0', 'productionTrace', 'run', 'requested_at'], before);
    set(input.leftComparison, ['pairs', '0', 'shadowTrace', 'run', 'as_of'], before);
    set(input.leftComparison, ['capturedOutcome', 'round', 'createdAt'], opened);
    expect(normalizeKajoOrdinalPair(input).anchor.frozenAt).toBeLessThan(normalizeKajoOrdinalPair(input).left.openedAt);
    set(input.leftComparison, ['pairs', '0', 'productionTrace', 'run', 'requested_at'], opened);
    set(input.leftComparison, ['pairs', '0', 'shadowTrace', 'run', 'as_of'], opened);
    expect(() => normalizeKajoOrdinalPair(input)).toThrow('anchor-late');
    set(input.leftComparison, ['pairs', '0', 'productionTrace', 'run', 'requested_at'], '2024-01-01T00:00:06.000003+00:00');
    set(input.leftComparison, ['pairs', '0', 'shadowTrace', 'run', 'as_of'], '2024-01-01T00:00:06.000003+00:00');
    expect(() => normalizeKajoOrdinalPair(input)).toThrow('anchor-late');
  });
  it.each([
    ['borrowed member exposure', ['capturedOutcome', 'responses', '1', 'attribution', 'predictionId'], id('9', 10)],
    ['digest mismatch', ['production', 'outcomeDigest'], '0'.repeat(32)],
    ['partial mask', ['commonSupportMask'], [id('1', 1)]],
    ['nonfinite score', ['pairs', '0', 'productionTrace', 'candidates', '0', 'finalScore'], Infinity],
    ['duplicate rank', ['pairs', '0', 'productionTrace', 'candidates', '1', 'finalRank'], 1],
    ['null trace context', ['pairs', '0', 'productionTrace', 'run', 'context'], null],
    ['future shadow creation', ['pairs', '0', 'shadowTrace', 'run', 'created_at'], at(14_000)],
    ['premature maturity', ['capturedOutcome', 'maturity', 'anchorAt'], at(6500)],
    ['unknown replay version', ['pairs', '0', 'shadowTrace', 'run', 'code_version'], 'guessed-replay'],
    ['unselected actual Item', ['pairs', '0', 'productionTrace', 'candidates', '0', 'selectedForDelivery'], false],
    ['future capture interpretation', ['observedAt'], at(14_000)],
    ['legacy incomplete outcome', ['supportStatus'], 'PARTIAL_VECTOR_SUPPORTED'],
  ] as const)('rejects %s', (_name, path, value) => {
    const input = fixture(); set(input.leftComparison, [...path], value);
    expect(() => normalizeKajoOrdinalPair(input)).toThrow(KajoOrdinalSnapshotError);
  });
  it('rejects changed enrollment, incompatible windows, wrong anchors and missing common-pool Items', () => {
    for (const mutate of [
      (input: KajoOrdinalSnapshots) => set(input.rightComparison, ['capturedOutcome', 'round', 'participants', '0', 'membershipGeneration'], id('2', 9)),
      (input: KajoOrdinalSnapshots) => set(input.rightComparison, ['evaluationWindow', 'input_cutoff'], at(5500)),
      (input: KajoOrdinalSnapshots) => set(input, ['anchor', 'sourcePredictionId'], id('9', 20)),
      (input: KajoOrdinalSnapshots) => {
        set(input.leftComparison, ['pairs', '0', 'productionTrace', 'candidates', '1', 'itemId'], id('4', 3));
        set(input.leftComparison, ['pairs', '0', 'shadowTrace', 'candidates', '1', 'itemId'], id('4', 3));
      },
    ]) { const input = fixture(); mutate(input); expect(() => normalizeKajoOrdinalPair(input)).toThrow(KajoOrdinalSnapshotError); }
  });
  it('requires a common evidence cutoff even when each captured vector is individually valid', () => {
    const input = fixture();
    set(input.rightComparison, ['capturedOutcome', 'evidenceCutoff'], at(11_500));
    expect(() => normalizeKajoOrdinalPair(input)).toThrow('incompatible-snapshots');
    // Matching the other side establishes that the changed cutoff is valid;
    // alternate UTC representations of that same instant remain compatible.
    set(input.leftComparison, ['capturedOutcome', 'evidenceCutoff'], '2024-01-01T00:00:11.500000+00:00');
    expect(() => normalizeKajoOrdinalPair(input)).not.toThrow();
  });
  it('requires the same elapsed maturity horizon even when both vectors are already mature', () => {
    const input = fixture();
    set(input.rightComparison, ['capturedOutcome', 'maturity', 'intervalSeconds'], 0.5);
    set(input.rightComparison, ['capturedOutcome', 'maturity', 'matureAt'], at(9600));
    expect(() => normalizeKajoOrdinalPair(input)).toThrow('incompatible-snapshots');
    // A matching shorter horizon is valid on both sides without changing
    // either vector, OPEN, source receipt, response or evaluation window.
    set(input.leftComparison, ['capturedOutcome', 'maturity', 'intervalSeconds'], 0.5);
    set(input.leftComparison, ['capturedOutcome', 'maturity', 'matureAt'], at(8600));
    expect(() => normalizeKajoOrdinalPair(input)).not.toThrow();
  });
  it('requires a full unique scoped reference map, never raw identity aliases or another namespace', () => {
    for (const mutate of [
      (input: KajoOrdinalSnapshots) => set(input, ['references', 'members', '0', 'memberRef'], `audit:${id('1', 1)}`),
      (input: KajoOrdinalSnapshots) => set(input, ['references', 'members', '0', 'memberRef'], 'another:member'),
      (input: KajoOrdinalSnapshots) => set(input, ['references', 'members', '1', 'memberRef'], 'audit:member-0'),
      (input: KajoOrdinalSnapshots) => set(input, ['references', 'members'], input.references.members.slice(0, 1)),
    ]) { const input = fixture(); mutate(input); expect(() => normalizeKajoOrdinalPair(input)).toThrow(KajoOrdinalSnapshotError); }
  });
  it('rejects cyclic, oversized and excessively deep untrusted structural envelopes', () => {
    const cyclic = fixture(); set(cyclic.leftComparison, ['cycle'], cyclic.leftComparison);
    expect(() => normalizeKajoOrdinalPair(cyclic)).toThrow(KajoOrdinalSnapshotError);
    const oversized = fixture(); set(oversized.leftComparison, ['padding'], 'x'.repeat(8_388_608));
    expect(() => normalizeKajoOrdinalPair(oversized)).toThrow('budget-exceeded');
    const deep = fixture(); let nested: unknown = null;
    for (let i = 0; i < 60; i++) nested = { child: nested };
    set(deep.leftComparison, ['deep'], nested);
    expect(() => normalizeKajoOrdinalPair(deep)).toThrow('budget-exceeded');
  });
});
