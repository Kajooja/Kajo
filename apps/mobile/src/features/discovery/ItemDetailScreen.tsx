import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ItemId } from '../../domain/contracts';
import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useDiscoveryMode } from './DiscoveryModeContext';
import { getMockItem } from './mockDiscovery';

interface ItemDetailScreenProps {
  itemId: ItemId;
}

export function ItemDetailScreen({ itemId }: ItemDetailScreenProps) {
  const { mode } = useDiscoveryMode();
  const theme = getRoomTheme(getAmbientPhase(mode));
  const styles = createStyles(theme);
  const item = getMockItem(itemId);

  if (!item) {
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to discovery"
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>← Discovery</Text>
        </Pressable>

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

        <Text style={styles.note}>
          Tämä on Sprint 004:n paikallinen mock-Item. Oikea metadata ja suosituspisteytys tulevat myöhemmissä sprinteissä.
        </Text>
      </ScrollView>
    </SafeAreaView>
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
    content: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 32,
    },
    backButton: {
      minHeight: 44,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      paddingRight: 16,
      marginBottom: 10,
    },
    backText: {
      color: theme.base.textMuted,
      fontSize: 14,
      fontWeight: '600',
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
