import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import type { Item } from '../../domain/contracts';
import type { RoomTheme } from '../../theme/roomTheme';
import { ItemDescription } from './ItemDescription';
import { createFeedDismissal } from './feedDismissal';

const HELP_KEY = 'kajo:vertical-feed-help:v2';
export const FEED_HELP = 'Selaa seuraavaan pyyhkäisemällä ylöspäin. Ilman valintaa teos ohitetaan. Napauta tai vedä liukuria: arvosana tallentuu ja seuraava kortti avautuu.';
type FeedMotionSettings = { disabled: boolean; canForward: boolean; canPrevious: boolean;
  reduceMotion: boolean | null; viewportHeight: number | undefined; onForwardOffset: ((offset: number) => void) | undefined };
function helpKey(scope: string) { return `${HELP_KEY}:${scope}`; }
function helpUnseen(scope: string) {
  try { return Storage.getItemSync(helpKey(scope)) !== 'seen'; } catch { return true; }
}
function rememberHelp(scope: string) {
  try { Storage.setItemSync(helpKey(scope), 'seen'); } catch { /* Keep this visit dismissed when storage is unavailable. */ }
}

// Shared presentation only. Taste owns question responses; Discovery owns
// delivered Events. Description/control gestures never become feed decisions.
// Mount with the exact opportunity as key; helpScope is the acting account.
export function FeedItemCard({ item, theme, disabled, onSkip, onPrevious, helpScope = 'device',
  hasInteracted = false, viewportHeight, helpKind = 'discovery', entryDirection, entryOffset,
  onForwardOffset, nextCard, previousCard, preview = false, initialReduceMotion, onMotionPreference,
  initialExpanded = false, onDescriptionExpanded, titleAction, children }: PropsWithChildren<{
  item: Item; theme: RoomTheme; disabled: boolean; onSkip?: () => boolean;
  onPrevious?: () => boolean; helpScope?: string; hasInteracted?: boolean; viewportHeight?: number | undefined;
  helpKind?: 'discovery' | 'taste'; entryDirection?: 'forward' | 'backward'; titleAction?: ReactNode;
  entryOffset?: number; onForwardOffset?: (offset: number) => void;
  nextCard?: ReactNode; previousCard?: ReactNode; preview?: boolean;
  initialReduceMotion?: boolean | null; onMotionPreference?: (value: boolean) => void;
  initialExpanded?: boolean; onDescriptionExpanded?: (value: boolean) => void;
}>) {
  const [imageFailed, setImageFailed] = useState(false);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [helpState, setHelpState] = useState(() => ({ scope: helpScope, interacted: hasInteracted, visible: !preview && helpUnseen(helpScope) && !hasInteracted }));
  if (helpState.scope !== helpScope) {
    setHelpState({ scope: helpScope, interacted: hasInteracted, visible: helpUnseen(helpScope) && !hasInteracted });
  } else if (helpState.interacted !== hasInteracted) {
    setHelpState({ ...helpState, interacted: hasInteracted, visible: hasInteracted ? false : helpState.visible });
  }
  // Automatic dismissal happens on the positive-action transition. A subsequent
  // explicit help request remains open even while that action is acknowledged.
  const help = !preview && helpState.scope === helpScope && helpState.visible && !(hasInteracted && !helpState.interacted);
  // The active card stays visible while its exact command and next delivery are
  // loading. Motion is presentation only: no animation callback writes evidence.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(initialReduceMotion ?? null);
  const [translation] = useState(() => new Animated.Value(preview ? 0 : entryOffset ?? (entryDirection === 'forward' ? 64 : entryDirection === 'backward' ? -64 : 0)));
  const gesture = useMemo(() => createFeedDismissal(), []);
  const [motion] = useState(() => {
    let dragging = false; let accepted = false; let entryStarted = false; let settling = false;
    let settings: FeedMotionSettings = { disabled, canForward: Boolean(onSkip), canPrevious: Boolean(onPrevious),
      reduceMotion: null, viewportHeight, onForwardOffset };
    return { configure: (next: FeedMotionSettings) => { settings = next; }, settings: () => settings,
      isDragging: () => dragging, isAccepted: () => accepted, hasEntered: () => entryStarted,
      setDragging: (value: boolean) => { dragging = value; },
      setAccepted: (value: boolean) => { accepted = value; },
      isSettling: () => settling, setSettling: (value: boolean) => { settling = value; },
      startEntry: () => { entryStarted = true; } };
  });
  const callbacks = useRef({ disabled, onSkip, onPrevious, helpScope, hasInteracted, onForwardOffset });
  useLayoutEffect(() => {
    callbacks.current = { disabled, onSkip, onPrevious, helpScope, hasInteracted, onForwardOffset };
    motion.configure({ disabled, canForward: Boolean(onSkip), canPrevious: Boolean(onPrevious), reduceMotion, viewportHeight, onForwardOffset });
    if (hasInteracted && !preview) rememberHelp(helpScope);
  }, [disabled, onSkip, onPrevious, helpScope, hasInteracted, onForwardOffset, motion, reduceMotion, viewportHeight, preview]);
  useLayoutEffect(() => {
    const accept = (direction: 'forward' | 'backward') => {
      const current = callbacks.current;
      const action = direction === 'forward' ? current.onSkip : current.onPrevious;
      if (current.disabled || AppState.currentState !== 'active' || action?.() !== true) return false;
      motion.setAccepted(true);
      rememberHelp(current.helpScope);
      setHelpState({ scope: current.helpScope, interacted: current.hasInteracted, visible: false });
      return true;
    };
    gesture.setCommit(() => accept('forward'));
    gesture.setPrevious(() => accept('backward'));
    // Callback identity changes (e.g. membership loading) must not cancel a drag.
    return () => { gesture.setCommit(() => false); gesture.setPrevious(() => false); gesture.cancel(); };
  }, [gesture, motion]);
  useEffect(() => {
    if (preview) return;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) { setReduceMotion(value); onMotionPreference?.(value); } }, () => {
      if (active) { setReduceMotion(true); onMotionPreference?.(true); }
    });
    const changedMotion = (value: boolean) => {
      setReduceMotion(value);
      onMotionPreference?.(value);
      if (value) { translation.stopAnimation(); translation.setValue(0); motion.setSettling(false); }
    };
    const motionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', changedMotion);
    const app = AppState.addEventListener('change', () => {
      gesture.cancel(); motion.setDragging(false); motion.setSettling(false);
      translation.stopAnimation(); translation.setValue(0);
    });
    return () => {
      active = false; gesture.cancel(); translation.stopAnimation();
      motionSubscription.remove(); app.remove();
    };
  }, [gesture, motion, translation, preview, onMotionPreference]);
  useLayoutEffect(() => {
    if (motion.hasEntered()) return;
    motion.startEntry();
    if (motion.isDragging() || motion.isAccepted()) return;
    // Unknown preference shows a stationary card and never replays its entry
    // after it has already appeared. RollingFeedCard carries known preferences.
    if (reduceMotion !== false || (!entryDirection && entryOffset === undefined)) { translation.setValue(0); return; }
    motion.setSettling(true);
    Animated.timing(translation, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => motion.setSettling(false));
  }, [entryDirection, entryOffset, reduceMotion, motion, translation]);
  const settle = useCallback((target: number, accepted: boolean) => {
    translation.stopAnimation();
    if (motion.settings().reduceMotion !== false) { translation.setValue(0); motion.setSettling(false); return; }
    motion.setSettling(true);
    if (accepted) {
      Animated.timing(translation, { toValue: target, duration: 160, useNativeDriver: true }).start(() => motion.setSettling(false));
    } else {
      Animated.spring(translation, { toValue: 0, speed: 24, bounciness: 0, useNativeDriver: true }).start(() => motion.setSettling(false));
    }
  }, [motion, translation]);
  const lastDisabled = useRef(disabled);
  useLayoutEffect(() => {
    if (lastDisabled.current === disabled) return;
    lastDisabled.current = disabled;
    if (disabled) {
      gesture.cancel();
      if (motion.isDragging() && !motion.isAccepted()) settle(0, false);
      motion.setDragging(false);
    } else {
      motion.setAccepted(false);
      gesture.reset();
    }
  }, [disabled, gesture, motion, settle]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, g) => {
      const settings = motion.settings();
      return !settings.disabled && !motion.isSettling() && AppState.currentState === 'active' && g.numberActiveTouches === 1 &&
        Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5 &&
        (g.dy < 0 ? settings.canForward : settings.canPrevious);
    },
    onPanResponderGrant: () => {
      if (motion.isSettling()) return;
      translation.stopAnimation(); motion.setDragging(true); motion.setAccepted(false); gesture.begin();
    },
    onPanResponderMove: (_, g) => {
      if (!motion.isDragging()) return;
      gesture.move(g.dx, g.dy, g.numberActiveTouches);
      const settings = motion.settings();
      if (settings.reduceMotion === false) translation.setValue(Math.max(-(settings.viewportHeight ?? 500), Math.min(settings.viewportHeight ?? 500, g.dy)));
    },
    onPanResponderRelease: (_, g) => {
      if (!motion.isDragging()) return;
      const accepted = gesture.release(g.dx, g.dy);
      motion.setDragging(false);
      const { viewportHeight: height, onForwardOffset: reportOffset } = motion.settings();
      // The adjoining preview follows the same translation. Keep this exact
      // position while saving, then continue from it when the delivery changes.
      const target = g.dy < 0 && height && reportOffset
        ? Math.max(-height, g.dy) : Math.sign(g.dy) * Math.min(120, Math.abs(g.dy));
      if (accepted && g.dy < 0 && height) reportOffset?.(Math.max(0, height + target));
      settle(target, accepted);
    },
    onPanResponderTerminate: () => {
      gesture.cancel(); motion.setDragging(false); settle(0, false);
    },
    onPanResponderTerminationRequest: () => true,
  }), [gesture, motion, settle, translation]);
  const styles = createStyles(theme);
  const bounded = viewportHeight !== undefined && viewportHeight > 0;
  return <Animated.View style={[styles.card, bounded && { height: viewportHeight }, { transform: [{ translateY: reduceMotion === false ? translation : 0 }] }]}>
    <View {...(!preview ? pan.panHandlers : {})} testID="feed-dismiss-surface" accessible={!preview}
      accessibilityLabel={[item.title, item.creators?.join(', '), item.releaseYear, item.originalLanguage, item.tags?.join(', ')].filter(Boolean).join(', ')}
      accessibilityHint="Toiminnoista voit selata seuraavaan, palata edelliseen tai avata ohjeen"
      accessibilityState={{ disabled }}
      accessibilityActions={[
        ...(onSkip ? [{ name: 'increment', label: 'Seuraava kortti' }] : []),
        ...(onPrevious ? [{ name: 'decrement', label: 'Edellinen kortti ja kumoa' }] : []),
        { name: 'showHelp', label: 'Selaamisen ohje' },
      ]}
      onAccessibilityAction={event => {
        const action = event.nativeEvent.actionName;
        if (action === 'showHelp') setHelpState({ scope: helpScope, interacted: hasInteracted, visible: !help });
        else if (!disabled && action === 'increment') gesture.press();
        else if (!disabled && action === 'decrement') gesture.previous();
      }}
      onLayout={() => {
        // Initial layout is not an interrupted gesture and must not reset entry motion.
        if (motion.isDragging()) { gesture.cancel(); motion.setDragging(false); settle(0, false); }
      }}
      style={[styles.browse, bounded && styles.browseFill]}>
      <View style={[styles.hero, bounded && styles.heroFill]}>
        {item.imageUrl && !imageFailed ? <Image accessibilityIgnoresInvertColors
          accessibilityLabel={`${item.title}, ${item.itemType === 'MOVIE' ? 'juliste' : 'kansi'}`}
          source={{ uri: item.imageUrl, cache: 'force-cache' }} resizeMode="contain" fadeDuration={reduceMotion ? 0 : 120}
          onError={() => setImageFailed(true)} style={styles.image} />
          : <View style={styles.fallback}><Text style={styles.type}>{item.itemType === 'MOVIE' ? 'ELOKUVA' : 'KIRJA'}</Text>
            <Text numberOfLines={2} ellipsizeMode="tail" style={styles.title}>{item.title}</Text></View>}
      </View>
    </View>
    <View style={styles.titleRow}>
      {titleAction ? <View style={styles.titleActionSlot} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /> : null}
      <Text testID="feed-title" accessibilityRole="header" accessibilityLabel={item.title}
        numberOfLines={2} ellipsizeMode="tail" style={[styles.title, styles.titleInRow, bounded && styles.boundedTitle]}>{item.title}</Text>
      {titleAction ? <View style={styles.titleActionSlot}>{titleAction}</View> : null}
    </View>
    <Text testID="feed-creators" numberOfLines={1} ellipsizeMode="tail" style={styles.muted}>{[item.creators?.join(', '), item.releaseYear, item.originalLanguage].filter(Boolean).join(' · ')}</Text>
    {item.tags?.length ? <Text numberOfLines={1} style={styles.muted}>{item.tags.slice(0, 5).join(' · ')}</Text> : null}
    <ScrollView testID="feed-description-scroll" nestedScrollEnabled
      style={[styles.description, { maxHeight: bounded ? Math.max(80, viewportHeight * 0.28) : 180 }]}
      contentContainerStyle={styles.descriptionContent}>
      <ItemDescription item={item} expanded={expanded} onExpandedChange={value => {
        const next = typeof value === 'function' ? value(expanded) : value;
        setExpanded(next); onDescriptionExpanded?.(next);
      }} theme={theme} centered />
    </ScrollView>
    {children ? <View style={styles.controls}>{children}</View> : null}
    {help ? <View style={styles.help} testID="feed-first-use-help">
      <Text style={styles.helpText}>{FEED_HELP}{helpKind === 'discovery' ? ' Alaspäin palaat ja kumoat. Tähti avaa listat.' : ''}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Sulje selaamisen ohje" onPress={() => {
        rememberHelp(helpScope); setHelpState({ scope: helpScope, interacted: hasInteracted, visible: false });
      }} style={styles.helpButton}><Text style={styles.text}>Selvä</Text></Pressable>
    </View> : null}
    {bounded && previousCard ? <View testID="feed-previous-preview" pointerEvents="none" accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={[styles.adjacent, { top: -viewportHeight, height: viewportHeight }]}>{previousCard}</View> : null}
    {bounded && nextCard ? <View testID="feed-next-preview" pointerEvents="none" accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={[styles.adjacent, { top: viewportHeight, height: viewportHeight }]}>{nextCard}</View> : null}
  </Animated.View>;
}
function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    card: { gap: 5, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 2 },
    adjacent: { position: 'absolute', left: 0, right: 0 },
    browse: { gap: 4 }, browseFill: { flex: 1, minHeight: 0, overflow: 'hidden' },
    hero: { height: 260, width: '100%', maxWidth: 340, alignSelf: 'center', borderRadius: 10, overflow: 'hidden', backgroundColor: theme.ambient.curtain },
    heroFill: { flex: 1, height: undefined, minHeight: 0 },
    image: { width: '100%', height: '100%', alignSelf: 'center' },
    fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, gap: 10 },
    title: { color: theme.base.textPrimary, fontSize: 20, lineHeight: 24, fontWeight: '800', textAlign: 'center', width: '100%', maxWidth: 340, alignSelf: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 340, alignSelf: 'center', flexShrink: 0 },
    titleInRow: { width: undefined, flexShrink: 1 },
    titleActionSlot: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    boundedTitle: { flexShrink: 1 },
    type: { color: theme.base.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
    text: { color: theme.base.textPrimary, fontSize: 14, fontWeight: '700' },
    muted: { color: theme.base.textMuted, fontSize: 12, lineHeight: 16, textAlign: 'center', width: '100%', maxWidth: 340, alignSelf: 'center' },
    description: { flexGrow: 0, flexShrink: 1, width: '100%', maxWidth: 340, alignSelf: 'center' }, descriptionContent: { paddingBottom: 2 },
    helpButton: { alignSelf: 'flex-end', paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
    help: { position: 'absolute', top: 8, left: 8, right: 8, padding: 12, borderRadius: 12,
      backgroundColor: theme.surface.raised, borderWidth: 1, borderColor: theme.base.border, zIndex: 1 },
    helpText: { color: theme.base.textPrimary, fontSize: 13, lineHeight: 19 },
    controls: { gap: 8, paddingBottom: 4, flexShrink: 0, width: '100%', maxWidth: 360, alignSelf: 'center' },
  });
}
