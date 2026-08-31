import type { SharedProfile, User } from '@/domain/contracts';

export const SHARED_PROFILE_RPC = {
  list: 'get_my_shared_profiles',
  create: 'create_shared_profile',
  addMember: 'add_shared_profile_member',
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

export interface SharedProfileMemberAddition {
  profileId: string;
  user: User;
  memberCount: number;
  isReady: boolean;
  added: boolean;
}

export type SharedProfileListResult =
  | { status: 'success'; profiles: readonly SharedProfileMembership[] }
  | { status: 'error'; message: string };

export type SharedProfileCreateResult =
  | { status: 'success'; creation: SharedProfileCreation }
  | { status: 'error'; message: string };

export type SharedProfileAddMemberResult =
  | { status: 'success'; addition: SharedProfileMemberAddition }
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
const SHARED_PROFILE_ADD_MEMBER_ERROR_MESSAGE =
  'Jäsenen lisääminen yhteiseen Kajoon epäonnistui. Yritä uudelleen.';
const SHARED_PROFILE_USER_NOT_FOUND_MESSAGE =
  'Tällä nimimerkillä ei löytynyt Kajo-käyttäjää.';
const MINIMUM_SHARED_PROFILE_NAME_LENGTH = 2;
const MAXIMUM_SHARED_PROFILE_NAME_LENGTH = 64;
const MINIMUM_NICKNAME_LENGTH = 2;
const MAXIMUM_NICKNAME_LENGTH = 32;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

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

  if (CONTROL_CHARACTER_PATTERN.test(name)) {
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

  if (nickname.length > MAXIMUM_NICKNAME_LENGTH) {
    return {
      status: 'invalid',
      message: `Nimimerkissä voi olla enintään ${MAXIMUM_NICKNAME_LENGTH} merkkiä.`,
    };
  }

  if (CONTROL_CHARACTER_PATTERN.test(nickname)) {
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

export async function addSharedProfileMember(
  rpc: SharedProfileRpc,
  profileId: string,
  nicknameInput: string,
): Promise<SharedProfileAddMemberResult> {
  if (!isNonEmptyString(profileId)) {
    return { status: 'error', message: SHARED_PROFILE_ADD_MEMBER_ERROR_MESSAGE };
  }

  const validation = validateSharedProfileNickname(nicknameInput);

  if (validation.status === 'invalid') {
    return { status: 'error', message: validation.message };
  }

  try {
    const response = await rpc(SHARED_PROFILE_RPC.addMember, {
      target_profile_id: profileId,
      input_nickname: validation.nickname,
    });

    if (response.error) {
      if (
        response.error.code === 'P0002' ||
        response.error.message.toLowerCase().includes('kajo user not found')
      ) {
        return { status: 'error', message: SHARED_PROFILE_USER_NOT_FOUND_MESSAGE };
      }

      return { status: 'error', message: SHARED_PROFILE_ADD_MEMBER_ERROR_MESSAGE };
    }

    return mapSharedProfileMemberAddition(response.data);
  } catch {
    return { status: 'error', message: SHARED_PROFILE_ADD_MEMBER_ERROR_MESSAGE };
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

export function mapSharedProfileMemberAddition(
  data: unknown,
): SharedProfileAddMemberResult {
  const row = getSingleRow(data);

  if (
    !row ||
    !isNonEmptyString(row.profile_id) ||
    !isNonEmptyString(row.user_id) ||
    !isNonEmptyString(row.nickname) ||
    !Number.isInteger(row.member_count) ||
    typeof row.is_ready !== 'boolean' ||
    typeof row.added !== 'boolean'
  ) {
    return { status: 'error', message: SHARED_PROFILE_ADD_MEMBER_ERROR_MESSAGE };
  }

  const memberCount = row.member_count as number;

  if (memberCount < 1 || row.is_ready !== (memberCount >= 2)) {
    return { status: 'error', message: SHARED_PROFILE_ADD_MEMBER_ERROR_MESSAGE };
  }

  return {
    status: 'success',
    addition: {
      profileId: row.profile_id,
      user: { id: row.user_id, nickname: row.nickname },
      memberCount,
      isReady: row.is_ready,
      added: row.added,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
