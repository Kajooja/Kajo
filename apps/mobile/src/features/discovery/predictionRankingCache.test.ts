import { beforeEach, describe, expect, it } from 'vitest';

import type { Item } from '../../domain/contracts';
import {
  clearPredictionItemCacheForTests,
  getMostRecentRememberedItems,
  getRememberedItem,
  getRememberedPredictionItems,
  rememberPredictionItems,
} from './predictionRankingCache';

const item = (id: string, itemType: Item['itemType'] = 'MOVIE'): Item => ({
  id,
  itemType,
  title: id,
  tags: [],
});

describe('prediction ranking cache', () => {
  beforeEach(clearPredictionItemCacheForTests);

  it('keeps the exact delivered Item order under one prediction ID', () => {
    rememberPredictionItems('prediction-1', [item('a'), item('b'), item('c')]);
    expect(
      getRememberedPredictionItems('prediction-1').map((candidate) => candidate.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('resolves a delivered real Item and the most recent slate for detail browsing', () => {
    rememberPredictionItems('prediction-books', [item('book-a', 'BOOK')]);
    rememberPredictionItems('prediction-movies', [item('movie-a'), item('movie-b')]);

    expect(getRememberedItem('movie-b')?.id).toBe('movie-b');
    expect(
      getMostRecentRememberedItems('MOVIE').map((candidate) => candidate.id),
    ).toEqual(['movie-a', 'movie-b']);
    expect(getMostRecentRememberedItems('BOOK').map((candidate) => candidate.id)).toEqual([
      'book-a',
    ]);
  });

  it('bounds process memory to the newest eight prediction slates', () => {
    for (let index = 1; index <= 9; index += 1) {
      rememberPredictionItems(`prediction-${index}`, [item(`item-${index}`)]);
    }

    expect(getRememberedPredictionItems('prediction-1')).toEqual([]);
    expect(getRememberedPredictionItems('prediction-9')).toHaveLength(1);
  });
});
