import type { SupabaseClient } from '@supabase/supabase-js';
import type { Item, ItemId } from '../../domain/contracts';
import { loadCatalogItems } from './catalogItemOperations';

export const CATALOG_DETAIL_TIMEOUT_MS = 15_000;

export type CatalogDetailResult =
  | { status: 'ready'; item: Item }
  | { status: 'missing' }
  | { status: 'error' };

// A List/history entry is not a delivered Prediction. Read its canonical Item
// without borrowing another slate's cached content or recommendation identity.
export function startCatalogDetailLoad(
  client: SupabaseClient,
  itemId: ItemId,
  onResult: (result: CatalogDetailResult) => void,
): () => void {
  let active = true;
  const finish = (result: CatalogDetailResult) => {
    if (!active) return;
    active = false;
    clearTimeout(timeout);
    onResult(result);
  };
  const timeout = setTimeout(() => finish({ status: 'error' }), CATALOG_DETAIL_TIMEOUT_MS);

  void loadCatalogItems(client, [itemId]).then(result => {
    if (result.status === 'error') {
      finish({ status: 'error' });
      return;
    }
    const item = result.items.find(candidate => candidate.id === itemId);
    finish(item ? { status: 'ready', item } : { status: 'missing' });
  });

  return () => {
    active = false;
    clearTimeout(timeout);
  };
}
