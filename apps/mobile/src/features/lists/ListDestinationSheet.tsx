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

import type { Item, ItemList } from '../../domain/contracts';
import type { RoomTheme } from '../../theme/roomTheme';
import { useEventTracking } from '../events/EventTrackingContext';
import { useItemLists } from './ItemListsContext';
import { MAXIMUM_ITEM_LIST_NAME_LENGTH } from './itemListOperations';
import { loadRecentListIds, rememberRecentList } from './listRecentUse';
import {
  orderListDestinationsByRecentUse,
  selectVisibleListDestinations,
} from './listPresentation';

export interface ListDestinationCommit {
  list: ItemList;
  added: boolean;
}

interface ListDestinationSheetProps {
  visible: boolean;
  item: Item | null;
  isSharedProfile: boolean;
  theme: RoomTheme;
  onClose: () => void;
  onCommitted: (commit: ListDestinationCommit) => void;
}

export function ListDestinationSheet({
  visible,
  item,
  isSharedProfile,
  theme,
  onClose,
  onCommitted,
}: ListDestinationSheetProps) {
  const { loadForItem, createList: createItemList, setEntry } = useItemLists();
  const eventTracking = useEventTracking();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [availableLists, setAvailableLists] = useState<readonly ItemList[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const itemId = item?.id ?? null;
  const requestKey = itemId
    ? `${itemId}:${isSharedProfile ? 'shared' : 'personal'}`
    : null;
  const loading = visible && requestKey !== null && loadedKey !== requestKey;
  const visibleLists = selectVisibleListDestinations(availableLists, expanded);
  const hiddenCount = availableLists.length - visibleLists.length;

  useEffect(() => {
    if (!visible || !itemId || !requestKey) return;
    let active = true;

    void loadForItem(itemId).then((result) => {
      if (!active) return;
      setExpanded(false);
      setCreating(false);
      setNewListName('');
      if (result.status === 'error') {
        setError(result.message);
        setAvailableLists([]);
        setLoadedKey(requestKey);
        return;
      }

      const selectable = isSharedProfile
        ? result.lists.filter((list) => list.kind === 'CUSTOM')
        : result.lists;
      const profileId = result.lists[0]?.profileId;
      const recentListIds = profileId ? loadRecentListIds(profileId) : [];

      setAvailableLists(orderListDestinationsByRecentUse(selectable, recentListIds));
      setError(null);
      setLoadedKey(requestKey);
    });

    return () => { active = false; };
  }, [isSharedProfile, itemId, loadForItem, requestKey, visible]);

  async function persistDestination(list: ItemList) {
    if (!item) return false;

    const result = await setEntry(list.id, item.id, true);
    if (result.status === 'error') {
      setError(result.message);
      return false;
    }

    rememberRecentList(list.profileId, list.id);

    if (list.kind === 'CUSTOM' && !list.containsItem) {
      eventTracking.recordEvent({
        eventType: 'ITEM_ADDED_TO_LIST',
        itemId: item.id,
        itemType: item.itemType,
        properties: {
          listId: list.id,
          listName: list.name,
          source: 'ITEM_DESTINATION_PICKER',
        },
      });
    }

    onCommitted({ list, added: !list.containsItem });
    return true;
  }

  async function chooseList(list: ItemList) {
    if (loading || status !== 'idle') return;
    setStatus('saving');
    setError(null);
    await persistDestination(list);
    setStatus('idle');
  }

  async function createAndChooseList() {
    if (!item || loading || status !== 'idle') return;
    setStatus('saving');
    setError(null);

    const result = await createItemList(newListName);
    if (result.status === 'error') {
      setStatus('idle');
      setError(result.message);
      return;
    }

    eventTracking.recordEvent({
      eventType: 'LIST_CREATED',
      properties: {
        listId: result.list.id,
        listName: result.list.name,
        source: 'ITEM_DESTINATION_PICKER',
      },
    });

    const committed = await persistDestination(result.list);
    if (!committed) {
      setAvailableLists((current) => [result.list, ...current]);
    }
    setStatus('idle');
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
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
              <Text style={styles.title}>Lisää listaan</Text>
              <Text numberOfLines={1} style={styles.itemTitle}>{item?.title ?? ''}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {isSharedProfile ? (
            <Text style={styles.helper}>
              Valinta on samalla tykkäyksesi. Tallennetut syntyy yhteisestä päätöksestä.
            </Text>
          ) : null}

          {loading ? (
            <ActivityIndicator color={theme.base.textMuted} />
          ) : (
            <ScrollView style={styles.listArea}>
              {visibleLists.map((list) => (
                <Pressable
                  key={list.id}
                  accessibilityHint="Lisää kohteen tähän listaan ja siirry seuraavaan korttiin"
                  accessibilityRole="button"
                  disabled={status !== 'idle'}
                  onPress={() => void chooseList(list)}
                  style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
                >
                  <Text style={styles.listName} numberOfLines={1}>{list.name}</Text>
                  {list.containsItem ? <Text style={styles.existing}>Jo listalla</Text> : null}
                  <Text style={styles.addMark}>{status === 'saving' ? '·' : '+'}</Text>
                </Pressable>
              ))}
              {availableLists.length === 0 ? (
                <Text style={styles.empty}>Ei vielä nimettyjä listoja.</Text>
              ) : null}
            </ScrollView>
          )}

          {hiddenCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setExpanded(true)}
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
            >
              <Text style={styles.textButtonText}>Lisää ({hiddenCount})</Text>
            </Pressable>
          ) : null}

          {creating ? (
            <View style={styles.createRow}>
              <TextInput
                accessibilityLabel="Uuden listan nimi"
                autoFocus
                editable={!loading && status === 'idle'}
                maxLength={MAXIMUM_ITEM_LIST_NAME_LENGTH}
                onChangeText={setNewListName}
                onSubmitEditing={() => void createAndChooseList()}
                placeholder="Uuden listan nimi"
                placeholderTextColor={theme.base.textMuted}
                returnKeyType="done"
                style={styles.input}
                value={newListName}
              />
              <Pressable
                accessibilityRole="button"
                disabled={loading || status !== 'idle' || newListName.trim().length === 0}
                onPress={() => void createAndChooseList()}
                style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
              >
                <Text style={styles.createButtonText}>Luo</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setCreating(true)}
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
            >
              <Text style={styles.textButtonText}>+ Uusi lista</Text>
            </Pressable>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
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
      backgroundColor: 'rgba(0,0,0,0.52)',
    },
    sheet: {
      maxHeight: '72%',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 20,
      gap: 9,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.base.sceneBackground,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headingGroup: { flex: 1, gap: 1 },
    title: { color: theme.base.textPrimary, fontSize: 18, fontWeight: '800' },
    itemTitle: { color: theme.base.textMuted, fontSize: 12 },
    closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    closeText: { color: theme.base.textPrimary, fontSize: 28, lineHeight: 30 },
    helper: { color: theme.base.textMuted, fontSize: 12, lineHeight: 17 },
    listArea: { maxHeight: 250 },
    listRow: {
      minHeight: 44,
      paddingHorizontal: 12,
      marginBottom: 5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.base.structure,
    },
    listName: { flex: 1, color: theme.base.textPrimary, fontSize: 14, fontWeight: '700' },
    existing: { color: theme.base.textMuted, fontSize: 11 },
    addMark: { width: 18, color: theme.ambient.curtainHighlight, fontSize: 20, fontWeight: '800' },
    empty: { paddingVertical: 8, color: theme.base.textMuted, fontSize: 13, textAlign: 'center' },
    textButton: { minHeight: 34, alignItems: 'flex-start', justifyContent: 'center' },
    textButtonText: { color: theme.ambient.curtainHighlight, fontSize: 13, fontWeight: '800' },
    createRow: { flexDirection: 'row', gap: 7 },
    input: {
      flex: 1,
      minHeight: 42,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.base.border,
      color: theme.base.textPrimary,
      backgroundColor: theme.base.structure,
    },
    createButton: {
      minWidth: 58,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: theme.ambient.curtain,
    },
    createButtonText: { color: theme.base.textPrimary, fontWeight: '800' },
    error: { color: '#f2a6a6', fontSize: 12 },
    pressed: { opacity: 0.7 },
  });
}
