import { useEventTracking } from '../events/EventTrackingContext';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
import { useItemInteractions } from '../discovery/ItemInteractionContext';
import { DOCK_PANEL_GAP } from '../discovery/shellLayout';
import {
  MAXIMUM_PROFILE_MESSAGE_LENGTH,
  validateProfileMessage,
} from '../messages/profileMessageOperations';
import { useItemLists } from './ItemListsContext';
import { MAXIMUM_ITEM_LIST_NAME_LENGTH } from './itemListOperations';
import { loadRecentListIds, rememberRecentList } from './listRecentUse';
import { commitPersonalListDestinations, includeCreatedDestination, resolveListDestinations, toggleListDestination,
  type ListDestinationCommit, type ListDestinationCommitResult } from './listDestinationSelection';
import {
  orderListDestinationsByRecentUse,
  selectVisibleListDestinations,
} from './listPresentation';

export type { ListDestinationCommit, ListDestinationCommitResult } from './listDestinationSelection';

interface ListDestinationSheetProps {
  visible: boolean;
  item: Item | null;
  isSharedProfile: boolean;
  theme: RoomTheme;
  origin?: EventRecordInput | undefined;
  onClose: () => void;
  onCommitted: (commit: ListDestinationCommit) => Promise<ListDestinationCommitResult>;
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
  const { atomicPendingCount } = useItemInteractions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [availableLists, setAvailableLists] = useState<readonly ItemList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<readonly string[] | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const viewportRef = useRef<View>(null);
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [messageExpanded, setMessageExpanded] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [savingRequest, setSavingRequest] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedRequest, setLoadedRequest] = useState<object | null>(null);
  const [saveProgress, setSaveProgress] = useState<{ request: object; completed: number; total: number } | null>(null);
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
  const selectedLists = loading ? [] : resolveListDestinations(availableLists, selectedListIds, isSharedProfile);
  const hasSelection = selectedLists.length > 0;
  const savingBlocked = status !== 'idle' || atomicPendingCount > 0;

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeSave.current === requestToken) return true;
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, requestToken, visible]);

  useEffect(() => {
    if (!visible || !itemId || !requestKey || status === 'saving') return;
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
        setSelectedListIds(null);
        setError(null);
        setLoadError(null);
      }
      if (result.status === 'error') {
        setLoadError(result.message);
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
      setLoadError(null);
      setLoadedRequest(requestToken);
    });

    return () => { active = false; };
  }, [isSharedProfile, itemId, loadForItem, requestKey, requestToken, revision, status, visible]);

  async function chooseLists() {
    if (!item || !visible || currentRequest.current !== requestToken || loading
      || savingBlocked || activeSave.current === requestToken || !hasSelection) return;
    const messageValidation = messageDraft.trim().length > 0 ? validateProfileMessage(messageDraft) : null;
    if (messageValidation?.status === 'invalid') { setError(messageValidation.message); return; }
    const message = messageValidation?.status === 'valid' ? messageValidation.body : null;
    const destinations = [...selectedLists];
    // Freeze this explicit selection before any receipt refresh changes ordering.
    setSelectedListIds(destinations.map(list => list.id));
    activeSave.current = requestToken;
    setStatus('saving');
    setSaveProgress(isSharedProfile ? null : { request: requestToken, completed: 0, total: destinations.length });
    setError(null);
    Keyboard.dismiss();
    try {
      const result = isSharedProfile
        ? await onCommitted({ lists: destinations, message, added: destinations.some(list => !list.containsItem) })
        : await commitPersonalListDestinations({
            lists: destinations, message,
            isCurrent: () => currentRequest.current === requestToken,
            save: list => setEntry(list.id, item.id, true, { positive: true, ...(origin ? { origin } : {}) }),
            onSaved: (list, completed) => {
              rememberRecentList(list.profileId, list.id);
              setAvailableLists(current => current.map(candidate => candidate.id === list.id
                ? { ...candidate, containsItem: true } : candidate));
              setSelectedListIds(current => (current ?? []).filter(id => id !== list.id));
              setSaveProgress({ request: requestToken, completed, total: destinations.length });
            },
            onCommitted,
          });
      if (currentRequest.current !== requestToken) return;
      if (result.status === 'error') setError(result.message);
      else { setMessageDraft(''); if (result.notice) setError(result.notice); }
    } catch {
      if (currentRequest.current === requestToken) setError('Kaikkien lisäysten tilaa ei voitu varmistaa. Tarkista tallennuksen tila ennen jatkamista.');
    } finally {
      if (currentRequest.current === requestToken) {
        activeSave.current = null;
        setStatus('idle');
        setSaveProgress(null);
      }
    }
  }

  async function createDestination() {
    if (!item || loading || savingBlocked || selectedLists.length >= 32 || activeSave.current === requestToken) return;
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

    // Creating the container is separate from explicitly adding the Item.
    setAvailableLists(current => includeCreatedDestination(current, result.list));
    setSelectedListIds([...new Set([...selectedLists.map(list => list.id), result.list.id])]);
    activeSave.current = null;
    setCreating(false);
    setNewListName('');
    setStatus('idle');
    Keyboard.dismiss();
  }

  if (!visible) return null;

  return (
    // This route fills the shell content above the dock, exactly like Inbox.
    // A separate Android Modal uses a different window/system-navigation origin.
    <KeyboardAvoidingView accessibilityViewIsModal
      keyboardVerticalOffset={keyboardOffset}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardArea}>
      <View ref={viewportRef} collapsable={false} style={styles.backdrop}
        onLayout={() => {
          // Keyboard coordinates include the persistent header above this route.
          viewportRef.current?.measureInWindow((_x, y) => setKeyboardOffset(y));
        }}>
        <Pressable
          accessibilityLabel="Sulje listavalinta"
          accessibilityRole="button"
          disabled={status !== 'idle'}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          <InteractionPersistenceNotice theme={theme} />
          <View style={styles.header}>
            <View style={styles.headingGroup}>
              <Text style={styles.title}>{isSharedProfile ? 'Ehdota listoille' : 'Lisää listoille'}</Text>
              <Text numberOfLines={1} style={styles.itemTitle}>{item?.title ?? ''}</Text>
            </View>
            <Pressable accessibilityRole="button" disabled={status !== 'idle'} onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          {isSharedProfile ? (
            <Text style={styles.helper}>
              Valitse yksi tai useampi lista ja vahvista ehdotus. Muut hyväksyvät samat listat ennen tallennusta.
            </Text>
          ) : <Text style={styles.helper}>Valitse yksi tai useampi lista. Lisää valituille listoille tallentaa valinnan ja siirtää seuraavaan korttiin.</Text>}

          {messageExpanded ? (
            <View style={styles.messageRow}>
              <TextInput
                accessibilityLabel="Listalisäyksen viesti"
                editable={hasSelection && status === 'idle'}
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
              accessibilityState={{ disabled: !hasSelection || status !== 'idle' }}
              disabled={!hasSelection || status !== 'idle'}
              onPress={() => setMessageExpanded(true)}
              style={({ pressed }) => [styles.textButton, !hasSelection && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.textButtonText}>+ Lisää viesti</Text>
            </Pressable>
          )}
          {!hasSelection && !loading ? <Text style={styles.helper}>
            {availableLists.length === 0 ? 'Luo ensin lista.' : 'Valitse ensin lista.'}
          </Text> : null}

          {loading ? (
            <ActivityIndicator color={theme.base.textMuted} />
          ) : (
            <View>
              {visibleLists.map((list) => (
                <Pressable
                  key={list.id}
                  accessibilityHint="Valitsee kohteen. Vahvista lisäys alareunan painikkeella."
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selectedLists.some(selected => selected.id === list.id), disabled: status !== 'idle' || (!isSharedProfile && list.containsItem)
                    || (selectedLists.length >= 32 && !selectedLists.some(selected => selected.id === list.id)) }}
                  disabled={status !== 'idle' || (!isSharedProfile && list.containsItem)
                    || (selectedLists.length >= 32 && !selectedLists.some(selected => selected.id === list.id))}
                  onPress={() => setSelectedListIds(toggleListDestination(selectedLists.map(selected => selected.id), list.id))}
                  style={({ pressed }) => [styles.listRow, selectedLists.some(selected => selected.id === list.id) && styles.selectedRow, pressed && styles.pressed]}
                >
                  <Text style={styles.listName} numberOfLines={1}>{list.name}</Text>
                  {list.containsItem ? <Text style={styles.existing}>Jo listalla</Text> : null}
                  <Text style={styles.addMark}>{(!isSharedProfile && list.containsItem) || selectedLists.some(selected => selected.id === list.id) ? '☑' : '☐'}</Text>
                </Pressable>
              ))}
              {availableLists.length === 0 ? (
                <Text style={styles.empty}>Ei vielä nimettyjä listoja.</Text>
              ) : null}
            </View>
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
                onSubmitEditing={() => void createDestination()}
                placeholder="Uuden listan nimi"
                placeholderTextColor={theme.base.textMuted}
                returnKeyType="done"
                style={styles.input}
                value={newListName}
              />
              <Pressable
                accessibilityRole="button"
                disabled={loading || savingBlocked || selectedLists.length >= 32 || newListName.trim().length === 0}
                onPress={() => void createDestination()}
                style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
              >
                <Text style={styles.createButtonText}>Luo</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={loading || savingBlocked || selectedLists.length >= 32}
              onPress={() => setCreating(true)}
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
            >
              <Text style={styles.textButtonText}>+ Uusi lista</Text>
            </Pressable>
          )}

          {error || loadError ? <Text style={styles.error}>{error ?? loadError}</Text> : null}
          </ScrollView>
          <Text accessibilityLiveRegion="polite" style={styles.helper}>
            {status === 'saving' && saveProgress?.request === requestToken
              ? `Tallennettu ${saveProgress.completed}/${saveProgress.total} listaan`
              : `${selectedLists.length} listaa valittu`}
          </Text>
          {selectedLists.length >= 32 ? <Text style={styles.helper}>Voit valita kerralla enintään 32 listaa.</Text> : null}
          <Pressable accessibilityRole="button" disabled={!hasSelection || savingBlocked}
            accessibilityState={{ busy: status === 'saving', disabled: !hasSelection || savingBlocked }}
            onPress={() => void chooseLists()}
            style={({ pressed }) => [styles.createButton, (!hasSelection || savingBlocked) && styles.disabled, pressed && styles.pressed]}>
            {status === 'saving' ? <ActivityIndicator color={theme.base.textPrimary} size="small" /> : null}
            <Text style={styles.createButtonText}>{status === 'saving' ? 'Tallennetaan…' : isSharedProfile ? 'Ehdota valituille listoille' : 'Lisää valituille listoille'}</Text>
          </Pressable>
        </View>
      </View>
      </KeyboardAvoidingView>
  );
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    keyboardArea: { ...StyleSheet.absoluteFill, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.52)' },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingTop: 12,
      paddingHorizontal: 10,
      paddingBottom: DOCK_PANEL_GAP,
    },
    sheet: {
      maxHeight: '100%',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 20,
      gap: 9,
      borderRadius: 16,
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
    body: { gap: 9, paddingBottom: 4 },
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
    selectedRow: { borderColor: theme.ambient.curtainHighlight },
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
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: theme.ambient.curtain,
    },
    createButtonText: { color: theme.base.textPrimary, fontWeight: '800' },
    error: { color: '#f2a6a6', fontSize: 12 },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.4 },
  });
}
