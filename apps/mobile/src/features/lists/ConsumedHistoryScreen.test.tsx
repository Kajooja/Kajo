import React, { type ReactElement, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import type { DiscoveryMode, ItemType } from '../../domain/contracts';
import type { ConsumedItemsResult } from './itemListOperations';
import { ConsumedHistoryContent, type ConsumedHistoryScreenProps } from './ConsumedHistoryScreen';
import { CollectionGrid } from './CollectionGrid';
import { getDeliveredSlate } from '../discovery/deliveredSlate';

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  memos: [] as { deps: readonly unknown[]; value: unknown }[],
  effects: [] as { deps: readonly unknown[]; cleanup: (() => void) | undefined }[],
  pending: new Map<number, () => void>(),
  layoutPending: new Map<number, () => void>(),
  stateIndex: 0, memoIndex: 0, effectIndex: 0,
}));
const context = vi.hoisted(() => ({
  scopeKey: 'test:actor:personal' as string | null,
  profileName: 'Personal',
  mode: 'FOR_YOU' as DiscoveryMode,
  revision: 0,
  sessionId: 'test-session',
  deliveryId: 'history-navigation-test',
  recordEvent: vi.fn(),
  submitCollectionAction: vi.fn(),
  loadConsumed: vi.fn<(itemType: ItemType | null) => Promise<ConsumedItemsResult>>(),
}));

// Run the real render/effect functions with controlled hook state. Deliberately
// inspect a new-scope render before flushing effects: hiding stale rows only in
// an effect is too late. This does not mount or simulate native views.
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const same = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
    Boolean(a && a.length === b.length && a.every((value, index) => Object.is(value, b[index])));
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.states[index], (next: unknown) => {
        hooks.states[index] = typeof next === 'function' ? next(hooks.states[index]) : next;
      }];
    },
    useRef: (initial: unknown) => {
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = { current: initial };
      return hooks.states[index];
    },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
      const index = hooks.memoIndex++;
      if (!same(hooks.memos[index]?.deps, deps)) hooks.memos[index] = { deps, value: factory() };
      return hooks.memos[index]?.value;
    },
    useLayoutEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => {
      const index = hooks.effectIndex++;
      const previous = hooks.effects[index];
      if (same(previous?.deps, deps)) return;
      hooks.effects[index] = { deps, cleanup: previous?.cleanup };
      hooks.layoutPending.set(index, () => {
        previous?.cleanup?.();
        const cleanup = effect();
        hooks.effects[index]!.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      });
    },
    useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => {
      const index = hooks.effectIndex++;
      const previous = hooks.effects[index];
      if (same(previous?.deps, deps)) return;
      hooks.effects[index] = { deps, cleanup: previous?.cleanup };
      hooks.pending.set(index, () => {
        previous?.cleanup?.();
        const cleanup = effect();
        hooks.effects[index]!.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      });
    },
  };
});
vi.mock('../events/EventTrackingContext', () => ({ useEventTracking: () => ({
  sessionId: context.sessionId, createEventId: () => context.deliveryId, recordEvent: context.recordEvent,
}) }));
vi.mock('../discovery/ItemInteractionContext', () => ({ useItemInteractions: () => ({
  submitCollectionAction: context.submitCollectionAction,
}) }));
vi.mock('./CollectionGrid', () => ({ CollectionGrid: 'CollectionGrid' }));
vi.mock('./ItemListsContext', () => ({ useItemLists: () => context }));
vi.mock('../profiles/ActiveProfileContext', () => ({ useActiveProfile: () => ({
  activeProfile: { id: context.scopeKey, type: 'PERSONAL', name: context.profileName },
}) }));
vi.mock('../discovery/DiscoveryModeContext', () => ({ useDiscoveryMode: () => ({ mode: context.mode }) }));
vi.mock('expo-router', () => ({ router: { back: vi.fn(), push: vi.fn() } }));
vi.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('react-native', () => ({
  Pressable: 'Pressable', Text: 'Text', View: 'View', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());

type Props = { children?: ReactNode; onPress?: () => void };
function nodes(value: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(value).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...nodes(child.props.children)] : []);
}
function text(value: ReactNode): string {
  return React.Children.toArray(value).map(child => React.isValidElement<Props>(child)
    ? text(child.props.children) : String(child)).join(' ');
}
type HistoryOptions = Omit<ConsumedHistoryScreenProps, 'itemType'>;
function renderScreen(itemType: ItemType = 'BOOK', options: HistoryOptions = {}) {
  hooks.stateIndex = hooks.memoIndex = hooks.effectIndex = 0;
  const screen = ConsumedHistoryContent({ itemType, ...options });
  // Native callbacks run after layout commit, before passive read effects.
  const layouts = [...hooks.layoutPending.values()];
  hooks.layoutPending.clear();
  layouts.forEach(effect => effect());
  return screen;
}
function renderGrid(itemType: ItemType = 'BOOK', options: HistoryOptions = {}) {
  const screen = renderScreen(itemType, options);
  // Inspect the real collection props while leaving native virtualization to device tests.
  const grid = React.Children.toArray(screen.props.children).find(child => React.isValidElement(child) && child.type === CollectionGrid) as ReactElement<React.ComponentProps<typeof CollectionGrid>>;
  return grid;
}
function render(itemType: ItemType = 'BOOK', options: HistoryOptions = {}) {
  const grid = renderGrid(itemType, options);
  return React.createElement('View', {}, grid.props.header,
    React.createElement('Pressable', { onPress: grid.props.onRefresh }, 'Yritä uudelleen'),
    ...grid.props.entries.map(entry => React.createElement('Pressable', { key: entry.item.id,
      onPress: () => grid.props.onOpen(entry.item) }, entry.item.title)));
}
function flushEffects() {
  const effects = [...hooks.pending.values()];
  hooks.pending.clear();
  effects.forEach(effect => effect());
}
function deferred() {
  let resolve!: (value: ConsumedItemsResult) => void;
  const promise = new Promise<ConsumedItemsResult>(done => { resolve = done; });
  return { promise, resolve };
}
function success(title: string, itemType: ItemType = 'BOOK'): ConsumedItemsResult {
  return { status: 'success', items: [{ profileId: 'fixture-profile',
    item: { id: 'fixture-item', itemType, title }, saved: false, consumed: true,
    rating: 8, updatedAt: '2026-09-23T10:00:00Z' }] };
}
async function showPersonalHistory() {
  context.loadConsumed.mockResolvedValueOnce(success('Private personal title'));
  render();
  flushEffects();
  await Promise.resolve();
  expect(text(render())).toContain('Private personal title');
}
function expectLoadingWithout(tree: ReactNode, oldText: string) {
  expect(text(tree)).not.toContain(oldText);
  expect(nodes(tree).some(node => node.type === 'ActivityIndicator')).toBe(true);
}
function enterScope(scope: string | null, name = 'Selected profile') {
  context.scopeKey = scope;
  context.profileName = name;
  // The real provider replaces this callback when its actor/Profile changes.
  context.loadConsumed = vi.fn<(itemType: ItemType | null) => Promise<ConsumedItemsResult>>()
    .mockImplementation(() => new Promise(() => {}));
}

beforeEach(() => {
  hooks.effects.forEach(effect => effect.cleanup?.());
  hooks.states = []; hooks.memos = []; hooks.effects = []; hooks.pending.clear(); hooks.layoutPending.clear();
  hooks.stateIndex = hooks.memoIndex = hooks.effectIndex = 0;
  context.scopeKey = 'test:actor:personal';
  context.profileName = 'Personal';
  context.mode = 'FOR_YOU';
  context.revision = 0;
  context.sessionId = 'test-session';
  context.deliveryId = 'history-navigation-test';
  context.recordEvent.mockReset();
  context.submitCollectionAction.mockReset();
  context.submitCollectionAction.mockResolvedValue({ status: 'success' });
  context.loadConsumed.mockReset();
  context.loadConsumed.mockImplementation(() => new Promise(() => {}));
  vi.mocked(router.push).mockClear();
});

describe('consumed history read ownership', () => {
  it.each([
    { label: 'SharedProfile', scope: 'test:actor:shared' },
    { label: 'another actor', scope: 'test:other:personal' },
    { label: 'another backend', scope: 'other:actor:personal' },
    { label: 'unavailable scope', scope: null },
  ])('hides prior rows before effects when entering $label', async ({ label, scope }) => {
    await showPersonalHistory();
    enterScope(scope, label);
    const next = render();
    expect(text(next)).toContain(label);
    expectLoadingWithout(next, 'Private personal title');
    expect(text(next)).not.toContain('Arvosana 8/10');
  });

  it('does not resurrect an old A result during a rapid A → B → A return', async () => {
    await showPersonalHistory();
    enterScope('test:actor:shared');
    render(); flushEffects();
    enterScope('test:actor:personal');
    context.loadConsumed.mockResolvedValueOnce(success('Fresh personal title'));
    expectLoadingWithout(render(), 'Private personal title');
    flushEffects();
    await Promise.resolve();
    expect(text(render())).toContain('Fresh personal title');
  });

  it('ignores a late old-scope response after the new history is ready', async () => {
    const old = deferred();
    context.loadConsumed.mockReturnValueOnce(old.promise);
    render(); flushEffects();
    enterScope('test:actor:shared');
    context.loadConsumed.mockResolvedValueOnce(success('Shared title'));
    render(); flushEffects();
    await Promise.resolve();
    expect(text(render())).toContain('Shared title');
    old.resolve(success('Late private title'));
    await Promise.resolve();
    const tree = render();
    expect(text(tree)).toContain('Shared title');
    expect(text(tree)).not.toContain('Late private title');
  });

  it('clears an old scope error immediately and retries the current scope', async () => {
    context.loadConsumed.mockResolvedValueOnce({ status: 'error', message: 'Personal read failed' });
    render(); flushEffects();
    await Promise.resolve();
    expect(text(render())).toContain('Personal read failed');
    enterScope('test:actor:shared');
    context.loadConsumed.mockResolvedValueOnce({ status: 'error', message: 'Shared read failed' });
    expectLoadingWithout(render(), 'Personal read failed');
    flushEffects();
    await Promise.resolve();
    const failed = render();
    expect(text(failed)).toContain('Shared read failed');
    context.loadConsumed.mockResolvedValueOnce(success('Recovered shared title'));
    nodes(failed).find(node => node.type === 'Pressable' && text(node).includes('Yritä uudelleen'))!.props.onPress!();
    expectLoadingWithout(render(), 'Shared read failed');
    flushEffects();
    await Promise.resolve();
    expect(text(render())).toContain('Recovered shared title');
    expect(context.loadConsumed.mock.calls).toEqual([['BOOK'], ['BOOK']]);
  });

  it('keeps BOOK/MOVIE switching and canonical item navigation working', async () => {
    await showPersonalHistory();
    context.loadConsumed.mockResolvedValueOnce(success('Watched movie', 'MOVIE'));
    expectLoadingWithout(render('MOVIE'), 'Private personal title');
    flushEffects();
    await Promise.resolve();
    const tree = render('MOVIE');
    expect(text(tree)).toContain('Katsotut');
    nodes(tree).find(node => node.type === 'Pressable' && text(node).includes('Watched movie'))!.props.onPress!();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/discovery/[itemId]',
      params: { itemId: 'fixture-item', deliveryId: 'history-navigation-test' } });
    const slate = getDeliveredSlate('history-navigation-test')!;
    expect(slate).toMatchObject({ scopeKey: context.scopeKey, sessionId: 'test-session',
      source: 'collection', predictionId: null, collectionTitle: 'Katsotut' });
    expect(slate.items.map(item => item.title)).toEqual(['Watched movie']);
    expect(context.loadConsumed.mock.calls).toEqual([['BOOK'], ['MOVIE']]);
  });
});


describe('embedded consumed history lifecycle', () => {
  const hidden: HistoryOptions = { embedded: true, active: false, requested: false };
  const preview: HistoryOptions = { embedded: true, active: false, requested: true };
  const selected: HistoryOptions = { embedded: true, active: true, requested: true };

  it('reads lazily on first reveal and keeps preview callbacks inert', async () => {
    render('BOOK', hidden); flushEffects();
    expect(context.loadConsumed).not.toHaveBeenCalled();
    context.loadConsumed.mockResolvedValueOnce(success('Canonical read title'));
    render('BOOK', preview); flushEffects();
    await Promise.resolve();
    const grid = renderGrid('BOOK', preview);
    expect(grid.props.entries.map(entry => entry.item.title)).toEqual(['Canonical read title']);
    grid.props.onOpen(grid.props.entries[0]!.item);
    grid.props.onRefresh();
    const clear = grid.props.renderActions!(grid.props.entries[0]!.item) as ReactElement<Props>;
    clear.props.onPress!();
    render('BOOK', preview); flushEffects();
    expect(context.loadConsumed.mock.calls).toEqual([['BOOK']]);
    expect(router.push).not.toHaveBeenCalled();
    expect(context.submitCollectionAction).not.toHaveBeenCalled();
    expect(context.recordEvent).not.toHaveBeenCalled();
  });

  it('retains unchanged rows and defers hidden revision/callback reloads until reveal', async () => {
    context.loadConsumed.mockResolvedValueOnce(success('Retained title'));
    render('BOOK', selected); flushEffects(); await Promise.resolve();
    expect(text(render('BOOK', selected))).toContain('Retained title');
    const originalLoader = context.loadConsumed;
    render('BOOK', hidden); flushEffects();
    context.revision++;
    const updated = deferred();
    context.loadConsumed = vi.fn().mockReturnValue(updated.promise);
    expect(text(render('BOOK', hidden))).toContain('Retained title');
    flushEffects();
    expect(context.loadConsumed).not.toHaveBeenCalled();
    expect(originalLoader).toHaveBeenCalledTimes(1);
    const refreshing = renderGrid('BOOK', selected);
    expect(refreshing.props.refreshing).toBe(true);
    expect(refreshing.props.entries[0]!.item.title).toBe('Retained title');
    refreshing.props.onOpen(refreshing.props.entries[0]!.item);
    flushEffects();
    expect(router.push).not.toHaveBeenCalled();
    expect(context.loadConsumed.mock.calls).toEqual([['BOOK']]);
    updated.resolve(success('Updated canonical title')); await Promise.resolve();
    expect(text(render('BOOK', selected))).toContain('Updated canonical title');
    render('BOOK', hidden); flushEffects();
    expect(text(render('BOOK', selected))).toContain('Updated canonical title');
    flushEffects();
    expect(context.loadConsumed).toHaveBeenCalledTimes(1);
  });

  it('revokes retained open, refresh and clear immediately when pager starts moving', async () => {
    let settled = true;
    const options = { ...selected, isActive: () => settled };
    context.loadConsumed.mockResolvedValueOnce(success('Canonical title'));
    render('BOOK', options); flushEffects(); await Promise.resolve();
    const grid = renderGrid('BOOK', options);
    const clear = grid.props.renderActions!(grid.props.entries[0]!.item) as ReactElement<Props>;
    settled = false;
    // The native callbacks can arrive before React renders the new active prop.
    grid.props.onOpen(grid.props.entries[0]!.item);
    grid.props.onRefresh();
    clear.props.onPress!();
    render('BOOK', options); flushEffects();
    expect(router.push).not.toHaveBeenCalled();
    expect(context.submitCollectionAction).not.toHaveBeenCalled();
    expect(context.loadConsumed).toHaveBeenCalledTimes(1);
    settled = true;
    render('BOOK', hidden);
    grid.props.onOpen(grid.props.entries[0]!.item);
    grid.props.onRefresh();
    clear.props.onPress!();
    expect(router.push).not.toHaveBeenCalled();
    expect(context.submitCollectionAction).not.toHaveBeenCalled();
  });

  it.each(['scope', 'session', 'domain'] as const)('revokes old callbacks before effects after %s replacement', async kind => {
    context.loadConsumed.mockResolvedValueOnce(success('Private title'));
    render('BOOK', selected); flushEffects(); await Promise.resolve();
    const old = renderGrid('BOOK', selected);
    const clear = old.props.renderActions!(old.props.entries[0]!.item) as ReactElement<Props>;
    if (kind === 'scope') enterScope('test:actor:shared');
    if (kind === 'session') context.sessionId = 'replacement-session';
    const next = renderGrid(kind === 'domain' ? 'MOVIE' : 'BOOK', hidden);
    expect(next.props.entries).toEqual([]);
    old.props.onOpen(old.props.entries[0]!.item);
    old.props.onRefresh();
    clear.props.onPress!();
    expect(router.push).not.toHaveBeenCalled();
    expect(context.submitCollectionAction).not.toHaveBeenCalled();
  });

  it.each(['BOOK', 'MOVIE'] as const)('opens %s from the canonical collection without recommendation exposure', async itemType => {
    context.deliveryId = `embedded-history-${itemType}`;
    context.loadConsumed.mockResolvedValueOnce(success('Canonical collection title', itemType));
    render(itemType, selected); flushEffects(); await Promise.resolve();
    const grid = renderGrid(itemType, selected);
    grid.props.onOpen(grid.props.entries[0]!.item);
    const slate = getDeliveredSlate(context.deliveryId)!;
    expect(slate).toMatchObject({ source: 'collection', predictionId: null,
      collectionTitle: itemType === 'BOOK' ? 'Luetut' : 'Katsotut',
      scopeKey: context.scopeKey, sessionId: context.sessionId });
    expect(slate.items.map(item => item.title)).toEqual(['Canonical collection title']);
    expect(context.loadConsumed.mock.calls).toEqual([[itemType]]);
    expect(context.recordEvent).not.toHaveBeenCalled();
    const screen = renderScreen(itemType, selected);
    expect(screen.props.edges).toEqual([]);
    expect(text(grid.props.header)).not.toContain('Personal');
    expect(nodes(grid.props.header).some(node => node.type === 'Pressable')).toBe(false);
  });

  it('does not revive pre-hide commands after showing the same unchanged read', async () => {
    context.loadConsumed.mockResolvedValueOnce(success('Canonical title'));
    render('BOOK', selected); flushEffects(); await Promise.resolve();
    const old = renderGrid('BOOK', selected);
    const oldClear = old.props.renderActions!(old.props.entries[0]!.item) as ReactElement<Props>;
    render('BOOK', hidden); flushEffects();
    const current = renderGrid('BOOK', selected); flushEffects();
    old.props.onOpen(old.props.entries[0]!.item);
    old.props.onRefresh(); oldClear.props.onPress!();
    render('BOOK', selected); flushEffects();
    expect(router.push).not.toHaveBeenCalled();
    expect(context.submitCollectionAction).not.toHaveBeenCalled();
    expect(context.loadConsumed).toHaveBeenCalledTimes(1);
    context.deliveryId = 'history-after-unchanged-return';
    current.props.onOpen(current.props.entries[0]!.item);
    expect(router.push).toHaveBeenCalledTimes(1);
    const currentClear = current.props.renderActions!(current.props.entries[0]!.item) as ReactElement<Props>;
    currentClear.props.onPress!();
    await Promise.resolve();
    expect(context.submitCollectionAction).toHaveBeenCalledWith({ kind: 'CLEAR_HISTORY', itemId: 'fixture-item' }, 'LIST_DETAIL');
  });

  it('blocks removal of retained rows until a dirty reveal read completes', async () => {
    context.loadConsumed.mockResolvedValueOnce(success('Retained title'));
    render('BOOK', selected); flushEffects(); await Promise.resolve();
    renderGrid('BOOK', selected);
    render('BOOK', hidden); flushEffects();
    context.revision++;
    const reload = deferred();
    context.loadConsumed.mockReturnValueOnce(reload.promise);
    render('BOOK', hidden); flushEffects();
    const dirty = renderGrid('BOOK', selected); flushEffects();
    expect(dirty.props.refreshing).toBe(true);
    const clear = dirty.props.renderActions!(dirty.props.entries[0]!.item) as ReactElement<Props & {
      disabled: boolean; accessibilityState: { disabled: boolean };
    }>;
    expect(clear.props.disabled).toBe(true);
    expect(clear.props.accessibilityState.disabled).toBe(true);
    clear.props.onPress!();
    expect(context.submitCollectionAction).not.toHaveBeenCalled();
    reload.resolve(success('Fresh title')); await Promise.resolve();
    const fresh = renderGrid('BOOK', selected);
    const freshClear = fresh.props.renderActions!(fresh.props.entries[0]!.item) as ReactElement<Props>;
    freshClear.props.onPress!(); await Promise.resolve();
    expect(context.submitCollectionAction).toHaveBeenCalledTimes(1);
  });

  it('revokes old-mode callbacks without inventing another canonical read', async () => {
    context.loadConsumed.mockResolvedValueOnce(success('Canonical title'));
    render('BOOK', selected); flushEffects(); await Promise.resolve();
    const old = renderGrid('BOOK', selected);
    const oldClear = old.props.renderActions!(old.props.entries[0]!.item) as ReactElement<Props>;
    context.mode = 'RISK';
    const current = renderGrid('BOOK', selected); flushEffects();
    old.props.onOpen(old.props.entries[0]!.item);
    old.props.onRefresh(); oldClear.props.onPress!();
    expect(router.push).not.toHaveBeenCalled();
    expect(context.submitCollectionAction).not.toHaveBeenCalled();
    expect(context.loadConsumed).toHaveBeenCalledTimes(1);
    context.deliveryId = 'history-new-mode';
    current.props.onOpen(current.props.entries[0]!.item);
    expect(getDeliveredSlate(context.deliveryId)?.mode).toBe('RISK');
  });

  it('reconciles an admitted clear while hidden and defers its reload until return', async () => {
    context.loadConsumed.mockResolvedValueOnce(success('Canonical title'));
    render('BOOK', selected); flushEffects(); await Promise.resolve();
    let complete!: (result: { status: 'success' }) => void;
    context.submitCollectionAction.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    const current = renderGrid('BOOK', selected);
    const clear = current.props.renderActions!(current.props.entries[0]!.item) as ReactElement<Props>;
    clear.props.onPress!();
    render('BOOK', hidden); flushEffects();
    complete({ status: 'success' }); await Promise.resolve();
    render('BOOK', hidden); flushEffects();
    expect(context.loadConsumed).toHaveBeenCalledTimes(1);
    context.loadConsumed.mockResolvedValueOnce({ status: 'success', items: [] });
    render('BOOK', selected); flushEffects(); await Promise.resolve();
    expect(context.loadConsumed).toHaveBeenCalledTimes(2);
    expect(renderGrid('BOOK', selected).props.entries).toEqual([]);
  });

  it('revokes retained commands after unmount', async () => {
    context.loadConsumed.mockResolvedValueOnce(success('Canonical title'));
    render('BOOK', selected); flushEffects(); await Promise.resolve();
    const grid = renderGrid('BOOK', selected);
    const clear = grid.props.renderActions!(grid.props.entries[0]!.item) as ReactElement<Props>;
    hooks.effects.forEach(effect => effect.cleanup?.());
    grid.props.onOpen(grid.props.entries[0]!.item);
    grid.props.onRefresh(); clear.props.onPress!();
    expect(router.push).not.toHaveBeenCalled();
    expect(context.submitCollectionAction).not.toHaveBeenCalled();
  });
});
