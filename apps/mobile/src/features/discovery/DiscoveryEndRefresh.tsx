import { useLayoutEffect, useMemo } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RoomTheme } from '../../theme/roomTheme';

// Native RefreshControl only recognizes a pull at the top. This surface owns
// downward pulls that start on the terminal notice; the grid keeps normal scroll.
export function DiscoveryEndRefresh({ theme, disabled, onRefresh }: {
  theme: RoomTheme;
  disabled: boolean;
  onRefresh: () => void;
}) {
  const responder = useMemo(() => createEndRefreshResponder(), []);
  useLayoutEffect(() => { responder.commit(disabled, onRefresh); });
  useLayoutEffect(() => responder.clear, [responder]);

  return <View {...responder.panHandlers} style={styles.surface}>
    <Text style={[styles.text, { color: theme.base.textMuted }]}>
      Tämän haun suositukset on näytetty.
    </Text>
    <Text style={[styles.text, { color: theme.base.textMuted }]}>
      Vedä tästä alaspäin tai paina Päivitä haku.
    </Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Päivitä haku"
      accessibilityHint="Hae uudet suositukset palaamatta listan alkuun"
      accessibilityState={{ disabled }} disabled={disabled} onPress={responder.refresh}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, { color: theme.base.textPrimary }]}>Päivitä haku</Text>
    </Pressable>
  </View>;
}

function createEndRefreshResponder() {
  let current: { disabled: boolean; onRefresh: () => void } | null = null;
  let requested = false;
  function refresh() {
    if (!current || current.disabled || requested) return;
    // A fresh request replaces this keyed footer. Coalesce taps/pulls before
    // that commit rather than creating several recommendation windows.
    requested = true;
    current.onRefresh();
  }
  return {
    ...PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        Boolean(current && !current.disabled && !requested &&
          gesture.dy > 12 && gesture.dy > Math.abs(gesture.dx) * 2),
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy >= 64 && gesture.dy > Math.abs(gesture.dx) * 2) refresh();
      },
      onPanResponderTerminationRequest: () => false,
    }),
    refresh,
    commit(disabled: boolean, onRefresh: () => void) { current = { disabled, onRefresh }; },
    clear() { current = null; },
  };
}

const styles = StyleSheet.create({
  surface: { minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch' },
  text: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  button: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.65 },
});
