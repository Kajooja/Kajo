import { describe, expect, it } from 'vitest';

import type { PersonalProfile } from '../../domain/contracts';
import {
  getSelectableProfiles,
  resolveActiveProfile,
} from './activeProfileState';
import type { SharedProfileMembership } from './sharedProfileOperations';

const PERSONAL: PersonalProfile = {
  id: 'personal-1',
  type: 'PERSONAL',
  name: 'KeTTu',
  ownerUserId: 'user-1',
};

const READY_SHARED: SharedProfileMembership = {
  profile: {
    id: 'shared-ready',
    type: 'SHARED',
    name: 'Meidän Kajo',
    memberUserIds: ['user-1', 'user-2'],
  },
  members: [
    { id: 'user-1', nickname: 'KeTTu' },
    { id: 'user-2', nickname: 'Susi' },
  ],
  isReady: true,
};

const PROVISIONAL_SHARED: SharedProfileMembership = {
  profile: {
    id: 'shared-provisional',
    type: 'SHARED',
    name: 'Kesken',
    memberUserIds: ['user-1'],
  },
  members: [{ id: 'user-1', nickname: 'KeTTu' }],
  isReady: false,
};

describe('active Profile selection', () => {
  it('keeps PersonalProfile as the default and only exposes ready SharedProfiles', () => {
    expect(
      getSelectableProfiles(PERSONAL, [READY_SHARED, PROVISIONAL_SHARED]),
    ).toEqual([PERSONAL, READY_SHARED.profile]);

    expect(
      resolveActiveProfile(null, PERSONAL, [READY_SHARED, PROVISIONAL_SHARED]),
    ).toEqual(PERSONAL);
  });

  it('selects a ready SharedProfile', () => {
    expect(
      resolveActiveProfile('shared-ready', PERSONAL, [
        READY_SHARED,
        PROVISIONAL_SHARED,
      ]),
    ).toEqual(READY_SHARED.profile);
  });

  it('falls back to PersonalProfile for provisional or unknown shared ids', () => {
    expect(
      resolveActiveProfile('shared-provisional', PERSONAL, [
        READY_SHARED,
        PROVISIONAL_SHARED,
      ]),
    ).toEqual(PERSONAL);
    expect(
      resolveActiveProfile('missing', PERSONAL, [READY_SHARED]),
    ).toEqual(PERSONAL);
  });
});
