import type { SupabaseClient } from '@supabase/supabase-js';

import type { Item, ItemId, ItemType } from '../../domain/contracts';

const CATALOG_ITEM_SELECT = [
  'id',
  'item_type',
  'title',
  'description',
  'tags',
  'creators',
  'release_year',
  'image_url',
  'original_language',
].join(',');

interface CatalogItemRow {
  id: string;
  item_type: ItemType;
  title: string;
  description: string | null;
  tags: string[];
  creators: string[];
  release_year: number | null;
  image_url: string | null;
  original_language: string | null;
}

export type CatalogItemLoadResult =
  | { status: 'success'; items: readonly Item[] }
  | { status: 'error' };

export async function loadCatalogItems(
  client: SupabaseClient,
  itemIds: readonly ItemId[],
): Promise<CatalogItemLoadResult> {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { status: 'success', items: [] };
  }

  try {
    const { data, error } = await client
      .from('items')
      .select(CATALOG_ITEM_SELECT)
      .in('id', uniqueIds);

    if (error || !Array.isArray(data)) {
      return { status: 'error' };
    }

    const rows = data.filter(isCatalogItemRow);
    if (rows.length !== data.length) {
      return { status: 'error' };
    }

    return {
      status: 'success',
      items: rows.map(mapCatalogItemRow),
    };
  } catch {
    return { status: 'error' };
  }
}

export async function loadCatalogItem(
  client: SupabaseClient,
  itemId: ItemId,
): Promise<Item | null> {
  const result = await loadCatalogItems(client, [itemId]);
  return result.status === 'success' ? result.items[0] ?? null : null;
}

export function enrichItemsFromCatalog(
  rankedItems: readonly Item[],
  catalogItems: readonly Item[],
): readonly Item[] {
  const byId = new Map(catalogItems.map((item) => [item.id, item]));

  return rankedItems.map((item) => byId.get(item.id) ?? item);
}

export function mapCatalogItemRow(row: CatalogItemRow): Item {
  return {
    id: row.id,
    itemType: row.item_type,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    tags: row.tags,
    creators: row.creators,
    ...(row.release_year !== null ? { releaseYear: row.release_year } : {}),
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    ...(row.original_language
      ? { originalLanguage: row.original_language }
      : {}),
  };
}

function isCatalogItemRow(value: unknown): value is CatalogItemRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.id === 'string' &&
    (row.item_type === 'BOOK' || row.item_type === 'MOVIE') &&
    typeof row.title === 'string' &&
    (row.description === null || typeof row.description === 'string') &&
    Array.isArray(row.tags) &&
    row.tags.every((tag) => typeof tag === 'string') &&
    Array.isArray(row.creators) &&
    row.creators.every((creator) => typeof creator === 'string') &&
    (row.release_year === null ||
      (typeof row.release_year === 'number' && Number.isInteger(row.release_year))) &&
    (row.image_url === null || typeof row.image_url === 'string') &&
    (row.original_language === null || typeof row.original_language === 'string')
  );
}
