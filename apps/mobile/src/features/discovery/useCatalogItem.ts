import { useEffect, useState } from 'react';

import { useSupabaseConnection } from '@/data/SupabaseProvider';

import type { Item, ItemId } from '../../domain/contracts';
import { loadCatalogItem } from './catalogItemOperations';

export type CatalogItemState =
  | { status: 'loading'; item: Item | null }
  | { status: 'ready'; item: Item | null }
  | { status: 'error'; item: Item | null };

export function useCatalogItem(
  itemId: ItemId,
  seedItem: Item | null = null,
): CatalogItemState {
  const connection = useSupabaseConnection();
  const [state, setState] = useState<CatalogItemState>(() =>
    seedItem?.id === itemId
      ? { status: 'ready', item: seedItem }
      : { status: 'loading', item: null },
  );

  useEffect(() => {
    if (seedItem?.id === itemId) {
      setState({ status: 'ready', item: seedItem });
      return;
    }

    if (connection.status !== 'configured') {
      setState({ status: 'ready', item: null });
      return;
    }

    let active = true;
    setState((current) => ({ status: 'loading', item: current.item }));

    void loadCatalogItem(connection.client, itemId).then((item) => {
      if (!active) return;
      setState(item ? { status: 'ready', item } : { status: 'error', item: null });
    });

    return () => {
      active = false;
    };
  }, [connection, itemId, seedItem]);

  return state;
}
