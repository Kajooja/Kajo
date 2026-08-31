import { describe, expect, it } from 'vitest';

import type { PersonalProfile, SharedProfile } from '../../domain/contracts';
import { MOCK_ITEM_IDS } from './mockDiscovery';
import {
  createSharedSuggestionEventInput,
  resolveSharedSuggestionItem,
} from './sharedSuggestion';

const PERSONAL_PROFILE: PersonalProfile = {
  id: 'personal-1',
  type: 'PERSONAL',
  name: 'Oma Kajo',
  ownerUserId: 'user-1',
};

const SHARED_PROFILE: SharedProfile = {
  id: 'shared-1',
  type: 'SHARED',
  name: 'Meidän Kajo',
  memberUserIds: ['user-1', 'user-2'],
};

describe('resolveSharedSuggestionItem', () => {
  it('only resolves a valid Item detail inside SharedProfile context', () => {
    expect(
      resolveSharedSuggestionItem(
        SHARED_PROFILE,
        `/discovery/${MOCK_ITEM_IDS.bookLanternArchive}`,
        MOCK_ITEM_IDS.bookLanternArchive,
      )?.id,
    ).toBe(MOCK_ITEM_IDS.bookLanternArchive);

    expect(
      resolveSharedSuggestionItem(
        PERSONAL_PROFILE,
        `/discovery/${MOCK_ITEM_IDS.bookLanternArchive}`,
        MOCK_ITEM_IDS.bookLanternArchive,
      ),
    ).toBeNull();

    expect(
      resolveSharedSuggestionItem(
        SHARED_PROFILE,
        '/discovery/books',
        MOCK_ITEM_IDS.bookLanternArchive,
      ),
    ).toBeNull();

    expect(
      resolveSharedSuggestionItem(
        SHARED_PROFILE,
        '/discovery/not-a-real-item',
        'not-a-real-item',
      ),
    ).toBeNull();
  });
});

describe('createSharedSuggestionEventInput', () => {
  it('builds one canonical SharedProfile-scoped suggestion Event input', () => {
    const item = resolveSharedSuggestionItem(
      SHARED_PROFILE,
      `/discovery/${MOCK_ITEM_IDS.movieQuietOrbit}`,
      MOCK_ITEM_IDS.movieQuietOrbit,
    );

    expect(item).not.toBeNull();
    expect(createSharedSuggestionEventInput(item!, 'SURPRISE')).toEqual({
      eventType: 'ITEM_SUGGESTED',
      itemId: MOCK_ITEM_IDS.movieQuietOrbit,
      itemType: 'MOVIE',
      discoveryMode: 'SURPRISE',
      properties: {
        source: 'ITEM_DETAIL',
      },
    });
  });
});
