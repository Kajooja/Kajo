import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { Item, ItemList, ItemListId } from '../../domain/contracts';
import type { RoomTheme } from '../../theme/roomTheme';
import { useEventTracking } from '../events/EventTrackingContext';
import { useItemLists } from './ItemListsContext';
import { MAXIMUM_ITEM_LIST_NAME_LENGTH } from './itemListOperations';
import { haveSelectableDestinationsChanged } from './listPresentation';

interface DestinationCommit {
  systemSaved: boolean;
  changed: boolean;
}

interface ListDestinationSheetProps {
  visible: boolean;
  item: Item | null;
  isSharedProfile: boolean;
  theme: RoomTheme;
  onClose: () => void;
  onCommitted: (commit: DestinationCommit) => void;
}

export function ListDestinationSheet({
  visible,
  item,
  isSharedProfile,
  theme,
  onClose,
  onCommitted,
}: ListDestinationSheetProps) {
  const itemLists = useItemLists();
  const { loadForItem, createList: createItemList, setDestinations } = itemLists;
  const eventTracking = useEventTracking();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [availableLists, setAvailableLists] = useState<readonly ItemList[]>([]);
  const [initialIds, setInitialIds] = useState<readonly ItemListId[]>([]);
  const [selectedIds, setSelectedIds] = useState<readonly ItemListId[]>([]);
  const [newListName, setNewListName] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const itemId = item?.id ?? null;
  const requestKey = itemId
    ? `${itemId}:${isSharedProfile ? 'shared' : 'personal'}`
    : null;
  const loading = visible && requestKey !== null && loadedKey !== requestKey;

  useEffect(() => {
    if (!visible || !itemId || !requestKey) return;
    let active = true;

    void loadForItem(itemId).then((result) => {
      if (!active) return;
      if (result.status === 'error') {
        setError(result.message);
        setAvailableLists([]);
        setInitialIds([]);
        setSelectedIds([]);
        setLoadedKey(requestKey);
        return;
      }

      const selectable = isSharedProfile
        ? result.lists.filter((list) => list.kind === 'CUSTOM')
        : result.lists;
      const existing = selectable
        .filter((list) => list.containsItem)
        .map((list) => list.id);
      const defaultSystemList = !isSharedProfile && existing.length === 0
        ? selectable.find((list) => list.kind === 'SYSTEM_SAVED')
        : null;
      const selected = defaultSystemList ? [defaultSystemList.id] : existing;

      setAvailableLists(selectable);
      setInitialIds(existing);
      setSelectedIds(selected);
      setError(null);
      setNewListName('');
      setLoadedKey(requestKey);
    });

    return () => { active = false; };
  }, [isSharedProfile, itemId, loadForItem, requestKey, visible]);

  function toggleList(listId: ItemListId) {
    setSelectedIds((current) => current.includes(listId)
      ? current.filter((id) => id !== listId)
      : [...current, listId]);
  }

  async function createList() {
    if (!item || loading || status !== 'idle') return;
    setStatus('saving');
    setError(null);
    const result = await createItemList(newListName);
    setStatus('idle');

    if (result.status === 'error') {
      setError(result.message);
      return;
    }

    setAvailableLists((current) => [...current, result.list]);
    setSelectedIds((current) => [...current, result.list.id]);
    setNewListName('');
    eventTracking.recordEvent({
      eventType: 'LIST_CREATED',
      properties: {
        listId: result.list.id,
        listName: result.list.name,
        source: 'ITEM_DESTINATION_PICKER',
      },
    });
  }

  async function saveDestinations() {
    if (!item || loading || status !== 'idle') return;
    setStatus('saving');
    setError(null);
    const result = await setDestinations(item.id, selectedIds);
    setStatus('idle');

    if (result.status === 'error') {
      setError(result.message);
      return;
    }

    const initial = new Set(initialIds);
    const current = new Set(result.commit.listIds);
    const customLists = availableLists.filter((list) => list.kind === 'CUSTOM');

    for (const list of customLists) {
      const wasSelected = initial.has(list.id);
      const isSelected = current.has(list.id);
      if (wasSelected === isSelected) continue;

      eventTracking.recordEvent({
        eventType: isSelected ? 'ITEM_ADDED_TO_LIST' : 'ITEM_REMOVED_FROM_LIST',
        itemId: item.id,
        itemType: item.itemType,
        properties: {
          listId: list.id,
          listName: list.name,
          source: 'ITEM_DESTINATION_PICKER',
        },
      });
    }

    const changed = haveSelectableDestinationsChanged(
      initialIds,
      result.commit.listIds,
      availableLists.map((list) => list.id),
    );
    onCommitted({ systemSaved: result.commit.systemSaved, changed });
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Sulje listavalinta"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headingGroup}>
              <Text style={styles.kicker}>{isSharedProfile ? 'YHTEINEN LISTA' : 'TALLENNA'}</Text>
              <Text numberOfLines={2} style={styles.title}>{item?.title ?? ''}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {isSharedProfile ? (
            <Text style={styles.helper}>
              Tallennetut syntyy yhteisestä tykkäyksestä. Tähän voit valita yhteisiä nimettyjä listoja.
            </Text>
          ) : null}

          {loading ? (
            <ActivityIndicator color={theme.base.textMuted} />
          ) : (
            <ScrollView style={styles.listArea}>
              {availableLists.map((list) => {
                const selected = selectedIds.includes(list.id);
                return (
                  <Pressable
                    key={list.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleList(list.id)}
                    style={({ pressed }) => [
                      styles.listRow,
                      selected && styles.listRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.check}>{selected ? '✓' : '○'}</Text>
                    <View style={styles.listTextGroup}>
                      <Text style={styles.listName}>{list.name}</Text>
                      <Text style={styles.listCount}>{list.itemCount} kohdetta</Text>
                    </View>
                  </Pressable>
                );
              })}
              {availableLists.length === 0 ? (
                <Text style={styles.empty}>Ei vielä nimettyjä listoja.</Text>
              ) : null}
            </ScrollView>
          )}

          <View style={styles.createRow}>
            <TextInput
              accessibilityLabel="Uuden listan nimi"
              editable={!loading && status === 'idle'}
              maxLength={MAXIMUM_ITEM_LIST_NAME_LENGTH}
              onChangeText={setNewListName}
              placeholder="Uusi lista"
              placeholderTextColor={theme.base.textMuted}
              style={styles.input}
              value={newListName}
            />
            <Pressable
              accessibilityRole="button"
              disabled={loading || status !== 'idle' || newListName.trim().length === 0}
              onPress={() => void createList()}
              style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
            >
              <Text style={styles.smallButtonText}>Luo</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={loading || status !== 'idle'}
            onPress={() => void saveDestinations()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>
              {status === 'saving' ? 'Tallennetaan…' : 'Tallenna valinnat'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.64)',
    },
    sheet: {
      maxHeight: '82%',
      padding: 20,
      paddingBottom: 28,
      gap: 14,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.base.sceneBackground,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    headingGroup: { flex: 1, gap: 3 },
    kicker: { color: theme.base.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
    title: { color: theme.base.textPrimary, fontSize: 21, fontWeight: '800' },
    closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    closeText: { color: theme.base.textPrimary, fontSize: 30, lineHeight: 32 },
    helper: { color: theme.base.textMuted, fontSize: 13, lineHeight: 19 },
    listArea: { maxHeight: 260 },
    listRow: {
      minHeight: 58,
      paddingHorizontal: 13,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.base.structure,
    },
    listRowSelected: { borderColor: theme.ambient.curtainHighlight },
    check: { width: 22, color: theme.ambient.curtainHighlight, fontSize: 20, fontWeight: '800' },
    listTextGroup: { flex: 1, gap: 2 },
    listName: { color: theme.base.textPrimary, fontSize: 15, fontWeight: '700' },
    listCount: { color: theme.base.textMuted, fontSize: 12 },
    empty: { paddingVertical: 18, color: theme.base.textMuted, textAlign: 'center' },
    createRow: { flexDirection: 'row', gap: 8 },
    input: {
      flex: 1,
      minHeight: 46,
      paddingHorizontal: 13,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.base.border,
      color: theme.base.textPrimary,
      backgroundColor: theme.base.structure,
    },
    smallButton: {
      minWidth: 64,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      backgroundColor: theme.ambient.curtain,
    },
    smallButtonText: { color: theme.base.textPrimary, fontWeight: '800' },
    error: { color: '#f2a6a6', fontSize: 13 },
    primaryButton: {
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      backgroundColor: theme.ambient.curtain,
    },
    primaryButtonText: { color: theme.base.textPrimary, fontSize: 15, fontWeight: '800' },
    pressed: { opacity: 0.72 },
  });
}
