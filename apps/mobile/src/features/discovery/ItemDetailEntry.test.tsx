import React, { type ReactElement, type ComponentProps } from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '../../domain/contracts';
import { CatalogDetailEntry } from './CatalogDetailEntry';
import { ItemDetailScreen } from './ItemDetailScreen';

const state = vi.hoisted(() => ({ client: {}, scopeKey: 'test:actor:personal', shared: false, overlayStatus: 'ready' }));
vi.mock('../../data/SupabaseProvider', () => ({ useSupabaseConnection: () => ({ status: 'configured', client: state.client }) }));
vi.mock('../profiles/ActiveProfileContext', () => ({ useActiveProfile: () => ({
  status: 'ready', actorUserId: 'actor', activeProfile: { id: state.shared ? 'shared' : 'personal',
    type: state.shared ? 'SHARED' : 'PERSONAL', name: 'Test profile' },
}) }));
vi.mock('./DiscoveryModeContext', () => ({ useDiscoveryMode: () => ({ mode: 'FOR_YOU' }) }));
vi.mock('./SharedEndorsementContext', () => ({ useSharedEndorsements: () => ({ status: state.overlayStatus, retry: vi.fn() }) }));
vi.mock('../lists/ItemListsContext', () => ({ useItemLists: () => ({ scopeKey: state.scopeKey }) }));
vi.mock('../events/EventTrackingContext', () => ({ useEventTracking: vi.fn() }));
vi.mock('../messages/ProfileMessagesContext', () => ({ useProfileMessages: vi.fn() }));
vi.mock('./ItemInteractionContext', () => ({ useItemInteractions: vi.fn() }));
vi.mock('../lists/ListDestinationSheet', () => ({ ListDestinationSheet: 'ListDestinationSheet' }));
vi.mock('./RatingControl', () => ({ RatingControl: 'RatingControl' }));
vi.mock('./InteractionPersistenceNotice', () => ({ InteractionPersistenceNotice: 'InteractionPersistenceNotice' }));
vi.mock('expo-router', () => ({ router: { back: vi.fn() } }));
vi.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('react-native', () => ({
  Pressable: 'Pressable', Text: 'Text', View: 'View', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (value: unknown) => value },
}));

// Expo supplies the JSX runtime; this Node-only entry test does not mount native views.
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { state.shared = false; state.scopeKey = 'test:actor:personal'; state.overlayStatus = 'ready'; });

describe('the real detail route', () => {
  it.each([false, true])('loads a List/history entry canonically for Shared=%s and forwards its whole Item', shared => {
    state.shared = shared;
    const entry = ItemDetailScreen({ itemId: 'cold-item' }) as ReactElement<ComponentProps<typeof CatalogDetailEntry>>;
    expect(entry.type).toBe(CatalogDetailEntry);
    expect(entry.props.client).toBe(state.client);
    expect(entry.props.scopeKey).toBe(state.scopeKey);
    const item: Item = { id: 'cold-item', itemType: 'BOOK', title: 'Canonical title', descriptionStatus: 'unverified' };
    const detail = entry.props.children(item) as ReactElement<{ catalogItem: Item }>;
    expect(detail.props.catalogItem).toBe(item);
  });

  it('remounts the loader when the acting Profile changes', () => {
    const before = ItemDetailScreen({ itemId: 'cold-item' });
    state.scopeKey = 'test:actor:shared';
    const after = ItemDetailScreen({ itemId: 'cold-item' });
    expect(before.key).not.toBe(after.key);
    expect(after.props.scopeKey).toBe(state.scopeKey);
  });

  it('retains the Shared readiness gate and the separate delivered-Prediction route', () => {
    state.shared = true;
    state.overlayStatus = 'loading';
    expect(ItemDetailScreen({ itemId: 'cold-item' }).type).not.toBe(CatalogDetailEntry);
    state.overlayStatus = 'ready';
    const prediction = ItemDetailScreen({ itemId: 'ranked-item', predictionId: 'delivered-run', predictionSource: 'hosted' });
    expect(prediction.type).not.toBe(CatalogDetailEntry);
    expect(prediction.props).toMatchObject({ predictionId: 'delivered-run', predictionSource: 'hosted' });
  });
});
