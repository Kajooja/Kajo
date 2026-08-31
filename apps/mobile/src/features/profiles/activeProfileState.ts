import type { PersonalProfile, Profile, ProfileId } from '../../domain/contracts';

import type { SharedProfileMembership } from './sharedProfileOperations';

export function getSelectableProfiles(
  personalProfile: PersonalProfile | null,
  sharedProfiles: readonly SharedProfileMembership[],
): readonly Profile[] {
  if (!personalProfile) return [];

  return [
    personalProfile,
    ...sharedProfiles
      .filter((membership) => membership.isReady)
      .map((membership) => membership.profile),
  ];
}

export function resolveActiveProfile(
  requestedProfileId: ProfileId | null,
  personalProfile: PersonalProfile | null,
  sharedProfiles: readonly SharedProfileMembership[],
): Profile | null {
  if (!personalProfile) return null;

  if (!requestedProfileId || requestedProfileId === personalProfile.id) {
    return personalProfile;
  }

  const shared = sharedProfiles.find(
    (membership) =>
      membership.isReady && membership.profile.id === requestedProfileId,
  );

  return shared?.profile ?? personalProfile;
}
