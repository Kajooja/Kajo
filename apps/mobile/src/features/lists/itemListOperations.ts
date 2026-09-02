import type {
  Item,
  ItemId,
  ItemList,
  ItemListId,
  ItemListKind,
  ItemType,
  ProfileId,
  UserId,
} from '../../domain/contracts';

export const ITEM_LIST_RPC = {
  list: 'get_profile_item_lists',
  create: 'create_custom_item_list',
  rename: 'rename_custom_item_list',
  remove: 'delete_custom_item_list',
  setDestinations: 'set_item_list_destinations',
  setEntry: 'set_item_list_entry',
  entries: 'get_item_list_entries',
  consumed: 'get_profile_consumed_items',
} as const;

interface RpcErrorLike {
  code?: string;
  message: string;
}

interface RpcResponse {
  data: unknown;
  error: RpcErrorLike | null;
}

export type ItemListRpc = (
  functionName: string,
  arguments_?: Record<string, unknown>,
) => PromiseLike<RpcResponse>;

export interface ItemListEntry {
  listId: ItemListId;
  profileId: ProfileId;
  listKind: ItemListKind;
  listName: string;
  item: Item;
  addedByUserId: UserId | null;
  addedByNickname: string | null;
  addedAt: string;
  saved: boolean;
  consumed: boolean;
  rating: number | null;
}

export interface ConsumedItem {
  profileId: ProfileId;
  item: Item;
  saved: boolean;
  consumed: boolean;
  rating: number | null;
  updatedAt: string;
}

export interface ItemListDestinationCommit {
  listIds: readonly ItemListId[];
  systemSaved: boolean;
}

export type ItemListsResult =
  | { status: 'success'; lists: readonly ItemList[] }
  | { status: 'error'; message: string };
export type ItemListMutationResult =
  | { status: 'success'; list: ItemList }
  | { status: 'error'; message: string };
export type ItemListDeleteResult =
  | { status: 'success' }
  | { status: 'error'; message: string };
export type ItemListDestinationResult =
  | { status: 'success'; commit: ItemListDestinationCommit }
  | { status: 'error'; message: string };
export type ItemListEntryMutationResult =
  | { status: 'success'; present: boolean }
  | { status: 'error'; message: string };
export type ItemListEntriesResult =
  | { status: 'success'; entries: readonly ItemListEntry[] }
  | { status: 'error'; message: string };
export type ConsumedItemsResult =
  | { status: 'success'; items: readonly ConsumedItem[] }
  | { status: 'error'; message: string };
export type ItemListNameValidationResult =
  | { status: 'valid'; name: string }
  | { status: 'invalid'; message: string };

export const MAXIMUM_ITEM_LIST_NAME_LENGTH = 40;
const LIST_LOAD_ERROR = 'Listojen lataaminen epäonnistui. Yritä uudelleen.';
const LIST_SAVE_ERROR = 'Listaa ei voitu tallentaa. Yritä uudelleen.';
const LIST_DELETE_ERROR = 'Listaa ei voitu poistaa. Yritä uudelleen.';
const LIST_DESTINATION_ERROR =
  'Listavalintoja ei voitu tallentaa. Yritä uudelleen.';
const LIST_ENTRIES_ERROR = 'Listan sisältöä ei voitu ladata. Yritä uudelleen.';
const CONSUMED_ITEMS_ERROR = 'Historian lataaminen epäonnistui. Yritä uudelleen.';

export function validateItemListName(value: string): ItemListNameValidationResult {
  const name = value.trim().replace(/\s+/g, ' ');

  if (name.length < 1) {
    return { status: 'invalid', message: 'Anna listalle nimi.' };
  }

  if (name.length > MAXIMUM_ITEM_LIST_NAME_LENGTH) {
    return {
      status: 'invalid',
      message: `Listan nimessä voi olla enintään ${MAXIMUM_ITEM_LIST_NAME_LENGTH} merkkiä.`,
    };
  }

  if (/\p{Cc}/u.test(name)) {
    return {
      status: 'invalid',
      message: 'Listan nimessä on merkkejä, joita ei voi käyttää.',
    };
  }

  return { status: 'valid', name };
}

export async function loadProfileItemLists(
  rpc: ItemListRpc,
  profileId: ProfileId,
  itemId: ItemId | null = null,
): Promise<ItemListsResult> {
  try {
    const response = await rpc(ITEM_LIST_RPC.list, {
      target_profile_id: profileId,
      target_item_id: itemId,
    });
    if (response.error) return { status: 'error', message: LIST_LOAD_ERROR };
    return mapItemLists(response.data);
  } catch {
    return { status: 'error', message: LIST_LOAD_ERROR };
  }
}

export async function createCustomItemList(
  rpc: ItemListRpc,
  profileId: ProfileId,
  nameInput: string,
): Promise<ItemListMutationResult> {
  const validation = validateItemListName(nameInput);
  if (validation.status === 'invalid') {
    return { status: 'error', message: validation.message };
  }

  try {
    const response = await rpc(ITEM_LIST_RPC.create, {
      target_profile_id: profileId,
      requested_name: validation.name,
    });
    if (response.error) {
      return {
        status: 'error',
        message: response.error.code === '23505'
          ? 'Samanniminen lista on jo olemassa.'
          : LIST_SAVE_ERROR,
      };
    }
    return mapSingleList(response.data);
  } catch {
    return { status: 'error', message: LIST_SAVE_ERROR };
  }
}

export async function renameCustomItemList(
  rpc: ItemListRpc,
  listId: ItemListId,
  nameInput: string,
): Promise<ItemListMutationResult> {
  const validation = validateItemListName(nameInput);
  if (validation.status === 'invalid') {
    return { status: 'error', message: validation.message };
  }

  try {
    const response = await rpc(ITEM_LIST_RPC.rename, {
      target_list_id: listId,
      requested_name: validation.name,
    });
    if (response.error) {
      return {
        status: 'error',
        message: response.error.code === '23505'
          ? 'Samanniminen lista on jo olemassa.'
          : LIST_SAVE_ERROR,
      };
    }
    return mapSingleList(response.data);
  } catch {
    return { status: 'error', message: LIST_SAVE_ERROR };
  }
}

export async function deleteCustomItemList(
  rpc: ItemListRpc,
  listId: ItemListId,
): Promise<ItemListDeleteResult> {
  try {
    const response = await rpc(ITEM_LIST_RPC.remove, { target_list_id: listId });
    return response.error || response.data !== true
      ? { status: 'error', message: LIST_DELETE_ERROR }
      : { status: 'success' };
  } catch {
    return { status: 'error', message: LIST_DELETE_ERROR };
  }
}

export async function setItemListDestinations(
  rpc: ItemListRpc,
  profileId: ProfileId,
  itemId: ItemId,
  listIds: readonly ItemListId[],
): Promise<ItemListDestinationResult> {
  try {
    const response = await rpc(ITEM_LIST_RPC.setDestinations, {
      target_profile_id: profileId,
      target_item_id: itemId,
      target_list_ids: [...new Set(listIds)],
    });
    if (response.error) {
      return { status: 'error', message: LIST_DESTINATION_ERROR };
    }
    return mapDestinationCommit(response.data);
  } catch {
    return { status: 'error', message: LIST_DESTINATION_ERROR };
  }
}

export async function setItemListEntry(
  rpc: ItemListRpc,
  listId: ItemListId,
  itemId: ItemId,
  present: boolean,
): Promise<ItemListEntryMutationResult> {
  try {
    const response = await rpc(ITEM_LIST_RPC.setEntry, {
      target_list_id: listId,
      target_item_id: itemId,
      requested_present: present,
    });
    return response.error || typeof response.data !== 'boolean'
      ? { status: 'error', message: LIST_DESTINATION_ERROR }
      : { status: 'success', present: response.data };
  } catch {
    return { status: 'error', message: LIST_DESTINATION_ERROR };
  }
}

export async function loadItemListEntries(
  rpc: ItemListRpc,
  listId: ItemListId,
): Promise<ItemListEntriesResult> {
  try {
    const response = await rpc(ITEM_LIST_RPC.entries, { target_list_id: listId });
    if (response.error || !Array.isArray(response.data)) {
      return { status: 'error', message: LIST_ENTRIES_ERROR };
    }

    const entries = response.data.map(mapItemListEntry);
    return entries.some((entry) => !entry)
      ? { status: 'error', message: LIST_ENTRIES_ERROR }
      : { status: 'success', entries: entries as ItemListEntry[] };
  } catch {
    return { status: 'error', message: LIST_ENTRIES_ERROR };
  }
}

export async function loadConsumedItems(
  rpc: ItemListRpc,
  profileId: ProfileId,
  itemType: ItemType | null,
): Promise<ConsumedItemsResult> {
  try {
    const response = await rpc(ITEM_LIST_RPC.consumed, {
      target_profile_id: profileId,
      requested_item_type: itemType,
    });
    if (response.error || !Array.isArray(response.data)) {
      return { status: 'error', message: CONSUMED_ITEMS_ERROR };
    }

    const items = response.data.map(mapConsumedItem);
    return items.some((item) => !item)
      ? { status: 'error', message: CONSUMED_ITEMS_ERROR }
      : { status: 'success', items: items as ConsumedItem[] };
  } catch {
    return { status: 'error', message: CONSUMED_ITEMS_ERROR };
  }
}

export function mapItemLists(data: unknown): ItemListsResult {
  if (!Array.isArray(data)) return { status: 'error', message: LIST_LOAD_ERROR };
  const lists = data.map(mapItemList);
  if (lists.some((list) => !list)) {
    return { status: 'error', message: LIST_LOAD_ERROR };
  }
  return { status: 'success', lists: lists as ItemList[] };
}

function mapSingleList(data: unknown): ItemListMutationResult {
  const result = mapItemLists(data);
  if (result.status === 'error' || result.lists.length !== 1) {
    return { status: 'error', message: LIST_SAVE_ERROR };
  }

  const list = result.lists[0];
  return list
    ? { status: 'success', list }
    : { status: 'error', message: LIST_SAVE_ERROR };
}

function mapDestinationCommit(data: unknown): ItemListDestinationResult {
  const row = getSingleRow(data);
  if (
    !row ||
    !Array.isArray(row.list_ids) ||
    !row.list_ids.every(isNonEmptyString) ||
    typeof row.system_saved !== 'boolean'
  ) {
    return { status: 'error', message: LIST_DESTINATION_ERROR };
  }
  return {
    status: 'success',
    commit: { listIds: row.list_ids as string[], systemSaved: row.system_saved },
  };
}

function mapItemList(value: unknown): ItemList | null {
  if (!isRecord(value)) return null;
  if (
    !isNonEmptyString(value.list_id) ||
    !isNonEmptyString(value.profile_id) ||
    !isItemListKind(value.list_kind) ||
    !isNonEmptyString(value.name) ||
    !isNonNegativeInteger(value.item_count) ||
    typeof value.contains_item !== 'boolean' ||
    !isIsoDate(value.created_at) ||
    !isIsoDate(value.updated_at)
  ) return null;

  return {
    id: value.list_id,
    profileId: value.profile_id,
    kind: value.list_kind,
    name: value.name,
    itemCount: value.item_count,
    containsItem: value.contains_item,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function mapItemListEntry(value: unknown): ItemListEntry | null {
  if (!isRecord(value)) return null;
  const item = mapItem(value);
  if (
    !item ||
    !isNonEmptyString(value.list_id) ||
    !isNonEmptyString(value.profile_id) ||
    !isItemListKind(value.list_kind) ||
    !isNonEmptyString(value.list_name) ||
    (value.added_by_user_id !== null && !isNonEmptyString(value.added_by_user_id)) ||
    (value.added_by_nickname !== null && !isNonEmptyString(value.added_by_nickname)) ||
    !isIsoDate(value.added_at) ||
    typeof value.saved !== 'boolean' ||
    typeof value.consumed !== 'boolean' ||
    !isRating(value.rating)
  ) return null;

  return {
    listId: value.list_id,
    profileId: value.profile_id,
    listKind: value.list_kind,
    listName: value.list_name,
    item,
    addedByUserId: value.added_by_user_id as string | null,
    addedByNickname: value.added_by_nickname as string | null,
    addedAt: value.added_at,
    saved: value.saved,
    consumed: value.consumed,
    rating: value.rating as number | null,
  };
}

function mapConsumedItem(value: unknown): ConsumedItem | null {
  if (!isRecord(value)) return null;
  const item = mapItem(value);
  if (
    !item ||
    !isNonEmptyString(value.profile_id) ||
    typeof value.saved !== 'boolean' ||
    typeof value.consumed !== 'boolean' ||
    !isRating(value.rating) ||
    !isIsoDate(value.updated_at)
  ) return null;

  return {
    profileId: value.profile_id,
    item,
    saved: value.saved,
    consumed: value.consumed,
    rating: value.rating as number | null,
    updatedAt: value.updated_at,
  };
}

function mapItem(value: Record<string, unknown>): Item | null {
  if (
    !isNonEmptyString(value.item_id) ||
    (value.item_type !== 'BOOK' && value.item_type !== 'MOVIE') ||
    !isNonEmptyString(value.title) ||
    (value.description !== null && typeof value.description !== 'string') ||
    !Array.isArray(value.tags) ||
    !value.tags.every((tag) => typeof tag === 'string')
  ) return null;

  return {
    id: value.item_id,
    itemType: value.item_type,
    title: value.title,
    ...(value.description ? { description: value.description } : {}),
    tags: value.tags as string[],
  };
}

function getSingleRow(data: unknown): Record<string, unknown> | null {
  return Array.isArray(data) && data.length === 1 && isRecord(data[0])
    ? data[0]
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isItemListKind(value: unknown): value is ItemListKind {
  return value === 'SYSTEM_SAVED' || value === 'CUSTOM';
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isRating(value: unknown): value is number | null {
  return value === null || (
    Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10
  );
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}
