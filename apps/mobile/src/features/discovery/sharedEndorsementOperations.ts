import type { ItemType, ProfileId } from '../../domain/contracts';
import {
  EMPTY_SHARED_DISCOVERY_STATE,
  type SharedDiscoveryItemState,
  type SharedDiscoveryStateMap,
} from './sharedEndorsement';

export const SHARED_ENDORSEMENT_RPC = {
  overlay: 'get_shared_discovery_overlay',
  endorse: 'endorse_shared_list_item',
} as const;

interface RpcErrorLike {
  code?: string;
  message: string;
}

interface RpcResponse {
  data: unknown;
  error: RpcErrorLike | null;
}

export type SharedEndorsementRpc = (
  functionName: string,
  arguments_: Record<string, unknown>,
) => PromiseLike<RpcResponse>;

export type SharedDiscoveryOverlayResult =
  | { status: 'success'; stateByItemId: SharedDiscoveryStateMap }
  | { status: 'error'; message: string };

export interface SharedEndorsementCommit {
  profileId: string;
  itemId: string;
  actorUserId: string;
  endorsementCreated: boolean;
  endorsementCount: number;
  requiredMemberCount: number;
  consensusReached: boolean;
  consensusSaved: boolean;
  proposalListId: string;
  proposalListName: string;
  proposedByUserId: string;
  listEntryCreated: boolean;
}

export type SharedEndorsementCommitResult =
  | { status: 'success'; commit: SharedEndorsementCommit }
  | { status: 'error'; message: string };

const OVERLAY_ERROR_MESSAGE =
  'Yhteisten valintojen lataaminen epäonnistui. Yritä uudelleen.';
const ENDORSEMENT_ERROR_MESSAGE =
  'Yhteisen valinnan tallentaminen epäonnistui. Yritä uudelleen.';

export async function loadSharedDiscoveryOverlay(
  rpc: SharedEndorsementRpc,
  profileId: ProfileId,
): Promise<SharedDiscoveryOverlayResult> {
  try {
    const response = await rpc(SHARED_ENDORSEMENT_RPC.overlay, {
      target_profile_id: profileId,
      requested_item_type: null,
    });

    if (response.error) return overlayError();
    return mapSharedDiscoveryOverlay(response.data);
  } catch {
    return overlayError();
  }
}

export async function endorseSharedItem(
  rpc: SharedEndorsementRpc,
  profileId: ProfileId,
  itemId: string,
  listId: string | null = null,
): Promise<SharedEndorsementCommitResult> {
  try {
    const response = await rpc(SHARED_ENDORSEMENT_RPC.endorse, {
      target_profile_id: profileId,
      target_item_id: itemId,
      target_list_id: listId,
    });

    if (response.error) return endorsementError();
    return mapSharedEndorsementCommit(response.data);
  } catch {
    return endorsementError();
  }
}

export function mapSharedDiscoveryOverlay(
  data: unknown,
): SharedDiscoveryOverlayResult {
  if (!Array.isArray(data)) return overlayError();

  const stateByItemId: Record<string, SharedDiscoveryItemState> = {};

  for (const row of data) {
    const state = mapOverlayRow(row);

    if (!state || stateByItemId[state.item.id]) return overlayError();
    stateByItemId[state.item.id] = state;
  }

  return {
    status: 'success',
    stateByItemId:
      Object.keys(stateByItemId).length > 0
        ? stateByItemId
        : EMPTY_SHARED_DISCOVERY_STATE,
  };
}

export function mapSharedEndorsementCommit(
  data: unknown,
): SharedEndorsementCommitResult {
  const row = getSingleRow(data);

  if (
    !row ||
    !isNonEmptyString(row.profile_id) ||
    !isNonEmptyString(row.item_id) ||
    !isNonEmptyString(row.actor_user_id) ||
    typeof row.endorsement_created !== 'boolean' ||
    !isNonNegativeInteger(row.endorsement_count) ||
    !isPositiveInteger(row.required_member_count) ||
    typeof row.consensus_reached !== 'boolean' ||
    typeof row.consensus_saved !== 'boolean' ||
    !isNonEmptyString(row.proposal_list_id) ||
    !isNonEmptyString(row.proposal_list_name) ||
    !isNonEmptyString(row.proposed_by_user_id) ||
    typeof row.list_entry_created !== 'boolean'
  ) {
    return endorsementError();
  }

  const endorsementCount = row.endorsement_count as number;
  const requiredMemberCount = row.required_member_count as number;

  if (
    endorsementCount > requiredMemberCount ||
    row.endorsement_created && endorsementCount < 1 ||
    row.consensus_reached &&
      (!row.consensus_saved || endorsementCount !== requiredMemberCount) ||
    row.list_entry_created && !row.consensus_saved
  ) {
    return endorsementError();
  }

  return {
    status: 'success',
    commit: {
      profileId: row.profile_id,
      itemId: row.item_id,
      actorUserId: row.actor_user_id,
      endorsementCreated: row.endorsement_created,
      endorsementCount,
      requiredMemberCount,
      consensusReached: row.consensus_reached,
      consensusSaved: row.consensus_saved,
      proposalListId: row.proposal_list_id,
      proposalListName: row.proposal_list_name,
      proposedByUserId: row.proposed_by_user_id,
      listEntryCreated: row.list_entry_created,
    },
  };
}

function mapOverlayRow(value: unknown): SharedDiscoveryItemState | null {
  if (!isRecord(value)) return null;

  if (
    !isNonEmptyString(value.item_id) ||
    (value.item_type !== 'BOOK' && value.item_type !== 'MOVIE') ||
    !isNonEmptyString(value.title) ||
    (value.description !== null && typeof value.description !== 'string') ||
    !Array.isArray(value.tags) ||
    !value.tags.every((tag) => typeof tag === 'string') ||
    typeof value.ineligible_for_discovery !== 'boolean' ||
    !Array.isArray(value.member_consumed_user_ids) ||
    !value.member_consumed_user_ids.every(isNonEmptyString) ||
    (value.member_max_rating !== null &&
      (!isNonNegativeInteger(value.member_max_rating) ||
        (value.member_max_rating as number) > 10)) ||
    typeof value.current_actor_endorsed !== 'boolean' ||
    typeof value.pending_endorsement !== 'boolean' ||
    typeof value.consensus_saved !== 'boolean' ||
    !Array.isArray(value.endorser_user_ids) ||
    !value.endorser_user_ids.every(isNonEmptyString) ||
    (value.first_endorsed_at !== null &&
      (!isNonEmptyString(value.first_endorsed_at) ||
        Number.isNaN(Date.parse(value.first_endorsed_at)))) ||
    (value.proposed_list_id !== null && !isNonEmptyString(value.proposed_list_id)) ||
    (value.proposed_list_name !== null && !isNonEmptyString(value.proposed_list_name)) ||
    (value.proposed_by_user_id !== null && !isNonEmptyString(value.proposed_by_user_id))
  ) {
    return null;
  }

  if (
    value.pending_endorsement && value.endorser_user_ids.length === 0 ||
    value.current_actor_endorsed && value.endorser_user_ids.length === 0 ||
    value.endorser_user_ids.length === 0 && value.first_endorsed_at !== null ||
    value.pending_endorsement && (
      value.proposed_list_id === null ||
      value.proposed_list_name === null ||
      value.proposed_by_user_id === null
    )
  ) {
    return null;
  }

  const itemType = value.item_type as ItemType;

  return {
    item: {
      id: value.item_id,
      itemType,
      title: value.title,
      ...(value.description ? { description: value.description } : {}),
      tags: value.tags as string[],
    },
    ineligibleForDiscovery: value.ineligible_for_discovery,
    memberConsumedUserIds: value.member_consumed_user_ids as string[],
    memberMaxRating: value.member_max_rating as number | null,
    currentActorEndorsed: value.current_actor_endorsed,
    pendingEndorsement: value.pending_endorsement,
    consensusSaved: value.consensus_saved,
    endorserUserIds: value.endorser_user_ids as string[],
    firstEndorsedAt: value.first_endorsed_at as string | null,
    proposedListId: value.proposed_list_id as string | null,
    proposedListName: value.proposed_list_name as string | null,
    proposedByUserId: value.proposed_by_user_id as string | null,
  };
}

function getSingleRow(data: unknown): Record<string, unknown> | null {
  return Array.isArray(data) && data.length === 1 && isRecord(data[0])
    ? data[0]
    : null;
}

function overlayError(): SharedDiscoveryOverlayResult {
  return { status: 'error', message: OVERLAY_ERROR_MESSAGE };
}

function endorsementError(): SharedEndorsementCommitResult {
  return { status: 'error', message: ENDORSEMENT_ERROR_MESSAGE };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}
