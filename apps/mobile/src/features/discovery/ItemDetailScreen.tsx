import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Item, ItemId } from '../../domain/contracts';
import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useDiscoveryMode } from './DiscoveryModeContext';
import { useItemInteractions } from './ItemInteractionContext';
import {
  buildSwipeSequence,
  getItemInteraction,
  getNextSwipeIndex,
  type ItemInteraction,
  type ItemInterest,
} from './itemInteraction';
import {
  getConsumedItemLabels,
  ITEM_INTERACTION_LABELS,
} from './itemInteractionLabels';
import { getMockItem, getRankedMockItems } from './mockDiscovery';

interface ItemDetailScreenProps {
  itemId: ItemId;
}

export function ItemDetailScreen({ itemId }: ItemDetailScreenProps) {
  const { width } = useWindowDimensions();
  const { mode } = useDiscoveryMode();
  const {
    interactions,
    setInterest,
    toggleSaved,
    setConsumed,
    canUndo,
    undoTargetItemId,
    undo,
  } = useItemInteractions();
  const theme = getRoomTheme(getAmbientPhase(mode));
  const styles = createStyles(theme);
  const selectedItem = getMockItem(itemId);
  const rankedItems = selectedItem ? getRankedMockItems(selectedItem.itemType, mode) : [];
  const [items] = useState<readonly Item[]>(() =>
    selectedItem ? buildSwipeSequence(selectedItem, rankedItems, interactions) : [],
  );
  const listRef = useRef<FlatList<Item>>(null);
  const [exitAnimation] = useState(() => new Animated.Value(0));
  const [exitingItemId, setExitingItemId] = useState<ItemId | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

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

  function handleInterest(item: Item, index: number, interest: ItemInterest | null) {
    handleCommittedAction(
      item,
      index,
      () => setInterest(item.id, interest),
      interest === 'LIKED'
        ? ITEM_INTERACTION_LABELS.likedFeedback
        : interest === 'DISLIKED'
          ? ITEM_INTERACTION_LABELS.dislikedFeedback
          : ITEM_INTERACTION_LABELS.interestClearedFeedback,
    );
  }

  function handleSaved(item: Item, index: number, currentlySaved: boolean) {
    handleCommittedAction(
      item,
      index,
      () => toggleSaved(item.id),
      currentlySaved
        ? ITEM_INTERACTION_LABELS.unsavedFeedback
        : ITEM_INTERACTION_LABELS.savedFeedback,
    );
  }

  function handleConsumed(item: Item, index: number, currentlyConsumed: boolean) {
    const nextConsumed = !currentlyConsumed;
    const labels = getConsumedItemLabels(item.itemType);

    handleCommittedAction(
      item,
      index,
      () => setConsumed(item.id, nextConsumed),
      nextConsumed ? labels.markedFeedback : labels.unmarkedFeedback,
    );
  }

  function handleCommittedAction(
    item: Item,
    index: number,
    commit: () => void,
    nextFeedback: string,
  ) {
    if (exitingItemId) {
      return;
    }

    commit();
    setFeedback(nextFeedback);

    const nextIndex = getNextSwipeIndex(index, items.length);

    if (nextIndex === null) {
      return;
    }

    const advance = () => {
      listRef.current?.scrollToIndex({ index: nextIndex, animated: false });
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
    undo();
    setFeedback(ITEM_INTERACTION_LABELS.undoFeedback);

    if (targetIndex >= 0) {
      listRef.current?.scrollToIndex({ index: targetIndex, animated: false });
      return;
    }

    router.replace({
      pathname: '/discovery/[itemId]',
      params: { itemId: undoTargetItemId },
    });
  }

  if (!selectedItem) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
        {feedback ? (
          <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>
            {feedback}
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
        renderItem={({ item, index }) => {
          const interaction = getItemInteraction(interactions, item.id);
          const exiting = item.id === exitingItemId;

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
                disabled={Boolean(exitingItemId)}
                onInterest={(interest) => handleInterest(item, index, interest)}
                onToggleSaved={() => handleSaved(item, index, interaction.saved)}
                onConsumedPress={() => handleConsumed(item, index, interaction.consumed)}
              />
            </Animated.View>
          );
        }}
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
  onInterest: (interest: ItemInterest | null) => void;
  onToggleSaved: () => void;
  onConsumedPress: () => void;
}

function SwipeItemPage({
  item,
  interaction,
  pageWidth,
  theme,
  styles,
  disabled,
  onInterest,
  onToggleSaved,
  onConsumedPress,
}: SwipeItemPageProps) {
  const consumedLabels = getConsumedItemLabels(item.itemType);

  return (
    <ScrollView
      style={{ width: pageWidth }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
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
          {interaction.consumed ? (
            <Text style={styles.heroStatus}>{consumedLabels.status}</Text>
          ) : null}
        </View>
        <Text style={styles.typeLabel}>{item.itemType === 'BOOK' ? 'KIRJA' : 'ELOKUVA'}</Text>
        <Text style={styles.heroTitle}>{item.title}</Text>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

      {item.tags?.length ? (
        <View style={styles.tags} accessibilityLabel="Item tags">
          {item.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions} accessibilityLabel="Item actions">
        <ActionButton
          label={ITEM_INTERACTION_LABELS.liked}
          active={interaction.interest === 'LIKED'}
          disabled={disabled}
          theme={theme}
          styles={styles}
          onPress={() => onInterest(interaction.interest === 'LIKED' ? null : 'LIKED')}
        />
        <ActionButton
          label={ITEM_INTERACTION_LABELS.disliked}
          active={interaction.interest === 'DISLIKED'}
          disabled={disabled}
          theme={theme}
          styles={styles}
          onPress={() => onInterest(interaction.interest === 'DISLIKED' ? null : 'DISLIKED')}
        />
        <ActionButton
          label={
            interaction.saved ? ITEM_INTERACTION_LABELS.saved : ITEM_INTERACTION_LABELS.save
          }
          active={interaction.saved}
          disabled={disabled}
          theme={theme}
          styles={styles}
          onPress={onToggleSaved}
        />
        <ActionButton
          label={
            interaction.consumed ? consumedLabels.activeAction : consumedLabels.markAction
          }
          active={interaction.consumed}
          disabled={disabled}
          theme={theme}
          styles={styles}
          onPress={onConsumedPress}
        />
      </View>
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
    },
    feedbackText: {
      color: theme.ambient.curtainHighlight,
      fontSize: 12,
      fontWeight: '600',
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    hero: {
      minHeight: 310,
      borderRadius: 24,
      borderWidth: 1,
      overflow: 'hidden',
      padding: 22,
      justifyContent: 'flex-end',
      marginBottom: 22,
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
      fontSize: 16,
      lineHeight: 24,
      marginTop: 12,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 20,
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
      marginTop: 24,
    },
    actionButton: {
      width: '48%',
      minHeight: 48,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.base.floor,
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
