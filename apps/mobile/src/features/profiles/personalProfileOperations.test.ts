import { describe, expect, it, vi } from 'vitest';

import {
  completePersonalIdentity,
  loadPersonalIdentity,
  mapPersonalIdentity,
  PERSONAL_PROFILE_RPC,
  validateNickname,
  type PersonalProfileRpc,
} from './personalProfileOperations';

const IDENTITY_ROW = {
  user_id: 'user-1',
  nickname: 'Lukija',
  profile_id: 'profile-1',
  profile_name: 'Lukija',
};

function createRpc(data: unknown = [IDENTITY_ROW]): PersonalProfileRpc {
  return vi.fn(async () => ({ data, error: null }));
}

describe('validateNickname', () => {
  it('trims and collapses whitespace in a display nickname', () => {
    expect(validateNickname('  Kajo   Kettu  ')).toEqual({
      status: 'valid',
      nickname: 'Kajo Kettu',
    });
  });

  it('rejects nicknames outside the MVP length boundary', () => {
    expect(validateNickname('K')).toMatchObject({ status: 'invalid' });
    expect(validateNickname('K'.repeat(33))).toMatchObject({ status: 'invalid' });
  });
});

describe('mapPersonalIdentity', () => {
  it('maps the database row to canonical User and PersonalProfile terms', () => {
    expect(mapPersonalIdentity([IDENTITY_ROW])).toEqual({
      status: 'ready',
      identity: {
        user: { id: 'user-1', nickname: 'Lukija' },
        profile: {
          id: 'profile-1',
          type: 'PERSONAL',
          name: 'Lukija',
          ownerUserId: 'user-1',
        },
      },
    });
  });

  it('distinguishes missing identity from malformed backend data', () => {
    expect(mapPersonalIdentity([])).toEqual({ status: 'missing' });
    expect(mapPersonalIdentity([{ nickname: 'Lukija' }])).toMatchObject({
      status: 'error',
    });
  });
});

describe('personal profile RPC operations', () => {
  it('loads the current identity with the read RPC', async () => {
    const rpc = createRpc();

    await expect(loadPersonalIdentity(rpc)).resolves.toMatchObject({
      status: 'ready',
    });
    expect(rpc).toHaveBeenCalledWith(PERSONAL_PROFILE_RPC.get, undefined);
  });

  it('completes onboarding with the normalized nickname', async () => {
    const rpc = createRpc();

    await expect(
      completePersonalIdentity(rpc, '  Kajo   Kettu  '),
    ).resolves.toMatchObject({ status: 'ready' });
    expect(rpc).toHaveBeenCalledWith(PERSONAL_PROFILE_RPC.complete, {
      input_nickname: 'Kajo Kettu',
    });
  });

  it('does not call the backend when nickname validation fails', async () => {
    const rpc = createRpc();

    await expect(completePersonalIdentity(rpc, 'K')).resolves.toMatchObject({
      status: 'error',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps backend failures without exposing backend details', async () => {
    const rpc: PersonalProfileRpc = vi.fn(async () => ({
      data: null,
      error: { message: 'private database detail' },
    }));

    await expect(loadPersonalIdentity(rpc)).resolves.toEqual({
      status: 'error',
      message: 'Oman Kajo-profiilin lataaminen epäonnistui. Yritä uudelleen.',
    });
  });
});
