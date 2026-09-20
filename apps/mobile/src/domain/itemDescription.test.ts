import { describe, expect, it } from 'vitest';
import fixture from '../../../../packages/catalog-contracts/fixtures.json';
import { ATTRIBUTED_DESCRIPTION } from '@kajo/catalog-contracts';
import { readCatalogDescription, visibleItemDescription } from './itemDescription';
import type { Item } from './contracts';
import { clearPredictionItemCacheForTests, getRememberedItem, rememberPredictionItems } from '../features/discovery/predictionRankingCache';

const metadata = { descriptionProvenance: { contract: ATTRIBUTED_DESCRIPTION,
  textSha256: fixture.attribution.textSha256, recordSha256: fixture.attribution.recordSha256,
  attribution: fixture.attribution, review: { basisSha256: 'f'.repeat(64) } } };
const item = (): Item => ({ id: 'attributed-book', itemType: 'BOOK', title: 'Test book',
  ...readCatalogDescription(fixture.description, metadata) });

describe('description and required credit travel together', () => {
  it('preserves verified legacy text and hides ambiguous text-only or malformed managed records', () => {
    expect(readCatalogDescription('Legacy text', {})).toEqual({ description: 'Legacy text', descriptionStatus: 'legacy' });
    for (const value of [undefined, null, [], { descriptionProvenance: null },
      { descriptionProvenance: { contract: 'open-library-description-v1' } },
      { descriptionProvenance: { ...metadata.descriptionProvenance, attribution: undefined } }]) {
      expect(readCatalogDescription(fixture.description, value)).toEqual({ descriptionStatus: 'unverified' });
    }
  });
  it('projects only public credit, retains it in detail cache, and rejects modified text or lost/unsafe credit', () => {
    clearPredictionItemCacheForTests();
    const original = item();
    expect(original.descriptionAttribution).toEqual(fixture.attribution);
    expect(JSON.stringify(original)).not.toContain('basisSha256');
    rememberPredictionItems('synthetic-slate', [original]);
    const cached = getRememberedItem(original.id)!;
    expect(visibleItemDescription(cached).descriptionAttribution).toEqual(fixture.attribution);
    const { descriptionAttribution: _credit, ...missing } = cached;
    for (const changed of [missing, { ...cached, description: fixture.description+' Changed.' },
      { ...cached, descriptionAttribution: { ...cached.descriptionAttribution!, sourceUrl: 'javascript:alert(1)' } }]) {
      expect(visibleItemDescription(changed).description).toBeUndefined();
      expect(changed.id).toBe(original.id);
    }
    clearPredictionItemCacheForTests();
  });
  it('does not relabel a managed paragraph as legacy merely because its status is missing', () => {
    const { descriptionStatus: _status, ...withoutStatus } = item();
    expect(visibleItemDescription(withoutStatus).description).toBeUndefined();
    expect(visibleItemDescription({ ...item(), descriptionStatus: 'legacy' }).description).toBeUndefined();
  });
});
