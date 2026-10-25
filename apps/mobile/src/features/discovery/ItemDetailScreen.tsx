import { buildCollectionSequence, buildDeliveredItemOrigins, getDeliveredItemOrigin, type DeliveredItemOrigin, canUseDeliveredSlate, getDeliveredSlate, type DeliveredSlate } from './deliveredSlate';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  AppState,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSupabaseConnection } from '../../data/SupabaseProvider';

import type {
  EventId,
  Item,
  ItemId,
  ItemList,
  PredictionId,
} from '../../domain/contracts';
import { getAmbientPhase } from '../../domain/discovery';
import { visibleItemDescription } from '../../domain/itemDescription';
import { ItemDescription } from './ItemDescription';
import { CatalogDetailEntry } from './CatalogDetailEntry';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useEventTracking } from '../events/EventTrackingContext';
import {
  createUuidV7,
  getDwellEventProperties,
  type EventRecordInput,
} from '../events/eventTracking';
import {
  getInteractionEventType,
  getUndoEventProperties,
} from '../events/itemInteractionEvents';
import {
  ListDestinationSheet,
  type ListDestinationCommit,
  type ListDestinationCommitResult,
} from '../lists/ListDestinationSheet';
import { ITEM_LIST_LABELS } from '../lists/itemListLabels';
import { useItemLists } from '../lists/ItemListsContext';
import { rememberRecentList } from '../lists/listRecentUse';
import { useProfileMessages } from '../messages/ProfileMessagesContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { useDiscoveryMode } from './DiscoveryModeContext';
import { InteractionPersistenceNotice } from './InteractionPersistenceNotice';
import { useItemInteractions } from './ItemInteractionContext';
import { useSharedEndorsements } from './SharedEndorsementContext';
import {
  buildSwipeSequence,
  getItemInteraction,
  getNextSwipeIndex,
  type ItemInteraction,
  type ItemInteractionAction,
} from './itemInteraction';
import {
  getConsumedItemLabels,
  ITEM_INTERACTION_LABELS,
} from './itemInteractionLabels';
import { getMockItem } from './mockDiscovery';
import { RatingControl } from './RatingControl';
import { FeedRatingControl } from './FeedRatingControl';
import { RollingFeedCard } from './RollingFeedCard';
import { FeedRatingFrame, FeedScreenViewport } from './FeedScreenFrame';
import { useDiscoveryFeed } from './useDiscoveryFeed';
import {
  formatMemberHistoryProvenance,
  formatPendingListApproval,
  getMemberHistoryNicknames,
  getPendingListApproval,
} from './sharedEndorsement';

const RATING_COMMIT_FEEDBACK_DURATION_MS = 500;
const COLLAPSED_TAG_COUNT = 2;

interface ItemDetailScreenProps {
  itemId: ItemId;
  deliveryId?: string;
  predictionId?: PredictionId;
  predictionSource?: 'hosted' | 'fallback';
}

export function ItemDetailScreen({
  itemId,
  deliveryId,
  predictionSource,
}: ItemDetailScreenProps) {
  const connection = useSupabaseConnection();
  const { mode } = useDiscoveryMode();
  const activeProfile = useActiveProfile();
  const sharedEndorsements = useSharedEndorsements();
  const { scopeKey } = useItemLists();
  const eventTracking = useEventTracking();
  const [slate] = useState(() => getDeliveredSlate(deliveryId));
  const invalidOrigin = deliveryId
    ? !slate || !canUseDeliveredSlate(slate, scopeKey, eventTracking.sessionId, itemId)
    : predictionSource === 'hosted';
  if (invalidOrigin) {
    const styles = createStyles(getRoomTheme(getAmbientPhase(mode), activeProfile.activeProfile));
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.missing}>
          <Text accessibilityLiveRegion="polite" style={styles.title}>
            Tämä näkymä ei ole enää käytettävissä. Avaa teos uudelleen.
          </Text>
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Takaisin</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
  const isSharedProfile = activeProfile.activeProfile?.type === 'SHARED';

  if (isSharedProfile && sharedEndorsements.status !== 'ready') {
    const theme = getRoomTheme(getAmbientPhase(mode), activeProfile.activeProfile);
    const styles = createStyles(theme);

    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <StatusBar style="light" />
        <View style={styles.missing}>
          <Text accessibilityLiveRegion="polite" style={styles.title}>
            {sharedEndorsements.status === 'error'
              ? 'Yhteisiä valintoja ei saatu ladattua.'
              : 'Yhteisiä valintoja päivitetään…'}
          </Text>
          {sharedEndorsements.status === 'error' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry shared choices"
              onPress={sharedEndorsements.retry}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Yritä uudelleen</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (!deliveryId) {
    return (
      <CatalogDetailEntry key={`${scopeKey}:${eventTracking.sessionId}:${itemId}`} itemId={itemId} scopeKey={scopeKey}
        client={connection.status === 'configured' ? connection.client : null}
        theme={getRoomTheme(getAmbientPhase(mode), activeProfile.activeProfile)} onBack={() => router.back()}>
        {item => <ItemDetailContent itemId={itemId} catalogItem={item} />}
      </CatalogDetailEntry>
    );
  }

  return (
    <ItemDetailContent
      key={`${scopeKey}:${eventTracking.sessionId}:${itemId}:${deliveryId ?? "direct"}`}
      itemId={itemId}
      {...(slate ? { slate } : {})}
      {...(predictionSource ? { predictionSource } : {})}
    />
  );
}

function ItemDetailContent({
  itemId,
  slate,
  catalogItem,
}: ItemDetailScreenProps & { slate?: DeliveredSlate; catalogItem?: Item }) {
  const { width } = useWindowDimensions();
  const [feedHeight, setFeedHeight] = useState(0);
  const itemLists = useItemLists();
  const { mode: currentMode } = useDiscoveryMode();
  const [mode] = useState(() => slate?.mode ?? currentMode);
  const activeProfile = useActiveProfile();
  const eventTracking = useEventTracking();
  const sharedEndorsements = useSharedEndorsements();
  const profileMessages = useProfileMessages();
  const currentView = useRef(true);
  useLayoutEffect(() => {
    currentView.current = true;
    return () => { currentView.current = false; };
  }, []);
  const {
    interactions,
    setRating,
    setNotInterested,
    canUndo,
    undoTargetItemId,
    undo,
    atomicPendingCount,
    persistenceStatus,
    persistenceFailure,
    canDiscardAction,
    canDiscardUndo,
    retryPersistence,
    discardRejectedAction,
  } = useItemInteractions();
  const theme = getRoomTheme(getAmbientPhase(currentMode), activeProfile.activeProfile);
  const styles = createStyles(theme);
  const selectedItem = catalogItem ?? slate?.items.find(item => item.id === itemId) ?? getMockItem(itemId);
  const activeSharedMembership =
    activeProfile.activeProfile?.type === 'SHARED'
      ? activeProfile.sharedProfiles.find(
          (membership) =>
            membership.profile.id === activeProfile.activeProfile?.id,
        ) ?? null
      : null;
  const [recommendationTraceId] = useState<PredictionId>(
    () => slate?.predictionId ?? createUuidV7(),
  );
  const [items] = useState<readonly Item[]>(() => selectedItem
    ? slate?.source === 'collection' ? buildCollectionSequence(selectedItem, slate.items)
      : buildSwipeSequence(selectedItem, slate?.items ?? [selectedItem], interactions)
    : []);
  const [origins] = useState(() => slate?.origins ?? (catalogItem
    ? Object.fromEntries(items.map(item => [item.id, {
      properties: { predictionSource: 'collection' as const, deliveryTier: 'COLLECTION' as const },
    }]))
    : buildDeliveredItemOrigins(items, items, recommendationTraceId, 'fallback', {})));
  const [originSessionId] = useState(() => slate?.sessionId ?? eventTracking.sessionId);
  const [initialFeed] = useState(() => {
    const origin = selectedItem ? getDeliveredItemOrigin(origins, selectedItem.id) : null;
    return slate?.source === 'hosted' && selectedItem && origin?.predictionId && origin.deliveryRequestId
      ? { item: selectedItem, origin } : null;
  });
  const feed = useDiscoveryFeed(initialFeed, mode);
  const [feedDirection, setFeedDirection] = useState<'forward' | 'backward' | undefined>();
  const [feedDraftState, setFeedDraftState] = useState<{ opportunity: string; rating: number | null } | null>(null);
  const feedDelivery = feed.state?.delivery;
  const restoringPresentation = feed.state?.restoringPresentation;
  const feedItem = restoringPresentation?.item ?? feedDelivery?.item;
  const feedOpportunity = `${feedDelivery?.item.id ?? ''}:${feedDelivery?.origin.deliveryRequestId ?? ''}`;
  const feedPresentationKey = restoringPresentation?.visualKey ?? feed.state?.presentationKey ?? feedOpportunity;
  const feedDraft = !restoringPresentation && feedDraftState?.opportunity === feedOpportunity ? feedDraftState.rating : null;
  const [feedMembership, setFeedMembership] = useState<{ opportunity: string; saved: boolean; failed: boolean } | null>(null);
  const { loadForItem: loadFeedMembership, membershipRevision } = itemLists;
  useEffect(() => {
    if (!feedItem) return;
    let active = true;
    void loadFeedMembership(feedItem.id).then(result => {
      if (!active) return;
      setFeedMembership({ opportunity: feedPresentationKey, saved: result.status === 'success' && result.lists.some(list => list.containsItem), failed: result.status !== 'success' });
    });
    return () => { active = false; };
  }, [feedDelivery, feedItem, feedPresentationKey, loadFeedMembership, membershipRevision]);
  function setFeedDraft(rating: number | null) { setFeedDraftState({ opportunity: feedOpportunity, rating }); }
  const originFor = useCallback((item: Item) => ({
    ...(feedDelivery?.item.id === item.id ? feedDelivery.origin : getDeliveredItemOrigin(origins, item.id)),
    originSessionId }), [feedDelivery, origins, originSessionId]);
  const listRef = useRef<FlatList<Item>>(null);
  const [exitAnimation] = useState(() => new Animated.Value(0));
  const [exitingItemId, setExitingItemId] = useState<ItemId | null>(null);
  const [endorsingItemId, setEndorsingItemId] = useState<ItemId | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedRecoveryOpen, setFeedRecoveryOpen] = useState(false);
  const [ratingConfirmation, setRatingConfirmation] = useState<{
    itemId: ItemId;
    rating: number;
  } | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [listPickerTarget, setListPickerTarget] = useState<{
    item: Item;
    index: number;
    interaction: ItemInteraction;
    origin: EventRecordInput;
  } | null>(null);
  const dwellState = useRef<{
    item: Item;
    startedAtMs: number;
    origin: DeliveredItemOrigin;
    recordEvent: typeof eventTracking.recordEvent;
    discoveryMode: typeof mode;
  } | null>(null);
  const visibleDwellItem = useRef<Item | null>(null);
  const startDwell = useCallback((item: Item) => {
    if (initialFeed && feed.flow?.snapshot().restoringPresentation) return;
    dwellState.current = { item, startedAtMs: Date.now(), origin: originFor(item),
      recordEvent: eventTracking.recordEvent, discoveryMode: mode };
  }, [eventTracking.recordEvent, mode, originFor, initialFeed, feed.flow]);

  const finishDwell = useCallback(
    (endReason: 'ITEM_CHANGED' | 'SCREEN_EXIT' | 'APP_BACKGROUND') => {
      const activeDwell = dwellState.current;
      dwellState.current = null;

      if (!activeDwell) return;

      const properties = getDwellEventProperties(
        activeDwell.startedAtMs,
        Date.now(),
        endReason,
      );

      if (!properties) return;

      activeDwell.recordEvent({
        eventType: 'ITEM_DWELL',
        itemId: activeDwell.item.id,
        itemType: activeDwell.item.itemType,
        ...activeDwell.origin,
        discoveryMode: activeDwell.discoveryMode,
        properties: {
          ...properties,
          ...activeDwell.origin.properties,
        },
      });
    },
    [],
  );

  const recordItemImpression = useCallback(
    (item: Item) => {
      visibleDwellItem.current = item;

      if (dwellState.current?.item.id !== item.id) {
        finishDwell('ITEM_CHANGED');
        startDwell(item);
      }

      eventTracking.recordEvent({
        eventType: 'ITEM_IMPRESSION',
        itemId: item.id,
        itemType: item.itemType,
        ...originFor(item),
        discoveryMode: mode,
        properties: { source: 'ITEM_SEQUENCE', ...originFor(item).properties },
      });
    },
    [eventTracking, finishDwell, mode, originFor, startDwell],
  );

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (previousState === 'active' && nextState !== 'active') {
        finishDwell('APP_BACKGROUND');
      } else if (
        previousState !== 'active' &&
        nextState === 'active' &&
        !(initialFeed && feed.flow?.snapshot().restoringPresentation) &&
        visibleDwellItem.current &&
        !dwellState.current
      ) {
        startDwell(visibleDwellItem.current);
      }

      previousState = nextState;
    });

    return () => subscription.remove();
  }, [finishDwell, startDwell, initialFeed, feed.flow]);

  useEffect(
    () => () => {
      finishDwell('SCREEN_EXIT');
    },
    [finishDwell],
  );

  useEffect(() => {
    if (!initialFeed && selectedItem && eventTracking.status === 'ready') {
      recordItemImpression(selectedItem);
    }
  }, [
    eventTracking.status,
    initialFeed,
    recordItemImpression,
    selectedItem,
  ]);

  useEffect(() => {
    if (!initialFeed || !feedDelivery || restoringPresentation) return;
    visibleDwellItem.current = feedDelivery.item;
    finishDwell('ITEM_CHANGED'); startDwell(feedDelivery.item);
    return () => { visibleDwellItem.current = null; finishDwell('ITEM_CHANGED'); };
  }, [initialFeed, feedDelivery, restoringPresentation, finishDwell, startDwell]);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      active = false;
      subscription.remove();
      exitAnimation.stopAnimation();
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, [exitAnimation]);

  function isCurrentFeedItem(item: Item) {
    if (!initialFeed) return true;
    const displayed = feed.flow?.snapshot().delivery;
    const navigating = feed.flow?.snapshot();
    return currentView.current && !navigating?.restoringPresentation && !navigating?.loading && !navigating?.navigationPending && displayed?.item.id === item.id &&
      displayed.origin.deliveryRequestId === feedDelivery?.origin.deliveryRequestId;
  }

  function handleRating(
    item: Item,
    index: number,
    interaction: ItemInteraction,
    rating: number,
  ) {
    const action: ItemInteractionAction = {
      type: 'SET_RATING',
      itemId: item.id,
      rating,
    };
    const committed = handleCommittedAction(
      item,
      index,
      action,
      {
        ...interaction,
        interest: null,
        consumed: true,
        rating,
        notInterested: false,
      },
      (eventId, origin) => setRating(item.id, rating, eventId, origin),
      `Arvosana ${rating}/10 tallennettu.`,
      { rating },
      RATING_COMMIT_FEEDBACK_DURATION_MS,
    );

    if (committed && !initialFeed) {
      setRatingConfirmation({ itemId: item.id, rating });
    } else if (committed && initialFeed) {
      setFeedDirection('forward');
    }
  }

  function handleNotInterested(
    item: Item,
    index: number,
    interaction: ItemInteraction,
  ) {
    const action: ItemInteractionAction = {
      type: 'SET_NOT_INTERESTED',
      itemId: item.id,
      notInterested: true,
    };
    handleCommittedAction(
      item,
      index,
      action,
      {
        ...interaction,
        interest: null,
        consumed: false,
        rating: null,
        notInterested: true,
      },
      (eventId, origin) => setNotInterested(item.id, true, eventId, origin),
      ITEM_INTERACTION_LABELS.notInterestedFeedback,
    );
  }

  async function handleListDestinationCommit(commit: ListDestinationCommit): Promise<ListDestinationCommitResult> {
    if (!currentView.current) return { status: 'error', message: 'Näkymä vaihtui. Avaa teos uudelleen.' };
    const target = listPickerTarget;

    if (!target || !commit.lists.length) return { status: 'error', message: 'Avaa listavalinta uudelleen.' };

    if (activeSharedMembership) {
      const result = await handleEndorsement(
        target.item,
        target.index,
        commit.lists,
        commit.message,
        target.origin,
      );
      if (result.status === 'success') setListPickerTarget(null);
      return result;
    }

    const { item, index } = target;
    if (initialFeed && commit.lists.length) setFeedMembership({ opportunity: feedOpportunity, saved: true, failed: false });
    let notice: string | undefined;
    if (commit.message) {
      for (const list of commit.lists) {
        if (!currentView.current) return { status: 'error', message: 'Näkymä vaihtui. Tarkista tallentuneet lisäykset.' };
        const messageResult = await profileMessages.send({ profileId: list.profileId, body: commit.message,
          listId: list.id, itemId: item.id });
        if (messageResult.status === 'error') notice = 'Lisäys tallentui, mutta viesti ei lähtenyt. Voit lähettää sen postilaatikosta.';
      }
    }
    if (!currentView.current) return { status: 'error', message: 'Näkymä vaihtui. Tarkista tallentuneet lisäykset.' };
    if (!commit.stayOpen) {
      setListPickerTarget(null);
      advanceAfterAction(item, index, notice ?? (commit.stayOpen === false
        ? 'Listalisäykset tallennettu.' : `Lisätty listoille ${commit.lists.map(list => list.name).join(', ')}.`));
    }
    return { status: 'success', ...(notice ? { notice } : {}) };
  }

  function openListPicker(
    item: Item,
    index: number,
    interaction: ItemInteraction,
  ) {
    const onlyDeferred = initialFeed && feed.flow?.hasDeferredAction() && atomicPendingCount + feed.skips.pendingCount === 1;
    if (!isCurrentFeedItem(item) || exitingItemId || endorsingItemId || feed.state?.waitingActionId || (feed.skips.pendingCount > 0 && !onlyDeferred)) return;
    if (atomicPendingCount > 0 && !onlyDeferred) {
      setFeedback('Odota valintojen tallentumista ennen listamuutosta.');
      return;
    }
    feed.flow?.hold(true);
    setListPickerTarget({ item, index, interaction, origin: { eventType: 'ITEM_LIKED',
      itemId: item.id, itemType: item.itemType, ...originFor(item), discoveryMode: mode } });
  }

  async function handleEndorsement(
    item: Item,
    index: number,
    proposedLists?: readonly ItemList[],
    message?: string | null,
    origin?: EventRecordInput,
    confirmedListIds?: readonly string[],
  ): Promise<ListDestinationCommitResult> {
    if (!currentView.current || !isCurrentFeedItem(item)) return { status: 'error', message: 'Näkymä vaihtui. Avaa teos uudelleen.' };
    if (exitingItemId || endorsingItemId || feed.state?.waitingActionId || feed.skips.pendingCount > 0) return { status: 'error', message: 'Odota nykyisen valinnan tallentumista.' };

    feed.flow?.hold(true);
    setEndorsingItemId(item.id);
    const result = await sharedEndorsements.endorse(
      item.id,
      proposedLists?.[0]?.id,
      origin ?? { eventType: 'ITEM_ENDORSED', itemId: item.id, itemType: item.itemType,
        ...originFor(item), discoveryMode: mode },
      proposedLists?.map(list => list.id) ?? confirmedListIds,
    );
    if (!currentView.current) return { status: 'error', message: 'Näkymä vaihtui. Tarkista ehdotuksen tila.' };
    if (result.status === 'error') {
      feed.flow?.hold(false);
      setEndorsingItemId(null);
      setFeedback(result.message);
      return result;
    }

    for (const list of proposedLists ?? []) {
      rememberRecentList(list.profileId, list.id);
    }

    let notice: string | undefined;
    const destinations = result.commit.proposalLists ?? [{ id: result.commit.proposalListId, name: result.commit.proposalListName }];
    if (message) {
      for (const list of destinations) {
        if (!currentView.current) return { status: 'error', message: 'Näkymä vaihtui. Tarkista ehdotuksen tila.' };
        const messageResult = await profileMessages.send({
          profileId: result.commit.profileId, body: message, listId: list.id, itemId: item.id,
        });
        if (messageResult.status === 'error') notice = 'Lisäykset tallentuivat, mutta kaikkia viestejä ei lähetetty. Voit lähettää puuttuvat viestit postilaatikosta.';
      }
    }

    if (!currentView.current) return { status: 'error', message: 'Näkymä vaihtui. Tarkista ehdotuksen tila.' };
    setEndorsingItemId(null);
    advanceAfterAction(
      item,
      index,
      notice ?? (result.commit.consensusSaved
        ? `Pari! Tallennettu listoille ${destinations.map(list => list.name).join(', ')}.`
        : `Odottaa muiden hyväksyntää listoille ${destinations.map(list => list.name).join(', ')}.`),
    );
    return { status: 'success', ...(notice ? { notice } : {}) };
  }

  function handleCommittedAction(
    item: Item,
    index: number,
    action: ItemInteractionAction,
    nextInteraction: ItemInteraction,
    commit: (eventId?: EventId, origin?: EventRecordInput) => boolean,
    nextFeedback: string,
    eventProperties: Readonly<Record<string, unknown>> = {},
    advanceDelayMs = 0,
  ): boolean {
    if (!isCurrentFeedItem(item) || exitingItemId || feed.flow?.snapshot().waitingActionId ||
      (!initialFeed && feed.skips.pendingCount > 0)) {
      return false;
    }

    const eventId =
      eventTracking.status === 'ready'
        ? eventTracking.createEventId()
        : undefined;
    if (initialFeed && !eventId) return false;

    const eventInput: EventRecordInput = {
      eventType: getInteractionEventType(action, nextInteraction),
      itemId: item.id,
      itemType: item.itemType,
      ...originFor(item),
      discoveryMode: mode,
      properties: { source: 'ITEM_DETAIL', ...originFor(item).properties, ...eventProperties },
    };
    if (initialFeed && eventId) feed.flow?.expectPositive(eventId);
    if (!commit(eventId, eventInput)) {
      if (eventId) feed.flow?.cancelPositive(eventId);
      return false;
    }
    if (initialFeed) {
      if (eventId) feed.flow?.positiveQueued(eventId);
      setFeedback(null);
      return true;
    }

    if (eventId && action.type !== 'SET_RATING' && action.type !== 'SET_NOT_INTERESTED') {
      eventTracking.recordEvent(eventInput, eventId);
    }

    advanceAfterAction(item, index, nextFeedback, advanceDelayMs);
    return true;
  }

  function advanceAfterAction(
    item: Item,
    index: number,
    nextFeedback: string,
    delayMs = 0,
  ) {
    setFeedback(nextFeedback);
    if (initialFeed) {
      // Lists and Shared endorsements call this only with confirmed receipts.
      feed.flow?.hold(false);
      if (isCurrentFeedItem(item)) feed.flow?.positiveCommitted();
      return;
    }

    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    const nextIndex = getNextSwipeIndex(index, items.length);

    if (nextIndex === null) {
      if (delayMs > 0) {
        setExitingItemId(item.id);
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          setRatingConfirmation(null);
          setExitingItemId(null);
        }, delayMs);
      }
      return;
    }

    const advance = () => {
      listRef.current?.scrollToIndex({ index: nextIndex, animated: false });
      const nextItem = items[nextIndex];

      if (nextItem) {
        recordItemImpression(nextItem);
      }

      exitAnimation.setValue(0);
      setRatingConfirmation(null);
      setExitingItemId(null);
    };

    setExitingItemId(item.id);
    const startAdvance = () => {
      advanceTimerRef.current = null;

      if (reduceMotion) {
        advance();
        return;
      }

      exitAnimation.setValue(0);
      Animated.timing(exitAnimation, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          advance();
        }
      });
    };

    if (delayMs > 0) {
      advanceTimerRef.current = setTimeout(startAdvance, delayMs);
      return;
    }

    startAdvance();
  }

  function handleUndo() {
    if (!canUndo || !undoTargetItemId || exitingItemId || feed.state?.waitingActionId || feed.skips.pendingCount || atomicPendingCount) {
      return;
    }

    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setRatingConfirmation(null);

    const targetIndex = items.findIndex(
      (item) => item.id === undoTargetItemId,
    );
    feed.flow?.hold(true);
    const result = undo();

    if (!result) {
      feed.flow?.hold(false);
      setFeedback('Kumoamista ei voitu aloittaa. Odota tallennusta ja yritä uudelleen.');
      return;
    }

    const targetItem = getMockItem(result.itemId);

    if (!result.atomic && result.reversedEventId && targetItem) {
      eventTracking.recordEvent({
        eventType: 'ITEM_INTERACTION_UNDONE',
        itemId: targetItem.id,
        itemType: targetItem.itemType,
        ...originFor(targetItem),
        discoveryMode: mode,
        properties: {
          ...getUndoEventProperties(
            result.reversedEventId,
            result.restoredInteraction,
          ),
          ...originFor(targetItem).properties,
        },
      });
    }

    setFeedback(ITEM_INTERACTION_LABELS.undoFeedback);

    if (initialFeed) return; // The exact atomic receipt triggers the fresh reader.
    if (targetIndex >= 0) {
      listRef.current?.scrollToIndex({
        index: targetIndex,
        animated: false,
      });
      return;
    }

    router.replace({
      pathname: '/discovery/[itemId]',
      params: {
        itemId: undoTargetItemId,
      },
    });
  }

  function handleSequenceScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    const item = items[index];

    if (item) {
      recordItemImpression(item);
    }
  }

  if (!selectedItem) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <StatusBar style="light" />
        <View
          pointerEvents="none"
          style={[
            styles.ambientBackdrop,
            {
              backgroundColor: theme.ambient.wash,
              opacity: theme.ambient.washOpacity * 1.35,
            },
          ]}
        />
        <View style={styles.missing}>
          <Text style={styles.title}>Itemiä ei löytynyt</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to discovery"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Takaisin</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const feedInteraction = feedItem ? getItemInteraction(interactions, feedItem.id) : null;
  const feedSharedState = feedItem ? sharedEndorsements.stateByItemId[feedItem.id] : undefined;
  const feedApproval = getPendingListApproval(feedSharedState, activeSharedMembership?.members ?? [], activeProfile.actorUserId);
  const feedDisabled = Boolean(restoringPresentation || feed.state?.loading || feed.state?.navigationPending || feed.state?.waitingActionId || !feed.skips.ready ||
    persistenceStatus !== 'ready' || canDiscardAction || feed.skips.canDiscardAction || endorsingItemId || listPickerTarget || feedRecoveryOpen);
  const onlyDeferred = feed.flow?.hasDeferredAction() && atomicPendingCount + feed.skips.pendingCount === 1;
  const feedDependentDisabled = feedDisabled || (!onlyDeferred && (atomicPendingCount > 0 || feed.skips.pendingCount > 0));
  const canAdvanceFeed = !feedDisabled && (feed.state?.positiveCommitted === true || feed.state?.canSkip === true);
  const feedErrors = [...new Set([persistenceFailure, eventTracking.persistenceError, feed.skips.message,
    feed.state?.message, feed.state?.refillError, activeSharedMembership ? sharedEndorsements.error : null].filter((error): error is string => Boolean(error)))];
  const feedSaved = feedMembership?.opportunity === feedPresentationKey && feedMembership.saved;
  const membershipUnknown = feedMembership?.opportunity !== feedPresentationKey || feedMembership.failed;

  return (
    <SafeAreaView style={styles.safeArea} edges={initialFeed ? [] : ['bottom']}>
      <StatusBar style="light" />
      <View
        pointerEvents="none"
        style={[
          styles.ambientBackdrop,
          {
            backgroundColor: theme.ambient.wash,
            opacity: theme.ambient.washOpacity * 1.35,
          },
        ]}
      />

      {!initialFeed ? <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={slate?.collectionTitle ? `Takaisin: ${slate.collectionTitle}` : 'Takaisin'}
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>← {initialFeed ? '' : slate?.collectionTitle ?? 'Discovery'}</Text>
        </Pressable>
        <View style={styles.topBarActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ITEM_INTERACTION_LABELS.undo}
            accessibilityHint="Palauttaa viimeisimmän valinnan ja sen edellisen kortin"
            accessibilityState={{
              disabled: !canUndo || Boolean(exitingItemId || feed.state?.waitingActionId || feed.skips.pendingCount || atomicPendingCount),
            }}
            disabled={!canUndo || Boolean(exitingItemId || feed.state?.waitingActionId || feed.skips.pendingCount || atomicPendingCount)}
            onPress={handleUndo}
            hitSlop={8}
            style={({ pressed }) => [
              styles.undoButton,
              (!canUndo || exitingItemId) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.undoText}>
              ↶ {ITEM_INTERACTION_LABELS.undo}
            </Text>
          </Pressable>
          {!initialFeed && items.length > 1 ? (
            <Text style={styles.swipeHint}>Pyyhkäise →</Text>
          ) : null}
        </View>
      </View> : null}

      {!initialFeed ? <View style={styles.feedbackRow}>
        <InteractionPersistenceNotice theme={theme} />
        {feedback && !initialFeed ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.feedbackText}
          >
            {feedback}
          </Text>
        ) : null}
        {activeSharedMembership && sharedEndorsements.error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry shared choices"
            onPress={sharedEndorsements.retry}
          >
            <Text style={styles.feedbackText}>
              {sharedEndorsements.error}
            </Text>
          </Pressable>
        ) : null}
        {activeSharedMembership &&
        sharedEndorsements.status === 'loading' ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.feedbackText}
          >
            Yhteisiä valintoja päivitetään…
          </Text>
        ) : null}
      </View> : null}

      {initialFeed ? <FeedScreenViewport onLayout={event => setFeedHeight(event.nativeEvent.layout.height)}>
        {feed.state?.exhausted && !restoringPresentation ? <View style={styles.feedEnd}><Text style={styles.feedbackText}>Kaikki tämän hetken suositukset on käyty läpi.</Text>
          <Pressable accessibilityRole="button" onPress={() => feed.flow?.retry()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Päivitä</Text></Pressable>
          {feed.state.canPrevious && !feedDisabled ? <Pressable accessibilityRole="button" onPress={() => feed.flow?.previous()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Edellinen kortti</Text></Pressable> : null}
        </View> : null}
        {feedItem && feedInteraction ? <RollingFeedCard opportunity={feedPresentationKey} item={feedItem} theme={theme} disabled={feedDisabled}
            {...(feed.state?.upcoming?.[0] ? { nextItem: feed.state.upcoming[0].item } : {})}
            previewTitleAction={<View style={styles.feedStar}><Text style={styles.feedStarGlyph}>☆</Text></View>}
            previewControls={<FeedRatingFrame>
              <RatingControl rating={null} disabled theme={theme} onRatingChange={() => {}} />
            </FeedRatingFrame>}
            {...(activeProfile.actorUserId ? { helpScope: activeProfile.actorUserId } : {})} viewportHeight={feedHeight}
            {...(feedDirection ? { entryDirection: feedDirection } : {})}
            hasInteracted={feed.state?.positiveCommitted === true}
            titleAction={
              <Pressable accessibilityRole="button" accessibilityLabel={feedSaved ? 'Tallennettu listalle. Avaa listat' : membershipUnknown ? 'Avaa listat. Tallennustilaa tarkistetaan' : 'Lisää listaan'}
                accessibilityState={{ disabled: feedDependentDisabled, selected: Boolean(feedSaved) }}
                accessibilityHint="Valitse yksi tai useampi lista"
                disabled={feedDependentDisabled} style={[styles.feedStar, feedDependentDisabled && styles.disabled]}
                onPress={() => openListPicker(feedItem, 0, feedInteraction)}>
                <Text style={styles.feedStarGlyph}>{membershipUnknown ? '⋯' : feedSaved ? '★' : '☆'}</Text>
              </Pressable>
            }
            {...(feed.state?.canPrevious ? { onPrevious: () => {
              if (feedDisabled || !isCurrentFeedItem(feedItem)) return false;
              const accepted = feed.flow?.previous() === true;
              if (accepted) { setFeedDirection('backward'); setFeedDraftState(null); setFeedback(null); }
              return accepted;
            } } : {})}
            onSkip={() => { if (!canAdvanceFeed || !isCurrentFeedItem(feedItem)) return false; const accepted = feed.flow?.advance() === true;
              if (accepted) { setFeedDirection('forward'); setFeedDraft(null); setFeedback(null); } return accepted; }}>
            {feedApproval ? <Pressable accessibilityRole="button" disabled={feedDependentDisabled} style={styles.primaryButton}
              onPress={() => void handleEndorsement(feedItem, 0, undefined, undefined, undefined, feedSharedState?.proposedLists?.map(list => list.id))}>
              <Text style={styles.primaryButtonText}>Hyväksy {formatPendingListApproval(feedApproval)}</Text></Pressable> : null}
            <FeedRatingFrame><FeedRatingControl itemId={feedItem.id} draft={feedDraft} disabled={feedDisabled} theme={theme}
                onRatingChange={rating => { if (!feedDisabled) { setFeedDraft(rating); handleRating(feedItem, 0, feedInteraction, rating); } }} /></FeedRatingFrame>
            {feedSharedState?.currentActorEndorsed && !feedSaved ? <Text style={styles.feedbackText}>Odottaa ryhmän hyväksyntää</Text> : null}
          </RollingFeedCard> : null}

        {feedErrors.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Avaa tallennuksen ja yhteyden palautus"
          accessibilityHint="Tallennus tai korttien lataus tarvitsee huomiota" style={styles.feedRecoveryButton}
          onPress={() => setFeedRecoveryOpen(true)}><Text style={styles.feedRecoveryGlyph}>!</Text></Pressable> : null}
        {feedRecoveryOpen ? <Modal transparent animationType="fade" onRequestClose={() => setFeedRecoveryOpen(false)}>
          <View style={styles.feedRecoveryBackdrop}>
            <View style={styles.feedRecoveryPanel} accessibilityViewIsModal>
              <Text accessibilityRole="header" style={styles.feedRecoveryTitle}>Tallennus ja yhteys</Text>
              <ScrollView style={styles.feedRecoveryMessages}>
                {feedErrors.length ? feedErrors.map(error => <Text key={error} style={styles.feedbackText}>{error}</Text>)
                  : <Text style={styles.feedbackText}>Ei korjattavaa.</Text>}
              </ScrollView>
              {feedErrors.length > 0 ? <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => {
                retryPersistence(); eventTracking.retryPersistence(); feed.skips.retry(); feed.flow?.retry();
                if (activeSharedMembership && sharedEndorsements.error) sharedEndorsements.retry();
              }}><Text style={styles.primaryButtonText}>Yritä uudelleen</Text></Pressable> : null}
              {canDiscardAction ? <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => {
                const actionId = discardRejectedAction();
                if (actionId) feed.flow?.recoverRejected('positive', actionId);
              }}>
                <Text style={styles.primaryButtonText}>{canDiscardUndo ? 'Hylkää peruminen' : 'Hylkää valinta'}</Text></Pressable> : null}
              {feed.skips.canDiscardAction ? <Pressable accessibilityRole="button" style={styles.primaryButton}
                onPress={() => {
                  const actionId = feed.skips.discardRejected();
                  if (actionId) feed.flow?.recoverRejected('skip', actionId);
                }}>
                <Text style={styles.primaryButtonText}>Hylkää ohitus ja päivitä</Text></Pressable> : null}
              {feed.state?.canCancelPrevious ? <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => feed.flow?.cancelPrevious()}>
                <Text style={styles.primaryButtonText}>Jatka uusista suosituksista</Text></Pressable> : null}
              <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => setFeedRecoveryOpen(false)}>
                <Text style={styles.primaryButtonText}>Sulje</Text></Pressable>
            </View>
          </View>
        </Modal> : null}

      </FeedScreenViewport> : (

      <FlatList
        ref={listRef}
        data={items}
        horizontal
        pagingEnabled
        scrollEnabled={!exitingItemId}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={handleSequenceScrollEnd}
        renderItem={({ item, index }) => {
          const interaction = getItemInteraction(interactions, item.id);
          const exiting = item.id === exitingItemId;
          const sharedState = sharedEndorsements.stateByItemId[item.id];
          const pendingListApproval = getPendingListApproval(
            sharedState,
            activeSharedMembership?.members ?? [],
            activeProfile.actorUserId,
          );
          const pendingApprovalLabel = formatPendingListApproval(
            pendingListApproval,
          );
          const memberHistoryProvenance = formatMemberHistoryProvenance(
            getMemberHistoryNicknames(
              sharedState,
              activeSharedMembership?.members ?? [],
            ),
            item.itemType,
          );

          return (
            <Animated.View
              style={[
                { width },
                exiting && {
                  opacity: exitAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.12],
                  }),
                  transform: [
                    {
                      translateX: exitAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                          0,
                          -Math.min(width * 0.18, 72),
                        ],
                      }),
                    },
                    {
                      scale: exitAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.98],
                      }),
                    },
                  ],
                },
              ]}
            >
              <SwipeItemPage
                item={item}
                interaction={interaction}
                pageWidth={width}
                theme={theme}
                styles={styles}
                disabled={Boolean(exitingItemId || endorsingItemId)}
                listActionHidden={Boolean(
                  sharedState?.currentActorEndorsed ||
                    sharedState?.consensusSaved,
                )}
                pendingApprovalLabel={pendingApprovalLabel}
                sharedProvenance={memberHistoryProvenance}
                ratingConfirmation={
                  ratingConfirmation?.itemId === item.id
                    ? ratingConfirmation.rating
                    : null
                }
                {...(pendingListApproval
                  ? {
                      onApprove: () =>
                        void handleEndorsement(item, index, undefined, undefined, undefined,
                          sharedState?.proposedLists?.map(list => list.id)),
                    }
                  : {})}
                onRating={(rating) =>
                  handleRating(item, index, interaction, rating)
                }
                onNotInterested={() =>
                  handleNotInterested(item, index, interaction)
                }
                onOpenLists={() =>
                  openListPicker(item, index, interaction)
                }
              />
            </Animated.View>
          );
        }}
      />
      )}
      <ListDestinationSheet
        visible={Boolean(listPickerTarget)}
        item={listPickerTarget?.item ?? null}
        isSharedProfile={Boolean(activeSharedMembership)}
        origin={listPickerTarget?.origin}
        theme={theme}
        onClose={() => { feed.flow?.hold(false); setListPickerTarget(null); }}
        onCommitted={handleListDestinationCommit}
      />
    </SafeAreaView>
  );
}

interface SwipeItemPageProps {
  item: Item;
  interaction: ItemInteraction;
  pageWidth: number;
  theme: RoomTheme;
  styles: ReturnType<typeof createStyles>;
  disabled: boolean;
  listActionHidden: boolean;
  pendingApprovalLabel: string | null;
  sharedProvenance: string | null;
  ratingConfirmation: number | null;
  onApprove?: () => void;
  onRating: (rating: number) => void;
  onNotInterested: () => void;
  onOpenLists: () => void;
}

function SwipeItemPage({
  item,
  interaction,
  pageWidth,
  theme,
  styles,
  disabled,
  listActionHidden,
  pendingApprovalLabel,
  sharedProvenance,
  ratingConfirmation,
  onApprove,
  onRating,
  onNotInterested,
  onOpenLists,
}: SwipeItemPageProps) {
  const consumedLabels = getConsumedItemLabels(item.itemType);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const description = visibleItemDescription(item);
  const tags = item.tags ?? [];
  const visibleTags = tagsExpanded
    ? tags
    : tags.slice(0, COLLAPSED_TAG_COUNT);
  const contentExpanded = descriptionExpanded || tagsExpanded || pendingApprovalLabel !== null || Boolean(description.descriptionAttribution);

  return (
    <ScrollView
      style={{ width: pageWidth }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={contentExpanded}
      scrollEnabled={contentExpanded}
    >
      {pendingApprovalLabel && onApprove ? (
        <View style={styles.approvalBanner}>
          <Text style={styles.approvalBannerText}>
            {pendingApprovalLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Hyväksy ${pendingApprovalLabel}`}
            disabled={disabled}
            onPress={onApprove}
            style={({ pressed }) => [
              styles.approvalButton,
              disabled && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.approvalButtonText}>Hyväksy</Text>
          </Pressable>
        </View>
      ) : null}
      <View
        style={[
          styles.hero,
          {
            backgroundColor: theme.ambient.curtain,
            borderColor: theme.ambient.curtainHighlight,
          },
        ]}
      >
        {item.imageUrl ? (
          <>
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: item.imageUrl, cache: 'force-cache' }}
              resizeMode="cover"
              fadeDuration={120}
              style={styles.heroImage}
            />
            <View
              pointerEvents="none"
              style={styles.heroImageShade}
            />
          </>
        ) : (
          <View
            pointerEvents="none"
            style={[
              styles.heroLight,
              { backgroundColor: theme.ambient.windowLight },
            ]}
          />
        )}
        <View style={styles.heroStatusRow}>
          {interaction.saved ? (
            <Text style={styles.heroStatus}>
              ★ {ITEM_INTERACTION_LABELS.saved.toUpperCase()}
            </Text>
          ) : (
            <View />
          )}
          {interaction.rating !== null ? (
            <Text style={styles.heroStatus}>
              ARVOSANA {interaction.rating}/10
            </Text>
          ) : interaction.notInterested ? (
            <Text style={styles.heroStatus}>EI KIINNOSTA</Text>
          ) : interaction.consumed ? (
            <Text style={styles.heroStatus}>{consumedLabels.status}</Text>
          ) : null}
        </View>
        <Text style={styles.typeLabel}>
          {item.itemType === 'BOOK' ? 'KIRJA' : 'ELOKUVA'}
        </Text>
        <Text numberOfLines={3} style={styles.heroTitle}>
          {item.title}
        </Text>
      </View>

      <Text numberOfLines={2} style={styles.title}>
        {item.title}
      </Text>

      {tags.length ? (
        <View
          style={[
            styles.tags,
            !tagsExpanded && styles.tagsCollapsed,
          ]}
          accessibilityLabel="Item tags"
        >
          {visibleTags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text numberOfLines={1} style={styles.tagText}>
                {tag}
              </Text>
            </View>
          ))}
          {tags.length > COLLAPSED_TAG_COUNT ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                tagsExpanded ? 'Tiivistä tagit' : 'Näytä kaikki tagit'
              }
              onPress={() => setTagsExpanded((current) => !current)}
              style={({ pressed }) => [
                styles.tagMore,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.tagMoreText}>
                {tagsExpanded ? 'Vähemmän' : '…'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {sharedProvenance ? (
        <Text numberOfLines={1} style={styles.endorsementProvenance}>
          {sharedProvenance}
        </Text>
      ) : null}

      <View
        style={styles.feedbackDrawer}
        accessibilityLabel="Arvioi kohde"
      >
        <RatingControl
          key={`${item.id}:${interaction.rating ?? 'unrated'}`}
          rating={interaction.rating}
          disabled={disabled}
          theme={theme}
          onRatingChange={onRating}
        />
        <View style={styles.actions} accessibilityLabel="Muut valinnat">
          <ActionButton
            label={ITEM_INTERACTION_LABELS.notInterested}
            active={interaction.notInterested}
            disabled={disabled}
            theme={theme}
            styles={styles}
            onPress={onNotInterested}
          />
          {ratingConfirmation !== null ? (
            <View
              accessibilityLiveRegion="polite"
              accessibilityLabel={`Arvosana ${ratingConfirmation} tallennettu`}
              style={styles.ratingConfirmation}
            >
              <Text style={styles.ratingConfirmationText}>
                {ratingConfirmation}
              </Text>
            </View>
          ) : null}
          {!pendingApprovalLabel && !listActionHidden ? (
            <ActionButton
              label={ITEM_LIST_LABELS.addToList}
              active={false}
              disabled={disabled}
              theme={theme}
              styles={styles}
              onPress={onOpenLists}
            />
          ) : null}
        </View>
      </View>

      <ItemDescription item={item} expanded={descriptionExpanded}
        onExpandedChange={setDescriptionExpanded} theme={theme} />
    </ScrollView>
  );
}

interface ActionButtonProps {
  label: string;
  active: boolean;
  disabled: boolean;
  theme: RoomTheme;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}

function ActionButton({
  label,
  active,
  disabled,
  theme,
  styles,
  onPress,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        active && {
          backgroundColor: theme.ambient.curtain,
          borderColor: theme.ambient.curtainHighlight,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.actionText,
          active && styles.actionTextActive,
        ]}
      >
        {active ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    ambientBackdrop: {
      ...StyleSheet.absoluteFill,
    },
    topBar: {
      minHeight: 48,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    backButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingRight: 16,
    },
    backText: {
      color: theme.base.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    swipeHint: {
      color: theme.base.textMuted,
      fontSize: 11,
      fontWeight: '600',
      opacity: 0.78,
    },
    undoButton: {
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    undoText: {
      color: theme.base.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    feedEnd: { position: 'absolute', top: 0, bottom: 0, left: 20, right: 20,
      zIndex: 5, justifyContent: 'center', alignItems: 'center', gap: 12 },
    feedRecoveryButton: { position: 'absolute', top: 8, right: 8, zIndex: 6, width: 44, height: 44,
      borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface.raised },
    feedRecoveryGlyph: { color: theme.base.textPrimary, fontWeight: '800', fontSize: 20 },
    feedRecoveryBackdrop: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)' },
    feedRecoveryPanel: { maxHeight: '85%', gap: 14, padding: 20, borderRadius: 20, backgroundColor: theme.surface.panel },
    feedRecoveryTitle: { color: theme.base.textPrimary, fontSize: 20, fontWeight: '700' },
    feedRecoveryMessages: { flexGrow: 0 },
    feedStar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    feedStarGlyph: { color: '#ffffff', fontSize: 20, lineHeight: 24 },
    feedbackRow: {
      minHeight: 26,
      paddingHorizontal: 20,
      justifyContent: 'center',
      gap: 6,
    },
    feedbackText: {
      color: theme.ambient.curtainHighlight,
      fontSize: 12,
      fontWeight: '600',
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 18,
    },
    approvalBanner: {
      minHeight: 52,
      marginBottom: 10,
      paddingHorizontal: 13,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(117, 190, 132, 0.72)',
      backgroundColor: 'rgba(54, 119, 72, 0.34)',
    },
    approvalBannerText: {
      flex: 1,
      color: '#c9efd1',
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
    },
    approvalButton: {
      minHeight: 36,
      paddingHorizontal: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: '#4d9660',
    },
    approvalButtonText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },
    hero: {
      minHeight: 200,
      borderRadius: 24,
      borderWidth: 1,
      overflow: 'hidden',
      padding: 18,
      justifyContent: 'flex-end',
      marginBottom: 10,
    },
    heroImage: {
      ...StyleSheet.absoluteFill,
    },
    heroImageShade: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.34)',
    },
    heroLight: {
      ...StyleSheet.absoluteFill,
      opacity: 0.36,
    },
    heroStatusRow: {
      position: 'absolute',
      top: 14,
      left: 14,
      right: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroStatus: {
      color: theme.base.textPrimary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      textShadowColor: 'rgba(0, 0, 0, 0.76)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    typeLabel: {
      color: theme.base.textPrimary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.6,
      marginBottom: 6,
      textShadowColor: 'rgba(0, 0, 0, 0.76)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    heroTitle: {
      color: theme.base.textPrimary,
      fontSize: 29,
      lineHeight: 33,
      fontWeight: '700',
      textShadowColor: 'rgba(0, 0, 0, 0.76)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    title: {
      color: theme.base.textPrimary,
      fontSize: 24,
      lineHeight: 28,
      fontWeight: '600',
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    tagsCollapsed: {
      flexWrap: 'nowrap',
      overflow: 'hidden',
    },
    tag: {
      maxWidth: '42%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.surface.floor,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    tagText: {
      color: theme.base.textMuted,
      fontSize: 11,
    },
    tagMore: {
      minWidth: 30,
      minHeight: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.base.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    tagMoreText: {
      color: theme.ambient.curtainHighlight,
      fontSize: 13,
      fontWeight: '800',
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    feedbackDrawer: {
      marginTop: 6,
      gap: 6,
    },
    endorsementProvenance: {
      color: theme.ambient.curtainHighlight,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 8,
    },
    actionButton: {
      flexGrow: 1,
      flexBasis: '30%',
      minHeight: 40,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.surface.raised,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    actionText: {
      color: theme.base.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    actionTextActive: {
      color: theme.base.textPrimary,
    },
    ratingConfirmation: {
      minWidth: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.ambient.curtainHighlight,
      backgroundColor: theme.surface.panel,
    },
    ratingConfirmationText: {
      color: theme.base.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    missing: {
      flex: 1,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    },
    primaryButton: {
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: theme.ambient.curtain,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: theme.base.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.7,
    },
    disabled: {
      opacity: 0.38,
    },
  });
}
