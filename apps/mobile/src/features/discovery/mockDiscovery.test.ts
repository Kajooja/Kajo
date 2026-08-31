import { describe, expect, it } from 'vitest';

import {
  getMockItem,
  getRankedMockItems,
  MOCK_ITEM_IDS,
} from './mockDiscovery';

describe('mock discovery ranking', () => {
  it('returns the expanded requested generic Item type', () => {
    const books = getRankedMockItems('BOOK', 'FOR_YOU');
    const movies = getRankedMockItems('MOVIE', 'FOR_YOU');

    expect(books).toHaveLength(12);
    expect(movies).toHaveLength(12);
    expect(books.every((item) => item.itemType === 'BOOK')).toBe(true);
    expect(movies.every((item) => item.itemType === 'MOVIE')).toBe(true);
  });

  it('changes deterministic ordering by DiscoveryMode', () => {
    const forYou = getRankedMockItems('BOOK', 'FOR_YOU').map((item) => item.id);
    const surprise = getRankedMockItems('BOOK', 'SURPRISE').map((item) => item.id);
    const risk = getRankedMockItems('BOOK', 'RISK').map((item) => item.id);

    expect(forYou).not.toEqual(surprise);
    expect(surprise).not.toEqual(risk);
    expect(forYou).not.toEqual(risk);
    expect(getRankedMockItems('BOOK', 'FOR_YOU').map((item) => item.id)).toEqual(forYou);
  });

  it('looks up a generic Item by id', () => {
    expect(getMockItem(MOCK_ITEM_IDS.movieStaticSummer)).toMatchObject({
      id: MOCK_ITEM_IDS.movieStaticSummer,
      itemType: 'MOVIE',
    });
    expect(getMockItem(MOCK_ITEM_IDS.bookSignalBelow)).toMatchObject({
      id: MOCK_ITEM_IDS.bookSignalBelow,
      itemType: 'BOOK',
    });
    expect(getMockItem('missing-item')).toBeUndefined();
  });
});
