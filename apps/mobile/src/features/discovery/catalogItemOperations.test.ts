import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import fixture from '../../../../../packages/catalog-contracts/fixtures.json';
import { ATTRIBUTED_DESCRIPTION } from '@kajo/catalog-contracts';
import { readCatalogDescription, visibleItemDescription } from '../../domain/itemDescription';

import type { Item } from '../../domain/contracts';
import {
  enrichItemsFromCatalog,
  enrichCatalogReferences,
  mapCatalogItemRow,
} from './catalogItemOperations';

describe('catalog Item mapping', () => {
  const row = { id: 'item-1', item_type: 'BOOK' as const, title: 'Canonical book',
    description: fixture.description, tags: ['fiction'], creators: ['Author'], release_year: 2020,
    image_url: null, original_language: 'en', metadata: { descriptionProvenance: {
      contract: ATTRIBUTED_DESCRIPTION, textSha256: fixture.attribution.textSha256,
      recordSha256: fixture.attribution.recordSha256, attribution: fixture.attribution,
    } } };

  it('hides malformed managed text while preserving the rest of the canonical Item', () => {
    const valid = mapCatalogItemRow(row);
    expect(valid.descriptionAttribution).toEqual(fixture.attribution);
    for (const metadata of [undefined, null, { descriptionProvenance: null }]) {
      expect(mapCatalogItemRow({ ...row, metadata })).toEqual({ ...valid,
        description: undefined, descriptionAttribution: undefined, descriptionStatus: 'unverified' });
    }
  });

  it('enriches Shared/List references by ID, preserving order and actor state, with safe partial/error fallback', async () => {
    const fallback: Item = { id: 'item-2', itemType: 'BOOK', title: 'RPC book',
      ...readCatalogDescription('Text without credit', undefined) };
    const references = [{ item: fallback, actorId: 'a', pending: true },
      { item: { ...fallback, id: 'item-1' }, actorId: 'b', pending: false }];
    const select = vi.fn();
    const client = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;
    select.mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [row], error: null }) });
    const enriched = await enrichCatalogReferences(client, references);
    expect(select).toHaveBeenCalledWith(expect.stringContaining('metadata'));
    expect(enriched[0]).toEqual(references[0]);
    expect(enriched[1]).toEqual({ ...references[1], item: mapCatalogItemRow(row) });
    expect(visibleItemDescription(enriched[0]!.item).description).toBeUndefined();
    expect(visibleItemDescription(enriched[1]!.item).descriptionAttribution).toEqual(fixture.attribution);
    select.mockReturnValue({ in: vi.fn().mockResolvedValue({ data: null, error: { message: 'Private error' } }) });
    expect(await enrichCatalogReferences(client, references)).toEqual(references);
    expect(references.every(ref => visibleItemDescription(ref.item).description === undefined)).toBe(true);
  });
  it('maps provider-normalized presentation fields into the generic Item contract', () => {
    expect(
      mapCatalogItemRow({
        id: 'item-1',
        item_type: 'MOVIE',
        title: 'Movie',
        description: 'Description',
        metadata: {},
        tags: ['drama'],
        creators: ['Director'],
        release_year: 2024,
        image_url: 'https://example.com/poster.jpg',
        original_language: 'fi',
      }),
    ).toEqual({
      id: 'item-1',
      itemType: 'MOVIE',
      title: 'Movie',
      description: 'Description',
      descriptionStatus: 'legacy',
      tags: ['drama'],
      creators: ['Director'],
      releaseYear: 2024,
      imageUrl: 'https://example.com/poster.jpg',
      originalLanguage: 'fi',
    });
  });

  it('enriches prediction Items by stable Item ID without changing rank order', () => {
    const ranked: Item[] = [
      { id: 'item-2', itemType: 'BOOK', title: 'Old 2', tags: [] },
      { id: 'item-1', itemType: 'BOOK', title: 'Old 1', tags: [] },
    ];
    const canonical: Item[] = [
      {
        id: 'item-1',
        itemType: 'BOOK',
        title: 'Canonical 1',
        tags: ['fiction'],
        creators: ['Author'],
      },
      {
        id: 'item-2',
        itemType: 'BOOK',
        title: 'Canonical 2',
        tags: ['history'],
      },
    ];

    expect(enrichItemsFromCatalog(ranked, canonical).map((item) => item.title)).toEqual([
      'Canonical 2',
      'Canonical 1',
    ]);
  });

  it('keeps the Prediction row when metadata enrichment misses an Item', () => {
    const ranked: Item[] = [
      { id: 'item-1', itemType: 'MOVIE', title: 'Prediction title', tags: ['drama'] },
    ];

    expect(enrichItemsFromCatalog(ranked, [])).toEqual(ranked);
  });
});
