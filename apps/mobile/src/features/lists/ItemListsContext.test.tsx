/// <reference types="node" />
import React, { useLayoutEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemListsProvider, useItemLists } from './ItemListsContext';

const fixture = vi.hoisted(() => ({
  connection: { status: 'configured', client: {}, config: { url: 'https://fixture.invalid' } },
  profile: { status: 'ready', actorUserId: 'actor', activeProfile: { id: 'profile' } },
  sessionId: 'session', load: vi.fn(), submitCollectionAction: vi.fn(),
  collectionRevision: 0, listMembershipRevision: 0,
}));
vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const react = createRequire(require.resolve('react-test-renderer'))('react');
  return { ...react, default: react };
});
vi.mock('@/data/SupabaseProvider', () => ({ useSupabaseConnection: () => fixture.connection }));
vi.mock('@/features/profiles/ActiveProfileContext', () => ({ useActiveProfile: () => fixture.profile }));
vi.mock('@/features/discovery/ItemInteractionContext', () => ({ useItemInteractions: () => ({
  submitCollectionAction: fixture.submitCollectionAction,
  collectionRevision: fixture.collectionRevision, listMembershipRevision: fixture.listMembershipRevision,
}) }));
vi.mock('@/features/events/collectionActions', async () =>
  await vi.importActual<typeof import('../events/collectionActions')>('../events/collectionActions'));
vi.mock('../events/EventTrackingContext', () => ({ useEventTracking: () => ({ sessionId: fixture.sessionId }) }));
vi.mock('./itemListOperations', async () => ({
  ...await vi.importActual<typeof import('./itemListOperations')>('./itemListOperations'),
  loadProfileItemLists: (...args: unknown[]) => fixture.load(...args),
}));

let root: ReactTestRenderer | undefined;
let current: ReturnType<typeof useItemLists>;
function Probe() {
  const value = useItemLists();
  useLayoutEffect(() => { current = value; }, [value]);
  return null;
}
function tree() { return <ItemListsProvider><Probe /></ItemListsProvider>; }
async function update() { await act(async () => { root!.update(tree()); }); }

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.collectionRevision = fixture.listMembershipRevision = 0;
  fixture.profile = { status: 'ready', actorUserId: 'actor', activeProfile: { id: 'profile' } };
  fixture.sessionId = 'session';
  fixture.load.mockReset().mockResolvedValue({ status: 'success', lists: [] });
});
afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  root = undefined; vi.unstubAllGlobals();
});

describe('List reads under continuous rating acknowledgements', () => {
  it('keeps history revision current without repeatedly loading Lists after ratings', async () => {
    await act(async () => { root = create(tree()); });
    expect(current.status).toBe('ready');
    expect(fixture.load).toHaveBeenCalledTimes(1);
    const loadForItem = current.loadForItem;
    for (let index = 0; index < 16; index++) {
      fixture.collectionRevision++;
      await update();
    }
    expect(current.revision).toBe(16);
    expect(current.membershipRevision).toBe(0);
    expect(current.loadForItem).toBe(loadForItem);
    expect(fixture.load).toHaveBeenCalledTimes(1);

    fixture.collectionRevision++; fixture.listMembershipRevision++;
    await update();
    expect(current.revision).toBe(17);
    expect(current.membershipRevision).toBe(1);
    expect(fixture.load).toHaveBeenCalledTimes(2);
    await act(async () => { current.refresh(); });
    expect(fixture.load).toHaveBeenCalledTimes(3);
  });

  it('still reads the new Profile/session and rejects a delayed previous-scope result', async () => {
    let resolve!: (value: unknown) => void;
    fixture.load.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await act(async () => { root = create(tree()); });
    const oldItemRead = current.loadForItem;
    fixture.profile = { ...fixture.profile, activeProfile: { id: 'other-profile' } };
    await update();
    expect(current.scopeKey).toBe('https://fixture.invalid:actor:other-profile');
    expect(fixture.load).toHaveBeenCalledTimes(2);
    await act(async () => { resolve({ status: 'success', lists: [{ id: 'private-old-list' }] }); });
    expect(current.lists).toEqual([]);
    expect(await oldItemRead('old-item')).toMatchObject({ status: 'error' });
    expect(fixture.load).toHaveBeenCalledTimes(2);
    fixture.sessionId = 'new-session';
    await update();
    expect(fixture.load).toHaveBeenCalledTimes(3);
  });
});
