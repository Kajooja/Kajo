import { describe, expect, it } from 'vitest';
import { buildPersonalRatingEvaluationReport as report, validatePersonalRatingEvaluationDeclaration as validate } from '../src/personal-rating-evaluation.js';
import type { PersonalRatingEvaluationDeclaration as Declaration, PersonalRatingEvaluationInventory as Inventory,
  PersonalRatingEvaluationOpportunity as Opportunity, PersonalRatingEvaluationRequirements as Requirements } from '../src/personal-rating-evaluation.js';

const base = 1793500000000000n;
const time = (seconds: number, extra = 0n) => (base + BigInt(seconds) * 1000000n + extra).toString();
const declaration = (extra: Partial<Declaration> = {}): Declaration => ({
  version: 'personal-rating-evaluation-declaration-v1', cohortId: 'numeric:cohort', createdAtMicros: time(0), origin: 'synthetic',
  roster: ['profile:a', 'profile:b', 'profile:zero'], domains: ['BOOK', 'MOVIE'],
  target: 'FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN', scale: { min: 0, max: 10 },
  sourceVersions: { source: 'resolver:v1', model: 'mean:v1', control: 'personal-mean:v1' }, targetSelection: 'FIRST_DELIVERED_ITEM',
  captureWindow: { startMicros: time(10), endMicros: time(90) }, horizonSeconds: 10, cohortCap: 256,
  windows: { DEVELOPMENT: { startMicros: time(10), endMicros: time(30) },
    SELECTION: { startMicros: time(40), endMicros: time(60) }, FINAL: { startMicros: time(70), endMicros: time(90) } },
  dataRole: 'DEVELOPMENT', checkpointsMicros: [time(11), time(12), time(21), time(21, 1n), time(39)], requirements: null, ...extra,
});
const opportunity = (id: string, extra: Partial<Opportunity> = {}): Opportunity => ({
  opportunityId: `opportunity:${id}`, subjectId: 'profile:a', domainId: 'BOOK', objectId: `object:${id}`,
  captureStatus: 'AVAILABLE', opportunityAtMicros: time(11), horizonEndMicros: time(21), prefixSupport: 2,
  forecasts: { candidate: 7, control: 7 }, firstAnswer: { rating: 0, acceptedAtMicros: time(12) }, currentRating: 0, ...extra,
});
const unavailable = (id: string, status: Opportunity['captureStatus']): Opportunity => opportunity(id, {
  captureStatus: status, horizonEndMicros: null, prefixSupport: null, forecasts: null, firstAnswer: null, currentRating: null,
});
const inventory = (rows: readonly Opportunity[], extra: Partial<Inventory> = {}): Inventory => ({
  version: 'personal-rating-evaluation-inventory-v1', origin: 'synthetic', observedAtMicros: time(100), observedThroughMicros: time(100), complete: true,
  opportunities: rows, ...extra,
});
const requirements = (): Requirements => ({
  acceptance: { primaryMetric: 'PROFILE_MACRO_MSE', minimumUsefulImprovement: 0.2, noninferiorityMargin: 0.1 },
  coverage: { minimumProfiles: 1, minimumNumericLabels: 1, minimumForecastCoverage: 0.8, minimumOutcomeCoverage: 0.7,
    minimumPairedCoverage: 0.6 },
  precision: { method: 'PROFILE_CLUSTER_BOOTSTRAP', intervalLevel: 0.95, maximumIntervalWidth: 0.5,
    rule: 'Profile-cluster uncertainty must be assessed in a separately implemented statistical evaluation.' },
  resources: { p50Ms: 20, p95Ms: 60, maxRssMiB: 64 },
  domainGuardrails: ['BOOK', 'MOVIE'].map(domainId => ({ domainId, minimumForecastCoverage: 0.8,
    minimumOutcomeCoverage: 0.7, maximumDeltaMse: 0.1 })),
  dependence: 'Profile cluster; repeated Item dependence retained and assessed separately.', searchBudget: 2,
  thresholdRationale: 'Synthetic requirement fixture; not an operational quality threshold.', developmentEvidenceRef: 'development:fixture',
  selectedAtMicros: time(65), untouchedFinalWindow: true,
});
const finalDeclaration = (extra: Partial<Declaration> = {}): Declaration => declaration({ dataRole: 'FINAL',
  createdAtMicros: time(66), checkpointsMicros: [time(95)], requirements: requirements(), ...extra });

describe('declared Personal numeric evaluation', () => {
  it('weights Profiles equally, keeps zero-opportunity Profiles and takes sqrt after macro MSE', () => {
    const prolific = Array.from({ length: 100 }, (_, index) => opportunity(`a${index}`, {
      forecasts: { candidate: 0, control: 0 }, firstAnswer: { rating: 0, acceptedAtMicros: time(12) },
    }));
    const sparse = opportunity('b', { subjectId: 'profile:b', forecasts: { candidate: 10, control: 10 } });
    const result = report(declaration(), inventory([...prolific, sparse]), time(39));
    expect(result.macro.candidate).toEqual({ profiles: 2, mse: 50, rmse: Math.sqrt(50), mae: 5, bias: 5 });
    expect(result.macro.candidate.mse).not.toBe(100 / 101);
    expect(result.macro.candidate.rmse).not.toBe(5);
    expect(result.counts).toMatchObject({ declaredProfiles: 3, participatingProfiles: 2, firstAnswers: 101 });
    expect(result.byProfile.find(row => row.subjectId === 'profile:zero')).toMatchObject({ opportunities: 0,
      candidate: { count: 0, mse: null, mae: null, bias: null, rmse: null } });
  });

  it('evaluates every integer grade 0–10 without bucketing, rounding or substituting missing answers', () => {
    const rows = Array.from({ length: 11 }, (_, rating) => opportunity(`grade${rating}`, {
      forecasts: { candidate: 5, control: 5 }, firstAnswer: { rating, acceptedAtMicros: time(12) }, currentRating: rating,
    }));
    const result = report(declaration(), inventory(rows), time(39));
    expect(result.counts.firstAnswers).toBe(11);
    expect(result.macro.candidate).toEqual({ profiles: 1, mse: 10, rmse: Math.sqrt(10), mae: 30 / 11, bias: 0 });
    expect(result.macro.paired.deltaMse).toBe(0);
    expect(result.qualityAdmission).toBe('NONE');
  });

  it('pairs models on identical targets rather than subtracting incomparable available-target averages', () => {
    const rows = [opportunity('paired', { forecasts: { candidate: 6, control: 8 }, firstAnswer: { rating: 4, acceptedAtMicros: time(12) } }),
      opportunity('candidate-only', { forecasts: { candidate: 10, control: null } }),
      opportunity('control-only', { subjectId: 'profile:b', forecasts: { candidate: null, control: 0 } })];
    const result = report(declaration(), inventory(rows), time(39));
    expect(result.macro.candidate.mse).toBe(52);
    expect(result.macro.control.mse).toBe(8);
    expect(result.macro.paired).toEqual({ profiles: 1, candidateMse: 4, controlMse: 16, deltaMse: -12 });
    expect(result.coverage).toEqual({ candidateForecast: 2 / 3, controlForecast: 2 / 3, outcome: 1, paired: 1 / 3 });
  });

  it('uses immutable microsecond cutoffs: later supplied answers cannot remove an earlier pending status', () => {
    const row = opportunity('answer-at-horizon', { firstAnswer: { rating: 8, acceptedAtMicros: time(21) }, currentRating: 8 });
    const data = inventory([row]);
    const before = report(declaration(), data, time(12));
    expect(before.counts).toMatchObject({ pendingFirstReports: 1, firstAnswers: 0, unansweredExpired: 0 });
    expect(before.macro.candidate.mse).toBeNull();
    const atHorizon = report(declaration(), data, time(21));
    expect(atHorizon.counts).toMatchObject({ pendingFirstReports: 0, firstAnswers: 1 });
    expect(atHorizon.macro.candidate.mse).toBe(1);
    const unanswered = inventory([opportunity('unanswered', { firstAnswer: null, currentRating: null })]);
    expect(report(declaration(), unanswered, time(21)).counts.pendingFirstReports).toBe(1);
    expect(report(declaration(), unanswered, time(21, 1n)).counts.unansweredExpired).toBe(1);
  });

  it('keeps missing capture, unattempted, unavailable forecast and unanswered follow-up as separate coverage', () => {
    const rows = [unavailable('failed', 'CAPTURE_UNAVAILABLE'), unavailable('unattempted', 'NOT_ATTEMPTED'),
      opportunity('cold', { prefixSupport: 0, forecasts: { candidate: null, control: null } }),
      opportunity('no-answer', { firstAnswer: null, currentRating: null })];
    const result = report(declaration(), inventory(rows), time(39));
    expect(result.counts).toMatchObject({ opportunities: 4, availableCaptures: 2, firstAnswers: 1,
      candidateForecastUnavailable: 1, unansweredExpired: 1, pairedNumericLabels: 0,
      captureStatuses: { CAPTURE_UNAVAILABLE: 1, NOT_ATTEMPTED: 1 } });
    expect(result.coverage).toEqual({ candidateForecast: 1 / 4, controlForecast: 1 / 4, outcome: 1 / 4, paired: 0 });
    expect(result.macro.candidate.mse).toBeNull();
  });

  it('retains other roles and future opportunities in inventory without leaking them into active metrics', () => {
    const rows = [opportunity('current'), opportunity('future', { opportunityAtMicros: time(13), horizonEndMicros: time(23),
      firstAnswer: { rating: 10, acceptedAtMicros: time(14) }, currentRating: 10 }),
    opportunity('selection', { opportunityAtMicros: time(41), horizonEndMicros: time(51),
      firstAnswer: { rating: 10, acceptedAtMicros: time(42) }, currentRating: 10 })];
    const result = report(declaration(), inventory(rows), time(12));
    expect(result.inventory).toMatchObject({ suppliedOpportunities: 3, outsideActiveRole: 1, afterCheckpoint: 1 });
    expect(result.counts).toMatchObject({ opportunities: 1, firstAnswers: 1 });
    expect(result.macro.candidate.mse).toBe(49);
  });

  it('withdrawal invalidates the entire cohort, including a historical checkpoint', () => {
    const removed = unavailable('withdrawn', 'SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT');
    const result = report(declaration(), inventory([opportunity('retained'), removed]), time(12));
    expect(result.status).toBe('INVALIDATED_SOURCE_WITHDRAWAL');
    expect(result.counts.firstAnswers).toBe(1);
    expect(result.counts.captureStatuses.SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT).toBe(1);
    expect(result.macro.candidate.mse).toBeNull();
    expect(result.byProfile.every(row => row.candidate.mse === null && row.paired.deltaMse === null)).toBe(true);
    expect(result.byDomain.every(row => row.macro.candidate.mse === null)).toBe(true);
    expect(result.macro.candidate.profiles).toBe(1);
    expect(result.counts.scoredProfiles).toEqual({ candidate: 1, control: 1, paired: 1 });
  });

  it('missing expected IDs and an incomplete census cannot become survivor-only metric cohorts', () => {
    for (const data of [inventory([opportunity('good')], { complete: false }),
      inventory([opportunity('good'), unavailable('missing', 'MISSING_EXPECTED_CAPTURE')])]) {
      const result = report(declaration(), data, time(39));
      expect(result.status).toBe('INCOMPLETE_INVENTORY');
      expect(result.inventory.complete).toBe(false);
      expect(result.macro.paired.deltaMse).toBeNull();
    }
  });

  it('scores the first answer after correction or clear and treats current state only as a diagnostic', () => {
    for (const currentRating of [9, null]) {
      const result = report(declaration(), inventory([opportunity('corrected', { currentRating })]), time(39));
      expect(result.macro.candidate).toMatchObject({ mse: 49, mae: 7, bias: 7 });
      expect(result.counts.currentRatingDifferentOrAbsent).toBe(1);
      expect(result.currentStateBasis).toBe('INVENTORY_OBSERVATION_NOT_HISTORICAL_CHECKPOINT');
    }
  });

  it('leaves zero denominators unavailable and retains domain and support diagnostics without invented rating styles', () => {
    const empty = report(declaration(), inventory([]), time(39));
    expect(empty.coverage).toEqual({ candidateForecast: null, controlForecast: null, outcome: null, paired: null });
    expect(empty.byProfile).toHaveLength(3);
    expect(empty.byDomain).toHaveLength(2);
    const result = report(declaration(), inventory([opportunity('one'), opportunity('cold', { domainId: 'MOVIE', prefixSupport: 0,
      forecasts: { candidate: null, control: null } })]), time(39));
    expect(result.byPrefixSupport.map(row => row.prefixSupport)).toEqual([0, 2]);
    expect(result.byDomain.find(row => row.domainId === 'MOVIE')!.counts.firstAnswers).toBe(1);
    expect(result.ratingStyle).toBe('UNIDENTIFIED_NO_PSYCHOLOGICAL_SCALE_INFERENCE');
  });

  it('shows per-Profile abstention and macro coverage so a prolific Profile cannot hide another missing all forecasts', () => {
    const rows = Array.from({ length: 10 }, (_, index) => opportunity(`active${index}`));
    rows.push(unavailable('sparse', 'CAPTURE_UNAVAILABLE'));
    rows[10] = { ...rows[10]!, subjectId: 'profile:b' };
    const result = report(declaration(), inventory(rows), time(39));
    expect(result.coverage.candidateForecast).toBe(10 / 11);
    expect(result.macroCoverage).toMatchObject({ profiles: 2, candidateForecast: 0.5, outcome: 0.5, paired: 0.5 });
    expect(result.byProfile.find(row => row.subjectId === 'profile:b')).toMatchObject({ opportunities: 1,
      candidateForecasts: 0, controlForecasts: 0, firstAnswers: 0, pairedNumericLabels: 0,
      coverage: { candidateForecast: 0, controlForecast: 0, outcome: 0, paired: 0 } });
    expect(result.byProfile.find(row => row.subjectId === 'profile:zero')!.coverage.paired).toBeNull();
  });

  it('requires every present owner snapshot to have reached the requested historical checkpoint', () => {
    const source = inventory([opportunity('pending', { firstAnswer: null, currentRating: null })], {
      observedAtMicros: time(100), observedThroughMicros: time(12),
    });
    expect(report(declaration(), source, time(12)).counts.pendingFirstReports).toBe(1);
    expect(() => report(declaration(), source, time(39))).toThrow('CHECKPOINT_NOT_OBSERVED');
    expect(() => report(declaration(), { ...source, observedThroughMicros: time(101) }, time(12)))
      .toThrow('INVENTORY_OBSERVATION_ORDER');
  });

  it('requires complete preselected final requirements but never claims computed precision, resources or admission', () => {
    expect(() => validate(finalDeclaration({ requirements: null }))).toThrow('FINAL_REQUIREMENTS_MISSING');
    const source = opportunity('final', { opportunityAtMicros: time(71), horizonEndMicros: time(81),
      firstAnswer: { rating: 7, acceptedAtMicros: time(72) }, currentRating: 7 });
    const result = report(finalDeclaration(), inventory([source]), time(95));
    expect(result.requirementsCompliance).toMatchObject({ status: 'DECLARED_VALUES_AND_DESCRIPTIVE_CHECKS_ONLY',
      primaryDecision: 'NOT_EVALUATED', coverageChecks: { profiles: true, numericLabels: true, paired: true } });
    expect(result.requirementsCompliance.domainChecks.find(row => row.domainId === 'MOVIE')).toMatchObject({
      candidateForecast: false, outcome: false, pointDeltaMse: false });
    expect(result.precisionAssessment).toBe('NOT_EVALUATED');
    expect(result.resourceAssessment).toBe('NOT_EVALUATED');
    expect(result.qualityAdmission).toBe('NONE');
    expect(result.evidenceLimits.untouchedFinalWindow).toBe('DECLARATION_NOT_INDEPENDENT_PROOF');
  });

  it('rejects incomplete/late requirements, invalid guardrails and undeclared checkpoints', () => {
    const mutations = [
      { ...requirements(), selectedAtMicros: time(39) },
      { ...requirements(), selectedAtMicros: time(70) },
      { ...requirements(), thresholdRationale: '' },
      { ...requirements(), dependence: '' },
      { ...requirements(), searchBudget: 0 },
      { ...requirements(), domainGuardrails: [] },
      { ...requirements(), untouchedFinalWindow: false },
      { ...requirements(), precision: { ...requirements().precision, maximumIntervalWidth: null } },
    ];
    for (const r of mutations) expect(() => validate({ ...finalDeclaration(), requirements: r })).toThrow();
    expect(() => report(declaration(), inventory([]), time(13))).toThrow('UNDECLARED_CHECKPOINT');
    expect(() => report(declaration(), inventory([]), time(39, 1n))).toThrow('UNDECLARED_CHECKPOINT');
    expect(() => report(declaration(), inventory([]), time(39))).not.toThrow();
  });

  it('rejects duplicate identities, borrowed scope, malformed points, fractional grades and impossible native clocks', () => {
    const original = opportunity('original');
    expect(() => report(declaration(), inventory([original, original]), time(39))).toThrow('INVALID_OPPORTUNITY_IDENTITY');
    expect(() => report(declaration(), inventory([original, { ...original, opportunityId: 'opportunity:other' }]), time(39))).toThrow('DUPLICATE_TARGET');
    const invalid: Partial<Opportunity>[] = [
      { subjectId: 'foreign' }, { domainId: 'foreign' }, { prefixSupport: -1 },
      { forecasts: { candidate: Infinity, control: 7 } }, { forecasts: { candidate: -1, control: 7 } },
      { forecasts: { candidate: 11, control: 7 } },
      ...[-1, 0.5, 11, NaN].map(rating => ({ firstAnswer: { rating, acceptedAtMicros: time(12) } })),
      { firstAnswer: { rating: 4, acceptedAtMicros: time(11) } },
      { firstAnswer: { rating: 4, acceptedAtMicros: time(21, 1n) } },
      { horizonEndMicros: time(22) }, { opportunityAtMicros: '01' }, { opportunityAtMicros: time(90) },
    ];
    for (const extra of invalid) expect(() => report(declaration(), inventory([opportunity('invalid', extra)]), time(39))).toThrow();
    expect(() => report(declaration(), inventory([original], { origin: 'observed' }), time(39))).toThrow('INVENTORY_IDENTITY_OR_BUDGET');
    expect(() => report(declaration(), inventory([original], { observedAtMicros: time(11) }), time(39))).toThrow();
  });

  it('requires coherent chronological windows and keeps the independent cohort cap separate from 128 native retained allocations', () => {
    expect(validate(declaration({ cohortCap: 256 })).cohortCap).toBe(256);
    expect(() => validate({ ...declaration(), extra: true })).toThrow('DECLARATION_SHAPE');
    expect(() => validate(declaration({ roster: ['same', 'same'] }))).toThrow('INVALID_ROSTER');
    expect(() => validate(declaration({ createdAtMicros: time(10) }))).toThrow('DECLARATION_AFTER_ROLE_START');
    expect(() => validate(declaration({ windows: { ...declaration().windows,
      SELECTION: { startMicros: time(39), endMicros: time(60) } } }))).toThrow('WINDOW_OVERLAP');
    expect(() => validate(declaration({ checkpointsMicros: [time(12), time(11)] }))).toThrow('INVALID_CHECKPOINTS');
    expect(() => validate(declaration({ checkpointsMicros: [time(40)] }))).toThrow('INVALID_CHECKPOINTS');
    expect(() => report(declaration({ cohortCap: 1 }), inventory([opportunity('a'), opportunity('b')]), time(39)))
      .toThrow('INVENTORY_IDENTITY_OR_BUDGET');
  });

  it('is domain-independent, deterministic under inventory permutations and detached from mutable inputs', () => {
    const d = declaration({ domains: ['cycling', 'food'] });
    const rows = [opportunity('b', { domainId: 'food' }), opportunity('a', { domainId: 'cycling',
      forecasts: { candidate: 1 / 3, control: 2 / 3 }, firstAnswer: { rating: 1, acceptedAtMicros: time(12) }, currentRating: 1 })];
    const first = report(d, inventory(rows), time(39));
    expect(first).toEqual(report(d, inventory([...rows].reverse()), time(39)));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.byProfile[0])).toBe(true);
    const normalized = validate(d);
    (d.domains as string[]).push('later');
    expect(normalized.domains).toEqual(['cycling', 'food']);
    expect(first.byDomain.map(row => row.domainId)).toEqual(['cycling', 'food']);
  });
});
