import { useItemLists } from '../lists/ItemListsContext';
import { rememberDeliveredSlate } from './deliveredSlate';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
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
  getConsumedItems,
  getDiscoverableItems,
  getItemInteraction,
  type ItemInteraction,
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
  const activeProfile = useActiveProfile();
  const { interactions } = useItemInteractions();
  const sharedEndorsements = useSharedEndorsements();
  const eventTracking = useEventTracking();
  const { scopeKey } = useItemLists();
  const [showConsumed, setShowConsumed] = useState(false);
  const [imageWindow, setImageWindow] = useState({ first: 0, last: 7 });
  const theme = getRoomTheme(getAmbientPhase(mode), activeProfile.activeProfile);
  const styles = createStyles(theme);
  const ranking = usePredictionRanking(itemType, mode, interactions);
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
  const rankedItems =
    isSharedDiscovery && sharedEndorsements.status === 'ready'
      ? applySharedDiscoveryOverlay(
          ranking.items,
          itemType,
          sharedEndorsements.stateByItemId,
        )
      : ranking.items;
  const consumedItems = getConsumedItems(ranking.items, interactions);
  const items = showConsumed
    ? consumedItems
    : sharedOverlayReady
      ? getDiscoverableItems(rankedItems, interactions)
      : [];
  const consumedLabel = getConsumedItemLabels(itemType).history;
  const predictionId = ranking.predictionId;
  const visibleItems = useRef<readonly Item[]>([]);
  const itemsRef = useRef<readonly Item[]>(items);
  const impressionContext = useRef<ImpressionContext>({
    mode,
    predictionId,
    predictionSource: ranking.source,
    showConsumed,
    recordEvent: eventTracking.recordEvent,
  });

  useEffect(() => {
    impressionContext.current = {
      mode,
      predictionId,
      predictionSource: ranking.source,
      showConsumed,
      recordEvent: eventTracking.recordEvent,
    };
  }, [eventTracking.recordEvent, mode, predictionId, ranking.source, showConsumed]);

  useEffect(() => {
    itemsRef.current = items;
    prefetchDiscoveryImages(items.slice(0, INITIAL_IMAGE_PREFETCH_COUNT));
  }, [items]);

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 60,
      minimumViewTime: 400,
    }),
    [],
  );
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Item>[] }) => {
      const visibleTokens = viewableItems.filter(
        (token) => token.isViewable && token.index !== null,
      );
      visibleItems.current = visibleTokens.map((token) => token.item);

      if (visibleTokens.length > 0) {
        const indexes = visibleTokens
          .map((token) => token.index)
          .filter((index): index is number => index !== null);
        const imagePlan = getDiscoveryImagePlan(
          indexes,
          itemsRef.current.length,
        );

        if (imagePlan) {
          setImageWindow((current) =>
            current.first === imagePlan.mount.first &&
            current.last === imagePlan.mount.last
              ? current
              : imagePlan.mount,
          );
          prefetchDiscoveryImages(
            itemsRef.current.slice(
              imagePlan.prefetch.first,
              imagePlan.prefetch.lastExclusive,
            ),
          );
        }
      }

      recordVisibleImpressions(
        visibleItems.current,
        impressionContext.current,
      );
    },
    [],
  );

  useEffect(() => {
    if (eventTracking.status === 'ready') {
      recordVisibleImpressions(
        visibleItems.current,
        {
          mode,
          predictionId,
          predictionSource: ranking.source,
          showConsumed,
          recordEvent: eventTracking.recordEvent,
        },
      );
    }
  }, [
    eventTracking.status,
    eventTracking.recordEvent,
    mode,
    predictionId,
    ranking.source,
    showConsumed,
  ]);

  function openItem(item: Item) {
    const sharedState = sharedEndorsements.stateByItemId[item.id];

    eventTracking.recordEvent({
      eventType: 'ITEM_OPENED',
      itemId: item.id,
      itemType: item.itemType,
      predictionId,
      discoveryMode: mode,
      properties: {
        source: 'DISCOVERY_GRID',
        predictionSource: ranking.source,
        pendingEndorsement: Boolean(sharedState?.pendingEndorsement),
      },
    });

    const deliveryId = eventTracking.createEventId();
    rememberDeliveredSlate({ id: deliveryId, scopeKey, sessionId: eventTracking.sessionId,
      predictionId, source: ranking.source, mode, items });
    router.push({
      pathname: '/discovery/[itemId]',
      params: {
        itemId: item.id,
        deliveryId,
        predictionId,
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
              accessibilityState={{ selected: !showConsumed }}
              onPress={() => setShowConsumed(false)}
              style={({ pressed }) => [
                styles.collectionButton,
                !showConsumed && styles.collectionButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.collectionText,
                  !showConsumed && styles.collectionTextSelected,
                ]}
              >
                Löydä
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Show ${consumedLabel.toLowerCase()}`}
              accessibilityState={{ selected: showConsumed }}
              onPress={() => setShowConsumed(true)}
              style={({ pressed }) => [
                styles.collectionButton,
                showConsumed && styles.collectionButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.collectionText,
                  showConsumed && styles.collectionTextSelected,
                ]}
              >
                {consumedLabel}{' '}
                {consumedItems.length > 0 ? consumedItems.length : ''}
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry recommendations"
                onPress={ranking.retry}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.retryButtonText}>Yritä uudelleen</Text>
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry shared choices"
                  onPress={sharedEndorsements.retry}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.retryButtonText}>Yritä uudelleen</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <FlatList
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
              {ranking.status === 'loading' && !showConsumed
                ? 'Haetaan suosituksia…'
                : !sharedOverlayReady && !showConsumed
                  ? 'Yhteisiä valintoja päivitetään…'
                  : showConsumed
                    ? itemType === 'BOOK'
                      ? 'Ei vielä luettuja kirjoja.'
                      : 'Ei vielä katsottuja elokuvia.'
                    : itemType === 'BOOK'
                      ? 'Kaikki kirjat on jo merkitty luetuiksi.'
                      : 'Kaikki elokuvat on jo merkitty katsotuiksi.'}
            </Text>
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
            );
            const discoveryImageUrl = item.imageUrl
              ? getDiscoveryImageUrl(item.imageUrl)
              : null;
            const imageIsWarm = Boolean(
              discoveryImageUrl &&
                warmedDiscoveryImageUrls.has(discoveryImageUrl),
            );

            return (
              <ItemCard
                item={item}
                index={index}
                discoveryImageUrl={discoveryImageUrl}
                loadImage={
                  imageIsWarm ||
                  (index >= imageWindow.first && index <= imageWindow.last)
                }
                interaction={getItemInteraction(interactions, item.id)}
                pendingApprovalLabel={pendingApprovalLabel}
                sharedProvenance={memberHistoryProvenance}
                theme={theme}
                styles={styles}
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

interface ItemCardProps {
  item: Item;
  index: number;
  discoveryImageUrl: string | null;
  loadImage: boolean;
  interaction: ItemInteraction;
  pendingApprovalLabel: string | null;
  sharedProvenance: string | null;
  theme: RoomTheme;
  styles: ReturnType<typeof createStyles>;
  onImageLoaded: () => void;
  onOpen: () => void;
}

function ItemCard({
  item,
  index,
  discoveryImageUrl,
  loadImage,
  interaction,
  pendingApprovalLabel,
  sharedProvenance,
  theme,
  styles,
  onImageLoaded,
  onOpen,
}: ItemCardProps) {
  const byline = getItemByline(item);
  const coverOpacity = 0.42 + (index % 3) * 0.12;
  const consumedLabel = getConsumedItemLabels(item.itemType).status;
  const renderRemoteImage = Boolean(discoveryImageUrl && loadImage);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      accessibilityHint="Opens swipe browsing and item details"
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.cover,
          {
            backgroundColor: theme.ambient.curtain,
            borderColor: theme.ambient.curtainHighlight,
          },
        ]}
      >
        {renderRemoteImage && discoveryImageUrl ? (
          <>
            <Image
              accessibilityIgnoresInvertColors
              source={{
                uri: discoveryImageUrl,
                cache: 'force-cache',
              }}
              resizeMode="cover"
              fadeDuration={80}
              onLoad={onImageLoaded}
              style={styles.coverImage}
            />
            <View pointerEvents="none" style={styles.coverImageShade} />
          </>
        ) : (
          <View
            pointerEvents="none"
            style={[
              styles.coverLight,
              {
                backgroundColor: theme.ambient.windowLight,
                opacity: coverOpacity,
              },
            ]}
          />
        )}

        {pendingApprovalLabel ? (
          <View style={styles.approvalBanner}>
            <Text numberOfLines={2} style={styles.approvalBannerText}>
              {pendingApprovalLabel}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.cardStatusRow,
            pendingApprovalLabel && styles.cardStatusRowWithApproval,
          ]}
        >
          {interaction.saved ? (
            <Text style={styles.cardStatus}>★</Text>
          ) : (
            <View />
          )}
          {interaction.consumed ? (
            <Text style={styles.cardStatus}>{consumedLabel}</Text>
          ) : null}
        </View>

        {!renderRemoteImage ? (
          <View style={styles.coverPlaceholderContent}>
            <Text style={styles.coverType}>
              {item.itemType === 'BOOK' ? 'KIRJA' : 'ELOKUVA'}
            </Text>
            <Text numberOfLines={3} style={styles.coverTitle}>
              {item.title}
            </Text>
            {byline ? (
              <Text numberOfLines={1} style={styles.cardByline}>
                {byline}
              </Text>
            ) : null}
            {sharedProvenance ? (
              <Text numberOfLines={1} style={styles.endorsementProvenance}>
                {sharedProvenance}
              </Text>
            ) : null}
          </View>
        ) : (
          <View pointerEvents="none" style={styles.cardMetaOverlay}>
            {sharedProvenance ? (
              <Text numberOfLines={1} style={styles.endorsementProvenance}>
                {sharedProvenance}
              </Text>
            ) : null}
            <Text numberOfLines={2} style={styles.cardTitle}>
              {item.title}
            </Text>
            {byline ? (
              <Text numberOfLines={1} style={styles.cardByline}>
                {byline}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}

interface ImpressionContext {
  mode: ReturnType<typeof useDiscoveryMode>['mode'];
  predictionId: string;
  predictionSource: ReturnType<typeof usePredictionRanking>['source'];
  showConsumed: boolean;
  recordEvent: ReturnType<typeof useEventTracking>['recordEvent'];
}

function recordVisibleImpressions(
  items: readonly Item[],
  context: ImpressionContext,
) {
  if (context.showConsumed) return;

  for (const item of items) {
    context.recordEvent({
      eventType: 'ITEM_IMPRESSION',
      itemId: item.id,
      itemType: item.itemType,
      predictionId: context.predictionId,
      discoveryMode: context.mode,
      properties: {
        source: 'DISCOVERY_GRID',
        predictionSource: context.predictionSource,
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

function getItemByline(item: Item): string | null {
  const parts: string[] = [];
  const creator = item.creators?.[0]?.trim();

  if (creator) parts.push(creator);
  if (item.releaseYear) parts.push(String(item.releaseYear));

  return parts.length > 0 ? parts.join(' · ') : null;
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
    retryButton: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.base.border,
    },
    retryButtonText: {
      color: theme.base.textPrimary,
      fontSize: 12,
      fontWeight: '700',
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
    card: {
      flex: 1,
      minWidth: 0,
    },
    approvalBanner: {
      position: 'absolute',
      top: 6,
      left: 6,
      right: 6,
      zIndex: 4,
      minHeight: 36,
      paddingHorizontal: 9,
      paddingVertical: 6,
      justifyContent: 'center',
      borderRadius: 5,
      borderWidth: 1,
      borderColor: 'rgba(117, 190, 132, 0.78)',
      backgroundColor: 'rgba(34, 94, 51, 0.78)',
    },
    approvalBannerText: {
      color: '#d5f5dc',
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
    },
    cover: {
      aspectRatio: 0.8,
      borderRadius: 2,
      borderWidth: 0.5,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    coverImage: {
      ...StyleSheet.absoluteFill,
    },
    coverImageShade: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    coverLight: {
      ...StyleSheet.absoluteFill,
    },
    coverPlaceholderContent: {
      padding: 12,
    },
    cardMetaOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 7,
      backgroundColor: 'rgba(0, 0, 0, 0.56)',
    },
    cardStatusRow: {
      position: 'absolute',
      zIndex: 3,
      top: 8,
      left: 8,
      right: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardStatusRowWithApproval: {
      top: 49,
    },
    cardStatus: {
      color: theme.base.textPrimary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textShadowColor: 'rgba(0, 0, 0, 0.72)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    coverType: {
      color: theme.base.textPrimary,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.4,
      marginBottom: 6,
    },
    coverTitle: {
      color: theme.base.textPrimary,
      fontSize: 19,
      lineHeight: 22,
      fontWeight: '700',
    },
    cardTitle: {
      color: '#ffffff',
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '700',
      textShadowColor: 'rgba(0, 0, 0, 0.66)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    endorsementProvenance: {
      color: '#d2f3d9',
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      marginBottom: 3,
    },
    cardByline: {
      color: 'rgba(255, 255, 255, 0.78)',
      fontSize: 10,
      lineHeight: 13,
      marginTop: 3,
    },
    pressed: {
      opacity: 0.78,
    },
  });
}
