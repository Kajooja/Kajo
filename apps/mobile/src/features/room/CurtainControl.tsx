import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import type { DiscoveryMode } from '../../domain/contracts';
import type { RoomAmbientTheme, RoomBaseTheme } from '../../theme/roomTheme';
import {
  CURTAIN_DISCOVERY_MODES,
  clampCurtainPosition,
  getCurtainPositionForMode,
  getModeForTrackPosition,
} from './curtainState';

interface CurtainControlProps {
  mode: DiscoveryMode;
  onModeChange: (mode: DiscoveryMode) => void;
  baseTheme: RoomBaseTheme;
  ambientTheme: RoomAmbientTheme;
}

const HANDLE_WIDTH = 58;

const ACCESSIBILITY_LABELS: Readonly<Record<DiscoveryMode, string>> = {
  FOR_YOU: 'For you discovery mode',
  SURPRISE: 'Surprise discovery mode',
  RISK: 'Risk discovery mode',
};

export function CurtainControl({ mode, onModeChange, baseTheme, ambientTheme }: CurtainControlProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [translateX] = useState(() => new Animated.Value(0));
  const maxTravel = Math.max(0, trackWidth - HANDLE_WIDTH);
  const dragStartPx = getCurtainPositionForMode(mode) * maxTravel;

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
    };
  }, []);

  useEffect(() => {
    const target = getCurtainPositionForMode(mode) * maxTravel;

    Animated.timing(translateX, {
      toValue: target,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: true,
    }).start();
  }, [maxTravel, mode, reduceMotion, translateX]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 2,
    onPanResponderMove: (_, gestureState) => {
      if (maxTravel <= 0) {
        return;
      }

      const normalized = clampCurtainPosition((dragStartPx + gestureState.dx) / maxTravel);
      translateX.setValue(normalized * maxTravel);
    },
    onPanResponderRelease: (_, gestureState) => {
      onModeChange(getModeForTrackPosition(dragStartPx + gestureState.dx, maxTravel));
    },
    onPanResponderTerminate: (_, gestureState) => {
      onModeChange(getModeForTrackPosition(dragStartPx + gestureState.dx, maxTravel));
    },
  });

  function handleLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={styles.container} accessibilityLabel="Discovery curtain control">
      <View
        onLayout={handleLayout}
        style={[styles.track, { backgroundColor: baseTheme.structure }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.markers}>
          {CURTAIN_DISCOVERY_MODES.map((discoveryMode) => (
            <View
              key={discoveryMode}
              style={[
                styles.marker,
                {
                  backgroundColor:
                    discoveryMode === mode ? ambientTheme.curtainHighlight : baseTheme.structureLight,
                },
              ]}
            />
          ))}
        </View>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.curtain,
            {
              backgroundColor: ambientTheme.curtain,
              borderColor: ambientTheme.curtainHighlight,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={[styles.pleat, { backgroundColor: ambientTheme.curtainHighlight }]} />
          <View style={[styles.pleat, { backgroundColor: ambientTheme.curtainHighlight }]} />
          <View style={[styles.pleat, { backgroundColor: ambientTheme.curtainHighlight }]} />
        </Animated.View>
      </View>

      <View style={styles.accessibleModes}>
        {CURTAIN_DISCOVERY_MODES.map((discoveryMode) => {
          const selected = discoveryMode === mode;

          return (
            <Pressable
              key={discoveryMode}
              accessibilityRole="button"
              accessibilityLabel={ACCESSIBILITY_LABELS[discoveryMode]}
              accessibilityState={{ selected }}
              onPress={() => onModeChange(discoveryMode)}
              hitSlop={8}
              style={styles.modeButton}
            >
              <View
                style={[
                  styles.modeDot,
                  {
                    backgroundColor: selected ? ambientTheme.curtainHighlight : baseTheme.structureLight,
                    opacity: selected ? 1 : 0.45,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  markers: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marker: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  curtain: {
    width: HANDLE_WIDTH,
    height: 38,
    marginLeft: 3,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  pleat: {
    width: 2,
    height: 22,
    borderRadius: 2,
    opacity: 0.45,
  },
  accessibleModes: {
    height: 34,
    marginTop: 3,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeButton: {
    width: 44,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
