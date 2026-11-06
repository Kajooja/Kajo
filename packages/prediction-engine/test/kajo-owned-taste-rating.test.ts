import { describe, expect, it } from 'vitest';
import { normalizeKajoOwnedTasteRatingPrefix as normalize } from '../src/adapters/kajo-owned-taste-rating.js';
import type { KajoOwnedTasteRatingPrefix, KajoOwnedTasteRatingLabel } from '../src/adapters/kajo-owned-taste-rating.js';
import { normalizeKajoPersonalContentRatingPrefix, personalContentFeatureContract } from '../src/adapters/kajo-personal-content-rating.js';
import { forecastPersonalContentRating } from '../src/personal-content-rating.js';

type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const id = (n: number) => `a4320000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function fixture(grades = [0, 10]): Mutable<KajoOwnedTasteRatingPrefix> {
  const cutoff = '1793952000000000', accepted = '1793951900000000', snapshotId = `native-owned-content:${'a'.repeat(32)}`;
  const labels: Mutable<KajoOwnedTasteRatingLabel>[] = grades.map((rating, n) => ({
    itemId: id(n + 20), sourceBootstrapId: id(n + 40), sourceStatus: 'OWNED_TASTE_RATING',
    orderingBasis: 'ACCEPTED_SEQUENTIAL_TASTE_RESPONSE', bootstrap: {
      id: id(n + 40), actorUserId: id(1), profileId: id(2), itemId: id(n + 20), itemType: 'MOVIE',
      sourceProvider: 'KAJO_CALIBRATION', datasetKind: 'TASTE_SESSION_V2', evidenceKind: 'RATED', rating,
      sourceJobId: id(3), sessionId: id(4), sessionVersion: 'personal-taste-session-v2', questionId: id(n + 60),
      panelId: id(n + 80), responseId: id(n + 100), responseRevision: 1, commandHash: 'c'.repeat(32),
      acceptedAtMicros: accepted, availableAtMicros: accepted, experienceTime: 'UNKNOWN',
    },
  }));
  return { version: 'kajo-personal-content-rating-prefix-v2', snapshotId,
    captureScope: 'PRIVATE_NATIVE_EVALUATION', evidenceOrigin: 'synthetic', complete: true,
    forecastId: id(5), sourcePredictionId: id(6), targetItemId: id(7),
    profile: { id: id(2), type: 'PERSONAL', ownerUserId: id(1) }, actorUserId: id(1), itemType: 'MOVIE', cutoffMicros: cutoff,
    source: { signature: 'private.personal_source_evidence_v1(uuid,timestamp with time zone)', bodyMd5: 'b'.repeat(32) },
    trainingSource: { signature: 'private.personal_rating_training_sources_v2(uuid,text,timestamp with time zone)', bodyMd5: 'd'.repeat(32) },
    labels, candidatePool: { kind: 'FROZEN_DELIVERED_PERSONAL_POOL', snapshotId, cutoffMicros: cutoff, sourcePredictionId: id(6),
      items: [{ id: id(7), itemType: 'MOVIE', discoverable: true, availableAtMicros: accepted }] },
    contentFeatures: { version: 'kajo-personal-content-features-v1', snapshotId, cutoffMicros: cutoff,
      mappingVersion: personalContentFeatureContract.mappingVersion, mappingHash: personalContentFeatureContract.mappingHash,
      transformVersion: personalContentFeatureContract.transformVersion, semantics: 'ASSERTION_PRESENCE', featureUse: null,
      featureIds: personalContentFeatureContract.concepts.map(concept => `provider-genre:${concept}`),
      objects: [...labels.map(label => label.itemId), id(7)].map(objectId => ({ objectId, domainId: 'MOVIE',
        sourceId: `unavailable:${objectId}`, availableAtMicros: cutoff, status: 'UNAVAILABLE', assertions: null, values: null, provenance: null })) },
  };
}
const bootstrap = (raw: Mutable<KajoOwnedTasteRatingPrefix>, index = 0) => (raw.labels[index] as Mutable<KajoOwnedTasteRatingLabel>).bootstrap;

describe('owned Taste numeric source generation', () => {
  it('keeps all grades, report availability and explicit bootstrap identity without fabricated Events', () => {
    for (let rating = 0; rating <= 10; rating++) {
      const raw = fixture([rating]), before = structuredClone(raw), normalized = normalize(raw);
      expect(normalized.prefix.ratings[0]!.value).toBe(rating);
      expect(normalized.prefix.ratings[0]!.sourceEventId).toBe(`taste:${id(40)}:${id(100)}`);
      expect(normalized.prefix.ratings[0]!.occurredAtMicros).toBe(bootstrap(raw).acceptedAtMicros);
      expect(raw).toEqual(before);
      const forecast = forecastPersonalContentRating(normalized);
      expect(forecast.location.personalMean).toBe(rating);
      expect(forecast.servingActivation).toBe('NONE');
      expect(forecast.qualityAdmission).toBe('NONE');
    }
  });
  it('retains unavailable, single, constant and varied own-scale means with unchanged missing-feature fallback', () => {
    for (const [grades, mean] of [[[], null], [[7], 7], [[3, 3], 3], [[0, 10], 5]] as const) {
      const forecast = forecastPersonalContentRating(normalize(fixture([...grades])));
      expect(forecast.location.personalMean).toBe(mean);
      expect(forecast.forecasts[0]!.candidate.value).toBe(mean);
      expect(forecast.contentFit.status).not.toBe('FITTED');
    }
  });
  it('cannot pass a new input into the retained old adapter or impersonate its source namespace', () => {
    const raw = fixture();
    expect(() => normalizeKajoPersonalContentRatingPrefix(raw as never)).toThrow(/version/);
    raw.snapshotId = raw.snapshotId.replace('native-owned-content:', 'native-content-prospective:');
    expect(() => normalize(raw)).toThrow(/snapshot identity/);
  });
  it('rejects foreign, external, future, malformed, duplicate and target-contaminated sources', () => {
    const changes: ((raw: Mutable<KajoOwnedTasteRatingPrefix>) => void)[] = [
      raw => { bootstrap(raw).actorUserId = id(999); }, raw => { bootstrap(raw).profileId = id(999); },
      raw => { bootstrap(raw).sourceProvider = 'IMPORTED_FILE' as never; }, raw => { bootstrap(raw).datasetKind = 'OTHER' as never; },
      raw => { bootstrap(raw).rating = -1; }, raw => { bootstrap(raw).rating = 2.5; },
      raw => { bootstrap(raw).evidenceKind = 'CONSUMED' as never; },
      raw => { bootstrap(raw).acceptedAtMicros = String(BigInt(raw.cutoffMicros) + 1n); },
      raw => { bootstrap(raw).availableAtMicros = '0'; }, raw => { bootstrap(raw).responseRevision = 0; },
      raw => { bootstrap(raw).experienceTime = 'KNOWN' as never; }, raw => { bootstrap(raw).commandHash = 'unverified'; },
      raw => { bootstrap(raw).responseId = 'missing'; }, raw => { raw.targetItemId = raw.labels[0]!.itemId;
        raw.candidatePool.items[0]!.id = raw.targetItemId; },
      raw => { raw.labels.push(structuredClone(raw.labels[0]!)); },
      raw => { bootstrap(raw, 1).responseId = bootstrap(raw).responseId; },
      raw => { Object.assign(raw.labels[0]!, { event: { eventType: 'ITEM_RATED' } }); },
    ];
    for (const change of changes) {
      const raw = fixture();change(raw);expect(() => normalize(raw)).toThrow();
    }
  });
  it('accepts native precedence only as a single resolved Item label', () => {
    const raw = fixture(), b = bootstrap(raw);
    raw.labels.unshift({ itemId: b.itemId, sourceEventId: id(300), sourceStatus: 'NATIVE_RATING', orderingBasis: 'CANONICAL_RECEIPT_LINEAGE',
      event: { id: id(300), actorUserId: id(1), profileId: id(2), itemId: b.itemId, itemType: 'MOVIE', eventType: 'ITEM_RATED',
        rating: 6, occurredAtMicros: b.acceptedAtMicros, availableAtMicros: b.availableAtMicros } });
    expect(() => normalize(raw)).toThrow(/distinct effective/);
    raw.labels.splice(1, 1);
    const forecast = forecastPersonalContentRating(normalize(raw));
    expect(forecast.location.personalMean).toBe(8);
    expect(forecast.prefix.ratings.find(row => row.objectId === b.itemId)!.sourceEventId).toBe(id(300));
  });
});
