import { describe, expect, it } from 'vitest';
import { advanceAdaptiveTaste, createAdaptiveTaste, inspectAdaptiveTaste } from '../src/adaptive-taste.js';
import type { AdaptiveTasteCommand, AdaptiveTasteDomainRequirement, AdaptiveTasteForecastRow, AdaptiveTastePool, AdaptiveTasteState } from '../src/adaptive-taste.js';
import type { TasteAnswer } from '../src/taste-selection.js';

const scope = { subject: { id: 'personal', kind: 'individual' as const }, actingIdentityRef: 'owner', sessionRef: 'taste',
  evidence: { sourceIds: ['catalog', 'replacement-catalog'], cohortIds: [], synthetic: 'fixture-only' as const } };
const artifact = { id: 'features', version: '1', representationVersion: 'fixture-metadata-v1', availableAt: 10,
  trainedThrough: null, sourceRefs: ['catalog'], use: 'fixture-only' as const };
const requirement = (domain = 'MOVIE'): AdaptiveTasteDomainRequirement => ({ domain, minimumRatedItems: 2,
  minimumFeaturePatterns: 2, minimumForecastCoverage: 0.75, minimumComparablePairs: 1,
  minimumConcordantFraction: 0.6,
  minimumStableComparisons: 1, maximumOrderChangeRatio: 0 });
function create(domains = [requirement()], control: 'ADAPTIVE' | 'PRIOR_ONLY' = 'ADAPTIVE'): AdaptiveTasteState {
  return createAdaptiveTaste({ scope, at: 100, ratingScale: { min: 0, max: 10 }, domains, policy: { control } });
}
function candidate(id: string, features: Record<string, number | null>, score: number | null, domain = 'MOVIE', recognition = 0.8): AdaptiveTasteForecastRow {
  return { candidate: { domain, eligible: true, recognitionPrior: recognition, priorBasis: 'CURATED_RECOGNITION',
    object: { id, availableAt: 10, features, artifact } }, labelSeen: false,
  forecast: score === null ? { status: 'UNAVAILABLE', reason: 'OUTSIDE_CANONICAL_POOL' } : { status: 'AVAILABLE', score } };
}
const rows = () => [candidate('a', { warm: 1 }, 4), candidate('b', { dark: 1 }, 3),
  candidate('c', { warm: 1, era: 0.5 }, 2), candidate('d', { dark: 1, era: 1 }, 1), candidate('e', { other: 1 }, 0)];
function pool(state: AdaptiveTasteState, entries = rows(), domain = 'MOVIE', suffix = ''): AdaptiveTastePool {
  const id = `pool-${state.revision}-${domain}${suffix}`;
  return { id, scope: state.scope, domain, asOf: state.updatedAt + 1, catalogAsOf: 10, prefix: state.prefix,
    provenance: { predictionId: `prediction-${id}`, modelVersion: 'canonical-v1', baseModelVersion: 'base-v1',
      policyVersion: 'serving-v1', genomeRef: 'genome', genomeConfigRef: 'genome-config', featureSchemaRef: 'metadata-schema',
      stateRef: `state-${id}`, traceRef: `trace-${id}`, sourceRefs: ['catalog'] },
    coverage: 'DOMAIN_COMPLETE', consideredCount: entries.length, rows: entries.map(item => ({ ...item,
      labelSeen: state.initialKnownObjectIds.includes(item.candidate.object.id)
        || state.prefix.some(ref => ref.objectId === item.candidate.object.id) })) };
}
function offer(state: AdaptiveTasteState, pools: readonly AdaptiveTastePool[] = [pool(state)]): AdaptiveTasteState {
  return advanceAdaptiveTaste(state, { kind: 'OFFER', requestId: `offer-${state.revision}`, expectedRevision: state.revision,
    at: state.updatedAt + 2, pools }).state;
}
function respond(state: AdaptiveTasteState, answer: TasteAnswer = { kind: 'RATING', value: 8 }, questionId = state.questions.at(-1)!.id): AdaptiveTasteState {
  return advanceAdaptiveTaste(state, { kind: 'ANSWER', requestId: `answer-${state.revision}`, responseId: `response-${state.revision}`,
    expectedRevision: state.revision, at: state.updatedAt + 2, occurredAt: state.updatedAt + 1, questionId, answer }).state;
}
function correct(state: AdaptiveTasteState, questionId: string, answer: TasteAnswer): AdaptiveTasteState {
  return advanceAdaptiveTaste(state, { kind: 'CORRECT', requestId: `correct-${state.revision}`, responseId: `revision-${state.revision}`,
    expectedRevision: state.revision, at: state.updatedAt + 2, occurredAt: state.updatedAt + 1, questionId, answer }).state;
}
function readyFixture(): AdaptiveTasteState {
  let state = create();
  state = respond(offer(state), { kind: 'RATING', value: 10 });
  state = offer(state); const selected = state.questions.at(-1)!.objectId;
  state = respond(state, { kind: 'RATING', value: selected === 'c' ? 7 : 3 });
  return offer(state);
}

describe('sequential adaptive Taste reference', () => {
  it('does not turn missing overlapping features into evidence of distinct taste', () => {
    const initial = create();
    const missing = [candidate('a', { warm: 1, dark: null }, 2), candidate('b', { warm: null, dark: 1 }, 1)];
    const inspected = inspectAdaptiveTaste(offer(initial, [pool(initial, missing)]));
    expect(inspected).toMatchObject({ status: 'NO_INFORMATION_INSUFFICIENT', domains: [{ discriminative: false, ready: false }] });
  });

  it('keeps old responses but does not transfer feature support across representation or schema changes', () => {
    const answered = respond(offer(create()), { kind: 'RATING', value: 10 });
    for (const change of ['representation', 'schema']) {
      const next = pool(answered, rows().map(item => ({ ...item, candidate: { ...item.candidate,
        object: { ...item.candidate.object, artifact: { ...artifact,
          representationVersion: change === 'representation' ? 'new-space' : artifact.representationVersion } } } })));
      const changed = offer(answered, [{ ...next, provenance: { ...next.provenance,
        featureSchemaRef: change === 'schema' ? 'new-schema' : next.provenance.featureSchemaRef } }]);
      expect(changed.questions.at(-1)!.components.preference).toBe(0.5);
      expect(changed.questions.at(-1)!.components.coverage).toBe(1);
      expect(inspectAdaptiveTaste(changed).domains[0]).toMatchObject({ ratedItems: 1, featurePatterns: 0, ready: false });
      expect(changed.questions[0]).toEqual(answered.questions[0]);
    }
  });

  it('is isolated, deterministic and deeply immutable, with no native/quality admission', () => {
    const initial = create(); const input = pool(initial); const before = structuredClone(input);
    const a = offer(initial, [input]);
    const b = offer(initial, [{ ...input, rows: [...input.rows].reverse() }]);
    expect(a.questions).toEqual(b.questions);
    expect(input).toEqual(before); expect(initial.questions).toEqual([]);
    expect(Object.isFrozen(a.pools[0]!.rows[0]!.candidate.object.features)).toBe(true);
    expect(inspectAdaptiveTaste(a)).toMatchObject({ status: 'QUESTION', nativeActivated: false,
      qualityAdmitted: false, uncertainty: 'unavailable' });
  });

  it('uses genuine 0 versus 10 magnitude to change the next choice when the features permit it', () => {
    const entries = [candidate('anchor', { warm: 1 }, 4, 'MOVIE', 1), candidate('similar', { warm: 1 }, 3),
      candidate('different', { dark: 1 }, 1)];
    const initial = create(); const first = offer(initial, [pool(initial, entries)]);
    expect(first.questions[0]!.objectId).toBe('anchor');
    const positive = respond(first, { kind: 'RATING', value: 10 });
    const negative = respond(first, { kind: 'RATING', value: 0 });
    const afterPositive = offer(positive, [pool(positive, entries)]);
    const afterNegative = offer(negative, [pool(negative, entries)]);
    expect(afterPositive.questions.at(-1)!.objectId).toBe('similar');
    expect(afterNegative.questions.at(-1)!.objectId).toBe('different');
    expect(afterPositive.questions.at(-1)!.components.preference).toBe(1);
    expect(inspectAdaptiveTaste(negative).domains[0]!.ratedItems).toBe(1);
  });

  it('keeps PRIOR_ONLY fixed on the exact same prospective prefix and pools', () => {
    const entries = [candidate('anchor', { warm: 1 }, 4, 'MOVIE', 1), candidate('similar', { warm: 1 }, 3, 'MOVIE', 0.9),
      candidate('different', { dark: 1 }, 1, 'MOVIE', 0.8)];
    const run = (control: 'ADAPTIVE' | 'PRIOR_ONLY') => {
      let state = create([requirement()], control);
      state = respond(offer(state, [pool(state, entries)]), { kind: 'RATING', value: 0 });
      return offer(state, [pool(state, entries)]);
    };
    const adaptive = run('ADAPTIVE'), control = run('PRIOR_ONLY');
    expect(adaptive.pools.at(-1)!.prefix).toEqual(control.pools.at(-1)!.prefix);
    expect(adaptive.pools.at(-1)!.rows).toEqual(control.pools.at(-1)!.rows);
    expect(adaptive.questions.at(-1)!.objectId).toBe('different');
    expect(control.questions.at(-1)!.objectId).toBe('similar');
    expect(control.questions.at(-1)!.components.utility).toBe(0.9);
    // Fixture policy divergence is executable reference evidence, not a real-world win.
    expect(inspectAdaptiveTaste(adaptive).qualityAdmitted).toBe(false);
  });

  it('keeps unknown, neutral, not-interest and missing features separate from learned ratings', () => {
    const first = offer(create());
    const unknown = respond(first, { kind: 'UNKNOWN' });
    const neutral = respond(first, { kind: 'RATING', value: 5 });
    const negative = respond(first, { kind: 'NOT_INTERESTED' });
    expect(inspectAdaptiveTaste(unknown).domains[0]!.ratedItems).toBe(0);
    expect(inspectAdaptiveTaste(neutral).domains[0]!.ratedItems).toBe(1);
    expect(inspectAdaptiveTaste(negative).domains[0]!.ratedItems).toBe(0);
    const missed = create();
    expect(inspectAdaptiveTaste(offer(missed, [pool(missed, [candidate('a', { absent: null }, 2), candidate('b', {}, 1)])])).status)
      .toBe('NO_INFORMATION_INSUFFICIENT');
  });

  it('retains one unanswered question through resume, exact retries and current-state replay', () => {
    const initial = create(); const command: AdaptiveTasteCommand = { kind: 'OFFER', requestId: 'one',
      expectedRevision: 0, at: 102, pools: [pool(initial)] };
    const accepted = advanceAdaptiveTaste(initial, command).state;
    const retry = advanceAdaptiveTaste(accepted, command);
    expect(retry).toEqual({ state: accepted, replay: true });
    expect(retry.state).toBe(accepted);
    expect(() => offer(accepted)).toThrow(/current question/);
    const answered = respond(accepted);
    const later = advanceAdaptiveTaste(answered, command);
    expect(later.state).toBe(answered); expect(later.state.questions).toHaveLength(1);
    expect(inspectAdaptiveTaste(later.state).status).toBe('NEEDS_SNAPSHOT');
    expect(() => advanceAdaptiveTaste(accepted, { ...command, at: 103 })).toThrow(/identity conflict/);
    expect(() => advanceAdaptiveTaste(answered, { ...command, requestId: 'other' })).toThrow(/revision conflict/);
  });

  it('requires exact new-prefix identities and a snapshot strictly after every accepted response', () => {
    const first = respond(offer(create()));
    expect(() => offer(first, [{ ...pool(first), prefix: [] }])).toThrow(/prefix conflict/);
    expect(() => offer(first, [{ ...pool(first), prefix: [{ ...first.prefix[0]!, responseId: 'wrong' }] }])).toThrow(/prefix conflict/);
    expect(() => offer(first, [{ ...pool(first), asOf: first.updatedAt }])).toThrow(/must follow/);
    const second = respond(offer(first));
    expect(() => offer(second, [{ ...pool(second), prefix: [...second.prefix].reverse() }])).toThrow(/prefix conflict/);
    expect(() => offer(first, [{ ...pool(first), rows: rows() }])).toThrow(/already accepted label unseen/);
  });

  it('never compares raw per-step scores and selects one common earlier unseen pool', () => {
    let state = create();
    state = respond(offer(state), { kind: 'RATING', value: 10 });
    const firstPool = structuredClone(state.pools[0]);
    const changed = pool(state, rows().map(item => item.forecast.status === 'AVAILABLE'
      ? { ...item, forecast: { status: 'AVAILABLE' as const, score: 1000 - item.forecast.score } } : item));
    state = offer(state, [changed]);
    state = respond(state, { kind: 'RATING', value: 1 });
    const pairs = inspectAdaptiveTaste(state).evaluations;
    expect(pairs).toEqual([{ leftObjectId: state.questions[0]!.objectId, rightObjectId: state.questions[1]!.objectId,
      domain: 'MOVIE', poolId: firstPool!.id, status: 'COMPARABLE', agreement: 'CONCORDANT' }]);
    expect(state.pools[0]).toEqual(firstPool);
    expect(inspectAdaptiveTaste(state).domains[0]!.stableComparisons).toBe(0);
  });

  it('does not create a metric when candidate pools never shared both unseen labels', () => {
    let state = create();
    state = respond(offer(state, [pool(state, [candidate('a', { warm: 1 }, 4), candidate('x', { dark: 1 }, 1)])]));
    state = offer(state, [pool(state, [candidate('b', { warm: 1 }, 4), candidate('y', { dark: 1 }, 1)])]);
    state = respond(state, { kind: 'RATING', value: 1 });
    expect(inspectAdaptiveTaste(state).evaluations).toMatchObject([{ status: 'NO_COMMON_UNSEEN_POOL', poolId: null, agreement: null }]);
  });

  it('invalidates corrected/withdrawn label evaluations without rewriting frozen forecasts', () => {
    let state = create(); state = respond(offer(state), { kind: 'RATING', value: 10 });
    state = respond(offer(state), { kind: 'RATING', value: 1 });
    expect(inspectAdaptiveTaste(state).evaluations[0]!.status).toBe('COMPARABLE');
    const oldPools = structuredClone(state.pools);
    const corrected = correct(state, state.questions[0]!.id, { kind: 'RATING', value: 0 });
    expect(inspectAdaptiveTaste(corrected).evaluations[0]).toMatchObject({ status: 'INVALIDATED', agreement: null });
    const withdrawn = correct(state, state.questions[0]!.id, { kind: 'WITHDRAWN' });
    expect(inspectAdaptiveTaste(withdrawn).evaluations[0]).toMatchObject({ status: 'INVALIDATED', agreement: null });
    expect(inspectAdaptiveTaste(withdrawn).domains[0]!.comparablePairs).toBe(0);
    expect(corrected.pools).toEqual(oldPools); expect(withdrawn.pools).toEqual(oldPools);
    expect(() => offer(corrected, [{ ...pool(corrected), prefix: state.prefix }])).toThrow(/prefix conflict/);
  });

  it('source withdrawal invalidates current evaluations and refuses new use of copied pools', () => {
    let state = create(); state = respond(offer(state), { kind: 'RATING', value: 10 });
    state = respond(offer(state), { kind: 'RATING', value: 1 });
    const withdrawn = advanceAdaptiveTaste(state, { kind: 'WITHDRAW_SOURCE', requestId: 'erase', expectedRevision: state.revision,
      at: state.updatedAt + 1, sourceRef: 'catalog' }).state;
    expect(inspectAdaptiveTaste(withdrawn).evaluations[0]).toMatchObject({ status: 'INVALIDATED', agreement: null });
    expect(inspectAdaptiveTaste(withdrawn).domains[0]!.ready).toBe(false);
    expect(() => offer(withdrawn)).toThrow(/withdrawn forecast source/);
  });

  it('cannot claim reference readiness from many identical genre vectors or forecast ties', () => {
    const initial = create();
    const genre = Array.from({ length: 24 }, (_, i) => candidate(`same-${i}`, { genre: 1 }, i));
    expect(inspectAdaptiveTaste(offer(initial, [pool(initial, genre)])).status).toBe('NO_INFORMATION_INSUFFICIENT');
    const tied = inspectAdaptiveTaste(offer(initial, [pool(initial, rows().map(item => ({ ...item,
      forecast: { status: 'AVAILABLE', score: 42 } }))) ]));
    expect(tied.status).toBe('QUESTION');
    expect(tied.domains[0]).toMatchObject({ ready: false, discriminative: false });
    const mixed = offer(initial, [pool(initial, rows().map(item => item.candidate.object.id === 'a'
      ? item : { ...item, forecast: { status: 'UNAVAILABLE' as const, reason: 'NO_NATIVE_SUPPORT' } }))]);
    expect(inspectAdaptiveTaste(mixed).domains[0]).toMatchObject({ supportedCandidates: 1, forecastCoverage: 0.2,
      ready: false, discriminative: false });
  });

  it('readiness needs fresh evidence, feature discrimination, actual prospective pairs, coverage and stability', () => {
    const ready = readyFixture();
    expect(inspectAdaptiveTaste(ready)).toMatchObject({ status: 'REFERENCE_READY', qualityAdmitted: false });
    expect(inspectAdaptiveTaste(ready).domains[0]).toMatchObject({ ratedItems: 2, featurePatterns: 2, comparablePairs: 1,
      freshPool: true, discriminative: true, ready: true });
    const withoutFresh = { ...ready, pools: ready.pools.slice(0, -1), receipts: ready.receipts.slice(0, -1) };
    expect(inspectAdaptiveTaste(withoutFresh).domains[0]!.ready).toBe(false);
    expect(inspectAdaptiveTaste(withoutFresh).status).toBe('NEEDS_SNAPSHOT');
  });

  it('never completes MOVIE+BOOK coverage using MOVIE evidence alone', () => {
    let state = create([requirement('MOVIE'), requirement('BOOK')]);
    state = respond(offer(state), { kind: 'RATING', value: 10 });
    state = respond(offer(state), { kind: 'RATING', value: 1 });
    state = offer(state);
    expect(inspectAdaptiveTaste(state).domains.find(domain => domain.domain === 'BOOK')).toMatchObject({ ratedItems: 0,
      freshPool: false, forecastCoverage: 0, ready: false });
    expect(inspectAdaptiveTaste(state).status).not.toBe('REFERENCE_READY');
    const unsupported = create([requirement('MOVIE'), requirement('BOOK')]);
    const missingBooks = [candidate('book-a', { dark: 1 }, null, 'BOOK'), candidate('book-b', { warm: 1 }, null, 'BOOK')];
    const next = offer(unsupported, [pool(unsupported), pool(unsupported, missingBooks, 'BOOK')]);
    expect(inspectAdaptiveTaste(next).domains[1]).toMatchObject({ freshPool: true, supportedCandidates: 0, ready: false });
  });

  it('prioritizes an under-supported declared domain without manufacturing cross-domain pairs', () => {
    let state = create([requirement('MOVIE'), requirement('BOOK')]);
    const books = rows().map(item => ({ ...item, candidate: { ...item.candidate, domain: 'BOOK',
      object: { ...item.candidate.object, id: `book-${item.candidate.object.id}` } } }));
    state = respond(offer(state), { kind: 'RATING', value: 10 });
    state = offer(state, [pool(state), pool(state, books, 'BOOK')]);
    expect(state.questions.at(-1)!.domain).toBe('BOOK');
    state = respond(state, { kind: 'RATING', value: 0 });
    expect(inspectAdaptiveTaste(state).evaluations).toEqual([]);
  });

  it('works for a non-media system and an explicit non-0..10 scale', () => {
    let state = createAdaptiveTaste({ scope: { ...scope, subject: { id: 'factory', kind: 'system' } }, at: 100,
      ratingScale: { min: -1, max: 1 }, domains: [requirement('pump')] });
    const pumps = [candidate('efficient', { energy: 1 }, 2, 'pump'), candidate('quiet', { noise: 1 }, 1, 'pump'),
      candidate('mixed', { energy: 0.5, noise: 1 }, 0, 'pump')];
    state = respond(offer(state, [pool(state, pumps, 'pump')]), { kind: 'RATING', value: -1 });
    state = offer(state, [pool(state, pumps, 'pump')]);
    expect(state.questions.at(-1)!.domain).toBe('pump');
    expect(inspectAdaptiveTaste(state).nativeActivated).toBe(false);
    expect(() => respond(state, { kind: 'RATING', value: 10 })).toThrow(/declared scale/);
  });

  it('reports pause, catalogue, unsupported forecast and exhausted budgets as insufficient', () => {
    const initial = create();
    expect(inspectAdaptiveTaste(offer(initial, [pool(initial, [])])).status).toBe('CATALOG_EXHAUSTED_INSUFFICIENT');
    expect(inspectAdaptiveTaste(offer(initial, [pool(initial, rows().map(item => ({ ...item,
      forecast: { status: 'UNAVAILABLE', reason: 'UNAVAILABLE' } })))])).status).toBe('FORECAST_UNAVAILABLE_INSUFFICIENT');
    const q = offer(initial);
    const paused = advanceAdaptiveTaste(q, { kind: 'PAUSE', requestId: 'pause', expectedRevision: q.revision, at: q.updatedAt + 1 }).state;
    expect(inspectAdaptiveTaste(paused)).toMatchObject({ status: 'PAUSED_INSUFFICIENT', question: null });
    expect(() => respond(paused)).toThrow(/paused/);
    const resumed = advanceAdaptiveTaste(paused, { kind: 'RESUME', requestId: 'resume', expectedRevision: paused.revision, at: paused.updatedAt + 1 }).state;
    expect(inspectAdaptiveTaste(resumed).question).toEqual(q.questions[0]);
    let limited = createAdaptiveTaste({ scope, at: 100, ratingScale: { min: 0, max: 10 }, domains: [requirement()],
      policy: { maximumOpportunities: 2 } });
    limited = respond(offer(limited), { kind: 'UNKNOWN' });
    limited = respond(offer(limited), { kind: 'UNKNOWN' });
    expect(inspectAdaptiveTaste(limited).status).toBe('BUDGET_EXHAUSTED_INSUFFICIENT');
    const checked = offer(limited);
    expect(checked.questions).toHaveLength(2);
    expect(inspectAdaptiveTaste(checked).status).toBe('BUDGET_EXHAUSTED_INSUFFICIENT');
  });

  it('rejects foreign scope, future/malformed provenance, fake complete coverage and mixed domains', () => {
    const initial = create(); const valid = pool(initial);
    expect(() => offer(initial, [{ ...valid, scope: { ...scope, actingIdentityRef: 'other' } }])).toThrow(/foreign/);
    expect(() => offer(initial, [{ ...valid, asOf: 500 }])).toThrow(/cutoff/);
    expect(() => offer(initial, [{ ...valid, provenance: { ...valid.provenance, traceRef: '' } }])).toThrow(/provenance/);
    expect(() => offer(initial, [{ ...valid, provenance: { ...valid.provenance, sourceRefs: ['foreign'] } }])).toThrow(/authorization/);
    expect(() => offer(initial, [{ ...valid, consideredCount: 900 }])).toThrow(/complete\/retained/);
    expect(() => offer(initial, [{ ...valid, consideredCount: 1, rows: [candidate('a', { warm: 1 }, 1, 'BOOK')] }])).toThrow(/domain candidate/);
    expect(() => offer(initial, [{ ...valid, consideredCount: 1, rows: [candidate('a', { warm: Number.NaN }, 1)] }])).toThrow(/normalized/);
    expect(() => offer(initial, [{ ...valid, consideredCount: 1, rows: [candidate('a', { warm: 1 }, Infinity)] }])).toThrow(/finite canonical/);
  });

  it('prevents answer-before-forecast, backwards timestamps, reused response IDs and unseen-label leakage', () => {
    const state = offer(create()); const q = state.questions[0]!;
    const base: AdaptiveTasteCommand = { kind: 'ANSWER', requestId: 'answer', responseId: 'r', expectedRevision: state.revision,
      at: state.updatedAt + 2, occurredAt: state.updatedAt + 1, questionId: q.id, answer: { kind: 'RATING', value: 0 } };
    expect(() => advanceAdaptiveTaste(state, { ...base, occurredAt: state.pools[0]!.asOf })).toThrow(/cutoff/);
    expect(() => advanceAdaptiveTaste(state, { ...base, at: 0 })).toThrow(/clock/);
    const answered = advanceAdaptiveTaste(state, base).state;
    expect(() => advanceAdaptiveTaste(answered, { ...base, kind: 'CORRECT', requestId: 'correct', expectedRevision: answered.revision,
      at: answered.updatedAt + 1, occurredAt: answered.updatedAt + 1 })).toThrow(/reused response/);
    const known = createAdaptiveTaste({ scope, at: 100, ratingScale: { min: 0, max: 10 }, domains: [requirement()], initialKnownObjectIds: ['a'] });
    expect(() => offer(known, [{ ...pool(known), rows: rows() }])).toThrow(/already accepted label unseen/);
  });

  it('treats tiny score differences and labels tied at zero as ties, never stable-ID predictions', () => {
    let state = create();
    const entries = [candidate('a', { warm: 1 }, 1), candidate('b', { dark: 1 }, 1 + 1e-10), candidate('c', { other: 1 }, 2)];
    state = respond(offer(state, [pool(state, entries)]), { kind: 'RATING', value: 0 });
    state = respond(offer(state, [pool(state, entries)]), { kind: 'RATING', value: 0 });
    expect(inspectAdaptiveTaste(state).evaluations[0]).toMatchObject({ status: 'RATING_TIE', agreement: null });
    const ids = state.questions.map(q => q.objectId);
    expect(ids).toEqual(['a', 'b']);
    const revised = correct(state, state.questions[1]!.id, { kind: 'RATING', value: 10 });
    expect(inspectAdaptiveTaste(revised).evaluations[0]!.status).toBe('INVALIDATED');
  });

  it('validates explicitly declared readiness and resource bounds instead of accepting quantity-only settings', () => {
    expect(() => createAdaptiveTaste({ scope, at: 100, ratingScale: { min: 0, max: 10 }, domains: [{ ...requirement(), minimumFeaturePatterns: 1 }] })).toThrow(/readiness/);
    expect(() => createAdaptiveTaste({ scope, at: 100, ratingScale: { min: 0, max: 10 }, domains: [{ ...requirement(), minimumComparablePairs: 0 }] })).toThrow(/readiness/);
    expect(() => createAdaptiveTaste({ scope, at: 100, ratingScale: { min: 0, max: 10 }, domains: [requirement()], policy: { maximumOpportunities: 1000 } })).toThrow(/bounds/);
    expect(() => createAdaptiveTaste({ scope: { ...scope, subject: { id: 'group', kind: 'group' } }, at: 100,
      ratingScale: { min: 0, max: 10 }, domains: [requirement()] })).toThrow(/individual\/system/);
  });

  it('can learn from a true tied cold start while forecast ties still prevent readiness', () => {
    const initial = create();
    const cold = rows().map(item => ({ ...item, forecast: { status: 'AVAILABLE' as const, score: 0 } }));
    const first = offer(initial, [pool(initial, cold)]);
    expect(inspectAdaptiveTaste(first)).toMatchObject({ status: 'QUESTION', domains: [{ discriminative: false, ready: false }] });
    const accepted = respond(first, { kind: 'RATING', value: 10 });
    const learned = offer(accepted, [pool(accepted)]);
    expect(learned.questions).toHaveLength(2);
    expect(learned.questions.at(-1)!.components.preference).toBe(1);
    expect(inspectAdaptiveTaste(learned).domains[0]!.ready).toBe(false);
  });

  it('source withdrawal removes ghost preferences/support and permits a new valid-source question', () => {
    let state = respond(offer(create()), { kind: 'RATING', value: 10 });
    const oldPools = structuredClone(state.pools);
    state = advanceAdaptiveTaste(state, { kind: 'WITHDRAW_SOURCE', requestId: 'withdraw', expectedRevision: state.revision,
      at: state.updatedAt + 1, sourceRef: 'catalog' }).state;
    expect(state.prefix).toEqual([]);
    const entries = [candidate('new-warm', { warm: 1 }, 3), candidate('new-dark', { dark: 1 }, 1)];
    const next = pool(state, entries);
    state = offer(state, [{ ...next, provenance: { ...next.provenance, sourceRefs: ['replacement-catalog'] },
      rows: next.rows.map(item => ({ ...item, candidate: { ...item.candidate, object: { ...item.candidate.object,
        artifact: { ...artifact, id: 'new-features', sourceRefs: ['replacement-catalog'] } } } })) }]);
    expect(state.questions.at(-1)!.components.preference).toBe(0.5);
    expect(inspectAdaptiveTaste(state).domains[0]).toMatchObject({ ratedItems: 0, featurePatterns: 0, comparablePairs: 0, ready: false });
    expect(state.pools[0]).toEqual(oldPools[0]);
    expect(() => respond(state, { kind: 'RATING', value: 1 }, state.questions[0]!.id)).toThrow(/order conflict/);
  });

  it('invalidated pending questions cannot accept a label but do not trap new valid sources', () => {
    let state = offer(create()); const pending = state.questions[0]!;
    state = advanceAdaptiveTaste(state, { kind: 'WITHDRAW_SOURCE', requestId: 'withdraw-pending', expectedRevision: state.revision,
      at: state.updatedAt + 1, sourceRef: 'catalog' }).state;
    expect(inspectAdaptiveTaste(state)).toMatchObject({ status: 'INVALIDATED_QUESTION_INSUFFICIENT', question: null });
    expect(() => respond(state)).toThrow(/source was withdrawn/);
    const valid = pool(state, [candidate('new-a', { warm: 1 }, 2), candidate('new-b', { dark: 1 }, 1)]);
    state = offer(state, [{ ...valid, provenance: { ...valid.provenance, sourceRefs: ['replacement-catalog'] },
      rows: valid.rows.map(item => ({ ...item, candidate: { ...item.candidate, object: { ...item.candidate.object,
        artifact: { ...artifact, sourceRefs: ['replacement-catalog'] } } } })) }]);
    expect(inspectAdaptiveTaste(state).status).toBe('QUESTION');
    expect(state.questions[0]).toEqual(pending);
    expect(state.questions.at(-1)!.id).not.toBe(pending.id);
  });

  it('chooses the latest common pre-label pool for later pairs, never the initial cold-start pool forever', () => {
    let state = create([{ ...requirement(), minimumRatedItems: 3 }]);
    const entries = [candidate('a', { warm: 1 }, 4, 'MOVIE', 1), candidate('b', { warm: 1, era: 0.5 }, 3),
      candidate('c', { dark: 1 }, 1), candidate('d', { other: 1 }, 0)];
    state = respond(offer(state, [pool(state, entries)]), { kind: 'RATING', value: 10 });
    const newer = pool(state, entries.map(item => ({ ...item, forecast: { status: 'AVAILABLE' as const,
      score: item.candidate.object.id === 'b' ? 1 : item.candidate.object.id === 'c' ? 3 : 0 } })));
    state = respond(offer(state, [newer]), { kind: 'RATING', value: 1 });
    expect(state.questions[1]!.objectId).toBe('b');
    state = respond(offer(state, [pool(state, entries)]), { kind: 'RATING', value: 9 });
    expect(state.questions[2]!.objectId).toBe('c');
    const comparison = inspectAdaptiveTaste(state).evaluations.find(pair => pair.leftObjectId === 'b' && pair.rightObjectId === 'c');
    expect(comparison).toMatchObject({ poolId: newer.id, status: 'COMPARABLE', agreement: 'CONCORDANT' });
  });

  it('does not count same-prefix or unknown-only refreshes as new stability evidence, and an inversion resets it', () => {
    const ready = readyFixture(); const count = inspectAdaptiveTaste(ready).domains[0]!.stableComparisons;
    const refreshed = offer(ready);
    expect(inspectAdaptiveTaste(refreshed).domains[0]!.stableComparisons).toBe(count);
    const inverted = offer(refreshed, [pool(refreshed, rows().map(item => item.forecast.status === 'AVAILABLE'
      ? { ...item, forecast: { status: 'AVAILABLE' as const, score: -item.forecast.score } } : item))]);
    expect(inspectAdaptiveTaste(inverted).domains[0]).toMatchObject({ stableComparisons: 0, ready: false });
    const unknown = respond(offer(create()), { kind: 'UNKNOWN' });
    expect(inspectAdaptiveTaste(offer(unknown)).domains[0]!.stableComparisons).toBe(0);
  });

  it('requires full metadata/feature compatibility for stability and real feature separation for readiness', () => {
    const ready = readyFixture();
    for (const key of ['baseModelVersion', 'policyVersion', 'genomeRef', 'genomeConfigRef', 'featureSchemaRef'] as const) {
      const next = pool(ready);
      const changed = offer(ready, [{ ...next, provenance: { ...next.provenance, [key]: 'different' } }]);
      expect(inspectAdaptiveTaste(changed).domains[0]).toMatchObject({ stableComparisons: 0, ready: false });
    }
    const drift = pool(ready, rows().map(item => ({ ...item, candidate: { ...item.candidate,
      object: { ...item.candidate.object, features: { ...item.candidate.object.features, missing: 0 } } } })));
    expect(inspectAdaptiveTaste(offer(ready, [drift])).domains[0]!.stableComparisons).toBe(0);
    const initial = create();
    const near = [candidate('almost-a', { genre: 1, tiny: 0.5 }, 2), candidate('almost-b', { genre: 1, tiny: 0.5 + 1e-12 }, 1)];
    expect(inspectAdaptiveTaste(offer(initial, [pool(initial, near)])).status).toBe('NO_INFORMATION_INSUFFICIENT');
  });

  it('does not treat consistently discordant supported forecasts as reference-ready', () => {
    let state = create();
    state = respond(offer(state), { kind: 'RATING', value: 0 });
    state = respond(offer(state), { kind: 'RATING', value: 10 });
    const final = offer(state);
    expect(inspectAdaptiveTaste(final).domains[0]).toMatchObject({ concordantPairs: 0, discordantPairs: 1,
      concordantFraction: 0, ready: false });
    expect(inspectAdaptiveTaste(final).status).not.toBe('REFERENCE_READY');
  });

  it('bounded retained pools can ask questions but cannot hide missing domain-wide forecast coverage', () => {
    const ready = readyFixture(); const bounded = pool(ready);
    const state = offer(ready, [{ ...bounded, coverage: 'BOUNDED_CANONICAL_POOL', consideredCount: 1000 }]);
    expect(inspectAdaptiveTaste(state).domains[0]).toMatchObject({ coverageComplete: false,
      forecastCoverageBasis: 'CONSERVATIVE_RETAINED_LOWER_BOUND', ready: false });
    expect(inspectAdaptiveTaste(state).domains[0]!.forecastCoverage).toBeLessThan(0.01);
    expect(inspectAdaptiveTaste(state).status).not.toBe('REFERENCE_READY');
  });

  it('permits the final fresh snapshot and label/source withdrawal after normal command/opportunity budgets', () => {
    let state = createAdaptiveTaste({ scope, at: 100, ratingScale: { min: 0, max: 10 }, domains: [requirement()],
      policy: { maximumOpportunities: 2, maximumCommands: 4 } });
    state = respond(offer(state), { kind: 'RATING', value: 10 });
    state = respond(offer(state), { kind: 'RATING', value: 7 });
    const checked = offer(state);
    expect(checked.questions).toHaveLength(2);
    expect(inspectAdaptiveTaste(checked).status).toBe('REFERENCE_READY');
    const withdrawn = correct(checked, checked.questions[0]!.id, { kind: 'WITHDRAWN' });
    expect(inspectAdaptiveTaste(withdrawn).domains[0]!.ready).toBe(false);
    const erased = advanceAdaptiveTaste(withdrawn, { kind: 'WITHDRAW_SOURCE', requestId: 'erase-at-cap',
      expectedRevision: withdrawn.revision, at: withdrawn.updatedAt + 1, sourceRef: 'catalog' }).state;
    expect(inspectAdaptiveTaste(erased).domains[0]!.ratedItems).toBe(0);
  });

  it('enforces the serialized state limit, reserves withdrawal space and fingerprints exact rejected-offer retries', () => {
    let state = createAdaptiveTaste({ scope, at: 100, ratingScale: { min: 0, max: 10 }, domains: [requirement()],
      policy: { maximumRetainedBytes: 24_576 } });
    state = respond(offer(state), { kind: 'RATING', value: 10 });
    const command: AdaptiveTasteCommand = { kind: 'OFFER', requestId: 'overflow-offer', expectedRevision: state.revision,
      at: state.updatedAt + 2, pools: [pool(state)] };
    state = advanceAdaptiveTaste(state, command).state;
    expect(inspectAdaptiveTaste(state).status).toBe('BUDGET_EXHAUSTED_INSUFFICIENT');
    expect(new TextEncoder().encode(JSON.stringify(state)).length).toBeLessThanOrEqual(24_576);
    expect(advanceAdaptiveTaste(state, command)).toEqual({ state, replay: true });
    expect(() => advanceAdaptiveTaste(state, { ...command, pools: [{ ...command.pools[0]!, consideredCount: 999 }] })).toThrow(/identity conflict/);
    const withdrawn = correct(state, state.questions[0]!.id, { kind: 'WITHDRAWN' });
    const erased = advanceAdaptiveTaste(withdrawn, { kind: 'WITHDRAW_SOURCE', requestId: 'erase-overflow', expectedRevision: withdrawn.revision,
      at: withdrawn.updatedAt + 1, sourceRef: 'catalog' }).state;
    expect(new TextEncoder().encode(JSON.stringify(erased)).length).toBeLessThanOrEqual(24_576);
    const known = Array.from({ length: 256 }, (_, index) => `${index}`.padEnd(256, 'x'));
    expect(() => createAdaptiveTaste({ scope, at: 100, ratingScale: { min: 0, max: 10 }, domains: [requirement()],
      initialKnownObjectIds: known, policy: { maximumRetainedBytes: 16_384 } })).toThrow(/initial state/);
  });

  it('command fingerprints match standard SHA-256 and cannot accept compact malformed replay bodies', async () => {
    const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
      : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
        : JSON.stringify(value) ?? 'undefined';
    const initial = create(); const p = pool(initial, [candidate('ää-🐈', { 'voima-🐈': 1 }, 2), candidate('other', { dark: 1 }, 1)]);
    const command: AdaptiveTasteCommand = { kind: 'OFFER', requestId: 'unicode', expectedRevision: 0, at: 102, pools: [p] };
    const state = advanceAdaptiveTaste(initial, command).state;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(command)));
    const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    expect(state.receipts[0]!.command).toBe(`sha256:${expected}`);
    expect(() => advanceAdaptiveTaste(state, { ...command, pools: [p.id] } as unknown as AdaptiveTasteCommand)).toThrow(/pool packet objects/);
  });

  it('never reuses historical response IDs after effective prefix withdrawal', () => {
    let state = respond(offer(create()), { kind: 'RATING', value: 0 });
    const oldResponseId = state.prefix[0]!.responseId;
    state = correct(state, state.questions[0]!.id, { kind: 'WITHDRAWN' });
    expect(state.prefix).toEqual([]);
    state = offer(state);
    expect(() => advanceAdaptiveTaste(state, { kind: 'ANSWER', requestId: 'reuse', responseId: oldResponseId,
      expectedRevision: state.revision, at: state.updatedAt + 2, occurredAt: state.updatedAt + 1,
      questionId: state.questions.at(-1)!.id, answer: { kind: 'RATING', value: 5 } })).toThrow(/reused response/);
  });

  it('rejects release-before-training artefacts and normalizes wide finite scales without overflow', () => {
    const initial = create(); const bad = pool(initial, rows().map(item => ({ ...item, candidate: { ...item.candidate,
      object: { ...item.candidate.object, artifact: { ...artifact, trainedThrough: 11 } } } })));
    expect(() => offer(initial, [bad])).toThrow(/feature artifact/);
    expect(() => createAdaptiveTaste({ scope, at: 100, ratingScale: { min: -1e308, max: 1e308 }, domains: [requirement()] })).toThrow(/rating scale/);
    let wide = createAdaptiveTaste({ scope, at: 100, ratingScale: { min: -1e308, max: 0 }, domains: [requirement()] });
    wide = respond(offer(wide), { kind: 'RATING', value: 0 });
    wide = offer(wide);
    expect(Number.isFinite(wide.questions.at(-1)!.components.utility)).toBe(true);
    expect(wide.questions.at(-1)!.components.preference).toBe(1);
  });

  it('rejects duplicate canonical object identities across domain pools and later domain drift', () => {
    const initial = create([requirement('MOVIE'), requirement('BOOK')]);
    const books = rows().map(item => ({ ...item, candidate: { ...item.candidate, domain: 'BOOK' } }));
    expect(() => offer(initial, [pool(initial), pool(initial, books, 'BOOK')])).toThrow(/multiple domain pools/);
    const answered = respond(offer(initial));
    expect(() => offer(answered, [pool(answered, books, 'BOOK')])).toThrow(/domain identity drift/);
  });

  it('non-media numeric feedback changes next policy choice while the same-prefix control stays fixed', () => {
    const entries = [candidate('anchor', { energy: 1 }, 3, 'pump', 1), candidate('similar', { energy: 1 }, 2, 'pump', 0.9),
      candidate('quiet', { noise: 1 }, 1, 'pump', 0.8)];
    const run = (value: number, control: 'ADAPTIVE' | 'PRIOR_ONLY' = 'ADAPTIVE') => {
      let state = createAdaptiveTaste({ scope: { ...scope, subject: { id: 'factory', kind: 'system' } }, at: 100,
        ratingScale: { min: -1, max: 1 }, domains: [requirement('pump')], policy: { control } });
      state = respond(offer(state, [pool(state, entries, 'pump')]), { kind: 'RATING', value });
      return offer(state, [pool(state, entries, 'pump')]);
    };
    const positive = run(1), negative = run(-1), control = run(-1, 'PRIOR_ONLY');
    expect(positive.questions.at(-1)!.objectId).toBe('similar');
    expect(negative.questions.at(-1)!.objectId).toBe('quiet');
    expect(control.questions.at(-1)!.objectId).toBe('similar');
    expect(control.pools.at(-1)!.prefix).toEqual(negative.pools.at(-1)!.prefix);
    const scored = respond(negative, { kind: 'RATING', value: 1 });
    expect(inspectAdaptiveTaste(scored).evaluations[0]).toMatchObject({ domain: 'pump', poolId: negative.pools[0]!.id,
      status: 'COMPARABLE', agreement: 'DISCORDANT' });
    expect(inspectAdaptiveTaste(scored).domains[0]).toMatchObject({ ratedItems: 2, featurePatterns: 2, freshPool: false, ready: false });
  });

  it('projects 24 cumulative prefixes without recursively revisiting their full dependency DAG', () => {
    let state = createAdaptiveTaste({ scope, at: 100, ratingScale: { min: 0, max: 10 },
      domains: [{ ...requirement(), minimumRatedItems: 32 }] });
    const entries = Array.from({ length: 40 }, (_, i) => candidate(`item-${String(i).padStart(2, '0')}`, { [`dimension-${i}`]: 1 }, 40 - i));
    for (let i = 0; i < 24; i++) {
      state = respond(offer(state, [pool(state, entries)]), { kind: 'RATING', value: i % 2 ? 0 : 10 });
    }
    expect(state.questions).toHaveLength(24);
    expect(state.prefix).toHaveLength(24);
    expect(inspectAdaptiveTaste(state).domains[0]).toMatchObject({ ratedItems: 24, ready: false });
    const erased = advanceAdaptiveTaste(state, { kind: 'WITHDRAW_SOURCE', requestId: 'large-erasure', expectedRevision: state.revision,
      at: state.updatedAt + 1, sourceRef: 'catalog' }).state;
    expect(erased.prefix).toEqual([]);
    expect(inspectAdaptiveTaste(erased).domains[0]!.ratedItems).toBe(0);
  });

  it('allows terminal label withdrawal while paused and leaves no evaluable copied label', () => {
    let state = respond(offer(create()), { kind: 'RATING', value: 10 });
    state = advanceAdaptiveTaste(state, { kind: 'PAUSE', requestId: 'paused', expectedRevision: state.revision, at: state.updatedAt + 1 }).state;
    state = correct(state, state.questions[0]!.id, { kind: 'WITHDRAWN' });
    expect(state.prefix).toEqual([]);
    expect(inspectAdaptiveTaste(state)).toMatchObject({ status: 'PAUSED_INSUFFICIENT', domains: [{ ratedItems: 0, ready: false }] });
  });
});
