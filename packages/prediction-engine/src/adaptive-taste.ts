import type { NumericScale, PredictionScope } from './contracts.js';
import type { TasteAnswer, TasteCandidate } from './taste-selection.js';

/** Reference-only policy. Its thresholds and utilities have no measured quality admission. */
export const adaptiveTasteDefaults = Object.freeze({
  version: 'adaptive-taste-provisional-v1' as const,
  maximumOpportunities: 48, maximumCommands: 160, maximumPoolSize: 128,
  scoreTieTolerance: 1e-9, minimumFeatureDistance: 0.10, maximumRetainedBytes: 1_048_576,
  weights: Object.freeze({ recognition: 0.35, preference: 0.45, diversity: 0.10, coverage: 0.10 }),
});
/** Explicit opt-in; retained reference states keep their original selection policy. */
export const adaptiveTasteCanonicalDefaults = Object.freeze({
  ...adaptiveTasteDefaults, version: 'adaptive-taste-canonical-ordinal-v3' as const,
  selectionMode: 'CANONICAL_ORDINAL_V3' as const,
});
export interface AdaptiveTasteDomainRequirement {
  readonly domain: string;
  readonly minimumRatedItems: number;
  readonly minimumFeaturePatterns: number;
  readonly minimumForecastCoverage: number;
  readonly minimumComparablePairs: number;
  readonly minimumConcordantFraction: number;
  readonly minimumStableComparisons: number;
  readonly maximumOrderChangeRatio: number;
}
export interface AdaptiveTastePolicy {
  readonly version: string;
  readonly selectionMode?: 'CANONICAL_ORDINAL_V3';
  readonly control: 'ADAPTIVE' | 'PRIOR_ONLY';
  readonly domains: readonly AdaptiveTasteDomainRequirement[];
  readonly maximumOpportunities: number;
  readonly maximumCommands: number;
  readonly maximumPoolSize: number;
  readonly scoreTieTolerance: number;
  readonly minimumFeatureDistance: number;
  readonly maximumRetainedBytes: number;
  readonly weights: Readonly<{ recognition: number; preference: number; diversity: number; coverage: number }>;
}
export interface AdaptiveTastePrefixRef {
  readonly objectId: string;
  readonly responseId: string;
  readonly revision: number;
}
export interface AdaptiveTasteForecastRow {
  readonly candidate: TasteCandidate;
  /** The trusted scorer must report any label it could already observe, including external history. */
  readonly labelSeen: boolean;
  readonly forecast: { readonly status: 'AVAILABLE'; readonly score: number }
    | { readonly status: 'UNAVAILABLE'; readonly reason: string };
}
export interface AdaptiveTastePool {
  readonly id: string;
  readonly scope: PredictionScope;
  readonly domain: string;
  readonly asOf: number;
  readonly catalogAsOf: number;
  readonly prefix: readonly AdaptiveTastePrefixRef[];
  readonly provenance: {
    readonly predictionId: string; readonly modelVersion: string; readonly baseModelVersion: string;
    readonly policyVersion: string; readonly genomeRef: string; readonly genomeConfigRef: string;
    readonly featureSchemaRef: string; readonly stateRef: string; readonly traceRef: string;
    readonly sourceRefs: readonly string[];
  };
  /** A retained top pool must not masquerade as a complete catalogue. */
  readonly coverage: 'DOMAIN_COMPLETE' | 'BOUNDED_CANONICAL_POOL';
  readonly consideredCount: number;
  readonly rows: readonly AdaptiveTasteForecastRow[];
}
export interface AdaptiveTasteResponse {
  readonly id: string; readonly revision: number; readonly occurredAt: number;
  readonly availableAt: number; readonly answer: TasteAnswer;
}
export interface AdaptiveTasteQuestion {
  readonly id: string; readonly poolId: string; readonly objectId: string; readonly domain: string;
  readonly presentedAt: number;
  readonly components: Readonly<{ recognition: number; preference: number; diversity: number; coverage: number; utility: number }>;
  readonly selectionTrace?: AdaptiveTasteSelectionTrace;
  readonly responses: readonly AdaptiveTasteResponse[];
}
export interface AdaptiveTasteSelectionTrace {
  readonly version: 'canonical-ordinal-v3';
  readonly scoreBasis: 'WITHIN_DOMAIN_CURRENT_PANEL_TIED_MIDRANK';
  readonly poolId: string; readonly preference: number; readonly candidateCount: number;
  readonly coverageIntervention: boolean; readonly minimumPresented: number; readonly maximumPresented: number;
  readonly maximumDomainLead: 2;
}
export interface AdaptiveTasteState {
  readonly version: 'adaptive-taste-reference-v1';
  readonly scope: PredictionScope; readonly ratingScale: NumericScale; readonly policy: AdaptiveTastePolicy;
  readonly revision: number; readonly updatedAt: number; readonly paused: boolean;
  readonly budgetExhausted: boolean;
  readonly initialKnownObjectIds: readonly string[];
  readonly pools: readonly AdaptiveTastePool[]; readonly questions: readonly AdaptiveTasteQuestion[];
  readonly prefix: readonly AdaptiveTastePrefixRef[];
  readonly withdrawnSourceRefs: readonly string[];
  readonly receipts: readonly { readonly requestId: string; readonly command: string }[];
  readonly lastOfferStatus: 'OFFERED' | 'CATALOG_EXHAUSTED' | 'FORECAST_UNAVAILABLE' | 'NO_INFORMATION' | null;
}
interface CommandIdentity { readonly requestId: string; readonly expectedRevision: number; readonly at: number }
export type AdaptiveTasteCommand = CommandIdentity & (
  | { readonly kind: 'OFFER'; readonly pools: readonly AdaptiveTastePool[] }
  | { readonly kind: 'ANSWER' | 'CORRECT'; readonly questionId: string; readonly responseId: string;
    readonly occurredAt: number; readonly answer: TasteAnswer }
  | { readonly kind: 'WITHDRAW_SOURCE'; readonly sourceRef: string }
  | { readonly kind: 'PAUSE' | 'RESUME' }
);
export interface AdaptiveTasteEvaluation {
  readonly leftObjectId: string; readonly rightObjectId: string; readonly domain: string;
  readonly poolId: string | null;
  readonly status: 'COMPARABLE' | 'RATING_TIE' | 'FORECAST_TIE' | 'NO_COMMON_UNSEEN_POOL' | 'INVALIDATED';
  readonly agreement: 'CONCORDANT' | 'DISCORDANT' | null;
}
export interface AdaptiveTasteDomainReadiness {
  readonly domain: string; readonly ratedItems: number; readonly featurePatterns: number;
  readonly prospectiveCandidates: number; readonly supportedCandidates: number;
  readonly forecastCoverage: number; readonly comparablePairs: number; readonly stableComparisons: number;
  readonly concordantPairs: number; readonly discordantPairs: number;
  readonly concordantFraction: number | null;
  readonly coverageComplete: boolean;
  readonly forecastCoverageBasis: 'DOMAIN_COMPLETE' | 'CONSERVATIVE_RETAINED_LOWER_BOUND' | 'UNAVAILABLE';
  readonly freshPool: boolean; readonly discriminative: boolean; readonly ready: boolean;
}
export type AdaptiveTasteStatus = 'QUESTION' | 'NEEDS_SNAPSHOT' | 'REFERENCE_READY'
  | 'INVALIDATED_QUESTION_INSUFFICIENT'
  | 'PAUSED_INSUFFICIENT' | 'BUDGET_EXHAUSTED_INSUFFICIENT' | 'CATALOG_EXHAUSTED_INSUFFICIENT'
  | 'FORECAST_UNAVAILABLE_INSUFFICIENT' | 'NO_INFORMATION_INSUFFICIENT';
export interface AdaptiveTasteInspection {
  readonly version: 'adaptive-taste-reference-v1'; readonly status: AdaptiveTasteStatus;
  readonly question: AdaptiveTasteQuestion | null;
  readonly domains: readonly AdaptiveTasteDomainReadiness[];
  readonly evaluations: readonly AdaptiveTasteEvaluation[];
  readonly readinessBasis: 'PROVISIONAL_DOMAIN_SUPPORT_DISCRIMINATION_COVERAGE_ORDINAL_STABILITY';
  readonly inputBasis: 'TRUSTED_AUTHORIZED_CANONICAL_FORECAST_POOLS';
  readonly uncertainty: 'unavailable'; readonly nativeActivated: false; readonly qualityAdmitted: false;
}

function valid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Adaptive Taste: ${message}`);
}
function id(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f]/u.test(value);
}
function time(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function unit(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1; }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
function immutable<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (node: unknown): void => {
    if (node && typeof node === 'object') { Object.values(node).forEach(freeze); Object.freeze(node); }
  };
  freeze(copy); return copy;
}
function bytes(value: unknown): number {
  // Count UTF-8 without a browser/Node-specific dependency.
  let total = 0;
  for (const character of canonical(value)) {
    const point = character.codePointAt(0)!;
    total += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return total;
}
// Synchronous, runtime-independent SHA-256 for bounded command identity only.
// Authorization and canonical model/trace commitments still belong to the caller.
function fingerprint(value: unknown): string {
  const input: number[] = [];
  for (const character of canonical(value)) {
    const p = character.codePointAt(0)!;
    if (p < 0x80) input.push(p);
    else if (p < 0x800) input.push(0xc0 | p >>> 6, 0x80 | p & 63);
    else if (p < 0x10000) input.push(0xe0 | p >>> 12, 0x80 | p >>> 6 & 63, 0x80 | p & 63);
    else input.push(0xf0 | p >>> 18, 0x80 | p >>> 12 & 63, 0x80 | p >>> 6 & 63, 0x80 | p & 63);
  }
  const length = input.length * 8;
  input.push(0x80); while (input.length % 64 !== 56) input.push(0);
  input.push(0, 0, 0, 0, length >>> 24 & 255, length >>> 16 & 255, length >>> 8 & 255, length & 255);
  const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotate = (n: number, amount: number) => n >>> amount | n << 32 - amount;
  for (let offset = 0; offset < input.length; offset += 64) {
    const w: number[] = [];
    for (let i = 0; i < 16; i++) w.push((input[offset+i*4]! << 24 | input[offset+i*4+1]! << 16
      | input[offset+i*4+2]! << 8 | input[offset+i*4+3]!) >>> 0);
    for (let i = 16; i < 64; i++) {
      const a = w[i-15]!, b = w[i-2]!;
      w.push((w[i-16]! + (rotate(a,7)^rotate(a,18)^a>>>3) + w[i-7]! + (rotate(b,17)^rotate(b,19)^b>>>10)) >>> 0);
    }
    let [a,b,c,d,e,f,g,h] = hash as [number,number,number,number,number,number,number,number];
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotate(e,6)^rotate(e,11)^rotate(e,25)) + (e&f ^ ~e&g) + constants[i]! + w[i]!) >>> 0;
      const t2 = ((rotate(a,2)^rotate(a,13)^rotate(a,22)) + (a&b ^ a&c ^ b&c)) >>> 0;
      [a,b,c,d,e,f,g,h] = [(t1+t2)>>>0,a,b,c,(d+t1)>>>0,e,f,g];
    }
    for (const [i, n] of [a,b,c,d,e,f,g,h].entries()) hash[i] = (hash[i]! + n) >>> 0;
  }
  return `sha256:${hash.map(word => word.toString(16).padStart(8,'0')).join('')}`;
}
function checkScope(scope: PredictionScope): void {
  valid(scope && scope.subject && id(scope.subject.id) && ['individual', 'system'].includes(scope.subject.kind)
    && id(scope.actingIdentityRef) && id(scope.sessionRef), 'individual/system scope, actor and session required');
  valid(scope.evidence && ['exclude', 'fixture-only'].includes(scope.evidence.synthetic), 'invalid evidence scope');
  for (const values of [scope.evidence.sourceIds, scope.evidence.cohortIds]) {
    valid(Array.isArray(values) && values.length <= 32 && values.every(id) && new Set(values).size === values.length, 'invalid evidence references');
  }
}
function checkPolicy(policy: AdaptiveTastePolicy): void {
  valid(policy && id(policy.version) && ['ADAPTIVE', 'PRIOR_ONLY'].includes(policy.control), 'invalid policy version/control');
  valid(policy.selectionMode === undefined || policy.selectionMode === 'CANONICAL_ORDINAL_V3', 'unsupported selection mode');
  valid(Number.isInteger(policy.maximumOpportunities) && policy.maximumOpportunities >= 2 && policy.maximumOpportunities <= 64
    && Number.isInteger(policy.maximumCommands) && policy.maximumCommands >= policy.maximumOpportunities * 2 && policy.maximumCommands <= 256
    && Number.isInteger(policy.maximumPoolSize) && policy.maximumPoolSize >= 2 && policy.maximumPoolSize <= 128
    && Number.isFinite(policy.scoreTieTolerance) && policy.scoreTieTolerance > 0 && policy.scoreTieTolerance <= 0.01
    && unit(policy.minimumFeatureDistance) && policy.minimumFeatureDistance > 0
    && Number.isSafeInteger(policy.maximumRetainedBytes) && policy.maximumRetainedBytes >= 16_384
    && policy.maximumRetainedBytes <= 2_097_152, 'invalid resource/tie bounds');
  valid(record(policy.weights) && Object.keys(policy.weights).sort().join() === 'coverage,diversity,preference,recognition'
    && Object.values(policy.weights).every(unit)
    && Math.abs(Object.values(policy.weights).reduce((sum, value) => sum + value, 0) - 1) < 1e-12,
  'invalid declared utility weights');
  valid(Array.isArray(policy.domains) && policy.domains.length > 0 && policy.domains.length <= 4
    && new Set(policy.domains.map(requirement => requirement.domain)).size === policy.domains.length, 'invalid required domains');
  for (const r of policy.domains) {
    valid(r && id(r.domain) && Number.isInteger(r.minimumRatedItems) && r.minimumRatedItems >= 2 && r.minimumRatedItems <= 32
      && Number.isInteger(r.minimumFeaturePatterns) && r.minimumFeaturePatterns >= 2 && r.minimumFeaturePatterns <= 32
      && unit(r.minimumForecastCoverage) && r.minimumForecastCoverage > 0
      && Number.isInteger(r.minimumComparablePairs) && r.minimumComparablePairs >= 1 && r.minimumComparablePairs <= 128
      && unit(r.minimumConcordantFraction) && r.minimumConcordantFraction > 0.5
      && Number.isInteger(r.minimumStableComparisons) && r.minimumStableComparisons >= 1 && r.minimumStableComparisons <= 16
      && unit(r.maximumOrderChangeRatio), 'invalid explicit domain readiness requirement');
  }
}
function checkAnswer(answer: TasteAnswer, scale: NumericScale): void {
  valid(record(answer) && ['RATING', 'UNKNOWN', 'NOT_INTERESTED', 'WITHDRAWN'].includes(answer.kind), 'invalid answer');
  valid(Object.keys(answer).sort().join() === (answer.kind === 'RATING' ? 'kind,value' : 'kind'), 'invalid answer fields');
  if (answer.kind === 'RATING') valid(Number.isFinite(answer.value) && answer.value >= scale.min && answer.value <= scale.max, 'rating outside declared scale');
}
function latest(question: AdaptiveTasteQuestion): AdaptiveTasteResponse | undefined { return question.responses.at(-1); }
function first(question: AdaptiveTasteQuestion): AdaptiveTasteResponse | undefined { return question.responses[0]; }
function row(pool: AdaptiveTastePool, objectId: string): AdaptiveTasteForecastRow | undefined {
  return pool.rows.find(item => item.candidate.object.id === objectId);
}
function questionCandidate(state: AdaptiveTasteState, question: AdaptiveTasteQuestion): TasteCandidate {
  return row(state.pools.find(pool => pool.id === question.poolId)!, question.objectId)!.candidate;
}
function seenAtPrefix(state: AdaptiveTasteState, pool: AdaptiveTastePool, objectId: string): boolean {
  return state.initialKnownObjectIds.includes(objectId) || pool.prefix.some(ref => ref.objectId === objectId);
}
const invalidPoolCache = new WeakMap<AdaptiveTasteState, ReadonlyMap<string, boolean>>();
function invalidPools(state: AdaptiveTasteState): ReadonlyMap<string, boolean> {
  const cached = invalidPoolCache.get(state); if (cached) return cached;
  const invalid = new Map<string, boolean>();
  const questions = new Map(state.questions.map(question => [question.objectId, question]));
  // Accepted pool dependencies point backward to an already answered question.
  // One forward projection avoids exponential traversal of cumulative prefixes.
  for (const pool of state.pools) invalid.set(pool.id, pool.provenance.sourceRefs.some(ref => state.withdrawnSourceRefs.includes(ref))
    || pool.prefix.some(ref => {
      const q = questions.get(ref.objectId);
      return q && (latest(q)?.answer.kind === 'WITHDRAWN' || invalid.get(q.poolId) === true);
    }));
  invalidPoolCache.set(state, invalid); return invalid;
}
function sourceInvalid(state: AdaptiveTasteState, pool: AdaptiveTastePool): boolean {
  const invalid = invalidPools(state), known = invalid.get(pool.id);
  return known ?? (pool.provenance.sourceRefs.some(ref => state.withdrawnSourceRefs.includes(ref))
    || pool.prefix.some(ref => {
      const q = state.questions.find(question => question.objectId === ref.objectId);
      return q && (latest(q)?.answer.kind === 'WITHDRAWN' || invalid.get(q.poolId) === true);
    }));
}
function effectiveQuestions(state: AdaptiveTasteState): readonly AdaptiveTasteQuestion[] {
  return state.questions.filter(question => !sourceInvalid(state, state.pools.find(pool => pool.id === question.poolId)!));
}
function effectivePrefix(state: AdaptiveTasteState): readonly AdaptiveTastePrefixRef[] {
  const effective = new Set(effectiveQuestions(state).filter(question => latest(question)?.answer.kind !== 'WITHDRAWN').map(question => question.objectId));
  return state.prefix.filter(ref => effective.has(ref.objectId));
}
function checkPool(state: AdaptiveTasteState, pool: AdaptiveTastePool, offeredAt: number): void {
  valid(bytes(pool) <= 65_536, 'serialized forecast pool budget exceeded');
  valid(pool && id(pool.id) && !state.pools.some(p => p.id === pool.id), 'pool identity already retained');
  checkScope(pool.scope);
  valid(canonical(pool.scope) === canonical(state.scope), 'foreign pool scope');
  valid(state.policy.domains.some(requirement => requirement.domain === pool.domain), 'undeclared pool domain');
  valid(time(pool.asOf) && time(pool.catalogAsOf) && pool.catalogAsOf <= pool.asOf
    && pool.asOf >= state.updatedAt && pool.asOf <= offeredAt, 'invalid pool cutoffs');
  const lastResponse = state.questions.flatMap(question => question.responses).reduce((at, response) => Math.max(at, response.availableAt), -1);
  valid(pool.asOf > lastResponse, 'new forecast must follow the accepted response cutoff');
  valid(Array.isArray(pool.prefix) && canonical(pool.prefix) === canonical(state.prefix), 'forecast prefix conflict');
  const p = pool.provenance;
  valid(p && [p.predictionId, p.modelVersion, p.baseModelVersion, p.policyVersion, p.genomeRef, p.genomeConfigRef,
    p.featureSchemaRef, p.stateRef, p.traceRef].every(id), 'complete canonical forecast provenance required');
  valid(Array.isArray(p.sourceRefs) && p.sourceRefs.length > 0 && p.sourceRefs.length <= 32 && p.sourceRefs.every(id)
    && new Set(p.sourceRefs).size === p.sourceRefs.length
    && p.sourceRefs.every(ref => state.scope.evidence.sourceIds.includes(ref)), 'forecast source authorization required');
  valid(!sourceInvalid(state, pool), 'withdrawn forecast source');
  valid(['DOMAIN_COMPLETE', 'BOUNDED_CANONICAL_POOL'].includes(pool.coverage) && Number.isSafeInteger(pool.consideredCount)
    && pool.consideredCount >= 0 && pool.consideredCount <= 100_000, 'invalid pool coverage');
  valid(Array.isArray(pool.rows) && pool.rows.length <= state.policy.maximumPoolSize
    && pool.consideredCount >= pool.rows.length
    && (pool.coverage !== 'DOMAIN_COMPLETE' || pool.consideredCount === pool.rows.length), 'complete/retained pool mismatch');
  const objects = new Set<string>(), dimensions = new Set<string>();
  let representation: string | null = null;
  for (const item of pool.rows) {
    const c = item?.candidate, o = c?.object, a = o?.artifact;
    valid(c && o && id(o.id) && !objects.has(o.id) && c.domain === pool.domain && typeof c.eligible === 'boolean'
      && time(o.availableAt) && o.availableAt <= pool.catalogAsOf && typeof item.labelSeen === 'boolean', 'invalid domain candidate');
    objects.add(o.id);
    valid(!state.pools.some(previous => previous.rows.some(old => old.candidate.object.id === o.id
      && old.candidate.domain !== c.domain)), 'canonical object domain identity drift');
    valid(a && [a.id, a.version, a.representationVersion].every(id) && ['fixture-only', 'research-only'].includes(a.use)
      && time(a.availableAt) && a.availableAt <= pool.catalogAsOf
      && (a.trainedThrough === null || time(a.trainedThrough) && a.trainedThrough <= a.availableAt)
      && Array.isArray(a.sourceRefs) && a.sourceRefs.length > 0 && a.sourceRefs.length <= 32
      && a.sourceRefs.every((ref: unknown) => typeof ref === 'string' && p.sourceRefs.includes(ref)), 'unavailable/unauthorized feature artifact');
    valid(representation === null || representation === a.representationVersion, 'incompatible feature representation');
    representation = a.representationVersion;
    valid(record(o.features) && Object.keys(o.features).length <= 64, 'invalid feature budget');
    for (const [dimension, value] of Object.entries(o.features)) {
      valid(id(dimension) && (value === null || unit(value)), 'features must be normalized or explicitly missing');
      dimensions.add(dimension);
    }
    valid(dimensions.size <= 64, 'combined feature budget exceeded');
    valid(c.recognitionPrior === null ? c.priorBasis === 'UNAVAILABLE'
      : unit(c.recognitionPrior) && ['PROVIDER_CATALOG', 'CURATED_RECOGNITION'].includes(c.priorBasis), 'invalid recognition prior');
    valid(!seenAtPrefix(state, pool, o.id) || item.labelSeen, 'a forecast cannot declare an already accepted label unseen');
    valid(item.forecast && (item.forecast.status === 'AVAILABLE' && Number.isFinite(item.forecast.score)
      || item.forecast.status === 'UNAVAILABLE' && id(item.forecast.reason)), 'finite canonical forecast or explicit missing support required');
  }
}

export function createAdaptiveTaste(input: {
  readonly scope: PredictionScope; readonly ratingScale: NumericScale; readonly at: number;
  readonly domains: readonly AdaptiveTasteDomainRequirement[];
  readonly initialKnownObjectIds?: readonly string[];
  readonly policy?: Partial<Omit<AdaptiveTastePolicy, 'domains'>>;
}): AdaptiveTasteState {
  checkScope(input.scope);
  valid(time(input.at) && input.ratingScale && Number.isFinite(input.ratingScale.min) && Number.isFinite(input.ratingScale.max)
    && input.ratingScale.max > input.ratingScale.min && Number.isFinite(input.ratingScale.max - input.ratingScale.min), 'invalid initial clock/rating scale');
  const policy: AdaptiveTastePolicy = { ...adaptiveTasteDefaults, control: 'ADAPTIVE', ...input.policy, domains: input.domains };
  checkPolicy(policy);
  const known = input.initialKnownObjectIds ?? [];
  valid(Array.isArray(known) && known.length <= 256 && known.every(id) && new Set(known).size === known.length, 'invalid initial known labels');
  const initial: AdaptiveTasteState = { version: 'adaptive-taste-reference-v1', scope: input.scope, ratingScale: input.ratingScale, policy,
    revision: 0, updatedAt: input.at, paused: false, budgetExhausted: false, initialKnownObjectIds: known,
    pools: [], questions: [], prefix: [], withdrawnSourceRefs: [], receipts: [], lastOfferStatus: null };
  valid(bytes(initial) + lifecycleReserve(initial) <= policy.maximumRetainedBytes, 'initial state/withdrawal reserve budget exceeded');
  return immutable(initial);
}

function featurePattern(candidate: TasteCandidate): string {
  const present = Object.fromEntries(Object.entries(candidate.object.features).filter(([, value]) => value !== null && value > 0));
  return Object.keys(present).length ? canonical(present) : '';
}
function similarity(a: TasteCandidate, b: TasteCandidate): number | null {
  if (a.domain !== b.domain || a.object.artifact.representationVersion !== b.object.artifact.representationVersion) return null;
  let common = 0, mass = 0;
  for (const key of new Set([...Object.keys(a.object.features), ...Object.keys(b.object.features)])) {
    const x = Object.hasOwn(a.object.features, key) ? a.object.features[key] : 0;
    const y = Object.hasOwn(b.object.features, key) ? b.object.features[key] : 0;
    if (x === null || y === null) continue;
    common += Math.min(x ?? 0, y ?? 0); mass += Math.max(x ?? 0, y ?? 0);
  }
  // No jointly observed positive mass is unknown distance, not maximum separation.
  return mass ? common / mass : null;
}
function separated(state: AdaptiveTasteState, a: TasteCandidate, b: TasteCandidate): boolean {
  const overlap = similarity(a, b);
  return !!featurePattern(a) && !!featurePattern(b) && overlap !== null
    && 1 - overlap >= state.policy.minimumFeatureDistance;
}
function supportedRows(pool: AdaptiveTastePool): readonly AdaptiveTasteForecastRow[] {
  return pool.rows.filter(item => item.candidate.eligible && !item.labelSeen && item.forecast.status === 'AVAILABLE');
}
function distinctive(state: AdaptiveTasteState, items: readonly AdaptiveTasteForecastRow[]): boolean {
  return items.some((left, index) => items.slice(index + 1).some(right => separated(state, left.candidate, right.candidate)
    && left.forecast.status === 'AVAILABLE' && right.forecast.status === 'AVAILABLE'
    && Math.abs(left.forecast.score - right.forecast.score) > state.policy.scoreTieTolerance));
}
function featureDiscriminative(state: AdaptiveTasteState, items: readonly AdaptiveTasteForecastRow[]): boolean {
  return items.some((left, index) => items.slice(index + 1).some(right => separated(state, left.candidate, right.candidate)));
}
function components(state: AdaptiveTasteState, candidate: TasteCandidate, featureSchemaRef: string,
  forecastPreference?: number): AdaptiveTasteQuestion['components'] {
  const history = effectiveQuestions(state).filter(question => question.domain === candidate.domain
    && state.pools.find(pool => pool.id === question.poolId)!.provenance.featureSchemaRef === featureSchemaRef
    && questionCandidate(state, question).object.artifact.representationVersion === candidate.object.artifact.representationVersion);
  const mass = Object.values(candidate.object.features).reduce<number>((sum, value) => sum + (value ?? 0), 0);
  let numerator = 0, denominator = 0, coverage = 0;
  for (const question of forecastPreference === undefined ? history : []) {
    const answer = latest(question)?.answer;
    if (!answer || !['RATING', 'NOT_INTERESTED'].includes(answer.kind)) continue;
    const overlap = similarity(candidate, questionCandidate(state, question)) ?? 0;
    const signed = answer.kind === 'RATING' ? (answer.value - state.ratingScale.min) / (state.ratingScale.max - state.ratingScale.min) * 2 - 1 : -1;
    numerator += overlap * signed; denominator += overlap;
  }
  for (const [key, value] of Object.entries(candidate.object.features)) {
    if (value === null) continue;
    const support = history.reduce((sum, question) => {
      const answer = latest(question)?.answer;
      const features = questionCandidate(state, question).object.features;
      return sum + (answer && ['RATING', 'NOT_INTERESTED'].includes(answer.kind) && Object.hasOwn(features, key) ? features[key] ?? 0 : 0);
    }, 0);
    coverage += mass ? value / mass / (1 + support) : 0;
  }
  const recognition = candidate.recognitionPrior ?? 0;
  const preference = forecastPreference ?? (denominator ? 0.5 + 0.5 * numerator / denominator : 0.5);
  const overlaps = history.map(question => similarity(candidate, questionCandidate(state, question)))
    .filter((value): value is number => value !== null);
  const diversity = featurePattern(candidate) && (!history.length || overlaps.length)
    ? 1 - Math.max(0, ...overlaps) : 0;
  const w = state.policy.weights;
  const utility = state.policy.control === 'PRIOR_ONLY' ? recognition
    : recognition * w.recognition + preference * w.preference + diversity * w.diversity + coverage * w.coverage;
  return { recognition, preference, diversity, coverage, utility };
}

// Scores are compared only inside one current domain panel. This ordinal
// component is neither a predicted grade nor a cross-domain score comparison.
function canonicalOrdinalPreference(item: AdaptiveTasteForecastRow, choices: readonly AdaptiveTasteForecastRow[],
  tolerance: number): number {
  if (choices.length <= 1) return 0.5;
  valid(item.forecast.status === 'AVAILABLE', 'canonical selection requires a forecast');
  const score = item.forecast.score;
  let lower = 0, tied = 0;
  for (const other of choices) {
    valid(other.forecast.status === 'AVAILABLE', 'canonical selection requires supported choices');
    const delta = other.forecast.score - score;
    if (Math.abs(delta) <= tolerance) tied++;
    else if (delta < 0) lower++;
  }
  return (lower + 0.5 * (tied - 1)) / (choices.length - 1);
}

/** Immutable first-label comparisons. A pair uses one earlier pool, never two per-step scalars. */
function evaluations(state: AdaptiveTasteState): AdaptiveTasteEvaluation[] {
  const output: AdaptiveTasteEvaluation[] = [];
  for (const [index, left] of state.questions.entries()) for (const right of state.questions.slice(index + 1)) {
    if (left.domain !== right.domain || first(left)?.answer.kind !== 'RATING' || first(right)?.answer.kind !== 'RATING') continue;
    const l = first(left)!, r = first(right)!;
    const common = [...state.pools].reverse().find(pool => pool.domain === left.domain && pool.asOf < Math.min(l.occurredAt, r.occurredAt)
      && !pool.prefix.some(ref => ref.objectId === left.objectId || ref.objectId === right.objectId)
      && [left.objectId, right.objectId].every(objectId => {
        const item = row(pool, objectId);
        return item && item.candidate.eligible && !item.labelSeen && item.forecast.status === 'AVAILABLE';
      }));
    const base = { leftObjectId: left.objectId, rightObjectId: right.objectId, domain: left.domain, poolId: common?.id ?? null };
    if (latest(left)?.revision !== 1 || latest(right)?.revision !== 1
      || sourceInvalid(state, state.pools.find(pool => pool.id === left.poolId)!)
      || sourceInvalid(state, state.pools.find(pool => pool.id === right.poolId)!) || common && sourceInvalid(state, common)) {
      output.push({ ...base, status: 'INVALIDATED', agreement: null }); continue;
    }
    if (!common) { output.push({ ...base, status: 'NO_COMMON_UNSEEN_POOL', agreement: null }); continue; }
    const a = row(common, left.objectId)!.forecast, b = row(common, right.objectId)!.forecast;
    valid(a.status === 'AVAILABLE' && b.status === 'AVAILABLE', 'internal common forecast invariant');
    valid(l.answer.kind === 'RATING' && r.answer.kind === 'RATING', 'internal first-label invariant');
    const labelDifference = l.answer.value - r.answer.value;
    const delta = a.score - b.score;
    output.push({ ...base, status: !labelDifference ? 'RATING_TIE'
      : Math.abs(delta) <= state.policy.scoreTieTolerance ? 'FORECAST_TIE' : 'COMPARABLE',
    agreement: labelDifference && Math.abs(delta) > state.policy.scoreTieTolerance
      ? Math.sign(delta) === Math.sign(labelDifference) ? 'CONCORDANT' : 'DISCORDANT' : null });
  }
  return output;
}
function stableComparisons(state: AdaptiveTasteState, domain: string, maxChange: number): number {
  const pools = state.pools.filter(pool => pool.domain === domain && !sourceInvalid(state, pool));
  let stable = 0;
  for (let index = 1; index < pools.length; index++) {
    const earlier = pools[index - 1]!, later = pools[index]!;
    const compatible = ['featureSchemaRef', 'modelVersion', 'baseModelVersion', 'policyVersion', 'genomeRef', 'genomeConfigRef'] as const;
    if (earlier.catalogAsOf !== later.catalogAsOf || compatible.some(key => earlier.provenance[key] !== later.provenance[key])
      || canonical(earlier.provenance.sourceRefs) !== canonical(later.provenance.sourceRefs)) { stable = 0; continue; }
    // Same-prefix/unknown-only refreshes must validate the latest ordering too,
    // but cannot add another learning comparison.
    const appended = later.prefix.slice(earlier.prefix.length);
    const newLearning = canonical(earlier.prefix) === canonical(later.prefix.slice(0, earlier.prefix.length))
      && appended.some(ref => {
        const q = state.questions.find(question => question.objectId === ref.objectId);
        const response = q?.responses.find(answer => answer.id === ref.responseId);
        return response && ['RATING', 'NOT_INTERESTED'].includes(response.answer.kind);
      });
    const common = supportedRows(later).filter(item => {
      const old = row(earlier, item.candidate.object.id);
      return old && old.candidate.eligible && !old.labelSeen && old.forecast.status === 'AVAILABLE'
        && old.candidate.domain === item.candidate.domain
        && canonical(old.candidate.object.artifact) === canonical(item.candidate.object.artifact)
        && canonical(old.candidate.object.features) === canonical(item.candidate.object.features);
    });
    let compared = 0, changed = 0;
    for (const [i, left] of common.entries()) for (const right of common.slice(i + 1)) {
      const a = row(earlier, left.candidate.object.id)!.forecast, b = row(earlier, right.candidate.object.id)!.forecast;
      const c = left.forecast, d = right.forecast;
      if (a.status !== 'AVAILABLE' || b.status !== 'AVAILABLE' || c.status !== 'AVAILABLE' || d.status !== 'AVAILABLE') continue;
      const before = a.score - b.score, after = c.score - d.score;
      if (Math.abs(before) <= state.policy.scoreTieTolerance || Math.abs(after) <= state.policy.scoreTieTolerance) continue;
      compared++; if (Math.sign(before) !== Math.sign(after)) changed++;
    }
    const consistent = distinctive(state, common) && compared > 0 && changed / compared <= maxChange;
    stable = consistent ? stable + (newLearning ? 1 : 0) : 0;
  }
  return stable;
}
export function inspectAdaptiveTaste(state: AdaptiveTasteState): AdaptiveTasteInspection {
  const pairs = evaluations(state);
  const domains = state.policy.domains.map(requirement => {
    const pool = state.pools.filter(p => p.domain === requirement.domain).at(-1);
    const freshPool = !!pool && canonical(pool.prefix) === canonical(state.prefix) && !sourceInvalid(state, pool);
    const prospective = pool?.rows.filter(item => item.candidate.eligible && !item.labelSeen) ?? [];
    const supported = pool ? supportedRows(pool) : [];
    const rated = effectiveQuestions(state).filter(question => question.domain === requirement.domain && latest(question)?.answer.kind === 'RATING');
    const representatives: TasteCandidate[] = [];
    for (const question of rated) {
      const candidate = questionCandidate(state, question);
      const original = state.pools.find(p => p.id === question.poolId)!;
      if (pool && original.provenance.featureSchemaRef === pool.provenance.featureSchemaRef
        && pool.rows.some(item => item.candidate.object.artifact.representationVersion === candidate.object.artifact.representationVersion)
        && featurePattern(candidate) && representatives.every(other => separated(state, other, candidate))) representatives.push(candidate);
    }
    const featurePatterns = representatives.length;
    const coverageComplete = pool?.coverage === 'DOMAIN_COMPLETE';
    const denominator = coverageComplete ? prospective.length : pool?.consideredCount ?? 0;
    const forecastCoverage = denominator ? supported.length / denominator : 0;
    const forecastCoverageBasis = !pool ? 'UNAVAILABLE' as const : coverageComplete ? 'DOMAIN_COMPLETE' as const
      : 'CONSERVATIVE_RETAINED_LOWER_BOUND' as const;
    const comparablePairs = pairs.filter(pair => pair.domain === requirement.domain && pair.status === 'COMPARABLE').length;
    const concordantPairs = pairs.filter(pair => pair.domain === requirement.domain && pair.agreement === 'CONCORDANT').length;
    const discordantPairs = pairs.filter(pair => pair.domain === requirement.domain && pair.agreement === 'DISCORDANT').length;
    const concordantFraction = comparablePairs ? concordantPairs / comparablePairs : null;
    const stable = stableComparisons(state, requirement.domain, requirement.maximumOrderChangeRatio);
    const discriminative = distinctive(state, supported);
    return { domain: requirement.domain, ratedItems: rated.length, featurePatterns, prospectiveCandidates: prospective.length,
      supportedCandidates: supported.length, forecastCoverage, comparablePairs, concordantPairs, discordantPairs, concordantFraction,
      stableComparisons: stable, freshPool, discriminative, coverageComplete, forecastCoverageBasis,
      ready: freshPool && coverageComplete && discriminative && rated.length >= requirement.minimumRatedItems
        && featurePatterns >= requirement.minimumFeaturePatterns && forecastCoverage >= requirement.minimumForecastCoverage
        && comparablePairs >= requirement.minimumComparablePairs && concordantFraction !== null
        && concordantFraction >= requirement.minimumConcordantFraction && stable >= requirement.minimumStableComparisons };
  });
  const pending = state.questions.at(-1);
  const question = pending && !first(pending) ? pending : null;
  let status: AdaptiveTasteStatus = state.paused ? 'PAUSED_INSUFFICIENT' : question ? 'QUESTION'
    : domains.every(domain => domain.ready) ? 'REFERENCE_READY'
    : state.budgetExhausted || state.questions.length >= state.policy.maximumOpportunities || state.receipts.length >= state.policy.maximumCommands
      ? 'BUDGET_EXHAUSTED_INSUFFICIENT'
      : state.lastOfferStatus === 'CATALOG_EXHAUSTED' ? 'CATALOG_EXHAUSTED_INSUFFICIENT'
        : state.lastOfferStatus === 'FORECAST_UNAVAILABLE' ? 'FORECAST_UNAVAILABLE_INSUFFICIENT'
          : state.lastOfferStatus === 'NO_INFORMATION' ? 'NO_INFORMATION_INSUFFICIENT' : 'NEEDS_SNAPSHOT';
  // A withdrawn source can invalidate the current question too; it must not accept a label.
  if (question && sourceInvalid(state, state.pools.find(pool => pool.id === question.poolId)!)) status = 'INVALIDATED_QUESTION_INSUFFICIENT';
  return immutable({ version: state.version, status, question: status === 'QUESTION' ? question : null, domains, evaluations: pairs,
    readinessBasis: 'PROVISIONAL_DOMAIN_SUPPORT_DISCRIMINATION_COVERAGE_ORDINAL_STABILITY',
    inputBasis: 'TRUSTED_AUTHORIZED_CANONICAL_FORECAST_POOLS', uncertainty: 'unavailable', nativeActivated: false, qualityAdmitted: false });
}

/** No network, evidence writer or scorer. Trusted persistence must CAS/store this result atomically. */
export function advanceAdaptiveTaste(state: AdaptiveTasteState, command: AdaptiveTasteCommand): {
  readonly state: AdaptiveTasteState; readonly replay: boolean;
} {
  valid(state?.version === 'adaptive-taste-reference-v1', 'unsupported state version');
  valid(command && id(command.requestId), 'request identity required');
  valid(['OFFER', 'ANSWER', 'CORRECT', 'WITHDRAW_SOURCE', 'PAUSE', 'RESUME'].includes(command.kind), 'unsupported command');
  if (command.kind === 'OFFER') valid(Array.isArray(command.pools) && command.pools.every(pool => record(pool) && id(pool.id)
    && record(pool.provenance) && Array.isArray(pool.rows)), 'pool packet objects required');
  valid(bytes(command) <= (command.kind === 'OFFER' ? 262_144 : 2048), 'serialized command budget exceeded');
  const signature = fingerprint(command);
  const receipt = state.receipts.find(item => item.requestId === command.requestId);
  if (receipt) {
    valid(receipt.command === signature, 'request identity conflict');
    return { state, replay: true };
  }
  valid(Number.isSafeInteger(command.expectedRevision) && command.expectedRevision === state.revision, 'state revision conflict');
  valid(time(command.at) && command.at >= state.updatedAt, 'command clock regresses');
  const lifecycle = command.kind === 'WITHDRAW_SOURCE' || command.kind === 'CORRECT' && command.answer.kind === 'WITHDRAWN';
  // Normal resource closure must still permit a final snapshot and source/label withdrawal.
  valid(lifecycle || command.kind === 'OFFER' || command.kind === 'ANSWER'
    || state.receipts.length < state.policy.maximumCommands, 'command budget exhausted');
  let next: AdaptiveTasteState = { ...state, revision: state.revision + 1, updatedAt: command.at,
    receipts: [...state.receipts, { requestId: command.requestId, command: signature }] };
  if (command.kind === 'PAUSE' || command.kind === 'RESUME') next = { ...next, paused: command.kind === 'PAUSE' };
  else if (command.kind === 'WITHDRAW_SOURCE') {
    valid(id(command.sourceRef) && state.scope.evidence.sourceIds.includes(command.sourceRef), 'unknown source withdrawal');
    valid(!state.withdrawnSourceRefs.includes(command.sourceRef), 'source already withdrawn');
    next = { ...next, withdrawnSourceRefs: [...state.withdrawnSourceRefs, command.sourceRef] };
    next = { ...next, prefix: effectivePrefix(next) };
  } else if (command.kind === 'ANSWER' || command.kind === 'CORRECT') {
    valid(!state.paused || command.kind === 'CORRECT' && command.answer.kind === 'WITHDRAWN', 'session is paused');
    const question = state.questions.find(q => q.id === command.questionId);
    valid(question && id(command.responseId) && !state.questions.some(q => q.responses.some(response => response.id === command.responseId)),
      'unknown question/reused response identity');
    valid(command.kind === 'ANSWER' ? !first(question) && question === state.questions.at(-1) : !!first(question), 'answer/correction order conflict');
    const pool = state.pools.find(p => p.id === question.poolId)!;
    valid(command.kind === 'CORRECT' && command.answer.kind === 'WITHDRAWN'
      || !sourceInvalid(state, pool), 'question forecast source was withdrawn');
    checkAnswer(command.answer, state.ratingScale);
    valid(command.kind !== 'CORRECT' || latest(question)?.answer.kind !== 'WITHDRAWN', 'withdrawn label cannot be resurrected');
    valid(command.kind !== 'CORRECT' || canonical(latest(question)?.answer) !== canonical(command.answer), 'correction supplies no changed evidence');
    valid(question.responses.length < (command.answer.kind === 'WITHDRAWN' ? 9 : 8), 'response revision budget exhausted');
    valid(command.kind !== 'ANSWER' || command.answer.kind !== 'WITHDRAWN', 'withdrawal requires an accepted response');
    valid(time(command.occurredAt) && command.occurredAt >= question.presentedAt && command.occurredAt > pool.asOf
      && command.at >= command.occurredAt && (!latest(question) || command.occurredAt >= latest(question)!.occurredAt), 'response cutoff/order conflict');
    const response: AdaptiveTasteResponse = { id: command.responseId, revision: question.responses.length + 1,
      occurredAt: command.occurredAt, availableAt: command.at, answer: command.answer };
    next = { ...next, questions: state.questions.map(q => q.id === question.id ? { ...q, responses: [...q.responses, response] } : q),
      prefix: [...state.prefix, { objectId: question.objectId, responseId: response.id, revision: response.revision }], lastOfferStatus: null };
    next = { ...next, prefix: effectivePrefix(next) };
  } else {
    valid(command.kind === 'OFFER' && !state.paused, 'unsupported command or session paused');
    const pending = state.questions.at(-1);
    valid(!pending || !!first(pending) || sourceInvalid(state, state.pools.find(pool => pool.id === pending.poolId)!),
      'current question must be answered before a new prefix');
    valid(!state.budgetExhausted, 'retained snapshot budget exhausted');
    valid(Array.isArray(command.pools) && command.pools.length > 0 && command.pools.length <= state.policy.domains.length
      && new Set(command.pools.map(pool => pool.domain)).size === command.pools.length
      && new Set(command.pools.map(pool => pool.id)).size === command.pools.length, 'invalid per-domain pool packet');
    const offeredIds = command.pools.flatMap(pool => pool.rows.map((item: AdaptiveTasteForecastRow) => item.candidate.object.id));
    valid(new Set(offeredIds).size === offeredIds.length, 'canonical object identity appears in multiple domain pools');
    for (const pool of command.pools) checkPool(state, pool, command.at);
    next = { ...next, pools: [...state.pools, ...command.pools], lastOfferStatus: null };
    if (bytes(next) + lifecycleReserve(next) > state.policy.maximumRetainedBytes) return budgetStop(state, next);
    const readiness = inspectAdaptiveTaste(next);
    if (readiness.status !== 'REFERENCE_READY' && state.questions.length < state.policy.maximumOpportunities
      && state.receipts.length + 2 <= state.policy.maximumCommands) {
      const unasked = (pool: AdaptiveTastePool) => pool.rows.filter(item => item.candidate.eligible && !item.labelSeen
        && !state.questions.some(q => q.objectId === item.candidate.object.id));
      const canonicalSelection = state.policy.selectionMode === 'CANONICAL_ORDINAL_V3';
      const choices = command.pools.flatMap(pool => {
        const supported = unasked(pool).filter(item => item.forecast.status === 'AVAILABLE');
        const items = supported.filter(item => supported.some(other => other !== item && featureDiscriminative(state, [item, other])));
        if (!featureDiscriminative(state, items)) return [];
        const support = readiness.domains.find(domain => domain.domain === pool.domain)!;
        const requirement = state.policy.domains.find(r => r.domain === pool.domain)!;
        const progress = Math.min(1, support.ratedItems / requirement.minimumRatedItems);
        const presented = state.questions.filter(question => question.domain === pool.domain).length;
        return items.map(item => ({ pool, item, progress, presented, candidateCount: items.length,
          components: components(state, item.candidate, pool.provenance.featureSchemaRef,
            canonicalSelection ? canonicalOrdinalPreference(item, items, state.policy.scoreTieTolerance) : undefined) }));
      });
      const minimumPresented = choices.length ? Math.min(...choices.map(choice => choice.presented)) : 0;
      const maximumPresented = choices.length ? Math.max(...choices.map(choice => choice.presented)) : 0;
      const coverageIntervention = canonicalSelection && maximumPresented - minimumPresented >= 2;
      const ordered = (coverageIntervention ? choices.filter(choice => choice.presented === minimumPresented) : choices)
        .sort((a, b) => (canonicalSelection
          ? b.components.utility - a.components.utility || a.progress - b.progress || a.presented - b.presented
          : a.progress - b.progress || a.presented - b.presented || b.components.utility - a.components.utility)
        || (a.pool.domain < b.pool.domain ? -1 : a.pool.domain > b.pool.domain ? 1 : 0)
        || (a.item.candidate.object.id < b.item.candidate.object.id ? -1 : 1));
      const selected = ordered[0];
      if (selected) next = { ...next, lastOfferStatus: 'OFFERED', questions: [...state.questions,
        { id: command.requestId, poolId: selected.pool.id, objectId: selected.item.candidate.object.id, domain: selected.pool.domain,
          presentedAt: command.at, components: selected.components,
          ...(canonicalSelection ? { selectionTrace: { version: 'canonical-ordinal-v3' as const,
            scoreBasis: 'WITHIN_DOMAIN_CURRENT_PANEL_TIED_MIDRANK' as const, poolId: selected.pool.id,
            preference: selected.components.preference, candidateCount: selected.candidateCount,
            coverageIntervention, minimumPresented, maximumPresented, maximumDomainLead: 2 as const } } : {}), responses: [] }] };
      else next = { ...next, lastOfferStatus: command.pools.every(pool => !unasked(pool).length) ? 'CATALOG_EXHAUSTED'
        : command.pools.every(pool => !unasked(pool).some(item => item.forecast.status === 'AVAILABLE')) ? 'FORECAST_UNAVAILABLE' : 'NO_INFORMATION' };
    }
  }
  if (!lifecycle && bytes(next) + lifecycleReserve(next) > state.policy.maximumRetainedBytes) return budgetStop(state, next);
  valid(bytes(next) <= state.policy.maximumRetainedBytes, 'retained state byte invariant');
  return { state: immutable(next), replay: false };
}

function lifecycleReserve(state: AdaptiveTasteState): number {
  // A terminal label withdrawal adds at most one <=2KiB command and response;
  // an unlabelled question also reserves its first response. Source withdrawals
  // reserve their actual bounded source IDs. No ordinary work may consume this.
  return 1024 + state.scope.evidence.sourceIds.filter(ref => !state.withdrawnSourceRefs.includes(ref)).length * 2048
    + state.questions.filter(question => latest(question)?.answer.kind !== 'WITHDRAWN')
      .reduce((total, question) => total + (first(question) ? 4096 : 8192), 0);
}
function budgetStop(previous: AdaptiveTasteState, attempted: AdaptiveTasteState): { readonly state: AdaptiveTasteState; readonly replay: boolean } {
  const stopped: AdaptiveTasteState = { ...previous, revision: attempted.revision, updatedAt: attempted.updatedAt,
    budgetExhausted: true, receipts: attempted.receipts };
  valid(bytes(stopped) <= previous.policy.maximumRetainedBytes, 'budget-stop receipt byte invariant');
  return { state: immutable(stopped), replay: false };
}
