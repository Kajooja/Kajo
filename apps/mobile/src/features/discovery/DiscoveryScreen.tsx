import { useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Item, ItemType } from '../../domain/contracts';
import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useDiscoveryMode } from './DiscoveryModeContext';
import { useItemInteractions } from './ItemInteractionContext';
import {
  getConsumedItems,
  getDiscoverableItems,
  getItemInteraction,
  type ItemInteraction,
} from './itemInteraction';
import { getRankedMockItems } from './mockDiscovery';

interface DiscoveryScreenProps {
  itemType: ItemType;
  title: string;
}

export function DiscoveryScreen({ itemType, title }: DiscoveryScreenProps) {
  const { mode } = useDiscoveryMode();
  const { interactions } = useItemInteractions();
  const [showConsumed, setShowConsumed] = useState(false);
  const theme = getRoomTheme(getAmbientPhase(mode));
  const styles = createStyles(theme);
  const rankedItems = getRankedMockItems(itemType, mode);
  const consumedItems = getConsumedItems(rankedItems, interactions);
  const items = showConsumed
    ? consumedItems
    : getDiscoverableItems(rankedItems, interactions);
  const consumedLabel = itemType === 'BOOK' ? 'Luetut' : 'Katsotut';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.gridContent, items.length === 0 && styles.emptyGrid]}
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
}

function ItemCard({ item, index, interaction, theme, styles }: ItemCardProps) {
  const tag = item.tags?.[0] ?? item.itemType.toLowerCase();
  const coverOpacity = 0.42 + (index % 3) * 0.12;
  const consumedLabel = item.itemType === 'BOOK' ? 'LUETTU' : 'KATSOTTU';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      accessibilityHint="Opens swipe browsing and item details"
      onPress={() =>
        router.push({
          pathname: '/discovery/[itemId]',
          params: { itemId: item.id },
        })
      }
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
