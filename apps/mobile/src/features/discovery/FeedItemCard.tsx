import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import type { Item } from '../../domain/contracts';
import type { RoomTheme } from '../../theme/roomTheme';
import { ItemDescription } from './ItemDescription';
import { createFeedDismissal, FEED_DRAG_DISTANCE, isFeedFling } from './feedDismissal';

const HELP_KEY = 'kajo:vertical-feed-help:v2';
const CARD_GAP = 5;
const CARD_TOP_PADDING = 2;
export const FEED_HELP = 'Selaa seuraavaan pyyhkäisemällä korttia ylöspäin. Pitkää kuvausta lukiessa kortti pysähtyy arvosanaan. Uusi pyyhkäisy jatkaa seuraavaan. Ilman valintaa teos ohitetaan. Napauta tai vedä liukuria: arvosana tallentuu ja seuraava kortti avautuu.';
type FeedMotionSettings = { disabled: boolean; canForward: boolean; canPrevious: boolean;
  reduceMotion: boolean | null; viewportHeight: number | undefined; cardHeight: number | undefined;
  onForwardOffset: ((offset: number) => void) | undefined; onReadingOffset: ((offset: number) => void) | undefined };
function readingMinimum(settings: FeedMotionSettings) {
  return Math.min(0, (settings.viewportHeight ?? 500) - (settings.cardHeight ?? settings.viewportHeight ?? 500));
}
function dragOffset(settings: FeedMotionSettings, origin: number, dy: number) {
  const minimum = readingMinimum(settings);
  // Reading the description and dismissing the Item require separate gestures.
  // Clamp during tracking too, so the rating never moves past the bottom stop.
  const lowerBound = dy < 0 && origin > minimum ? minimum : -(settings.cardHeight ?? 500);
  return Math.max(lowerBound, Math.min(settings.viewportHeight ?? 500, origin + dy));
}
export function getFeedCardHeight(viewportHeight: number | undefined, descriptionHeight: number, contentHeight = 0) {
  return viewportHeight && viewportHeight > 0
    ? Math.max(viewportHeight + Math.max(0, descriptionHeight - Math.max(80, viewportHeight * 0.28)),
      contentHeight + CARD_GAP + CARD_TOP_PADDING) : undefined;
}
function helpKey(scope: string) { return `${HELP_KEY}:${scope}`; }
function helpUnseen(scope: string) {
  try { return Storage.getItemSync(helpKey(scope)) !== 'seen'; } catch { return true; }
}
function rememberHelp(scope: string) {
  try { Storage.setItemSync(helpKey(scope), 'seen'); } catch { /* Keep this visit dismissed when storage is unavailable. */ }
}

// Shared presentation only. Taste owns question responses; Discovery owns
// delivered Events. Vertical intent belongs to the whole card; horizontal
// ratings and ordinary button taps retain their own responders.
// Mount with the exact opportunity as key; helpScope is the acting account.
export function FeedItemCard({ item, theme, disabled, onSkip, onPrevious, helpScope = 'device',
  hasInteracted = false, viewportHeight, helpKind = 'discovery', entryDirection, entryOffset,
  onForwardOffset, nextCard, previousCard, preview = false, initialReduceMotion, onMotionPreference,
  initialExpanded = false, onDescriptionExpanded, initialDescriptionHeight = 0, onDescriptionHeight,
  initialContentHeight = 0, onContentHeight, onReadingOffset, previousCardHeight, titleAction, children }: PropsWithChildren<{
  item: Item; theme: RoomTheme; disabled: boolean; onSkip?: () => boolean;
  onPrevious?: () => boolean; helpScope?: string; hasInteracted?: boolean; viewportHeight?: number | undefined;
  helpKind?: 'discovery' | 'taste'; entryDirection?: 'forward' | 'backward'; titleAction?: ReactNode;
  entryOffset?: number; onForwardOffset?: (offset: number) => void;
  nextCard?: ReactNode; previousCard?: ReactNode; preview?: boolean;
  initialReduceMotion?: boolean | null; onMotionPreference?: (value: boolean) => void;
  initialExpanded?: boolean; onDescriptionExpanded?: (value: boolean) => void;
  initialDescriptionHeight?: number; onDescriptionHeight?: (height: number) => void;
  initialContentHeight?: number; onContentHeight?: (height: number) => void;
  onReadingOffset?: (offset: number) => void; previousCardHeight?: number | undefined;
}>) {
  const [imageFailed, setImageFailed] = useState(false);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [descriptionHeight, setDescriptionHeight] = useState(initialDescriptionHeight);
  const [contentHeight, setContentHeight] = useState(initialContentHeight);
  const cardHeight = getFeedCardHeight(viewportHeight, descriptionHeight, contentHeight);
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
  const [translation] = useState(() => new Animated.Value(preview || initialReduceMotion !== false ? 0 : entryOffset ?? (entryDirection === 'forward' ? 64 : entryDirection === 'backward' ? -64 : 0)));
  const gesture = useMemo(() => createFeedDismissal(), []);
  const [motion] = useState(() => {
    let dragging = false; let accepted = false; let entryStarted = false;
    let readingOffset = 0; let dragOrigin = 0; let captureX = 0; let captureY = 0; let lastMoveAt = 0; let blocked = false;
    let settings: FeedMotionSettings = { disabled, canForward: Boolean(onSkip), canPrevious: Boolean(onPrevious),
      reduceMotion: null, viewportHeight, cardHeight, onForwardOffset, onReadingOffset };
    return { configure: (next: FeedMotionSettings) => { settings = next; }, settings: () => settings,
      isDragging: () => dragging, isAccepted: () => accepted, hasEntered: () => entryStarted,
      setDragging: (value: boolean) => { dragging = value; },
      setAccepted: (value: boolean) => { accepted = value; },
      readingOffset: () => readingOffset, setReadingOffset: (value: number) => { readingOffset = value; settings.onReadingOffset?.(value); },
      capture: (dx: number, dy: number) => { captureX = dx; captureY = dy; lastMoveAt = Date.now(); },
      begin: () => { dragOrigin = readingOffset; }, origin: () => dragOrigin,
      coordinates: (dx: number, dy: number) => ({ dx: captureX + dx, dy: captureY + dy }),
      moved: () => { lastMoveAt = Date.now(); }, freshVelocity: () => Date.now() - lastMoveAt <= 100,
      clearCapture: () => { captureX = 0; captureY = 0; },
      startTouches: (touches: number) => { if (!dragging && touches === 1) blocked = false; else if (touches !== 1) blocked = true; },
      observe: (dx: number, dy: number, touches: number) => {
        if (touches !== 1 || (!dragging && Math.abs(dx) >= 24 && Math.abs(dx) > Math.abs(dy) * 1.5)) blocked = true;
        return !blocked;
      },
      startEntry: () => { entryStarted = true; } };
  });
  const callbacks = useRef({ disabled, onSkip, onPrevious, helpScope, hasInteracted, onForwardOffset });
  useLayoutEffect(() => {
    callbacks.current = { disabled, onSkip, onPrevious, helpScope, hasInteracted, onForwardOffset };
    motion.configure({ disabled, canForward: Boolean(onSkip), canPrevious: Boolean(onPrevious), reduceMotion, viewportHeight, cardHeight, onForwardOffset, onReadingOffset });
  }, [disabled, onSkip, onPrevious, helpScope, hasInteracted, onForwardOffset, onReadingOffset, motion, reduceMotion, viewportHeight, cardHeight]);
  useLayoutEffect(() => {
    // Acknowledgement/data/gesture callback refreshes must not synchronously
    // rewrite SQLite while the feed is moving.
    if (hasInteracted && !preview) rememberHelp(helpScope);
  }, [hasInteracted, helpScope, preview]);
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
      if (value) { translation.stopAnimation(); translation.setValue(motion.readingOffset()); }
    };
    const motionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', changedMotion);
    const app = AppState.addEventListener('change', () => {
      gesture.cancel(); motion.setDragging(false);
      motion.clearCapture(); motion.setReadingOffset(0);
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
    Animated.timing(translation, { toValue: 0, duration: 180, useNativeDriver: true }).start();
  }, [entryDirection, entryOffset, reduceMotion, motion, translation]);
  const settle = useCallback((target: number, accepted: boolean) => {
    translation.stopAnimation();
    if (motion.settings().reduceMotion !== false) { translation.setValue(accepted ? motion.readingOffset() : target); return; }
    if (accepted) {
      Animated.timing(translation, { toValue: target, duration: 120, useNativeDriver: true }).start();
    } else {
      Animated.spring(translation, { toValue: target, speed: 24, bounciness: 0, useNativeDriver: true }).start();
    }
  }, [motion, translation]);
  const lastDisabled = useRef(disabled);
  useLayoutEffect(() => {
    if (lastDisabled.current === disabled) return;
    lastDisabled.current = disabled;
    if (disabled) {
      gesture.cancel();
      if (motion.isDragging() && !motion.isAccepted()) settle(motion.readingOffset(), false);
      motion.setDragging(false);
    } else {
      motion.setAccepted(false);
      gesture.reset();
    }
  }, [disabled, gesture, motion, settle]);
  const dimensions = useRef({ cardHeight, viewportHeight });
  useLayoutEffect(() => {
    if (dimensions.current.cardHeight === cardHeight && dimensions.current.viewportHeight === viewportHeight) return;
    dimensions.current = { cardHeight, viewportHeight };
    gesture.cancel(); motion.setDragging(false); motion.clearCapture();
    const offset = Math.max(Math.min(0, (viewportHeight ?? 0) - (cardHeight ?? 0)), Math.min(0, motion.readingOffset()));
    motion.setReadingOffset(offset); translation.stopAnimation(); translation.setValue(offset);
    if (motion.isAccepted() && cardHeight) motion.settings().onForwardOffset?.(cardHeight + offset);
  }, [cardHeight, viewportHeight, gesture, motion, translation]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (_, g) => {
      if (!motion.isDragging()) motion.clearCapture(); motion.startTouches(g.numberActiveTouches); return false;
    },
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, g) => {
      const settings = motion.settings();
      const minimum = readingMinimum(settings);
      const eligible = motion.observe(g.dx, g.dy, g.numberActiveTouches);
      const allowed = eligible && !motion.isDragging() && !settings.disabled && !motion.isAccepted() && AppState.currentState === 'active' && g.numberActiveTouches === 1 &&
        Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5 &&
        (g.dy < 0 ? settings.canForward || motion.readingOffset() > minimum : settings.canPrevious || motion.readingOffset() < 0);
      if (allowed) motion.capture(g.dx, g.dy);
      return allowed;
    },
    onPanResponderGrant: () => {
      // Entry and snap-back are interruptible presentation. Their native
      // completion callback must never hold the next card's input hostage.
      // An already accepted outgoing card still cannot commit another choice.
      if (motion.isAccepted() || motion.settings().disabled) return;
      translation.stopAnimation(); motion.setDragging(true); motion.begin(); gesture.begin();
      // Native PanResponder resets dx/dy on grant. The captured displacement
      // already belongs to this finger's movement, including a one-move fling.
      const position = motion.coordinates(0, 0);
      gesture.move(position.dx, position.dy, 1);
      translation.setValue(dragOffset(motion.settings(), motion.origin(), position.dy));
    },
    onPanResponderMove: (_, g) => {
      if (!motion.isDragging()) return;
      const position = motion.coordinates(g.dx, g.dy);
      gesture.move(position.dx, position.dy, g.numberActiveTouches); motion.moved();
      const settings = motion.settings();
      if (Number.isFinite(position.dy)) translation.setValue(dragOffset(settings, motion.origin(), position.dy));
    },
    onPanResponderStart: (_, g) => {
      if (g.numberActiveTouches !== 1 && motion.isDragging()) {
        gesture.cancel(); motion.setDragging(false); settle(motion.readingOffset(), false);
      }
    },
    onPanResponderRelease: (_, g) => {
      if (!motion.isDragging()) return;
      const { cardHeight: height, viewportHeight: viewport, onForwardOffset: reportOffset } = motion.settings();
      const position = motion.coordinates(g.dx, g.dy);
      const vx = motion.freshVelocity() ? g.vx ?? 0 : 0;
      const vy = motion.freshVelocity() ? g.vy ?? 0 : 0;
      const minimum = readingMinimum(motion.settings());
      const offset = motion.origin() + position.dy;
      const reading = Math.max(minimum, Math.min(0, Number.isFinite(offset) ? offset : motion.readingOffset()));
      const fling = isFeedFling(position.dx, position.dy, vx, vy) && (position.dy < 0 || motion.origin() === 0);
      const atEdge = position.dy < 0 ? minimum - offset >= FEED_DRAG_DISTANCE : offset >= FEED_DRAG_DISTANCE;
      gesture.move(position.dx, position.dy, 1);
      const readingForward = position.dy < 0 && motion.origin() > minimum;
      const accepted = !readingForward && (fling || atEdge) && gesture.release(position.dx, position.dy, vx, vy);
      if (!accepted) gesture.cancel();
      motion.setDragging(false);
      const target = accepted ? Math.max(-(height ?? 500), Math.min(viewport ?? 500, offset)) : reading;
      if (accepted && position.dy < 0 && height) reportOffset?.(Math.max(0, height + target));
      if (!accepted) motion.setReadingOffset(reading);
      motion.clearCapture(); settle(target, accepted);
    },
    onPanResponderTerminate: () => {
      gesture.cancel(); motion.setDragging(false); motion.clearCapture(); settle(motion.readingOffset(), false);
    },
    onPanResponderTerminationRequest: () => true,
  }), [gesture, motion, settle, translation]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bounded = viewportHeight !== undefined && viewportHeight > 0;
  return <Animated.View {...(!preview ? pan.panHandlers : {})} testID="feed-dismiss-surface" accessible={false}
    onLayout={() => {
      if (motion.isDragging()) { gesture.cancel(); motion.setDragging(false); motion.clearCapture(); settle(motion.readingOffset(), false); }
    }} style={[styles.card, bounded && { height: cardHeight }, { transform: [{ translateY: translation }] }]}>
    <View testID="feed-accessibility-summary" accessible={!preview}
      accessibilityLabel={[item.title, item.creators?.join(', '), item.releaseYear, item.originalLanguage, item.tags?.join(', ')].filter(Boolean).join(', ')}
      accessibilityHint="Toiminnoista voit selata seuraavaan, palata edelliseen tai avata ohjeen"
      accessibilityState={{ disabled }}
      accessibilityActions={[
        ...(cardHeight && viewportHeight && cardHeight > viewportHeight ? [
          { name: 'scrollForward', label: 'Lue kuvausta eteenpäin' },
          { name: 'scrollBackward', label: 'Lue kuvausta taaksepäin' },
        ] : []),
        ...(onSkip ? [{ name: 'increment', label: 'Seuraava kortti' }] : []),
        ...(onPrevious ? [{ name: 'decrement', label: 'Edellinen kortti ja kumoa' }] : []),
        { name: 'showHelp', label: 'Selaamisen ohje' },
      ]}
      onAccessibilityAction={event => {
        const action = event.nativeEvent.actionName;
        if (action === 'showHelp') setHelpState({ scope: helpScope, interacted: hasInteracted, visible: !help });
        else if (!disabled && (action === 'scrollForward' || action === 'scrollBackward') && viewportHeight && cardHeight) {
          gesture.cancel(); motion.setDragging(false); motion.clearCapture();
          const offset = Math.max(viewportHeight - cardHeight, Math.min(0,
            motion.readingOffset() + (action === 'scrollForward' ? -1 : 1) * viewportHeight * 0.65));
          motion.setReadingOffset(offset); settle(offset, false);
        }
        else if (!disabled && action === 'increment') gesture.press();
        else if (!disabled && action === 'decrement') gesture.previous();
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
    <View testID="feed-card-content" style={styles.content}
      onLayout={event => {
        // Measure only the non-artwork content. Its intrinsic height is stable
        // when the hero shrinks, and keeps large text/controls scrollable on
        // short viewports without a nested scroll view or a synthetic choice.
        const height = Math.ceil(event.nativeEvent.layout.height);
        if (height !== contentHeight) { setContentHeight(height); onContentHeight?.(height); }
      }}>
      <View style={styles.titleRow}>
        <Text testID="feed-title" accessibilityRole="header" accessibilityLabel={item.title}
          numberOfLines={2} ellipsizeMode="tail" style={[styles.title, styles.titleInRow, bounded && styles.boundedTitle]}>{item.title}</Text>
        {titleAction ? <View style={styles.titleActionSlot}>{titleAction}</View> : null}
      </View>
      <Text testID="feed-creators" numberOfLines={1} ellipsizeMode="tail" style={styles.muted}>{[item.creators?.join(', '), item.releaseYear, item.originalLanguage].filter(Boolean).join(' · ')}</Text>
      {item.tags?.length ? <Text numberOfLines={1} style={styles.muted}>{item.tags.slice(0, 5).join(' · ')}</Text> : null}
      <View testID="feed-description-content" style={styles.description}
        onLayout={event => {
          const height = Math.ceil(event.nativeEvent.layout.height);
          if (height !== descriptionHeight) { setDescriptionHeight(height); onDescriptionHeight?.(height); }
        }}>
        <ItemDescription item={item} expanded={expanded} onExpandedChange={value => {
          const next = typeof value === 'function' ? value(expanded) : value;
          setExpanded(next); onDescriptionExpanded?.(next);
        }} theme={theme} compact />
      </View>
      {children ? <View style={styles.controls}>{children}</View> : null}
    </View>
    {help ? <View style={styles.help} testID="feed-first-use-help">
      <Text style={styles.helpText}>{FEED_HELP}{helpKind === 'discovery' ? ' Alaspäin palaat ja kumoat. Tähti avaa listat.' : ''}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Sulje selaamisen ohje" onPress={() => {
        rememberHelp(helpScope); setHelpState({ scope: helpScope, interacted: hasInteracted, visible: false });
      }} style={styles.helpButton}><Text style={styles.text}>Selvä</Text></Pressable>
    </View> : null}
    {bounded && previousCard ? <View testID="feed-previous-preview" pointerEvents="none" accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={[styles.adjacent, { top: -(previousCardHeight ?? viewportHeight), height: previousCardHeight ?? viewportHeight }]}>{previousCard}</View> : null}
    {bounded && nextCard ? <View testID="feed-next-preview" pointerEvents="none" accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={[styles.adjacent, { top: cardHeight, height: viewportHeight }]}>{nextCard}</View> : null}
  </Animated.View>;
}
function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    card: { gap: CARD_GAP, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20, paddingTop: CARD_TOP_PADDING },
    content: { gap: CARD_GAP, flexShrink: 0 },
    adjacent: { position: 'absolute', left: 0, right: 0 },
    browse: { gap: 4 }, browseFill: { flex: 1, minHeight: 0, overflow: 'hidden' },
    hero: { height: 260, width: '100%', maxWidth: 340, alignSelf: 'center', borderRadius: 10, overflow: 'hidden', backgroundColor: theme.ambient.curtain },
    heroFill: { flex: 1, height: undefined, minHeight: 0 },
    image: { width: '100%', height: '100%', alignSelf: 'center' },
    fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, gap: 10 },
    title: { color: theme.base.textPrimary, fontSize: 20, lineHeight: 24, fontWeight: '800', textAlign: 'left', width: '100%', maxWidth: 340, alignSelf: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', width: '100%', maxWidth: 340, alignSelf: 'center', flexShrink: 0 },
    titleInRow: { width: undefined, flexShrink: 1 },
    titleActionSlot: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    boundedTitle: { flexShrink: 1 },
    type: { color: theme.base.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
    text: { color: theme.base.textPrimary, fontSize: 14, fontWeight: '700' },
    muted: { color: theme.base.textMuted, fontSize: 12, lineHeight: 16, textAlign: 'left', width: '100%', maxWidth: 340, alignSelf: 'center' },
    description: { flexGrow: 0, flexShrink: 0, paddingBottom: 2, width: '100%', maxWidth: 340, alignSelf: 'center' },
    helpButton: { alignSelf: 'flex-end', paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
    help: { position: 'absolute', top: 8, left: 8, right: 8, padding: 12, borderRadius: 12,
      backgroundColor: theme.surface.raised, borderWidth: 1, borderColor: theme.base.border, zIndex: 1 },
    helpText: { color: theme.base.textPrimary, fontSize: 13, lineHeight: 19 },
    controls: { gap: 8, paddingBottom: 12, flexShrink: 0, width: '100%', maxWidth: 360, alignSelf: 'center' },
  });
}
