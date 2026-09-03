import { describe, expect, it, vi } from 'vitest';

import {
  loadPredictionRanking,
  mapPredictionRows,
  PREDICTION_V1_RPC,
  type PredictionRpc,
} from './predictionOperations';

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

describe('Prediction V1 RPC boundary', () => {
  it('sends the Profile, mode, generic candidate scope and bounded Context', async () => {
    const rpc: PredictionRpc = vi.fn(async () => ({ data: ROWS, error: null }));

    await expect(
      loadPredictionRanking(rpc, {
        profileId: 'profile-1',
        mode: 'RISK',
        itemType: 'MOVIE',
        limit: 12,
        context: {
          sessionId: 'session-1',
          locale: 'fi-FI',
          timezone: 'Europe/Helsinki',
          occurredAt: '2026-09-02T19:30:00.000Z',
          attributes: {
            localHour: 22,
            dayOfWeek: 3,
            surface: 'DISCOVERY_GRID',
          },
        },
      }),
    ).resolves.toMatchObject({ status: 'success' });

    expect(rpc).toHaveBeenCalledWith(PREDICTION_V1_RPC, {
      target_profile_id: 'profile-1',
      requested_mode: 'RISK',
      requested_item_type: 'MOVIE',
      result_limit: 12,
      request_context: {
        sessionId: 'session-1',
        locale: 'fi-FI',
        timezone: 'Europe/Helsinki',
        occurredAt: '2026-09-02T19:30:00.000Z',
        attributes: {
          localHour: 22,
          dayOfWeek: 3,
          surface: 'DISCOVERY_GRID',
        },
      },
    });
  });

  it('returns one safe retryable error for backend and connection failures', async () => {
    const backendFailure: PredictionRpc = vi.fn(async () => ({
      data: null,
      error: { message: 'private detail' },
    }));
    const connectionFailure: PredictionRpc = vi.fn(async () => {
      throw new Error('offline');
    });

    await expect(
      loadPredictionRanking(backendFailure, {
        profileId: 'profile-1',
        mode: 'FOR_YOU',
        itemType: 'BOOK',
      }),
    ).resolves.toEqual({
      status: 'error',
      message: 'Suositusten päivittäminen epäonnistui. Yritä uudelleen.',
    });
    await expect(
      loadPredictionRanking(connectionFailure, {
        profileId: 'profile-1',
        mode: 'FOR_YOU',
        itemType: 'BOOK',
      }),
    ).resolves.toMatchObject({ status: 'error' });
  });
});
