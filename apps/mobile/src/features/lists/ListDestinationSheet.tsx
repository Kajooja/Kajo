import { useEventTracking } from '../events/EventTrackingContext';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import type { EventRecordInput } from '../events/eventTracking';
import { InteractionPersistenceNotice } from '../discovery/InteractionPersistenceNotice';
import {
  MAXIMUM_PROFILE_MESSAGE_LENGTH,
  validateProfileMessage,
} from '../messages/profileMessageOperations';
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
  message: string | null;
  stayOpen?: boolean;
}

interface ListDestinationSheetProps {
  visible: boolean;
  item: Item | null;
  isSharedProfile: boolean;
  theme: RoomTheme;
  origin?: EventRecordInput | undefined;
  onClose: () => void;
  onCommitted: (commit: ListDestinationCommit) => void;
}

export function ListDestinationSheet({
  visible,
  item,
  isSharedProfile,
  theme,
  origin,
  onClose,
  onCommitted,
}: ListDestinationSheetProps) {
  const { loadForItem, createList: createItemList, setEntry, scopeKey, revision } = useItemLists();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [availableLists, setAvailableLists] = useState<readonly ItemList[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [messageExpanded, setMessageExpanded] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [savingRequest, setSavingRequest] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedRequest, setLoadedRequest] = useState<object | null>(null);
  const [lastSaved, setLastSaved] = useState<{ request: object; commit: ListDestinationCommit } | null>(null);
  const activeSave = useRef<object | null>(null);
  const initializedRequest = useRef<object | null>(null);
  const { sessionId } = useEventTracking();
  const itemId = item?.id ?? null;
  const requestKey = itemId
    ? `${scopeKey}:${sessionId}:${itemId}:${isSharedProfile ? 'shared' : 'personal'}`
    : null;
  const requestToken = useMemo(() => ({ requestKey, visible }), [requestKey, visible]);
  const currentRequest = useRef<typeof requestToken | null>(requestToken);
  useLayoutEffect(() => {
    currentRequest.current = requestToken;
    return () => { currentRequest.current = null; };
  }, [requestToken]);
  const loading = visible && requestKey !== null && loadedRequest !== requestToken;
  const status = savingRequest === requestToken ? 'saving' : 'idle';
  function setStatus(next: 'idle' | 'saving') {
    setSavingRequest(next === 'saving' ? requestToken : null);
  }
  const visibleLists = selectVisibleListDestinations(availableLists, expanded);
  const hiddenCount = availableLists.length - visibleLists.length;

  useEffect(() => {
    if (!visible || !itemId || !requestKey) return;
    let active = true;

    void loadForItem(itemId).then((result) => {
      if (!active || currentRequest.current !== requestToken) return;
      if (initializedRequest.current !== requestToken) {
        initializedRequest.current = requestToken;
        setExpanded(false);
        setCreating(false);
        setNewListName('');
        setMessageExpanded(false);
        setMessageDraft('');
      }
      if (result.status === 'error') {
        setError(result.message);
        setAvailableLists([]);
        setLoadedRequest(requestToken);
        return;
      }

      const selectable = isSharedProfile
        ? result.lists.filter((list) => list.kind === 'CUSTOM')
        : result.lists;
      const profileId = result.lists[0]?.profileId;
      const recentListIds = profileId ? loadRecentListIds(profileId) : [];

      setAvailableLists(orderListDestinationsByRecentUse(selectable, recentListIds));
      setError(null);
      setLoadedRequest(requestToken);
    });

    return () => { active = false; };
  }, [isSharedProfile, itemId, loadForItem, requestKey, requestToken, revision, visible]);

  async function persistDestination(list: ItemList) {
    if (!item || !visible || currentRequest.current !== requestToken) return false;
    const messageValidation = messageDraft.trim().length > 0
      ? validateProfileMessage(messageDraft)
      : null;
    if (messageValidation?.status === 'invalid') {
      setError(messageValidation.message);
      return false;
    }

    if (!isSharedProfile) {
      const result = await setEntry(list.id, item.id, true, { positive: true, ...(origin ? { origin } : {}) });
      if (currentRequest.current !== requestToken) return false;
      if (result.status === 'error') {
        setError(result.message);
        return false;
      }
    }

    if (!isSharedProfile) {
      rememberRecentList(list.profileId, list.id);
    }

    const commit: ListDestinationCommit = {
      list,
      added: !list.containsItem,
      message: messageValidation?.status === 'valid' ? messageValidation.body : null,
      stayOpen: !isSharedProfile,
    };
    if (!isSharedProfile) {
      setLastSaved({ request: requestToken, commit });
      setAvailableLists(current => current.map(candidate => candidate.id === list.id
        ? { ...candidate, containsItem: true } : candidate));
      setMessageDraft('');
    }
    onCommitted(commit);
    return true;
  }

  async function chooseList(list: ItemList) {
    if (loading || status !== 'idle' || activeSave.current === requestToken || (!isSharedProfile && list.containsItem)) return;
    activeSave.current = requestToken;
    setStatus('saving');
    setError(null);
    await persistDestination(list);
    if (currentRequest.current !== requestToken) return;
    activeSave.current = null;
    setStatus('idle');
  }

  async function createAndChooseList() {
    if (!item || loading || status !== 'idle' || activeSave.current === requestToken) return;
    activeSave.current = requestToken;
    setStatus('saving');
    setError(null);

    const result = await createItemList(newListName, 'ITEM_DESTINATION_PICKER');
    if (currentRequest.current !== requestToken) return;
    if (result.status === 'error') {
      activeSave.current = null;
      setStatus('idle');
      setError(result.message);
      return;
    }

    const committed = await persistDestination(result.list);
    if (currentRequest.current !== requestToken) return;
    activeSave.current = null;
    setCreating(false);
    setNewListName('');
    if (!committed) {
      setAvailableLists((current) => [result.list, ...current.filter(list => list.id !== result.list.id)]);
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
          <InteractionPersistenceNotice theme={theme} />
          <View style={styles.header}>
            <View style={styles.headingGroup}>
              <Text style={styles.title}>{isSharedProfile ? 'Ehdota listaan' : 'Lisää listoille'}</Text>
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
          ) : <Text style={styles.helper}>Voit lisätä teoksen usealle listalle. Jokainen lisäys tallentuu heti. Jatka lopuksi painamalla Valmis.</Text>}

          {messageExpanded ? (
            <View style={styles.messageRow}>
              <TextInput
                accessibilityLabel="Listalisäyksen viesti"
                editable={!loading && status === 'idle'}
                maxLength={MAXIMUM_PROFILE_MESSAGE_LENGTH}
                onChangeText={(value) => {
                  setMessageDraft(value);
                  setError(null);
                }}
                placeholder="Lyhyt viesti (valinnainen)"
                placeholderTextColor={theme.base.textMuted}
                returnKeyType="done"
                style={styles.input}
                value={messageDraft}
              />
              <Text style={styles.messageCounter}>
                {messageDraft.length}/{MAXIMUM_PROFILE_MESSAGE_LENGTH}
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setMessageExpanded(true)}
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
            >
              <Text style={styles.textButtonText}>+ Lisää viesti</Text>
            </Pressable>
          )}

          {loading ? (
            <ActivityIndicator color={theme.base.textMuted} />
          ) : (
            <ScrollView style={styles.listArea}>
              {visibleLists.map((list) => (
                <Pressable
                  key={list.id}
                  accessibilityHint={isSharedProfile ? 'Ehdota kohdetta tähän yhteiseen listaan' : 'Tallentaa kohteen tähän listaan. Voit sen jälkeen valita toisen listan.'}
                  accessibilityRole="button"
                  disabled={status !== 'idle' || (!isSharedProfile && list.containsItem)}
                  onPress={() => void chooseList(list)}
                  style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
                >
                  <Text style={styles.listName} numberOfLines={1}>{list.name}</Text>
                  {list.containsItem ? <Text style={styles.existing}>Jo listalla</Text> : null}
                  <Text style={styles.addMark}>{list.containsItem ? '✓' : status === 'saving' ? '·' : '+'}</Text>
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
          {!isSharedProfile ? (
            <Pressable accessibilityRole="button" disabled={loading || status !== 'idle'}
              onPress={() => {
                if (activeSave.current === requestToken) return;
                if (lastSaved?.request === requestToken) {
                  onCommitted({ ...lastSaved.commit, message: null, stayOpen: false });
                } else onClose();
              }} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
              <Text style={styles.createButtonText}>{status === 'saving' ? 'Tallennetaan…' : 'Valmis'}</Text>
            </Pressable>
          ) : null}
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
      backgroundColor: theme.surface.panel,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headingGroup: { flex: 1, gap: 1 },
    title: { color: theme.base.textPrimary, fontSize: 18, fontWeight: '800' },
    itemTitle: { color: theme.base.textMuted, fontSize: 12 },
    closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    closeText: { color: theme.base.textPrimary, fontSize: 28, lineHeight: 30 },
    helper: { color: theme.base.textMuted, fontSize: 12, lineHeight: 17 },
    messageRow: { gap: 3 },
    messageCounter: { color: theme.base.textMuted, fontSize: 9, textAlign: 'right' },
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
      backgroundColor: theme.surface.raised,
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
      backgroundColor: theme.surface.raised,
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
