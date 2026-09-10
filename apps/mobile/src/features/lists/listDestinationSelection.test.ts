import { describe, expect, it } from 'vitest';
import type { ItemList } from '../../domain/contracts';
import { includeCreatedDestination, resolveListDestinations, toggleListDestination } from './listDestinationSelection';

const list = (id: string, containsItem = false): ItemList => ({
  id, profileId: 'profile-a', kind: 'CUSTOM', name: id,
  createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z',
  itemCount: containsItem ? 1 : 0, containsItem,
});

describe('destination selection before an explicit Item commit', () => {
  it('has no message/commit target before the first Shared List exists', () => {
    expect(resolveListDestinations([], null, true)).toEqual([]);
  });

  it('selects a newly created sole destination without marking the Item as saved', () => {
    const created = list('created');
    const destinations = includeCreatedDestination([], created);
    expect(resolveListDestinations(destinations, null, true)).toEqual([created]);
    expect(created.containsItem).toBe(false);
    expect(created.itemCount).toBe(0);
  });

  it('requires a choice among multiple destinations and keeps it through refresh reordering', () => {
    const a = list('a');
    const b = list('b');
    expect(resolveListDestinations([a, b], null, true)).toEqual([]);
    expect(resolveListDestinations([a, b], [b.id], true)).toEqual([b]);
    expect(resolveListDestinations([b, a], [a.id, b.id], true)).toEqual([a, b]);
    expect(resolveListDestinations([a, b], ['removed'], true)).toEqual([]);
  });

  it('makes the next unsaved Personal destination available after a confirmed addition', () => {
    const saved = list('saved', true);
    const remaining = list('remaining');
    expect(resolveListDestinations([saved, remaining], [saved.id, remaining.id], false)).toEqual([remaining]);
    expect(resolveListDestinations([saved], [saved.id], false)).toEqual([]);
    expect(resolveListDestinations([saved, remaining], [], false)).toEqual([]);
  });

  it('lets both profiles toggle several destinations and explicitly uncheck the sole List', () => {
    const a = list('a'); const b = list('b');
    const first = toggleListDestination([], a.id);
    const both = toggleListDestination(first, b.id);
    for (const shared of [false, true]) {
      expect(resolveListDestinations([b, a], both, shared)).toEqual([a, b]);
      expect(resolveListDestinations([a], toggleListDestination(first, a.id), shared)).toEqual([]);
    }
    expect(first).toEqual([a.id]);
  });

  it('keeps earlier checks when a created List joins the draft and excludes stale/duplicate targets', () => {
    const a = list('a'); const created = list('created');
    const choices = includeCreatedDestination([a], created);
    expect(resolveListDestinations(choices, [a.id, created.id, a.id, 'deleted'], true)).toEqual([a, created]);
    expect(a.containsItem).toBe(false);
    expect(created.containsItem).toBe(false);
  });

  it('keeps one copy of the created destination when the provider refresh races its result', () => {
    const older = list('older');
    const created = list('created');
    const refreshed = [older, created];
    expect(includeCreatedDestination(refreshed, created)).toEqual([created, older]);
    expect(refreshed).toEqual([older, created]);
  });
});
