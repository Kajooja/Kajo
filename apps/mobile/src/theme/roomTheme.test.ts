import { describe, expect, it } from 'vitest';

import type { PersonalProfile, SharedProfile } from '../domain/contracts';
import {
  getRoomBaseTheme,
  getRoomTheme,
  PERSONAL_ROOM_BASE_THEME,
} from './roomTheme';

const PERSONAL: PersonalProfile = {
  id: 'personal-1',
  type: 'PERSONAL',
  name: 'Oma Kajo',
  ownerUserId: 'user-1',
};

const SHARED_A: SharedProfile = {
  id: 'shared-a',
  type: 'SHARED',
  name: 'Meidän Kajo',
  memberUserIds: ['user-1', 'user-2'],
};

const SHARED_B: SharedProfile = {
  id: 'shared-b',
  type: 'SHARED',
  name: 'Toinen Kajo',
  memberUserIds: ['user-1', 'user-3'],
};

describe('room theme', () => {
  it('preserves the existing PersonalProfile base identity across ambient phases', () => {
    expect(getRoomTheme('DAWN', PERSONAL).base).toBe(PERSONAL_ROOM_BASE_THEME);
    expect(getRoomTheme('EVENING', PERSONAL).base).toBe(PERSONAL_ROOM_BASE_THEME);
    expect(getRoomTheme('NIGHT', PERSONAL).base).toBe(PERSONAL_ROOM_BASE_THEME);
    expect(getRoomTheme('DAWN').base).toBe(PERSONAL_ROOM_BASE_THEME);
  });

  it('resolves a stable shared base identity from profile id', () => {
    expect(getRoomBaseTheme(SHARED_A)).toBe(getRoomBaseTheme(SHARED_A));
    expect(getRoomTheme('DAWN', SHARED_A).base).toBe(
      getRoomTheme('NIGHT', SHARED_A).base,
    );
  });

  it('can give different SharedProfiles different base identities', () => {
    expect(getRoomBaseTheme(SHARED_A)).not.toBe(getRoomBaseTheme(SHARED_B));
  });

  it('changes ambient tokens without changing the selected base identity', () => {
    const dawn = getRoomTheme('DAWN', SHARED_A);
    const evening = getRoomTheme('EVENING', SHARED_A);
    const night = getRoomTheme('NIGHT', SHARED_A);

    expect(dawn.ambient.wash).not.toBe(evening.ambient.wash);
    expect(evening.ambient.wash).not.toBe(night.ambient.wash);
    expect(dawn.base).toBe(evening.base);
    expect(evening.base).toBe(night.base);
  });
});
