import { CollectionGrid } from './CollectionGrid';
import { formatListEntryDate } from './listPresentation';
import { EMPTY_ITEM_INTERACTION } from '../discovery/itemInteraction';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ItemType } from '../../domain/contracts';
import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useDiscoveryMode } from '../discovery/DiscoveryModeContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { useItemLists } from './ItemListsContext';
import { useCollectionNavigation } from './useCollectionNavigation';
import { useItemInteractions } from '../discovery/ItemInteractionContext';
import type { ConsumedItem } from './itemListOperations';

export function ConsumedHistoryScreen({ itemType }: { itemType: ItemType }) {
  const { mode } = useDiscoveryMode();
  const profiles = useActiveProfile();
  const itemLists = useItemLists();
  const { loadConsumed } = itemLists;
  const openCollectionItem = useCollectionNavigation();
  const { interactions } = useItemInteractions();
  const theme = getRoomTheme(getAmbientPhase(mode), profiles.activeProfile);
  const styles = createStyles(theme);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    items: readonly ConsumedItem[];
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${itemLists.scopeKey}:${itemType}:${itemLists.revision}:${attempt}`;
  const loading = snapshot?.key !== requestKey;
  const error = snapshot?.key === requestKey ? snapshot.error : null;
  const items = snapshot?.key === requestKey ? snapshot.items : [];

  useEffect(() => {
    let active = true;
    void loadConsumed(itemType).then((result) => {
      if (!active) return;
      setSnapshot(result.status === 'success'
        ? { key: requestKey, items: result.items, error: null }
        : { key: requestKey, items: [], error: result.message });
    });
    return () => { active = false; };
  }, [itemType, loadConsumed, requestKey, interactions]);

  const title = itemType === 'BOOK' ? 'Luetut' : 'Katsotut';

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <StatusBar style="light" />
      <CollectionGrid theme={theme} refreshing={loading} onRefresh={() => setAttempt(current => current + 1)}
        entries={items.map(entry => ({ item: entry.item, caption: formatListEntryDate(entry.updatedAt),
          interaction: { ...EMPTY_ITEM_INTERACTION, saved: entry.saved, consumed: entry.consumed, rating: entry.rating } }))}
        onOpen={item => openCollectionItem(item, items.map(entry => entry.item), title)}
        header={<View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headingGroup}>
            <Text style={styles.kicker}>{profiles.activeProfile?.name ?? 'KAJO'}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>

        {loading ? <ActivityIndicator color={theme.base.textMuted} /> : null}
        {error ? (
          <View style={styles.notice}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => setAttempt((current) => current + 1)}><Text style={styles.link}>Yritä uudelleen</Text></Pressable>
          </View>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <Text style={styles.empty}>Ei vielä {title.toLowerCase()} kohteita.</Text>
        ) : null}

        </View>}
      />
    </SafeAreaView>
  );
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 18, paddingBottom: 12, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    backButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
    backText: { color: theme.base.textPrimary, fontSize: 34 },
    headingGroup: { flex: 1 },
    kicker: { color: theme.base.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
    title: { color: theme.base.textPrimary, fontSize: 28, fontWeight: '800' },
    notice: { gap: 6 },
    error: { color: '#f2a6a6', fontSize: 13 },
    link: { color: theme.ambient.curtainHighlight, fontWeight: '700' },
    empty: { color: theme.base.textMuted, paddingVertical: 28, textAlign: 'center' },
  });
}
