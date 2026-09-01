import type { Item, ItemId, ItemType, User } from '../../domain/contracts';

export interface SharedDiscoveryItemState {
  item: Item;
  ineligibleForDiscovery: boolean;
  currentActorEndorsed: boolean;
  pendingEndorsement: boolean;
  consensusSaved: boolean;
  endorserUserIds: readonly string[];
  firstEndorsedAt: string | null;
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
      !state?.currentActorEndorsed &&
      !state?.consensusSaved
    );
  });

  return [...pendingItems, ...ordinaryItems];
}

export function getPendingEndorserNicknames(
  state: SharedDiscoveryItemState | undefined,
  members: readonly User[],
  currentActorUserId: string | null,
): readonly string[] {
  if (!state?.pendingEndorsement) return [];

  const nicknamesById = new Map(
    members.map((member) => [member.id, member.nickname]),
  );

  return state.endorserUserIds
    .filter((userId) => userId !== currentActorUserId)
    .map((userId) => nicknamesById.get(userId))
    .filter((nickname): nickname is string => Boolean(nickname));
}

export function formatEndorsementProvenance(
  nicknames: readonly string[],
): string | null {
  if (nicknames.length === 0) return null;
  if (nicknames.length === 1) return `${nicknames[0]} tykkäsi`;
  if (nicknames.length === 2) return `${nicknames[0]} ja ${nicknames[1]} tykkäsivät`;
  return `${nicknames[0]} ja ${nicknames.length - 1} muuta tykkäsivät`;
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
