import { describe, expect, it } from 'vitest';
import type { ItemList } from '../../domain/contracts';
import { includeCreatedDestination, resolveListDestination } from './listDestinationSelection';

const list = (id: string, containsItem = false): ItemList => ({
  id, profileId: 'profile-a', kind: 'CUSTOM', name: id,
  createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z',
  itemCount: containsItem ? 1 : 0, containsItem,
});

describe('destination selection before an explicit Item commit', () => {
  it('has no message/commit target before the first Shared List exists', () => {
    expect(resolveListDestination([], null, true)).toBeNull();
  });

  it('selects a newly created sole destination without marking the Item as saved', () => {
    const created = list('created');
    const destinations = includeCreatedDestination([], created);
    expect(resolveListDestination(destinations, null, true)).toBe(created);
    expect(created.containsItem).toBe(false);
    expect(created.itemCount).toBe(0);
  });

  it('requires a choice among multiple destinations and keeps it through refresh reordering', () => {
    const a = list('a');
    const b = list('b');
    expect(resolveListDestination([a, b], null, true)).toBeNull();
    expect(resolveListDestination([a, b], b.id, true)).toBe(b);
    expect(resolveListDestination([b, a], b.id, true)).toBe(b);
    expect(resolveListDestination([a, b], 'removed', true)).toBeNull();
  });

  it('makes the next unsaved Personal destination available after a confirmed addition', () => {
    const saved = list('saved', true);
    const remaining = list('remaining');
    expect(resolveListDestination([saved, remaining], saved.id, false)).toBe(remaining);
    expect(resolveListDestination([saved], saved.id, false)).toBeNull();
  });

  it('keeps one copy of the created destination when the provider refresh races its result', () => {
    const older = list('older');
    const created = list('created');
    const refreshed = [older, created];
    expect(includeCreatedDestination(refreshed, created)).toEqual([created, older]);
    expect(refreshed).toEqual([older, created]);
  });
});
