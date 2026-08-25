import { describe, expect, it } from 'vitest';

import { getMockItem, getRankedMockItems } from './mockDiscovery';

describe('mock discovery ranking', () => {
  it('returns only the requested generic Item type', () => {
    expect(getRankedMockItems('BOOK', 'FOR_YOU').every((item) => item.itemType === 'BOOK')).toBe(true);
    expect(getRankedMockItems('MOVIE', 'FOR_YOU').every((item) => item.itemType === 'MOVIE')).toBe(true);
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
    expect(getMockItem('movie-static-summer')).toMatchObject({
      id: 'movie-static-summer',
      itemType: 'MOVIE',
    });
    expect(getMockItem('missing-item')).toBeUndefined();
  });
});
