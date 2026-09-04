import Storage from 'expo-sqlite/kv-store';

import type { ProfileId, UserId } from '../../domain/contracts';
import {
  EMPTY_SHARED_PROFILE_USE_STATE,
  parseSharedProfileUseState,
  recordSharedProfileUse,
  type SharedProfileUseState,
} from './sharedProfileQuickAccess';

const STORAGE_PREFIX = 'kajo:shared-profile-use:v1:';

export function loadSharedProfileUse(
  actorUserId: UserId | null,
): SharedProfileUseState {
  if (!actorUserId) return EMPTY_SHARED_PROFILE_USE_STATE;

  try {
    return parseSharedProfileUseState(
      Storage.getItemSync(`${STORAGE_PREFIX}${actorUserId}`),
    );
  } catch {
    return EMPTY_SHARED_PROFILE_USE_STATE;
  }
}

export function rememberSharedProfileUse(
  actorUserId: UserId | null,
  profileId: ProfileId,
): SharedProfileUseState {
  if (!actorUserId) return EMPTY_SHARED_PROFILE_USE_STATE;

  const next = recordSharedProfileUse(loadSharedProfileUse(actorUserId), profileId);

  try {
    Storage.setItemSync(`${STORAGE_PREFIX}${actorUserId}`, JSON.stringify(next));
  } catch {
    // Quick-access ordering is optional local presentation state and must never
    // block a successful Profile switch.
  }

  return next;
}
