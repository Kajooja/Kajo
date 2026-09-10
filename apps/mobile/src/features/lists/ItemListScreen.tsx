import { CollectionGrid } from './CollectionGrid';
import { formatListEntryDate } from './listPresentation';
import { EMPTY_ITEM_INTERACTION } from '../discovery/itemInteraction';
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import { InteractionPersistenceNotice } from '../discovery/InteractionPersistenceNotice';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { useItemLists } from './ItemListsContext';
import { useCollectionNavigation } from './useCollectionNavigation';
import {
  MAXIMUM_ITEM_LIST_NAME_LENGTH,
  type ItemListEntry,
} from './itemListOperations';
import {
  selectPresentedListEntries,
  type ItemListSort,
  type ItemListTypeFilter,
} from './listPresentation';

interface ItemListScreenProps {
  listId: ItemListId;
}

export function ItemListScreen(props: ItemListScreenProps) {
  const { scopeKey } = useItemLists();
  return <ItemListContent key={`${scopeKey}:${props.listId}`} {...props} />;
}

function ItemListContent({ listId }: ItemListScreenProps) {
  const { mode } = useDiscoveryMode();
  const profiles = useActiveProfile();
  const itemLists = useItemLists();
  const { loadEntries } = itemLists;
  const openCollectionItem = useCollectionNavigation();
  const theme = getRoomTheme(getAmbientPhase(mode), profiles.activeProfile);
  const styles = createStyles(theme);
  const summary = itemLists.lists.find((list) => list.id === listId) ?? null;
  const sharedSaved = profiles.activeProfile?.type === 'SHARED' && summary?.kind === 'SYSTEM_SAVED';
  const [entrySnapshot, setEntrySnapshot] = useState<{
    key: string;
    entries: readonly ItemListEntry[];
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<ItemListTypeFilter>('ALL');
  const [sort, setSort] = useState<ItemListSort>('NEWEST');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestKey = `${itemLists.scopeKey}:${listId}:${attempt}:${itemLists.revision}`;
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
    if (saving || !summary || sharedSaved) return;
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

    router.replace('/lists');
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <StatusBar style="light" />
      <InteractionPersistenceNotice theme={theme} />
      <CollectionGrid theme={theme} refreshing={loading} onRefresh={() => setAttempt(current => current + 1)}
        entries={presentedEntries.map(entry => ({ item: entry.item, caption: formatListEntryDate(entry.addedAt),
          interaction: { ...EMPTY_ITEM_INTERACTION, saved: entry.saved, consumed: entry.consumed, rating: entry.rating },
          provenance: profiles.activeProfile?.type === 'SHARED'
            ? entry.addedByNickname ? `${entry.addedByNickname} lisäsi` : 'Aiempi jäsen lisäsi' : null }))}
        onOpen={item => openCollectionItem(item, presentedEntries.map(entry => entry.item), summary?.name ?? 'Lista')}
        renderActions={item => !summary || sharedSaved ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel={`Poista ${item.title} listalta`} disabled={saving}
            onPress={() => { const entry = entries.find(candidate => candidate.item.id === item.id); if (entry) void removeEntry(entry); }}
            style={{ paddingHorizontal: 10, paddingVertical: 10 }}><Text style={styles.removeText}>Poista listalta</Text></Pressable>
        )}
        header={<View style={styles.content}>
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
        {sharedSaved ? (
          <Text style={styles.empty}>Tallennetut ovat ryhmän yhdessä hyväksymiä. Yhteisen tallennuksen poistaminen ei ole vielä käytettävissä.</Text>
        ) : null}

        {!loading && !loadError && presentedEntries.length === 0 ? (
          <Text style={styles.empty}>Tällä listalla ei ole vielä kohteita.</Text>
        ) : null}

        </View>}
      />
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

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 18, paddingBottom: 12, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    backButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
    backText: { color: theme.base.textPrimary, fontSize: 34 },
    headingGroup: { flex: 1 },
    kicker: { color: theme.base.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
    title: { color: theme.base.textPrimary, fontSize: 27, fontWeight: '800' },
    management: { gap: 8 },
    managementActions: { flexDirection: 'row', justifyContent: 'space-between' },
    renameRow: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: theme.base.border, color: theme.base.textPrimary, backgroundColor: theme.surface.panel },
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
    removeText: { color: '#f2a6a6', fontSize: 12, fontWeight: '700' },
  });
}
