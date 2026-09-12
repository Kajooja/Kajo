import { describe, expect, it } from 'vitest';

import { mapPredictionRows } from './predictionOperations';

const ROWS = [
  {
    prediction_id: 'prediction-1',
    item_id: 'item-2',
    item_type: 'MOVIE',
    title: 'Second',
    description: null,
    tags: ['quiet'],
    score: 2.5,
    confidence: 0.5,
    rank: 2,
  },
  {
    prediction_id: 'prediction-1',
    item_id: 'item-1',
    item_type: 'MOVIE',
    title: 'First',
    description: 'Description',
    tags: ['bold'],
    score: 4.5,
    confidence: 0.75,
    rank: 1,
  },
];

describe('Prediction V1 mapping', () => {
  it('rejects duplicate Items and ambiguous ranks in the shared row mapper', () => {
    for (const rows of [[ROWS[0], ROWS[0]], [ROWS[0], { ...ROWS[1], item_id: ROWS[0]!.item_id }],
      [ROWS[0], { ...ROWS[1], rank: ROWS[0]!.rank }]]) {
      expect(mapPredictionRows(rows, 'profile-1', 'FOR_YOU').status).toBe('error');
    }
  });
  it('maps rank order, generic Items and one shared prediction trace', () => {
    expect(mapPredictionRows(ROWS, 'profile-1', 'SURPRISE')).toEqual({
      status: 'success',
      ranking: {
        predictionId: 'prediction-1',
        items: [
          {
            id: 'item-1',
            itemType: 'MOVIE',
            title: 'First',
            description: 'Description',
            tags: ['bold'],
          },
          {
            id: 'item-2',
            itemType: 'MOVIE',
            title: 'Second',
            tags: ['quiet'],
          },
        ],
        predictions: [
          {
            predictionId: 'prediction-1',
            profileId: 'profile-1',
            itemId: 'item-1',
            discoveryMode: 'SURPRISE',
            score: 4.5,
            confidence: 0.75,
          },
          {
            predictionId: 'prediction-1',
            profileId: 'profile-1',
            itemId: 'item-2',
            discoveryMode: 'SURPRISE',
            score: 2.5,
            confidence: 0.5,
          },
        ],
      },
    });
  });

  it('rejects empty, malformed or mixed-trace backend responses', () => {
    expect(mapPredictionRows([], 'profile-1', 'FOR_YOU')).toMatchObject({
      status: 'error',
    });
    expect(
      mapPredictionRows([{ ...ROWS[0], score: 'bad' }], 'profile-1', 'FOR_YOU'),
    ).toMatchObject({ status: 'error' });
    expect(
      mapPredictionRows(
        [ROWS[0], { ...ROWS[1], prediction_id: 'prediction-2' }],
        'profile-1',
        'FOR_YOU',
      ),
    ).toMatchObject({ status: 'error' });
  });
});
