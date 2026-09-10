import { describe, expect, it, vi } from 'vitest';
import type { ItemList } from '../../domain/contracts';
import { commitPersonalListDestinations, includeCreatedDestination, resolveListDestinations, toggleListDestination,
  type ListDestinationCommitResult } from './listDestinationSelection';

const list = (id: string, containsItem = false): ItemList => ({
  id, profileId: 'profile-a', kind: 'CUSTOM', name: id,
  createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z',
  itemCount: containsItem ? 1 : 0, containsItem,
});

describe('one confirmation for all Personal destinations', () => {
  it('advances once after both durable acknowledgements without another Done action', async () => {
    const releases: ((result: ListDestinationCommitResult) => void)[] = [];
    const save = vi.fn(() => new Promise<ListDestinationCommitResult>(resolve => { releases.push(resolve); }));
    const onCommitted = vi.fn(async () => ({ status: 'success' as const }));
    const onSaved = vi.fn();
    const a = list('a'); const b = list('b');
    const pending = commitPersonalListDestinations({ lists: [a, b], message: 'Message',
      save, onSaved, onCommitted, isCurrent: () => true });
    expect(save).toHaveBeenCalledTimes(1);
    expect(onCommitted).not.toHaveBeenCalled();
    releases[0]!({ status: 'success' });
    await Promise.resolve();
    expect(save).toHaveBeenNthCalledWith(2, b);
    expect(onSaved).toHaveBeenCalledWith(a, 1);
    expect(onCommitted).not.toHaveBeenCalled();
    releases[1]!({ status: 'success' });
    expect(await pending).toEqual({ status: 'success' });
    expect(onSaved).toHaveBeenLastCalledWith(b, 2);
    expect(onCommitted).toHaveBeenCalledExactlyOnceWith({ lists: [a, b], added: true, message: 'Message', stayOpen: false });
  });

  it('retains unresolved choices on partial failure and never repeats saved additions or messages', async () => {
    const a = list('a'); const b = list('b'); const c = list('c');
    let available = [a, b, c]; let selected = [a.id, b.id, c.id];
    const save = vi.fn<() => Promise<ListDestinationCommitResult>>()
      .mockResolvedValueOnce({ status: 'success' }).mockResolvedValueOnce({ status: 'error', message: 'Offline' })
      .mockResolvedValue({ status: 'success' });
    const onCommitted = vi.fn(async () => ({ status: 'success' as const }));
    const options = { message: 'Message', save, onCommitted, isCurrent: () => true,
      onSaved(saved: ItemList) {
        selected = selected.filter(id => id !== saved.id);
        available = available.map(row => row.id === saved.id ? { ...row, containsItem: true } : row);
      } };
    expect(await commitPersonalListDestinations({ ...options, lists: [a, b, c] }))
      .toEqual({ status: 'error', message: 'Offline' });
    expect(onCommitted).toHaveBeenNthCalledWith(1, { lists: [a], added: true, message: 'Message', stayOpen: true });
    expect(selected).toEqual(['b', 'c']);
    const remaining = resolveListDestinations(available, selected, false);
    expect(await commitPersonalListDestinations({ ...options, lists: remaining })).toEqual({ status: 'success' });
    expect(onCommitted).toHaveBeenNthCalledWith(2, { lists: [b, c], added: true, message: 'Message', stayOpen: false });
    expect(selected).toEqual([]);
    expect(save.mock.calls).toHaveLength(4); // A once; failed B, retried B, then C.
  });

  it('does not advance or send a message if no destination is acknowledged', async () => {
    const onCommitted = vi.fn(async () => ({ status: 'success' as const }));
    const onSaved = vi.fn();
    const result = await commitPersonalListDestinations({ lists: [list('a')], message: 'Message',
      isCurrent: () => true, onSaved, onCommitted,
      save: async () => { throw new Error('No acknowledgement'); } });
    expect(result.status).toBe('error');
    expect(onSaved).not.toHaveBeenCalled(); expect(onCommitted).not.toHaveBeenCalled();
  });

  it('stops old-view completion and later commands when scope changes during a save', async () => {
    let current = true;
    const onCommitted = vi.fn(async () => ({ status: 'success' as const }));
    const onSaved = vi.fn();
    const save = vi.fn(async () => { current = false; return { status: 'success' as const }; });
    expect((await commitPersonalListDestinations({ lists: [list('a'), list('b')], message: 'Message',
      isCurrent: () => current, save, onSaved, onCommitted })).status).toBe('error');
    expect(save).toHaveBeenCalledOnce(); expect(onSaved).not.toHaveBeenCalled(); expect(onCommitted).not.toHaveBeenCalled();
  });

  it('keeps successful additions and reports an optional message failure while advancing', async () => {
    const onCommitted = vi.fn(async () => ({ status: 'success' as const, notice: 'Message failed' }));
    const a = list('a'); const b = list('b');
    expect(await commitPersonalListDestinations({ lists: [a, b], message: 'Message',
      isCurrent: () => true, save: async () => ({ status: 'success' }), onSaved() {}, onCommitted }))
      .toEqual({ status: 'success', notice: 'Message failed' });
    expect(onCommitted).toHaveBeenCalledExactlyOnceWith({ lists: [a, b], added: true, message: 'Message', stayOpen: false });
  });
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
