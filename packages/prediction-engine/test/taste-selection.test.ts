import { describe, expect, it } from 'vitest';
import { selectTasteOpportunity } from '../src/taste-selection.js';
import type { TasteAnswer, TasteCandidate, TastePresentation, TasteSelectionInput } from '../src/taste-selection.js';

const artifact = { id: 'catalog', version: '1', representationVersion: 'normalized-test-v1', availableAt: 100,
  trainedThrough: null, sourceRefs: ['catalog'], use: 'fixture-only' as const };
function candidate(id: string, domain = 'film', features: Record<string, number | null> = { warm: 1 }, prior: number | null = 0.8): TasteCandidate {
  return { object: { id, features, availableAt: 100, artifact }, domain, eligible: true, recognitionPrior: prior,
    priorBasis: prior === null ? 'UNAVAILABLE' : 'CURATED_RECOGNITION' };
}
function input(candidates: readonly TasteCandidate[] = [candidate('a'), candidate('b')]): TasteSelectionInput {
  return { scope: { subject: { id: 'profile', kind: 'individual' }, actingIdentityRef: 'actor', sessionRef: 'session',
    evidence: { sourceIds: ['catalog'], cohortIds: [], synthetic: 'fixture-only' } }, asOf: 1000, catalogAsOf: 100,
  ratingScale: { min: 0, max: 10 }, candidates, stages: [{ id: 'films', domains: ['film'], targetOpportunities: 12 }],
  presentations: [], acknowledgedTransitions: [], existingCompleted: false };
}
function presentation(objectId: string, answer: TasteAnswer = { kind: 'RATING', value: 8 }, stageId = 'films', at = 200): TastePresentation {
  return { objectId, stageId, presentedAt: at, responses: [{ revision: 1, occurredAt: at + 1, availableAt: at + 1, answer }] };
}
function runSession(start: TasteSelectionInput, answer: TasteAnswer): { input: TasteSelectionInput; decisions: ReturnType<typeof selectTasteOpportunity>['decision'][] } {
  let state = start;
  const decisions: ReturnType<typeof selectTasteOpportunity>['decision'][] = [];
  for (let index = 0; index < 30; index++) {
    const decision = selectTasteOpportunity(state).decision;
    decisions.push(decision);
    if (decision.kind === 'STOP') return { input: state, decisions };
    if (decision.kind === 'TRANSITION') state = { ...state, acknowledgedTransitions: [...state.acknowledgedTransitions, decision.stageId] };
    else {
      expect(decision.replay).toBe(false);
      state = { ...state, presentations: [...state.presentations,
        presentation(decision.candidate.object.id, answer, decision.stageId, 200 + state.presentations.length * 2)] };
    }
  }
  throw new Error('Unbounded Taste session');
}
describe('bounded adaptive Taste selection', () => {
  it('preserves a fixed recognition-only baseline and deterministic ties independent of catalog order', () => {
    const rows = [candidate('c', 'film', { other: 1 }, 0.7), candidate('b'), candidate('a')];
    const a = selectTasteOpportunity({ ...input(rows), policy: 'PRIOR_ONLY' });
    const b = selectTasteOpportunity({ ...input([...rows].reverse()), policy: 'PRIOR_ONLY' });
    expect(a).toEqual(b);
    expect(a.decision).toMatchObject({ kind: 'QUESTION', candidate: { object: { id: 'a' } }, components: { score: 0.8 } });
    expect(a).toMatchObject({ uncertainty: 'unavailable', nativeActivated: false, qualityAdmitted: false,
      informationBasis: 'UNCALIBRATED_FEATURE_COVERAGE_PROXY' });
  });
  it('adapts feature coverage and diversity while retaining the same prior-only control', () => {
    const state = { ...input([candidate('seen'), candidate('repeat', 'film', { warm: 1 }, 0.9),
      candidate('new', 'film', { dark: 1 }, 0.8)]), presentations: [presentation('seen')] };
    expect(selectTasteOpportunity(state).decision).toMatchObject({ kind: 'QUESTION', candidate: { object: { id: 'new' } } });
    expect(selectTasteOpportunity({ ...state, policy: 'PRIOR_ONLY' }).decision)
      .toMatchObject({ kind: 'QUESTION', candidate: { object: { id: 'repeat' } } });
  });
  it('keeps unknown distinct from negative and rating zero, with no draft rating entering coverage', () => {
    const rows = [candidate('seen'), candidate('next')];
    const unknown = selectTasteOpportunity({ ...input(rows), presentations: [presentation('seen', { kind: 'UNKNOWN' })] });
    const negative = selectTasteOpportunity({ ...input(rows), presentations: [presentation('seen', { kind: 'NOT_INTERESTED' })] });
    const zero = selectTasteOpportunity({ ...input(rows), presentations: [presentation('seen', { kind: 'RATING', value: 0 })] });
    expect(unknown.counts).toMatchObject({ knownRatings: 0, unknown: 1, notInterested: 0 });
    expect(negative.counts).toMatchObject({ knownRatings: 0, unknown: 0, notInterested: 1 });
    expect(zero.counts).toMatchObject({ knownRatings: 1, unknown: 0, notInterested: 0 });
    expect(unknown.decision).toMatchObject({ components: { informationProxy: 1 } });
    expect(negative.decision).toMatchObject({ components: { informationProxy: 0.5 } });
    expect(zero.decision).toMatchObject({ components: { informationProxy: 0.5 } });
  });
  it('replays an unanswered current opportunity instead of consuming another slot', () => {
    const state = { ...input(), presentations: [{ ...presentation('a'), responses: [] }] };
    const result = selectTasteOpportunity(state);
    expect(result.decision).toMatchObject({ kind: 'QUESTION', replay: true, candidate: { object: { id: 'a' } }, components: null });
    expect(result.counts).toMatchObject({ presented: 1, unanswered: 1 });
    expect(selectTasteOpportunity(state)).toEqual(result);
  });
  it('freezes presentation order through extension, 10 first-domain opportunities, transition, 10 second-domain opportunities', () => {
    const rows = Array.from({ length: 14 }, (_, i) => candidate(`film-${i.toString().padStart(2, '0')}`))
      .concat(Array.from({ length: 14 }, (_, i) => candidate(`book-${i.toString().padStart(2, '0')}`, 'book')));
    const stages = [{ id: 'films', domains: ['film'], targetOpportunities: 10 }, { id: 'books', domains: ['book'], targetOpportunities: 10 }];
    const run = runSession({ ...input(rows), stages }, { kind: 'RATING', value: 0 });
    expect(run.input.presentations).toHaveLength(20);
    expect(run.input.presentations.slice(0, 10).every(row => row.stageId === 'films')).toBe(true);
    expect(run.input.presentations.slice(10).every(row => row.stageId === 'books')).toBe(true);
    expect(run.decisions.filter(step => step.kind === 'TRANSITION')).toEqual([{ kind: 'TRANSITION', fromStageId: 'films', stageId: 'books' }]);
    expect(run.decisions.at(-1)).toEqual({ kind: 'STOP', reason: 'SUFFICIENT_RESPONSES', failOpen: false });
    expect(new Set(run.input.presentations.map(row => row.objectId)).size).toBe(20);
  });
  it('extends low-recognition sessions to 24 without moving or repeating previous opportunities', () => {
    const rows = Array.from({ length: 30 }, (_, i) => candidate(`row-${i.toString().padStart(2, '0')}`));
    const run = runSession(input(rows), { kind: 'UNKNOWN' });
    expect(run.input.presentations).toHaveLength(24);
    expect(new Set(run.input.presentations.map(row => row.objectId)).size).toBe(24);
    expect(run.decisions.at(-1)).toEqual({ kind: 'STOP', reason: 'OPPORTUNITY_LIMIT', failOpen: true });
    const firstTwelve = run.input.presentations.slice(0, 12).map(row => row.objectId);
    expect(firstTwelve).toEqual(Array.from({ length: 12 }, (_, i) => `row-${i.toString().padStart(2, '0')}`));
  });
  it('fails open on a small or empty catalog rather than forcing known ratings', () => {
    const run = runSession(input(), { kind: 'UNKNOWN' });
    expect(run.input.presentations).toHaveLength(2);
    expect(run.decisions.at(-1)).toEqual({ kind: 'STOP', reason: 'CATALOG_EXHAUSTED', failOpen: true });
    expect(selectTasteOpportunity(input([])).decision).toEqual({ kind: 'STOP', reason: 'CATALOG_EXHAUSTED', failOpen: true });
  });
  it('transitions over an exhausted first domain and supports a configured synthetic non-media task', () => {
    const rows = Array.from({ length: 12 }, (_, i) => candidate(`pump-${i}`, 'pump', { energy: i % 2, vibration: 1 }));
    const state = { ...input(rows), scope: { ...input().scope, subject: { id: 'factory', kind: 'system' as const } },
      ratingScale: { min: -1, max: 1 }, stages: [{ id: 'valves', domains: ['valve'], targetOpportunities: 1 },
        { id: 'pumps', domains: ['pump'], targetOpportunities: 11 }] };
    const run = runSession(state, { kind: 'RATING', value: -1 });
    expect(run.decisions[0]).toEqual({ kind: 'TRANSITION', fromStageId: 'valves', stageId: 'pumps' });
    expect(run.decisions.at(-1)).toEqual({ kind: 'STOP', reason: 'SUFFICIENT_RESPONSES', failOpen: false });
  });
  it('reuses an already-completed setup without forcing another calibration', () => {
    expect(selectTasteOpportunity({ ...input(), existingCompleted: true }).decision)
      .toEqual({ kind: 'STOP', reason: 'EXISTING_COMPLETION', failOpen: false });
  });
  it('handles absent features/priors neutrally and excludes future catalog inputs at the frozen cutoff', () => {
    const future = { ...candidate('future'), object: { ...candidate('future').object, availableAt: 101 } };
    const featureFuture = { ...candidate('artifact-future'), object: { ...candidate('artifact-future').object,
      artifact: { ...artifact, availableAt: 101 } } };
    const result = selectTasteOpportunity(input([future, featureFuture, candidate('missing', 'film', { absent: null }, null),
      { ...candidate('hidden'), eligible: false }]));
    expect(result.excluded).toMatchObject({ futureCandidates: 2, ineligibleCandidates: 1 });
    expect(result.decision).toMatchObject({ candidate: { object: { id: 'missing' } },
      components: { recognitionPrior: 0, diversity: 0, informationProxy: 0, score: 0 } });
    expect(selectTasteOpportunity({ ...input([future]), asOf: 5000 }).decision.kind).toBe('STOP');
  });
  it('unavailable future/hidden representations and dimensions cannot invalidate an available prefix', () => {
    const future = { ...candidate('future', 'film', Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`future-${i}`, 1]))),
      object: { ...candidate('future').object, features: Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`future-${i}`, 1])),
        availableAt: 101, artifact: { ...artifact, representationVersion: 'future-v2' } } };
    const hidden = { ...candidate('hidden'), eligible: false,
      object: { ...candidate('hidden').object, artifact: { ...artifact, representationVersion: 'hidden-v3' } } };
    expect(selectTasteOpportunity(input([future, hidden, candidate('available')])).decision)
      .toMatchObject({ kind: 'QUESTION', candidate: { object: { id: 'available' } } });
  });
  it('resolves latest visible corrections and withdrawal without restoring stale taste or repeating earlier Items', () => {
    const first = presentation('a');
    const correction = { revision: 2, occurredAt: 220, availableAt: 220, answer: { kind: 'UNKNOWN' as const } };
    const state = { ...input([candidate('a'), candidate('b'), candidate('c')]),
      presentations: [{ ...first, responses: [...first.responses, correction] }, presentation('b', { kind: 'UNKNOWN' }, 'films', 250)] };
    const corrected = selectTasteOpportunity(state);
    expect(corrected.counts).toMatchObject({ knownRatings: 0, unknown: 2 });
    expect(corrected.decision).toMatchObject({ candidate: { object: { id: 'c' } }, components: { informationProxy: 1 } });
    const withdrawal = selectTasteOpportunity({ ...state, presentations: [{ ...first,
      responses: [...first.responses, { ...correction, occurredAt: 300, availableAt: 300, answer: { kind: 'WITHDRAWN' } }] }, state.presentations[1]!] });
    expect(withdrawal.counts).toMatchObject({ knownRatings: 0, withdrawn: 1, unknown: 1 });
    expect(withdrawal.decision).toMatchObject({ candidate: { object: { id: 'c' } } });
    const currentWithdrawal = selectTasteOpportunity({ ...input(), presentations: [{ ...first,
      responses: [...first.responses, { ...correction, answer: { kind: 'WITHDRAWN' } }] }] });
    expect(currentWithdrawal.decision).toMatchObject({ replay: true, candidate: { object: { id: 'a' } } });
  });
  it('future corrections cannot contaminate a past prefix, and duplicate revisions add no support', () => {
    const first = presentation('a', { kind: 'RATING', value: 0 });
    const future = { revision: 2, occurredAt: 1100, availableAt: 1100, answer: { kind: 'UNKNOWN' as const } };
    const result = selectTasteOpportunity({ ...input(), presentations: [{ ...first,
      responses: [...first.responses, first.responses[0]!, future] }] });
    expect(result.counts.knownRatings).toBe(1);
    expect(result.excluded.futureResponses).toBe(1);
    expect(result.decision).toMatchObject({ components: { informationProxy: 0.5 } });
  });
  it('rejects contradictory revisions, regressing clocks, invalid scales and incompatible feature versions', () => {
    const first = presentation('a');
    expect(() => selectTasteOpportunity({ ...input(), presentations: [{ ...first, responses: [...first.responses,
      { ...first.responses[0]!, answer: { kind: 'RATING', value: 0 } }] }] })).toThrow(/conflicting response/);
    expect(() => selectTasteOpportunity({ ...input(), presentations: [{ ...first, responses: [...first.responses,
      { ...first.responses[0]!, revision: 2, occurredAt: 200, availableAt: 200 }] }] })).toThrow(/clocks regress/);
    expect(() => selectTasteOpportunity({ ...input(), presentations: [presentation('a', { kind: 'RATING', value: 11 })] })).toThrow(/outside declared scale/);
    expect(() => selectTasteOpportunity(input([candidate('a'), { ...candidate('b'), object: { ...candidate('b').object,
      artifact: { ...artifact, representationVersion: 'foreign' } } }]))).toThrow(/incompatible feature/);
  });
  it('rejects unsafe bounds, repeated presentations, unsupported group scope and premature transitions', () => {
    expect(() => selectTasteOpportunity({ ...input(), config: { maximumOpportunities: 25 } })).toThrow(/bounds/);
    expect(() => selectTasteOpportunity({ ...input(), presentations: [presentation('a'), presentation('a', { kind: 'UNKNOWN' }, 'films', 250)] })).toThrow(/repeated presentation/);
    expect(() => selectTasteOpportunity({ ...input(), scope: { ...input().scope, subject: { id: 'shared', kind: 'group' } } })).toThrow(/individual/);
    expect(() => selectTasteOpportunity({ ...input(), stages: [{ id: 'films', domains: ['film'], targetOpportunities: 10 },
      { id: 'books', domains: ['book'], targetOpportunities: 10 }], acknowledgedTransitions: ['books'] })).toThrow(/transition before/);
  });
  it('requires a terminal answer before advancing and rejects excess nonfinal-stage presentations', () => {
    expect(() => selectTasteOpportunity({ ...input(), presentations: [{ ...presentation('a'), responses: [] }, presentation('b')] }))
      .toThrow(/precedes prior answer/);
    const first = presentation('a');
    expect(() => selectTasteOpportunity({ ...input(), presentations: [{ ...first, responses: [...first.responses,
      { revision: 2, occurredAt: 220, availableAt: 220, answer: { kind: 'WITHDRAWN' } }] },
    presentation('b', { kind: 'UNKNOWN' }, 'films', 250)] })).toThrow(/precedes prior answer/);
    const rows = Array.from({ length: 13 }, (_, i) => candidate(String(i)));
    const state = { ...input(rows), stages: [{ id: 'films', domains: ['film'], targetOpportunities: 10 },
      { id: 'books', domains: ['book'], targetOpportunities: 10 }],
    presentations: rows.slice(0, 11).map((row, index) => presentation(row.object.id, { kind: 'UNKNOWN' }, 'films', 200 + index * 2)) };
    expect(() => selectTasteOpportunity(state)).toThrow(/nonfinal stage exceeds/);
  });
  it('can acknowledge multiple genuinely empty stages without inventing their presentations', () => {
    const state = { ...input([candidate('a', 'third')]), stages: [
      { id: 'one', domains: ['first'], targetOpportunities: 4 },
      { id: 'two', domains: ['second'], targetOpportunities: 4 },
      { id: 'three', domains: ['third'], targetOpportunities: 4 }], acknowledgedTransitions: ['two', 'three'] };
    const result = selectTasteOpportunity(state);
    expect(result.decision).toMatchObject({ kind: 'QUESTION', stageId: 'three' });
    expect(selectTasteOpportunity({ ...state, presentations: [presentation('a', { kind: 'UNKNOWN' }, 'three')] }).decision)
      .toEqual({ kind: 'STOP', reason: 'CATALOG_EXHAUSTED', failOpen: true });
  });
  it('treats feature names as dictionary keys without inherited-prototype influence', () => {
    const own = JSON.parse('{"warm":1,"constructor":1,"__proto__":1,"toString":1}') as Record<string, number>;
    const result = selectTasteOpportunity({ ...input([candidate('seen', 'film', { warm: 1 }), candidate('a', 'film', own)]),
      presentations: [presentation('seen')] });
    expect(result.decision).toMatchObject({ components: { diversity: 0.75, informationProxy: 0.875 } });
  });
  it('rejects malformed/nonfinite features, ambiguous priors and oversized catalog/feature budgets', () => {
    expect(() => selectTasteOpportunity(input([candidate('a', 'film', { warm: Number.NaN })]))).toThrow(/normalized/);
    expect(() => selectTasteOpportunity(input([{ ...candidate('a'), priorBasis: 'UNAVAILABLE' }]))).toThrow(/prior/);
    expect(() => selectTasteOpportunity(input(Array.from({ length: 257 }, (_, i) => candidate(String(i)))))).toThrow(/catalog/);
    expect(() => selectTasteOpportunity(input([candidate('a', 'film', Object.fromEntries(Array.from({ length: 65 }, (_, i) => [String(i), 1])))]))).toThrow(/feature budget/);
  });
  it('does not mutate caller data and returns detached deeply immutable decisions', () => {
    const state = input();
    const before = structuredClone(state);
    const result = selectTasteOpportunity(state);
    expect(state).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.decision)).toBe(true);
    if (result.decision.kind === 'QUESTION') {
      expect(result.decision.candidate).not.toBe(state.candidates[0]);
      expect(Object.isFrozen(result.decision.candidate.object.features)).toBe(true);
    }
  });
});
