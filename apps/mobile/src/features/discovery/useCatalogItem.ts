import { useEffect, useState } from 'react';

import { useSupabaseConnection } from '@/data/SupabaseProvider';

import type { Item, ItemId } from '../../domain/contracts';
import { loadCatalogItem } from './catalogItemOperations';

export type CatalogItemState =
  | { status: 'loading'; item: Item | null }
  | { status: 'ready'; item: Item | null }
  | { status: 'error'; item: Item | null };

interface LoadedCatalogItemState {
  itemId: ItemId;
  state: CatalogItemState;
}

export function useCatalogItem(
  itemId: ItemId,
  seedItem: Item | null = null,
): CatalogItemState {
  const connection = useSupabaseConnection();
  const seededItem = seedItem?.id === itemId ? seedItem : null;
  const [loaded, setLoaded] = useState<LoadedCatalogItemState | null>(null);

  useEffect(() => {
    if (seededItem || connection.status !== 'configured') {
      return;
    }

    let active = true;

    void loadCatalogItem(connection.client, itemId).then((item) => {
      if (!active) return;
      setLoaded({
        itemId,
        state: item
          ? { status: 'ready', item }
          : { status: 'error', item: null },
      });
    });

    return () => {
      active = false;
    };
  }, [connection, itemId, seededItem]);

  if (seededItem) {
    return { status: 'ready', item: seededItem };
  }

  if (connection.status !== 'configured') {
    return { status: 'ready', item: null };
  }

  if (loaded?.itemId === itemId) {
    return loaded.state;
  }

  return { status: 'loading', item: null };
}
