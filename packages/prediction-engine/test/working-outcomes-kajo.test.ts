import { describe, expect, it } from 'vitest';
import { KajoWorkingOutcomeSnapshotError, normalizeKajoWorkingOutcomeCapture } from '../src/adapters/kajo-working-outcomes.js';
import type { KajoWorkingOutcomeSnapshots } from '../src/adapters/kajo-working-outcomes.js';
import { evaluateWorkingPlan, freezeWorkingEvaluationPlan } from '../src/working-evaluation.js';
import { deriveWorkingState } from '../src/working-state.js';
import type { PredictionObject } from '../src/contracts.js';
import type { WorkingRecord } from '../src/working-state.js';

// Generated producer-shaped snapshots test a pure read adapter, not real quality.
type Row = Record<string, unknown>;
const id = (n: number) => `af120000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const controls = ['OFF', 'STATIC', 'ORDERED'] as const;
function fixture() {
  const native = { actorUserId: id(1), profileId: id(2), sessionId: id(3), sourcePredictionId: id(4) };
  const declaredAt = 110.123, capturedAt = 550.456, matureAt = 530;
  const pool = (rightFirst: boolean) => [
    { objectId: 'fixture:left', score: rightFirst ? 0.1 : 0.8, rank: rightFirst ? 2 : 1, eligible: true, tier: 0, selected: true },
    { objectId: 'fixture:right', score: rightFirst ? 0.9 : 0.7, rank: rightFirst ? 1 : 2, eligible: true, tier: 0, selected: true },
    { objectId: 'fixture:unpaired', score: 0, rank: 3, eligible: true, tier: 0, selected: false },
  ];
  const frozenControl = (control: string, index: number) => ({ id: `fixture:${control.toLowerCase()}`, version: 'personal-working-shadow-v3',
    createdAt: 101 + index / 1000, availableAt: 101 + index / 1000, availabilityBasis: 'STORED_CREATED_TIME' as const,
    candidates: pool(control === 'ORDERED') });
  const plan = freezeWorkingEvaluationPlan({ id: 'fixture:enrollment', sourcePredictionId: 'fixture:source',
    scope: { subject: { id: 'fixture:subject', kind: 'individual' }, actingIdentityRef: 'fixture:actor', sessionRef: 'fixture:session',
      evidence: { sourceIds: ['kajo-canonical-events-v1'], cohortIds: [], synthetic: 'exclude' } },
    target: { id: 'kajo:personal-exposed-rating-order', version: '1', scale: { min: 0, max: 10 },
      conditioning: 'object-observation', exposure: 'required', objective: 'maximize' },
    sourceCutoff: 100, createdAt: declaredAt, availableAt: declaredAt, availabilityBasis: 'STORED_CREATED_TIME',
    selectionBasis: 'PREDECLARED_DISJOINT_PAIRS', horizon: { startAt: declaredAt, endAt: 500 },
    versions: { capture: 'native-working-capture-v3', features: 'personal-working-features-v3',
      scorer: 'prediction-candidate-score-working-v1', policy: 'personal-working-off-v3' },
    controls: { OFF: frozenControl('OFF', 0), STATIC: frozenControl('STATIC', 1), ORDERED: frozenControl('ORDERED', 2) },
    pairs: [{ pairId: 'fixture:pair', leftObjectId: 'fixture:left', rightObjectId: 'fixture:right' }],
    sourceBinding: { kind: 'kajo-native-personal-working', captureRef: 'fixture:working-capture', modelVersion: 'native-model-v1',
      baseModelVersion: 'native-base-v1', mode: 'FOR_YOU', objectType: 'BOOK', requestedAt: 100, storedSourceCreatedAt: 100,
      snapshotObservedAt: 105, commitAvailability: 'UNKNOWN', historicalFeatureEligible: false },
    working: { status: 'unavailable', reason: 'FROZEN_CANDIDATE_FEATURES_UNAVAILABLE' } });
  const enrollment: Row = { version: 'personal-working-enrollment-v1', enrollmentId: id(5), ...native, declaredAt,
    horizon: { startAt: declaredAt, endAt: 500 }, matureAt, pairs: [{ pairId: id(6), leftItemId: id(20), rightItemId: id(21) }],
    controls: controls.map((control, index) => ({ control, comparisonId: id(7 + index), createdAt: 101 + index / 1000 })),
    commitAvailability: 'UNKNOWN', historicalFeatureEligible: false, learnable: false, nativeActivated: false };
  const capture: Row = { version: 'personal-working-outcomes-v1', captureId: id(10), enrollmentId: id(5), ...native,
    revision: 1, capturedAt, matureAt, complete: true, resolutionVersion: 'personal-latest-terminal-v1',
    labels: [0, 1].map(index => ({ itemId: id(20 + index), status: 'observed', reason: null, exposureId: id(30 + index),
      exposedAt: 150 + index, eventId: id(40 + index), occurredAt: 200 + index,
      eventSessionId: id(90 + index), originPredictionId: index === 0 ? null : id(99), rating: index * 10 })),
    commitAvailability: 'UNKNOWN', historicalFeatureEligible: false, learnable: false, nativeActivated: false };
  return { native, enrollment, capture, plan, references: { scopeId: 'fixture', enrollmentRef: 'fixture:enrollment',
    captureRef: 'fixture:outcome-capture', controls: {
      OFF: { comparisonId: id(7), controlRef: 'fixture:off' }, STATIC: { comparisonId: id(8), controlRef: 'fixture:static' },
      ORDERED: { comparisonId: id(9), controlRef: 'fixture:ordered' } },
    pairs: [{ pairId: id(6), pairRef: 'fixture:pair' }],
    objects: [{ itemId: id(20), objectRef: 'fixture:left' }, { itemId: id(21), objectRef: 'fixture:right' }],
    events: [{ eventId: id(40), recordRef: 'fixture:rating-left' }, { eventId: id(41), recordRef: 'fixture:rating-right' }],
    exposures: [{ exposureId: id(30), experienceRef: 'fixture:experience-left' }, { exposureId: id(31), experienceRef: 'fixture:experience-right' }] } };
}
type Fixture = ReturnType<typeof fixture>;
function labels(input: Fixture): Row[] { return input.capture.labels as Row[]; }
const rejected = (input: KajoWorkingOutcomeSnapshots) => expect(() => normalizeKajoWorkingOutcomeCapture(input))
  .toThrow(KajoWorkingOutcomeSnapshotError);

function withInputClosure(): Fixture {
  const input = fixture(), artifact = { id: 'native-working-tags', version: '1', representationVersion: 'native-binary-tags-v1',
    availableAt: 0, trainedThrough: null, sourceRefs: ['kajo-canonical-events-v1'], use: 'research-only' } as const;
  const object = (objectId: string): PredictionObject => ({ id: objectId, features: { warm: 1 }, availableAt: 0, artifact });
  const records: WorkingRecord[] = ['one', 'two'].map((name, index) => ({ kind: 'VALUE', sessionRef: input.plan.scope.sessionRef,
    object: object(`fixture:input-object-${name}`), observation: { subjectId: input.plan.scope.subject.id,
      actingIdentityRef: input.plan.scope.actingIdentityRef, objectId: `fixture:input-object-${name}`, actionId: null,
      predictionId: null, targetId: input.plan.target.id, targetVersion: input.plan.target.version,
      measurement: { status: 'observed', value: index * 10 }, raw: { value: index * 10, scale: input.plan.target.scale },
      occurredAt: 10 + index, availableAt: 10 + index, exposure: 'unknown',
      access: { kind: 'subject', subjectId: input.plan.scope.subject.id },
      provenance: { origin: 'observed', source: { kind: 'native', id: 'kajo-canonical-events-v1' },
        recordId: `fixture:input-event-${name}`, revision: 1 } } }));
  records.push({ ...records[0]!, kind: 'UNDO', invalidates: [{ sourceId: 'kajo-canonical-events-v1', recordId: 'fixture:input-undo-target' }],
    observation: { ...records[0]!.observation, occurredAt: 20, availableAt: 20,
      provenance: { ...records[0]!.observation.provenance, recordId: 'fixture:input-undo' } } });
  const state = deriveWorkingState({ scope: input.plan.scope, target: input.plan.target, asOf: input.plan.sourceCutoff,
    session: { ref: input.plan.scope.sessionRef, startedAt: 0 }, prefixComplete: true, records,
    featureSchema: { id: 'native-working-tags', version: '1', dimensions: ['warm'], artifact }, availabilityBasis: 'STORED_CREATED_TIME' });
  input.plan = freezeWorkingEvaluationPlan({ ...input.plan,
    working: { status: 'available', state, objects: input.plan.controls.OFF.candidates.map(candidate => object(candidate.objectId)) } });
  return input;
}

describe('native Personal Working immutable outcome snapshot adapter', () => {
  it('retains actual zero, scoped forecast context and independent latest rating origin without raw identities', () => {
    const input = fixture(), before = structuredClone(input), output = normalizeKajoWorkingOutcomeCapture(input);
    expect(input).toEqual(before); expect(output.createdAt).toBe(550.456); expect(output.availableAt).toBe(output.createdAt);
    expect(output.labels[0]!.observation).toMatchObject({ measurement: { status: 'observed', value: 0 },
      raw: { value: 0, scale: { min: 0, max: 10 } }, actingIdentityRef: 'fixture:actor', actionId: null,
      predictionId: 'fixture:source', availableAt: 550.456, exposure: 'verified',
      provenance: { origin: 'observed', source: { kind: 'native', id: 'kajo-canonical-events-v1' }, recordId: 'fixture:rating-left', revision: 1 } });
    expect(output.sessionRef).toBe('fixture:session'); expect(Object.isFrozen(output.labels[0]!.observation!.raw)).toBe(true);
    for (let n = 1; n <= 99; n++) expect(JSON.stringify(output)).not.toContain(id(n));
    const report = evaluateWorkingPlan(input.plan, output, 600);
    expect(report.comparablePairUnits).toBe(1); expect(report.observed.nativePairUnits).toBe(1);
    expect(report.pairs[0]!.observedOrder).toBe('right'); expect(report.pairs[0]!.prospectiveDeclaredEligibility).toBe(false);
    expect(report.learnable).toBe(false); expect(report.qualityAdmitted).toBe(false);
  });

  it('keeps equal actual ratings as a target tie, without inventing a winner', () => {
    const input = fixture(); labels(input)[1]!.rating = 0;
    const report = evaluateWorkingPlan(input.plan, normalizeKajoWorkingOutcomeCapture(input), 600);
    expect(report.plannedPairUnits).toBe(1); expect(report.pairs[0]!.observedOrder).toBe('tie');
    expect(report.pairs[0]!.reasons).toContain('all-tied'); expect(report.observed.nativePairUnits).toBe(0);
  });

  it.each(['unknown', 'clear', 'missing', 'undone'])('preserves %s as unscored with the complete planned denominator', status => {
    const input = fixture(); Object.assign(labels(input)[0]!, { status, rating: null, reason: 'LATEST_TERMINAL_UNAVAILABLE' });
    const output = normalizeKajoWorkingOutcomeCapture(input), report = evaluateWorkingPlan(input.plan, output, 600);
    expect(output.labels).toHaveLength(2); expect(output.labels[0]!.status).toBe(status); expect(output.labels[0]!.observation).toBeNull();
    expect(report.plannedPairUnits).toBe(1); expect(report.comparablePairUnits).toBe(0);
  });

  it('gives missing exposure a unique nonobserved placeholder without fabricating source evidence', () => {
    const input = fixture();
    for (const label of labels(input)) Object.assign(label, { status: 'missing', rating: null, exposureId: null, exposedAt: null,
      eventId: null, occurredAt: null, eventSessionId: null, originPredictionId: null });
    input.references.events = []; input.references.exposures = [];
    const output = normalizeKajoWorkingOutcomeCapture(input);
    expect(output.labels.map(label => label.experienceId)).toEqual(['fixture:left', 'fixture:right']);
    expect(output.labels.every(label => label.exposedAt === input.plan.horizon.startAt && label.observation === null)).toBe(true);
    const report = evaluateWorkingPlan(input.plan, output, 600);
    expect(report.pairs[0]!.reasons).toContain('missing-label'); expect(report.pairs[0]!.reasons).not.toContain('same-experience');
  });

  it('retains incomplete and immature capture boundaries rather than admitting them', () => {
    const incomplete = fixture(); incomplete.capture.complete = false;
    expect(evaluateWorkingPlan(incomplete.plan, normalizeKajoWorkingOutcomeCapture(incomplete), 600).pairs[0]!.reasons).toContain('incomplete-capture');
    const immature = fixture(); immature.capture.capturedAt = 510;
    expect(evaluateWorkingPlan(immature.plan, normalizeKajoWorkingOutcomeCapture(immature), 600).pairs[0]!.reasons).toContain('capture-before-maturity');
  });

  it('uses capture revisions while retaining each immutable Event as one source observation', () => {
    const input = fixture(); input.capture.revision = 16;
    const output = normalizeKajoWorkingOutcomeCapture(input);
    expect(output.revision).toBe(16); expect(output.labels[0]!.observation!.provenance.revision).toBe(1);
  });

  it.each(['actorUserId', 'profileId', 'sessionId', 'sourcePredictionId'])('rejects mismatched native/enrollment/capture %s', key => {
    for (const envelope of ['enrollment', 'capture'] as const) { const input = fixture(); input[envelope][key] = id(100); rejected(input); }
    const input = fixture(); input.native[key as keyof typeof input.native] = id(100); rejected(input);
  });

  it('rejects enrollment/capture/version/resolution/admission mismatches', () => {
    for (const [envelope, key, value] of [
      ['enrollment', 'version', 'personal-working-enrollment-v2'], ['capture', 'version', 'personal-working-outcomes-v2'],
      ['capture', 'enrollmentId', id(11)], ['capture', 'captureId', id(5)], ['capture', 'resolutionVersion', 'strongest-episode-v1'],
      ['capture', 'complete', 'true'],
    ] as const) { const input = fixture(); input[envelope][key] = value; rejected(input); }
    for (const envelope of ['enrollment', 'capture'] as const) {
      const commit = fixture(); commit[envelope].commitAvailability = 'CERTIFIED'; rejected(commit);
      for (const key of ['historicalFeatureEligible', 'learnable', 'nativeActivated']) {
        const input = fixture(); input[envelope][key] = true; rejected(input);
      }
    }
  });

  it('requires exact declared clocks, horizon, maturity and bounded capture revisions', () => {
    for (const [envelope, key, value] of [
      ['enrollment', 'declaredAt', 111], ['enrollment', 'matureAt', 499], ['capture', 'matureAt', 531],
      ['capture', 'capturedAt', 109], ['capture', 'capturedAt', Infinity], ['capture', 'capturedAt', -1],
      ['capture', 'revision', 0], ['capture', 'revision', 17], ['capture', 'revision', 1.1],
    ] as const) { const input = fixture(); input[envelope][key] = value; rejected(input); }
    const input = fixture(); (input.enrollment.horizon as Row).endAt = 501; rejected(input);
  });

  it('rejects wrong target, source provenance and prospective availability certification', () => {
    for (const target of [{ ...fixture().plan.target, id: 'reward' }, { ...fixture().plan.target, version: '2' },
      { ...fixture().plan.target, conditioning: 'action-outcome' as const },
      { ...fixture().plan.target, scale: { min: 1, max: 10 } }]) {
      const input = fixture(); input.plan = freezeWorkingEvaluationPlan({ ...input.plan, target }); rejected(input);
    }
    const other = fixture(); other.plan = freezeWorkingEvaluationPlan({ ...other.plan,
      scope: { ...other.plan.scope, evidence: { ...other.plan.scope.evidence, sourceIds: ['other'] } } }); rejected(other);
    const claimed = fixture(); claimed.plan = freezeWorkingEvaluationPlan({ ...claimed.plan, availabilityBasis: 'DECLARED_AVAILABLE_TIME' }); rejected(claimed);
  });

  it('requires exact three native comparison identities, aliases and creation clocks', () => {
    const missing = fixture(); (missing.enrollment.controls as Row[]).pop(); rejected(missing);
    const duplicate = fixture(); (duplicate.enrollment.controls as Row[])[2]!.control = 'OFF'; rejected(duplicate);
    const wrongId = fixture(); wrongId.references.controls.OFF.comparisonId = id(90); rejected(wrongId);
    const wrongClock = fixture(); (wrongClock.enrollment.controls as Row[])[0]!.createdAt = 101.001; rejected(wrongClock);
    const extra = fixture(); (extra.references.controls as unknown as Row).EXTRA = extra.references.controls.OFF; rejected(extra);
  });

  it('requires exact planned disjoint pair and object maps, retaining pair orientation', () => {
    const reversed = fixture(); (reversed.enrollment.pairs as Row[])[0]!.leftItemId = id(21); rejected(reversed);
    const pair = fixture(); pair.references.pairs[0]!.pairId = id(99); rejected(pair);
    const wrongRef = fixture(); wrongRef.references.pairs[0]!.pairRef = 'fixture:other-pair'; rejected(wrongRef);
    const missing = fixture(); missing.references.objects.pop(); rejected(missing);
    const extra = fixture(); extra.references.objects.push({ itemId: id(22), objectRef: 'fixture:unpaired' }); rejected(extra);
    const alias = fixture(); alias.references.objects[0]!.objectRef = 'fixture:right'; rejected(alias);
  });

  it('rejects missing/extra/duplicate or foreign Item labels rather than changing the denominator', () => {
    const missing = fixture(); labels(missing).pop(); rejected(missing);
    const duplicate = fixture(); labels(duplicate)[1]!.itemId = id(20); rejected(duplicate);
    const foreign = fixture(); labels(foreign)[1]!.itemId = id(90); rejected(foreign);
    const extra = fixture(); labels(extra).push({ ...labels(extra)[0]!, itemId: id(22) }); rejected(extra);
  });

  it('requires exact one-to-one Event/exposure references and disjoint scoped aliases', () => {
    const missing = fixture(); missing.references.events.pop(); rejected(missing);
    const extra = fixture(); extra.references.events.push({ eventId: id(90), recordRef: 'fixture:other' }); rejected(extra);
    const wrong = fixture(); wrong.references.exposures[0]!.exposureId = id(90); rejected(wrong);
    const duplicate = fixture(); labels(duplicate)[1]!.eventId = id(40); rejected(duplicate);
    const repeatedExposure = fixture(); labels(repeatedExposure)[1]!.exposureId = id(30); rejected(repeatedExposure);
    const aliases = fixture(); aliases.references.events[0]!.recordRef = aliases.references.exposures[0]!.experienceRef; rejected(aliases);
    const crossScope = fixture(); crossScope.references.captureRef = 'another:outcome'; rejected(crossScope);
    const resultCollision = fixture(); resultCollision.references.captureRef = 'fixture:enrollment'; rejected(resultCollision);
    const rawNested = fixture(); rawNested.references.captureRef = `fixture:${id(99)}`; rejected(rawNested);
  });

  it('reserves the full frozen input closure across Object, Event and Exposure reference kinds', () => {
    expect(normalizeKajoWorkingOutcomeCapture(withInputClosure()).labels).toHaveLength(2);
    for (const key of ['recordRef', 'experienceRef'] as const) {
      const input = withInputClosure();
      if (key === 'recordRef') input.references.events[0]!.recordRef = 'fixture:input-object-one';
      else input.references.exposures[0]!.experienceRef = 'fixture:input-object-one';
      rejected(input);
    }
    for (const alias of ['fixture:input-event-one', 'fixture:input-undo-target']) {
      const input = withInputClosure(); input.references.exposures[0]!.experienceRef = alias; rejected(input);
    }
    const resultCollision = withInputClosure(); resultCollision.references.captureRef = 'fixture:input-event-one'; rejected(resultCollision);
  });

  it('allows an exact input Event alias to recur while the evaluator rejects input/outcome reuse', () => {
    const input = withInputClosure(); input.references.events[0]!.recordRef = 'fixture:input-event-one';
    const output = normalizeKajoWorkingOutcomeCapture(input), report = evaluateWorkingPlan(input.plan, output, 600);
    expect(output.labels[0]!.observation!.provenance.recordId).toBe('fixture:input-event-one');
    expect(report.pairs[0]!.reasons).toContain('input-outcome-reuse'); expect(report.comparablePairUnits).toBe(0);
    const corrected = withInputClosure(); corrected.references.events[0]!.recordRef = 'fixture:input-undo-target';
    Object.assign(labels(corrected)[0]!, { status: 'undone', rating: null });
    expect(normalizeKajoWorkingOutcomeCapture(corrected).labels[0]!.status).toBe('undone');
  });

  it('rejects contradictory observed status, malformed scales and absent or late source clocks', () => {
    for (const [key, value] of [['status', 'rated'], ['rating', null], ['rating', '0'], ['rating', -1], ['rating', 11], ['rating', 0.5],
      ['eventId', null], ['exposureId', null], ['occurredAt', null], ['exposedAt', null], ['exposedAt', 110.123],
      ['occurredAt', 149], ['occurredAt', 501], ['exposedAt', 600], ['eventSessionId', 'fake'], ['originPredictionId', 'fake']] as const) {
      const input = fixture(); labels(input)[0]![key] = value; rejected(input);
    }
    const nonobserved = fixture(); labels(nonobserved)[0]!.status = 'clear'; rejected(nonobserved);
  });

  it('bounds untrusted values and rejects cycles without traversing indefinitely', () => {
    const cyclic = fixture(); cyclic.capture.nested = cyclic.capture; rejected(cyclic);
    const oversized = fixture(); oversized.capture.nested = 'a'.repeat(8_388_609); rejected(oversized);
  });
});
