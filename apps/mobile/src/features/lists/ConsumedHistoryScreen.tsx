import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEventTracking } from '../events/EventTrackingContext';
import { CollectionGrid } from './CollectionGrid';
import { formatListEntryDate } from './listPresentation';
import { EMPTY_ITEM_INTERACTION } from '../discovery/itemInteraction';
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

export interface ConsumedHistoryScreenProps {
  itemType: ItemType;
  embedded?: boolean;
  active?: boolean;
  requested?: boolean;
  isActive?: () => boolean;
}

export function ConsumedHistoryScreen(props: ConsumedHistoryScreenProps) {
  const { itemType } = props;
  const { scopeKey } = useItemLists();
  const { sessionId } = useEventTracking();
  return <ConsumedHistoryContent key={`${scopeKey}:${sessionId}:${itemType}`} {...props} />;
}

export function ConsumedHistoryContent({ itemType, embedded = false, active: pageActive = true,
  requested = pageActive, isActive }: ConsumedHistoryScreenProps) {
  const { mode } = useDiscoveryMode();
  const profiles = useActiveProfile();
  const itemLists = useItemLists();
  const { scopeKey, loadConsumed, revision } = itemLists;
  const { sessionId } = useEventTracking();
  const openCollectionItem = useCollectionNavigation();
  const { submitCollectionAction } = useItemInteractions();
  const theme = getRoomTheme(getAmbientPhase(mode), profiles.activeProfile);
  const styles = createStyles(theme);
  const [attempt, setAttempt] = useState(0);
  // Each scope visit owns a new token, including A → B → A. Inactive retained
  // pages keep their read/snapshot, but never carry it into another identity.
  const owner = useMemo(() => ({ scopeKey, sessionId, itemType }), [scopeKey, sessionId, itemType]);
  const desiredRequest = useMemo(
    () => ({ owner, itemType, attempt, loadConsumed, revision }),
    [owner, itemType, attempt, loadConsumed, revision],
  );
  const [retainedRequest, setRetainedRequest] = useState<typeof desiredRequest | null>(null);
  const request = requested ? desiredRequest
    : retainedRequest?.owner === owner ? retainedRequest : null;
  // Adjust the retained read with its owner before rendering another scope. A
  // hidden page otherwise keeps the exact request and does no background reload.
  if (retainedRequest !== request) setRetainedRequest(request);
  // Every visibility interval has its own capability. Hiding then revealing
  // the same retained read must not revive a callback held by an old native row.
  const activation = useMemo(() => ({ owner, request, mode, active: pageActive, isActive }),
    [owner, request, mode, pageActive, isActive]);
  const commands = useRef<typeof activation | null>(null);
  useLayoutEffect(() => {
    commands.current = activation;
    return () => { if (commands.current === activation) commands.current = null; };
  }, [activation]);
  const canAct = () => commands.current === activation && activation.active &&
    (activation.isActive?.() ?? true);
  const [snapshot, setSnapshot] = useState<{
    request: typeof desiredRequest;
    items: readonly ConsumedItem[];
    error: string | null;
  } | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const clearingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const sameOwner = () => mounted.current && commands.current?.owner === owner;
  const clearHistory = async (itemId: string) => {
    if (!canAct() || loading || snapshot?.request !== request || clearingRef.current ||
      !items.some(entry => entry.item.id === itemId)) return;
    clearingRef.current = true;
    setClearing(itemId);
    setClearError(null);
    try {
      const result = await submitCollectionAction({ kind: 'CLEAR_HISTORY', itemId }, 'LIST_DETAIL');
      if (!sameOwner()) return;
      if (result.status === 'error') setClearError(result.message);
      else setAttempt(current => current + 1);
    } catch {
      if (sameOwner()) setClearError('Poiston tilaa ei voitu varmistaa. Päivitä näkymä vetämällä alaspäin.');
    } finally {
      if (sameOwner()) { clearingRef.current = false; setClearing(null); }
    }
  };
  const loading = request !== null && snapshot?.request !== request;
  const error = snapshot?.request === request ? snapshot.error : null;
  const items = snapshot && (snapshot.request === request ||
    (embedded && snapshot.request.owner === owner)) ? snapshot.items : [];

  useEffect(() => {
    if (!request) return;
    let current = true;
    void request.loadConsumed(request.itemType).then((result) => {
      if (!current || commands.current?.owner !== request.owner) return;
      setSnapshot(result.status === 'success'
        ? { request, items: result.items, error: null }
        : { request, items: [], error: result.message });
    }).catch(() => {
      if (current && commands.current?.owner === request.owner) setSnapshot({ request, items: [], error: 'Historiaa ei saatu ladattua. Yritä uudelleen.' });
    });
    return () => { current = false; };
  }, [request]);

  const title = itemType === 'BOOK' ? 'Luetut' : 'Katsotut';

  return (
    <SafeAreaView edges={embedded ? [] : ['bottom']} style={styles.safeArea}>
      {!embedded ? <StatusBar style="light" /> : null}
      <CollectionGrid theme={theme} refreshing={loading} onRefresh={() => {
        if (canAct()) setAttempt(current => current + 1);
      }}
        entries={items.map(entry => ({ item: entry.item, caption: formatListEntryDate(entry.updatedAt),
          interaction: { ...EMPTY_ITEM_INTERACTION, saved: entry.saved, consumed: entry.consumed, rating: entry.rating } }))}
        onOpen={item => {
          if (canAct() && !loading && items.some(entry => entry.item.id === item.id))
            openCollectionItem(item, items.map(entry => entry.item), title);
        }}
        renderActions={item => <Pressable accessibilityRole="button"
          accessibilityLabel={`Poista historiasta: ${item.title}`}
          accessibilityState={{ disabled: !pageActive || loading || clearing !== null }} disabled={!pageActive || loading || clearing !== null}
          onPress={() => { void clearHistory(item.id); }} style={{ paddingVertical: 12 }}>
          <Text style={styles.link}>{clearing === item.id ? 'Poistetaan…' : 'Poista historiasta'}</Text>
        </Pressable>}
        header={<View style={styles.content}>
        {!embedded ? <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headingGroup}>
            <Text style={styles.kicker}>{profiles.activeProfile?.name ?? 'KAJO'}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View> : null}

        <Text style={styles.help}>Historiasta poistaminen poistaa arvosanan ja luettu-/katsottu-merkinnän. Tallennukset listoille säilyvät.</Text>
        {clearError ? <Text accessibilityRole="alert" style={styles.error}>{clearError}</Text> : null}
        {loading ? <ActivityIndicator color={theme.base.textMuted} /> : null}
        {error ? (
          <View style={styles.notice}>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.link}>Päivitä vetämällä alaspäin.</Text>
          </View>
        ) : null}
        {request && !loading && !error && items.length === 0 ? (
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
    help: { color: theme.base.textMuted, fontSize: 12 },
    empty: { color: theme.base.textMuted, paddingVertical: 28, textAlign: 'center' },
  });
}
