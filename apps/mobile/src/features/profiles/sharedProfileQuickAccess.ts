import type { Profile, ProfileId, SharedProfile } from '../../domain/contracts';

export interface SharedProfileUseState {
  recentProfileIds: readonly ProfileId[];
  usageCounts: Readonly<Record<ProfileId, number>>;
}

export const EMPTY_SHARED_PROFILE_USE_STATE: SharedProfileUseState = {
  recentProfileIds: [],
  usageCounts: {},
};

const MAXIMUM_TRACKED_SHARED_PROFILES = 50;

export function recordSharedProfileUse(
  current: SharedProfileUseState,
  profileId: ProfileId,
): SharedProfileUseState {
  if (!isNonEmptyString(profileId)) return current;

  const recentProfileIds = [
    profileId,
    ...current.recentProfileIds.filter((recentId) => recentId !== profileId),
  ].slice(0, MAXIMUM_TRACKED_SHARED_PROFILES);

  const usageCounts = Object.fromEntries(
    recentProfileIds.map((recentId) => [
      recentId,
      recentId === profileId
        ? (current.usageCounts[recentId] ?? 0) + 1
        : current.usageCounts[recentId] ?? 0,
    ]),
  );

  return { recentProfileIds, usageCounts };
}

export function selectQuickSharedProfiles(
  profiles: readonly Profile[],
  useState: SharedProfileUseState,
  limit = 5,
): readonly SharedProfile[] {
  const normalizedLimit = Math.max(0, Math.floor(limit));
  if (normalizedLimit === 0) return [];

  const recentOrder = new Map(
    useState.recentProfileIds.map((profileId, index) => [profileId, index]),
  );
  const sourceOrder = new Map(
    profiles.map((profile, index) => [profile.id, index]),
  );

  return profiles
    .filter((profile): profile is SharedProfile => profile.type === 'SHARED')
    .slice()
    .sort((first, second) => {
      const usageDifference =
        (useState.usageCounts[second.id] ?? 0) -
        (useState.usageCounts[first.id] ?? 0);
      if (usageDifference !== 0) return usageDifference;

      const firstRecent = recentOrder.get(first.id);
      const secondRecent = recentOrder.get(second.id);
      if (firstRecent !== undefined || secondRecent !== undefined) {
        if (firstRecent === undefined) return 1;
        if (secondRecent === undefined) return -1;
        if (firstRecent !== secondRecent) return firstRecent - secondRecent;
      }

      const sourceDifference =
        (sourceOrder.get(first.id) ?? Number.MAX_SAFE_INTEGER) -
        (sourceOrder.get(second.id) ?? Number.MAX_SAFE_INTEGER);
      if (sourceDifference !== 0) return sourceDifference;

      return first.id.localeCompare(second.id);
    })
    .slice(0, normalizedLimit);
}

export function parseSharedProfileUseState(
  value: string | null,
): SharedProfileUseState {
  if (!value) return EMPTY_SHARED_PROFILE_USE_STATE;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return EMPTY_SHARED_PROFILE_USE_STATE;

    const rawRecentProfileIds = parsed.recentProfileIds;
    const rawUsageCounts = parsed.usageCounts;
    if (!Array.isArray(rawRecentProfileIds) || !isRecord(rawUsageCounts)) {
      return EMPTY_SHARED_PROFILE_USE_STATE;
    }

    const recentProfileIds = rawRecentProfileIds
      .filter(isNonEmptyString)
      .filter((profileId, index, all) => all.indexOf(profileId) === index)
      .slice(0, MAXIMUM_TRACKED_SHARED_PROFILES);

    const usageCounts: Record<ProfileId, number> = {};
    for (const profileId of recentProfileIds) {
      const rawCount = rawUsageCounts[profileId];
      usageCounts[profileId] = isUsageCount(rawCount) ? rawCount : 0;
    }

    return { recentProfileIds, usageCounts };
  } catch {
    return EMPTY_SHARED_PROFILE_USE_STATE;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUsageCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}
