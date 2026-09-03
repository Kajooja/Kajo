import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  AppState,
  Animated,
  Easing,
  FlatList,
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

import type {
  EventId,
  Item,
  ItemId,
  ItemList,
  PredictionId,
} from '../../domain/contracts';
import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useEventTracking } from '../events/EventTrackingContext';
import {
  createUuidV7,
  getDwellEventProperties,
} from '../events/eventTracking';
import {
  getInteractionEventType,
  getUndoEventProperties,
} from '../events/itemInteractionEvents';
import {
  ListDestinationSheet,
  type ListDestinationCommit,
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
import { getMockItem, getRankedMockItems } from './mockDiscovery';
import { RatingControl } from './RatingControl';
import {
  applySharedDiscoveryOverlay,
  formatMemberHistoryProvenance,
  formatPendingListApproval,
  getMemberHistoryNicknames,
  getPendingListApproval,
  type SharedDiscoveryStateMap,
} from './sharedEndorsement';

function buildEligibleSwipeSequence(
  selectedItem: Item | undefined,
  mode: ReturnType<typeof useDiscoveryMode>['mode'],
  interactions: Parameters<typeof buildSwipeSequence>[2],
  isSharedProfile: boolean,
  sharedOverlayReady: boolean,
  sharedStateByItemId: SharedDiscoveryStateMap,
): readonly Item[] {
  if (!selectedItem || !sharedOverlayReady) return [];

  const rankedItems = getRankedMockItems(selectedItem.itemType, mode);
  const eligibleItems = isSharedProfile
    ? applySharedDiscoveryOverlay(
        rankedItems,
        selectedItem.itemType,
        sharedStateByItemId,
      )
    : rankedItems;

  return buildSwipeSequence(selectedItem, eligibleItems, interactions);
}

interface ItemDetailScreenProps {
  itemId: ItemId;
  predictionId?: PredictionId;
  predictionSource?: 'hosted' | 'fallback';
}

export function ItemDetailScreen({
  itemId,
  predictionId,
  predictionSource,
}: ItemDetailScreenProps) {
  const { mode } = useDiscoveryMode();
  const activeProfile = useActiveProfile();
  const sharedEndorsements = useSharedEndorsements();
  const isSharedProfile = activeProfile.activeProfile?.type === 'SHARED';

  if (isSharedProfile && sharedEndorsements.status !== 'ready') {
    const theme = getRoomTheme(getAmbientPhase(mode));
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

  return (
    <ItemDetailContent
      itemId={itemId}
      {...(predictionId ? { predictionId } : {})}
      {...(predictionSource ? { predictionSource } : {})}
    />
  );
}

function ItemDetailContent({
  itemId,
  predictionId,
  predictionSource = 'fallback',
}: ItemDetailScreenProps) {
  const { width } = useWindowDimensions();
  const { mode } = useDiscoveryMode();
  const activeProfile = useActiveProfile();
  const eventTracking = useEventTracking();
  const sharedEndorsements = useSharedEndorsements();
  const profileMessages = useProfileMessages();
  const { refresh: refreshLists } = useItemLists();
  const {
    interactions,
    setListLike,
    setRating,
    setNotInterested,
    canUndo,
    undoTargetItemId,
    undo,
    retryHydration,
  } = useItemInteractions();
  const theme = getRoomTheme(getAmbientPhase(mode));
  const styles = createStyles(theme);
  const selectedItem = getMockItem(itemId);
  const activeSharedMembership =
    activeProfile.activeProfile?.type === 'SHARED'
      ? activeProfile.sharedProfiles.find(
          (membership) =>
            membership.profile.id === activeProfile.activeProfile?.id,
        ) ?? null
      : null;
  const [recommendationTraceId] = useState<PredictionId>(
    () => predictionId ?? createUuidV7(),
  );
  const sharedOverlayReady =
    !activeSharedMembership || sharedEndorsements.status === 'ready';
  const [items] = useState<readonly Item[]>(() =>
    buildEligibleSwipeSequence(
      selectedItem,
      mode,
      interactions,
      Boolean(activeSharedMembership),
      sharedOverlayReady,
      sharedEndorsements.stateByItemId,
    ),
  );
  const listRef = useRef<FlatList<Item>>(null);
  const [exitAnimation] = useState(() => new Animated.Value(0));
  const [exitingItemId, setExitingItemId] = useState<ItemId | null>(null);
  const [endorsingItemId, setEndorsingItemId] = useState<ItemId | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [listPickerTarget, setListPickerTarget] = useState<{
    item: Item;
    index: number;
    interaction: ItemInteraction;
  } | null>(null);
  const dwellState = useRef<{
    item: Item;
    startedAtMs: number;
  } | null>(null);
  const visibleDwellItem = useRef<Item | null>(null);
  const dwellEventContext = useRef({
    recordEvent: eventTracking.recordEvent,
    predictionId: recommendationTraceId,
    discoveryMode: mode,
    predictionSource,
  });
  dwellEventContext.current = {
    recordEvent: eventTracking.recordEvent,
    predictionId: recommendationTraceId,
    discoveryMode: mode,
    predictionSource,
  };

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

      const current = dwellEventContext.current;
      current.recordEvent({
        eventType: 'ITEM_DWELL',
        itemId: activeDwell.item.id,
        itemType: activeDwell.item.itemType,
        predictionId: current.predictionId,
        discoveryMode: current.discoveryMode,
        properties: {
          ...properties,
          predictionSource: current.predictionSource,
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
        dwellState.current = { item, startedAtMs: Date.now() };
      }

      eventTracking.recordEvent({
        eventType: 'ITEM_IMPRESSION',
        itemId: item.id,
        itemType: item.itemType,
        predictionId: recommendationTraceId,
        discoveryMode: mode,
        properties: { source: 'ITEM_SEQUENCE', predictionSource },
      });
    },
    [eventTracking, finishDwell, mode, predictionSource, recommendationTraceId],
  );

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (previousState === 'active' && nextState !== 'active') {
        finishDwell('APP_BACKGROUND');
      } else if (
        previousState !== 'active' &&
        nextState === 'active' &&
        visibleDwellItem.current &&
        !dwellState.current
      ) {
        dwellState.current = {
          item: visibleDwellItem.current,
          startedAtMs: Date.now(),
        };
      }

      previousState = nextState;
    });

    return () => subscription.remove();
  }, [finishDwell]);

  useEffect(
    () => () => {
      finishDwell('SCREEN_EXIT');
    },
    [finishDwell],
  );

  useEffect(() => {
    if (selectedItem && eventTracking.status === 'ready') {
      recordItemImpression(selectedItem);
    }
  }, [
    eventTracking.status,
    recordItemImpression,
    selectedItem,
  ]);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      active = false;
      subscription.remove();
      exitAnimation.stopAnimation();
    };
  }, [exitAnimation]);

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
    handleCommittedAction(
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
      (eventId) => setRating(item.id, rating, eventId),
      `Arvosana ${rating}/10 tallennettu.`,
      { rating },
    );
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
      (eventId) => setNotInterested(item.id, true, eventId),
      ITEM_INTERACTION_LABELS.notInterestedFeedback,
    );
  }

  function handleListDestinationCommit(commit: ListDestinationCommit) {
    const target = listPickerTarget;
    setListPickerTarget(null);

    if (!target) return;

    if (activeSharedMembership) {
      void handleEndorsement(
        target.item,
        target.index,
        commit.list,
        commit.message,
      );
      return;
    }

    const { item, index, interaction } = target;
    const systemSaved = commit.list.kind === 'SYSTEM_SAVED';
    if (commit.message && activeProfile.activeProfile) {
      void profileMessages.send({
        profileId: activeProfile.activeProfile.id,
        body: commit.message,
        listId: commit.list.id,
        itemId: item.id,
      });
    }
    if (interaction.interest === 'LIKED' && (!systemSaved || interaction.saved)) {
      advanceAfterAction(
        item,
        index,
        `${commit.added ? 'Lisätty' : 'Jo'} listalla ${commit.list.name}.`,
      );
      return;
    }

    const action: ItemInteractionAction = {
      type: 'SET_LIST_LIKE',
      itemId: item.id,
      systemSaved,
    };
    handleCommittedAction(
      item,
      index,
      action,
      { ...interaction, interest: 'LIKED', ...(systemSaved ? { saved: true } : {}) },
      (eventId) => setListLike(item.id, systemSaved, eventId),
      `${commit.added ? 'Lisätty' : 'Jo'} listalla ${commit.list.name}.`,
      { listId: commit.list.id, listName: commit.list.name },
    );
  }

  function openListPicker(
    item: Item,
    index: number,
    interaction: ItemInteraction,
  ) {
    if (exitingItemId || endorsingItemId) return;
    setListPickerTarget({ item, index, interaction });
  }

  async function handleEndorsement(
    item: Item,
    index: number,
    proposedList?: ItemList,
    message?: string | null,
  ) {
    if (exitingItemId || endorsingItemId) return;

    setEndorsingItemId(item.id);
    const result = await sharedEndorsements.endorse(item.id, proposedList?.id);
    setEndorsingItemId(null);

    if (result.status === 'error') {
      setFeedback(result.message);
      return;
    }

    if (proposedList) {
      rememberRecentList(proposedList.profileId, proposedList.id);
    }

    if (message && activeProfile.activeProfile) {
      void profileMessages.send({
        profileId: activeProfile.activeProfile.id,
        body: message,
        listId: result.commit.proposalListId,
        itemId: item.id,
      });
    }

    if (result.commit.endorsementCreated) {
      eventTracking.recordEvent({
        eventType: 'ITEM_ENDORSED',
        itemId: item.id,
        itemType: item.itemType,
        predictionId: recommendationTraceId,
        discoveryMode: mode,
        properties: {
          source: 'SHARED_DISCOVERY',
          predictionSource,
          endorsementCount: result.commit.endorsementCount,
          requiredMemberCount: result.commit.requiredMemberCount,
          listId: result.commit.proposalListId,
          listName: result.commit.proposalListName,
        },
      });
    }

    if (result.commit.consensusReached) {
      eventTracking.recordEvent({
        eventType: 'ITEM_SAVED',
        itemId: item.id,
        itemType: item.itemType,
        predictionId: recommendationTraceId,
        discoveryMode: mode,
        properties: {
          source: 'SHARED_CONSENSUS',
          predictionSource,
          endorsementCount: result.commit.endorsementCount,
          requiredMemberCount: result.commit.requiredMemberCount,
        },
      });
      if (result.commit.listEntryCreated) {
        eventTracking.recordEvent({
          eventType: 'ITEM_ADDED_TO_LIST',
          itemId: item.id,
          itemType: item.itemType,
          predictionId: recommendationTraceId,
          discoveryMode: mode,
          properties: {
            source: 'SHARED_CONSENSUS',
            predictionSource,
            listId: result.commit.proposalListId,
            listName: result.commit.proposalListName,
            proposedByUserId: result.commit.proposedByUserId,
          },
        });
      }
    }

    if (result.commit.consensusSaved) {
      retryHydration();
      refreshLists();
    }

    advanceAfterAction(
      item,
      index,
      result.commit.consensusSaved
        ? `Pari! Tallennettu listaan ${result.commit.proposalListName}.`
        : `Odottaa muiden hyväksyntää listalle ${result.commit.proposalListName}.`,
    );
  }

  function handleCommittedAction(
    item: Item,
    index: number,
    action: ItemInteractionAction,
    nextInteraction: ItemInteraction,
    commit: (eventId?: EventId) => boolean,
    nextFeedback: string,
    eventProperties: Readonly<Record<string, unknown>> = {},
  ) {
    if (exitingItemId) {
      return;
    }

    const eventId =
      eventTracking.status === 'ready'
        ? eventTracking.createEventId()
        : undefined;

    if (!commit(eventId)) {
      return;
    }

    if (eventId) {
      eventTracking.recordEvent(
        {
          eventType: getInteractionEventType(action, nextInteraction),
          itemId: item.id,
          itemType: item.itemType,
          predictionId: recommendationTraceId,
          discoveryMode: mode,
          properties: {
            source: 'ITEM_DETAIL',
            predictionSource,
            ...eventProperties,
          },
        },
        eventId,
      );
    }

    advanceAfterAction(item, index, nextFeedback);
  }

  function advanceAfterAction(
    item: Item,
    index: number,
    nextFeedback: string,
  ) {
    setFeedback(nextFeedback);

    const nextIndex = getNextSwipeIndex(index, items.length);

    if (nextIndex === null) {
      return;
    }

    const advance = () => {
      listRef.current?.scrollToIndex({ index: nextIndex, animated: false });
      const nextItem = items[nextIndex];

      if (nextItem) {
        recordItemImpression(nextItem);
      }

      exitAnimation.setValue(0);
      setExitingItemId(null);
    };

    if (reduceMotion) {
      advance();
      return;
    }

    setExitingItemId(item.id);
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
  }

  function handleUndo() {
    if (!canUndo || !undoTargetItemId || exitingItemId) {
      return;
    }

    const targetIndex = items.findIndex((item) => item.id === undoTargetItemId);
    const result = undo();

    if (!result) {
      return;
    }

    const targetItem = getMockItem(result.itemId);

    if (result.reversedEventId && targetItem) {
      eventTracking.recordEvent({
        eventType: 'ITEM_INTERACTION_UNDONE',
        itemId: targetItem.id,
        itemType: targetItem.itemType,
        predictionId: recommendationTraceId,
        discoveryMode: mode,
        properties: {
          ...getUndoEventProperties(
            result.reversedEventId,
            result.restoredInteraction,
          ),
          predictionSource,
        },
      });
    }

    setFeedback(ITEM_INTERACTION_LABELS.undoFeedback);

    if (targetIndex >= 0) {
      listRef.current?.scrollToIndex({ index: targetIndex, animated: false });
      return;
    }

    router.replace({
      pathname: '/discovery/[itemId]',
      params: {
        itemId: undoTargetItemId,
        predictionId: recommendationTraceId,
        predictionSource,
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
            { backgroundColor: theme.ambient.wash, opacity: theme.ambient.washOpacity * 1.35 },
          ]}
        />
        <View style={styles.missing}>
          <Text style={styles.title}>Itemiä ei löytynyt</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to discovery"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Takaisin</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="light" />
      <View
        pointerEvents="none"
        style={[
          styles.ambientBackdrop,
          { backgroundColor: theme.ambient.wash, opacity: theme.ambient.washOpacity * 1.35 },
        ]}
      />

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to discovery"
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>← Discovery</Text>
        </Pressable>
        <View style={styles.topBarActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ITEM_INTERACTION_LABELS.undo}
            accessibilityHint="Palauttaa viimeisimmän valinnan ja sen edellisen kortin"
            accessibilityState={{ disabled: !canUndo || Boolean(exitingItemId) }}
            disabled={!canUndo || Boolean(exitingItemId)}
            onPress={handleUndo}
            hitSlop={8}
            style={({ pressed }) => [
              styles.undoButton,
              (!canUndo || exitingItemId) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.undoText}>↶ {ITEM_INTERACTION_LABELS.undo}</Text>
          </Pressable>
          {items.length > 1 ? <Text style={styles.swipeHint}>Pyyhkäise →</Text> : null}
        </View>
      </View>

      <View style={styles.feedbackRow}>
        <InteractionPersistenceNotice theme={theme} />
        {feedback ? (
          <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>
            {feedback}
          </Text>
        ) : null}
        {activeSharedMembership && sharedEndorsements.error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry shared choices"
            onPress={sharedEndorsements.retry}
          >
            <Text style={styles.feedbackText}>{sharedEndorsements.error}</Text>
          </Pressable>
        ) : null}
        {activeSharedMembership && sharedEndorsements.status === 'loading' ? (
          <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>
            Yhteisiä valintoja päivitetään…
          </Text>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={items}
        horizontal
        pagingEnabled
        scrollEnabled={!exitingItemId}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
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
                        outputRange: [0, -Math.min(width * 0.18, 72)],
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
                  sharedState?.currentActorEndorsed || sharedState?.consensusSaved,
                )}
                pendingApprovalLabel={pendingApprovalLabel}
                sharedProvenance={memberHistoryProvenance}
                {...(pendingListApproval
                  ? { onApprove: () => void handleEndorsement(item, index) }
                  : {})}
                onRating={(rating) => handleRating(item, index, interaction, rating)}
                onNotInterested={() =>
                  handleNotInterested(item, index, interaction)
                }
                onOpenLists={() => openListPicker(item, index, interaction)}
              />
            </Animated.View>
          );
        }}
      />
      <ListDestinationSheet
        visible={Boolean(listPickerTarget)}
        item={listPickerTarget?.item ?? null}
        isSharedProfile={Boolean(activeSharedMembership)}
        theme={theme}
        onClose={() => setListPickerTarget(null)}
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
  onApprove,
  onRating,
  onNotInterested,
  onOpenLists,
}: SwipeItemPageProps) {
  const consumedLabels = getConsumedItemLabels(item.itemType);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  return (
    <ScrollView
      style={{ width: pageWidth }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      scrollEnabled={descriptionExpanded}
    >
      {pendingApprovalLabel && onApprove ? (
        <View style={styles.approvalBanner}>
          <Text numberOfLines={2} style={styles.approvalBannerText}>
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
        <View
          pointerEvents="none"
          style={[styles.heroLight, { backgroundColor: theme.ambient.windowLight }]}
        />
        <View style={styles.heroStatusRow}>
          {interaction.saved ? (
            <Text style={styles.heroStatus}>
              ★ {ITEM_INTERACTION_LABELS.saved.toUpperCase()}
            </Text>
          ) : (
            <View />
          )}
          {interaction.rating !== null ? (
            <Text style={styles.heroStatus}>ARVOSANA {interaction.rating}/10</Text>
          ) : interaction.notInterested ? (
            <Text style={styles.heroStatus}>EI KIINNOSTA</Text>
          ) : interaction.consumed ? (
            <Text style={styles.heroStatus}>{consumedLabels.status}</Text>
          ) : null}
        </View>
        <Text style={styles.typeLabel}>{item.itemType === 'BOOK' ? 'KIRJA' : 'ELOKUVA'}</Text>
        <Text style={styles.heroTitle}>{item.title}</Text>
      </View>

      <Text style={styles.title}>{item.title}</Text>

      {item.tags?.length ? (
        <View style={styles.tags} accessibilityLabel="Item tags">
          {item.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {sharedProvenance ? (
        <Text style={styles.endorsementProvenance}>
          {sharedProvenance}
        </Text>
      ) : null}

      <View style={styles.feedbackDrawer} accessibilityLabel="Arvioi kohde">
        <RatingControl
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

      {item.description ? (
        <View style={styles.descriptionBlock}>
          <Pressable
            accessibilityRole={descriptionExpanded ? undefined : 'button'}
            accessibilityLabel={
              descriptionExpanded ? undefined : 'Laajenna kuvaus'
            }
            disabled={descriptionExpanded}
            onPress={() => setDescriptionExpanded(true)}
          >
            <Text
              ellipsizeMode="tail"
              numberOfLines={descriptionExpanded ? undefined : 3}
              style={styles.description}
            >
              {item.description}
            </Text>
          </Pressable>
          {descriptionExpanded ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tiivistä kuvaus"
              onPress={() => setDescriptionExpanded(false)}
              style={({ pressed }) => [
                styles.collapseDescription,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.collapseDescriptionText}>Näytä vähemmän</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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

function ActionButton({ label, active, disabled, theme, styles, onPress }: ActionButtonProps) {
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
      <Text style={[styles.actionText, active && styles.actionTextActive]}>
        {active ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.base.appBackground,
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
      minHeight: 235,
      borderRadius: 24,
      borderWidth: 1,
      overflow: 'hidden',
      padding: 22,
      justifyContent: 'flex-end',
      marginBottom: 14,
    },
    heroLight: {
      ...StyleSheet.absoluteFill,
      opacity: 0.36,
    },
    heroStatusRow: {
      position: 'absolute',
      top: 18,
      left: 18,
      right: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroStatus: {
      color: theme.base.textPrimary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
    },
    typeLabel: {
      color: theme.base.textPrimary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.6,
      marginBottom: 8,
    },
    heroTitle: {
      color: theme.base.textPrimary,
      fontSize: 34,
      lineHeight: 38,
      fontWeight: '700',
    },
    title: {
      color: theme.base.textPrimary,
      fontSize: 27,
      lineHeight: 32,
      fontWeight: '600',
    },
    description: {
      color: theme.base.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    descriptionBlock: {
      marginTop: 14,
    },
    collapseDescription: {
      alignSelf: 'flex-start',
      minHeight: 36,
      justifyContent: 'center',
      marginTop: 4,
    },
    collapseDescriptionText: {
      color: theme.ambient.curtainHighlight,
      fontSize: 12,
      fontWeight: '700',
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    tag: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.base.floor,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    tagText: {
      color: theme.base.textMuted,
      fontSize: 12,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    feedbackDrawer: {
      marginTop: 14,
      gap: 10,
    },
    endorsementProvenance: {
      color: theme.ambient.curtainHighlight,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 12,
    },
    actionButton: {
      flexGrow: 1,
      flexBasis: '30%',
      minHeight: 42,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.base.structure,
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
