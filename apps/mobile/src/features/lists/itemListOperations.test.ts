import { describe, expect, it, vi } from 'vitest';

import {
  createCustomItemList,
  loadItemListEntries,
  loadProfileItemLists,
  validateItemListName,
  type ItemListRpc,
} from './itemListOperations';

const LIST_ROW = {
  list_id: 'list-a',
  profile_id: 'profile-a',
  list_kind: 'SYSTEM_SAVED',
  name: 'Tallennetut',
  item_count: 2,
  contains_item: true,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-01T10:00:00.000Z',
};

describe('item list operations', () => {
  it('normalizes and validates names within the 40 character boundary', () => {
    expect(validateItemListName('  Syksyn   kirjat  ')).toEqual({
      status: 'valid',
      name: 'Syksyn kirjat',
    });
    expect(validateItemListName('   ').status).toBe('invalid');
    expect(validateItemListName('a'.repeat(41)).status).toBe('invalid');
  });

  it('maps generic system and custom lists without media-specific state', async () => {
    const rpc = vi.fn<ItemListRpc>().mockResolvedValue({
      data: [LIST_ROW, { ...LIST_ROW, list_id: 'list-b', list_kind: 'CUSTOM', name: 'Meidän' }],
      error: null,
    });

    const result = await loadProfileItemLists(rpc, 'profile-a', 'item-a');

    expect(result).toEqual({
      status: 'success',
      lists: [
        {
          id: 'list-a',
          profileId: 'profile-a',
          kind: 'SYSTEM_SAVED',
          name: 'Tallennetut',
          itemCount: 2,
          containsItem: true,
          createdAt: '2026-09-01T10:00:00.000Z',
          updatedAt: '2026-09-01T10:00:00.000Z',
        },
        expect.objectContaining({ id: 'list-b', kind: 'CUSTOM', name: 'Meidän' }),
      ],
    });
  });

  it('passes a normalized list name and maps duplicate-name errors', async () => {
    const successRpc = vi.fn<ItemListRpc>().mockResolvedValue({
      data: [{ ...LIST_ROW, list_kind: 'CUSTOM', name: 'Meidän' }],
      error: null,
    });
    const success = await createCustomItemList(successRpc, 'profile-a', ' Meidän ');
    expect(success.status).toBe('success');
    expect(successRpc).toHaveBeenCalledWith('create_custom_item_list', {
      target_profile_id: 'profile-a',
      requested_name: 'Meidän',
    });

    const duplicateRpc = vi.fn<ItemListRpc>().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    });
    await expect(createCustomItemList(duplicateRpc, 'profile-a', 'Meidän')).resolves.toEqual({
      status: 'error',
      message: 'Samanniminen lista on jo olemassa.',
    });
  });

  it('rejects malformed entry provenance instead of guessing an actor', async () => {
    const rpc = vi.fn<ItemListRpc>().mockResolvedValue({
      data: [{
        list_id: 'list-a',
        profile_id: 'profile-a',
        list_kind: 'CUSTOM',
        list_name: 'Meidän',
        item_id: 'item-a',
        item_type: 'MOVIE',
        title: 'Movie A',
        description: null,
        tags: [],
        added_by_user_id: null,
        added_by_nickname: 42,
        added_at: '2026-09-01T10:00:00.000Z',
        saved: false,
        consumed: false,
        rating: null,
      }],
      error: null,
    });

    expect(await loadItemListEntries(rpc, 'list-a')).toEqual({
      status: 'error',
      message: 'Listan sisältöä ei voitu ladata. Yritä uudelleen.',
    });
  });
});
