import { describe, expect, it, vi } from 'vitest';

import {
  loadSharedProfiles,
  mapSharedProfiles,
  SHARED_PROFILE_RPC,
  type SharedProfileRpc,
} from './sharedProfileOperations';

const READY_ROW = {
  profile_id: 'shared-1',
  profile_name: 'Meidän Kajo',
  member_count: 2,
  is_ready: true,
  members: [
    { userId: 'user-1', nickname: 'KeTTu' },
    { userId: 'user-2', nickname: 'Susi' },
  ],
};

const PROVISIONAL_ROW = {
  profile_id: 'shared-2',
  profile_name: 'Kesken',
  member_count: 1,
  is_ready: false,
  members: [{ userId: 'user-1', nickname: 'KeTTu' }],
};

describe('mapSharedProfiles', () => {
  it('maps ready and provisional shared profiles to generic contracts', () => {
    expect(mapSharedProfiles([READY_ROW, PROVISIONAL_ROW])).toEqual({
      status: 'success',
      profiles: [
        {
          profile: {
            id: 'shared-1',
            type: 'SHARED',
            name: 'Meidän Kajo',
            memberUserIds: ['user-1', 'user-2'],
          },
          members: [
            { id: 'user-1', nickname: 'KeTTu' },
            { id: 'user-2', nickname: 'Susi' },
          ],
          isReady: true,
        },
        {
          profile: {
            id: 'shared-2',
            type: 'SHARED',
            name: 'Kesken',
            memberUserIds: ['user-1'],
          },
          members: [{ id: 'user-1', nickname: 'KeTTu' }],
          isReady: false,
        },
      ],
    });
  });

  it('rejects inconsistent readiness, member counts and malformed member payloads', () => {
    expect(
      mapSharedProfiles([{ ...READY_ROW, member_count: 3 }]),
    ).toMatchObject({ status: 'error' });
    expect(
      mapSharedProfiles([{ ...READY_ROW, is_ready: false }]),
    ).toMatchObject({ status: 'error' });
    expect(
      mapSharedProfiles([{ ...READY_ROW, members: [{ userId: 'user-1' }] }]),
    ).toMatchObject({ status: 'error' });
  });
});

describe('loadSharedProfiles', () => {
  it('uses the membership-protected list RPC', async () => {
    const rpc: SharedProfileRpc = vi.fn(async () => ({
      data: [READY_ROW],
      error: null,
    }));

    await expect(loadSharedProfiles(rpc)).resolves.toMatchObject({
      status: 'success',
    });
    expect(rpc).toHaveBeenCalledWith(SHARED_PROFILE_RPC.list, undefined);
  });

  it('does not expose backend details on failure', async () => {
    const rpc: SharedProfileRpc = vi.fn(async () => ({
      data: null,
      error: { message: 'private database detail' },
    }));

    await expect(loadSharedProfiles(rpc)).resolves.toEqual({
      status: 'error',
      message: 'Yhteisten Kajo-profiilien lataaminen epäonnistui. Yritä uudelleen.',
    });
  });
});
