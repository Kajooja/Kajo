import React, { type ReactElement, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import type { Item, ItemType } from '../../domain/contracts';
import type { VisiblePredictionRanking } from './usePredictionRanking';
import { getDeliveredSlate } from './deliveredSlate';
import { DiscoveryScreen } from './DiscoveryScreen';
import type { DiscoveryCollectionPagerState } from './useDiscoveryCollectionPager';

const context = vi.hoisted(() => ({
  focused: true, ranking: null as VisiblePredictionRanking | null,
  recordEvent: vi.fn(), createEventId: vi.fn(), loadMore: vi.fn(), retry: vi.fn(), refresh: vi.fn(),
  scopeKey: 'fixture:actor:profile', sessionId: 'session', mode: 'FOR_YOU', rankingEnabled: vi.fn(),
}));
const hooks = vi.hoisted(() => ({
  states: [] as unknown[], memos: [] as { deps: readonly unknown[]; value: unknown }[],
  effects: [] as { deps: readonly unknown[] | undefined; cleanup: (() => void) | undefined }[],
  pending: new Map<number, () => void>(), stateIndex: 0, memoIndex: 0, effectIndex: 0,
  changed: false,
}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const same = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) =>
    Boolean(a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index])));
  return { ...actual,
    useState: (initial: unknown) => {
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.states[index], (next: unknown) => {
        const value = typeof next === 'function' ? next(hooks.states[index]) : next;
        if (!Object.is(value, hooks.states[index])) hooks.changed = true;
        hooks.states[index] = value;
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
      return hooks.memos[index]!.value;
    },
    useCallback: (callback: unknown) => callback,
    useEffect: () => {},
    useLayoutEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
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
vi.mock('expo-router', () => ({ router: { push: vi.fn() }, useIsFocused: () => context.focused }));
vi.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
vi.mock('react-native', () => ({
  FlatList: 'FlatList', View: 'View', Text: 'Text', Pressable: 'Pressable', Image: { prefetch: vi.fn() },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
  Animated: { Value: class { setValue() {} stopAnimation() {} addListener() { return 'listener'; } removeListener() {} },
    timing: () => ({ start: (done: (result: { finished: boolean }) => void) => done({ finished: true }), stop() {} }) },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  BackHandler: { addEventListener: () => ({ remove() {} }) },
  AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {}, hairlineWidth: 0.5 },
}));
vi.mock('../lists/ItemListsContext', () => ({ useItemLists: () => ({ scopeKey: context.scopeKey }) }));
vi.mock('../lists/ConsumedHistoryScreen', () => ({ ConsumedHistoryScreen: 'ConsumedHistoryScreen' }));
vi.mock('./DiscoveryCollectionPager', () => ({ DiscoveryCollectionPager: 'DiscoveryCollectionPager' }));
vi.mock('../profiles/ActiveProfileContext', () => ({ useActiveProfile: () => ({
  activeProfile: { id: 'profile', name: 'Oma Kajo', type: 'PERSONAL', ownerUserId: 'actor' },
  actorUserId: 'actor', sharedProfiles: [],
}) }));
vi.mock('../events/EventTrackingContext', () => ({ useEventTracking: () => ({
  sessionId: context.sessionId, recordEvent: context.recordEvent, createEventId: context.createEventId,
}) }));
vi.mock('./ItemInteractionContext', () => ({ useItemInteractions: () => ({ interactions: {} }) }));
vi.mock('./SharedEndorsementContext', () => ({ useSharedEndorsements: () => ({
  status: 'ready', error: null, stateByItemId: {}, retry: vi.fn(),
}) }));
vi.mock('./DiscoveryModeContext', () => ({ useDiscoveryMode: () => ({ mode: context.mode }) }));
vi.mock('./usePredictionRanking', () => ({ usePredictionRanking: (...args: unknown[]) => {
  context.rankingEnabled(args[3]); return context.ranking;
} }));
vi.mock('./DiscoveryItemCard', () => ({ DiscoveryItemCard: 'DiscoveryItemCard' }));
vi.mock('./DiscoveryCollectionHeader', () => ({ DiscoveryCollectionHeader: 'DiscoveryCollectionHeader' }));
vi.mock('./InteractionPersistenceNotice', () => ({ InteractionPersistenceNotice: 'InteractionPersistenceNotice' }));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());

type Gesture = { dx: number; dy: number };
type Props = { children?: ReactNode; discovery?: ReactNode; history?: ReactNode; style?: unknown; onPress?: () => void; accessibilityLabel?: string;
  onLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void;
  onStartShouldSetPanResponderCapture?: () => boolean;
  onMoveShouldSetPanResponderCapture?: (event: unknown, gesture: Gesture) => boolean;
  onPanResponderRelease?: (event: unknown, gesture: Gesture) => void };
type ListProps = Props & { data: readonly Item[]; contentContainerStyle: unknown[]; ListFooterComponent: ReactNode;
  onRefresh: () => void; onEndReached: () => void; onContentSizeChange: (width: number, height: number) => void;
  onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
  onViewableItemsChanged: (event: { viewableItems: { item: Item; isViewable: boolean; index: number; key: string }[] }) => void;
  renderItem: (input: { item: Item; index: number }) => ReactElement<{ onOpen: () => void }> };
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(tree).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...nodes(child.props.children), ...nodes(child.props.discovery), ...nodes(child.props.history)] : []);
}
function text(tree: ReactNode): string {
  return React.Children.toArray(tree).map(child => React.isValidElement<Props>(child)
    ? text(child.props.children) : String(child)).join(' ');
}
function item(id: string, itemType: ItemType = 'BOOK'): Item { return { id, itemType, title: id }; }
function ranking(change: Partial<VisiblePredictionRanking> = {}): VisiblePredictionRanking {
  return { viewId: 'stable-view', items: [item('first'), item('second')], predictionId: 'run1',
    predictionIds: { first: 'run1', second: 'run1' }, source: 'hosted', status: 'ready', message: null,
    availability: 'ITEMS', continuationState: 'MORE', hasNextPage: true, loadingNextPage: false,
    nextPageError: null, recovery: null, retrying: false,
    retry: context.retry, refresh: context.refresh, loadMore: context.loadMore, ...change };
}
function render(itemType: ItemType = 'BOOK') {
  let tree: ReactNode;
  let attempts = 0;
  do {
    hooks.changed = false;
    hooks.stateIndex = hooks.memoIndex = hooks.effectIndex = 0;
    tree = DiscoveryScreen({ itemType, title: itemType === 'BOOK' ? 'Kirjat' : 'Elokuvat' });
    const pending = [...hooks.pending.values()]; hooks.pending.clear(); pending.forEach(effect => effect());
  } while (hooks.changed && ++attempts < 10);
  const list = nodes(tree).find(node => node.type === 'FlatList')! as ReactElement<ListProps>;
  return { tree, list };
}
function collectionPager(tree: ReactNode) {
  return (nodes(tree).find(node => node.type === 'DiscoveryCollectionPager')!.props as unknown as { pager: DiscoveryCollectionPagerState }).pager;
}
function historyProps(tree: ReactNode) {
  return nodes(tree).find(node => node.type === 'ConsumedHistoryScreen')!.props as unknown as {
    itemType: ItemType; active: boolean; requested: boolean; embedded: boolean; isActive: () => boolean;
  };
}

beforeEach(() => {
  hooks.effects.forEach(effect => effect.cleanup?.());
  hooks.states = []; hooks.memos = []; hooks.effects = []; hooks.pending.clear();
  context.focused = true; vi.clearAllMocks();
  context.scopeKey = 'fixture:actor:profile'; context.sessionId = 'session'; context.mode = 'FOR_YOU';
  context.createEventId.mockReturnValueOnce('screen-navigation-fixture');
  context.ranking = ranking();
});

describe('Discovery grid integration', () => {
  it.each(['BOOK', 'MOVIE'] as const)('appends through top pull, end reach and accessible button without refreshing %s', itemType => {
    context.ranking = ranking({ items: [item('first', itemType), item('second', itemType)] });
    const first = render(itemType);
    first.list.props.onRefresh(); first.list.props.onEndReached();
    nodes(first.list.props.ListFooterComponent).find(node => node.props.accessibilityLabel === 'Näytä lisää')!.props.onPress!();
    expect(context.loadMore).toHaveBeenCalledTimes(3);
    expect(context.refresh).not.toHaveBeenCalled();
    const prefix = first.list.props.data;
    context.ranking = ranking({ items: [...prefix, item('third', itemType)],
      predictionIds: { first: 'run1', second: 'run1', third: 'run2' } });
    const appended = render(itemType);
    expect(appended.list.key).toBe(first.list.key);
    expect(appended.list.props.data.slice(0, prefix.length)).toEqual(prefix);
    expect(appended.list.props.data).toHaveLength(3);
    expect(context.refresh).not.toHaveBeenCalled();
  });

  it('does not turn native end notifications into automatic error retries; top pull retries the exact reader', () => {
    context.ranking = ranking({ nextPageError: 'offline', recovery: 'retry' });
    const failed = render();
    for (let n = 0; n < 10; n++) failed.list.props.onEndReached();
    expect(context.retry).not.toHaveBeenCalled();
    failed.list.props.onRefresh();
    expect(context.retry).toHaveBeenCalledTimes(1);
    expect(context.loadMore).not.toHaveBeenCalled();
    expect(context.refresh).not.toHaveBeenCalled();
  });

  it('captures a measured downward bottom pull through the real gesture hook and coalesces the footer button', () => {
    const { tree, list } = render();
    const viewport = nodes(tree).find(node => node.props.onLayout)!;
    viewport.props.onLayout!({ nativeEvent: { layout: { height: 600 } } });
    list.props.onContentSizeChange(320, 2000);
    list.props.onScroll({ nativeEvent: { contentOffset: { y: 1400 } } });
    expect(viewport.props.onStartShouldSetPanResponderCapture!()).toBe(false);
    expect(viewport.props.onMoveShouldSetPanResponderCapture!({}, { dx: 2, dy: 20 })).toBe(true);
    viewport.props.onPanResponderRelease!({}, { dx: 3, dy: 80 });
    nodes(list.props.ListFooterComponent).find(node => node.props.accessibilityLabel === 'Näytä lisää')!.props.onPress!();
    expect(context.loadMore).toHaveBeenCalledTimes(1);
    expect(context.refresh).not.toHaveBeenCalled();
  });

  it('rejects old native refresh, gesture and viewability callbacks after the reader view changes', () => {
    const old = render();
    const oldButton = nodes(old.list.props.ListFooterComponent).find(node => node.props.accessibilityLabel === 'Näytä lisää')!;
    context.ranking = ranking({ viewId: 'new-view', items: [item('replacement')], predictionId: 'new-run',
      predictionIds: { replacement: 'new-run' } });
    render(); context.recordEvent.mockClear();
    old.list.props.onRefresh(); old.list.props.onEndReached(); oldButton.props.onPress!();
    old.list.props.onViewableItemsChanged({ viewableItems: [{ item: item('first'), isViewable: true, index: 0, key: 'first' }] });
    expect(context.loadMore).not.toHaveBeenCalled();
    expect(context.recordEvent).not.toHaveBeenCalled();
    expect(context.refresh).not.toHaveBeenCalled();
  });

  it('preserves each appended Item origin for impressions, opening and the detail slate', () => {
    render();
    context.ranking = ranking({ items: [item('first'), item('second'), item('third')],
      predictionIds: { first: 'run1', second: 'run1', third: 'run2' } });
    const { list } = render();
    const third = list.props.data[2]!;
    list.props.onViewableItemsChanged({ viewableItems: [{ item: third, isViewable: true, index: 2, key: third.id }] });
    expect(context.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'ITEM_IMPRESSION', itemId: 'third', predictionId: 'run2',
    }));
    list.props.renderItem({ item: third, index: 2 }).props.onOpen();
    expect(context.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'ITEM_OPENED', itemId: 'third', predictionId: 'run2',
    }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/discovery/[itemId]',
      params: { itemId: 'third', deliveryId: 'screen-navigation-fixture', predictionId: 'run2', predictionSource: 'hosted' } });
    expect(getDeliveredSlate('screen-navigation-fixture')!.origins.third!.predictionId).toBe('run2');
  });

  it('uses shell-owned safe areas without another bottom inset or grid spacer', () => {
    const { tree, list } = render();
    expect(nodes(tree).some(node => node.type === 'SafeAreaView')).toBe(false);
    expect(Object.assign({}, ...list.props.contentContainerStyle.filter(Boolean))).toMatchObject({ paddingBottom: 0 });
  });

  it('distinguishes final catalog proof, reader limit and a legacy bounded window', () => {
    context.ranking = ranking({ continuationState: 'CATALOG_EXHAUSTED', hasNextPage: false });
    expect(text(render().list.props.ListFooterComponent)).toContain('Kaikki tähän hakuun sopivat kirjat on näytetty.');
    context.ranking = ranking({ continuationState: 'READER_LIMIT', hasNextPage: false });
    const limited = render();
    expect(text(limited.list.props.ListFooterComponent)).toContain('selausraja');
    expect(text(limited.list.props.ListFooterComponent)).not.toContain('Kaikki tähän hakuun sopivat');
    nodes(limited.list.props.ListFooterComponent).find(node => text(node).includes('Aloita uusi haku') && node.type === 'Pressable')!.props.onPress!();
    expect(context.refresh).toHaveBeenCalledTimes(1);
    context.ranking = ranking({ continuationState: null, hasNextPage: false });
    expect(text(render().list.props.ListFooterComponent)).not.toContain('Kaikki tähän hakuun sopivat');
  });

  it.each(['BOOK', 'MOVIE'] as const)('retains %s grids but permits evidence and actions only in the current settled activation', itemType => {
    context.createEventId.mockReset().mockReturnValue(`page-navigation-${itemType}`);
    context.ranking = ranking({ items: [item('first', itemType), item('second', itemType)] });
    const first = render(itemType);
    const firstPager = collectionPager(first.tree);
    firstPager.onLayout({ nativeEvent: { layout: { width: 320 } } } as never);
    const oldOpen = first.list.props.renderItem({ item: first.list.props.data[0]!, index: 0 }).props.onOpen;
    const visible = { viewableItems: [{ item: first.list.props.data[0]!, isViewable: true, index: 0, key: 'first' }] };
    firstPager.select('history');
    // Native callbacks retained before React commits are already revoked.
    oldOpen(); first.list.props.onRefresh(); first.list.props.onViewableItemsChanged(visible);
    expect(context.recordEvent).not.toHaveBeenCalled(); expect(context.loadMore).not.toHaveBeenCalled();
    const history = render(itemType);
    expect(context.rankingEnabled).toHaveBeenLastCalledWith(false);
    expect(historyProps(history.tree)).toMatchObject({ itemType, embedded: true, active: true, requested: true });
    expect(history.list.key).toBe(first.list.key);
    expect(history.list.props.data).toEqual(first.list.props.data);
    const oldHistory = historyProps(history.tree);
    collectionPager(history.tree).select('discovery');
    const returned = render(itemType);
    expect(context.rankingEnabled).toHaveBeenLastCalledWith(true);
    expect(oldHistory.isActive()).toBe(false);
    oldOpen(); first.list.props.onRefresh(); first.list.props.onViewableItemsChanged(visible);
    expect(context.recordEvent).not.toHaveBeenCalled(); expect(context.loadMore).not.toHaveBeenCalled();
    returned.list.props.onViewableItemsChanged(visible);
    expect(context.recordEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ eventType: 'ITEM_IMPRESSION', itemId: 'first' }));
    returned.list.props.renderItem({ item: returned.list.props.data[0]!, index: 0 }).props.onOpen();
    expect(context.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ITEM_OPENED', itemId: 'first' }));
  });

  it('keeps the selected page on Item blur/return and returns fresh Find on hard scope replacement', () => {
    let screen = render(); collectionPager(screen.tree).onLayout({ nativeEvent: { layout: { width: 320 } } } as never);
    collectionPager(screen.tree).select('history'); screen = render();
    context.focused = false; screen = render(); expect(collectionPager(screen.tree).selected).toBe('history');
    context.focused = true; screen = render(); expect(historyProps(screen.tree).active).toBe(true);
    const oldHistory = historyProps(screen.tree);
    context.scopeKey = 'fixture:other-actor:other-profile'; screen = render();
    expect(collectionPager(screen.tree).selected).toBe('discovery'); expect(oldHistory.isActive()).toBe(false);
    collectionPager(screen.tree).select('history'); render();
    context.sessionId = 'new-session'; screen = render(); expect(collectionPager(screen.tree).selected).toBe('discovery');
    collectionPager(screen.tree).select('history'); render();
    context.mode = 'RISK'; screen = render(); expect(collectionPager(screen.tree).selected).toBe('discovery');
    collectionPager(screen.tree).select('history'); render();
    screen = render('MOVIE'); expect(collectionPager(screen.tree).selected).toBe('discovery');
  });
});
