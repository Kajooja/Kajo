import { useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useDiscoveryMode } from '../discovery/DiscoveryModeContext';
import { useEventTracking } from '../events/EventTrackingContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { useItemLists } from './ItemListsContext';
import { MAXIMUM_ITEM_LIST_NAME_LENGTH } from './itemListOperations';
import { ITEM_LIST_LABELS } from './itemListLabels';
import { rememberRecentList } from './listRecentUse';

export function ListsScreen() {
  const { mode } = useDiscoveryMode();
  const profiles = useActiveProfile();
  const itemLists = useItemLists();
  const eventTracking = useEventTracking();
  const theme = getRoomTheme(getAmbientPhase(mode), profiles.activeProfile);
  const styles = createStyles(theme);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function createList() {
    if (creating) return;
    setCreating(true);
    setActionError(null);
    const result = await itemLists.createList(newListName);
    setCreating(false);

    if (result.status === 'error') {
      setActionError(result.message);
      return;
    }

    setNewListName('');
    eventTracking.recordEvent({
      eventType: 'LIST_CREATED',
      properties: {
        listId: result.list.id,
        listName: result.list.name,
        source: 'LISTS_HOME',
      },
    });
  }

  function openList(listId: string) {
    const list = itemLists.lists.find((candidate) => candidate.id === listId);
    if (list?.kind === 'CUSTOM') {
      rememberRecentList(list.profileId, list.id);
    }
    router.push({ pathname: '/lists/[listId]', params: { listId } });
  }

  function openHistory(itemType: 'BOOK' | 'MOVIE') {
    router.push({ pathname: '/lists/history', params: { itemType } });
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headingGroup}>
            <Text style={styles.kicker}>{profiles.activeProfile?.name ?? 'KAJO'}</Text>
            <Text style={styles.title}>{ITEM_LIST_LABELS.lists}</Text>
          </View>
        </View>

        {itemLists.status === 'loading' ? (
          <ActivityIndicator color={theme.base.textMuted} />
        ) : null}

        {itemLists.error ? (
          <View style={styles.notice}>
            <Text style={styles.error}>{itemLists.error}</Text>
            <Pressable accessibilityRole="button" onPress={itemLists.refresh}>
              <Text style={styles.link}>Yritä uudelleen</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{ITEM_LIST_LABELS.saved}</Text>
          {itemLists.lists
            .filter((list) => list.kind === 'SYSTEM_SAVED')
            .map((list) => (
              <ListRow
                key={list.id}
                label={list.name}
                count={list.itemCount}
                symbol="★"
                styles={styles}
                onPress={() => openList(list.id)}
              />
            ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historia</Text>
          <ListRow label="Luetut" symbol="B" styles={styles} onPress={() => openHistory('BOOK')} />
          <ListRow label="Katsotut" symbol="M" styles={styles} onPress={() => openHistory('MOVIE')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Omat listat</Text>
          {itemLists.lists
            .filter((list) => list.kind === 'CUSTOM')
            .map((list) => (
              <ListRow
                key={list.id}
                label={list.name}
                count={list.itemCount}
                symbol="+"
                styles={styles}
                onPress={() => openList(list.id)}
              />
            ))}
          {itemLists.lists.every((list) => list.kind !== 'CUSTOM') ? (
            <Text style={styles.empty}>Ei vielä nimettyjä listoja.</Text>
          ) : null}

          <View style={styles.createRow}>
            <TextInput
              accessibilityLabel="Uuden listan nimi"
              editable={!creating && itemLists.status === 'ready'}
              maxLength={MAXIMUM_ITEM_LIST_NAME_LENGTH}
              onChangeText={setNewListName}
              placeholder="Uusi lista"
              placeholderTextColor={theme.base.textMuted}
              style={styles.input}
              value={newListName}
            />
            <Pressable
              accessibilityRole="button"
              disabled={creating || newListName.trim().length === 0}
              onPress={() => void createList()}
              style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
            >
              <Text style={styles.createButtonText}>{creating ? '…' : 'Luo'}</Text>
            </Pressable>
          </View>
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface ListRowProps {
  label: string;
  count?: number;
  symbol: string;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}

function ListRow({ label, count, symbol, styles, onPress }: ListRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Avaa lista ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.symbol}><Text style={styles.symbolText}>{symbol}</Text></View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{label}</Text>
        {typeof count === 'number' ? <Text style={styles.rowCount}>{count} kohdetta</Text> : null}
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 20, paddingBottom: 42, gap: 24 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    backButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
    backText: { color: theme.base.textPrimary, fontSize: 34, lineHeight: 38 },
    headingGroup: { flex: 1 },
    kicker: { color: theme.base.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
    title: { color: theme.base.textPrimary, fontSize: 30, fontWeight: '800' },
    section: { gap: 10 },
    sectionTitle: { color: theme.base.textPrimary, fontSize: 17, fontWeight: '800' },
    row: {
      minHeight: 68,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.surface.panel,
    },
    symbol: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      backgroundColor: theme.surface.raised,
    },
    symbolText: { color: theme.ambient.curtainHighlight, fontSize: 16, fontWeight: '900' },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { color: theme.base.textPrimary, fontSize: 16, fontWeight: '700' },
    rowCount: { color: theme.base.textMuted, fontSize: 12 },
    arrow: { color: theme.base.textMuted, fontSize: 28 },
    empty: { color: theme.base.textMuted, fontSize: 13 },
    createRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    input: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.base.border,
      color: theme.base.textPrimary,
      backgroundColor: theme.surface.panel,
    },
    createButton: {
      minWidth: 72,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: theme.ambient.curtain,
    },
    createButtonText: { color: theme.base.textPrimary, fontWeight: '800' },
    notice: { gap: 6 },
    error: { color: '#f2a6a6', fontSize: 13 },
    link: { color: theme.ambient.curtainHighlight, fontWeight: '700' },
    pressed: { opacity: 0.72 },
  });
}
