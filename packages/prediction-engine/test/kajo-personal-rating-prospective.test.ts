import { describe, expect, it } from 'vitest';
import { normalizeKajoPersonalRatingProspectivePrefix } from '../src/adapters/kajo-personal-rating-prospective.js';
import { forecastPersonalRatingBaseline } from '../src/personal-rating.js';

const id = (n: number) => `a3980000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function fixture() {
  const snapshotId = `native-prospective:${'a'.repeat(32)}`;
  return {
    version: 'kajo-personal-rating-prospective-prefix-v1' as const, captureScope: 'PRIVATE_NATIVE_EVALUATION' as const,
    evidenceOrigin: 'synthetic' as const, forecastId: id(6), sourcePredictionId: id(7), targetItemId: id(5),
    snapshotId, complete: true as const,
    profile: { id: id(2), type: 'PERSONAL' as const, ownerUserId: id(1) }, actorUserId: id(1),
    itemType: 'BOOK' as const, cutoffMicros: '1793275200123456',
    source: { signature: 'private.personal_source_evidence_v1(uuid,timestamp with time zone)' as const,
      bodyMd5: 'b'.repeat(32) },
    labels: [{ itemId: id(3), sourceEventId: id(4), sourceStatus: 'NATIVE_RATING' as const,
      orderingBasis: 'CANONICAL_RECEIPT_LINEAGE' as const,
      event: { id: id(4), actorUserId: id(1), profileId: id(2), itemId: id(3), itemType: 'BOOK' as const,
        eventType: 'ITEM_RATED' as const, rating: 0, occurredAtMicros: '1793275200123456',
        availableAtMicros: '1793275200123456' } }],
    candidatePool: { snapshotId, cutoffMicros: '1793275200123456', kind: 'FROZEN_DELIVERED_PERSONAL_POOL' as const, sourcePredictionId: id(7),
      items: [{ id: id(5), itemType: 'BOOK' as const, availableAtMicros: '1793275200123455', discoverable: true as const }] },
  };
}
describe('Trusted native prospective numeric adapter', () => {
  it('preserves every raw grade, synthetic origin and native-only baseline policy', () => {
    for (let rating = 0; rating <= 10; rating++) {
      const raw = fixture(); raw.labels[0]!.event.rating = rating;
      const input = normalizeKajoPersonalRatingProspectivePrefix(raw);
      const forecast = forecastPersonalRatingBaseline(input);
      expect(forecast.forecasts[0]?.candidate.value).toBe(rating);
      expect(forecast.priorDisposition).toBe('ABSENT');
      expect(forecast.config).toEqual({ version: 'personal-native-location-v1', shrinkage: 2 });
      expect(forecast.prefix.provenance).toEqual({ origin: 'synthetic', captureScope: 'PRIVATE_NATIVE_EVALUATION' });
      expect(forecast.qualityAdmission).toBe('NONE');
      expect(forecast.servingActivation).toBe('NONE');
    }
    const raw = { ...fixture(), evidenceOrigin: 'observed' as const };
    expect(normalizeKajoPersonalRatingProspectivePrefix(raw).prefix.provenance.origin).toBe('observed');
  });
  it('rejects target leakage, changed ownership, pool/source bindings and unsupported provenance', () => {
    for (const mutate of [
      (x: ReturnType<typeof fixture>) => { x.targetItemId = x.labels[0]!.itemId; },
      (x: ReturnType<typeof fixture>) => { x.targetItemId = id(99); },
      (x: ReturnType<typeof fixture>) => { x.candidatePool.sourcePredictionId = id(99); },
      (x: ReturnType<typeof fixture>) => { x.candidatePool.items.push(structuredClone(x.candidatePool.items[0]!)); },
      (x: ReturnType<typeof fixture>) => { x.candidatePool.items = []; },
      (x: ReturnType<typeof fixture>) => { x.profile.ownerUserId = id(99); },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.actorUserId = id(99); },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.sourceEventId = id(99); },
      (x: ReturnType<typeof fixture>) => { x.labels.push(structuredClone(x.labels[0]!)); },
      (x: ReturnType<typeof fixture>) => { Object.assign(x, { captureScope: 'ISOLATED_NATIVE_FIXTURE' }); },
      (x: ReturnType<typeof fixture>) => { Object.assign(x, { evidenceOrigin: 'unknown' }); },
      (x: ReturnType<typeof fixture>) => { Object.assign(x, { complete: false }); },
      (x: ReturnType<typeof fixture>) => { Object.assign(x.labels[0]!.event, { itemType: 'MOVIE' }); },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.rating = 5.5; },
    ]) {
      const raw = fixture(); mutate(raw);
      expect(() => normalizeKajoPersonalRatingProspectivePrefix(raw)).toThrow(/Invalid Kajo prospective numeric prefix/u);
    }
  });
  it('requires a common exact cutoff and rejects a one-microsecond future source', () => {
    for (const mutate of [
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.occurredAtMicros = '1793275200123457'; },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.availableAtMicros = '1793275200123457'; },
      (x: ReturnType<typeof fixture>) => { x.candidatePool.items[0]!.availableAtMicros = '1793275200123457'; },
      (x: ReturnType<typeof fixture>) => { x.candidatePool.cutoffMicros = '1793275200123457'; },
      (x: ReturnType<typeof fixture>) => { x.candidatePool.snapshotId = `native-prospective:${'c'.repeat(32)}`; },
      (x: ReturnType<typeof fixture>) => { x.cutoffMicros = '253402300800000000'; },
    ]) {
      const raw = fixture(); mutate(raw);
      expect(() => normalizeKajoPersonalRatingProspectivePrefix(raw)).toThrow(/Invalid Kajo prospective numeric prefix/u);
    }
  });
});
