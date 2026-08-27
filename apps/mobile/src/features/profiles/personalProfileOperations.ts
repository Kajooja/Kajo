import type { PersonalProfile, User } from '@/domain/contracts';

export const PERSONAL_PROFILE_RPC = {
  get: 'get_my_personal_profile',
  complete: 'complete_personal_profile',
} as const;

export interface PersonalIdentity {
  user: User;
  profile: PersonalProfile;
}

interface RpcErrorLike {
  code?: string;
  message: string;
}

interface RpcResponse {
  data: unknown;
  error: RpcErrorLike | null;
}

export type PersonalProfileRpc = (
  functionName: string,
  arguments_?: Record<string, unknown>,
) => PromiseLike<RpcResponse>;

export type PersonalProfileOperationResult =
  | { status: 'ready'; identity: PersonalIdentity }
  | { status: 'missing' }
  | { status: 'error'; message: string };

export type NicknameValidationResult =
  | { status: 'valid'; nickname: string }
  | { status: 'invalid'; message: string };

const MINIMUM_NICKNAME_LENGTH = 2;
const MAXIMUM_NICKNAME_LENGTH = 32;
const PROFILE_ERROR_MESSAGE =
  'Oman Kajo-profiilin lataaminen epäonnistui. Yritä uudelleen.';
const NICKNAME_EXISTS_MESSAGE = 'Nimimerkki on jo käytössä. Valitse toinen.';

export function validateNickname(value: string): NicknameValidationResult {
  const nickname = value.trim().replace(/\s+/g, ' ');

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

  return { status: 'valid', nickname };
}

export async function loadPersonalIdentity(
  rpc: PersonalProfileRpc,
): Promise<PersonalProfileOperationResult> {
  return invokePersonalProfileRpc(rpc, PERSONAL_PROFILE_RPC.get);
}

export async function completePersonalIdentity(
  rpc: PersonalProfileRpc,
  nicknameInput: string,
): Promise<PersonalProfileOperationResult> {
  const validation = validateNickname(nicknameInput);

  if (validation.status === 'invalid') {
    return { status: 'error', message: validation.message };
  }

  return invokePersonalProfileRpc(rpc, PERSONAL_PROFILE_RPC.complete, {
    input_nickname: validation.nickname,
  });
}

async function invokePersonalProfileRpc(
  rpc: PersonalProfileRpc,
  functionName: string,
  arguments_?: Record<string, unknown>,
): Promise<PersonalProfileOperationResult> {
  try {
    const response = await rpc(functionName, arguments_);

    if (response.error) {
      if (
        functionName === PERSONAL_PROFILE_RPC.complete &&
        (response.error.code === '23505' ||
          response.error.message.toLowerCase().includes('nickname already exists'))
      ) {
        return { status: 'error', message: NICKNAME_EXISTS_MESSAGE };
      }

      return { status: 'error', message: PROFILE_ERROR_MESSAGE };
    }

    return mapPersonalIdentity(response.data);
  } catch {
    return { status: 'error', message: PROFILE_ERROR_MESSAGE };
  }
}

export function mapPersonalIdentity(
  data: unknown,
): PersonalProfileOperationResult {
  if (Array.isArray(data) && data.length === 0) {
    return { status: 'missing' };
  }

  if (!Array.isArray(data) || data.length !== 1) {
    return { status: 'error', message: PROFILE_ERROR_MESSAGE };
  }

  const row = data[0];

  if (
    !isRecord(row) ||
    !isNonEmptyString(row.user_id) ||
    !isNonEmptyString(row.nickname) ||
    !isNonEmptyString(row.profile_id) ||
    !isNonEmptyString(row.profile_name)
  ) {
    return { status: 'error', message: PROFILE_ERROR_MESSAGE };
  }

  return {
    status: 'ready',
    identity: {
      user: {
        id: row.user_id,
        nickname: row.nickname,
      },
      profile: {
        id: row.profile_id,
        type: 'PERSONAL',
        name: row.profile_name,
        ownerUserId: row.user_id,
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
