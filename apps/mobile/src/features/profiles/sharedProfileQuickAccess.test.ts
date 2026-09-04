import { describe, expect, it } from 'vitest';

import type { Profile } from '../../domain/contracts';
import {
  EMPTY_SHARED_PROFILE_USE_STATE,
  parseSharedProfileUseState,
  recordSharedProfileUse,
  selectQuickSharedProfiles,
} from './sharedProfileQuickAccess';

const profiles: readonly Profile[] = [
  {
    id: 'personal-1',
    type: 'PERSONAL',
    name: 'Oma Kajo',
    ownerUserId: 'user-1',
  },
  shared('shared-1', 'Ensimmäinen'),
  shared('shared-2', 'Toinen'),
  shared('shared-3', 'Kolmas'),
  shared('shared-4', 'Neljäs'),
  shared('shared-5', 'Viides'),
  shared('shared-6', 'Kuudes'),
];

describe('SharedProfile quick access ordering', () => {
  it('shows only SharedProfiles and caps the menu at five', () => {
    expect(
      selectQuickSharedProfiles(profiles, EMPTY_SHARED_PROFILE_USE_STATE).map(
        (profile) => profile.id,
      ),
    ).toEqual(['shared-1', 'shared-2', 'shared-3', 'shared-4', 'shared-5']);
  });

  it('orders by usage count and uses recency as the tie-breaker', () => {
    let state = EMPTY_SHARED_PROFILE_USE_STATE;
    state = recordSharedProfileUse(state, 'shared-2');
    state = recordSharedProfileUse(state, 'shared-3');
    state = recordSharedProfileUse(state, 'shared-2');
    state = recordSharedProfileUse(state, 'shared-4');
    state = recordSharedProfileUse(state, 'shared-3');

    expect(
      selectQuickSharedProfiles(profiles, state).map((profile) => profile.id),
    ).toEqual(['shared-3', 'shared-2', 'shared-4', 'shared-1', 'shared-5']);
  });

  it('keeps one recent occurrence and increments usage deterministically', () => {
    const state = recordSharedProfileUse(
      recordSharedProfileUse(EMPTY_SHARED_PROFILE_USE_STATE, 'shared-2'),
      'shared-2',
    );

    expect(state.recentProfileIds).toEqual(['shared-2']);
    expect(state.usageCounts['shared-2']).toBe(2);
  });

  it('sanitizes corrupt or duplicate persisted ordering state', () => {
    expect(parseSharedProfileUseState('{bad json')).toEqual(
      EMPTY_SHARED_PROFILE_USE_STATE,
    );

    expect(
      parseSharedProfileUseState(
        JSON.stringify({
          recentProfileIds: ['shared-2', '', 'shared-2', 'shared-1'],
          usageCounts: { 'shared-2': 4, 'shared-1': -1 },
        }),
      ),
    ).toEqual({
      recentProfileIds: ['shared-2', 'shared-1'],
      usageCounts: { 'shared-2': 4, 'shared-1': 0 },
    });
  });
});

function shared(id: string, name: string): Profile {
  return {
    id,
    type: 'SHARED',
    name,
    memberUserIds: ['user-1', 'user-2'],
  };
}
