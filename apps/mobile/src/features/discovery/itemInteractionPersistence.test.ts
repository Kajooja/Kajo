import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createAcknowledgedInteractionRefresh,
  createSupabaseItemInteractionPersistenceApi,
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
  it('hydrates initial and native ratings through one Profile-authorized snapshot, including zero', async () => {
    const rpc = vi.fn(async () => ({ data: [
      { item_id: 'initial', interest: null, saved: false, consumed: true, rating: 0, not_interested: false },
      { item_id: 'native', interest: 'LIKED', saved: true, consumed: true, rating: 8, not_interested: false },
      { item_id: 'read-only', interest: null, saved: false, consumed: true, rating: null, not_interested: false },
    ], error: null }));
    const api = createSupabaseItemInteractionPersistenceApi({ rpc } as unknown as SupabaseClient);
    const result = await loadPersistedItemInteractions(api, 'personal-a');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_profile_item_states_v1', { target_profile_id: 'personal-a' });
    expect(result).toMatchObject({ status: 'success', interactions: {
      initial: { consumed: true, rating: 0 }, native: { consumed: true, rating: 8, saved: true },
      'read-only': { consumed: true, rating: null },
    } });
  });

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

describe('current state after receipt replay', () => {
  it('keeps only the newest authoritative read and never overwrites pending or another scope', async () => {
    type Result = Awaited<ReturnType<typeof loadPersistedItemInteractions>>;
    const responses: ((result: Result) => void)[] = [];
    let current = true;
    let pending = false;
    const onLoaded = vi.fn();
    const refresh = createAcknowledgedInteractionRefresh({
      load: () => new Promise<Result>(resolve => responses.push(resolve)),
      canApply: () => current && !pending, onLoaded,
    });
    const older = refresh(); const newer = refresh();
    responses[1]?.({ status: 'success', interactions: {} }); await newer;
    responses[0]?.({ status: 'success', interactions: {} }); await older;
    expect(onLoaded).toHaveBeenCalledTimes(1);
    const whilePending = refresh(); pending = true;
    responses[2]?.({ status: 'success', interactions: {} }); await whilePending;
    expect(onLoaded).toHaveBeenCalledTimes(1);
    pending = false;
    const changedAccount = refresh(); current = false;
    responses[3]?.({ status: 'success', interactions: {} }); await changedAccount;
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });
});
