/// <reference types="node" />
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePredictionRanking } from './usePredictionRanking';
import type { DiscoveryMode, ItemType } from '../../domain/contracts';
import type { ItemInteractionMap } from './itemInteraction';
import type { PredictionPage, PredictionPageRequest, PredictionPageResult } from './predictionPageOperations';
import { notifyContextualSkipChanged } from './predictionRefresh';

const fixture = vi.hoisted(() => ({
  focused: true, enabled: true, sequence: 1000,
  focusListeners: new Set<(focused: boolean) => void>(),
  itemType: 'MOVIE' as ItemType, mode: 'FOR_YOU' as DiscoveryMode,
  interactions: {} as ItemInteractionMap,
  load: vi.fn<(client: unknown, request: PredictionPageRequest, signal?: AbortSignal) => Promise<PredictionPageResult>>(),
  networkState: vi.fn(), networkSubscribe: vi.fn(),
  appState: { currentState: 'active', addEventListener: vi.fn() },
  connection: { status: 'configured', client: {}, config: { url: 'https://ranking.fixture.invalid' } },
  profiles: { status: 'ready', actorUserId: 'ab239000-0000-4000-8000-000000000001',
    activeProfile: { id: 'ab239000-0000-4000-8000-000000000002', type: 'PERSONAL' } },
  tracking: { status: 'ready', sessionId: 'ab239000-0000-4000-8000-000000000003',
    session: { profileId: 'ab239000-0000-4000-8000-000000000002', actorUserId: 'ab239000-0000-4000-8000-000000000001' } },
  actions: { collectionRevision: 0 },
}));

vi.mock('react', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const react = createRequire(require.resolve('react-test-renderer'))('react');
  return { ...react, default: react };
});
vi.mock('expo-router', async () => {
  const react = await import('react');
  return {
    useIsFocused: () => fixture.focused,
    // Expo's imperative focus listeners can run before useIsFocused commits.
    // Keep that ordering in this mock so split activation paths cannot hide it.
    useFocusEffect: function useFocusEffect(effect: () => void | (() => void)) {
      react.useEffect(() => {
        let cleanup = fixture.focused ? effect() : undefined;
        const changed = (focused: boolean) => { cleanup?.(); cleanup = focused ? effect() : undefined; };
        fixture.focusListeners.add(changed);
        return () => { fixture.focusListeners.delete(changed); cleanup?.(); };
      }, [effect]);
    },
  };
});
vi.mock('react-native', () => ({ AppState: fixture.appState }));
vi.mock('expo-network', () => ({ getNetworkStateAsync: fixture.networkState, addNetworkStateListener: fixture.networkSubscribe }));
vi.mock('@/data/SupabaseProvider', () => ({ useSupabaseConnection: () => fixture.connection }));
vi.mock('@/features/profiles/ActiveProfileContext', () => ({ useActiveProfile: () => fixture.profiles }));
vi.mock('../events/EventTrackingContext', () => ({ useEventTracking: () => fixture.tracking }));
vi.mock('./ItemInteractionContext', () => ({ useItemInteractions: () => fixture.actions }));
vi.mock('../events/eventTracking', () => ({
  createUuidV7: () => `ab239000-0000-4000-8000-${String(fixture.sequence++).padStart(12, '0')}`,
  createCorrelationId: (_seed: string, key: string) => `fallback:${key}`,
}));
vi.mock('./mockDiscovery', () => ({ getStaticMockItems: () => [] }));
vi.mock('./predictionPageOperations', async () => ({
  ...await vi.importActual<typeof import('./predictionPageOperations')>('./predictionPageOperations'),
  loadCatalogPredictionPage: fixture.load,
}));

const id = (value: number) => `ab239000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const pages = new Map<string, PredictionPage>();
function success(request: PredictionPageRequest): PredictionPage {
  const parent = request.cursor ? pages.get(request.cursor) : undefined;
  const predictionId = id(fixture.sequence++);
  const rootPredictionId = parent?.rootPredictionId ?? predictionId;
  const nextCursor = id(fixture.sequence++);
  const items = Array.from({ length: request.limit }, () => {
    const itemId = id(fixture.sequence++);
    return { id: itemId, itemType: request.itemType, title: `Item ${itemId}` };
  });
  const page: PredictionPage = { status: 'success', request, ranking: { predictionId, items, predictions: [] },
    availability: 'ITEMS', continuationSupported: true, nextCursor, candidateCount: request.limit * 3,
    sourcePredictionId: predictionId, pageIndex: (parent?.pageIndex ?? 0) + 1, featureAt: null,
    chainId: parent?.chainId ?? id(fixture.sequence++), rootPredictionId,
    parentPredictionId: parent?.ranking.predictionId ?? null, seenCount: (parent?.seenCount ?? 0) + items.length,
    chainLimit: 1000, continuationState: 'MORE' };
  pages.set(nextCursor, page);
  return page;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

let renderer: ReactTestRenderer | null = null;
let observed: ReturnType<typeof usePredictionRanking>;
function Probe() {
  const ranking = usePredictionRanking(fixture.itemType, fixture.mode, fixture.interactions, fixture.enabled);
  React.useLayoutEffect(() => { observed = ranking; }, [ranking]);
  return null;
}
async function render() {
  await act(async () => {
    if (renderer) renderer.update(<Probe />);
    else renderer = create(<Probe />);
  });
}
async function advance(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function setFocused(focused: boolean) {
  fixture.focused = focused;
  await act(async () => { fixture.focusListeners.forEach(listener => listener(focused)); });
  await render();
}
async function setEnabled(enabled: boolean) { fixture.enabled = enabled; await render(); }
async function commitRevision() { fixture.actions.collectionRevision += 1; await render(); }

beforeEach(() => {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-24T10:00:00Z')); vi.clearAllMocks();
  fixture.focused = true; fixture.enabled = true; fixture.sequence = 1000;
  fixture.focusListeners.clear();
  fixture.itemType = 'MOVIE'; fixture.mode = 'FOR_YOU'; fixture.interactions = {};
  fixture.actions.collectionRevision = 0;
  fixture.connection.config.url = 'https://ranking.fixture.invalid';
  fixture.profiles.actorUserId = id(1); fixture.profiles.activeProfile.id = id(2); fixture.profiles.activeProfile.type = 'PERSONAL';
  fixture.tracking.sessionId = id(3); fixture.tracking.session = { profileId: id(2), actorUserId: id(1) };
  fixture.appState.currentState = 'active';
  fixture.appState.addEventListener.mockReturnValue({ remove: vi.fn() });
  fixture.networkState.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  fixture.networkSubscribe.mockReturnValue({ remove: vi.fn() });
  pages.clear(); fixture.load.mockReset().mockImplementation(async (_client, request) => success(request));
});
afterEach(async () => {
  await act(async () => { renderer?.unmount(); renderer = null; });
  vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('mounted Discovery grid ranking lifecycle', () => {
  it('waits for the focused render to commit after an imperative navigation focus event', async () => {
    fixture.focused = false;
    await render();
    const hidden = observed;
    fixture.focused = true;
    await act(async () => { fixture.focusListeners.forEach(listener => listener(true)); });
    await advance();
    await act(async () => { hidden.refresh(); hidden.loadMore(); hidden.retry(); });
    expect(fixture.load).not.toHaveBeenCalled();
    await render(); await advance();
    expect(fixture.load).toHaveBeenCalledOnce();
    expect(observed.status).toBe('ready');
  });

  it.each(['PERSONAL', 'SHARED'])('starts %s with six Items immediately and retains immutable paging origins', async profileType => {
    fixture.profiles.activeProfile.type = profileType;
    await render();
    await advance();
    expect(fixture.load).toHaveBeenCalledOnce();
    const root = fixture.load.mock.calls[0]![1];
    const first = observed;
    expect(root).toMatchObject({ version: 3, cursor: null, limit: 6, itemType: 'MOVIE', discoveryMode: 'FOR_YOU' });
    expect(Object.isFrozen(root)).toBe(true);
    expect(first.status).toBe('ready');
    expect(first.items).toHaveLength(6);
    expect(first.deliveryRequestIds).toEqual(Object.fromEntries(first.items.map(item => [item.id, root.requestId])));
    expect(first.predictionIds).toEqual(Object.fromEntries(first.items.map(item => [item.id, first.predictionId])));
    await act(async () => { observed.loadMore(); });
    const continuation = fixture.load.mock.calls[1]![1];
    expect(continuation).toMatchObject({ limit: 6, version: 3, profileId: root.profileId, sessionId: root.sessionId });
    expect(continuation.cursor).not.toBeNull();
    expect(continuation.context).toBe(root.context);
    expect(continuation.requestId).not.toBe(root.requestId);
    expect(observed.items).toHaveLength(12);
    for (const item of first.items) {
      expect(observed.deliveryRequestIds?.[item.id]).toBe(root.requestId);
      expect(observed.predictionIds[item.id]).toBe(first.predictionId);
    }
  });

  it('coalesces changed evidence only while Löydä remains continuously visible', async () => {
    await render(); await advance();
    const first = observed;
    await commitRevision();
    expect(observed.items).toEqual([]);
    expect(observed.viewId).not.toBe(first.viewId);
    await advance(599);
    expect(fixture.load).toHaveBeenCalledOnce();
    await advance(1);
    expect(fixture.load).toHaveBeenCalledTimes(2);
    expect(fixture.load.mock.calls[1]![1].requestId).not.toBe(fixture.load.mock.calls[0]![1].requestId);
    expect(observed.status).toBe('ready');
  });

  it('continues coalescing rapid visible revisions instead of dispatching an intermediate empty reader', async () => {
    await render(); await advance();
    await commitRevision(); await advance(300);
    await commitRevision(); await advance(599);
    expect(fixture.load).toHaveBeenCalledOnce();
    await advance(1);
    expect(fixture.load).toHaveBeenCalledTimes(2);
    expect(observed.status).toBe('ready');
  });

  it('does no work for blurred evidence revisions and starts current evidence immediately on return', async () => {
    await render(); await advance();
    const old = observed;
    await setFocused(false);
    await commitRevision();
    await act(async () => { notifyContextualSkipChanged(); });
    await advance(1000);
    await act(async () => { old.refresh(); old.loadMore(); old.retry(); observed.refresh(); observed.loadMore(); observed.retry(); });
    expect(fixture.load).toHaveBeenCalledOnce();
    expect(observed.items).toEqual([]);
    await setFocused(true); await advance();
    expect(fixture.load).toHaveBeenCalledTimes(2);
    expect(observed.status).toBe('ready');
    expect(observed.viewId).not.toBe(old.viewId);
  });

  it('preserves unchanged ready pages on route return and rejects callbacks captured before blur', async () => {
    await render(); await advance();
    const old = observed;
    await setFocused(false); await advance(1000);
    await setFocused(true); await advance();
    expect(fixture.load).toHaveBeenCalledOnce();
    expect(observed.viewId).toBe(old.viewId);
    expect(observed.items).toBe(old.items);
    await act(async () => { old.refresh(); old.loadMore(); old.retry(); });
    expect(fixture.load).toHaveBeenCalledOnce();
    await act(async () => { observed.loadMore(); });
    expect(fixture.load).toHaveBeenCalledTimes(2);
    expect(observed.items).toHaveLength(12);
  });

  it('keeps an initially hidden or moving page idle and activates it without a debounce when settled', async () => {
    fixture.enabled = false;
    await render(); await advance(1000);
    await act(async () => { observed.refresh(); observed.loadMore(); observed.retry(); });
    expect(fixture.load).not.toHaveBeenCalled();
    expect(fixture.networkSubscribe).not.toHaveBeenCalled();
    await setEnabled(true); await advance();
    expect(fixture.load).toHaveBeenCalledOnce();
    const ready = observed;
    await setEnabled(false); await advance(1000);
    await setEnabled(true); await advance();
    expect(fixture.load).toHaveBeenCalledOnce();
    expect(observed.viewId).toBe(ready.viewId);
    expect(observed.items).toBe(ready.items);
    await act(async () => { ready.refresh(); ready.loadMore(); ready.retry(); });
    expect(fixture.load).toHaveBeenCalledOnce();
  });

  it('defers hidden dirty work and cancels an in-progress debounce until the page returns', async () => {
    await render(); await advance();
    await commitRevision(); await advance(300);
    await setEnabled(false);
    await commitRevision(); await advance(1000);
    expect(fixture.load).toHaveBeenCalledOnce();
    const hidden = observed;
    await act(async () => { hidden.refresh(); hidden.loadMore(); hidden.retry(); });
    await setEnabled(true); await advance();
    expect(fixture.load).toHaveBeenCalledTimes(2);
    expect(observed.status).toBe('ready');
    await act(async () => { hidden.refresh(); hidden.loadMore(); hidden.retry(); });
    expect(fixture.load).toHaveBeenCalledTimes(2);
  });

  it.each(['environment', 'actor', 'profile', 'session', 'itemType', 'mode'] as const)(
    'starts a new %s scope immediately and cannot act through an obsolete reader', async identity => {
      await render(); await advance();
      const old = observed;
      if (identity === 'environment') fixture.connection.config.url = 'https://other.fixture.invalid';
      if (identity === 'actor') {
        fixture.profiles.actorUserId = id(8); fixture.tracking.session.actorUserId = id(8);
      }
      if (identity === 'profile') {
        fixture.profiles.activeProfile.id = id(9); fixture.tracking.session.profileId = id(9);
      }
      if (identity === 'session') fixture.tracking.sessionId = id(10);
      if (identity === 'itemType') fixture.itemType = 'BOOK';
      if (identity === 'mode') fixture.mode = 'SURPRISE';
      await render(); await advance();
      expect(fixture.load).toHaveBeenCalledTimes(2);
      expect(observed.viewId).not.toBe(old.viewId);
      expect(observed.items).not.toBe(old.items);
      expect(fixture.load.mock.calls[1]![1]).toMatchObject({ profileId: fixture.profiles.activeProfile.id,
        sessionId: fixture.tracking.sessionId, itemType: fixture.itemType, discoveryMode: fixture.mode, limit: 6 });
      await act(async () => { old.refresh(); old.loadMore(); old.retry(); });
      expect(fixture.load).toHaveBeenCalledTimes(2);
    },
  );

  it('aborts a hidden request, ignores its late result and resumes the exact request when visible', async () => {
    const late = deferred<PredictionPageResult>();
    const resumed = deferred<PredictionPageResult>();
    fixture.load.mockImplementationOnce(() => late.promise).mockImplementationOnce(() => resumed.promise);
    await render(); await advance();
    const request = fixture.load.mock.calls[0]![1];
    const signal = fixture.load.mock.calls[0]![2];
    await setEnabled(false);
    expect(signal?.aborted).toBe(true);
    await act(async () => { late.resolve(success(request)); });
    expect(observed.items).toEqual([]);
    await setEnabled(true); await advance();
    expect(fixture.load).toHaveBeenCalledTimes(2);
    expect(fixture.load.mock.calls[1]![1]).toBe(request);
    await act(async () => { resumed.resolve(success(request)); });
    expect(observed.status).toBe('ready');
    expect(observed.items).toHaveLength(6);
    expect(observed.deliveryRequestIds).toEqual(Object.fromEntries(observed.items.map(item => [item.id, request.requestId])));
  });
});
