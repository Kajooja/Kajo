import type { SharedProfile, User } from '@/domain/contracts';

export const SHARED_PROFILE_RPC = {
  list: 'get_my_shared_profiles',
} as const;

interface RpcErrorLike {
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

export type SharedProfileListResult =
  | { status: 'success'; profiles: readonly SharedProfileMembership[] }
  | { status: 'error'; message: string };

const SHARED_PROFILE_ERROR_MESSAGE =
  'Yhteisten Kajo-profiilien lataaminen epäonnistui. Yritä uudelleen.';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
