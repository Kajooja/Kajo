import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RoomTheme } from '../../theme/roomTheme';
import { BOTTOM_DOCK_HEIGHT } from './shellLayout';

type ChromeProps = PropsWithChildren<{ theme: RoomTheme }>;

// Taste lives outside the authenticated Discovery controllers, but its card
// must use the same measured space between safe chrome on every platform.
// Insets are consumed once: horizontal here, top in the header, bottom in dock.
export function FeedScreenFrame({ theme, children }: ChromeProps) {
  return <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.base.appBackground }]}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill,
      { backgroundColor: theme.ambient.wash, opacity: theme.ambient.washOpacity * 1.2 }]} />
    {children}
  </SafeAreaView>;
}

export function FeedScreenHeader({ theme, children }: ChromeProps) {
  return <SafeAreaView edges={['top']} style={[styles.headerBoundary,
    { backgroundColor: theme.surface.appChrome, borderBottomColor: theme.base.border }]}>
    <View style={styles.header}>{children}</View>
  </SafeAreaView>;
}

export function FeedScreenDock({ theme, children }: ChromeProps) {
  return <SafeAreaView edges={['bottom']} style={[styles.dockBoundary,
    { backgroundColor: theme.surface.appChrome, borderTopColor: theme.base.border }]}>
    <View style={styles.dock}>{children}</View>
  </SafeAreaView>;
}

export function FeedScreenViewport({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.viewport, style]} />;
}

// Keep the rating target and its side margins identical in real/preview cards
// and in Taste; the caller continues to own all rating/evidence semantics.
export function FeedRatingFrame({ children }: PropsWithChildren) {
  return <View style={styles.ratingFrame}><View style={styles.rating}>{children}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBoundary: { borderBottomWidth: StyleSheet.hairlineWidth },
  header: { minHeight: 48, paddingHorizontal: 10, paddingVertical: 2,
    flexDirection: 'row', alignItems: 'center', gap: 8 },
  dockBoundary: { borderTopWidth: StyleSheet.hairlineWidth },
  dock: { minHeight: BOTTOM_DOCK_HEIGHT, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewport: { flex: 1, minHeight: 0, overflow: 'hidden' },
  ratingFrame: { width: '100%', alignSelf: 'center', paddingHorizontal: 8 },
  rating: { width: '100%', minWidth: 0 },
});
