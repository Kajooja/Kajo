import type { DiscoveryMode, Item, ItemId, Profile } from '../../domain/contracts';
import type { EventRecordInput } from '../events/eventTracking';
import { getMockItem } from './mockDiscovery';

export function resolveSharedSuggestionItem(
  profile: Profile | null,
  pathname: string,
  itemId: string | string[] | undefined,
): Item | null {
  if (profile?.type !== 'SHARED') {
    return null;
  }

  if (!pathname.startsWith('/discovery/') || pathname === '/discovery/books' || pathname === '/discovery/movies') {
    return null;
  }

  const resolvedItemId = Array.isArray(itemId) ? itemId[0] : itemId;

  if (!resolvedItemId) {
    return null;
  }

  return getMockItem(resolvedItemId as ItemId) ?? null;
}

export function createSharedSuggestionEventInput(
  item: Item,
  discoveryMode: DiscoveryMode,
): EventRecordInput {
  return {
    eventType: 'ITEM_SUGGESTED',
    itemId: item.id,
    itemType: item.itemType,
    discoveryMode,
    properties: {
      source: 'ITEM_DETAIL',
    },
  };
}
