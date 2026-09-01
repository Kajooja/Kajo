import { describe, expect, it, vi } from 'vitest';

import {
  endorseSharedItem,
  loadSharedDiscoveryOverlay,
  mapSharedDiscoveryOverlay,
  mapSharedEndorsementCommit,
  SHARED_ENDORSEMENT_RPC,
  type SharedEndorsementRpc,
} from './sharedEndorsementOperations';

const OVERLAY_ROW = {
  item_id: 'item-1',
  item_type: 'MOVIE',
  title: 'Movie',
  description: null,
  tags: ['quiet'],
  ineligible_for_discovery: false,
  current_actor_endorsed: false,
  pending_endorsement: true,
  consensus_saved: false,
  endorser_user_ids: ['user-b'],
  first_endorsed_at: '2026-09-01T10:00:00.000Z',
};

const COMMIT_ROW = {
  status: 'CONSENSUS_REACHED',
  profile_id: 'profile-1',
  item_id: 'item-1',
  actor_user_id: 'user-a',
  endorsement_created: true,
  endorsement_count: 2,
  required_member_count: 2,
  consensus_reached: true,
  consensus_saved: true,
};

describe('Shared discovery overlay mapping', () => {
  it('maps generic Item metadata and actor-specific collaboration state', () => {
    expect(mapSharedDiscoveryOverlay([OVERLAY_ROW])).toEqual({
      status: 'success',
      stateByItemId: {
        'item-1': {
          item: {
            id: 'item-1',
            itemType: 'MOVIE',
            title: 'Movie',
            tags: ['quiet'],
          },
          ineligibleForDiscovery: false,
          currentActorEndorsed: false,
          pendingEndorsement: true,
          consensusSaved: false,
          endorserUserIds: ['user-b'],
          firstEndorsedAt: '2026-09-01T10:00:00.000Z',
        },
      },
    });
  });

  it('rejects malformed, duplicate and internally inconsistent rows', () => {
    expect(mapSharedDiscoveryOverlay(null)).toMatchObject({ status: 'error' });
    expect(mapSharedDiscoveryOverlay([OVERLAY_ROW, OVERLAY_ROW])).toMatchObject({
      status: 'error',
    });
    expect(
      mapSharedDiscoveryOverlay([
        { ...OVERLAY_ROW, endorser_user_ids: [], pending_endorsement: true },
      ]),
    ).toMatchObject({ status: 'error' });
  });
});

describe('Shared endorsement RPC boundary', () => {
  it('loads the authorized SharedProfile overlay through one bounded RPC', async () => {
    const rpc: SharedEndorsementRpc = vi.fn(async () => ({
      data: [OVERLAY_ROW],
      error: null,
    }));

    await expect(loadSharedDiscoveryOverlay(rpc, 'profile-1')).resolves.toMatchObject({
      status: 'success',
    });
    expect(rpc).toHaveBeenCalledWith(SHARED_ENDORSEMENT_RPC.overlay, {
      target_profile_id: 'profile-1',
      requested_item_type: null,
    });
  });

  it('maps consensus and keeps backend errors private', async () => {
    expect(mapSharedEndorsementCommit([COMMIT_ROW])).toEqual({
      status: 'success',
      commit: {
        profileId: 'profile-1',
        itemId: 'item-1',
        actorUserId: 'user-a',
        endorsementCreated: true,
        endorsementCount: 2,
        requiredMemberCount: 2,
        consensusReached: true,
        consensusSaved: true,
      },
    });

    const rpc: SharedEndorsementRpc = vi.fn(async () => ({
      data: null,
      error: { message: 'private database detail' },
    }));

    await expect(
      endorseSharedItem(rpc, 'profile-1', 'item-1'),
    ).resolves.toEqual({
      status: 'error',
      message: 'Yhteisen valinnan tallentaminen epäonnistui. Yritä uudelleen.',
    });
  });
});
