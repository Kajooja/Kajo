import { router } from 'expo-router';
import type { Item } from '../../domain/contracts';
import { useDiscoveryMode } from '../discovery/DiscoveryModeContext';
import { rememberCollectionSlate } from '../discovery/deliveredSlate';
import { useEventTracking } from '../events/EventTrackingContext';
import { useItemLists } from './ItemListsContext';

// Carry authorized, loaded collection Items into detail. They are never a
// recommendation slate and must not borrow its Prediction or mock catalog.
export function useCollectionNavigation() {
  const { scopeKey } = useItemLists();
  const { mode } = useDiscoveryMode();
  const events = useEventTracking();
  return (item: Item, items: readonly Item[], title: string) => {
    const deliveryId = events.createEventId();
    rememberCollectionSlate({ id: deliveryId, scopeKey, sessionId: events.sessionId,
      mode, items, collectionTitle: title });
    router.push({ pathname: '/discovery/[itemId]', params: { itemId: item.id, deliveryId } });
  };
}
