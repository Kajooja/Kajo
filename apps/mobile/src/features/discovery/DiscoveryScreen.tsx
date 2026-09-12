import { DiscoveryItemCard } from './DiscoveryItemCard';
import { useItemLists } from '../lists/ItemListsContext';
import { buildDeliveredItemOrigins, getDeliveredItemOrigin, rememberDeliveredSlate, type DeliveredItemOrigin } from './deliveredSlate';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Item, ItemType } from '../../domain/contracts';
import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useEventTracking } from '../events/EventTrackingContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import {
  getDiscoveryImagePlan,
  getDiscoveryImageUrl,
} from './catalogImageUrl';
import { useDiscoveryMode } from './DiscoveryModeContext';
import { InteractionPersistenceNotice } from './InteractionPersistenceNotice';
import { useItemInteractions } from './ItemInteractionContext';
import { useSharedEndorsements } from './SharedEndorsementContext';
import {
  getDiscoverableItems,
  getItemInteraction,
} from './itemInteraction';
import { getConsumedItemLabels } from './itemInteractionLabels';
import {
  applySharedDiscoveryOverlay,
  formatMemberHistoryProvenance,
  formatPendingListApproval,
  getMemberHistoryNicknames,
  getPendingListApproval,
} from './sharedEndorsement';
import { usePredictionRanking } from './usePredictionRanking';

const INITIAL_IMAGE_PREFETCH_COUNT = 14;
const warmedDiscoveryImageUrls = new Set<string>();
const prefetchedDiscoveryImageUrls = new Set<string>();

interface DiscoveryScreenProps {
  itemType: ItemType;
  title: string;
}

export function DiscoveryScreen({ itemType, title }: DiscoveryScreenProps) {
  const { mode } = useDiscoveryMode();
  const focused = useIsFocused();
  const activeProfile = useActiveProfile();
  const { interactions } = useItemInteractions();
  const sharedEndorsements = useSharedEndorsements();
  const eventTracking = useEventTracking();
  const { scopeKey } = useItemLists();
  const [imageWindow, setImageWindow] = useState({ viewId: '', first: 0, last: 7 });
  const theme = getRoomTheme(getAmbientPhase(mode), activeProfile.activeProfile);
  const styles = createStyles(theme);
  const ranking = usePredictionRanking(itemType, mode, interactions);
  const visibleImageWindow = imageWindow.viewId === ranking.viewId ? imageWindow : { first: 0, last: 7 };
  const activeSharedMembership =
    activeProfile.activeProfile?.type === 'SHARED'
      ? activeProfile.sharedProfiles.find(
          (membership) =>
            membership.profile.id === activeProfile.activeProfile?.id,
        ) ?? null
      : null;
  const isSharedDiscovery = Boolean(activeSharedMembership);
  const sharedOverlayReady =
    !isSharedDiscovery || sharedEndorsements.status === 'ready';
  const rankedItems = useMemo(() => ranking.status !== 'ready' ? [] :
    isSharedDiscovery && sharedEndorsements.status === 'ready'
      ? applySharedDiscoveryOverlay(
          ranking.items,
          itemType,
          sharedEndorsements.stateByItemId,
        )
      : ranking.items, [isSharedDiscovery, sharedEndorsements.status, sharedEndorsements.stateByItemId, ranking.status, ranking.items, itemType]);
  const origins = useMemo(() => buildDeliveredItemOrigins(
    rankedItems, ranking.items, ranking.predictionIds, ranking.source,
    isSharedDiscovery ? sharedEndorsements.stateByItemId : {},
  ), [rankedItems, ranking.items, ranking.predictionIds, ranking.source, isSharedDiscovery, sharedEndorsements.stateByItemId]);
  const items = useMemo(() => sharedOverlayReady
    ? getDiscoverableItems(rankedItems, interactions) : [], [sharedOverlayReady, rankedItems, interactions]);
  const consumedLabel = getConsumedItemLabels(itemType).history;
  const predictionId = ranking.predictionId;
  // Each request/revision owns its visible tokens. A callback retained by the
  // previous native list cannot relabel those tokens with a new page or scope.
  const view = useMemo(() => ({ id: ranking.viewId }), [ranking.viewId]);
  const currentView = useRef<{ token: typeof view; visible: readonly Item[];
    items: readonly Item[]; context: ImpressionContext | null } | null>(null);
  useLayoutEffect(() => () => {
    if (currentView.current?.token === view) currentView.current = null;
  }, [view]);
  useLayoutEffect(() => {
    const previous = currentView.current;
    const visible = previous?.token === view
      ? previous.visible.filter(item => items.some(current => current.id === item.id)) : [];
    const context = focused && ranking.status === 'ready' && sharedOverlayReady
      ? { mode, origins, originSessionId: eventTracking.sessionId, recordEvent: eventTracking.recordEvent } : null;
    currentView.current = { token: view, visible, items, context };
    if (context) recordVisibleImpressions(visible, context);
  }, [view, items, focused, ranking.status, sharedOverlayReady, mode, origins,
    eventTracking.sessionId, eventTracking.recordEvent]);
  useEffect(() => { prefetchDiscoveryImages(items.slice(0, INITIAL_IMAGE_PREFETCH_COUNT)); }, [items]);

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 60,
      minimumViewTime: 400,
    }),
    [],
  );
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Item>[] }) => {
      const committed = currentView.current;
      if (committed?.token !== view || !committed.context) return;
      const visibleTokens = viewableItems.filter(
        (token) => token.isViewable && token.index !== null && committed.items.some(item => item.id === token.item.id),
      );
      const visible = visibleTokens.map((token) => token.item);
      currentView.current = { ...committed, visible };

      if (visibleTokens.length > 0) {
        const indexes = visibleTokens
          .map((token) => token.index)
          .filter((index): index is number => index !== null);
        const imagePlan = getDiscoveryImagePlan(
          indexes,
          committed.items.length,
        );

        if (imagePlan) {
          setImageWindow((current) =>
            current.viewId === view.id && current.first === imagePlan.mount.first &&
            current.last === imagePlan.mount.last
              ? current
              : { viewId: view.id, ...imagePlan.mount },
          );
          prefetchDiscoveryImages(
            committed.items.slice(
              imagePlan.prefetch.first,
              imagePlan.prefetch.lastExclusive,
            ),
          );
        }
      }

      recordVisibleImpressions(visible, committed.context);
    },
    [view],
  );

  function openItem(item: Item) {
    const committed = currentView.current;
    if (committed?.token !== view || !committed.context || !committed.items.some(current => current.id === item.id)) return;
    const origin = getDeliveredItemOrigin(committed.context.origins, item.id);

    committed.context.recordEvent({
      eventType: 'ITEM_OPENED',
      itemId: item.id,
      itemType: item.itemType,
      ...origin,
      originSessionId: committed.context.originSessionId,
      discoveryMode: mode,
      properties: {
        source: 'DISCOVERY_GRID',
        ...origin.properties,
      },
    });

    const deliveryId = eventTracking.createEventId();
    rememberDeliveredSlate({ id: deliveryId, scopeKey, sessionId: eventTracking.sessionId,
      predictionId, source: ranking.source, mode, items, origins });
    router.push({
      pathname: '/discovery/[itemId]',
      params: {
        itemId: item.id,
        deliveryId,
        ...(origin.predictionId ? { predictionId: origin.predictionId } : {}),
        predictionSource: ranking.source,
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="light" />
      <View
        pointerEvents="none"
        style={[
          styles.ambientBackdrop,
          {
            backgroundColor: theme.ambient.wash,
            opacity: theme.ambient.washOpacity * 1.35,
          },
        ]}
      />

      <View style={styles.screen}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title}</Text>

          <View
            style={styles.collectionRow}
            accessibilityLabel="Discovery collection"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show discovery items"
              accessibilityState={{ selected: true }}
              onPress={ranking.refresh}
              style={({ pressed }) => [
                styles.collectionButton,
                styles.collectionButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.collectionText,
                  styles.collectionTextSelected,
                ]}
              >
                Löydä
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Show ${consumedLabel.toLowerCase()}`}
              accessibilityState={{ selected: false }}
              onPress={() => router.push({ pathname: '/lists/history', params: { itemType } })}
              style={({ pressed }) => [
                styles.collectionButton,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.collectionText,
                ]}
              >
                {consumedLabel}
              </Text>
            </Pressable>
          </View>

          <InteractionPersistenceNotice theme={theme} />

          {ranking.status === 'error' ? (
            <View style={styles.predictionNotice}>
              <Text
                accessibilityLiveRegion="polite"
                style={styles.predictionNoticeText}
              >
                {ranking.message}
              </Text>
              <Pressable accessibilityRole="button" onPress={ranking.recovery === 'refresh' ? ranking.refresh : ranking.retry}
                style={({ pressed }) => [styles.collectionButton, pressed && styles.pressed]}>
                <Text style={styles.collectionText}>{ranking.recovery === 'refresh' ? 'Aloita uusi haku' : 'Yritä uudelleen'}</Text>
              </Pressable>
            </View>
          ) : null}

          {isSharedDiscovery &&
          (sharedEndorsements.status !== 'ready' || sharedEndorsements.error) ? (
            <View style={styles.predictionNotice}>
              <Text
                accessibilityLiveRegion="polite"
                style={styles.predictionNoticeText}
              >
                {sharedEndorsements.error
                  ? sharedEndorsements.error
                  : 'Yhteisiä valintoja päivitetään…'}
              </Text>
              {sharedEndorsements.error ? (
                <Text style={styles.predictionNoticeText}>Päivitä vetämällä alaspäin.</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <FlatList
          key={ranking.viewId}
          alwaysBounceVertical
          overScrollMode="always"
          refreshing={ranking.status === 'loading' || (isSharedDiscovery && sharedEndorsements.status === 'loading')}
          onRefresh={() => {
            if ((ranking.status === 'error' || ranking.nextPageError) && ranking.recovery === 'retry') ranking.retry(); else ranking.refresh();
            if (isSharedDiscovery) sharedEndorsements.retry();
          }}
          onEndReached={ranking.loadMore}
          onEndReachedThreshold={0.4}
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={32}
          windowSize={7}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[
            styles.gridContent,
            items.length === 0 && styles.emptyGrid,
          ]}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {ranking.status === 'loading'
                ? 'Haetaan suosituksia…'
                : ranking.status === 'error'
                  ? ranking.message
                : !sharedOverlayReady
                  ? 'Yhteisiä valintoja päivitetään…'
                  : ranking.availability === 'CATALOG_EMPTY'
                    ? itemType === 'BOOK' ? 'Kirjavalikoima on vielä tyhjä.' : 'Elokuvavalikoima on vielä tyhjä.'
                  : itemType === 'BOOK'
                    ? 'Ei uusia kirjasuosituksia juuri nyt.'
                    : 'Ei uusia elokuvasuosituksia juuri nyt.'}
            </Text>
          }
          ListFooterComponent={
            <View style={styles.pageFooter}>
              {ranking.loadingNextPage ? <Text accessibilityLiveRegion="polite" style={styles.pageText}>Haetaan lisää suosituksia…</Text>
                : ranking.nextPageError ? <>
                  <Text accessibilityLiveRegion="polite" style={styles.pageText}>{ranking.nextPageError}</Text>
                  {ranking.recovery === 'retry' ? <Pressable accessibilityRole="button" onPress={ranking.retry} style={styles.collectionButton}>
                    <Text style={styles.collectionText}>Yritä uudelleen</Text>
                  </Pressable> : null}
                  <Pressable accessibilityRole="button" onPress={ranking.refresh} style={styles.collectionButton}>
                    <Text style={styles.collectionText}>Aloita uusi haku</Text>
                  </Pressable>
                </> : ranking.hasNextPage ?
                  <Pressable accessibilityRole="button" onPress={ranking.loadMore} style={styles.collectionButton}>
                    <Text style={styles.collectionText}>Näytä lisää</Text>
                  </Pressable>
                : ranking.status === 'ready' && ranking.source === 'hosted' && items.length > 0 ?
                  <Text style={styles.pageText}>Tämän haun suositukset on näytetty. Voit päivittää haun vetämällä alaspäin.</Text> : null}
            </View>
          }
          renderItem={({ item, index }) => {
            const sharedState = sharedEndorsements.stateByItemId[item.id];
            const pendingApprovalLabel = formatPendingListApproval(
              getPendingListApproval(
                sharedState,
                activeSharedMembership?.members ?? [],
                activeProfile.actorUserId,
              ),
            );
            const memberHistoryProvenance = formatMemberHistoryProvenance(
              getMemberHistoryNicknames(
                sharedState,
                activeSharedMembership?.members ?? [],
              ),
              item.itemType,
            );
            const discoveryImageUrl = item.imageUrl
              ? getDiscoveryImageUrl(item.imageUrl)
              : null;
            const imageIsWarm = Boolean(
              discoveryImageUrl &&
                warmedDiscoveryImageUrls.has(discoveryImageUrl),
            );

            return (
              <DiscoveryItemCard
                item={item}
                index={index}
                discoveryImageUrl={discoveryImageUrl}
                loadImage={
                  imageIsWarm ||
                  (index >= visibleImageWindow.first && index <= visibleImageWindow.last)
                }
                interaction={getItemInteraction(interactions, item.id)}
                pendingApprovalLabel={pendingApprovalLabel}
                sharedProvenance={memberHistoryProvenance}
                theme={theme}
                onImageLoaded={() => {
                  if (discoveryImageUrl) {
                    warmedDiscoveryImageUrls.add(discoveryImageUrl);
                  }
                }}
                onOpen={() => openItem(item)}
              />
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

interface ImpressionContext {
  originSessionId: string | null;
  mode: ReturnType<typeof useDiscoveryMode>['mode'];
  origins: Readonly<Record<string, DeliveredItemOrigin>>;
  recordEvent: ReturnType<typeof useEventTracking>['recordEvent'];
}

function recordVisibleImpressions(
  items: readonly Item[],
  context: ImpressionContext,
) {
  for (const item of items) {
    // FlatList can report an old visible token while a collection refresh has
    // invalidated the grid. It cannot establish a new delivered impression.
    if (!Object.hasOwn(context.origins, item.id)) continue;
    const origin = getDeliveredItemOrigin(context.origins, item.id);
    context.recordEvent({
      eventType: 'ITEM_IMPRESSION',
      itemId: item.id,
      itemType: item.itemType,
      ...origin,
      originSessionId: context.originSessionId,
      discoveryMode: context.mode,
      properties: {
        source: 'DISCOVERY_GRID',
        ...origin.properties,
      },
    });
  }
}

function prefetchDiscoveryImages(items: readonly Item[]) {
  for (const item of items) {
    if (!item.imageUrl) continue;

    const imageUrl = getDiscoveryImageUrl(item.imageUrl);
    if (
      warmedDiscoveryImageUrls.has(imageUrl) ||
      prefetchedDiscoveryImageUrls.has(imageUrl)
    ) {
      continue;
    }

    prefetchedDiscoveryImageUrls.add(imageUrl);
    void Image.prefetch(imageUrl)
      .then((success) => {
        if (success) {
          warmedDiscoveryImageUrls.add(imageUrl);
          return;
        }
        prefetchedDiscoveryImageUrls.delete(imageUrl);
      })
      .catch(() => {
        prefetchedDiscoveryImageUrls.delete(imageUrl);
      });
  }
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    ambientBackdrop: {
      ...StyleSheet.absoluteFill,
    },
    screen: {
      flex: 1,
      paddingTop: 7,
    },
    pageText: { color: theme.base.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    pageFooter: { paddingVertical: 16, paddingHorizontal: 8, gap: 10, alignItems: 'center' },
    headerContent: {
      paddingHorizontal: 18,
    },
    title: {
      color: theme.base.textPrimary,
      fontSize: 21,
      lineHeight: 25,
      fontWeight: '700',
      marginBottom: 10,
    },
    collectionRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    predictionNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 10,
    },
    predictionNoticeText: {
      flex: 1,
      color: theme.base.textMuted,
      fontSize: 12,
    },
    collectionButton: {
      minHeight: 36,
      borderBottomWidth: 1,
      borderBottomColor: 'transparent',
      paddingHorizontal: 4,
      justifyContent: 'center',
    },
    collectionButtonSelected: {
      borderBottomColor: theme.ambient.curtainHighlight,
    },
    collectionText: {
      color: theme.base.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    collectionTextSelected: {
      color: theme.base.textPrimary,
    },
    gridContent: {
      paddingHorizontal: 3,
      paddingBottom: 24,
    },
    emptyGrid: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    emptyText: {
      color: theme.base.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      paddingHorizontal: 28,
    },
    gridRow: {
      gap: 3,
      marginBottom: 3,
    },
    pressed: {
      opacity: 0.78,
    },
  });
}
