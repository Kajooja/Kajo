import React, { type ReactElement, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import type { Item, ItemType } from '../../domain/contracts';
import type { VisiblePredictionRanking } from './usePredictionRanking';
import { getDeliveredSlate } from './deliveredSlate';
import { DiscoveryScreen } from './DiscoveryScreen';

const context = vi.hoisted(() => ({
  focused: true, ranking: null as VisiblePredictionRanking | null,
  recordEvent: vi.fn(), createEventId: vi.fn(), loadMore: vi.fn(), retry: vi.fn(), refresh: vi.fn(),
}));
const hooks = vi.hoisted(() => ({
  states: [] as unknown[], memos: [] as { deps: readonly unknown[]; value: unknown }[],
  effects: [] as { deps: readonly unknown[] | undefined; cleanup: (() => void) | undefined }[],
  pending: new Map<number, () => void>(), stateIndex: 0, memoIndex: 0, effectIndex: 0,
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
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {}, hairlineWidth: 0.5 },
}));
vi.mock('../lists/ItemListsContext', () => ({ useItemLists: () => ({ scopeKey: 'fixture:actor:profile' }) }));
vi.mock('../profiles/ActiveProfileContext', () => ({ useActiveProfile: () => ({
  activeProfile: { id: 'profile', name: 'Oma Kajo', type: 'PERSONAL', ownerUserId: 'actor' },
  actorUserId: 'actor', sharedProfiles: [],
}) }));
vi.mock('../events/EventTrackingContext', () => ({ useEventTracking: () => ({
  sessionId: 'session', recordEvent: context.recordEvent, createEventId: context.createEventId,
}) }));
vi.mock('./ItemInteractionContext', () => ({ useItemInteractions: () => ({ interactions: {} }) }));
vi.mock('./SharedEndorsementContext', () => ({ useSharedEndorsements: () => ({
  status: 'ready', error: null, stateByItemId: {}, retry: vi.fn(),
}) }));
vi.mock('./DiscoveryModeContext', () => ({ useDiscoveryMode: () => ({ mode: 'FOR_YOU' }) }));
vi.mock('./usePredictionRanking', () => ({ usePredictionRanking: () => context.ranking }));
vi.mock('./DiscoveryItemCard', () => ({ DiscoveryItemCard: 'DiscoveryItemCard' }));
vi.mock('./DiscoveryCollectionHeader', () => ({ DiscoveryCollectionHeader: 'DiscoveryCollectionHeader' }));
vi.mock('./InteractionPersistenceNotice', () => ({ InteractionPersistenceNotice: 'InteractionPersistenceNotice' }));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());

type Gesture = { dx: number; dy: number };
type Props = { children?: ReactNode; style?: unknown; onPress?: () => void; accessibilityLabel?: string;
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
    ? [child, ...nodes(child.props.children)] : []);
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
  hooks.stateIndex = hooks.memoIndex = hooks.effectIndex = 0;
  const tree = DiscoveryScreen({ itemType, title: itemType === 'BOOK' ? 'Kirjat' : 'Elokuvat' });
  const pending = [...hooks.pending.values()]; hooks.pending.clear(); pending.forEach(effect => effect());
  const list = nodes(tree).find(node => node.type === 'FlatList')! as ReactElement<ListProps>;
  return { tree, list };
}

beforeEach(() => {
  hooks.effects.forEach(effect => effect.cleanup?.());
  hooks.states = []; hooks.memos = []; hooks.effects = []; hooks.pending.clear();
  context.focused = true; vi.clearAllMocks();
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
});
