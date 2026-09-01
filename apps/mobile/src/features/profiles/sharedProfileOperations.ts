import type { SharedProfile, User } from '@/domain/contracts';

export const SHARED_PROFILE_RPC = {
  list: 'get_my_shared_profiles',
  create: 'create_shared_profile',
  inviteMember: 'invite_shared_profile_member',
  listInvitations: 'get_my_shared_profile_invitations',
  respondInvitation: 'respond_shared_profile_invitation',
  leave: 'leave_shared_profile',
} as const;

interface RpcErrorLike {
  code?: string;
  message: string;
}

interface RpcResponse {
  data: unknown;
  error: RpcErrorLike | null;
}

export type SharedProfileRpc = (
  functionName: string,
  arguments_?: Record<string, unknown>,
) => PromiseLike<RpcResponse>;

export interface SharedProfileMembership {
  profile: SharedProfile;
  members: readonly User[];
  isReady: boolean;
}

export interface SharedProfileCreation {
  profileId: string;
  profileName: string;
  memberCount: number;
  isReady: boolean;
}

export interface SharedProfileInvitation {
  id: string;
  profileId: string;
  profileName: string;
  inviter: User;
  createdAt: string;
}

export interface SharedProfileInvitationCreation {
  profileId: string;
  invitationId: string | null;
  user: User;
  memberCount: number;
  isReady: boolean;
  invitationCreated: boolean;
  alreadyMember: boolean;
}

export interface SharedProfileInvitationResponse {
  invitationId: string;
  profileId: string;
  profileName: string;
  accepted: boolean;
  memberCount: number;
  isReady: boolean;
}

export interface SharedProfileLeave {
  profileId: string;
  profileName: string;
  remainingMemberCount: number;
  profileDeleted: boolean;
}

export type SharedProfileListResult =
  | { status: 'success'; profiles: readonly SharedProfileMembership[] }
  | { status: 'error'; message: string };

export type SharedProfileCreateResult =
  | { status: 'success'; creation: SharedProfileCreation }
  | { status: 'error'; message: string };

export type SharedProfileInvitationListResult =
  | { status: 'success'; invitations: readonly SharedProfileInvitation[] }
  | { status: 'error'; message: string };

export type SharedProfileInviteResult =
  | { status: 'success'; invitation: SharedProfileInvitationCreation }
  | { status: 'error'; message: string };

export type SharedProfileInvitationResponseResult =
  | { status: 'success'; response: SharedProfileInvitationResponse }
  | { status: 'error'; message: string };

export type SharedProfileLeaveResult =
  | { status: 'success'; leave: SharedProfileLeave }
  | { status: 'error'; message: string };

export type SharedProfileNameValidationResult =
  | { status: 'valid'; name: string }
  | { status: 'invalid'; message: string };

export type SharedProfileNicknameValidationResult =
  | { status: 'valid'; nickname: string }
  | { status: 'invalid'; message: string };

const SHARED_PROFILE_ERROR_MESSAGE =
  'Yhteisten Kajo-profiilien lataaminen epäonnistui. Yritä uudelleen.';
const SHARED_PROFILE_CREATE_ERROR_MESSAGE =
  'Yhteisen Kajon luominen epäonnistui. Yritä uudelleen.';
const SHARED_PROFILE_INVITE_ERROR_MESSAGE =
  'Kutsun lähettäminen yhteiseen Kajoon epäonnistui. Yritä uudelleen.';
const SHARED_PROFILE_INVITATION_LIST_ERROR_MESSAGE =
  'Ryhmäkutsujen lataaminen epäonnistui. Yritä uudelleen.';
const SHARED_PROFILE_INVITATION_RESPONSE_ERROR_MESSAGE =
  'Ryhmäkutsuun vastaaminen epäonnistui. Yritä uudelleen.';
const SHARED_PROFILE_LEAVE_ERROR_MESSAGE =
  'Ryhmästä poistuminen epäonnistui. Yritä uudelleen.';
const SHARED_PROFILE_USER_NOT_FOUND_MESSAGE =
  'Tällä nimimerkillä ei löytynyt Kajo-käyttäjää.';
const SHARED_PROFILE_SELF_INVITE_MESSAGE = 'Et voi kutsua itseäsi ryhmään.';
const MINIMUM_SHARED_PROFILE_NAME_LENGTH = 2;
export const MAXIMUM_SHARED_PROFILE_NAME_LENGTH = 32;
const MINIMUM_NICKNAME_LENGTH = 2;
export const MAXIMUM_SHARED_PROFILE_NICKNAME_LENGTH = 24;

export function validateSharedProfileName(
  value: string,
): SharedProfileNameValidationResult {
  const name = normalizeDisplayText(value);

  if (name.length < MINIMUM_SHARED_PROFILE_NAME_LENGTH) {
    return {
      status: 'invalid',
      message: `Yhteisen Kajon nimessä pitää olla vähintään ${MINIMUM_SHARED_PROFILE_NAME_LENGTH} merkkiä.`,
    };
  }

  if (name.length > MAXIMUM_SHARED_PROFILE_NAME_LENGTH) {
    return {
      status: 'invalid',
      message: `Yhteisen Kajon nimessä voi olla enintään ${MAXIMUM_SHARED_PROFILE_NAME_LENGTH} merkkiä.`,
    };
  }

  if (hasControlCharacter(name)) {
    return {
      status: 'invalid',
      message: 'Yhteisen Kajon nimessä on merkkejä, joita ei voi käyttää.',
    };
  }

  return { status: 'valid', name };
}

export function validateSharedProfileNickname(
  value: string,
): SharedProfileNicknameValidationResult {
  const nickname = normalizeDisplayText(value);

  if (nickname.length < MINIMUM_NICKNAME_LENGTH) {
    return {
      status: 'invalid',
      message: `Nimimerkissä pitää olla vähintään ${MINIMUM_NICKNAME_LENGTH} merkkiä.`,
    };
  }

  if (nickname.length > MAXIMUM_SHARED_PROFILE_NICKNAME_LENGTH) {
    return {
      status: 'invalid',
      message: `Nimimerkissä voi olla enintään ${MAXIMUM_SHARED_PROFILE_NICKNAME_LENGTH} merkkiä.`,
    };
  }

  if (hasControlCharacter(nickname)) {
    return {
      status: 'invalid',
      message: 'Nimimerkissä on merkkejä, joita ei voi käyttää.',
    };
  }

  return { status: 'valid', nickname };
}

export async function loadSharedProfiles(
  rpc: SharedProfileRpc,
): Promise<SharedProfileListResult> {
  try {
    const response = await rpc(SHARED_PROFILE_RPC.list, undefined);

    if (response.error) {
      return { status: 'error', message: SHARED_PROFILE_ERROR_MESSAGE };
    }

    return mapSharedProfiles(response.data);
  } catch {
    return { status: 'error', message: SHARED_PROFILE_ERROR_MESSAGE };
  }
}

export async function createSharedProfile(
  rpc: SharedProfileRpc,
  nameInput: string,
): Promise<SharedProfileCreateResult> {
  const validation = validateSharedProfileName(nameInput);

  if (validation.status === 'invalid') {
    return { status: 'error', message: validation.message };
  }

  try {
    const response = await rpc(SHARED_PROFILE_RPC.create, {
      input_name: validation.name,
    });

    if (response.error) {
      return { status: 'error', message: SHARED_PROFILE_CREATE_ERROR_MESSAGE };
    }

    return mapSharedProfileCreation(response.data);
  } catch {
    return { status: 'error', message: SHARED_PROFILE_CREATE_ERROR_MESSAGE };
  }
}

export async function loadSharedProfileInvitations(
  rpc: SharedProfileRpc,
): Promise<SharedProfileInvitationListResult> {
  try {
    const response = await rpc(SHARED_PROFILE_RPC.listInvitations, undefined);

    if (response.error) {
      return {
        status: 'error',
        message: SHARED_PROFILE_INVITATION_LIST_ERROR_MESSAGE,
      };
    }

    return mapSharedProfileInvitations(response.data);
  } catch {
    return {
      status: 'error',
      message: SHARED_PROFILE_INVITATION_LIST_ERROR_MESSAGE,
    };
  }
}

export async function inviteSharedProfileMember(
  rpc: SharedProfileRpc,
  profileId: string,
  nicknameInput: string,
): Promise<SharedProfileInviteResult> {
  if (!isNonEmptyString(profileId)) {
    return { status: 'error', message: SHARED_PROFILE_INVITE_ERROR_MESSAGE };
  }

  const validation = validateSharedProfileNickname(nicknameInput);

  if (validation.status === 'invalid') {
    return { status: 'error', message: validation.message };
  }

  try {
    const response = await rpc(SHARED_PROFILE_RPC.inviteMember, {
      target_profile_id: profileId,
      input_nickname: validation.nickname,
    });

    if (response.error) {
      const message = response.error.message.toLowerCase();

      if (message.includes('kajo user not found')) {
        return { status: 'error', message: SHARED_PROFILE_USER_NOT_FOUND_MESSAGE };
      }

      if (message.includes('cannot invite yourself')) {
        return { status: 'error', message: SHARED_PROFILE_SELF_INVITE_MESSAGE };
      }

      return { status: 'error', message: SHARED_PROFILE_INVITE_ERROR_MESSAGE };
    }

    return mapSharedProfileInvitationCreation(response.data);
  } catch {
    return { status: 'error', message: SHARED_PROFILE_INVITE_ERROR_MESSAGE };
  }
}

export async function respondSharedProfileInvitation(
  rpc: SharedProfileRpc,
  invitationId: string,
  accept: boolean,
): Promise<SharedProfileInvitationResponseResult> {
  if (!isNonEmptyString(invitationId)) {
    return {
      status: 'error',
      message: SHARED_PROFILE_INVITATION_RESPONSE_ERROR_MESSAGE,
    };
  }

  try {
    const response = await rpc(SHARED_PROFILE_RPC.respondInvitation, {
      target_invitation_id: invitationId,
      input_accept: accept,
    });

    if (response.error) {
      return {
        status: 'error',
        message: SHARED_PROFILE_INVITATION_RESPONSE_ERROR_MESSAGE,
      };
    }

    return mapSharedProfileInvitationResponse(response.data);
  } catch {
    return {
      status: 'error',
      message: SHARED_PROFILE_INVITATION_RESPONSE_ERROR_MESSAGE,
    };
  }
}

export async function leaveSharedProfile(
  rpc: SharedProfileRpc,
  profileId: string,
): Promise<SharedProfileLeaveResult> {
  if (!isNonEmptyString(profileId)) {
    return { status: 'error', message: SHARED_PROFILE_LEAVE_ERROR_MESSAGE };
  }

  try {
    const response = await rpc(SHARED_PROFILE_RPC.leave, {
      target_profile_id: profileId,
    });

    if (response.error) {
      return { status: 'error', message: SHARED_PROFILE_LEAVE_ERROR_MESSAGE };
    }

    return mapSharedProfileLeave(response.data);
  } catch {
    return { status: 'error', message: SHARED_PROFILE_LEAVE_ERROR_MESSAGE };
  }
}

export function mapSharedProfiles(data: unknown): SharedProfileListResult {
  if (!Array.isArray(data)) {
    return { status: 'error', message: SHARED_PROFILE_ERROR_MESSAGE };
  }

  const profiles: SharedProfileMembership[] = [];

  for (const row of data) {
    const mapped = mapSharedProfileRow(row);

    if (!mapped) {
      return { status: 'error', message: SHARED_PROFILE_ERROR_MESSAGE };
    }

    profiles.push(mapped);
  }

  return { status: 'success', profiles };
}

export function mapSharedProfileCreation(
  data: unknown,
): SharedProfileCreateResult {
  const row = getSingleRow(data);

  if (
    !row ||
    !isNonEmptyString(row.profile_id) ||
    !isNonEmptyString(row.profile_name) ||
    !Number.isInteger(row.member_count) ||
    typeof row.is_ready !== 'boolean'
  ) {
    return { status: 'error', message: SHARED_PROFILE_CREATE_ERROR_MESSAGE };
  }

  const memberCount = row.member_count as number;

  if (memberCount !== 1 || row.is_ready) {
    return { status: 'error', message: SHARED_PROFILE_CREATE_ERROR_MESSAGE };
  }

  return {
    status: 'success',
    creation: {
      profileId: row.profile_id,
      profileName: row.profile_name,
      memberCount,
      isReady: false,
    },
  };
}

export function mapSharedProfileInvitations(
  data: unknown,
): SharedProfileInvitationListResult {
  if (!Array.isArray(data)) {
    return {
      status: 'error',
      message: SHARED_PROFILE_INVITATION_LIST_ERROR_MESSAGE,
    };
  }

  const invitations: SharedProfileInvitation[] = [];

  for (const row of data) {
    if (
      !isRecord(row) ||
      !isNonEmptyString(row.invitation_id) ||
      !isNonEmptyString(row.profile_id) ||
      !isNonEmptyString(row.profile_name) ||
      !isNonEmptyString(row.inviter_user_id) ||
      !isNonEmptyString(row.inviter_nickname) ||
      !isNonEmptyString(row.created_at) ||
      Number.isNaN(Date.parse(row.created_at))
    ) {
      return {
        status: 'error',
        message: SHARED_PROFILE_INVITATION_LIST_ERROR_MESSAGE,
      };
    }

    invitations.push({
      id: row.invitation_id,
      profileId: row.profile_id,
      profileName: row.profile_name,
      inviter: {
        id: row.inviter_user_id,
        nickname: row.inviter_nickname,
      },
      createdAt: row.created_at,
    });
  }

  return { status: 'success', invitations };
}

export function mapSharedProfileInvitationCreation(
  data: unknown,
): SharedProfileInviteResult {
  const row = getSingleRow(data);

  if (
    !row ||
    !isNonEmptyString(row.profile_id) ||
    !isNonEmptyString(row.invited_user_id) ||
    !isNonEmptyString(row.nickname) ||
    !Number.isInteger(row.member_count) ||
    typeof row.is_ready !== 'boolean' ||
    typeof row.invitation_created !== 'boolean' ||
    typeof row.already_member !== 'boolean' ||
    (row.invitation_id !== null && !isNonEmptyString(row.invitation_id))
  ) {
    return { status: 'error', message: SHARED_PROFILE_INVITE_ERROR_MESSAGE };
  }

  const memberCount = row.member_count as number;
  const alreadyMember = row.already_member;
  const invitationId = row.invitation_id as string | null;

  if (
    memberCount < 1 ||
    row.is_ready !== (memberCount >= 2) ||
    (alreadyMember && (invitationId !== null || row.invitation_created)) ||
    (!alreadyMember && invitationId === null)
  ) {
    return { status: 'error', message: SHARED_PROFILE_INVITE_ERROR_MESSAGE };
  }

  return {
    status: 'success',
    invitation: {
      profileId: row.profile_id,
      invitationId,
      user: { id: row.invited_user_id, nickname: row.nickname },
      memberCount,
      isReady: row.is_ready,
      invitationCreated: row.invitation_created,
      alreadyMember,
    },
  };
}

export function mapSharedProfileInvitationResponse(
  data: unknown,
): SharedProfileInvitationResponseResult {
  const row = getSingleRow(data);

  if (
    !row ||
    !isNonEmptyString(row.invitation_id) ||
    !isNonEmptyString(row.profile_id) ||
    !isNonEmptyString(row.profile_name) ||
    typeof row.accepted !== 'boolean' ||
    !Number.isInteger(row.member_count) ||
    typeof row.is_ready !== 'boolean'
  ) {
    return {
      status: 'error',
      message: SHARED_PROFILE_INVITATION_RESPONSE_ERROR_MESSAGE,
    };
  }

  const memberCount = row.member_count as number;

  if (memberCount < 1 || row.is_ready !== (memberCount >= 2)) {
    return {
      status: 'error',
      message: SHARED_PROFILE_INVITATION_RESPONSE_ERROR_MESSAGE,
    };
  }

  return {
    status: 'success',
    response: {
      invitationId: row.invitation_id,
      profileId: row.profile_id,
      profileName: row.profile_name,
      accepted: row.accepted,
      memberCount,
      isReady: row.is_ready,
    },
  };
}

export function mapSharedProfileLeave(data: unknown): SharedProfileLeaveResult {
  const row = getSingleRow(data);

  if (
    !row ||
    !isNonEmptyString(row.profile_id) ||
    !isNonEmptyString(row.profile_name) ||
    !Number.isInteger(row.remaining_member_count) ||
    typeof row.profile_deleted !== 'boolean'
  ) {
    return { status: 'error', message: SHARED_PROFILE_LEAVE_ERROR_MESSAGE };
  }

  const remainingMemberCount = row.remaining_member_count as number;

  if (
    remainingMemberCount < 0 ||
    (row.profile_deleted && remainingMemberCount !== 0) ||
    (!row.profile_deleted && remainingMemberCount < 1)
  ) {
    return { status: 'error', message: SHARED_PROFILE_LEAVE_ERROR_MESSAGE };
  }

  return {
    status: 'success',
    leave: {
      profileId: row.profile_id,
      profileName: row.profile_name,
      remainingMemberCount,
      profileDeleted: row.profile_deleted,
    },
  };
}

function mapSharedProfileRow(row: unknown): SharedProfileMembership | null {
  if (
    !isRecord(row) ||
    !isNonEmptyString(row.profile_id) ||
    !isNonEmptyString(row.profile_name) ||
    !Number.isInteger(row.member_count) ||
    typeof row.is_ready !== 'boolean' ||
    !Array.isArray(row.members)
  ) {
    return null;
  }

  const members: User[] = [];

  for (const member of row.members) {
    if (
      !isRecord(member) ||
      !isNonEmptyString(member.userId) ||
      !isNonEmptyString(member.nickname)
    ) {
      return null;
    }

    members.push({ id: member.userId, nickname: member.nickname });
  }

  const memberCount = row.member_count as number;

  if (
    memberCount !== members.length ||
    memberCount < 1 ||
    row.is_ready !== (memberCount >= 2)
  ) {
    return null;
  }

  return {
    profile: {
      id: row.profile_id,
      type: 'SHARED',
      name: row.profile_name,
      memberUserIds: members.map((member) => member.id),
    },
    members,
    isReady: row.is_ready,
  };
}

function getSingleRow(data: unknown): Record<string, unknown> | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    return null;
  }

  return data[0];
}

function normalizeDisplayText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) {
      return true;
    }
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
