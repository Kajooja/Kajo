import { describe, expect, it } from 'vitest';
import type { ArtifactVersion, Observation, PredictionObject, PredictionScope, Provenance, TargetDefinition } from '../src/contracts.js';
import { deriveWorkingState, scoreWorkingAdjustment } from '../src/working-state.js';
import type { WorkingControl, WorkingRecord, WorkingState } from '../src/working-state.js';
import { evaluateWorkingBatch, evaluateWorkingPlan, freezeWorkingEvaluationPlan, summarizeWorkingSupport } from '../src/working-evaluation.js';
import type { WorkingEvaluationPlanInput, WorkingFrozenControl, WorkingOutcomeCapture, WorkingOutcomeLabel } from '../src/working-evaluation.js';

// Generated fixtures exercise both observed-shaped and synthetic contracts.
// Their successful assertions are not measured native/external quality evidence.
const source = { kind: 'generator', id: 'working-evaluation-fixture', version: '1', parentRefs: [] } as const;
const scope: PredictionScope = { subject: { id: 'support-subject', kind: 'individual' }, actingIdentityRef: 'support-actor',
  sessionRef: 'support-session', evidence: { sourceIds: [source.id], cohortIds: [], synthetic: 'fixture-only' } };
const target: TargetDefinition = { id: 'ordinal-benefit', version: '1', scale: { min: 0, max: 10 },
  conditioning: 'action-outcome', exposure: 'required', objective: 'maximize' };
const artifact: ArtifactVersion = { id: 'feature-schema', version: '1', representationVersion: 'normalized-1',
  availableAt: 0, trainedThrough: null, sourceRefs: [source.id], use: 'fixture-only' };
const object = (id: string, features: Record<string, number | null> = { warm: 1 }): PredictionObject => ({ id, features, availableAt: 0, artifact });
function row(id: string, item: string, at: number, value: number, features: Record<string, number | null> = { warm: 1 }): WorkingRecord {
  return { kind: 'VALUE', sessionRef: scope.sessionRef, object: object(item, features), observation: {
    subjectId: scope.subject.id, actingIdentityRef: scope.actingIdentityRef, objectId: item, actionId: `history:${id}`, predictionId: null,
    targetId: target.id, targetVersion: target.version, measurement: { status: 'observed', value }, raw: { value, scale: target.scale },
    occurredAt: at, availableAt: at, exposure: 'unknown', access: { kind: 'subject', subjectId: scope.subject.id },
    provenance: { origin: 'synthetic', source, recordId: id, revision: 1 } } };
}
function state(rows: readonly WorkingRecord[] = [row('early', 'one', 10, 0), row('late', 'two', 20, 10)]): WorkingState {
  return deriveWorkingState({ scope, target, asOf: 100, session: { ref: scope.sessionRef, startedAt: 0 },
    prefixComplete: true, featureSchema: { id: 'schema', version: '1', dimensions: ['warm', 'dark'], artifact }, records: rows });
}
function fixture(domain = 'media', channel: 'synthetic' | 'native' | 'external' = 'synthetic') {
  const ordinalTarget: TargetDefinition = { ...target, id: `${domain}:ordinal`, objective: domain === 'maintenance' ? 'minimize' : 'maximize' };
  const planScope: PredictionScope = { ...scope, subject: { id: `${domain}:subject`, kind: domain === 'maintenance' ? 'system' : 'individual' },
    actingIdentityRef: `${domain}:actor`, sessionRef: `${domain}:session` };
  const candidate = (side: string, score: number, rank: number) => ({ objectId: `${domain}:${side}`, score, rank, eligible: true, tier: 0, selected: true });
  const controls = {
    OFF: { id: `${domain}:off`, version: 'frozen-off-1', createdAt: 101, availableAt: 105, availabilityBasis: 'DECLARED_AVAILABLE_TIME' as const,
      candidates: [candidate('left', 1000, 1), candidate('right', 999, 2)] },
    STATIC: { id: `${domain}:static`, version: 'frozen-static-1', createdAt: 102, availableAt: 106, availabilityBasis: 'DECLARED_AVAILABLE_TIME' as const,
      candidates: [candidate('left', 7, 1), candidate('right', 7, 2)] },
    ORDERED: { id: `${domain}:ordered`, version: 'frozen-ordered-1', createdAt: 103, availableAt: 107, availabilityBasis: 'DECLARED_AVAILABLE_TIME' as const,
      candidates: [candidate('left', -200, 2), candidate('right', 42, 1)] },
  };
  const input: WorkingEvaluationPlanInput = { id: `${domain}:plan`, sourcePredictionId: `${domain}:source`, scope: planScope,
    target: ordinalTarget, sourceCutoff: 100, createdAt: 110, availableAt: 120, availabilityBasis: 'DECLARED_AVAILABLE_TIME',
    selectionBasis: 'PREDECLARED_DISJOINT_PAIRS', horizon: { startAt: 100, endAt: 500 },
    versions: { capture: 'frozen-capture-1', features: 'frozen-features-1', scorer: 'frozen-score-1', policy: 'frozen-policy-1' },
    controls, pairs: [{ pairId: `${domain}:pair`, leftObjectId: `${domain}:left`, rightObjectId: `${domain}:right` }],
    working: { status: 'unavailable', reason: 'FROZEN_CANDIDATE_FEATURES_UNAVAILABLE' } };
  const provenance = (recordId: string): Provenance => {
    if (channel === 'synthetic') return { origin: 'synthetic', source, recordId, revision: 1 };
    if (channel === 'native') return { origin: 'observed', source: { kind: 'native', id: source.id }, recordId, revision: 1 };
    return { origin: 'observed', source: { kind: 'external', id: source.id, release: 'research-source-1', manifestId: 'rights-manifest', availability: 'recorded' }, recordId, revision: 1 };
  };
  const label = (side: string, value: number, exposedAt: number): WorkingOutcomeLabel => ({ objectId: `${domain}:${side}`,
    experienceId: `${domain}:${side}:experience`, exposedAt, status: 'observed', observation: {
      subjectId: planScope.subject.id, actingIdentityRef: planScope.actingIdentityRef, objectId: `${domain}:${side}`,
      actionId: `${domain}:${side}:experience`, predictionId: input.sourcePredictionId, targetId: ordinalTarget.id, targetVersion: '1',
      measurement: { status: 'observed', value }, raw: { value, scale: ordinalTarget.scale }, occurredAt: exposedAt + 10, availableAt: exposedAt + 20,
      exposure: 'verified', access: { kind: 'subject', subjectId: planScope.subject.id }, provenance: provenance(`${domain}:${side}:outcome`) } });
  const capture: WorkingOutcomeCapture = { id: `${domain}:capture`, sourcePredictionId: input.sourcePredictionId, subjectId: planScope.subject.id,
    actingIdentityRef: planScope.actingIdentityRef!, sessionRef: planScope.sessionRef,
    revision: 1, createdAt: 550, availableAt: 600, availabilityBasis: channel === 'synthetic' ? 'SYNTHETIC_CLOCK' : 'DECLARED_AVAILABLE_TIME',
    matureAt: 500, complete: true, resolutionVersion: 'terminal-outcome-1',
    labels: [label('left', domain === 'maintenance' ? 10 : 0, 150), label('right', domain === 'maintenance' ? 0 : 10, 250)] };
  return { input, capture };
}
function mapControls(input: Readonly<Record<WorkingControl, WorkingFrozenControl>>, fn: (value: WorkingFrozenControl) => WorkingFrozenControl): Record<WorkingControl, WorkingFrozenControl> {
  return { OFF: fn(input.OFF), STATIC: fn(input.STATIC), ORDERED: fn(input.ORDERED) };
}
const evaluate = (x: ReturnType<typeof fixture>, capture = x.capture) => evaluateWorkingPlan(freezeWorkingEvaluationPlan(x.input), capture, 700);
function observationChange(x: ReturnType<typeof fixture>, change: Partial<Observation>, index = 0): WorkingOutcomeCapture {
  return { ...x.capture, labels: x.capture.labels.map((label, i) => i === index ? { ...label, observation: { ...label.observation!, ...change } } : label) };
}
function unscored(x: ReturnType<typeof fixture>, capture: WorkingOutcomeCapture, reason: string) {
  const report = evaluate(x, capture);
  expect(report.plannedPairUnits).toBe(1);expect(report.unscoredPairUnits).toBe(1);expect(report.pairs[0]!.reasons).toContain(reason);
  for (const control of ['OFF', 'STATIC', 'ORDERED'] as const) expect(report.pairs[0]!.controls[control].agreement).toBe('unscored');
  expect(report.observed.nativePairUnits + report.observed.externalPairUnits + report.synthetic.pairUnits).toBe(0);
}

describe('candidate-specific Item weight concentration without scorer changes', () => {
  it('matches independent static/recency coefficient oracles and leaves the original component exact', () => {
    const working = state(), candidate = object('candidate'), serialized = JSON.stringify(working);
    const staticSupport = summarizeWorkingSupport(working, candidate, 'STATIC');
    expect(staticSupport.coefficients.map(row => row.weight)).toEqual([0.5, 0.5]);expect(staticSupport.effectiveItems).toBe(2);
    const r = Math.SQRT1_2, ordered = summarizeWorkingSupport(working, candidate, 'ORDERED');
    expect(ordered.coefficients[0]!.weight).toBeCloseTo(r / (r + 1), 12);
    expect(ordered.coefficients[1]!.weight).toBeCloseTo(1 / (r + 1), 12);
    expect(ordered.effectiveItems).toBeCloseTo((1 + r) ** 2 / (1 + r ** 2), 12);
    expect(ordered.contributingTimeGroups).toBe(2);expect(ordered.featureCoverage).toBe(1);
    expect(scoreWorkingAdjustment({ state: working, object: candidate, control: 'ORDERED' }).value).toBeCloseTo(0.25 * (1 - r) / (1 + r), 12);
    expect(JSON.stringify(working)).toBe(serialized);expect(Object.isFrozen(ordered.coefficients[0])).toBe(true);
  });
  it('collapses tags and duplicate/corrected records onto each actual Item before squaring', () => {
    const first = row('one', 'one', 10, 10, { warm: 1, dark: 1 });
    const working = state([first, first, row('one-again', 'one', 15, 0, { warm: 1, dark: 1 }), row('two', 'two', 20, 10)]);
    const joint = summarizeWorkingSupport(working, object('joint', { warm: 1, dark: 1 }), 'STATIC');
    expect(joint.coefficients.map(row => row.weight)).toEqual([0.75, 0.25]);expect(joint.effectiveItems).toBe(1.6);
    const oneFeature = summarizeWorkingSupport(working, object('dark-only', { dark: 1 }), 'ORDERED');
    expect(oneFeature.contributingItems).toBe(1);expect(oneFeature.effectiveItems).toBe(1);
    expect(oneFeature.interpretation).toBe('ITEM_WEIGHT_CONCENTRATION_NOT_OUTCOME_SAMPLE_SIZE');
  });
  it('reports coverage separately and returns zero for OFF, unavailable features and inactive/reset/expired states', () => {
    const working = state();const partial = summarizeWorkingSupport(working, object('partial', { warm: 1, dark: 1 }), 'STATIC');
    expect(partial.featureCoverage).toBe(0.5);expect(partial.weightSum).toBe(0.5);expect(partial.effectiveItems).toBe(2);
    for (const [input, candidate, control] of [[working, object('off'), 'OFF'], [working, object('missing', { dark: 1 }), 'ORDERED'],
      [deriveWorkingState({ ...working, resetAt: 99 }), object('reset'), 'ORDERED'],
      [deriveWorkingState({ ...working, asOf: 4 * 60 * 60_000 }), object('expired'), 'STATIC']] as const) {
      const result = summarizeWorkingSupport(input, candidate, control);expect(result.effectiveItems).toBe(0);expect(result.coefficients).toEqual([]);
    }
    expect(() => summarizeWorkingSupport({ ...working, vectors: { ...working.vectors, static: { warm: 99 } } }, object('bad'), 'STATIC')).toThrow('frozen prefix');
    expect(() => summarizeWorkingSupport(working, { ...object('future'), availableAt: 101 }, 'OFF')).toThrow('unavailable');
  });
  it('equal-time Items retain equal weights regardless of array/record identity ordering', () => {
    const one = row('z', 'one', 10, 0), two = row('a', 'two', 10, 10);
    expect(summarizeWorkingSupport(state([one, two]), object('candidate'), 'ORDERED').effectiveItems).toBe(2);
    expect(summarizeWorkingSupport(state([two, one]), object('candidate'), 'ORDERED').coefficients)
      .toEqual(summarizeWorkingSupport(state([one, two]), object('candidate'), 'ORDERED').coefficients);
  });
  it('ignores inherited prototype values for valid omitted feature dimensions in support and frozen plans', () => {
    const original = state();const working = deriveWorkingState({ ...original,
      featureSchema: { ...original.featureSchema, dimensions: ['constructor', 'toString', '__proto__', 'warm'] },
      records: [row('early', 'one', 10, 0), row('late', 'two', 20, 10)] });
    const candidate = object('media:left');
    expect(scoreWorkingAdjustment({ state: working, object: candidate, control: 'ORDERED' }).reason).toBe('ADJUSTED');
    const support = summarizeWorkingSupport(working, candidate, 'ORDERED');
    expect(support.reason).toBe('SUPPORTED');expect(support.weightSum).toBeCloseTo(1, 12);expect(support.effectiveItems).toBeGreaterThan(1);
    const x = fixture();const plan = freezeWorkingEvaluationPlan({ ...x.input, scope: working.scope, target: working.target,
      working: { status: 'available', state: working, objects: [candidate, object('media:right')] } });
    if (plan.working.status !== 'available') throw new Error('Expected complete Working fixture');
    expect(plan.working.objects[0]!.features).toEqual(Object.fromEntries([['constructor', null], ['toString', null], ['__proto__', null], ['warm', 1]]));
    for (const key of ['constructor', 'toString', '__proto__']) {
      expect(Object.hasOwn(plan.working.objects[0]!.features, key)).toBe(true);expect(plan.working.objects[0]!.features[key]).toBeNull();
    }
    expect(freezeWorkingEvaluationPlan(plan)).toEqual(plan);
  });
});

describe('immutable preregistered frozen control plans', () => {
  it('preserves every supplied native/generic score rather than reconstructing baseline plus adjustment', () => {
    const x = fixture(), before = JSON.stringify(x), plan = freezeWorkingEvaluationPlan(x.input);
    expect(plan.controls.OFF.candidates[0]!.score).toBe(1000);expect(plan.controls.ORDERED.candidates[0]!.score).toBe(-200);
    expect(plan.controls.STATIC.candidates.map(row => row.rank)).toEqual([1, 2]);expect(plan.support).toBeNull();
    expect(plan.controls.ORDERED.createdAt).toBe(103);expect(plan.sourceCutoff).toBe(100);expect(plan.availableAt).toBe(120);
    expect(Object.isFrozen(plan.controls.ORDERED.candidates[0])).toBe(true);expect(JSON.stringify(x)).toBe(before);
    expect(Object.isFrozen(x.input)).toBe(false);
    Reflect.set(x.input.controls.OFF.candidates[0]!, 'score', 123);
    expect(plan.controls.OFF.candidates[0]!.score).toBe(1000);
  });
  it('supports complete generic frozen feature state while native unavailable diagnostics stay explicit', () => {
    const x = fixture();const working = state();
    const input = { ...x.input, scope: working.scope, target: working.target, working: { status: 'available' as const, state: working,
      objects: [object('media:left'), object('media:right', { dark: 1 })] } };
    const plan = freezeWorkingEvaluationPlan(input);expect(plan.support!.ORDERED[0]!.effectiveItems).toBeGreaterThan(1);
    expect(plan.support!.ORDERED[1]!.effectiveItems).toBe(0);expect(plan.support!.OFF.every(row => row.effectiveItems === 0)).toBe(true);
  });
  it('does not collapse control artifact clocks into source cutoff; stored-time proxies may predate the cutoff', () => {
    const x = fixture('media', 'native');const input = { ...x.input, controls: { ...x.input.controls,
      ORDERED: { ...x.input.controls.ORDERED, createdAt: 90, availableAt: 95, availabilityBasis: 'STORED_CREATED_TIME' as const } } };
    const report = evaluateWorkingPlan(freezeWorkingEvaluationPlan(input), x.capture, 700);
    expect(report.comparablePairUnits).toBe(1);expect(report.pairs[0]!.prospectiveDeclaredEligibility).toBe(false);
    expect(report.plan.controls.ORDERED.availableAt).toBe(95);
    expect(() => freezeWorkingEvaluationPlan({ ...input, controls: { ...input.controls, ORDERED: { ...input.controls.ORDERED, availableAt: 121 } } })).toThrow('unavailable');
  });
  it('rejects mismatched pools/eligibility/tier, contradictory score ranks, repeated or evaluation-time-selected pairs and unsafe clocks', () => {
    const x = fixture();
    for (const candidateChange of [{ objectId: 'foreign' }, { tier: 1 }, { eligible: false, selected: false }, { rank: 1 }, { score: 10000 }]) {
      const control = { ...x.input.controls.ORDERED, candidates: x.input.controls.ORDERED.candidates.map((candidate, i) => i === 0 ? { ...candidate, ...candidateChange } : candidate) };
      expect(() => freezeWorkingEvaluationPlan({ ...x.input, controls: { ...x.input.controls, ORDERED: control } })).toThrow();
    }
    expect(() => freezeWorkingEvaluationPlan({ ...x.input, pairs: [...x.input.pairs, { ...x.input.pairs[0]!, pairId: 'another' }] })).toThrow('disjoint');
    expect(() => freezeWorkingEvaluationPlan({ ...x.input, pairs: [{ pairId: 'foreign', leftObjectId: 'unplanned', rightObjectId: 'media:right' }] })).toThrow('disjoint');
    expect(() => freezeWorkingEvaluationPlan({ ...x.input, sourceCutoff: 130 })).toThrow('clock');
    expect(() => freezeWorkingEvaluationPlan({ ...x.input, horizon: { startAt: 99, endAt: 500 } })).toThrow('horizon');
    expect(() => freezeWorkingEvaluationPlan({ ...x.input, versions: { ...x.input.versions, scorer: '' } })).toThrow('versions');
    expect(() => freezeWorkingEvaluationPlan({ ...x.input, controls: { ...x.input.controls, ORDERED: { ...x.input.controls.ORDERED, id: x.input.controls.OFF.id } } })).toThrow('control identity');
  });
  it('requires all version fields as own keys and retains only bounded whitelisted source provenance', () => {
    const x = fixture();const inherited = Object.assign(Object.create({ capture: 'hidden-version' }),
      { features: 'feature-1', scorer: 'score-1', policy: 'policy-1', unexpected: 'extra' });
    expect(() => freezeWorkingEvaluationPlan({ ...x.input, versions: inherited })).toThrow('versions');
    const binding = { kind: 'domain-native', captureRef: 'capture-ref', modelVersion: 'model-1', baseModelVersion: 'base-1',
      mode: 'standard', objectType: 'object', requestedAt: 105, storedSourceCreatedAt: 90, snapshotObservedAt: 108,
      commitAvailability: 'UNKNOWN' as const, historicalFeatureEligible: false as const };
    const plan = freezeWorkingEvaluationPlan({ ...x.input, sourceBinding: Object.assign({}, binding, { ignored: 'private-extra' }) });
    expect(plan.sourceBinding).toEqual(binding);expect(freezeWorkingEvaluationPlan(plan)).toEqual(plan);
    expect(() => freezeWorkingEvaluationPlan({ ...x.input, sourceBinding: { ...binding, snapshotObservedAt: 111 } })).toThrow('source binding');
  });
});

describe('shared directional mask from immutable mature terminal captures', () => {
  it.each(['media', 'maintenance'])('compares %s ordinal targets and keeps synthetic evidence out of every observed denominator', domain => {
    const report = evaluate(fixture(domain));expect(report.comparablePairUnits).toBe(1);
    expect(report.pairs[0]!.controls).toEqual({ OFF: { order: 'left', agreement: 'disagreement' }, STATIC: { order: 'tie', agreement: 'tie' },
      ORDERED: { order: 'right', agreement: 'agreement' } });
    expect(report.observed.nativePairUnits + report.observed.externalPairUnits).toBe(0);expect(report.synthetic.pairUnits).toBe(1);
    expect(report.pairs[0]!.prospectiveDeclaredEligibility).toBe(false);
    expect(report.historicalFeatureEligible || report.learnable || report.nativeActivated || report.qualityAdmitted).toBe(false);
    expect(report.independence).toBe('not-established');expect(report.uncertainty).toBe('unavailable');
  });
  it.each(['native', 'external'] as const)('separates %s-shaped observed channels and descriptive paired transitions', channel => {
    const report = evaluate(fixture('media', channel));expect(report.observed.nativePairUnits).toBe(channel === 'native' ? 1 : 0);
    expect(report.observed.externalPairUnits).toBe(channel === 'external' ? 1 : 0);expect(report.synthetic.pairUnits).toBe(0);
    expect(report.transitions.observedOrderedVsOff['disagreement->agreement']).toBe(1);
    expect(report.transitions.observedOrderedVsStatic['tie->agreement']).toBe(1);
    expect(report.pairs[0]!.prospectiveDeclaredEligibility).toBe(true);expect(report.descriptiveOnly).toBe(true);
  });
  it.each(['unknown', 'clear', 'missing', 'undone'] as const)('a reconciled %s response abstains on all three controls', status => {
    const x = fixture();unscored(x, { ...x.capture, labels: [{ ...x.capture.labels[0]!, status, observation: null }, x.capture.labels[1]!] },
      status === 'unknown' ? 'unknown-label' : status === 'clear' ? 'cleared-label' : status === 'undone' ? 'undone-label' : 'missing-label');
  });
  it('frozen old results remain exact when later corrections/clear/UNDO become available', () => {
    const x = fixture(), plan = freezeWorkingEvaluationPlan(x.input), before = evaluateWorkingPlan(plan, x.capture, 700), serialized = JSON.stringify(before);
    const corrected = observationChange(x, { measurement: { status: 'observed', value: 10 }, raw: { value: 10, scale: target.scale },
      provenance: { ...x.capture.labels[0]!.observation!.provenance, revision: 2 } });
    const newCapture = { ...corrected, id: 'later-capture', revision: 2, createdAt: 710, availableAt: 720 };
    unscored(x, newCapture, 'capture-unavailable');
    expect(evaluateWorkingPlan(plan, newCapture, 730).pairs[0]!.reasons).toContain('all-tied');
    const cleared = { ...newCapture, id: 'cleared-capture', labels: [{ ...newCapture.labels[0]!, status: 'undone' as const, observation: null }, newCapture.labels[1]!] };
    expect(evaluateWorkingPlan(plan, cleared, 730).pairs[0]!.reasons).toContain('undone-label');
    expect(JSON.stringify(before)).toBe(serialized);expect(evaluateWorkingPlan(plan, x.capture, 700)).toEqual(before);
  });
  it('abstains on horizon/exposure/maturity/time edges and source context mismatches', () => {
    const x = fixture();
    for (const [capture, reason] of [
      [{ ...x.capture, complete: false }, 'incomplete-capture'], [{ ...x.capture, availableAt: 701 }, 'capture-unavailable'],
      [{ ...x.capture, matureAt: 701 }, 'immature-window'], [{ ...x.capture, createdAt: 499 }, 'capture-before-maturity'],
      [{ ...x.capture, sourcePredictionId: 'foreign-source' }, 'capture-scope-mismatch'], [{ ...x.capture, sessionRef: 'other-session' }, 'capture-scope-mismatch'],
      [{ ...x.capture, labels: [] }, 'missing-label'], [observationChange(x, { availableAt: 159 }), 'malformed-capture'],
      [observationChange(x, { exposure: 'unknown' }), 'unverified-exposure'], [observationChange(x, { predictionId: 'other' }), 'prediction-mismatch'],
      [observationChange(x, { actionId: 'other' }), 'experience-mismatch'], [observationChange(x, { subjectId: 'other' }), 'scope-or-source'],
      [observationChange(x, { actingIdentityRef: 'other' }), 'scope-or-source'], [observationChange(x, { targetVersion: '2' }), 'incompatible-target'],
      [observationChange(x, { raw: { value: 0, scale: { min: 1, max: 10 } } }), 'incompatible-scale'],
      [observationChange(x, { occurredAt: 501, availableAt: 501 }), 'outside-horizon'],
      [observationChange(x, { measurement: undefined } as unknown as Partial<Observation>), 'unknown-label'],
    ] as const) unscored(x, capture, reason);
    unscored(x, { ...x.capture, labels: [{ ...x.capture.labels[0]!, exposedAt: 120 }, x.capture.labels[1]!] }, 'late-plan');
    unscored(x, observationChange(x, { occurredAt: 100, availableAt: 100 }), 'outcome-not-later');
    const edge = observationChange(x, { occurredAt: 500, availableAt: 500 });expect(evaluate(x, edge).comparablePairUnits).toBe(1);
  });
  it.each([['censored', 'censored-label'], ['immature', 'immature-label'], ['unexposed', 'unverified-exposure'], ['unknown', 'unknown-label']] as const)(
    'retains %s missing-label coverage rather than silently treating it as a zero or generic rejection', (missing, reason) => {
      const x = fixture();unscored(x, observationChange(x, { measurement: { status: 'missing', reason: missing }, raw: { value: null, scale: target.scale } }), reason);
    });
  it('rejects synthetic capture clocks masquerading as observed labels and assumed external prospective availability', () => {
    const x = fixture('media', 'native');unscored(x, { ...x.capture, availabilityBasis: 'SYNTHETIC_CLOCK' }, 'synthetic-plan');
    const external = fixture('media', 'external'), observation = external.capture.labels[0]!.observation!;
    const p = observation.provenance;
    if (p.origin === 'observed' && p.source.kind === 'external') {
      const report = evaluate(external, observationChange(external, { provenance: { ...p, source: { ...p.source, availability: 'assumed-at-occurrence' } } }));
      expect(report.comparablePairUnits).toBe(1);expect(report.pairs[0]!.prospectiveDeclaredEligibility).toBe(false);
    }
  });
  it('OFF selection and same frozen delivery tier define eligibility without control-dependent label selection', () => {
    for (const [change, reason] of [[{ selected: false }, 'not-off-selected'], [{ eligible: false, selected: false }, 'policy-ineligible'], [{ tier: 1 }, 'different-tier']] as const) {
      const x = fixture();const controls = mapControls(x.input.controls, value =>
        ({ ...value, candidates: value.candidates.map((candidate, i) => i === 1 ? { ...candidate, ...change } : candidate) }));
      // Restore valid tier-first rank order for all controls when testing the policy mask.
      if ('tier' in change) for (const name of ['OFF', 'STATIC', 'ORDERED'] as const) controls[name] = { ...controls[name], candidates: controls[name].candidates.map((candidate, i) => ({ ...candidate, rank: i + 1 })) };
      unscored({ ...x, input: { ...x.input, controls } }, x.capture, reason);
    }
  });
});

function fourPairFixture() {
  const x = fixture();const newPair = { pairId: 'second-pair', leftObjectId: 'third', rightObjectId: 'fourth' };
  const controls = mapControls(x.input.controls, value => ({ ...value, candidates: [...value.candidates,
    { objectId: 'third', score: -1000, rank: 3, eligible: true, tier: 0, selected: true },
    { objectId: 'fourth', score: -1001, rank: 4, eligible: true, tier: 0, selected: true }] }));
  const labels = ['third', 'fourth'].map((objectId, index) => { const old = x.capture.labels[index]!;return { ...old, objectId, experienceId: `${objectId}:experience`,
    observation: { ...old.observation!, objectId, actionId: `${objectId}:experience`, provenance: { ...old.observation!.provenance, recordId: `${objectId}:outcome` } } }; });
  return { input: { ...x.input, controls, pairs: [...x.input.pairs, newPair] }, capture: { ...x.capture, labels: [...x.capture.labels, ...labels] } };
}
describe('planned denominators and bounded nonoverlapping evidence units', () => {
  it('direct plan API cannot inflate support by replaying a source record revision or experience across disjoint pairs', () => {
    const x = fourPairFixture();expect(evaluate(x).plannedPairUnits).toBe(2);expect(evaluate(x).comparablePairUnits).toBe(2);
    for (const copyExperience of [false, true]) {
      const first = x.capture.labels[0]!, third = x.capture.labels[2]!;
      const repeated = copyExperience ? { ...third, experienceId: first.experienceId }
        : { ...third, observation: { ...third.observation!, provenance: { ...first.observation!.provenance, revision: 2 } } };
      const report = evaluate(x, { ...x.capture, labels: [first, x.capture.labels[1]!, repeated, x.capture.labels[3]!] });
      expect(report.plannedPairUnits).toBe(2);expect(report.comparablePairUnits).toBe(0);
      expect(report.pairs.every(pair => pair.reasons.includes(copyExperience ? 'same-experience' : 'duplicate-observation'))).toBe(true);
    }
  });
  it('counts subject/session clusters and rejects reused anchors, pairs, object pairs, experiences and underlying labels ignoring revision', () => {
    const one = fixture('media'), two = fixture('maintenance');
    const input = (x: ReturnType<typeof fixture>) => ({ plan: freezeWorkingEvaluationPlan(x.input), capture: x.capture, evaluationAsOf: 700 });
    const batch = evaluateWorkingBatch([input(one), input(two)]);expect(batch.plannedPairUnits).toBe(2);expect(batch.syntheticPairUnits).toBe(2);
    expect(batch.observedNativePairUnits + batch.observedExternalPairUnits).toBe(0);expect(batch.clusters).toEqual({ subjects: 2, subjectSessions: 2, observedSubjects: 0, observedSubjectSessions: 0 });
    expect(() => evaluateWorkingBatch([input(one), input(one)])).toThrow('reuses');
    for (const repeated of [
      { ...two, input: { ...two.input, sourcePredictionId: one.input.sourcePredictionId } },
      { ...two, input: { ...two.input, pairs: [{ ...two.input.pairs[0]!, pairId: one.input.pairs[0]!.pairId }] } },
      { ...two, capture: { ...two.capture, labels: [{ ...two.capture.labels[0]!, experienceId: one.capture.labels[0]!.experienceId }, two.capture.labels[1]!] } },
      { ...two, capture: observationChange(two, { provenance: { ...one.capture.labels[0]!.observation!.provenance, revision: 2 } }) },
    ]) expect(() => evaluateWorkingBatch([input(one), input(repeated)])).toThrow('reuses');
    expect(evaluateWorkingBatch([]).plannedPairUnits).toBe(0);
  });
  it('rejects byte-safe bounded cardinality overflow before evaluation and preserves empty planned denominators', () => {
    const x = fixture(), one = { plan: freezeWorkingEvaluationPlan(x.input), capture: x.capture, evaluationAsOf: 700 };
    expect(() => evaluateWorkingBatch(Array.from({ length: 129 }, () => one))).toThrow('plan budget');
    const deliberatelyMalformed = { ...one, plan: { ...one.plan, pairs: Array.from({ length: 129 }, () => one.plan.pairs[0]!) } };
    expect(() => evaluateWorkingBatch([deliberatelyMalformed])).toThrow('pair budget');
    expect(() => freezeWorkingEvaluationPlan({ ...x.input, pairs: Array.from({ length: 26 }, () => x.input.pairs[0]!) })).toThrow('pair budget');
    const tooLarge = { ...x.capture, labels: Array.from({ length: 51 }, () => x.capture.labels[0]!) };unscored(x, tooLarge, 'malformed-capture');
    const empty = evaluateWorkingPlan(freezeWorkingEvaluationPlan({ ...x.input, pairs: [] }), x.capture, 700);
    expect(empty.plannedPairUnits).toBe(0);expect(empty.comparablePairUnits).toBe(0);expect(empty.observed.nativePairUnits + empty.synthetic.pairUnits).toBe(0);
  });
});
