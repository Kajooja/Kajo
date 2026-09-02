import type { Item, ItemId, ItemType, User } from '../../domain/contracts';

export interface SharedDiscoveryItemState {
  item: Item;
  ineligibleForDiscovery: boolean;
  memberConsumedUserIds: readonly string[];
  memberMaxRating: number | null;
  currentActorEndorsed: boolean;
  pendingEndorsement: boolean;
  consensusSaved: boolean;
  endorserUserIds: readonly string[];
  firstEndorsedAt: string | null;
  proposedListId: string | null;
  proposedListName: string | null;
  proposedByUserId: string | null;
}

export interface PendingListApproval {
  listId: string;
  listName: string;
  proposedByUserId: string;
  proposedByNickname: string;
}

export type SharedDiscoveryStateMap = Readonly<
  Record<ItemId, SharedDiscoveryItemState>
>;

export const EMPTY_SHARED_DISCOVERY_STATE: SharedDiscoveryStateMap = {};

export function applySharedDiscoveryOverlay(
  rankedItems: readonly Item[],
  itemType: ItemType,
  stateByItemId: SharedDiscoveryStateMap,
): readonly Item[] {
  const rankedIndexById = new Map(
    rankedItems.map((item, index) => [item.id, index]),
  );
  const pendingItems = Object.values(stateByItemId)
    .filter(
      (state) =>
        state.item.itemType === itemType &&
        state.pendingEndorsement &&
        !state.currentActorEndorsed &&
        !state.consensusSaved &&
        !state.ineligibleForDiscovery,
    )
    .sort(comparePendingItems)
    .map((state) => state.item);
  const pendingIds = new Set(pendingItems.map((item) => item.id));
  const ordinaryItems = rankedItems.filter((item) => {
    const state = stateByItemId[item.id];

    return (
      !pendingIds.has(item.id) &&
      !state?.ineligibleForDiscovery &&
      !state?.memberConsumedUserIds.length &&
      !state?.currentActorEndorsed &&
      !state?.consensusSaved
    );
  });
  const memberHistoryItems = Object.values(stateByItemId)
    .filter(
      (state) =>
        state.item.itemType === itemType &&
        state.memberConsumedUserIds.length > 0 &&
        !pendingIds.has(state.item.id) &&
        !state.ineligibleForDiscovery &&
        !state.currentActorEndorsed &&
        !state.consensusSaved,
    )
    .sort((first, second) =>
      compareMemberHistoryItems(first, second, rankedIndexById),
    )
    .map((state) => state.item);

  return [...pendingItems, ...ordinaryItems, ...memberHistoryItems];
}

export function getPendingListApproval(
  state: SharedDiscoveryItemState | undefined,
  members: readonly User[],
  currentActorUserId: string | null,
): PendingListApproval | null {
  if (
    !state?.pendingEndorsement ||
    state.currentActorEndorsed ||
    !state.proposedListId ||
    !state.proposedListName ||
    !state.proposedByUserId ||
    state.proposedByUserId === currentActorUserId
  ) {
    return null;
  }

  const proposedByNickname = members.find(
    (member) => member.id === state.proposedByUserId,
  )?.nickname;

  return proposedByNickname
    ? {
        listId: state.proposedListId,
        listName: state.proposedListName,
        proposedByUserId: state.proposedByUserId,
        proposedByNickname,
      }
    : null;
}

export function formatPendingListApproval(
  approval: PendingListApproval | null,
): string | null {
  return approval
    ? `${approval.proposedByNickname} lisäsi listaan ${approval.listName}`
    : null;
}

export function getMemberHistoryNicknames(
  state: SharedDiscoveryItemState | undefined,
  members: readonly User[],
): readonly string[] {
  if (!state?.memberConsumedUserIds.length) return [];

  const nicknamesById = new Map(
    members.map((member) => [member.id, member.nickname]),
  );

  return state.memberConsumedUserIds
    .map((userId) => nicknamesById.get(userId))
    .filter((nickname): nickname is string => Boolean(nickname));
}

export function formatMemberHistoryProvenance(
  nicknames: readonly string[],
): string | null {
  if (nicknames.length === 0) return null;
  if (nicknames.length === 1) return `${nicknames[0]} nähnyt`;
  if (nicknames.length === 2) return `${nicknames[0]} ja ${nicknames[1]} nähneet`;
  return `${nicknames[0]} ja ${nicknames.length - 1} muuta nähneet`;
}

function comparePendingItems(
  first: SharedDiscoveryItemState,
  second: SharedDiscoveryItemState,
): number {
  const timeComparison = (first.firstEndorsedAt ?? '').localeCompare(
    second.firstEndorsedAt ?? '',
  );

  return timeComparison || first.item.id.localeCompare(second.item.id);
}

function compareMemberHistoryItems(
  first: SharedDiscoveryItemState,
  second: SharedDiscoveryItemState,
  rankedIndexById: ReadonlyMap<string, number>,
): number {
  const ratingComparison =
    (second.memberMaxRating ?? -1) - (first.memberMaxRating ?? -1);

  if (ratingComparison !== 0) return ratingComparison;

  const rankComparison =
    (rankedIndexById.get(first.item.id) ?? Number.MAX_SAFE_INTEGER) -
    (rankedIndexById.get(second.item.id) ?? Number.MAX_SAFE_INTEGER);

  return rankComparison || first.item.id.localeCompare(second.item.id);
}
