import { describe, expect, it } from 'vitest';
import { kajoTasteStages, normalizeKajoTasteSelection } from '../src/adapters/kajo-taste-selection.js';
import type { KajoTasteSelectionSnapshot } from '../src/adapters/kajo-taste-selection.js';
import { selectTasteOpportunity } from '../src/taste-selection.js';

function input(): KajoTasteSelectionSnapshot {
  return { profile: { id: 'personal', profileType: 'PERSONAL', ownerUserId: 'owner' }, actorUserId: 'owner', sessionId: 'taste',
    asOf: 1000, catalogAsOf: 100, artifact: { id: 'catalog', version: 'snapshot-1', representationVersion: 'native-binary-tags-v1',
      availableAt: 100, trainedThrough: null, sourceRefs: ['native-catalog'], use: 'research-only' },
    items: [{ id: 'movie', itemType: 'MOVIE', discoverable: true, providerKeys: ['tmdb'], availableAt: 100,
      tags: ['drama', 'drama', null], recognitionPrior: 0.9, priorBasis: 'PROVIDER_CATALOG' },
    { id: 'book', itemType: 'BOOK', discoverable: true, providerKeys: ['open_library'], availableAt: 100,
      tags: [], recognitionPrior: null, priorBasis: 'UNAVAILABLE' }],
    presentations: [], acknowledgedTransitions: [], existingCompleted: false };
}
describe('Kajo canonical Taste snapshot adapter', () => {
  it('maps only owned Personal scope, binary tags and versioned movie/book progression', () => {
    const result = normalizeKajoTasteSelection(input());
    expect(result.scope).toMatchObject({ subject: { id: 'personal', kind: 'individual' }, actingIdentityRef: 'owner', sessionRef: 'taste' });
    expect(result.ratingScale).toEqual({ min: 0, max: 10 });
    expect(result.stages).toEqual(kajoTasteStages);
    expect(result.candidates[0]!.object.features).toEqual({ drama: 1 });
    expect(result.candidates[1]!.object.features).toEqual({});
    expect(selectTasteOpportunity(result).decision).toMatchObject({ stageId: 'movies', candidate: { object: { id: 'movie' } } });
  });
  it('mock-only, missing-source and hidden canonical Items are ineligible', () => {
    for (const replacement of [{ providerKeys: ['kajo_mock'] }, { providerKeys: [] }, { discoverable: false }]) {
      const source = input();
      const result = selectTasteOpportunity(normalizeKajoTasteSelection({ ...source,
        items: [{ ...source.items[0]!, ...replacement }, source.items[1]!] }));
      expect(result.excluded.ineligibleCandidates).toBe(1);
      expect(result.decision).toMatchObject({ kind: 'TRANSITION', stageId: 'books' });
    }
  });
  it('preserves unknown/zero responses and existing completion without creating native/Working evidence', () => {
    const source = input();
    const normalized = normalizeKajoTasteSelection({ ...source, presentations: [{ objectId: 'movie', stageId: 'movies', presentedAt: 200,
      responses: [{ revision: 1, occurredAt: 201, availableAt: 201, answer: { kind: 'RATING', value: 0 } }] }] });
    expect(selectTasteOpportunity(normalized).counts.knownRatings).toBe(1);
    expect(selectTasteOpportunity(normalizeKajoTasteSelection({ ...source, existingCompleted: true })).decision)
      .toEqual({ kind: 'STOP', reason: 'EXISTING_COMPLETION', failOpen: false });
    expect(Object.keys(normalized)).not.toContain('observations');
  });
  it('rejects foreign actor, SharedProfile and incompatible/malformed canonical feature shape', () => {
    const source = input();
    expect(() => normalizeKajoTasteSelection({ ...source, actorUserId: 'intruder' })).toThrow(/own PersonalProfile/);
    expect(() => normalizeKajoTasteSelection({ ...source, profile: { ...source.profile, profileType: 'SHARED' } } as unknown as KajoTasteSelectionSnapshot)).toThrow(/own PersonalProfile/);
    expect(() => normalizeKajoTasteSelection({ ...source, artifact: { ...source.artifact, representationVersion: 'latent' } })).toThrow(/binary-tag/);
    expect(() => normalizeKajoTasteSelection({ ...source, items: [{ ...source.items[0]!, tags: [''] }] })).toThrow(/canonical tags/);
    expect(() => normalizeKajoTasteSelection({ ...source, presentations: [{ objectId: 'movie', stageId: 'movies', presentedAt: 200,
      responses: [{ revision: 1, occurredAt: 201, availableAt: 201, answer: { kind: 'RATING', value: 0.5 } }] }] })).toThrow(/integer/);
  });
  it('returns a detached immutable trusted snapshot after strict engine bounds/clock validation', () => {
    const source = input(), before = structuredClone(source);
    const normalized = normalizeKajoTasteSelection(source);
    expect(source).toEqual(before);
    expect(Object.isFrozen(normalized.candidates[0]!.object.features)).toBe(true);
    expect(normalized.candidates[0]!.object.artifact).not.toBe(source.artifact);
    expect(() => selectTasteOpportunity(normalizeKajoTasteSelection({ ...source, catalogAsOf: 2000 }))).toThrow(/cutoff/);
  });
});
