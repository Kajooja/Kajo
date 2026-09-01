import { describe, expect, it } from 'vitest';

import {
  applySharedDiscoveryOverlay,
  formatEndorsementProvenance,
  formatMemberHistoryProvenance,
  getMemberHistoryNicknames,
  getPendingEndorserNicknames,
  type SharedDiscoveryStateMap,
} from './sharedEndorsement';

const ITEMS = [
  { id: 'ordinary', itemType: 'MOVIE' as const, title: 'Ordinary' },
  { id: 'seen-low', itemType: 'MOVIE' as const, title: 'Seen low' },
  { id: 'endorsed-by-me', itemType: 'MOVIE' as const, title: 'Mine' },
  { id: 'shared-consumed', itemType: 'MOVIE' as const, title: 'Together' },
];

const STATE: SharedDiscoveryStateMap = {
  pending: {
    item: { id: 'pending', itemType: 'MOVIE', title: 'Pending' },
    ineligibleForDiscovery: false,
    memberConsumedUserIds: [],
    memberMaxRating: null,
    currentActorEndorsed: false,
    pendingEndorsement: true,
    consensusSaved: false,
    endorserUserIds: ['user-b'],
    firstEndorsedAt: '2026-09-01T10:00:00.000Z',
  },
  'seen-low': {
    item: ITEMS[1]!,
    ineligibleForDiscovery: false,
    memberConsumedUserIds: ['user-b'],
    memberMaxRating: 4,
    currentActorEndorsed: false,
    pendingEndorsement: false,
    consensusSaved: false,
    endorserUserIds: [],
    firstEndorsedAt: null,
  },
  'endorsed-by-me': {
    item: ITEMS[2]!,
    ineligibleForDiscovery: false,
    memberConsumedUserIds: [],
    memberMaxRating: null,
    currentActorEndorsed: true,
    pendingEndorsement: true,
    consensusSaved: false,
    endorserUserIds: ['user-a'],
    firstEndorsedAt: '2026-09-01T11:00:00.000Z',
  },
  'seen-high': {
    item: { id: 'seen-high', itemType: 'MOVIE', title: 'Seen high' },
    ineligibleForDiscovery: false,
    memberConsumedUserIds: ['user-a'],
    memberMaxRating: 9,
    currentActorEndorsed: false,
    pendingEndorsement: false,
    consensusSaved: false,
    endorserUserIds: [],
    firstEndorsedAt: null,
  },
  'shared-consumed': {
    item: ITEMS[3]!,
    ineligibleForDiscovery: true,
    memberConsumedUserIds: [],
    memberMaxRating: null,
    currentActorEndorsed: false,
    pendingEndorsement: false,
    consensusSaved: false,
    endorserUserIds: [],
    firstEndorsedAt: null,
  },
};

describe('Shared discovery collaboration overlay', () => {
  it('keeps pending first, ordinary ranking next and member history last by rating', () => {
    expect(
      applySharedDiscoveryOverlay(ITEMS, 'MOVIE', STATE).map((item) => item.id),
    ).toEqual(['pending', 'ordinary', 'seen-high', 'seen-low']);
  });

  it('uses only real member nicknames for pending provenance', () => {
    const nicknames = getPendingEndorserNicknames(
      STATE.pending,
      [
        { id: 'user-a', nickname: 'KajoA' },
        { id: 'user-b', nickname: 'Mirri' },
      ],
      'user-a',
    );

    expect(nicknames).toEqual(['Mirri']);
    expect(formatEndorsementProvenance(nicknames)).toBe('Mirri tykkäsi');
    expect(formatEndorsementProvenance([])).toBeNull();
  });

  it('uses accepted member nicknames for restrained consumed provenance', () => {
    const nicknames = getMemberHistoryNicknames(
      STATE['seen-low'],
      [
        { id: 'user-a', nickname: 'KajoA' },
        { id: 'user-b', nickname: 'Mirri' },
      ],
    );

    expect(nicknames).toEqual(['Mirri']);
    expect(formatMemberHistoryProvenance(nicknames)).toBe('Mirri nähnyt');
    expect(formatMemberHistoryProvenance(['A', 'B'])).toBe(
      'A ja B nähneet',
    );
  });
});
