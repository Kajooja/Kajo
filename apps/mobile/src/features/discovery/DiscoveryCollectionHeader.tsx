import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ItemType } from '../../domain/contracts';
import type { RoomTheme } from '../../theme/roomTheme';
import { getConsumedItemLabels } from './itemInteractionLabels';

interface DiscoveryCollectionHeaderProps {
  itemType: ItemType;
  title: string;
  theme: RoomTheme;
}

const CATEGORIES = [
  { itemType: 'MOVIE', label: 'Elokuvat', route: '/discovery/movies' },
  { itemType: 'BOOK', label: 'Kirjat', route: '/discovery/books' },
] as const;

export function DiscoveryCollectionHeader({ itemType, title, theme }: DiscoveryCollectionHeaderProps) {
  // An old route's expanded selector must not follow the reader into a new domain.
  const [expandedItemType, setExpandedItemType] = useState<ItemType | null>(null);
  const expanded = expandedItemType === itemType;
  const consumedLabel = getConsumedItemLabels(itemType).history;

  function selectCategory(category: typeof CATEGORIES[number]) {
    setExpandedItemType(null);
    if (category.itemType !== itemType) router.replace(category.route);
  }

  return (
    <View>
      <View style={styles.row} accessibilityLabel="Sisältölaji ja kokoelma">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Vaihda sisältölajia. Valittu ${title}.`}
          accessibilityState={{ expanded }}
          onPress={() => setExpandedItemType(expanded ? null : itemType)}
          style={({ pressed }) => [styles.categoryButton, pressed && styles.pressed]}
        >
          <Text style={[styles.title, { color: theme.base.textPrimary }]}>{title}</Text>
          <Text accessibilityElementsHidden importantForAccessibility="no"
            style={[styles.arrow, { color: theme.base.textMuted }]}>{expanded ? '▴' : '▾'}</Text>
        </Pressable>
        <View style={styles.collections}>
          <Pressable accessibilityRole="button" accessibilityLabel="Löydä. Valittu näkymä."
            accessibilityState={{ selected: true }}
            onPress={() => setExpandedItemType(null)}
            style={[styles.collectionButton, { borderBottomColor: theme.ambient.curtainHighlight }]}>
            <Text style={[styles.collectionText, { color: theme.base.textPrimary }]}>Löydä</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Avaa ${consumedLabel.toLowerCase()}`}
            accessibilityState={{ selected: false }}
            onPress={() => {
              setExpandedItemType(null);
              router.push({ pathname: '/lists/history', params: { itemType } });
            }}
            style={({ pressed }) => [styles.collectionButton, pressed && styles.pressed]}
          >
            <Text style={[styles.collectionText, { color: theme.base.textMuted }]}>{consumedLabel}</Text>
          </Pressable>
        </View>
      </View>
      {expanded ? (
        <View style={[styles.categoryMenu, { backgroundColor: theme.surface.panel, borderColor: theme.base.border }]}>
          {CATEGORIES.map(category => (
            <Pressable key={category.itemType} accessibilityRole="button"
              accessibilityLabel={`Valitse ${category.label.toLowerCase()}`}
              accessibilityState={{ selected: category.itemType === itemType }}
              onPress={() => selectCategory(category)}
              style={({ pressed }) => [styles.menuOption, pressed && styles.pressed]}>
              <Text style={[styles.collectionText, { color: category.itemType === itemType
                ? theme.base.textPrimary : theme.base.textMuted }]}>{category.label}</Text>
              {category.itemType === itemType ? <Text style={{ color: theme.base.textPrimary }}>✓</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12 },
  categoryButton: { minHeight: 44, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 2 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '700', flexShrink: 1 },
  arrow: { fontSize: 12 },
  collections: { maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  collectionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: 'transparent' },
  collectionText: { fontSize: 13, fontWeight: '600' },
  categoryMenu: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, marginBottom: 4 },
  menuOption: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pressed: { opacity: 0.78 },
});
