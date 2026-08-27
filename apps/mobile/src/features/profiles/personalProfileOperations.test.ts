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
  nickname: 'KeTTu',
  profile_id: 'profile-1',
  profile_name: 'KeTTu',
};

function createRpc(data: unknown = [IDENTITY_ROW]): PersonalProfileRpc {
  return vi.fn(async () => ({ data, error: null }));
}

describe('validateNickname', () => {
  it('trims whitespace while preserving display casing', () => {
    expect(validateNickname('  KeTTu   Kajo  ')).toEqual({
      status: 'valid',
      nickname: 'KeTTu Kajo',
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
        user: { id: 'user-1', nickname: 'KeTTu' },
        profile: {
          id: 'profile-1',
          type: 'PERSONAL',
          name: 'KeTTu',
          ownerUserId: 'user-1',
        },
      },
    });
  });

  it('distinguishes missing identity from malformed backend data', () => {
    expect(mapPersonalIdentity([])).toEqual({ status: 'missing' });
    expect(mapPersonalIdentity([{ nickname: 'KeTTu' }])).toMatchObject({
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

  it('completes onboarding with the display-cased normalized nickname', async () => {
    const rpc = createRpc();

    await expect(
      completePersonalIdentity(rpc, '  KeTTu   Kajo  '),
    ).resolves.toMatchObject({ status: 'ready' });
    expect(rpc).toHaveBeenCalledWith(PERSONAL_PROFILE_RPC.complete, {
      input_nickname: 'KeTTu Kajo',
    });
  });

  it('does not call the backend when nickname validation fails', async () => {
    const rpc = createRpc();

    await expect(completePersonalIdentity(rpc, 'K')).resolves.toMatchObject({
      status: 'error',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps a unique nickname collision to a specific user-facing message', async () => {
    const rpc: PersonalProfileRpc = vi.fn(async () => ({
      data: null,
      error: { code: '23505', message: 'private duplicate detail' },
    }));

    await expect(completePersonalIdentity(rpc, 'KeTTu')).resolves.toEqual({
      status: 'error',
      message: 'Nimimerkki on jo käytössä. Valitse toinen.',
    });
  });

  it('maps other backend failures without exposing backend details', async () => {
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
