/** Descriptive, own-scale first-report evaluation. No serving or quality admission. */
export type PersonalRatingEvaluationInstant = string;
export type PersonalRatingEvaluationRole = 'DEVELOPMENT' | 'SELECTION' | 'FINAL';
export interface PersonalRatingEvaluationWindow {
  readonly startMicros: PersonalRatingEvaluationInstant;
  readonly endMicros: PersonalRatingEvaluationInstant;
}
export interface PersonalRatingEvaluationRequirements {
  readonly acceptance: {
    readonly primaryMetric: 'PROFILE_MACRO_MSE';
    readonly minimumUsefulImprovement: number;
    readonly noninferiorityMargin: number;
  };
  readonly coverage: {
    readonly minimumProfiles: number;
    readonly minimumNumericLabels: number;
    readonly minimumForecastCoverage: number;
    readonly minimumOutcomeCoverage: number;
    readonly minimumPairedCoverage: number;
  };
  readonly precision: {
    readonly method: 'PROFILE_CLUSTER_BOOTSTRAP';
    readonly intervalLevel: number;
    readonly maximumIntervalWidth: number;
    readonly rule: string;
  };
  readonly resources: { readonly p50Ms: number; readonly p95Ms: number; readonly maxRssMiB: number };
  readonly domainGuardrails: readonly Readonly<{
    domainId: string; minimumForecastCoverage: number; minimumOutcomeCoverage: number; maximumDeltaMse: number;
  }>[];
  readonly dependence: string;
  readonly searchBudget: number;
  readonly thresholdRationale: string;
  readonly developmentEvidenceRef: string;
  readonly selectedAtMicros: PersonalRatingEvaluationInstant;
  readonly untouchedFinalWindow: true;
}
export interface PersonalRatingEvaluationDeclaration {
  readonly version: 'personal-rating-evaluation-declaration-v1';
  readonly cohortId: string;
  readonly createdAtMicros: PersonalRatingEvaluationInstant;
  readonly origin: 'observed' | 'synthetic';
  readonly roster: readonly string[];
  readonly domains: readonly string[];
  readonly target: 'FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN';
  readonly scale: { readonly min: 0; readonly max: 10 };
  readonly sourceVersions: { readonly source: string; readonly model: string; readonly control: string };
  readonly targetSelection: 'FIRST_DELIVERED_ITEM';
  readonly captureWindow: PersonalRatingEvaluationWindow;
  readonly horizonSeconds: number;
  readonly cohortCap: number;
  readonly windows: Readonly<Record<PersonalRatingEvaluationRole, PersonalRatingEvaluationWindow>>;
  readonly dataRole: PersonalRatingEvaluationRole;
  readonly checkpointsMicros: readonly PersonalRatingEvaluationInstant[];
  readonly requirements: PersonalRatingEvaluationRequirements | null;
}
export type PersonalRatingEvaluationCaptureStatus = 'AVAILABLE' | 'CAPTURE_UNAVAILABLE' | 'NOT_ATTEMPTED'
  | 'MISSING_EXPECTED_CAPTURE' | 'SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT';
export interface PersonalRatingEvaluationOpportunity {
  readonly opportunityId: string;
  readonly subjectId: string;
  readonly domainId: string;
  readonly objectId: string | null;
  readonly captureStatus: PersonalRatingEvaluationCaptureStatus;
  /** Frozen native cutoff when available; declared attempt clock otherwise. */
  readonly opportunityAtMicros: PersonalRatingEvaluationInstant;
  readonly horizonEndMicros: PersonalRatingEvaluationInstant | null;
  readonly prefixSupport: number | null;
  readonly forecasts: Readonly<{ candidate: number | null; control: number | null }> | null;
  readonly firstAnswer: Readonly<{ rating: number; acceptedAtMicros: PersonalRatingEvaluationInstant }> | null;
  /** Observed current state, never a substitute for the frozen first answer. */
  readonly currentRating: number | null;
}
export interface PersonalRatingEvaluationInventory {
  readonly version: 'personal-rating-evaluation-inventory-v1';
  readonly origin: 'observed' | 'synthetic';
  readonly observedAtMicros: PersonalRatingEvaluationInstant;
  /** Earliest present owner read; a later owner's read cannot mature this snapshot. */
  readonly observedThroughMicros: PersonalRatingEvaluationInstant;
  /** Supplied inventory reconciliation; files do not prove native completeness. */
  readonly complete: boolean;
  readonly opportunities: readonly PersonalRatingEvaluationOpportunity[];
}

const roles = ['DEVELOPMENT', 'SELECTION', 'FINAL'] as const;
const statuses: readonly PersonalRatingEvaluationCaptureStatus[] = ['AVAILABLE', 'CAPTURE_UNAVAILABLE', 'NOT_ATTEMPTED',
  'MISSING_EXPECTED_CAPTURE', 'SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT'];
type Model = 'candidate' | 'control';
const MAX_CLOCK = 253402300799999999n;
// Resource bounds, not minimum evidence or a native retained-allocation quota.
const MAX_OPPORTUNITIES = 4096, MAX_PROFILES = 128;
export class PersonalRatingEvaluationError extends Error {
  constructor(readonly code: string) { super(`PERSONAL_RATING_EVALUATION_${code}`); }
}
function check(value: unknown, code: string): asserts value {
  if (!value) throw new PersonalRatingEvaluationError(code);
}
function shape(value: unknown, keys: readonly string[], code = 'INVALID_SHAPE'): asserts value is Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), code);
}
function micros(value: unknown): bigint {
  check(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/u.test(value)
    && BigInt(value) <= MAX_CLOCK, 'INVALID_CLOCK');
  return BigInt(value);
}
const ref = (value: unknown): value is string => typeof value === 'string'
  && /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$/u.test(value);
const text = (value: unknown): value is string => typeof value === 'string'
  && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f]/u.test(value);
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const positive = (value: unknown): value is number => nonnegative(value) && value > 0;
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fraction = (value: unknown): value is number => nonnegative(value) && value <= 1;
const grade = (value: unknown): value is number => integer(value) && value <= 10;
const point = (value: unknown): value is number | null => value === null || (nonnegative(value) && value <= 10);
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function frozenCopy<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(frozenCopy)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, frozenCopy(child)]))) as T;
  }
  return value;
}
function window(value: unknown): { start: bigint; end: bigint } {
  shape(value, ['startMicros', 'endMicros']);
  const start = micros(value.startMicros), end = micros(value.endMicros);
  check(end > start, 'INVALID_WINDOW');
  return { start, end };
}

/** Validates declarations; neither a file nor its digest certifies preregistration. */
export function validatePersonalRatingEvaluationDeclaration(input: unknown): PersonalRatingEvaluationDeclaration {
  shape(input, ['version', 'cohortId', 'createdAtMicros', 'origin', 'roster', 'domains', 'target', 'scale',
    'sourceVersions', 'targetSelection', 'captureWindow', 'horizonSeconds', 'cohortCap', 'windows', 'dataRole',
    'checkpointsMicros', 'requirements'], 'DECLARATION_SHAPE');
  check(input.version === 'personal-rating-evaluation-declaration-v1' && ref(input.cohortId)
    && (input.origin === 'observed' || input.origin === 'synthetic'), 'DECLARATION_IDENTITY');
  check(Array.isArray(input.roster) && input.roster.length > 0 && input.roster.length <= MAX_PROFILES
    && input.roster.every(ref) && new Set(input.roster).size === input.roster.length, 'INVALID_ROSTER');
  check(Array.isArray(input.domains) && input.domains.length > 0 && input.domains.length <= 32
    && input.domains.every(ref) && new Set(input.domains).size === input.domains.length, 'INVALID_DOMAINS');
  shape(input.scale, ['min', 'max']);
  check(input.target === 'FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN'
    && input.scale.min === 0 && input.scale.max === 10 && input.targetSelection === 'FIRST_DELIVERED_ITEM', 'UNSUPPORTED_TARGET');
  shape(input.sourceVersions, ['source', 'model', 'control']);
  check(Object.values(input.sourceVersions).every(ref), 'INVALID_SOURCE_VERSIONS');
  check(integer(input.horizonSeconds) && input.horizonSeconds >= 1 && input.horizonSeconds <= 7776000
    && integer(input.cohortCap) && input.cohortCap >= 1 && input.cohortCap <= MAX_OPPORTUNITIES, 'INVALID_BUDGET');
  const horizon = BigInt(input.horizonSeconds) * 1000000n, global = window(input.captureWindow);
  shape(input.windows, roles);
  const declaredWindows = input.windows;
  const windows = roles.map(role => window(declaredWindows[role]));
  for (const [index, item] of windows.entries()) {
    check(item.start >= global.start && item.end <= global.end && item.end + horizon <= MAX_CLOCK, 'WINDOW_OUTSIDE_CAPTURE');
    if (index > 0) check(item.start >= windows[index - 1]!.end + horizon, 'WINDOW_OVERLAP');
  }
  check(roles.includes(input.dataRole as PersonalRatingEvaluationRole), 'INVALID_ROLE');
  const roleIndex = roles.indexOf(input.dataRole as PersonalRatingEvaluationRole), active = windows[roleIndex]!;
  const created = micros(input.createdAtMicros);
  check(created < active.start, 'DECLARATION_AFTER_ROLE_START');
  check(Array.isArray(input.checkpointsMicros) && input.checkpointsMicros.length >= 1
    && input.checkpointsMicros.length <= 256, 'INVALID_CHECKPOINTS');
  let prior = -1n;
  for (const value of input.checkpointsMicros) {
    const checkpoint = micros(value);
    check(checkpoint >= active.start && checkpoint > prior
      && (roleIndex === 2 || checkpoint < windows[roleIndex + 1]!.start), 'INVALID_CHECKPOINTS');
    prior = checkpoint;
  }
  if (input.requirements === null) check(input.dataRole !== 'FINAL', 'FINAL_REQUIREMENTS_MISSING');
  else {
    const r = input.requirements;
    shape(r, ['acceptance', 'coverage', 'precision', 'resources', 'domainGuardrails', 'dependence', 'searchBudget',
      'thresholdRationale', 'developmentEvidenceRef', 'selectedAtMicros', 'untouchedFinalWindow'], 'REQUIREMENTS_SHAPE');
    shape(r.acceptance, ['primaryMetric', 'minimumUsefulImprovement', 'noninferiorityMargin']);
    check(r.acceptance.primaryMetric === 'PROFILE_MACRO_MSE' && nonnegative(r.acceptance.minimumUsefulImprovement)
      && nonnegative(r.acceptance.noninferiorityMargin), 'INVALID_ACCEPTANCE');
    shape(r.coverage, ['minimumProfiles', 'minimumNumericLabels', 'minimumForecastCoverage', 'minimumOutcomeCoverage', 'minimumPairedCoverage']);
    check(integer(r.coverage.minimumProfiles) && r.coverage.minimumProfiles > 0
      && integer(r.coverage.minimumNumericLabels) && r.coverage.minimumNumericLabels > 0
      && fraction(r.coverage.minimumForecastCoverage) && fraction(r.coverage.minimumOutcomeCoverage)
      && fraction(r.coverage.minimumPairedCoverage), 'INVALID_COVERAGE_REQUIREMENTS');
    shape(r.precision, ['method', 'intervalLevel', 'maximumIntervalWidth', 'rule']);
    check(r.precision.method === 'PROFILE_CLUSTER_BOOTSTRAP' && positive(r.precision.intervalLevel)
      && r.precision.intervalLevel < 1 && positive(r.precision.maximumIntervalWidth) && text(r.precision.rule), 'INVALID_PRECISION');
    shape(r.resources, ['p50Ms', 'p95Ms', 'maxRssMiB']);
    check(positive(r.resources.p50Ms) && positive(r.resources.p95Ms) && r.resources.p95Ms >= r.resources.p50Ms
      && positive(r.resources.maxRssMiB), 'INVALID_RESOURCES');
    check(text(r.dependence) && integer(r.searchBudget) && r.searchBudget > 0 && text(r.thresholdRationale)
      && ref(r.developmentEvidenceRef) && r.untouchedFinalWindow === true, 'INVALID_REQUIREMENTS');
    const selected = micros(r.selectedAtMicros);
    check(selected >= windows[0]!.end + horizon && selected <= created && selected < windows[2]!.start,
      'REQUIREMENTS_SELECTION_WINDOW');
    check(Array.isArray(r.domainGuardrails) && r.domainGuardrails.length === input.domains.length, 'INVALID_DOMAIN_GUARDRAILS');
    const seen = new Set<string>();
    for (const guard of r.domainGuardrails) {
      shape(guard, ['domainId', 'minimumForecastCoverage', 'minimumOutcomeCoverage', 'maximumDeltaMse']);
      check(ref(guard.domainId) && input.domains.includes(guard.domainId) && !seen.has(guard.domainId)
        && fraction(guard.minimumForecastCoverage) && fraction(guard.minimumOutcomeCoverage)
        && typeof guard.maximumDeltaMse === 'number' && Number.isFinite(guard.maximumDeltaMse), 'INVALID_DOMAIN_GUARDRAILS');
      seen.add(guard.domainId);
    }
  }
  const declared = input as unknown as PersonalRatingEvaluationDeclaration;
  return frozenCopy({ ...declared, roster: [...declared.roster].sort(lexical), domains: [...declared.domains].sort(lexical),
    requirements: declared.requirements === null ? null : { ...declared.requirements,
      domainGuardrails: [...declared.requirements.domainGuardrails].sort((a, b) => lexical(a.domainId, b.domainId)) } });
}

function validateInventory(declaration: PersonalRatingEvaluationDeclaration, input: PersonalRatingEvaluationInventory) {
  shape(input, ['version', 'origin', 'observedAtMicros', 'observedThroughMicros', 'complete', 'opportunities'], 'INVENTORY_SHAPE');
  check(input.version === 'personal-rating-evaluation-inventory-v1' && input.origin === declaration.origin
    && typeof input.complete === 'boolean' && Array.isArray(input.opportunities)
    && input.opportunities.length <= declaration.cohortCap, 'INVENTORY_IDENTITY_OR_BUDGET');
  const observed = micros(input.observedAtMicros), global = window(declaration.captureWindow);
  check(micros(input.observedThroughMicros) <= observed, 'INVENTORY_OBSERVATION_ORDER');
  const horizon = BigInt(declaration.horizonSeconds) * 1000000n;
  const ids = new Set<string>(), targets = new Set<string>();
  for (const row of input.opportunities) {
    shape(row, ['opportunityId', 'subjectId', 'domainId', 'objectId', 'captureStatus', 'opportunityAtMicros',
      'horizonEndMicros', 'prefixSupport', 'forecasts', 'firstAnswer', 'currentRating'], 'OPPORTUNITY_SHAPE');
    check(ref(row.opportunityId) && !ids.has(row.opportunityId) && ref(row.subjectId) && declaration.roster.includes(row.subjectId)
      && ref(row.domainId) && declaration.domains.includes(row.domainId) && (row.objectId === null || ref(row.objectId))
      && statuses.includes(row.captureStatus as PersonalRatingEvaluationCaptureStatus), 'INVALID_OPPORTUNITY_IDENTITY');
    ids.add(row.opportunityId);
    const at = micros(row.opportunityAtMicros);
    check(at >= global.start && at < global.end && at <= observed, 'OPPORTUNITY_OUTSIDE_WINDOW');
    check(row.currentRating === null || grade(row.currentRating), 'INVALID_CURRENT_RATING');
    if (row.captureStatus !== 'AVAILABLE') {
      check(row.horizonEndMicros === null && row.prefixSupport === null && row.forecasts === null
        && row.firstAnswer === null && row.currentRating === null, 'UNAVAILABLE_PAYLOAD');
      continue;
    }
    check(row.objectId !== null && integer(row.prefixSupport) && row.prefixSupport <= 100000, 'INVALID_FORECAST_SUPPORT');
    const target = JSON.stringify([row.subjectId, row.objectId]);
    check(!targets.has(target), 'DUPLICATE_TARGET'); targets.add(target);
    const end = micros(row.horizonEndMicros);
    check(end === at + horizon, 'HORIZON_MISMATCH');
    shape(row.forecasts, ['candidate', 'control']);
    check(point(row.forecasts.candidate) && point(row.forecasts.control), 'INVALID_FORECAST_POINT');
    if (row.firstAnswer !== null) {
      shape(row.firstAnswer, ['rating', 'acceptedAtMicros']);
      const accepted = micros(row.firstAnswer.acceptedAtMicros);
      check(grade(row.firstAnswer.rating) && accepted > at && accepted <= end && accepted <= observed, 'INVALID_FIRST_ANSWER');
    }
  }
  return input;
}

interface Loss { readonly count: number; readonly mse: number | null; readonly rmse: number | null;
  readonly mae: number | null; readonly bias: number | null }
function loss(errors: readonly number[], valid: boolean): Loss {
  const count = errors.length;
  const mse = valid && count ? errors.reduce((sum, error) => sum + error * error, 0) / count : null;
  return { count, mse, rmse: mse === null ? null : Math.sqrt(mse),
    mae: valid && count ? errors.reduce((sum, error) => sum + Math.abs(error), 0) / count : null,
    bias: valid && count ? errors.reduce((sum, error) => sum + error, 0) / count : null };
}
const average = (values: readonly number[]): number | null => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const ratio = (count: number, total: number): number | null => total ? count / total : null;
function summarize(rows: readonly PersonalRatingEvaluationOpportunity[], roster: readonly string[], cut: bigint, valid: boolean) {
  const available = rows.filter(row => row.captureStatus === 'AVAILABLE');
  const answered = available.filter(row => row.firstAnswer !== null && micros(row.firstAnswer.acceptedAtMicros) <= cut);
  const paired = answered.filter(row => row.forecasts!.candidate !== null && row.forecasts!.control !== null);
  const byProfile = roster.map(subjectId => {
    const personal = rows.filter(row => row.subjectId === subjectId), labels = answered.filter(row => row.subjectId === subjectId);
    const pairs = paired.filter(row => row.subjectId === subjectId);
    const errors = (model: Model, source: readonly PersonalRatingEvaluationOpportunity[]) => source
      .filter(row => row.forecasts![model] !== null).map(row => row.forecasts![model]! - row.firstAnswer!.rating);
    const candidate = loss(errors('candidate', labels), valid), control = loss(errors('control', labels), valid);
    const pairedCandidate = loss(errors('candidate', pairs), valid), pairedControl = loss(errors('control', pairs), valid);
    const candidateForecasts = personal.filter(row => row.captureStatus === 'AVAILABLE' && row.forecasts!.candidate !== null).length;
    const controlForecasts = personal.filter(row => row.captureStatus === 'AVAILABLE' && row.forecasts!.control !== null).length;
    return { subjectId, opportunities: personal.length, firstAnswers: labels.length, candidateForecasts, controlForecasts,
      pairedNumericLabels: pairs.length,
      coverage: { candidateForecast: ratio(candidateForecasts, personal.length), controlForecast: ratio(controlForecasts, personal.length),
        outcome: ratio(labels.length, personal.length), paired: ratio(pairs.length, personal.length) },
      candidate, control, paired: { count: pairs.length, candidateMse: pairedCandidate.mse, controlMse: pairedControl.mse,
        deltaMse: pairedCandidate.mse === null || pairedControl.mse === null ? null : pairedCandidate.mse - pairedControl.mse } };
  });
  const macro = (model: Model) => {
    const values = byProfile.filter(row => row[model].count > 0), mse = valid ? average(values.map(row => row[model].mse!)) : null;
    return { profiles: values.length, mse, rmse: mse === null ? null : Math.sqrt(mse),
      mae: valid ? average(values.map(row => row[model].mae!)) : null, bias: valid ? average(values.map(row => row[model].bias!)) : null };
  };
  const candidateForecasts = available.filter(row => row.forecasts!.candidate !== null).length;
  const controlForecasts = available.filter(row => row.forecasts!.control !== null).length;
  const pairedProfiles = byProfile.filter(row => row.paired.count > 0);
  const participating = byProfile.filter(row => row.opportunities > 0);
  const captureStatuses = Object.fromEntries(statuses.map(status => [status, rows.filter(row => row.captureStatus === status).length]));
  return { counts: { opportunities: rows.length, declaredProfiles: roster.length,
    participatingProfiles: byProfile.filter(row => row.opportunities > 0).length,
    captureStatuses, availableCaptures: available.length,
    candidateForecasts, controlForecasts, firstAnswers: answered.length, pairedNumericLabels: paired.length,
    scoredProfiles: { candidate: byProfile.filter(row => row.candidate.count > 0).length,
      control: byProfile.filter(row => row.control.count > 0).length, paired: pairedProfiles.length },
    pendingFirstReports: available.filter(row => !answered.includes(row) && cut <= micros(row.horizonEndMicros)).length,
    unansweredExpired: available.filter(row => !answered.includes(row) && cut > micros(row.horizonEndMicros)).length,
    candidateForecastUnavailable: available.length - candidateForecasts,
    controlForecastUnavailable: available.length - controlForecasts,
    currentRatingDifferentOrAbsent: answered.filter(row => row.currentRating !== row.firstAnswer!.rating).length },
  coverage: { candidateForecast: ratio(candidateForecasts, rows.length), controlForecast: ratio(controlForecasts, rows.length),
    outcome: ratio(answered.length, rows.length), paired: ratio(paired.length, rows.length) },
  macroCoverage: { denominator: 'PARTICIPATING_PROFILES_WITH_AT_LEAST_ONE_OPPORTUNITY', profiles: participating.length,
    candidateForecast: average(participating.map(row => row.coverage.candidateForecast!)),
    controlForecast: average(participating.map(row => row.coverage.controlForecast!)),
    outcome: average(participating.map(row => row.coverage.outcome!)), paired: average(participating.map(row => row.coverage.paired!)) },
  macro: { candidate: macro('candidate'), control: macro('control'), paired: { profiles: pairedProfiles.length,
    candidateMse: valid ? average(pairedProfiles.map(row => row.paired.candidateMse!)) : null,
    controlMse: valid ? average(pairedProfiles.map(row => row.paired.controlMse!)) : null,
    deltaMse: valid ? average(pairedProfiles.map(row => row.paired.deltaMse!)) : null } }, byProfile };
}

/** Pure arithmetic over a complete supplied inventory; native authority remains outside this function. */
export function buildPersonalRatingEvaluationReport(declarationInput: PersonalRatingEvaluationDeclaration,
  inventoryInput: PersonalRatingEvaluationInventory, checkpointMicros: PersonalRatingEvaluationInstant) {
  const declaration = validatePersonalRatingEvaluationDeclaration(declarationInput);
  const inventory = validateInventory(declaration, inventoryInput), cut = micros(checkpointMicros);
  check(declaration.checkpointsMicros.includes(checkpointMicros), 'UNDECLARED_CHECKPOINT');
  check(micros(inventory.observedThroughMicros) >= cut, 'CHECKPOINT_NOT_OBSERVED');
  const active = window(declaration.windows[declaration.dataRole]);
  const withdrawn = inventory.opportunities.some(row => row.captureStatus === 'SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT');
  const missing = !inventory.complete || inventory.opportunities.some(row => row.captureStatus === 'MISSING_EXPECTED_CAPTURE');
  const valid = !withdrawn && !missing;
  const activeRows = [...inventory.opportunities].sort((a, b) => lexical(a.opportunityId, b.opportunityId)).filter(row => {
    const at = micros(row.opportunityAtMicros); return at >= active.start && at < active.end;
  });
  const rows = activeRows.filter(row => micros(row.opportunityAtMicros) <= cut);
  const summary = summarize(rows, declaration.roster, cut, valid);
  const byDomain = declaration.domains.map(domainId => ({ domainId,
    ...summarize(rows.filter(row => row.domainId === domainId), declaration.roster, cut, valid) }));
  const supports = [...new Set(rows.filter(row => row.captureStatus === 'AVAILABLE').map(row => row.prefixSupport!))].sort((a, b) => a - b);
  const byPrefixSupport = supports.map(prefixSupport => {
    const support = summarize(rows.filter(row => row.prefixSupport === prefixSupport), declaration.roster, cut, valid);
    return { prefixSupport, counts: support.counts, coverage: support.coverage, macroCoverage: support.macroCoverage, macro: support.macro };
  });
  const r = declaration.requirements;
  const meets = (value: number | null, minimum: number) => value !== null && value >= minimum;
  const coverageChecks = r === null ? null : {
    profiles: summary.macro.paired.profiles >= r.coverage.minimumProfiles,
    numericLabels: summary.counts.pairedNumericLabels >= r.coverage.minimumNumericLabels,
    candidateForecast: meets(summary.coverage.candidateForecast, r.coverage.minimumForecastCoverage),
    controlForecast: meets(summary.coverage.controlForecast, r.coverage.minimumForecastCoverage),
    outcome: meets(summary.coverage.outcome, r.coverage.minimumOutcomeCoverage),
    paired: meets(summary.coverage.paired, r.coverage.minimumPairedCoverage),
  };
  const domainChecks = r === null ? [] : r.domainGuardrails.map(guard => {
    const domain = byDomain.find(row => row.domainId === guard.domainId)!;
    return { domainId: guard.domainId,
      candidateForecast: meets(domain.coverage.candidateForecast, guard.minimumForecastCoverage),
      controlForecast: meets(domain.coverage.controlForecast, guard.minimumForecastCoverage),
      outcome: meets(domain.coverage.outcome, guard.minimumOutcomeCoverage),
      pointDeltaMse: domain.macro.paired.deltaMse !== null && domain.macro.paired.deltaMse <= guard.maximumDeltaMse };
  });
  return frozenCopy({ version: 'personal-rating-evaluation-report-v1' as const, cohortId: declaration.cohortId,
    status: withdrawn ? 'INVALIDATED_SOURCE_WITHDRAWAL' : missing ? 'INCOMPLETE_INVENTORY' : 'DESCRIPTIVE_ONLY',
    qualityAdmission: 'NONE' as const, servingActivation: 'NONE' as const,
    origin: declaration.origin, target: declaration.target, dataRole: declaration.dataRole,
    checkpointMicros, inventoryObservedAtMicros: inventory.observedAtMicros, inventoryObservedThroughMicros: inventory.observedThroughMicros,
    inventory: { complete: inventory.complete && !missing, suppliedOpportunities: inventory.opportunities.length,
      outsideActiveRole: inventory.opportunities.length - activeRows.length, afterCheckpoint: activeRows.length - rows.length,
      withdrawalInvalidatesEntireCohort: true }, ...summary, byDomain, byPrefixSupport,
    ratingStyle: 'UNIDENTIFIED_NO_PSYCHOLOGICAL_SCALE_INFERENCE',
    biasDefinition: 'FORECAST_MINUS_FIRST_RATING', macroRmseDefinition: 'SQRT_OF_PROFILE_MACRO_MSE',
    pairedComparison: 'SAME_OPPORTUNITIES_WITH_BOTH_NUMERIC_FORECASTS_AND_FIRST_ANSWERS',
    currentStateBasis: 'INVENTORY_OBSERVATION_NOT_HISTORICAL_CHECKPOINT',
    requirementsCompliance: { status: r === null ? 'NOT_DECLARED' : 'DECLARED_VALUES_AND_DESCRIPTIVE_CHECKS_ONLY', cohortValid: valid,
      coverageChecks, domainChecks, primaryDecision: 'NOT_EVALUATED' },
    precisionAssessment: 'NOT_EVALUATED', resourceAssessment: 'NOT_EVALUATED',
    evidenceLimits: { inventoryCompleteness: 'SUPPLIED_RECONCILIATION_NOT_NATIVE_AUTHENTICATION',
      predeclaration: 'NOT_AUTHENTICATED', untouchedFinalWindow: 'DECLARATION_NOT_INDEPENDENT_PROOF',
      experienceTime: 'UNKNOWN', causalRecommendationUplift: 'NOT_ESTABLISHED',
      repeatedCheckpoints: 'DESCRIPTIVE_NOT_A_SEQUENTIAL_CONFIDENCE_GUARANTEE' },
  });
}
export type PersonalRatingEvaluationReport = ReturnType<typeof buildPersonalRatingEvaluationReport>;
