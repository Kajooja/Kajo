/// <reference types="node" />
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemList } from '../../domain/contracts';
import type { FeedDelivery } from './discoveryFeed';
import { getItemInteraction, type ItemInteractionMap } from './itemInteraction';
import type { ItemListsResult } from '../lists/itemListOperations';
import { ItemDetailScreen } from './ItemDetailScreen';
import { rememberDeliveredSlate } from './deliveredSlate';

const fixture = vi.hoisted(() => ({
  profile: { id: 'personal', type: 'PERSONAL', name: 'Personal', ownerUserId: 'actor' },
  scopeKey: 'test:actor:personal', actorUserId: 'actor', revision: 0,
  interactions: {} as ItemInteractionMap,
  loadForItem: vi.fn(), setRating: vi.fn(), back: vi.fn(),
  recordEvent: vi.fn(), createEventId: vi.fn(),
  appStateListeners: new Set<(state: string) => void>(),
  atomicPendingCount: 0, skipsPendingCount: 0, persistenceFailure: null as string | null,
  eventFailure: null as string | null, skipFailure: null as string | null,
  canDiscardAction: false, canDiscardSkip: false, retryPersistence: vi.fn(), retryEvents: vi.fn(), retrySkips: vi.fn(),
  discardRejectedAction: vi.fn(), discardRejectedSkip: vi.fn(),
  feedState: { delivery: null as FeedDelivery | null, source: { acceptsNewSkip: true },
    restoringPresentation: null as { item: Item; visualKey: string } | null, presentationKey: 'feed-item:page',
    canSkip: true, loading: false, message: null, exhausted: false, waitingActionId: null as string | null,
    positiveCommitted: false, canPrevious: false, navigationPending: false },
  flow: { snapshot: vi.fn(), expectPositive: vi.fn(), positiveQueued: vi.fn(), cancelPositive: vi.fn(), retry: vi.fn(), recoverRejected: vi.fn(),
    advance: vi.fn(), previous: vi.fn(), hold: vi.fn(), positiveCommitted: vi.fn() },
}));
vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const react = createRequire(require.resolve('react-test-renderer'))('react');
  return { ...react, default: react };
});
vi.mock('expo-router', () => ({ router: { back: fixture.back, replace: vi.fn() } }));
vi.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('react-native', () => ({
  Image: 'Image', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', FlatList: 'FlatList',
  useWindowDimensions: () => ({ width: 390, height: 800 }),
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
  AppState: { currentState: 'active', addEventListener: (_type: string, listener: (state: string) => void) => {
    fixture.appStateListeners.add(listener); return { remove: () => fixture.appStateListeners.delete(listener) };
  } },
  Animated: { View: 'AnimatedView', Value: class { setValue() {} stopAnimation() {} },
    timing: () => ({ start() {} }) },
  Easing: { out: (value: unknown) => value, cubic: 0 },
  StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
}));
vi.mock('../../data/SupabaseProvider', () => ({ useSupabaseConnection: () => ({ status: 'configured', client: {} }) }));
vi.mock('../profiles/ActiveProfileContext', () => ({ useActiveProfile: () => ({
  activeProfile: fixture.profile, actorUserId: fixture.actorUserId, sharedProfiles: [],
}) }));
vi.mock('./DiscoveryModeContext', () => ({ useDiscoveryMode: () => ({ mode: 'FOR_YOU' }) }));
vi.mock('./SharedEndorsementContext', () => ({ useSharedEndorsements: () => ({ status: 'ready', stateByItemId: {} }) }));
vi.mock('../messages/ProfileMessagesContext', () => ({ useProfileMessages: () => ({ send: vi.fn() }) }));
vi.mock('../lists/ItemListsContext', () => ({ useItemLists: () => ({
  scopeKey: fixture.scopeKey, revision: fixture.revision, loadForItem: fixture.loadForItem,
}) }));
vi.mock('../events/EventTrackingContext', () => ({ useEventTracking: () => ({
  status: 'ready', sessionId: 'test-session', recordEvent: fixture.recordEvent, createEventId: fixture.createEventId,
  persistenceError: fixture.eventFailure, retryPersistence: fixture.retryEvents,
}) }));
vi.mock('./ItemInteractionContext', () => ({ useItemInteractions: () => ({
  interactions: fixture.interactions, setRating: fixture.setRating, setNotInterested: vi.fn(),
  canUndo: false, undoTargetItemId: null, undo: vi.fn(), atomicPendingCount: fixture.atomicPendingCount, persistenceStatus: 'ready',
  persistenceError: fixture.atomicPendingCount ? 'Valintoja odottaa tallennusta.' : fixture.persistenceFailure,
  persistenceFailure: fixture.persistenceFailure, canDiscardAction: fixture.canDiscardAction, canDiscardUndo: false,
  retryPersistence: fixture.retryPersistence, discardRejectedAction: fixture.discardRejectedAction,
}) }));
vi.mock('./useDiscoveryFeed', () => ({ useDiscoveryFeed: () => ({
  flow: fixture.flow, state: fixture.feedState, skips: { ready: true, pendingCount: fixture.skipsPendingCount,
    message: fixture.skipFailure, retry: fixture.retrySkips,
    canDiscardAction: fixture.canDiscardSkip, discardRejected: fixture.discardRejectedSkip },
}) }));
vi.mock('./FeedItemCard', () => ({ getFeedCardHeight: (height: number | undefined) => height,
  FeedItemCard: (props: { titleAction?: React.ReactNode; children?: React.ReactNode }) =>
  React.createElement('FeedItemCard', props, props.titleAction, props.children) }));
vi.mock('./RatingControl', () => ({ RatingControl: 'RatingControl' }));
vi.mock('./InteractionPersistenceNotice', () => ({ InteractionPersistenceNotice: 'InteractionPersistenceNotice' }));
vi.mock('../lists/ListDestinationSheet', () => ({ ListDestinationSheet: 'ListDestinationSheet' }));
vi.mock('./CatalogDetailEntry', () => ({ CatalogDetailEntry: 'CatalogDetailEntry' }));
vi.mock('./ItemDescription', () => ({ ItemDescription: 'ItemDescription' }));

let root: ReactTestRenderer | undefined;
let sequence = 0;
let slateId: string;
const item: Item = { id: 'feed-item', itemType: 'MOVIE', title: 'Feed movie' };
const origin = { predictionId: 'prediction', deliveryRequestId: 'page',
  properties: { predictionSource: 'hosted' as const, deliveryTier: 'RANKED' as const } };
function host(type: string): ReactTestInstance {
  return root!.root.find(node => node.type as unknown === type);
}
function hosts(type: string): ReactTestInstance[] {
  return root!.root.findAll(node => node.type as unknown === type);
}
function star(): ReactTestInstance {
  return root!.root.find(node => node.type as unknown === 'Pressable' &&
    node.props.accessibilityHint === 'Valitse yksi tai useampi lista');
}
function list(containsItem: boolean, profileId = 'personal'): ItemList {
  return { id: 'custom', profileId, kind: 'CUSTOM', name: 'Weekend', containsItem, itemCount: 1,
    createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T00:00:00Z' };
}
function saveSlate() {
  slateId = `feed-integration-${++sequence}`;
  rememberDeliveredSlate({ id: slateId, scopeKey: fixture.scopeKey, sessionId: 'test-session',
    predictionId: 'prediction', source: 'hosted', mode: 'FOR_YOU', items: [item], origins: { [item.id]: origin } });
}
function screen() { return <ItemDetailScreen key={slateId} itemId={item.id} deliveryId={slateId} predictionSource="hosted" />; }
async function mount() { await act(async () => { root = create(screen()); }); }
async function update() { await act(async () => { root!.update(screen()); }); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  fixture.profile = { id: 'personal', type: 'PERSONAL', name: 'Personal', ownerUserId: 'actor' };
  fixture.actorUserId = 'actor'; fixture.scopeKey = 'test:actor:personal'; fixture.revision = 0;
  fixture.interactions = {};
  fixture.atomicPendingCount = 0; fixture.skipsPendingCount = 0;
  fixture.persistenceFailure = null; fixture.eventFailure = null; fixture.skipFailure = null;
  fixture.canDiscardAction = false; fixture.canDiscardSkip = false;
  fixture.discardRejectedAction.mockReturnValue('discarded-positive'); fixture.discardRejectedSkip.mockReturnValue('discarded-skip');
  fixture.flow.positiveQueued.mockReset();
  fixture.appStateListeners.clear();
  fixture.feedState = { delivery: { item, origin }, source: { acceptsNewSkip: true }, canSkip: true, loading: false,
    restoringPresentation: null, presentationKey: 'feed-item:page',
    message: null, exhausted: false, waitingActionId: null, positiveCommitted: false, canPrevious: false, navigationPending: false };
  fixture.flow.snapshot.mockImplementation(() => fixture.feedState);
  fixture.flow.advance.mockReturnValue(true); fixture.flow.previous.mockReturnValue(true);
  fixture.setRating.mockReturnValue(true);
  fixture.createEventId.mockReturnValue('rating-command');
  fixture.loadForItem.mockReset().mockResolvedValue({ status: 'success', lists: [list(false)] });
  saveSlate();
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('mounted Discovery feed controls', () => {
  it.each([0, 5, 10])('queues rating %i with the displayed origin and immediately advances without waiting for its receipt', async rating => {
    fixture.flow.positiveQueued.mockImplementation(() => {
      fixture.feedState.delivery = { item: { ...item, id: 'prepared-next' }, origin: { ...origin, deliveryRequestId: 'prepared-page' } };
      fixture.feedState.presentationKey = 'prepared-next:prepared-page';
    });
    await mount();
    expect(fixture.setRating).not.toHaveBeenCalled();
    await act(async () => { host('RatingControl').props.onRatingChange(rating); });
    expect(fixture.setRating).toHaveBeenCalledExactlyOnceWith('feed-item', rating, 'rating-command', expect.objectContaining({
      itemId: 'feed-item', predictionId: 'prediction', deliveryRequestId: 'page', originSessionId: 'test-session',
    }));
    expect(fixture.flow.expectPositive).toHaveBeenCalledExactlyOnceWith('rating-command');
    expect(fixture.flow.positiveQueued).toHaveBeenCalledExactlyOnceWith('rating-command');
    expect(fixture.flow.expectPositive.mock.invocationCallOrder[0]).toBeLessThan(fixture.setRating.mock.invocationCallOrder[0]!);
    expect(fixture.setRating.mock.invocationCallOrder[0]).toBeLessThan(fixture.flow.positiveQueued.mock.invocationCallOrder[0]!);
    expect(fixture.flow.advance).not.toHaveBeenCalled();
    expect(host('FeedItemCard').props.item.id).toBe('prepared-next');
    expect(JSON.stringify(root!.toJSON())).not.toContain('Tallenna arvio ja jatka');
    expect(JSON.stringify(root!.toJSON())).not.toContain('Tallennetaan');
    expect(fixture.flow.advance).not.toHaveBeenCalled();
    expect(host('FeedItemCard').props.entryDirection).toBe('forward');
    expect(fixture.setRating).toHaveBeenCalledTimes(1);
  });

  it('keeps the current card when durable rating admission fails', async () => {
    fixture.setRating.mockReturnValue(false);
    await mount();
    await act(async () => { host('RatingControl').props.onRatingChange(7); });
    expect(fixture.flow.cancelPositive).toHaveBeenCalledExactlyOnceWith('rating-command');
    expect(fixture.flow.positiveQueued).not.toHaveBeenCalled();
    expect(host('FeedItemCard').props.item.id).toBe(item.id);
  });

  it('allows forward and rating while earlier saves wait, but keeps List and undo behind their receipts', async () => {
    fixture.atomicPendingCount = 2; fixture.skipsPendingCount = 2; fixture.feedState.canPrevious = true;
    await mount();
    expect(host('FeedItemCard').props.disabled).toBe(false);
    expect(host('RatingControl').props.disabled).toBe(false);
    expect(star().props.disabled).toBe(true);
    expect(hosts('InteractionPersistenceNotice')).toHaveLength(0);
    expect(hosts('Modal')).toHaveLength(0);
    expect(JSON.stringify(root!.toJSON())).not.toMatch(/odottaa tallennusta|Odotetaan tallennuksen|Yritä uudelleen/);
    await act(async () => {
      expect(host('FeedItemCard').props.onPrevious()).toBe(false);
      expect(host('FeedItemCard').props.onSkip()).toBe(true);
      host('RatingControl').props.onRatingChange(5);
    });
    expect(fixture.flow.previous).not.toHaveBeenCalled();
    expect(fixture.flow.advance).toHaveBeenCalledOnce();
    expect(fixture.flow.positiveQueued).toHaveBeenCalledExactlyOnceWith('rating-command');
  });

  it('opens actual failures on demand without inserting progress or recovery rows above the card', async () => {
    fixture.persistenceFailure = 'Tallennus epäonnistui.'; fixture.eventFailure = 'Näyttötiedon yhteys katkesi.';
    fixture.skipFailure = 'Ohitus odottaa yhteyttä.'; fixture.canDiscardAction = true; fixture.canDiscardSkip = true;
    await mount();
    const before = host('FeedItemCard').props.viewportHeight;
    expect(hosts('InteractionPersistenceNotice')).toHaveLength(0);
    expect(hosts('Modal')).toHaveLength(0);
    expect(JSON.stringify(root!.toJSON())).not.toContain('Tallennus epäonnistui.');
    const recovery = hosts('Pressable').find(node => node.props.accessibilityLabel === 'Avaa tallennuksen ja yhteyden palautus')!;
    expect(recovery.props.style).toMatchObject({ position: 'absolute', width: 44, height: 44 });
    await act(async () => { recovery.props.onPress(); });
    expect(hosts('Modal')).toHaveLength(1);
    expect(JSON.stringify(root!.toJSON())).toContain('Tallennus epäonnistui.');
    expect(host('FeedItemCard').props.viewportHeight).toBe(before);
    const button = (label: string) => hosts('Pressable').find(node => node.findAll(child =>
      child.type as unknown === 'Text' && child.props.children === label).length > 0)!;
    await act(async () => { button('Yritä uudelleen').props.onPress(); });
    expect(fixture.retryPersistence).toHaveBeenCalledOnce(); expect(fixture.retryEvents).toHaveBeenCalledOnce();
    expect(fixture.retrySkips).toHaveBeenCalledOnce(); expect(fixture.flow.retry).toHaveBeenCalledOnce();
    await act(async () => { button('Hylkää valinta').props.onPress(); button('Hylkää ohitus ja päivitä').props.onPress(); button('Sulje').props.onPress(); });
    expect(fixture.discardRejectedAction).toHaveBeenCalledOnce(); expect(hosts('Modal')).toHaveLength(0);
    expect(fixture.flow.recoverRejected.mock.calls).toEqual([
      ['positive', 'discarded-positive'], ['skip', 'discarded-skip'],
    ]);
  });

  it('retains the card and history when a rejected command could not be durably discarded', async () => {
    fixture.persistenceFailure = 'Valintajonoa ei voitu päivittää.';
    fixture.canDiscardAction = true; fixture.canDiscardSkip = true;
    fixture.discardRejectedAction.mockReturnValue(null); fixture.discardRejectedSkip.mockReturnValue(null);
    await mount();
    const recovery = hosts('Pressable').find(node => node.props.accessibilityLabel === 'Avaa tallennuksen ja yhteyden palautus')!;
    await act(async () => { recovery.props.onPress(); });
    for (const label of ['Hylkää valinta', 'Hylkää ohitus ja päivitä']) {
      const button = hosts('Pressable').find(node => node.findAll(child =>
        child.type as unknown === 'Text' && child.props.children === label).length > 0)!;
      await act(async () => { button.props.onPress(); });
    }
    expect(fixture.discardRejectedAction).toHaveBeenCalledOnce(); expect(fixture.discardRejectedSkip).toHaveBeenCalledOnce();
    expect(fixture.flow.recoverRejected).not.toHaveBeenCalled();
    expect(host('FeedItemCard').props.item.id).toBe(item.id);
  });

  it('wires backward undo, blocks pending controls, and gives the card the measured viewport without duplicate chrome', async () => {
    fixture.feedState.canPrevious = true;
    await mount();
    const viewport = root!.root.find(node => node.type as unknown === 'View' && typeof node.props.onLayout === 'function');
    await act(async () => { viewport.props.onLayout({ nativeEvent: { layout: { height: 612 } } }); });
    expect(host('FeedItemCard').props.viewportHeight).toBe(612);
    expect(host('FeedItemCard').props.helpScope).toBe('actor');
    expect(host('FeedItemCard').props.entryDirection).toBeUndefined();
    expect(host('SafeAreaView').props.edges).toEqual([]);
    expect(hosts('ScrollView')).toHaveLength(0);
    expect(hosts('Pressable').some(node => node.props.accessibilityLabel === 'Kumoa')).toBe(false);
    await act(async () => { expect(host('FeedItemCard').props.onPrevious()).toBe(true); });
    expect(fixture.flow.previous).toHaveBeenCalledOnce();
    expect(host('FeedItemCard').props.entryDirection).toBe('backward');
    fixture.feedState.waitingActionId = 'pending-command';
    await update();
    expect(host('FeedItemCard').props.disabled).toBe(true);
    expect(host('RatingControl').props.disabled).toBe(true);
    expect(star().props.disabled).toBe(true);
    expect(JSON.stringify(host('FeedItemCard').props.children)).not.toContain('Odotetaan tallennuksen vahvistusta');
    await act(async () => { host('RatingControl').props.onRatingChange(5); expect(host('FeedItemCard').props.onSkip()).toBe(false); });
    expect(fixture.setRating).not.toHaveBeenCalled();
    expect(fixture.flow.advance).not.toHaveBeenCalled();
  });

  it.each(['loading', 'navigationPending'] as const)('rejects retained rating/List/advance callbacks while %s owns the current card', async flag => {
    await mount();
    const oldRating = host('RatingControl').props.onRatingChange;
    const oldStar = star().props.onPress;
    const oldAdvance = host('FeedItemCard').props.onSkip;
    fixture.feedState = { ...fixture.feedState, [flag]: true };
    await update();
    expect(host('RatingControl').props.disabled).toBe(true);
    expect(star().props.disabled).toBe(true);
    await act(async () => { oldRating(10); oldStar(); expect(oldAdvance()).toBe(false); });
    expect(fixture.setRating).not.toHaveBeenCalled();
    expect(fixture.flow.expectPositive).not.toHaveBeenCalled();
    expect(fixture.flow.advance).not.toHaveBeenCalled();
    expect(host('ListDestinationSheet').props.visible).toBe(false);
  });

  it('shows an admitted undo preview immediately with its own optimistic rating, suspends exposure and dwell, and activates the same visual card on fresh delivery', async () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const previous: Item = { id: 'previous-item', itemType: 'MOVIE', title: 'Previous movie' };
    fixture.interactions = {
      [item.id]: { ...getItemInteraction({}, item.id), rating: 9 },
      [previous.id]: { ...getItemInteraction({}, previous.id), rating: 2 },
    };
    fixture.feedState.canPrevious = true;
    fixture.flow.previous.mockImplementation(() => {
      fixture.feedState.restoringPresentation = { item: previous, visualKey: 'return-previous' };
      fixture.feedState.navigationPending = true;
      fixture.feedState.waitingActionId = 'undo-command';
      fixture.feedState.canPrevious = false;
      return true;
    });
    await mount();
    const oldRating = host('RatingControl').props.onRatingChange;
    const oldStar = star().props.onPress;
    const oldAdvance = host('FeedItemCard').props.onSkip;
    now = 3_000;
    await act(async () => { expect(host('FeedItemCard').props.onPrevious()).toBe(true); });
    const returningCard = host('FeedItemCard');
    expect(fixture.feedState.delivery?.item.id).toBe(item.id); // Canonical delivery is still B.
    expect(returningCard.props).toMatchObject({ item: previous, disabled: true, entryDirection: 'backward' });
    expect(host('RatingControl').props).toMatchObject({ rating: 2, disabled: true });
    expect(star().props.disabled).toBe(true);
    expect(fixture.loadForItem).toHaveBeenLastCalledWith(previous.id);
    expect(fixture.recordEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      eventType: 'ITEM_DWELL', itemId: item.id, predictionId: 'prediction', deliveryRequestId: 'page',
    }));
    fixture.recordEvent.mockClear();
    now = 8_000;
    await act(async () => {
      oldRating(10); oldStar(); expect(oldAdvance()).toBe(false);
      host('RatingControl').props.onRatingChange(8);
      expect(host('FeedItemCard').props.onSkip()).toBe(false);
      for (const listener of fixture.appStateListeners) listener('background');
      for (const listener of fixture.appStateListeners) listener('active');
    });
    now = 11_000;
    await act(async () => { for (const listener of fixture.appStateListeners) listener('background'); });
    expect(fixture.recordEvent).not.toHaveBeenCalled();
    expect(fixture.setRating).not.toHaveBeenCalled();
    expect(fixture.flow.advance).not.toHaveBeenCalled();
    expect(host('ListDestinationSheet').props.visible).toBe(false);
    await act(async () => { for (const listener of fixture.appStateListeners) listener('active'); });

    fixture.feedState = { ...fixture.feedState,
      delivery: { item: { ...previous }, origin: { ...origin, predictionId: 'fresh-prediction', deliveryRequestId: 'fresh-page' } },
      restoringPresentation: null, presentationKey: 'return-previous', navigationPending: false, waitingActionId: null,
    };
    await update();
    expect(host('FeedItemCard')).toBe(returningCard); // No second key change/entry.
    expect(host('FeedItemCard').props.disabled).toBe(false);
    expect(fixture.recordEvent).not.toHaveBeenCalled(); // Screen never creates a preview impression.
    now = 14_000;
    await act(async () => { for (const listener of fixture.appStateListeners) listener('background'); });
    expect(fixture.recordEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      eventType: 'ITEM_DWELL', itemId: previous.id, predictionId: 'fresh-prediction', deliveryRequestId: 'fresh-page',
      properties: expect.objectContaining({ dwellMs: 3_000 }),
    }));
    await act(async () => { host('RatingControl').props.onRatingChange(7); });
    expect(fixture.setRating).toHaveBeenCalledExactlyOnceWith(previous.id, 7, 'rating-command', expect.objectContaining({
      predictionId: 'fresh-prediction', deliveryRequestId: 'fresh-page', originSessionId: 'test-session',
    }));
  });

  it('keeps the active card when undo admission fails and blocks retained callbacks from an originless restoration', async () => {
    fixture.feedState.canPrevious = true;
    fixture.flow.previous.mockReturnValue(false);
    await mount();
    const oldRating = host('RatingControl').props.onRatingChange;
    const oldStar = star().props.onPress;
    const oldAdvance = host('FeedItemCard').props.onSkip;
    await act(async () => { expect(host('FeedItemCard').props.onPrevious()).toBe(false); });
    expect(host('FeedItemCard').props.item.id).toBe(item.id);
    expect(host('FeedItemCard').props.entryDirection).toBeUndefined();
    // The explicit preview barrier also protects callbacks before other flags update.
    fixture.feedState.restoringPresentation = { item: { ...item, id: 'previous-item' }, visualKey: 'return-previous' };
    await update();
    await act(async () => { oldRating(8); oldStar(); expect(oldAdvance()).toBe(false); });
    expect(host('RatingControl').props.disabled).toBe(true);
    expect(fixture.setRating).not.toHaveBeenCalled();
    expect(fixture.flow.advance).not.toHaveBeenCalled();
    expect(host('ListDestinationSheet').props.visible).toBe(false);
  });

  it('opens the existing List picker from an outlined star and fills only from confirmed membership', async () => {
    await mount();
    expect(star().props.accessibilityState.selected).toBe(false);
    expect(star().find(node => node.type as unknown === 'Text').props.children).toBe('☆');
    await act(async () => { star().props.onPress(); });
    expect(host('ListDestinationSheet').props.visible).toBe(true);
    expect(host('ListDestinationSheet').props.origin).toMatchObject({
      itemId: 'feed-item', predictionId: 'prediction', deliveryRequestId: 'page',
    });
    expect(star().props.accessibilityState.selected).toBe(false);
    await act(async () => { host('ListDestinationSheet').props.onClose(); });
    fixture.loadForItem.mockResolvedValue({ status: 'success', lists: [list(true)] });
    fixture.revision++;
    await update();
    expect(star().props.accessibilityState.selected).toBe(true);
    expect(star().find(node => node.type as unknown === 'Text').props.children).toBe('★');
    expect(star().find(node => node.type as unknown === 'Text').props.style.color).toBe('#ffffff');
    fixture.loadForItem.mockResolvedValue({ status: 'success', lists: [list(false)] });
    fixture.revision++;
    await update();
    expect(star().props.accessibilityState.selected).toBe(false);
  });

  it('ignores a delayed membership result and retained rating callback after the displayed card changes', async () => {
    const first = deferred<ItemListsResult>();
    fixture.loadForItem.mockImplementationOnce(() => first.promise);
    fixture.feedState.canPrevious = true;
    await mount();
    const oldRating = host('RatingControl').props.onRatingChange;
    const oldPrevious = host('FeedItemCard').props.onPrevious;
    const next: Item = { id: 'next-item', itemType: 'BOOK', title: 'Next book' };
    fixture.feedState.delivery = { item: next, origin: { ...origin, deliveryRequestId: 'next-page' } };
    fixture.feedState.presentationKey = 'next-item:next-page';
    await update();
    await act(async () => { first.resolve({ status: 'success', lists: [list(true)] }); oldRating(10); expect(oldPrevious()).toBe(false); });
    expect(host('FeedItemCard').props.item.id).toBe('next-item');
    expect(star().props.accessibilityState.selected).toBe(false);
    expect(fixture.setRating).not.toHaveBeenCalled();
    expect(fixture.flow.previous).not.toHaveBeenCalled();
  });

  it('never applies a previous account membership response to the new mounted scope', async () => {
    const previous = deferred<ItemListsResult>();
    fixture.loadForItem.mockImplementationOnce(() => previous.promise);
    await mount();
    fixture.profile = { id: 'second-personal', type: 'PERSONAL', name: 'Second', ownerUserId: 'second-actor' };
    fixture.actorUserId = 'second-actor'; fixture.scopeKey = 'test:second-actor:second-personal';
    saveSlate(); await update();
    await act(async () => { previous.resolve({ status: 'success', lists: [list(true)] }); });
    expect(host('FeedItemCard').props.helpScope).toBe('second-actor');
    expect(star().props.accessibilityState.selected).toBe(false);
  });
});
