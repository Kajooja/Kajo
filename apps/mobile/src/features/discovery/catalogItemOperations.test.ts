import { describe, expect, it } from 'vitest';

import type { Item } from '../../domain/contracts';
import {
  enrichItemsFromCatalog,
  mapCatalogItemRow,
} from './catalogItemOperations';

describe('catalog Item mapping', () => {
  it('maps provider-normalized presentation fields into the generic Item contract', () => {
    expect(
      mapCatalogItemRow({
        id: 'item-1',
        item_type: 'MOVIE',
        title: 'Movie',
        description: 'Description',
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
