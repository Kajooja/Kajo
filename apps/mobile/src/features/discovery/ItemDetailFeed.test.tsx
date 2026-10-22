/// <reference types="node" />
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemList } from '../../domain/contracts';
import type { FeedDelivery } from './discoveryFeed';
import type { ItemInteractionMap } from './itemInteraction';
import type { ItemListsResult } from '../lists/itemListOperations';
import { ItemDetailScreen } from './ItemDetailScreen';
import { rememberDeliveredSlate } from './deliveredSlate';

const fixture = vi.hoisted(() => ({
  profile: { id: 'personal', type: 'PERSONAL', name: 'Personal', ownerUserId: 'actor' },
  scopeKey: 'test:actor:personal', actorUserId: 'actor', revision: 0,
  interactions: {} as ItemInteractionMap,
  loadForItem: vi.fn(), setRating: vi.fn(), back: vi.fn(),
  recordEvent: vi.fn(), createEventId: vi.fn(),
  feedState: { delivery: null as FeedDelivery | null, source: { acceptsNewSkip: true },
    loading: false, message: null, exhausted: false, waitingActionId: null as string | null,
    positiveCommitted: false, canPrevious: false, navigationPending: false },
  flow: { snapshot: vi.fn(), expectPositive: vi.fn(), cancelPositive: vi.fn(),
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
  Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', FlatList: 'FlatList',
  useWindowDimensions: () => ({ width: 390, height: 800 }),
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
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
}) }));
vi.mock('./ItemInteractionContext', () => ({ useItemInteractions: () => ({
  interactions: fixture.interactions, setRating: fixture.setRating, setNotInterested: vi.fn(),
  canUndo: false, undoTargetItemId: null, undo: vi.fn(), atomicPendingCount: 0, persistenceStatus: 'ready',
}) }));
vi.mock('./useDiscoveryFeed', () => ({ useDiscoveryFeed: () => ({
  flow: fixture.flow, state: fixture.feedState, skips: { ready: true, pendingCount: 0, message: null },
}) }));
vi.mock('./FeedItemCard', () => ({ FeedItemCard: (props: { titleAction?: React.ReactNode; children?: React.ReactNode }) =>
  React.createElement('FeedItemCard', props, props.titleAction, props.children) }));
vi.mock('./RatingControl', () => ({ RatingControl: 'RatingControl' }));
vi.mock('./InteractionPersistenceNotice', () => ({ InteractionPersistenceNotice: () => null }));
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
  fixture.feedState = { delivery: { item, origin }, source: { acceptsNewSkip: true }, loading: false,
    message: null, exhausted: false, waitingActionId: null, positiveCommitted: false, canPrevious: false, navigationPending: false };
  fixture.flow.snapshot.mockImplementation(() => fixture.feedState);
  fixture.flow.advance.mockReturnValue(true); fixture.flow.previous.mockReturnValue(true);
  fixture.setRating.mockReturnValue(true);
  fixture.createEventId.mockReturnValue('rating-command');
  fixture.loadForItem.mockReset().mockResolvedValue({ status: 'success', lists: [list(false)] });
  saveSlate();
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; vi.unstubAllGlobals(); });

describe('mounted Discovery feed controls', () => {
  it.each([0, 5, 10])('commits rating %i with the displayed origin and prepares automatic forward motion after acknowledgement', async rating => {
    await mount();
    expect(fixture.setRating).not.toHaveBeenCalled();
    await act(async () => { host('RatingControl').props.onRatingChange(rating); });
    expect(fixture.setRating).toHaveBeenCalledExactlyOnceWith('feed-item', rating, 'rating-command', expect.objectContaining({
      itemId: 'feed-item', predictionId: 'prediction', deliveryRequestId: 'page', originSessionId: 'test-session',
    }));
    expect(fixture.flow.expectPositive).toHaveBeenCalledExactlyOnceWith('rating-command');
    expect(fixture.flow.advance).not.toHaveBeenCalled();
    expect(host('FeedItemCard').props.item.id).toBe('feed-item');
    expect(JSON.stringify(root!.toJSON())).not.toContain('Tallenna arvio ja jatka');
    fixture.feedState.delivery = { item: { ...item, id: 'fresh-after-rating' }, origin: { ...origin, deliveryRequestId: 'fresh-page' } };
    await update();
    expect(host('FeedItemCard').props.item.id).toBe('fresh-after-rating');
    expect(fixture.flow.advance).not.toHaveBeenCalled();
    expect(host('FeedItemCard').props.entryDirection).toBe('forward');
    expect(fixture.setRating).toHaveBeenCalledTimes(1);
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
