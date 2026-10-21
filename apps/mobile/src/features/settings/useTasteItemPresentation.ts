import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Item } from '../../domain/contracts';
import { loadCatalogItems } from '../discovery/catalogItemOperations';

// Public presentation enrichment is not a new forecast or a replacement question.
// Tag every result with the full owner/question/revision identity, including when
// the same Item recurs. A stale completion can never overwrite another question.
export function useTasteItemPresentation(client: SupabaseClient, identity: string, item: Item | null) {
  const [loaded, setLoaded] = useState<{ identity: string; client: SupabaseClient; item: Item } | null>(null);
  const id = item?.id; const type = item?.itemType;
  useEffect(() => {
    if (!id) return;
    let active = true;
    const abort = new AbortController();
    const timeout = setTimeout(() => { active = false; abort.abort(); }, 15_000);
    void loadCatalogItems(client, [id], abort.signal).then(result => {
      if (!active) return;
      clearTimeout(timeout);
      const found = result.status === 'success' ? result.items.find(candidate => candidate.id === id && candidate.itemType === type) : null;
      if (found) setLoaded({ identity, client, item: found });
    });
    return () => { active = false; clearTimeout(timeout); abort.abort(); };
  }, [client, identity, id, type]);
  return item && loaded?.identity === identity && loaded.client === client && loaded.item.id === item.id
    ? { ...loaded.item, id: item.id, title: item.title, itemType: item.itemType } : item;
}
