import { describe, expect, it, vi } from 'vitest';

import {
  createItemInteractionWriteFailureTracker,
  createSerializedItemInteractionWriter,
  loadPersistedItemInteractions,
  persistItemInteraction,
  type ItemInteractionPersistenceApi,
  type ItemInteractionWriteRequest,
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
        },
      ],
      error: null,
    })),
    upsert: vi.fn(async () => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
  };
}

function createRequest(itemId = 'item-1'): ItemInteractionWriteRequest {
  return {
    profileId: 'profile-1',
    actorUserId: 'user-1',
    itemId,
    interaction: { interest: 'LIKED', saved: true, consumed: false },
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
        'item-1': { interest: 'LIKED', saved: true, consumed: false },
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

describe('persistItemInteraction', () => {
  it('upserts meaningful current state with separate actor and Profile IDs', async () => {
    const api = createApi();

    await expect(
      persistItemInteraction(api, createRequest()),
    ).resolves.toEqual({ status: 'success' });
    expect(api.upsert).toHaveBeenCalledWith({
      profile_id: 'profile-1',
      item_id: 'item-1',
      actor_user_id: 'user-1',
      interest: 'LIKED',
      saved: true,
      consumed: false,
    });
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('deletes the row when undo restores the default interaction', async () => {
    const api = createApi();
    const request = createRequest();
    request.interaction = { interest: null, saved: false, consumed: false };

    await expect(persistItemInteraction(api, request)).resolves.toEqual({
      status: 'success',
    });
    expect(api.remove).toHaveBeenCalledWith('profile-1', 'item-1');
    expect(api.upsert).not.toHaveBeenCalled();
  });
});

describe('createSerializedItemInteractionWriter', () => {
  it('does not start a later write before the previous write settles', async () => {
    let finishFirst: (() => void) | undefined;
    const order: string[] = [];
    const write = vi.fn(
      (request: ItemInteractionWriteRequest) =>
        new Promise<{ status: 'success' }>((resolve) => {
          order.push(`start:${request.itemId}`);

          if (request.itemId === 'item-1') {
            finishFirst = () => {
              order.push('finish:item-1');
              resolve({ status: 'success' });
            };
            return;
          }

          order.push(`finish:${request.itemId}`);
          resolve({ status: 'success' });
        }),
    );
    const writer = createSerializedItemInteractionWriter(write);

    const first = writer.enqueue(createRequest('item-1'));
    const second = writer.enqueue(createRequest('item-2'));
    await Promise.resolve();

    expect(order).toEqual(['start:item-1']);
    finishFirst?.();
    await Promise.all([first, second]);
    expect(order).toEqual([
      'start:item-1',
      'finish:item-1',
      'start:item-2',
      'finish:item-2',
    ]);
  });
});

describe('createItemInteractionWriteFailureTracker', () => {
  it('never exposes an older failed write after a newer Item state is queued', () => {
    const tracker = createItemInteractionWriteFailureTracker();
    const older = createRequest();
    const newer = {
      ...createRequest(),
      interaction: { interest: 'DISLIKED' as const, saved: false, consumed: true },
    };

    tracker.queued(older);
    tracker.queued(newer);

    expect(
      tracker.settled(older, { status: 'error', message: 'failed' }),
    ).toBe('superseded');
    expect(tracker.getFailed('profile-1')).toEqual([]);

    expect(
      tracker.settled(newer, { status: 'error', message: 'failed' }),
    ).toBe('failed');
    expect(tracker.getFailed('profile-1')).toEqual([newer]);
  });

  it('updates retry state to the newest request while an earlier failure is visible', () => {
    const tracker = createItemInteractionWriteFailureTracker();
    const older = createRequest();
    const newer = createRequest();
    newer.interaction = { interest: null, saved: true, consumed: true };

    tracker.queued(older);
    tracker.settled(older, { status: 'error', message: 'failed' });
    tracker.queued(newer);

    expect(tracker.getFailed('profile-1')).toEqual([newer]);
  });
});
