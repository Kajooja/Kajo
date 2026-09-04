import { beforeEach, describe, expect, it } from 'vitest';

import type { Item } from '../../domain/contracts';
import {
  clearPredictionItemCacheForTests,
  getRememberedPredictionItems,
  rememberPredictionItems,
} from './predictionRankingCache';

const item = (id: string): Item => ({
  id,
  itemType: 'MOVIE',
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

  it('bounds process memory to the newest eight prediction slates', () => {
    for (let index = 1; index <= 9; index += 1) {
      rememberPredictionItems(`prediction-${index}`, [item(`item-${index}`)]);
    }

    expect(getRememberedPredictionItems('prediction-1')).toEqual([]);
    expect(getRememberedPredictionItems('prediction-9')).toHaveLength(1);
  });
});
