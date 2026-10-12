import type { TasteAnswer } from './personalTasteOperations';
export const id = (n: number) => `a1157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const profileId = id(10);
export const sessionId = id(20);
export const challengeId = id(30);
export function sessionResponse(answers: readonly TasteAnswer[] = [], decision: 'QUESTION' | 'TRANSITION' | 'STOP' = 'QUESTION', reason = 'SUFFICIENT_RESPONSES') {
  const presentations = [...answers.map((answer, index) => ({ index, objectId: id(100 + index), stageId: 'movies',
    responses: [{ revision: 1, occurredAt: 1000, availableAt: 1000, answer }] })),
  ...(decision === 'QUESTION' ? [{ index: answers.length, objectId: id(100 + answers.length), stageId: 'movies', responses: [] }] : [])];
  return { version: 'personal-taste-session-v1', profileId, sessionId, revision: answers.length + 1,
    status: decision === 'STOP' ? 'STOPPED' : 'ACTIVE', anonymousEntry: false, ratingProjection: 'TASTE_TEST_BOOTSTRAP_ONLY',
    selection: { version: 'taste-selection-v1', policy: 'ADAPTIVE',
      config: { minimumOpportunities: 12, maximumOpportunities: 24, minimumKnownRatings: 8 },
      counts: { presented: presentations.length, answered: answers.filter(a => a.kind !== 'WITHDRAWN').length,
        knownRatings: answers.filter(a => a.kind === 'RATING').length, unknown: answers.filter(a => a.kind === 'UNKNOWN').length,
        notInterested: answers.filter(a => a.kind === 'NOT_INTERESTED').length },
      decision: decision === 'QUESTION' ? { kind: decision, stageId: 'movies', itemId: id(100 + answers.length), replay: true }
        : decision === 'TRANSITION' ? { kind: decision, stageId: 'books', fromStageId: 'movies' }
        : { kind: decision, reason, failOpen: false } }, presentations,
    currentItem: decision === 'QUESTION' ? { id: id(100 + answers.length), itemType: 'MOVIE', title: `Title ${answers.length + 1}` } : null };
}
export function challengeResponse(answers: readonly TasteAnswer[] = []) {
  const items = [0, 1, 2].map(n => ({ id: id(200 + n), itemType: 'BOOK', title: `Book ${n + 1}` }));
  const complete = answers.length === items.length;
  return { version: 'personal-taste-challenge-v1', profileId, sessionId, challengeId, revision: answers.length,
    status: complete ? 'COMPLETE' : 'ACTIVE', learningAdmission: 'EVALUATION_ONLY', anonymousEntry: false,
    frozen: { stateDigest: 'a'.repeat(64), traceDigest: 'b'.repeat(64) }, items,
    answers: answers.map((answer, n) => ({ itemId: items[n]!.id, answer, receivedAt: 2000 + n })),
    forecasts: complete ? items.map((item, n) => ({ ...item, forecast: { status: 'AVAILABLE', score: n, rank: n + 1 } })) : null,
    metric: complete ? { version: 'taste-ordinal-agreement-v1', target: 'SAME_DOMAIN_RATING_ORDER',
      reservedItems: 3, answeredItems: 3, knownRatings: 2, unknown: 1, notInterested: 0,
      ratedPairs: 1, missingForecastPairs: 0, ratingTiePairs: 0, forecastTiePairs: 0, comparablePairs: 1,
      concordantPairs: 1, discordantPairs: 0, availability: 'DESCRIPTIVE_ONLY',
      uncertainty: 'UNAVAILABLE_SMALL_DEPENDENT_SAMPLE', accuracyPercent: null, ratingError: null, qualityAdmitted: false } : null };
}
