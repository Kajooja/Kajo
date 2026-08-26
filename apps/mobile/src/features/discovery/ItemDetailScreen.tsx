import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Item, ItemId } from '../../domain/contracts';
import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useDiscoveryMode } from './DiscoveryModeContext';
import { useItemInteractions } from './ItemInteractionContext';
import {
  buildSwipeSequence,
  getItemInteraction,
  type ItemInteraction,
  type ItemInterest,
} from './itemInteraction';
import { getMockItem, getRankedMockItems } from './mockDiscovery';

interface ItemDetailScreenProps {
  itemId: ItemId;
}

export function ItemDetailScreen({ itemId }: ItemDetailScreenProps) {
  const { width } = useWindowDimensions();
  const { mode } = useDiscoveryMode();
  const { interactions, setInterest, toggleSaved, setConsumed } = useItemInteractions();
  const theme = getRoomTheme(getAmbientPhase(mode));
  const styles = createStyles(theme);
  const selectedItem = getMockItem(itemId);
  const rankedItems = selectedItem ? getRankedMockItems(selectedItem.itemType, mode) : [];
  const items = selectedItem
    ? buildSwipeSequence(selectedItem, rankedItems, interactions)
    : [];

  if (!selectedItem) {
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
        <View style={styles.missing}>
          <Text style={styles.title}>Itemiä ei löytynyt</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to discovery"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Takaisin</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to discovery"
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>← Discovery</Text>
        </Pressable>
        {items.length > 1 ? <Text style={styles.swipeHint}>Pyyhkäise sivulle →</Text> : null}
      </View>

      <FlatList
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item }) => (
          <SwipeItemPage
            item={item}
            interaction={getItemInteraction(interactions, item.id)}
            pageWidth={width}
            theme={theme}
            styles={styles}
            onInterest={(interest) => setInterest(item.id, interest)}
            onToggleSaved={() => toggleSaved(item.id)}
            onSetConsumed={(consumed) => setConsumed(item.id, consumed)}
          />
        )}
      />
    </SafeAreaView>
  );
}

interface SwipeItemPageProps {
  item: Item;
  interaction: ItemInteraction;
  pageWidth: number;
  theme: RoomTheme;
  styles: ReturnType<typeof createStyles>;
  onInterest: (interest: ItemInterest | null) => void;
  onToggleSaved: () => void;
  onSetConsumed: (consumed: boolean) => void;
}

function SwipeItemPage({
  item,
  interaction,
  pageWidth,
  theme,
  styles,
  onInterest,
  onToggleSaved,
  onSetConsumed,
}: SwipeItemPageProps) {
  const consumedLabel = item.itemType === 'BOOK' ? 'Luettu' : 'Katsottu';
  const markConsumedLabel = item.itemType === 'BOOK' ? 'Merkitse luetuksi' : 'Merkitse katsotuksi';

  return (
    <ScrollView
      style={{ width: pageWidth }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.hero,
          {
            backgroundColor: theme.ambient.curtain,
            borderColor: theme.ambient.curtainHighlight,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.heroLight, { backgroundColor: theme.ambient.windowLight }]}
        />
        <View style={styles.heroStatusRow}>
          {interaction.saved ? <Text style={styles.heroStatus}>★ TALLENNETTU</Text> : <View />}
          {interaction.consumed ? <Text style={styles.heroStatus}>{consumedLabel.toUpperCase()}</Text> : null}
        </View>
        <Text style={styles.typeLabel}>{item.itemType === 'BOOK' ? 'KIRJA' : 'ELOKUVA'}</Text>
        <Text style={styles.heroTitle}>{item.title}</Text>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

      {item.tags?.length ? (
        <View style={styles.tags} accessibilityLabel="Item tags">
          {item.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions} accessibilityLabel="Item actions">
        <ActionButton
          label="Pidän"
          active={interaction.interest === 'LIKED'}
          theme={theme}
          styles={styles}
          onPress={() => onInterest(interaction.interest === 'LIKED' ? null : 'LIKED')}
        />
        <ActionButton
          label="Ei minulle"
          active={interaction.interest === 'DISLIKED'}
          theme={theme}
          styles={styles}
          onPress={() => onInterest(interaction.interest === 'DISLIKED' ? null : 'DISLIKED')}
        />
        <ActionButton
          label={interaction.saved ? 'Tallennettu' : 'Tallenna'}
          active={interaction.saved}
          theme={theme}
          styles={styles}
          onPress={onToggleSaved}
        />
        <ActionButton
          label={interaction.consumed ? consumedLabel : markConsumedLabel}
          active={interaction.consumed}
          theme={theme}
          styles={styles}
          onPress={() => onSetConsumed(!interaction.consumed)}
        />
      </View>

      <Text style={styles.note}>
        Tila on tässä sprintissä paikallinen ja muistissa vain sovelluksen ajon ajan. Backend-persistenssi ja tapahtumakirjaus lisätään myöhemmin.
      </Text>
    </ScrollView>
  );
}

interface ActionButtonProps {
  label: string;
  active: boolean;
  theme: RoomTheme;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}

function ActionButton({ label, active, theme, styles, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        active && {
          backgroundColor: theme.ambient.curtain,
          borderColor: theme.ambient.curtainHighlight,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.actionText, active && styles.actionTextActive]}>{label}</Text>
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
    topBar: {
      minHeight: 48,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingRight: 16,
    },
    backText: {
      color: theme.base.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    swipeHint: {
      color: theme.base.textMuted,
      fontSize: 11,
      fontWeight: '600',
      opacity: 0.78,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    hero: {
      minHeight: 310,
      borderRadius: 24,
      borderWidth: 1,
      overflow: 'hidden',
      padding: 22,
      justifyContent: 'flex-end',
      marginBottom: 22,
    },
    heroLight: {
      ...StyleSheet.absoluteFill,
      opacity: 0.36,
    },
    heroStatusRow: {
      position: 'absolute',
      top: 18,
      left: 18,
      right: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroStatus: {
      color: theme.base.textPrimary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
    },
    typeLabel: {
      color: theme.base.textPrimary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.6,
      marginBottom: 8,
    },
    heroTitle: {
      color: theme.base.textPrimary,
      fontSize: 34,
      lineHeight: 38,
      fontWeight: '700',
    },
    title: {
      color: theme.base.textPrimary,
      fontSize: 27,
      lineHeight: 32,
      fontWeight: '600',
    },
    description: {
      color: theme.base.textMuted,
      fontSize: 16,
      lineHeight: 24,
      marginTop: 12,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 20,
    },
    tag: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.base.floor,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    tagText: {
      color: theme.base.textMuted,
      fontSize: 12,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 24,
    },
    actionButton: {
      width: '48%',
      minHeight: 48,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.base.floor,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    actionText: {
      color: theme.base.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    actionTextActive: {
      color: theme.base.textPrimary,
    },
    note: {
      color: theme.base.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 28,
      opacity: 0.72,
    },
    missing: {
      flex: 1,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    },
    primaryButton: {
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: theme.ambient.curtain,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: theme.base.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
