import { useState, type PropsWithChildren } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme } from '../../theme/roomTheme';
import { KajoMark } from '../branding/KajoBrand';
import { useEventTracking } from '../events/EventTrackingContext';
import { CurtainControl } from '../room/CurtainControl';
import { getCurtainPositionForMode } from '../room/curtainState';
import { useDiscoveryMode } from './DiscoveryModeContext';

const MODE_LABELS = {
  FOR_YOU: 'SINULLE',
  SURPRISE: 'YLLÄTYS',
  RISK: 'RISKI',
} as const;

export function DiscoveryModeShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const { mode, setMode } = useDiscoveryMode();
  const { recordEvent } = useEventTracking();
  const theme = getRoomTheme(getAmbientPhase(mode));
  const [position] = useState(
    () => new Animated.Value(getCurtainPositionForMode(mode)),
  );

  function changeMode(nextMode: typeof mode) {
    if (nextMode !== mode) {
      recordEvent({
        eventType: 'DISCOVERY_MODE_CHANGED',
        discoveryMode: nextMode,
        properties: {
          previousDiscoveryMode: mode,
          source: 'GLOBAL_MODE_BAR',
        },
      });
    }

    setMode(nextMode);
  }

  return (
    <View style={styles.shell}>
      <SafeAreaView
        edges={['top']}
        style={[styles.safeHeader, { backgroundColor: theme.base.appBackground }]}
      >
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Palaa huoneeseen"
            hitSlop={8}
            onPress={() => router.replace('/')}
            style={({ pressed }) => [styles.brand, pressed && styles.brandPressed]}
          >
            <KajoMark />
          </Pressable>
          <View style={styles.control}>
            <View style={styles.labelRow} pointerEvents="none">
              <Text style={[styles.label, { color: theme.base.textMuted }]}>LÖYTÖTILA</Text>
              <Text style={[styles.value, { color: theme.base.textPrimary }]}>
                {MODE_LABELS[mode]}
              </Text>
            </View>
            <CurtainControl
              mode={mode}
              onModeChange={changeMode}
              position={position}
              baseTheme={theme.base}
              ambientTheme={theme.ambient}
            />
          </View>
        </View>
      </SafeAreaView>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38342F',
  },
  bar: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brand: {
    width: 104,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandPressed: {
    opacity: 0.72,
  },
  control: {
    flex: 1,
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  value: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  content: {
    flex: 1,
  },
});
