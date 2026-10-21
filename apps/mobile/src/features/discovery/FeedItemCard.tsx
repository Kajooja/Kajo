import { useEffect, useLayoutEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Animated, AppState, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import type { Item } from '../../domain/contracts';
import type { RoomTheme } from '../../theme/roomTheme';
import { ItemDescription } from './ItemDescription';
import { createFeedDismissal } from './feedDismissal';

const HELP_KEY = 'kajo:vertical-feed-help:v1';
export const FEED_HELP = 'Pyyhkäise ylöspäin ohittaaksesi. Ohitus ei anna arvosanaa; kohde voi palata myöhemmin.';

// Shared presentation only. Taste owns question responses; Discovery owns
// delivered Events. The hero is the gesture surface; description/control scrolls
// cannot bubble into a dismissal. Mount with the exact opportunity as key.
export function FeedItemCard({ item, theme, disabled, onSkip, children }: PropsWithChildren<{
  item: Item; theme: RoomTheme; disabled: boolean; onSkip?: () => boolean;
}>) {
  const [imageFailed, setImageFailed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [help, setHelp] = useState(() => {
    try { return Storage.getItemSync(HELP_KEY) !== 'seen'; } catch { return true; }
  });
  const [reduceMotion, setReduceMotion] = useState(false);
  const [translation] = useState(() => new Animated.Value(0));
  const gesture = useMemo(() => createFeedDismissal(), []);
  useLayoutEffect(() => {
    gesture.setCommit(() => !disabled && AppState.currentState === 'active' && onSkip?.() === true);
    return () => { gesture.setCommit(() => false); gesture.cancel(); };
  }, [disabled, onSkip, gesture]);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', () => { gesture.cancel(); translation.setValue(0); });
    return () => { active = false; gesture.cancel(); motion.remove(); app.remove(); };
  }, [gesture, translation]);
  useLayoutEffect(() => { if (disabled) gesture.cancel(); else gesture.reset(); }, [disabled, gesture]);
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, g) => !disabled && Boolean(onSkip) && AppState.currentState === 'active' &&
      g.numberActiveTouches === 1 && g.dy < -12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
    onPanResponderGrant: () => gesture.begin(),
    onPanResponderMove: (_, g) => {
      gesture.move(g.dx, g.dy, g.numberActiveTouches);
      if (!reduceMotion) translation.setValue(Math.min(0, Math.max(-150, g.dy)));
    },
    onPanResponderRelease: (_, g) => { gesture.release(g.dx, g.dy); translation.setValue(0); },
    onPanResponderTerminate: () => { gesture.cancel(); translation.setValue(0); },
    onPanResponderTerminationRequest: () => true,
  });
  const styles = createStyles(theme);
  function skip() {
    if (!disabled) gesture.press();
  }
  return <View style={styles.card}>
    <View style={styles.helpRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Ohittamisen ohje" onPress={() => setHelp(value => !value)} style={styles.helpButton}>
        <Text style={styles.muted}>Ohje · ↑</Text>
      </Pressable>
    </View>
    {help ? <View style={styles.help}>
      <Text style={styles.muted}>{FEED_HELP}</Text>
      <Pressable accessibilityRole="button" onPress={() => {
        try { Storage.setItemSync(HELP_KEY, 'seen'); } catch { /* Keep help available when storage is unavailable. */ }
        setHelp(false);
      }} style={styles.helpButton}><Text style={styles.text}>Selvä</Text></Pressable>
    </View> : null}
    <Animated.View {...pan.panHandlers} testID="feed-dismiss-surface"
      onLayout={() => { gesture.cancel(); translation.setValue(0); }}
      style={[styles.hero, { transform: [{ translateY: translation }] }]}>
      {item.imageUrl && !imageFailed ? <Image accessibilityIgnoresInvertColors
        accessibilityLabel={`${item.title}, ${item.itemType === 'MOVIE' ? 'juliste' : 'kansi'}`}
        source={{ uri: item.imageUrl, cache: 'force-cache' }} resizeMode="contain" fadeDuration={reduceMotion ? 0 : 120}
        onError={() => setImageFailed(true)} style={styles.image} />
        : <View style={styles.fallback}><Text style={styles.type}>{item.itemType === 'MOVIE' ? 'ELOKUVA' : 'KIRJA'}</Text>
          <Text style={styles.title}>{item.title}</Text></View>}
    </Animated.View>
    <Text style={styles.type}>{item.itemType === 'MOVIE' ? 'ELOKUVA' : 'KIRJA'}</Text>
    <Text accessibilityRole="header" style={styles.title}>{item.title}</Text>
    <Text style={styles.muted}>{[item.creators?.join(', '), item.releaseYear, item.originalLanguage].filter(Boolean).join(' · ')}</Text>
    {item.tags?.length ? <Text style={styles.muted}>{item.tags.slice(0, 5).join(' · ')}</Text> : null}
    <ItemDescription item={item} expanded={expanded} onExpandedChange={setExpanded} theme={theme} />
    <View style={styles.controls}>{children}
      {onSkip ? <Pressable accessibilityRole="button" accessibilityLabel="Ohita"
        accessibilityHint="Ohittaa tämän teoksen ilman arvosanaa" accessibilityState={{ disabled }} disabled={disabled}
        onPress={skip} style={[styles.skip, disabled && styles.disabled]}><Text style={styles.text}>Ohita ↑</Text></Pressable> : null}
    </View>
  </View>;
}
function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    card: { gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center' },
    hero: { height: 260, borderRadius: 14, overflow: 'hidden', backgroundColor: theme.ambient.curtain },
    image: { width: '100%', height: '100%' },
    fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 14 },
    title: { color: theme.base.textPrimary, fontSize: 24, fontWeight: '800' },
    type: { color: theme.base.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
    text: { color: theme.base.textPrimary, fontSize: 14, fontWeight: '700' },
    muted: { color: theme.base.textMuted, fontSize: 13, lineHeight: 19 },
    helpRow: { alignItems: 'flex-end' }, helpButton: { padding: 8, minHeight: 44, justifyContent: 'center' },
    help: { padding: 12, borderRadius: 12, backgroundColor: theme.surface.raised },
    controls: { gap: 12, paddingVertical: 12 },
    skip: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.base.border, justifyContent: 'center', alignItems: 'center' },
    disabled: { opacity: 0.45 },
  });
}
