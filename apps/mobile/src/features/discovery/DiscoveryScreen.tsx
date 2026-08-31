import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  FlatList,
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
import { useDiscoveryMode } from './DiscoveryModeContext';
import { InteractionPersistenceNotice } from './InteractionPersistenceNotice';
import { useItemInteractions } from './ItemInteractionContext';
import {
  getConsumedItems,
  getDiscoverableItems,
  getItemInteraction,
  type ItemInteraction,
} from './itemInteraction';
import { getConsumedItemLabels } from './itemInteractionLabels';
import { usePredictionRanking } from './usePredictionRanking';

interface DiscoveryScreenProps {
  itemType: ItemType;
  title: string;
}

export function DiscoveryScreen({ itemType, title }: DiscoveryScreenProps) {
  const { mode } = useDiscoveryMode();
  const activeProfile = useActiveProfile();
  const { interactions } = useItemInteractions();
  const eventTracking = useEventTracking();
  const [showConsumed, setShowConsumed] = useState(false);
  const theme = getRoomTheme(getAmbientPhase(mode), activeProfile.activeProfile);
  const styles = createStyles(theme);
  const ranking = usePredictionRanking(itemType, mode, interactions);
  const rankedItems = ranking.items;
  const consumedItems = getConsumedItems(rankedItems, interactions);
  const items = showConsumed
    ? consumedItems
    : getDiscoverableItems(rankedItems, interactions);
  const consumedLabel = getConsumedItemLabels(itemType).history;
  const predictionId = ranking.predictionId;
  const visibleItems = useRef<readonly Item[]>([]);
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
  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 60,
      minimumViewTime: 400,
    }),
    [],
  );
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Item>[] }) => {
      visibleItems.current = viewableItems
        .filter((token) => token.isViewable)
        .map((token) => token.item);
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
    eventTracking.recordEvent({
      eventType: 'ITEM_OPENED',
      itemId: item.id,
      itemType: item.itemType,
      predictionId,
      discoveryMode: mode,
      properties: {
        source: 'DISCOVERY_GRID',
        predictionSource: ranking.source,
      },
    });

    router.push({
      pathname: '/discovery/[itemId]',
      params: {
        itemId: item.id,
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
          { backgroundColor: theme.ambient.wash, opacity: theme.ambient.washOpacity * 1.35 },
        ]}
      />

      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Room"
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backText}>← Huone</Text>
          </Pressable>
          <Text style={styles.kicker}>DISCOVERY</Text>
        </View>

        <Text style={styles.title}>{title}</Text>

        <View style={styles.collectionRow} accessibilityLabel="Discovery collection">
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
            <Text style={[styles.collectionText, !showConsumed && styles.collectionTextSelected]}>
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
            <Text style={[styles.collectionText, showConsumed && styles.collectionTextSelected]}>
              {consumedLabel} {consumedItems.length > 0 ? consumedItems.length : ''}
            </Text>
          </Pressable>
        </View>

        <InteractionPersistenceNotice theme={theme} />

        {ranking.status === 'error' ? (
          <View style={styles.predictionNotice}>
            <Text accessibilityLiveRegion="polite" style={styles.predictionNoticeText}>
              {ranking.message}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry recommendations"
              onPress={ranking.retry}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryButtonText}>Yritä uudelleen</Text>
            </Pressable>
          </View>
        ) : null}

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.gridContent, items.length === 0 && styles.emptyGrid]}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {showConsumed
                ? itemType === 'BOOK'
                  ? 'Ei vielä luettuja kirjoja.'
                  : 'Ei vielä katsottuja elokuvia.'
                : itemType === 'BOOK'
                  ? 'Kaikki kirjat on jo merkitty luetuiksi.'
                  : 'Kaikki elokuvat on jo merkitty katsotuiksi.'}
            </Text>
          }
          renderItem={({ item, index }) => (
            <ItemCard
              item={item}
              index={index}
              interaction={getItemInteraction(interactions, item.id)}
              theme={theme}
              styles={styles}
              onOpen={() => openItem(item)}
            />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

interface ItemCardProps {
  item: Item;
  index: number;
  interaction: ItemInteraction;
  theme: RoomTheme;
  styles: ReturnType<typeof createStyles>;
  onOpen: () => void;
}

function ItemCard({
  item,
  index,
  interaction,
  theme,
  styles,
  onOpen,
}: ItemCardProps) {
  const tag = item.tags?.[0] ?? item.itemType.toLowerCase();
  const coverOpacity = 0.42 + (index % 3) * 0.12;
  const consumedLabel = getConsumedItemLabels(item.itemType).status;

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
        <View
          pointerEvents="none"
          style={[
            styles.coverLight,
            { backgroundColor: theme.ambient.windowLight, opacity: coverOpacity },
          ]}
        />
        <View style={styles.cardStatusRow}>
          {interaction.saved ? <Text style={styles.cardStatus}>★</Text> : <View />}
          {interaction.consumed ? <Text style={styles.cardStatus}>{consumedLabel}</Text> : null}
        </View>
        <Text style={styles.coverType}>{item.itemType === 'BOOK' ? 'KIRJA' : 'ELOKUVA'}</Text>
        <Text numberOfLines={3} style={styles.coverTitle}>
          {item.title}
        </Text>
      </View>
      <Text numberOfLines={2} style={styles.cardTitle}>
        {item.title}
      </Text>
      <Text numberOfLines={1} style={styles.cardTag}>
        {tag}
      </Text>
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

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.base.appBackground,
    },
    ambientBackdrop: {
      ...StyleSheet.absoluteFill,
    },
    screen: {
      flex: 1,
      paddingHorizontal: 18,
    },
    headerRow: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    backButton: {
      minHeight: 40,
      justifyContent: 'center',
      paddingRight: 12,
    },
    backText: {
      color: theme.base.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    kicker: {
      color: theme.base.textMuted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.8,
    },
    title: {
      color: theme.base.textPrimary,
      fontSize: 34,
      fontWeight: '600',
      marginTop: 8,
      marginBottom: 14,
    },
    collectionRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 18,
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
      gap: 12,
      marginBottom: 18,
    },
    card: {
      flex: 1,
      minWidth: 0,
    },
    cover: {
      aspectRatio: 0.72,
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    coverLight: {
      ...StyleSheet.absoluteFill,
    },
    cardStatusRow: {
      position: 'absolute',
      top: 10,
      left: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardStatus: {
      color: theme.base.textPrimary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
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
      color: theme.base.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '600',
      marginTop: 8,
    },
    cardTag: {
      color: theme.base.textMuted,
      fontSize: 11,
      marginTop: 3,
      textTransform: 'capitalize',
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
