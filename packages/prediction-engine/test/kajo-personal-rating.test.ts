import { describe, expect, it } from 'vitest';
import { normalizeKajoPersonalRatingPrefix } from '../src/adapters/kajo-personal-rating.js';
import { forecastPersonalRatingBaseline } from '../src/personal-rating.js';

const id = (n: number) => `a3980000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const config = { version: 'fixture-v1', shrinkage: 2 };
function fixture() {
  const snapshotId = `native-numeric:${'a'.repeat(32)}`;
  return {
    version: 'kajo-personal-rating-prefix-v1' as const, captureScope: 'ISOLATED_NATIVE_FIXTURE' as const,
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
    candidatePool: { snapshotId, cutoffMicros: '1793275200123456', kind: 'DECLARED_CANONICAL_ITEM_SNAPSHOT' as const,
      items: [{ id: id(5), itemType: 'BOOK' as const, availableAtMicros: '1793275200123455', discoverable: true as const }] },
  };
}
describe('Kajo Personal raw-rating prefix adapter', () => {
  it('keeps exact original zero, Event identity, native micros and explicit synthetic provenance', () => {
    const input = normalizeKajoPersonalRatingPrefix(fixture(), { config });
    expect(input.prefix.ratings[0]).toEqual({ sourceEventId: id(4), subjectId: id(2), domainId: 'BOOK',
      objectId: id(3), value: 0, occurredAtMicros: '1793275200123456', availableAtMicros: '1793275200123456' });
    expect(input.prefix.provenance).toEqual({ origin: 'synthetic', captureScope: 'ISOLATED_NATIVE_FIXTURE' });
    const result = forecastPersonalRatingBaseline(input);
    expect(result.prefix.provenance).toEqual(input.prefix.provenance);
    expect(result.forecasts[0]?.candidate.value).toBe(0);
    expect(result.qualityAdmission).toBe('NONE');
  });
  it('rejects broken joins, foreign ownership/domain and unavailable original values', () => {
    for (const mutate of [
      (x: ReturnType<typeof fixture>) => { x.profile.ownerUserId = id(99); },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.sourceEventId = id(99); },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.itemId = id(99); },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.actorUserId = id(99); },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.profileId = id(99); },
      (x: ReturnType<typeof fixture>) => { Object.assign(x.labels[0]!.event, { itemType: 'MOVIE' }); },
      (x: ReturnType<typeof fixture>) => { Object.assign(x.labels[0]!.event, { eventType: 'ITEM_SAVED' }); },
      (x: ReturnType<typeof fixture>) => { Object.assign(x.labels[0]!.event, { rating: '0' }); },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.rating = -1; },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.rating = 5.5; },
      (x: ReturnType<typeof fixture>) => { Object.assign(x, { complete: false }); },
      (x: ReturnType<typeof fixture>) => { x.source.bodyMd5 = 'unknown'; },
      (x: ReturnType<typeof fixture>) => { Object.assign(x, { captureScope: 'PRODUCTION' }); },
      (x: ReturnType<typeof fixture>) => { x.labels.push(structuredClone(x.labels[0]!)); },
    ]) {
      const input = fixture(); mutate(input);
      expect(() => normalizeKajoPersonalRatingPrefix(input, { config })).toThrow(/Invalid Kajo Personal numeric prefix/u);
    }
  });
  it('rejects one-microsecond future labels and different or future candidate snapshots', () => {
    for (const mutate of [
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.occurredAtMicros = '1793275200123457'; },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.availableAtMicros = '1793275200123457'; },
      (x: ReturnType<typeof fixture>) => { x.labels[0]!.event.availableAtMicros = 'Infinity'; },
      (x: ReturnType<typeof fixture>) => { x.candidatePool.cutoffMicros = '1793275200123457'; },
      (x: ReturnType<typeof fixture>) => { x.candidatePool.snapshotId = `native-numeric:${'c'.repeat(32)}`; },
      (x: ReturnType<typeof fixture>) => { x.candidatePool.items[0]!.availableAtMicros = '1793275200123457'; },
      (x: ReturnType<typeof fixture>) => { Object.assign(x.candidatePool.items[0]!, { discoverable: false }); },
      (x: ReturnType<typeof fixture>) => { x.candidatePool.items.push(structuredClone(x.candidatePool.items[0]!)); },
    ]) {
      const input = fixture(); mutate(input);
      expect(() => normalizeKajoPersonalRatingPrefix(input, { config })).toThrow(/Invalid Kajo Personal numeric prefix/u);
    }
  });
});
