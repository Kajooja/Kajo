import { describe, expect, it, vi } from 'vitest';

import {
  createSharedProfile,
  inviteSharedProfileMember,
  loadSharedProfileInvitations,
  loadSharedProfiles,
  mapSharedProfileCreation,
  mapSharedProfileInvitationCreation,
  mapSharedProfileInvitationResponse,
  mapSharedProfileInvitations,
  mapSharedProfiles,
  respondSharedProfileInvitation,
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

const INVITATION_ROW = {
  invitation_id: 'invite-1',
  profile_id: 'shared-new',
  profile_name: 'Meidän Kajo',
  inviter_user_id: 'user-1',
  inviter_nickname: 'KeTTu',
  created_at: '2026-08-31T20:00:00.000Z',
};

const INVITE_ROW = {
  profile_id: 'shared-new',
  invitation_id: 'invite-1',
  invited_user_id: 'user-2',
  nickname: 'Susi',
  member_count: 1,
  is_ready: false,
  invitation_created: true,
  already_member: false,
};

const ACCEPT_ROW = {
  invitation_id: 'invite-1',
  profile_id: 'shared-new',
  profile_name: 'Meidän Kajo',
  accepted: true,
  member_count: 2,
  is_ready: true,
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

  it('rejects invalid boundaries', () => {
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

describe('SharedProfile mapping', () => {
  it('maps ready and provisional memberships', () => {
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

  it('maps creation and incoming invitations', () => {
    expect(mapSharedProfileCreation([CREATE_ROW])).toEqual({
      status: 'success',
      creation: {
        profileId: 'shared-new',
        profileName: 'Meidän Kajo',
        memberCount: 1,
        isReady: false,
      },
    });

    expect(mapSharedProfileInvitations([INVITATION_ROW])).toEqual({
      status: 'success',
      invitations: [
        {
          id: 'invite-1',
          profileId: 'shared-new',
          profileName: 'Meidän Kajo',
          inviter: { id: 'user-1', nickname: 'KeTTu' },
          createdAt: '2026-08-31T20:00:00.000Z',
        },
      ],
    });
  });

  it('maps invite creation, duplicate and already-member responses', () => {
    expect(mapSharedProfileInvitationCreation([INVITE_ROW])).toEqual({
      status: 'success',
      invitation: {
        profileId: 'shared-new',
        invitationId: 'invite-1',
        user: { id: 'user-2', nickname: 'Susi' },
        memberCount: 1,
        isReady: false,
        invitationCreated: true,
        alreadyMember: false,
      },
    });

    expect(
      mapSharedProfileInvitationCreation([
        { ...INVITE_ROW, invitation_created: false },
      ]),
    ).toMatchObject({
      status: 'success',
      invitation: { invitationCreated: false, alreadyMember: false },
    });

    expect(
      mapSharedProfileInvitationCreation([
        {
          ...INVITE_ROW,
          invitation_id: null,
          member_count: 2,
          is_ready: true,
          invitation_created: false,
          already_member: true,
        },
      ]),
    ).toMatchObject({
      status: 'success',
      invitation: { invitationId: null, alreadyMember: true, isReady: true },
    });
  });

  it('maps accept and reject responses', () => {
    expect(mapSharedProfileInvitationResponse([ACCEPT_ROW])).toEqual({
      status: 'success',
      response: {
        invitationId: 'invite-1',
        profileId: 'shared-new',
        profileName: 'Meidän Kajo',
        accepted: true,
        memberCount: 2,
        isReady: true,
      },
    });

    expect(
      mapSharedProfileInvitationResponse([
        { ...ACCEPT_ROW, accepted: false, member_count: 1, is_ready: false },
      ]),
    ).toMatchObject({
      status: 'success',
      response: { accepted: false, memberCount: 1, isReady: false },
    });
  });

  it('rejects inconsistent invitation payloads', () => {
    expect(
      mapSharedProfileInvitations([{ ...INVITATION_ROW, created_at: 'bad-date' }]),
    ).toMatchObject({ status: 'error' });
    expect(
      mapSharedProfileInvitationCreation([
        { ...INVITE_ROW, member_count: 2, is_ready: false },
      ]),
    ).toMatchObject({ status: 'error' });
    expect(
      mapSharedProfileInvitationCreation([
        { ...INVITE_ROW, invitation_id: null, already_member: false },
      ]),
    ).toMatchObject({ status: 'error' });
    expect(
      mapSharedProfileInvitationResponse([
        { ...ACCEPT_ROW, member_count: 1, is_ready: true },
      ]),
    ).toMatchObject({ status: 'error' });
  });
});

describe('SharedProfile RPC operations', () => {
  it('uses list and invitation-list RPCs', async () => {
    const rpc: SharedProfileRpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [READY_ROW], error: null })
      .mockResolvedValueOnce({ data: [INVITATION_ROW], error: null });

    await expect(loadSharedProfiles(rpc)).resolves.toMatchObject({
      status: 'success',
    });
    await expect(loadSharedProfileInvitations(rpc)).resolves.toMatchObject({
      status: 'success',
    });

    expect(rpc).toHaveBeenNthCalledWith(1, SHARED_PROFILE_RPC.list, undefined);
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      SHARED_PROFILE_RPC.listInvitations,
      undefined,
    );
  });

  it('creates with normalized name and avoids backend on invalid input', async () => {
    const rpc: SharedProfileRpc = vi.fn(async () => ({
      data: [CREATE_ROW],
      error: null,
    }));

    await expect(createSharedProfile(rpc, '  Meidän   Kajo  ')).resolves.toMatchObject({
      status: 'success',
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

  it('invites by normalized nickname without direct membership semantics', async () => {
    const rpc: SharedProfileRpc = vi.fn(async () => ({
      data: [INVITE_ROW],
      error: null,
    }));

    await expect(
      inviteSharedProfileMember(rpc, 'shared-new', '  SuSi  '),
    ).resolves.toMatchObject({
      status: 'success',
      invitation: {
        invitationId: 'invite-1',
        user: { id: 'user-2', nickname: 'Susi' },
        invitationCreated: true,
        alreadyMember: false,
      },
    });
    expect(rpc).toHaveBeenCalledWith(SHARED_PROFILE_RPC.inviteMember, {
      target_profile_id: 'shared-new',
      input_nickname: 'SuSi',
    });
  });

  it('responds to an invitation with explicit accept boolean', async () => {
    const rpc: SharedProfileRpc = vi.fn(async () => ({
      data: [ACCEPT_ROW],
      error: null,
    }));

    await expect(
      respondSharedProfileInvitation(rpc, 'invite-1', true),
    ).resolves.toMatchObject({
      status: 'success',
      response: { accepted: true, isReady: true },
    });
    expect(rpc).toHaveBeenCalledWith(SHARED_PROFILE_RPC.respondInvitation, {
      target_invitation_id: 'invite-1',
      input_accept: true,
    });
  });

  it('maps missing user and self-invite errors without leaking backend detail', async () => {
    const missingRpc: SharedProfileRpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0002', message: 'Kajo user not found' },
    }));
    await expect(
      inviteSharedProfileMember(missingRpc, 'shared-new', 'Susi'),
    ).resolves.toEqual({
      status: 'error',
      message: 'Tällä nimimerkillä ei löytynyt Kajo-käyttäjää.',
    });

    const selfRpc: SharedProfileRpc = vi.fn(async () => ({
      data: null,
      error: { code: '22023', message: 'Cannot invite yourself' },
    }));
    await expect(
      inviteSharedProfileMember(selfRpc, 'shared-new', 'KeTTu'),
    ).resolves.toEqual({
      status: 'error',
      message: 'Et voi kutsua itseäsi ryhmään.',
    });
  });

  it('keeps generic backend failures generic', async () => {
    const failingRpc: SharedProfileRpc = vi.fn(async () => ({
      data: null,
      error: { message: 'private database detail' },
    }));

    await expect(loadSharedProfileInvitations(failingRpc)).resolves.toEqual({
      status: 'error',
      message: 'Ryhmäkutsujen lataaminen epäonnistui. Yritä uudelleen.',
    });
    await expect(
      respondSharedProfileInvitation(failingRpc, 'invite-1', false),
    ).resolves.toEqual({
      status: 'error',
      message: 'Ryhmäkutsuun vastaaminen epäonnistui. Yritä uudelleen.',
    });
  });
});
