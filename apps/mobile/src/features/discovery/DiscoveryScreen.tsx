import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DiscoveryMode, Item, ItemType } from '../../domain/contracts';
import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useDiscoveryMode } from './DiscoveryModeContext';
import { getRankedMockItems } from './mockDiscovery';

interface DiscoveryScreenProps {
  itemType: ItemType;
  title: string;
}

const MODE_LABELS: Readonly<Record<DiscoveryMode, string>> = {
  FOR_YOU: 'Sinulle',
  SURPRISE: 'Yllätys',
  RISK: 'Riski',
};

const DISCOVERY_MODES: readonly DiscoveryMode[] = ['FOR_YOU', 'SURPRISE', 'RISK'];

export function DiscoveryScreen({ itemType, title }: DiscoveryScreenProps) {
  const { mode, setMode } = useDiscoveryMode();
  const theme = getRoomTheme(getAmbientPhase(mode));
  const styles = createStyles(theme);
  const items = getRankedMockItems(itemType, mode);

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

        <View style={styles.modeRow} accessibilityLabel="Discovery mode">
          {DISCOVERY_MODES.map((discoveryMode) => {
            const selected = discoveryMode === mode;

            return (
              <Pressable
                key={discoveryMode}
                accessibilityRole="button"
                accessibilityLabel={`${MODE_LABELS[discoveryMode]} discovery mode`}
                accessibilityState={{ selected }}
                onPress={() => setMode(discoveryMode)}
                style={({ pressed }) => [
                  styles.modeButton,
                  selected && styles.modeButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.modeText, selected && styles.modeTextSelected]}>
                  {MODE_LABELS[discoveryMode]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item, index }) => (
            <ItemCard item={item} index={index} theme={theme} styles={styles} />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

interface ItemCardProps {
  item: Item;
  index: number;
  theme: RoomTheme;
  styles: ReturnType<typeof createStyles>;
}

function ItemCard({ item, index, theme, styles }: ItemCardProps) {
  const tag = item.tags?.[0] ?? item.itemType.toLowerCase();
  const coverOpacity = 0.42 + (index % 3) * 0.12;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      accessibilityHint="Opens item details"
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
      ...StyleSheet.absoluteFillObject,
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
    modeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 18,
    },
    modeButton: {
      minHeight: 40,
      flex: 1,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.base.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.base.floor,
    },
    modeButtonSelected: {
      borderColor: theme.ambient.curtainHighlight,
      backgroundColor: theme.ambient.curtain,
    },
    modeText: {
      color: theme.base.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    modeTextSelected: {
      color: theme.base.textPrimary,
    },
    gridContent: {
      paddingBottom: 24,
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
      ...StyleSheet.absoluteFillObject,
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
