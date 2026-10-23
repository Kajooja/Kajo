/// <reference types="node" />
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiscoveryFeed } from './useDiscoveryFeed';
import type { createDiscoveryFeed, DiscoveryFeedSnapshot, FeedDelivery } from './discoveryFeed';
import type { KajoSkipReceipt } from '../events/contextualSkipOperations';
import type { ProfileActionReceipt } from '../events/collectionActions';

type FeedOptions = Parameters<typeof createDiscoveryFeed>[0];
const fixture = vi.hoisted(() => ({
  sequence: 1000,
  options: null as FeedOptions | null,
  state: null as DiscoveryFeedSnapshot | null,
  skipListener: null as ((receipt: KajoSkipReceipt) => void) | null,
  actionListener: null as ((receipt: ProfileActionReceipt) => void) | null,
  exposureListener: null as (() => void) | null,
  createController: vi.fn(), receiveAction: vi.fn(), prefetch: vi.fn(), rpc: vi.fn(),
  unsubscribeSkip: vi.fn(), unsubscribeAction: vi.fn(), unsubscribeExposure: vi.fn(),
  connection: { status: 'configured', client: {}, config: { url: 'https://feed.fixture.invalid' } },
  profiles: { actorUserId: 'ab157000-0000-4000-8000-000000000001',
    activeProfile: { id: 'ab157000-0000-4000-8000-000000000002' } },
  tracking: { sessionId: 'ab157000-0000-4000-8000-000000000003',
    recordImpression: vi.fn(), subscribeToAcknowledgements: vi.fn() },
  actions: { persistenceStatus: 'ready', atomicPendingCount: 0, canDiscardAction: false,
    undo: vi.fn(), subscribeToCommittedActions: vi.fn() },
  skips: { ready: true, pendingCount: 0, submit: vi.fn(), subscribe: vi.fn() },
  flow: { start: vi.fn(), stop: vi.fn(), snapshot: vi.fn(), displayed: vi.fn(), warm: vi.fn(),
    hasPendingAction: vi.fn(), positiveQueued: vi.fn(), acknowledged: vi.fn(), recoveredAction: vi.fn(),
    exposureAcknowledged: vi.fn(), recoverRejected: vi.fn() },
}));

vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const react = createRequire(require.resolve('react-test-renderer'))('react');
  return { ...react, default: react };
});
vi.mock('react-native', () => ({ Image: { prefetch: fixture.prefetch } }));
vi.mock('../../data/SupabaseProvider', () => ({ useSupabaseConnection: () => fixture.connection }));
vi.mock('../profiles/ActiveProfileContext', () => ({ useActiveProfile: () => fixture.profiles }));
vi.mock('../events/EventTrackingContext', () => ({ useEventTracking: () => fixture.tracking }));
vi.mock('../events/DiscoverySkipContext', () => ({ useDiscoverySkip: () => fixture.skips }));
vi.mock('./ItemInteractionContext', () => ({ useItemInteractions: () => fixture.actions }));
vi.mock('./discoveryFeed', () => ({ createDiscoveryFeed: fixture.createController, receiveDiscoveryFeedAction: fixture.receiveAction }));
vi.mock('../events/eventTracking', () => ({
  createUuidV7: () => `ab157000-0000-4000-8000-${String(fixture.sequence++).padStart(12, '0')}`,
}));
vi.mock('../events/contextualSkipOperations', async () => ({
  ...await vi.importActual<typeof import('../events/contextualSkipOperations')>('../events/contextualSkipOperations'),
  createContextualSkipRpc: () => fixture.rpc,
}));

const id = (value: number) => `ab157000-0000-4000-8000-${String(value).padStart(12, '0')}`;
function delivery(value: number): FeedDelivery {
  return { item: { id: id(value), itemType: 'MOVIE', title: `Item ${value}`, imageUrl: `https://images.fixture.invalid/${value}.jpg` },
    origin: { predictionId: id(100 + value), deliveryRequestId: id(200 + value),
      properties: { predictionSource: 'hosted', deliveryTier: 'RANKED' } } };
}
const initial = delivery(4);
function snapshot(active = initial, upcoming: readonly FeedDelivery[] = []): DiscoveryFeedSnapshot {
  return { delivery: active, upcoming, source: null, presentationKey: `${active.item.id}:${active.origin.deliveryRequestId}`,
    restoringPresentation: null, canSkip: true, loading: false, message: null, exhausted: false,
    waitingActionId: null, recovery: 'retry', positiveCommitted: false, canPrevious: false,
    navigationPending: false, canCancelPrevious: false, refilling: false, refillError: null };
}
function receipt(actionId: string, itemId: string, semantic: KajoSkipReceipt['semantic'] = 'CONTEXTUAL_SKIP'): KajoSkipReceipt {
  return { version: 'kajo-contextual-skip-v1', actionId, actorUserId: fixture.profiles.actorUserId,
    profileId: fixture.profiles.activeProfile.id, itemId, acceptedAt: '1792144800000100',
    policyVersion: 'contextual-skip-cooldown-v1', semantic,
    reversesActionId: semantic === 'WITHDRAW_CONTEXTUAL_SKIP' ? id(70) : null, evidence: 'CANONICAL_DISCOVERY_EVENT' };
}
let renderer: ReactTestRenderer | null = null;
let observed: ReturnType<typeof useDiscoveryFeed>;
function Probe() {
  const state = useDiscoveryFeed(initial, 'FOR_YOU');
  React.useLayoutEffect(() => { observed = state; }, [state]);
  return null;
}
async function mount() { await act(async () => { renderer = create(<Probe />); }); }
async function publish(state: DiscoveryFeedSnapshot) {
  await act(async () => { fixture.state = state; fixture.options!.onChange(state); });
}
async function unmount() { await act(async () => { renderer?.unmount(); renderer = null; }); }

beforeEach(() => {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  fixture.sequence = 1000; fixture.options = null; fixture.state = snapshot();
  fixture.skipListener = null; fixture.actionListener = null; fixture.exposureListener = null;
  fixture.skips.ready = true; fixture.skips.pendingCount = 0;
  fixture.actions.persistenceStatus = 'ready'; fixture.actions.atomicPendingCount = 0; fixture.actions.canDiscardAction = false;
  fixture.prefetch.mockReset().mockResolvedValue(true);
  fixture.tracking.recordImpression.mockReturnValue(id(90));
  fixture.flow.hasPendingAction.mockReset().mockReturnValue(false);
  fixture.flow.snapshot.mockImplementation(() => fixture.state);
  fixture.flow.start.mockImplementation(() => fixture.options!.onChange(fixture.state!));
  fixture.createController.mockImplementation((options: FeedOptions) => { fixture.options = options; return fixture.flow; });
  fixture.skips.subscribe.mockImplementation((listener: (value: KajoSkipReceipt) => void) => {
    fixture.skipListener = listener; return fixture.unsubscribeSkip;
  });
  fixture.actions.subscribeToCommittedActions.mockImplementation((listener: (value: ProfileActionReceipt) => void) => {
    fixture.actionListener = listener; return fixture.unsubscribeAction;
  });
  fixture.tracking.subscribeToAcknowledgements.mockImplementation((listener: () => void) => {
    fixture.exposureListener = listener; return fixture.unsubscribeExposure;
  });
});
afterEach(async () => { await unmount(); vi.unstubAllGlobals(); });

describe('mounted Discovery feed delivery lifecycle', () => {
  it('does not expose or warm an undo visual before its fresh same-Item delivery activates', async () => {
    const successor = delivery(10);
    fixture.state = snapshot(successor);
    await mount();
    fixture.flow.displayed.mockClear(); fixture.flow.warm.mockClear();
    const visualKey = `${initial.item.id}:${initial.origin.deliveryRequestId}`;
    await publish({ ...snapshot(successor), navigationPending: true,
      restoringPresentation: { item: initial.item, visualKey } });
    expect(fixture.flow.displayed).not.toHaveBeenCalled();
    expect(fixture.flow.warm).not.toHaveBeenCalled();
    expect(fixture.tracking.recordImpression).not.toHaveBeenCalled();
    const restored = { ...initial, origin: { ...initial.origin, deliveryRequestId: id(300), predictionId: id(301) } };
    await publish({ ...snapshot(restored), presentationKey: visualKey });
    expect(fixture.flow.displayed).toHaveBeenCalledExactlyOnceWith(restored.item.id, id(300));
    expect(fixture.flow.warm).toHaveBeenCalledOnce();
  });

  it('exposes and warms each actual new delivery while older skips and ratings remain pending, never its five previews', async () => {
    fixture.skips.pendingCount = 2; fixture.actions.atomicPendingCount = 3;
    const previews = [10, 11, 12, 13, 14].map(delivery);
    fixture.state = snapshot(initial, previews);
    await mount();
    expect(fixture.flow.displayed).toHaveBeenCalledExactlyOnceWith(initial.item.id, initial.origin.deliveryRequestId);
    expect(fixture.flow.warm).toHaveBeenCalledOnce();
    const active = previews[0]!;
    await publish(snapshot(active, [...previews.slice(1), delivery(15)]));
    expect(fixture.flow.displayed.mock.calls).toEqual([
      [initial.item.id, initial.origin.deliveryRequestId], [active.item.id, active.origin.deliveryRequestId],
    ]);
    expect(fixture.flow.warm).toHaveBeenCalledTimes(2);
    expect(fixture.createController).toHaveBeenCalledOnce();
    expect(observed.state?.delivery).toBe(active);
    expect(fixture.tracking.recordImpression).not.toHaveBeenCalled();
    expect(fixture.options!.recordImpression(active)).toBe(id(90));
    expect(fixture.tracking.recordImpression).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      eventType: 'ITEM_IMPRESSION', itemId: active.item.id, predictionId: active.origin.predictionId,
      deliveryRequestId: active.origin.deliveryRequestId, originSessionId: fixture.tracking.sessionId,
      discoveryMode: 'FOR_YOU', properties: { source: 'DISCOVERY_FEED', ...active.origin.properties },
    }));
  });

  it.each(['CONTEXTUAL_SKIP', 'WITHDRAW_CONTEXTUAL_SKIP'] as const)(
    'routes a late owned %s receipt by pending identity after the visible card has changed', async semantic => {
      fixture.state = snapshot(delivery(10));
      fixture.flow.hasPendingAction.mockImplementation((actionId: string) => actionId === id(80));
      await mount();
      expect(observed.state?.waitingActionId).toBeNull();
      await act(async () => { fixture.skipListener!(receipt(id(80), initial.item.id, semantic)); });
      expect(fixture.flow.hasPendingAction).toHaveBeenCalledExactlyOnceWith(id(80));
      expect(fixture.flow.acknowledged).toHaveBeenCalledExactlyOnceWith(id(80));
      expect(fixture.flow.recoveredAction).not.toHaveBeenCalled();
      await act(async () => { fixture.skipListener!(receipt(id(81), id(99))); });
      expect(fixture.flow.recoveredAction).toHaveBeenCalledExactlyOnceWith(id(99));
      expect(fixture.flow.acknowledged).toHaveBeenCalledOnce();
    },
  );

  it('acknowledges the blocking skip withdrawal even though it is not in the background pending map', async () => {
    fixture.state = { ...snapshot(delivery(10)), waitingActionId: id(82), navigationPending: true };
    await mount();
    expect(fixture.flow.hasPendingAction(id(82))).toBe(false);
    await act(async () => { fixture.skipListener!(receipt(id(82), initial.item.id, 'WITHDRAW_CONTEXTUAL_SKIP')); });
    expect(fixture.flow.acknowledged).toHaveBeenCalledExactlyOnceWith(id(82));
    expect(fixture.flow.recoveredAction).not.toHaveBeenCalled();
    await act(async () => { fixture.skipListener!(receipt(id(83), id(99), 'WITHDRAW_CONTEXTUAL_SKIP')); });
    expect(fixture.flow.acknowledged).toHaveBeenCalledOnce();
    expect(fixture.flow.recoveredAction).toHaveBeenCalledExactlyOnceWith(id(99));
  });

  it('creates five-successor roots and explicit small/wide restoration roots with distinct immutable identities', async () => {
    await mount();
    const first = fixture.options!.createRequest(null);
    const refill = fixture.options!.createRequest(id(90), 1);
    const batch = fixture.options!.createRequest(id(91), 5);
    const probe = fixture.options!.createRestoreRequest(id(92), 5);
    const restoration = fixture.options!.createRestoreRequest(id(93), 50);
    expect([first.limit, refill.limit, batch.limit, probe.limit, restoration.limit]).toEqual([5, 1, 5, 5, 50]);
    expect([first.replacesChainId, refill.replacesChainId, batch.replacesChainId, probe.replacesChainId, restoration.replacesChainId])
      .toEqual([null, id(90), id(91), id(92), id(93)]);
    expect(new Set([first, refill, batch, probe, restoration].map(request => request.requestId)).size).toBe(5);
    for (const request of [first, refill, batch, probe, restoration]) {
      expect(request).toMatchObject({ version: 3, profileId: fixture.profiles.activeProfile.id,
        sessionId: fixture.tracking.sessionId, itemType: 'MOVIE', discoveryMode: 'FOR_YOU', cursor: null });
      expect(Object.isFrozen(request)).toBe(true);
    }
    expect(first.context.attributes?.surface).toBe('DISCOVERY_FEED');
    expect(probe.context.attributes?.surface).toBe('DISCOVERY_FEED_RETURN');
    expect(restoration.context.attributes?.surface).toBe('DISCOVERY_FEED_RETURN');
  });

  it('warms five upcoming images once, tolerates a failed image, and never exposes an image preview', async () => {
    const upcoming = [10, 11, 12, 13, 14].map(delivery);
    fixture.state = snapshot(initial, upcoming);
    fixture.prefetch.mockRejectedValueOnce(new Error('Image unavailable'));
    await mount();
    expect(fixture.prefetch.mock.calls).toEqual(upcoming.map(entry => [entry.item.imageUrl]));
    await publish(snapshot(initial, [...upcoming]));
    expect(fixture.prefetch).toHaveBeenCalledTimes(5);
    const replacement = delivery(15);
    await publish(snapshot(initial, [...upcoming.slice(1), replacement]));
    expect(fixture.prefetch).toHaveBeenCalledTimes(6);
    expect(fixture.prefetch).toHaveBeenLastCalledWith(replacement.item.imageUrl);
    expect(fixture.flow.displayed).toHaveBeenCalledExactlyOnceWith(initial.item.id, initial.origin.deliveryRequestId);
    expect(fixture.tracking.recordImpression).not.toHaveBeenCalled();
  });

  it('does not confuse successful retry of a rejected action with an explicit discard', async () => {
    fixture.actions.canDiscardAction = true; fixture.actions.atomicPendingCount = 1;
    fixture.skips.pendingCount = 1;
    await mount();
    expect(fixture.flow.recoverRejected).not.toHaveBeenCalled();
    fixture.actions.canDiscardAction = false;
    await publish(snapshot());
    expect(fixture.flow.recoverRejected).not.toHaveBeenCalled();
    fixture.actions.atomicPendingCount = 0; fixture.actions.persistenceStatus = 'loading';
    await publish(snapshot());
    expect(fixture.flow.recoverRejected).not.toHaveBeenCalled();
    fixture.actions.persistenceStatus = 'ready';
    await publish(snapshot());
    expect(fixture.flow.recoverRejected).not.toHaveBeenCalled();
    await publish(snapshot());
    expect(fixture.flow.recoverRejected).not.toHaveBeenCalled();
  });

  it('forwards exact action and exposure receipts and unsubscribes all listeners when the presentation leaves', async () => {
    await mount();
    const rating: ProfileActionReceipt = { version: 1, actionId: id(80), profileId: fixture.profiles.activeProfile.id,
      itemId: initial.item.id, interaction: { interest: null, saved: false, consumed: true, rating: 10, notInterested: false } };
    await act(async () => { fixture.actionListener!(rating); fixture.exposureListener!(); });
    expect(fixture.receiveAction).toHaveBeenCalledExactlyOnceWith(fixture.flow, rating);
    expect(fixture.flow.exposureAcknowledged).toHaveBeenCalledOnce();
    await unmount();
    expect(fixture.flow.stop).toHaveBeenCalledOnce();
    expect(fixture.unsubscribeSkip).toHaveBeenCalledOnce();
    expect(fixture.unsubscribeAction).toHaveBeenCalledOnce();
    expect(fixture.unsubscribeExposure).toHaveBeenCalledOnce();
  });
});
