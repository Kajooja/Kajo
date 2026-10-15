import type { SupabaseClient } from '@supabase/supabase-js';

export type TasteAnswer = { kind: 'RATING'; value: number } |
  { kind: 'UNKNOWN' | 'NOT_INTERESTED' | 'WITHDRAWN' };
export type TasteItem = { id: string; itemType: 'MOVIE' | 'BOOK'; title: string };
export type TasteCommand = {
  functionName: 'taste_session_v1' | 'taste_challenge_v1' | 'taste_session_v2';
  request: { operation: 'START' | 'RESUME' | 'ANSWER' | 'ACK_TRANSITION' | 'REMOVE' | 'NEXT' | 'PAUSE' | 'CONTINUE';
    profileId: string; sessionId?: string; challengeId?: string; requestId?: string;
    expectedRevision?: number; questionIndex?: number; questionId?: string; itemId?: string; answer?: TasteAnswer };
};
export type TasteRpc = (name: string, args: { request: TasteCommand['request'] }, signal: AbortSignal) =>
  Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
export type TastePresentation = { index: number; objectId: string; stageId: 'movies' | 'books'; answer: TasteAnswer | null };
export type TasteDecision = { kind: 'QUESTION'; itemId: string; stageId: 'movies' | 'books' } |
  { kind: 'TRANSITION' } | { kind: 'STOP'; reason: string; failOpen: boolean };
export type TasteSession = {
  sessionId: string; revision: number | null;
  status: 'ACTIVE' | 'STOPPED' | 'REMOVED' | 'CATALOG_UNAVAILABLE';
  decision: TasteDecision | null; item: TasteItem | null; presentations: readonly TastePresentation[];
  counts: { presented: number; answered: number; knownRatings: number; unknown: number; notInterested: number } | null;
};
export type TasteMetric = {
  reservedItems: number; answeredItems: number; knownRatings: number; unknown: number; notInterested: number;
  ratedPairs: number; missingForecastPairs: number; ratingTiePairs: number; forecastTiePairs: number;
  comparablePairs: number; concordantPairs: number; discordantPairs: number;
};
export type TasteChallenge = {
  sessionId: string; challengeId: string | null; revision: number | null;
  status: 'ACTIVE' | 'COMPLETE' | 'UNAVAILABLE' | 'REMOVED' | 'CATALOG_UNAVAILABLE';
  items: readonly TasteItem[]; answers: readonly { itemId: string; answer: TasteAnswer }[];
  metric: TasteMetric | null;
};
export type SequentialTasteSession = {
  sessionId: string; revision: number | null;
  status: 'QUESTION' | 'NEEDS_NEXT' | 'PAUSED' | 'STOPPED' | 'REMOVED' | 'SOURCE_WITHDRAWN';
  questionId: string | null; item: TasteItem | null; answered: number; presented: number;
};
export type TasteResponse = { kind: 'session'; value: TasteSession } | { kind: 'challenge'; value: TasteChallenge } |
  { kind: 'sequential'; value: SequentialTasteSession } |
  { kind: 'preserved'; legacySessionId: string | null };
export type TasteResult = { status: 'success'; response: TasteResponse } |
  { status: 'error'; kind: 'unavailable' | 'conflict' | 'retry' | 'invalid'; message: string };

export function createPersonalTasteRpc(client: SupabaseClient): TasteRpc {
  return async (name, args, signal) => {
    const { data, error } = await client.rpc(name, args).abortSignal(signal);
    return { data, error: error ? { message: error.message, code: error.code } : null };
  };
}

export async function sendTasteCommand(rpc: TasteRpc, command: TasteCommand, signal: AbortSignal): Promise<TasteResult> {
  try {
    const { data, error } = await rpc(command.functionName, { request: command.request }, signal);
    if (error) {
      const kind = error.code === 'PGRST202' ? 'unavailable' : error.code === '40001' ? 'conflict'
        : /^(22|23|42)/.test(error.code ?? '') ? 'invalid' : 'retry';
      return { status: 'error', kind, message: kind === 'conflict'
        ? 'Makutesti muuttui toisessa näkymässä. Lataa nykyinen vaihe ennen uutta vastausta.'
        : kind === 'unavailable' ? 'Makutestin palvelu ei ole vielä saatavilla.'
        : kind === 'invalid' ? 'Vastausta ei voitu vahvistaa. Tarkista käyttöoikeus ja lataa nykyinen vaihe.'
        : 'Vahvistusta ei saatu. Sama vastaus säilyy odottamassa; yritä uudelleen.' };
    }
    const response = command.functionName === 'taste_session_v2' ? mapSequentialTaste(data, command.request) : command.functionName === 'taste_session_v1'
      ? mapTasteSession(data, command.request) : mapTasteChallenge(data, command.request);
    return response ? { status: 'success', response } : { status: 'error', kind: 'retry',
      message: 'Palvelimen vahvistusta ei voitu tulkita. Sama vastaus säilyy odottamassa.' };
  } catch {
    return { status: 'error', kind: 'retry', message: 'Yhteys katkesi. Sama vastaus säilyy odottamassa; yritä uudelleen.' };
  }
}

export function isTasteCommand(value: unknown, profileId: string): value is TasteCommand {
  if (!record(value) || !['taste_session_v1', 'taste_challenge_v1', 'taste_session_v2'].includes(String(value.functionName)) ||
    !record(value.request) || value.request.profileId !== profileId || !uuid(profileId)) return false;
  const r = value.request;
  const sequential = value.functionName === 'taste_session_v2';
  const challenge = value.functionName === 'taste_challenge_v1';
  const operations = sequential ? ['START', 'RESUME', 'NEXT', 'ANSWER', 'PAUSE', 'CONTINUE', 'REMOVE'] : challenge ? ['START', 'RESUME', 'ANSWER', 'REMOVE'] : ['START', 'RESUME', 'ANSWER', 'ACK_TRANSITION', 'REMOVE'];
  if (!operations.includes(String(r.operation))) return false;
  const fields = ['operation', 'profileId'];
  if (challenge || r.operation !== 'START') { if (!uuid(r.sessionId)) return false; fields.push('sessionId'); }
  if (challenge && r.operation !== 'START') { if (!uuid(r.challengeId)) return false; fields.push('challengeId'); }
  if (r.operation !== 'RESUME') { if (!uuid(r.requestId)) return false; fields.push('requestId'); }
  if (r.operation !== 'START' && r.operation !== 'RESUME') {
    if (!integer(r.expectedRevision, sequential ? 256 : challenge ? 6 : 200)) return false; fields.push('expectedRevision');
  }
  if (r.operation === 'ANSWER') {
    if (!answer(r.answer, !challenge && !sequential)) return false; fields.push('answer');
    if (sequential) { if (!uuid(r.questionId)) return false; fields.push('questionId'); }
    else if (challenge) { if (!uuid(r.itemId)) return false; fields.push('itemId'); }
    else { if (!integer(r.questionIndex, 23)) return false; fields.push('questionIndex'); }
  }
  return Object.keys(r).sort().join() === fields.sort().join() && JSON.stringify(value).length <= 4096;
}

function mapTasteSession(value: unknown, request: TasteCommand['request']): TasteResponse | null {
  if (!record(value) || value.version !== 'personal-taste-session-v1' || value.profileId !== request.profileId ||
    !uuid(value.sessionId) || (request.sessionId && request.sessionId !== value.sessionId)) return null;
  const base = { sessionId: value.sessionId, decision: null, item: null, presentations: [], counts: null };
  if (value.status === 'REMOVED') return { kind: 'session', value: { ...base, status: 'REMOVED', revision: null } };
  if (!integer(value.revision, 200)) return null;
  if (value.status === 'CATALOG_UNAVAILABLE') return { kind: 'session', value: { ...base, status: 'CATALOG_UNAVAILABLE', revision: value.revision } };
  if (!['ACTIVE', 'STOPPED'].includes(String(value.status)) || value.anonymousEntry !== false ||
    value.ratingProjection !== 'TASTE_TEST_BOOTSTRAP_ONLY' || !record(value.selection) ||
    value.selection.version !== 'taste-selection-v1' || value.selection.policy !== 'ADAPTIVE' ||
    !record(value.selection.config) || value.selection.config.minimumOpportunities !== 12 ||
    value.selection.config.maximumOpportunities !== 24 || value.selection.config.minimumKnownRatings !== 8 ||
    !record(value.selection.counts) || !Array.isArray(value.presentations) || value.presentations.length > 24) return null;
  const presentations: TastePresentation[] = [];
  for (const [index, p] of value.presentations.entries()) {
    if (!record(p) || p.index !== index || !uuid(p.objectId) || !stage(p.stageId) ||
      !Array.isArray(p.responses) || p.responses.length > 8) return null;
    for (const [revision, r] of p.responses.entries()) {
      if (!record(r) || r.revision !== revision + 1 || !answer(r.answer, true)) return null;
    }
    presentations.push({ index, objectId: p.objectId, stageId: p.stageId,
      answer: p.responses.length ? (p.responses.at(-1) as { answer: TasteAnswer }).answer : null });
  }
  if (new Set(presentations.map(p => p.objectId)).size !== presentations.length) return null;
  const counts = value.selection.counts;
  const names = ['presented', 'answered', 'knownRatings', 'unknown', 'notInterested'] as const;
  if (!names.every(n => integer(counts[n], 24)) || counts.presented !== presentations.length ||
    counts.knownRatings !== presentations.filter(p => p.answer?.kind === 'RATING').length ||
    counts.unknown !== presentations.filter(p => p.answer?.kind === 'UNKNOWN').length ||
    counts.notInterested !== presentations.filter(p => p.answer?.kind === 'NOT_INTERESTED').length ||
    counts.answered !== Number(counts.knownRatings) + Number(counts.unknown) + Number(counts.notInterested)) return null;
  let decision: TasteDecision; let current: TasteItem | null = null;
  const d = value.selection.decision;
  if (!record(d)) return null;
  if (d.kind === 'QUESTION') {
    current = item(value.currentItem);
    if (value.status !== 'ACTIVE' || !stage(d.stageId) || !current || current.id !== d.itemId ||
      current.itemType !== (d.stageId === 'movies' ? 'MOVIE' : 'BOOK') ||
      presentations.at(-1)?.objectId !== current.id) return null;
    decision = { kind: 'QUESTION', itemId: current.id, stageId: d.stageId };
  } else if (d.kind === 'TRANSITION') {
    if (value.status !== 'ACTIVE' || d.fromStageId !== 'movies' || d.stageId !== 'books' || value.currentItem !== null) return null;
    decision = { kind: 'TRANSITION' };
  } else if (d.kind === 'STOP') {
    if (value.status !== 'STOPPED' || !['EXISTING_COMPLETION', 'OPPORTUNITY_LIMIT', 'SUFFICIENT_RESPONSES', 'CATALOG_EXHAUSTED'].includes(String(d.reason)) ||
      typeof d.failOpen !== 'boolean' || value.currentItem !== null) return null;
    decision = { kind: 'STOP', reason: String(d.reason), failOpen: d.failOpen };
  } else return null;
  return { kind: 'session', value: { sessionId: value.sessionId, revision: value.revision,
    status: value.status as 'ACTIVE' | 'STOPPED', decision, item: current, presentations,
    counts: Object.fromEntries(names.map(n => [n, counts[n]])) as NonNullable<TasteSession['counts']> } };
}

function mapTasteChallenge(value: unknown, request: TasteCommand['request']): TasteResponse | null {
  if (!record(value) || value.version !== 'personal-taste-challenge-v1' || value.sessionId !== request.sessionId ||
    (value.profileId !== undefined && value.profileId !== request.profileId) ||
    (value.challengeId !== null && !uuid(value.challengeId)) ||
    (request.challengeId && request.challengeId !== value.challengeId)) return null;
  const base = { sessionId: request.sessionId!, challengeId: value.challengeId as string | null, items: [], answers: [], metric: null };
  if (value.status === 'REMOVED') return { kind: 'challenge', value: { ...base, status: 'REMOVED', revision: null } };
  if (!uuid(value.challengeId) || !integer(value.revision, 6)) return null;
  if (value.status === 'CATALOG_UNAVAILABLE') return { kind: 'challenge', value: { ...base, status: 'CATALOG_UNAVAILABLE', revision: value.revision } };
  if (!['ACTIVE', 'COMPLETE', 'UNAVAILABLE'].includes(String(value.status)) || value.profileId !== request.profileId ||
    value.learningAdmission !== 'EVALUATION_ONLY' || value.anonymousEntry !== false || !record(value.frozen) ||
    !/^[a-f0-9]{64}$/.test(String(value.frozen.stateDigest)) || !/^[a-f0-9]{64}$/.test(String(value.frozen.traceDigest)) ||
    !Array.isArray(value.items) || value.items.length > 6 || !Array.isArray(value.answers) || value.answers.length > value.items.length) return null;
  const items: TasteItem[] = [];
  for (const raw of value.items) { const i = item(raw); if (!i || !record(raw) || 'forecast' in raw) return null; items.push(i); }
  if (new Set(items.map(i => i.id)).size !== items.length) return null;
  const answers: TasteChallenge['answers'][number][] = [];
  for (const raw of value.answers) {
    if (!record(raw) || !uuid(raw.itemId) || !items.some(i => i.id === raw.itemId) || !answer(raw.answer, false)) return null;
    answers.push({ itemId: raw.itemId, answer: raw.answer });
  }
  if (new Set(answers.map(a => a.itemId)).size !== answers.length || value.revision !== answers.length) return null;
  let metric: TasteMetric | null = null;
  if (value.status === 'ACTIVE') {
    if (items.length === 0 || answers.length === items.length || value.forecasts !== null || value.metric !== null) return null;
  } else {
    if (value.status === 'COMPLETE') {
      if (items.length === 0 || answers.length !== items.length || !Array.isArray(value.forecasts) || value.forecasts.length !== items.length) return null;
      for (const [index, raw] of value.forecasts.entries()) {
        if (!record(raw) || raw.id !== items[index]?.id || !record(raw.forecast) ||
          (raw.forecast.status === 'AVAILABLE' ? !finite(raw.forecast.score) || !integer(raw.forecast.rank, 50) || raw.forecast.rank === 0
            : raw.forecast.status !== 'UNAVAILABLE' || raw.forecast.reason !== 'OUTSIDE_CANONICAL_DELIVERABLE_POOL')) return null;
      }
    } else if (items.length !== 0 || answers.length !== 0 || value.forecasts !== null || value.reason !== 'NO_UNSEEN_HOLDOUTS') return null;
    const m = value.metric;
    const fields = ['reservedItems', 'answeredItems', 'knownRatings', 'unknown', 'notInterested', 'ratedPairs', 'missingForecastPairs',
      'ratingTiePairs', 'forecastTiePairs', 'comparablePairs', 'concordantPairs', 'discordantPairs'] as const;
    if (!record(m) || m.version !== 'taste-ordinal-agreement-v1' || m.target !== 'SAME_DOMAIN_RATING_ORDER' ||
      m.uncertainty !== 'UNAVAILABLE_SMALL_DEPENDENT_SAMPLE' || m.accuracyPercent !== null || m.ratingError !== null || m.qualityAdmitted !== false ||
      !fields.every(f => integer(m[f], 15)) || m.reservedItems !== items.length || m.answeredItems !== answers.length ||
      m.knownRatings !== answers.filter(a => a.answer.kind === 'RATING').length || m.unknown !== answers.filter(a => a.answer.kind === 'UNKNOWN').length ||
      m.notInterested !== answers.filter(a => a.answer.kind === 'NOT_INTERESTED').length ||
      Number(m.concordantPairs) + Number(m.discordantPairs) !== m.comparablePairs ||
      Number(m.missingForecastPairs) + Number(m.ratingTiePairs) + Number(m.forecastTiePairs) + Number(m.comparablePairs) !== m.ratedPairs ||
      m.availability !== (Number(m.comparablePairs) ? 'DESCRIPTIVE_ONLY' : 'INSUFFICIENT_COMPARABLE_PAIRS')) return null;
    metric = Object.fromEntries(fields.map(f => [f, m[f]])) as TasteMetric;
  }
  return { kind: 'challenge', value: { sessionId: base.sessionId, challengeId: value.challengeId,
    revision: value.revision, status: value.status as 'ACTIVE' | 'COMPLETE' | 'UNAVAILABLE', items, answers, metric } };
}

export function challengeResultCopy(metric: TasteMetric): readonly string[] {
  return [
    `Arvioit ${metric.knownRatings} teosta ${metric.reservedItems} teoksesta. Tuntemattomia: ${metric.unknown}. Ei kiinnosta: ${metric.notInterested}.`,
    metric.comparablePairs ? `Arvosanojesi keskinäinen järjestys vastasi Kajon ennustetta ${metric.concordantPairs} parissa. Eri järjestys: ${metric.discordantPairs} paria.`
      : 'Vertailukelpoisia arvosanapareja ei syntynyt. Tästä kierroksesta ei voi päätellä ennusteen osuvuutta.',
    `Samat arvosanat: ${metric.ratingTiePairs} paria. Ennusteen tasatilanteet: ${metric.forecastTiePairs} paria. Puuttuva ennuste: ${metric.missingForecastPairs} paria.`,
    'Vertailu koskee saman lajin teosten järjestystä. Teokset toistuvat pareissa; pieni kierros ei anna luotettavaa tarkkuusprosenttia tai epävarmuusarviota.',
  ];
}

function record(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }
export function uuid(v: unknown): v is string { return typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v); }
function integer(v: unknown, max: number): v is number { return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max; }
function finite(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v); }
function stage(v: unknown): v is 'movies' | 'books' { return v === 'movies' || v === 'books'; }
function answer(v: unknown, withdrawal: boolean): v is TasteAnswer {
  return record(v) && (v.kind === 'RATING' ? integer(v.value, 10) && Object.keys(v).sort().join() === 'kind,value'
    : ['UNKNOWN', 'NOT_INTERESTED', ...(withdrawal ? ['WITHDRAWN'] : [])].includes(String(v.kind)) && Object.keys(v).join() === 'kind');
}
function item(v: unknown): TasteItem | null {
  if (!record(v) || !uuid(v.id) || (v.itemType !== 'MOVIE' && v.itemType !== 'BOOK') ||
    typeof v.title !== 'string' || !v.title.trim() || v.title.length > 512) return null;
  return { id: v.id, itemType: v.itemType, title: v.title };
}

// Only display identity/progress crosses this boundary. Forecasts, evidence
// prefixes and pair results are server-owned and never enter the local queue.
function mapSequentialTaste(value: unknown, request: TasteCommand['request']): TasteResponse | null {
  if (!record(value) || value.version !== 'personal-taste-session-v2' || value.profileId !== request.profileId) return null;
  if (['LEGACY_V1_PRESERVED', 'EXISTING_COMPLETION'].includes(String(value.status))) {
    if (request.operation !== 'START' || request.sessionId || value.canContinueDiscovery !== true ||
      (value.status === 'LEGACY_V1_PRESERVED' && !uuid(value.legacySessionId))) return null;
    return { kind: 'preserved', legacySessionId: value.status === 'LEGACY_V1_PRESERVED' ? value.legacySessionId as string : null };
  }
  if (!uuid(value.sessionId) || (request.sessionId && request.sessionId !== value.sessionId)) return null;
  const base = { sessionId: value.sessionId, revision: null, questionId: null, item: null, answered: 0, presented: 0 };
  if (value.status === 'REMOVED') return { kind: 'sequential', value: { ...base, status: 'REMOVED' } };
  if (value.status === 'SOURCE_WITHDRAWN') return value.reloadRequired === true && request.operation !== 'RESUME'
    ? { kind: 'sequential', value: { ...base, status: 'SOURCE_WITHDRAWN' } } : null;
  if (!['QUESTION', 'NEEDS_NEXT', 'PAUSED', 'STOPPED'].includes(String(value.status)) || !integer(value.revision, 256) ||
    value.anonymousEntry !== false || value.canContinueDiscovery !== true || value.profilePreserved !== true ||
    value.ratingProjection !== 'TASTE_TEST_BOOTSTRAP_ONLY' || value.negativeProjection !== 'DISTINCT_TASTE_PRIOR_V2' ||
    !integer(value.answered, 48) || !integer(value.presented, 48) || value.answered > value.presented || value.maximumOpportunities !== 48 ||
    typeof value.acceptedAt !== 'string' || !Number.isFinite(Date.parse(value.acceptedAt)) ||
    !record(value.readiness) || value.readiness.status !== 'INSUFFICIENT' || value.readiness.qualityAdmitted !== false ||
    value.readiness.basis !== 'CONTINUOUS_LEARNING_SOURCE_V2' || value.readiness.reason !== 'FULL_READINESS_ADAPTER_NOT_ADMITTED' ||
    value.readiness.uncertainty !== null || !record(value.evaluation) || value.evaluation.metric !== 'SAME_PREFIX_ORDINAL' ||
    value.evaluation.accuracyPercent !== null || !Array.isArray(value.evaluation.pairs) || value.evaluation.pairs.length > 1128) return null;
  const current = value.status === 'QUESTION' ? item(value.currentItem) : null;
  if (value.status === 'QUESTION' ? !current || !uuid(value.questionId) || value.answered >= value.presented
    : value.currentItem !== null || value.questionId !== null) return null;
  return { kind: 'sequential', value: { sessionId: value.sessionId, revision: value.revision,
    status: value.status as SequentialTasteSession['status'], questionId: current ? value.questionId as string : null,
    item: current, answered: value.answered, presented: value.presented } };
}
