import { describe, expect, it, vi } from 'vitest';

import {
  loadPersistedItemInteractions,
  type ItemInteractionPersistenceApi,
} from './itemInteractionPersistence';

function createApi(): ItemInteractionPersistenceApi {
  return {
    load: vi.fn(async () => ({
      data: [
        {
          item_id: 'item-1',
          interest: 'LIKED',
          saved: true,
          consumed: false,
          rating: null,
          not_interested: false,
        },
      ],
      error: null,
    })),
  };
}

describe('loadPersistedItemInteractions', () => {
  it('hydrates generic interaction state by Item ID', async () => {
    const api = createApi();

    await expect(
      loadPersistedItemInteractions(api, 'profile-1'),
    ).resolves.toEqual({
      status: 'success',
      interactions: {
        'item-1': {
          interest: 'LIKED',
          saved: true,
          consumed: false,
          rating: null,
          notInterested: false,
        },
      },
    });
    expect(api.load).toHaveBeenCalledWith('profile-1');
  });

  it('rejects malformed rows instead of partially hydrating state', async () => {
    const api = createApi();
    vi.mocked(api.load).mockResolvedValueOnce({
      data: [{ item_id: 'item-1', interest: 'UNKNOWN' }],
      error: null,
    });

    await expect(
      loadPersistedItemInteractions(api, 'profile-1'),
    ).resolves.toMatchObject({ status: 'error' });
  });
});
