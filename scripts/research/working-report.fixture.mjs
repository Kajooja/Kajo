// Generated native-shaped records are engineering fixtures, never user quality.
const controls = ['OFF', 'STATIC', 'ORDERED'];
const id = number => `a9150000-0000-4000-8000-${String(number).padStart(12, '0')}`;

// Generated native shapes exercise bounded report consumption only. The actual
// SQL producer/active-feature bridge is tested in working-outcomes-kajo.test.mjs.
export function workingReportFixtureEntry(index = 0, sameScope = true) {
  const offset = index * 1000, native = number => id(number + offset);
  const scopeIndex = sameScope ? 0 : index, scopeOffset = scopeIndex * 1000;
  const actor = id(1 + scopeOffset), profile = id(2 + scopeOffset), session = id(3 + scopeOffset);
  const scoped = name => `fixture:${name}`;
  const flags = { learnable: false, historicalFeatureEligible: false, nativeActivated: false };
  const policy = 'personal-persona-v1+personal-working-off-v3';
  const artifact = { id: 'native-working-tags', version: '1', representationVersion: 'native-binary-tags-v1',
    availableAt: 100, trainedThrough: null, sourceRefs: ['kajo-canonical-events-v1'], use: 'research-only' };
  const capture = { captureId: native(5), version: 'native-working-capture-v3', kind: 'working-state',
    stateVersion: 'working-state-v1', actorUserId: actor, profile: { id: profile, type: 'PERSONAL', ownerUserId: actor },
    session: { id: session, actor_user_id: actor, profile_id: profile }, cutoff: 100, asOf: 100,
    ...flags, commitAvailability: 'UNKNOWN', availabilityBasis: 'STORED_CREATED_TIME',
    featureAvailabilityBasis: 'CURRENT_MVCC_SNAPSHOT_KNOWN_AT_CAPTURE', prefixComplete: true, status: 'INACTIVE',
    rawEvents: [], records: [], items: [], itemFeatures: [], featureSchema: { id: 'native-working-tags',
      version: '1', dimensions: [], artifact }, resetAt: null, resetControls: [], resetSourceRefs: [] };
  const candidates = [20, 21, 22, 23].map((number, rank) => ({ prediction_id: native(4), item_id: native(number),
    source_score: 0.8 - rank * 0.1, final_score: 0.8 - rank * 0.1, source_rank: rank + 1, final_rank: rank + 1,
    selected_for_delivery: true, created_at: 90, explanation: { policyVersion: policy,
      resurfacingPolicy: { eligible: true, classification: 'UNSEEN' },
      workingIntent: { version: 'personal-working-features-v3', captureId: native(5), stateVersion: 'working-state-v1',
        policyVersion: 'working-policy-v1', control: 'OFF', staticAdjustment: 0, orderedAdjustment: 0,
        ...flags, captureVersion: capture.version, resetAt: null, resetSourceRefs: [],
        candidateFeatures: { version: 'native-working-candidate-features-v1', status: 'UNAVAILABLE', captureId: native(5),
          asOf: 100, featureSchemaRef: { id: artifact.id, version: '1', artifactId: artifact.id, artifactVersion: '1',
            representationVersion: artifact.representationVersion, dimensionCount: 0 },
          featureEncoding: 'CAPTURE_DIMENSION_ORDER_BINARY_V1', availabilityBasis: 'SOURCE_RANKING_STATEMENT_SNAPSHOT',
          availableAt: null, commitAvailability: 'UNKNOWN', ...flags, features: null, unavailableReason: 'CAPTURE_INACTIVE' } } } }));
  const comparisons = controls.map(control => ({ source_prediction_id: native(4), control, created_at: 195,
    result: { version: 'personal-working-shadow-v3', sourcePredictionId: native(4), captureId: native(5), control,
      sourceModelVersion: 'native-model-v1', sourcePolicyVersion: policy, policyVersion: 'working-policy-v1',
      servingControl: 'OFF', comparisonScope: 'FROZEN_CANDIDATE_POOL_AND_FINAL_DELIVERY_POLICY',
      commitAvailability: 'UNKNOWN', observedEvaluationCount: 0, calibration: 'uncalibrated', uncertainty: 'unavailable',
      asOf: 100, candidateCount: 4, ...flags, captureVersion: capture.version, resetAt: null, resetSourceRefs: [],
      candidates: candidates.map(candidate => ({ itemId: candidate.item_id, eligible: true, tier: 0, selected: true,
        adjustment: 0, score: candidate.final_score, rank: candidate.final_rank })) } }));
  const nativeScope = { actorUserId: actor, profileId: profile, sessionId: session, sourcePredictionId: native(4) };
  const enrollment = { version: 'personal-working-enrollment-v1', enrollmentId: native(70), ...nativeScope,
    declaredAt: 210, horizon: { startAt: 210, endAt: 310 }, matureAt: 330,
    pairs: [0, 1].map(pairIndex => ({ pairId: native(71 + pairIndex),
      leftItemId: native(20 + pairIndex * 2), rightItemId: native(21 + pairIndex * 2) })),
    controls: controls.map((control, controlIndex) => ({ control, comparisonId: native(80 + controlIndex), createdAt: 195 })),
    commitAvailability: 'UNKNOWN', ...flags };
  const objectAliases = candidates.map(candidate => ({ itemId: candidate.item_id,
    objectRef: scoped(`object-${Number(candidate.item_id.slice(-12))}`) }));
  const planSnapshot = { actorUserId: actor, profile: { id: profile, type: 'PERSONAL', ownerUserId: actor },
    sourceRun: { id: native(4), actor_user_id: actor, profile_id: profile, session_id: session, genome_id: native(6),
      requested_at: 120, created_at: 180, discovery_mode: 'FOR_YOU', requested_item_type: 'BOOK',
      model_version: 'native-model-v1', base_model_version: 'native-base-v1', policy_version: policy,
      candidate_count: 4, result_count: 4, state_snapshot: { workingState: capture } },
    sourceCandidates: candidates, comparisons, enrollment, snapshotObservedAt: 400,
    planning: { id: scoped(`enrollment-${index}`), createdAt: 210, horizon: enrollment.horizon,
      pairs: enrollment.pairs.map((pair, pairIndex) => ({ pairId: scoped(`pair-${index}-${pairIndex}`),
        leftItemId: pair.leftItemId, rightItemId: pair.rightItemId })) },
    references: { scopeId: 'fixture', subjectRef: scoped(`subject-${scopeIndex}`), actorRef: scoped(`actor-${scopeIndex}`),
      sessionRef: scoped(`session-${scopeIndex}`), sourcePredictionRef: scoped(`source-${index}`),
      captureRef: scoped(`working-capture-${index}`), controlRefs: Object.fromEntries(controls.map(control =>
        [control, scoped(`${control.toLowerCase()}-${index}`)])), objects: objectAliases } };
  const labels = candidates.map((candidate, labelIndex) => ({ itemId: candidate.item_id,
    status: labelIndex < 2 ? 'observed' : 'missing', reason: labelIndex < 2 ? null : 'NO_TERMINAL',
    exposureId: labelIndex < 2 ? native(110 + labelIndex) : null, exposedAt: labelIndex < 2 ? 230 : null,
    eventId: labelIndex < 2 ? native(100 + labelIndex) : null, occurredAt: labelIndex < 2 ? 250 : null,
    eventSessionId: labelIndex < 2 ? session : null, originPredictionId: labelIndex < 2 ? native(4) : null,
    rating: labelIndex < 2 ? labelIndex * 10 : null }));
  const outcomeSnapshot = { capture: { version: 'personal-working-outcomes-v1', captureId: native(90),
    enrollmentId: native(70), ...nativeScope, revision: 1, capturedAt: 350, matureAt: 330, complete: true,
    resolutionVersion: 'personal-latest-terminal-v1', labels, commitAvailability: 'UNKNOWN', ...flags },
  references: { scopeId: 'fixture', enrollmentRef: planSnapshot.planning.id, captureRef: scoped(`outcome-${index}`),
    controls: Object.fromEntries(controls.map((control, controlIndex) => [control, { comparisonId: native(80 + controlIndex),
      controlRef: planSnapshot.references.controlRefs[control] }])),
    pairs: enrollment.pairs.map((pair, pairIndex) => ({ pairId: pair.pairId, pairRef: scoped(`pair-${index}-${pairIndex}`) })),
    objects: objectAliases, events: labels.filter(label => label.eventId !== null).map(label => ({ eventId: label.eventId,
      recordRef: scoped(`record-${Number(label.eventId.slice(-12))}`) })),
    exposures: labels.filter(label => label.exposureId !== null).map(label => ({ exposureId: label.exposureId,
      experienceRef: scoped(`experience-${Number(label.exposureId.slice(-12))}`) })) } };
  return { expectedScope: { ...nativeScope, enrollmentId: native(70) }, planSnapshot, outcomeSnapshot };
}

// Additive current-native contract fixture. The v1 fixture/receipts above stay
// unchanged; real SQL producer interoperability has a separate database gate.
export function workingReportNativeFixtureEntry(index = 0, sameScope = true) {
  const entry = workingReportFixtureEntry(index, sameScope), snapshot = entry.planSnapshot;
  const source = snapshot.sourceRun, state = source.state_snapshot;
  const native = number => id(number + index * 1000);
  const policy = 'scenario-memory-v1+resurfacing-v1+outcome-attribution-v1+frozen-replay-v2+eligibility-first-v1+personal-working-off-v3';
  const weights = { direct: 1, longTerm: 1, shortTerm: 1, novelty: 1, exploration: 1,
    scenario: 1, reactionPenalty: 1, impressionCooldown: 1 };
  snapshot.sourceGenome = { id: source.genome_id, genome_key: 'prediction-v1-baseline', model_family: 'PREDICTION_V1_BASELINE',
    code_version: 'prediction-v1.0+sleep-layer-v1', feature_version: 'prediction-features-v1', memory_version: 'memory-state-v1',
    outcome_version: 'outcome-precedence-v1', reward_version: 'outcome-reward-v1', created_at: 50,
    config: { schemaVersion: 'scalar-genome-v1', modeWeights: { FOR_YOU: { ...weights }, SURPRISE: { ...weights }, RISK: { ...weights } } } };
  Object.assign(source, { model_version: 'prediction-v1.0', base_model_version: 'prediction-v0.5-native-decay',
    policy_version: policy, created_at: 90, candidate_count: 6 });
  Object.assign(state, { asOf: 90,
    candidateRequest: { version: 'native-candidate-request-v1', acquisition: 'LEGACY_DISCOVERY', intent: 'DELIVERY',
      itemIds: null, seenItemIds: [], reminderSpent: false, requiredAfter: null },
    predictionInput: { version: 'native-prediction-clocks-v1', nativeEvidenceAsOf: 90, memoryStateAsOf: 90, scenarioAsOf: 90,
      requestAsOf: 120, workingStateAsOf: 100, arithmeticClock: 'TRANSACTION_START', eligibilityClock: 'CURRENT_WALL_TIME',
      dataSnapshot: 'CURRENT_STATEMENT_SNAPSHOTS', historicalReconstruction: 'UNAVAILABLE', commitVisibility: 'UNKNOWN',
      candidateAcquisition: 'LEGACY_DISCOVERY', requiredAfter: null } });
  for (const rank of [5, 6]) {
    const candidate = structuredClone(snapshot.sourceCandidates[0]);
    Object.assign(candidate, { item_id: native(19 + rank), source_score: 0.8 - (rank - 1) * 0.1,
      final_score: 0.8 - (rank - 1) * 0.1, source_rank: rank, final_rank: rank, selected_for_delivery: false });
    candidate.explanation.resurfacingPolicy = { eligible: rank === 5, classification: rank === 5 ? 'UNSEEN' : 'SUPPRESSED' };
    snapshot.sourceCandidates.push(candidate);
    snapshot.references.objects.push({ itemId: candidate.item_id, objectRef: `fixture:object-${Number(candidate.item_id.slice(-12))}` });
  }
  for (const candidate of snapshot.sourceCandidates) {
    Object.assign(candidate, { confidence: 0, scenario_score: 0, scenario_support: 0, scenario_max_similarity: 0, selection_probability: null });
    Object.assign(candidate.explanation, { version: source.model_version, baseVersion: source.base_model_version, policyVersion: policy,
      scalarGenome: { genomeId: source.genome_id, genomeKey: snapshot.sourceGenome.genome_key, baselineEquivalent: true },
      scoringFeatures: { version: 'prediction-features-v2', nativeDecayVersion: 'native-long-term-decay-v2', nativeEvidenceAsOf: 90,
        direct: 0, longTerm: 0, shortTerm: 0, novelty: 0, exploration: 0, reactionQueuePenalty: 0, impressionCooldownPenalty: 0 },
      candidatePool: { version: 'eligibility-first-v1', eligibilityAt: 130, retainedLimit: 50, retainedCount: 6, consideredCount: 6,
        ordinaryCount: 5, reminderEligibleCount: 0, suppressedCount: 1,
        admissionRank: candidate.source_rank, baselineScoreRank: candidate.source_rank } });
  }
  for (const comparison of snapshot.comparisons) {
    Object.assign(comparison.result, { sourceModelVersion: source.model_version, sourcePolicyVersion: policy, candidateCount: 6,
      candidates: snapshot.sourceCandidates.map(candidate => ({ itemId: candidate.item_id,
        eligible: candidate.explanation.resurfacingPolicy.eligible,
        tier: candidate.explanation.resurfacingPolicy.eligible ? 0 : 2, selected: candidate.selected_for_delivery,
        adjustment: 0, score: candidate.final_score, rank: candidate.final_rank })) });
  }
  // Only the four declared pair objects have outcome labels/exposure references.
  entry.outcomeSnapshot.references.objects = snapshot.references.objects.slice(0, 4);
  return entry;
}
