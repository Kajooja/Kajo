import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAmbientPhase } from '../../domain/discovery';
import type { ItemListId } from '../../domain/contracts';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useDiscoveryMode } from '../discovery/DiscoveryModeContext';
import { useItemInteractions } from '../discovery/ItemInteractionContext';
import { useEventTracking } from '../events/EventTrackingContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { useItemLists } from './ItemListsContext';
import {
  MAXIMUM_ITEM_LIST_NAME_LENGTH,
  type ItemListEntry,
} from './itemListOperations';
import {
  formatListEntryDate,
  selectPresentedListEntries,
  type ItemListSort,
  type ItemListTypeFilter,
  type ItemListView,
} from './listPresentation';

interface ItemListScreenProps {
  listId: ItemListId;
}

export function ItemListScreen({ listId }: ItemListScreenProps) {
  const { mode } = useDiscoveryMode();
  const profiles = useActiveProfile();
  const itemLists = useItemLists();
  const { loadEntries } = itemLists;
  const interactions = useItemInteractions();
  const eventTracking = useEventTracking();
  const theme = getRoomTheme(getAmbientPhase(mode), profiles.activeProfile);
  const styles = createStyles(theme);
  const summary = itemLists.lists.find((list) => list.id === listId) ?? null;
  const [entrySnapshot, setEntrySnapshot] = useState<{
    key: string;
    entries: readonly ItemListEntry[];
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<ItemListTypeFilter>('ALL');
  const [sort, setSort] = useState<ItemListSort>('NEWEST');
  const [view, setView] = useState<ItemListView>('LIST');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestKey = `${listId}:${attempt}`;
  const loading = Boolean(listId) && entrySnapshot?.key !== requestKey;
  const loadError = !listId
    ? 'Listaa ei löytynyt.'
    : entrySnapshot?.key === requestKey
      ? entrySnapshot.error
      : null;
  const entries = useMemo(
    () => entrySnapshot?.key === requestKey ? entrySnapshot.entries : [],
    [entrySnapshot, requestKey],
  );

  useEffect(() => {
    if (!listId) return;
    let active = true;
    void loadEntries(listId).then((result) => {
      if (!active) return;
      setEntrySnapshot(result.status === 'success'
        ? { key: requestKey, entries: result.entries, error: null }
        : { key: requestKey, entries: [], error: result.message });
    });
    return () => { active = false; };
  }, [listId, loadEntries, requestKey]);

  const presentedEntries = useMemo(
    () => selectPresentedListEntries(entries, filter, sort),
    [entries, filter, sort],
  );

  async function removeEntry(entry: ItemListEntry) {
    if (saving) return;
    setSaving(true);
    setActionError(null);
    const result = await itemLists.setEntry(listId, entry.item.id, false);
    setSaving(false);
    if (result.status === 'error') {
      setActionError(result.message);
      return;
    }

    setEntrySnapshot((current) => current?.key === requestKey
      ? {
          ...current,
          entries: current.entries.filter((candidate) => candidate.item.id !== entry.item.id),
        }
      : current);
    eventTracking.recordEvent({
      eventType: entry.listKind === 'SYSTEM_SAVED'
        ? 'ITEM_UNSAVED'
        : 'ITEM_REMOVED_FROM_LIST',
      itemId: entry.item.id,
      itemType: entry.item.itemType,
      properties: {
        listId,
        listName: entry.listName,
        source: 'LIST_DETAIL',
      },
    });
    if (entry.listKind === 'SYSTEM_SAVED') interactions.retryHydration();
  }

  async function renameList() {
    if (saving || !summary || summary.kind !== 'CUSTOM') return;
    setSaving(true);
    setActionError(null);
    const result = await itemLists.renameList(listId, name);
    setSaving(false);
    if (result.status === 'error') {
      setActionError(result.message);
      return;
    }
    setName(result.list.name);
    setRenaming(false);
    eventTracking.recordEvent({
      eventType: 'LIST_RENAMED',
      properties: { listId, listName: result.list.name },
    });
  }

  function confirmDelete() {
    if (!summary || summary.kind !== 'CUSTOM') return;
    Alert.alert(
      'Poista lista',
      `Poistetaanko lista ${summary.name}? Listalla olevia kohteita tai reaktioita ei poisteta.`,
      [
        { text: 'Peruuta', style: 'cancel' },
        { text: 'Poista', style: 'destructive', onPress: () => void deleteList() },
      ],
    );
  }

  async function deleteList() {
    if (saving || !summary) return;
    setSaving(true);
    const result = await itemLists.deleteList(listId);
    setSaving(false);
    if (result.status === 'error') {
      setActionError(result.message);
      return;
    }
    eventTracking.recordEvent({
      eventType: 'LIST_DELETED',
      properties: { listId, listName: summary.name },
    });
    router.replace('/lists');
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headingGroup}>
            <Text style={styles.kicker}>{summary?.kind === 'SYSTEM_SAVED' ? 'TALLENNETUT' : 'LISTA'}</Text>
            <Text numberOfLines={2} style={styles.title}>{summary?.name ?? entries[0]?.listName ?? 'Lista'}</Text>
          </View>
        </View>

        {summary?.kind === 'CUSTOM' ? (
          <View style={styles.management}>
            {renaming ? (
              <View style={styles.renameRow}>
                <TextInput
                  accessibilityLabel="Listan uusi nimi"
                  maxLength={MAXIMUM_ITEM_LIST_NAME_LENGTH}
                  onChangeText={setName}
                  style={styles.input}
                  value={name}
                />
                <Pressable onPress={() => void renameList()} style={styles.smallButton}>
                  <Text style={styles.smallButtonText}>Tallenna</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.managementActions}>
                <Pressable onPress={() => {
                  setName(summary.name);
                  setRenaming(true);
                }}><Text style={styles.link}>Nimeä uudelleen</Text></Pressable>
                <Pressable onPress={confirmDelete}><Text style={styles.deleteLink}>Poista lista</Text></Pressable>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.controls}>
          <View style={styles.controlRow}>
            {(['ALL', 'BOOK', 'MOVIE'] as const).map((value) => (
              <ControlButton
                key={value}
                active={filter === value}
                label={value === 'ALL' ? 'Kaikki' : value === 'BOOK' ? 'Kirjat' : 'Elokuvat'}
                styles={styles}
                onPress={() => setFilter(value)}
              />
            ))}
          </View>
          <View style={styles.controlRow}>
            <ControlButton active={sort === 'NEWEST'} label="Uusimmat" styles={styles} onPress={() => setSort('NEWEST')} />
            <ControlButton active={sort === 'OLDEST'} label="Vanhimmat" styles={styles} onPress={() => setSort('OLDEST')} />
            <ControlButton active={view === 'LIST'} label="Lista" styles={styles} onPress={() => setView('LIST')} />
            <ControlButton active={view === 'GRID'} label="Kortit" styles={styles} onPress={() => setView('GRID')} />
          </View>
        </View>

        {loading ? <ActivityIndicator color={theme.base.textMuted} /> : null}
        {loadError ? (
          <View style={styles.notice}>
            <Text style={styles.error}>{loadError}</Text>
            <Pressable onPress={() => setAttempt((current) => current + 1)}><Text style={styles.link}>Yritä uudelleen</Text></Pressable>
          </View>
        ) : null}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

        {!loading && !loadError && presentedEntries.length === 0 ? (
          <Text style={styles.empty}>Tällä listalla ei ole vielä kohteita.</Text>
        ) : null}

        <View style={view === 'GRID' ? styles.grid : styles.list}>
          {presentedEntries.map((entry) => (
            <EntryCard
              key={entry.item.id}
              entry={entry}
              isShared={profiles.activeProfile?.type === 'SHARED'}
              grid={view === 'GRID'}
              styles={styles}
              onOpen={() => router.push({ pathname: '/discovery/[itemId]', params: { itemId: entry.item.id } })}
              onRemove={() => void removeEntry(entry)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ControlButton({ label, active, styles, onPress }: { label: string; active: boolean; styles: ReturnType<typeof createStyles>; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.controlButton, active && styles.controlButtonActive]}>
      <Text style={[styles.controlText, active && styles.controlTextActive]}>{label}</Text>
    </Pressable>
  );
}

function EntryCard({ entry, isShared, grid, styles, onOpen, onRemove }: { entry: ItemListEntry; isShared: boolean; grid: boolean; styles: ReturnType<typeof createStyles>; onOpen: () => void; onRemove: () => void }) {
  return (
    <View style={[styles.entry, grid && styles.gridEntry]}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.entryBody}>
        <Text style={styles.entryType}>{entry.item.itemType === 'BOOK' ? 'KIRJA' : 'ELOKUVA'}</Text>
        <Text numberOfLines={grid ? 3 : 2} style={styles.entryTitle}>{entry.item.title}</Text>
        <Text style={styles.entryMeta}>
          {entry.rating !== null ? `Arvosana ${entry.rating}/10 · ` : entry.consumed ? 'Kulutettu · ' : ''}
          {formatListEntryDate(entry.addedAt)}
        </Text>
        {isShared ? (
          <Text style={styles.provenance}>{entry.addedByNickname ? `${entry.addedByNickname} lisäsi` : 'Aiempi jäsen lisäsi'}</Text>
        ) : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Poista ${entry.item.title} listalta`} onPress={onRemove} style={styles.removeButton}>
        <Text style={styles.removeText}>Poista</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.base.appBackground },
    content: { padding: 20, paddingBottom: 44, gap: 18 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    backButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
    backText: { color: theme.base.textPrimary, fontSize: 34 },
    headingGroup: { flex: 1 },
    kicker: { color: theme.base.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
    title: { color: theme.base.textPrimary, fontSize: 27, fontWeight: '800' },
    management: { gap: 8 },
    managementActions: { flexDirection: 'row', justifyContent: 'space-between' },
    renameRow: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: theme.base.border, color: theme.base.textPrimary, backgroundColor: theme.base.sceneBackground },
    smallButton: { minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: theme.ambient.curtain },
    smallButtonText: { color: theme.base.textPrimary, fontWeight: '800' },
    link: { color: theme.ambient.curtainHighlight, fontSize: 13, fontWeight: '700' },
    deleteLink: { color: '#f2a6a6', fontSize: 13, fontWeight: '700' },
    controls: { gap: 8 },
    controlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    controlButton: { minHeight: 34, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.base.border },
    controlButtonActive: { backgroundColor: theme.ambient.curtain, borderColor: theme.ambient.curtainHighlight },
    controlText: { color: theme.base.textMuted, fontSize: 12, fontWeight: '700' },
    controlTextActive: { color: theme.base.textPrimary },
    notice: { gap: 6 },
    error: { color: '#f2a6a6', fontSize: 13 },
    empty: { color: theme.base.textMuted, paddingVertical: 28, textAlign: 'center' },
    list: { gap: 10 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    entry: { minHeight: 124, padding: 14, gap: 10, borderRadius: 15, borderWidth: 1, borderColor: theme.base.border, backgroundColor: theme.base.sceneBackground },
    gridEntry: { width: '48%', minHeight: 180 },
    entryBody: { flex: 1, gap: 4 },
    entryType: { color: theme.base.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
    entryTitle: { color: theme.base.textPrimary, fontSize: 16, fontWeight: '800' },
    entryMeta: { color: theme.base.textMuted, fontSize: 12, lineHeight: 17 },
    provenance: { color: theme.ambient.curtainHighlight, fontSize: 12, fontWeight: '700' },
    removeButton: { alignSelf: 'flex-start', paddingVertical: 4 },
    removeText: { color: '#f2a6a6', fontSize: 12, fontWeight: '700' },
  });
}
