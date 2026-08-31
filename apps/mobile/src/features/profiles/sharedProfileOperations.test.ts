import { describe, expect, it, vi } from 'vitest';

import {
  addSharedProfileMember,
  createSharedProfile,
  loadSharedProfiles,
  mapSharedProfileCreation,
  mapSharedProfileMemberAddition,
  mapSharedProfiles,
  SHARED_PROFILE_RPC,
  validateSharedProfileName,
  validateSharedProfileNickname,
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

const CREATE_ROW = {
  profile_id: 'shared-new',
  profile_name: 'Meidän Kajo',
  member_count: 1,
  is_ready: false,
};

const ADD_MEMBER_ROW = {
  profile_id: 'shared-new',
  user_id: 'user-2',
  nickname: 'Susi',
  member_count: 2,
  is_ready: true,
  added: true,
};

describe('SharedProfile validation', () => {
  it('normalizes display text while preserving casing', () => {
    expect(validateSharedProfileName('  Meidän   Kajo  ')).toEqual({
      status: 'valid',
      name: 'Meidän Kajo',
    });
    expect(validateSharedProfileNickname('  SuSi  ')).toEqual({
      status: 'valid',
      nickname: 'SuSi',
    });
  });

  it('rejects invalid name and nickname boundaries', () => {
    expect(validateSharedProfileName('K')).toMatchObject({ status: 'invalid' });
    expect(validateSharedProfileName('K'.repeat(65))).toMatchObject({
      status: 'invalid',
    });
    expect(validateSharedProfileNickname('K')).toMatchObject({
      status: 'invalid',
    });
    expect(validateSharedProfileNickname('K'.repeat(33))).toMatchObject({
      status: 'invalid',
    });
  });
});

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

describe('SharedProfile mutation mapping', () => {
  it('maps the provisional creation response', () => {
    expect(mapSharedProfileCreation([CREATE_ROW])).toEqual({
      status: 'success',
      creation: {
        profileId: 'shared-new',
        profileName: 'Meidän Kajo',
        memberCount: 1,
        isReady: false,
      },
    });
  });

  it('maps ready and idempotent member-add responses', () => {
    expect(mapSharedProfileMemberAddition([ADD_MEMBER_ROW])).toEqual({
      status: 'success',
      addition: {
        profileId: 'shared-new',
        user: { id: 'user-2', nickname: 'Susi' },
        memberCount: 2,
        isReady: true,
        added: true,
      },
    });

    expect(
      mapSharedProfileMemberAddition([{ ...ADD_MEMBER_ROW, added: false }]),
    ).toMatchObject({
      status: 'success',
      addition: { added: false, isReady: true },
    });
  });

  it('rejects malformed or inconsistent mutation payloads', () => {
    expect(
      mapSharedProfileCreation([{ ...CREATE_ROW, member_count: 2 }]),
    ).toMatchObject({ status: 'error' });
    expect(
      mapSharedProfileCreation([{ ...CREATE_ROW, is_ready: true }]),
    ).toMatchObject({ status: 'error' });
    expect(
      mapSharedProfileMemberAddition([{ ...ADD_MEMBER_ROW, is_ready: false }]),
    ).toMatchObject({ status: 'error' });
  });
});

describe('SharedProfile RPC operations', () => {
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

  it('creates with a normalized name and does not call the backend for invalid input', async () => {
    const rpc: SharedProfileRpc = vi.fn(async () => ({
      data: [CREATE_ROW],
      error: null,
    }));

    await expect(createSharedProfile(rpc, '  Meidän   Kajo  ')).resolves.toEqual({
      status: 'success',
      creation: {
        profileId: 'shared-new',
        profileName: 'Meidän Kajo',
        memberCount: 1,
        isReady: false,
      },
    });
    expect(rpc).toHaveBeenCalledWith(SHARED_PROFILE_RPC.create, {
      input_name: 'Meidän Kajo',
    });

    vi.mocked(rpc).mockClear();
    await expect(createSharedProfile(rpc, 'K')).resolves.toMatchObject({
      status: 'error',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('adds a member by normalized nickname and retains display casing from the response', async () => {
    const rpc: SharedProfileRpc = vi.fn(async () => ({
      data: [ADD_MEMBER_ROW],
      error: null,
    }));

    await expect(
      addSharedProfileMember(rpc, 'shared-new', '  SuSi  '),
    ).resolves.toEqual({
      status: 'success',
      addition: {
        profileId: 'shared-new',
        user: { id: 'user-2', nickname: 'Susi' },
        memberCount: 2,
        isReady: true,
        added: true,
      },
    });
    expect(rpc).toHaveBeenCalledWith(SHARED_PROFILE_RPC.addMember, {
      target_profile_id: 'shared-new',
      input_nickname: 'SuSi',
    });
  });

  it('maps a missing nickname specifically while keeping stale-profile errors generic', async () => {
    const missingRpc: SharedProfileRpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0002', message: 'Kajo user not found' },
    }));

    await expect(
      addSharedProfileMember(missingRpc, 'shared-new', 'Susi'),
    ).resolves.toEqual({
      status: 'error',
      message: 'Tällä nimimerkillä ei löytynyt Kajo-käyttäjää.',
    });

    const staleProfileRpc: SharedProfileRpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0002', message: 'Shared profile not found' },
    }));

    await expect(
      addSharedProfileMember(staleProfileRpc, 'shared-old', 'Susi'),
    ).resolves.toEqual({
      status: 'error',
      message: 'Jäsenen lisääminen yhteiseen Kajoon epäonnistui. Yritä uudelleen.',
    });
  });

  it('does not expose backend details on list or create failures', async () => {
    const failingRpc: SharedProfileRpc = vi.fn(async () => ({
      data: null,
      error: { message: 'private database detail' },
    }));

    await expect(loadSharedProfiles(failingRpc)).resolves.toEqual({
      status: 'error',
      message: 'Yhteisten Kajo-profiilien lataaminen epäonnistui. Yritä uudelleen.',
    });
    await expect(createSharedProfile(failingRpc, 'Meidän Kajo')).resolves.toEqual({
      status: 'error',
      message: 'Yhteisen Kajon luominen epäonnistui. Yritä uudelleen.',
    });
  });
});
