import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import type { DiscoveryMode } from '../../domain/contracts';
import {
  ROOM_AMBIENT_BY_PHASE,
  type RoomAmbientTheme,
  type RoomBaseTheme,
} from '../../theme/roomTheme';
import {
  CURTAIN_DISCOVERY_MODES,
  clampCurtainPosition,
  getCurtainPositionForMode,
  getModeForCurtainPosition,
  getModeForTrackPosition,
} from './curtainState';

interface CurtainControlProps {
  mode: DiscoveryMode;
  onModeChange: (mode: DiscoveryMode) => void;
  position: Animated.Value;
  baseTheme: RoomBaseTheme;
  ambientTheme: RoomAmbientTheme;
}

const HANDLE_WIDTH = 14;
const TRACK_PADDING = 4;

const ACCESSIBILITY_LABELS: Readonly<Record<DiscoveryMode, string>> = {
  FOR_YOU: 'Sinulle',
  SURPRISE: 'Yllätys',
  RISK: 'Riski',
};

export function CurtainControl({
  mode,
  onModeChange,
  position,
  baseTheme,
  ambientTheme,
}: CurtainControlProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const maxTravel = Math.max(0, trackWidth - HANDLE_WIDTH - TRACK_PADDING * 2);
  const dragStartPosition = getCurtainPositionForMode(mode);
  let activeDragStart = dragStartPosition;

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
    const target = getCurtainPositionForMode(mode);

    if (reduceMotion) {
      position.setValue(target);
      return;
    }

    Animated.timing(position, {
      toValue: target,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [mode, position, reduceMotion]);

  function snapToCurrentMode() {
    const target = getCurtainPositionForMode(mode);

    if (reduceMotion) {
      position.setValue(target);
      return;
    }

    Animated.timing(position, {
      toValue: target,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  function completeDrag(deltaX: number) {
    if (maxTravel <= 0) {
      return;
    }

    const finalPosition = clampCurtainPosition(activeDragStart + deltaX / maxTravel);
    const nextMode = getModeForCurtainPosition(finalPosition);

    if (nextMode === mode) {
      snapToCurrentMode();
    }

    onModeChange(nextMode);
  }

  function selectMode(nextMode: DiscoveryMode) {
    if (nextMode === mode) {
      snapToCurrentMode();
    }

    onModeChange(nextMode);
  }

  function handleTrackPress(event: GestureResponderEvent) {
    selectMode(getModeForTrackPosition(event.nativeEvent.locationX, trackWidth));
  }

  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    const currentIndex = CURTAIN_DISCOVERY_MODES.indexOf(mode);
    const direction = event.nativeEvent.actionName === 'increment' ? 1 : -1;
    const nextIndex = Math.min(
      CURTAIN_DISCOVERY_MODES.length - 1,
      Math.max(0, currentIndex + direction),
    );

    selectMode(CURTAIN_DISCOVERY_MODES[nextIndex] ?? mode);
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 2,
    onPanResponderGrant: () => {
      position.stopAnimation((value) => {
        activeDragStart = clampCurtainPosition(value);
      });
    },
    onPanResponderMove: (_, gestureState) => {
      if (maxTravel <= 0) {
        return;
      }

      const normalized = clampCurtainPosition(activeDragStart + gestureState.dx / maxTravel);
      position.setValue(normalized);
    },
    onPanResponderRelease: (_, gestureState) => completeDrag(gestureState.dx),
    onPanResponderTerminate: (_, gestureState) => completeDrag(gestureState.dx),
  });

  function handleLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  const translateX = position.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxTravel],
    extrapolate: 'clamp',
  });
  const curtainColor = position.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      ROOM_AMBIENT_BY_PHASE.DAWN.curtain,
      ROOM_AMBIENT_BY_PHASE.EVENING.curtain,
      ROOM_AMBIENT_BY_PHASE.NIGHT.curtain,
    ],
  });
  const handleColor = position.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      ROOM_AMBIENT_BY_PHASE.DAWN.curtainHighlight,
      ROOM_AMBIENT_BY_PHASE.EVENING.curtainHighlight,
      ROOM_AMBIENT_BY_PHASE.NIGHT.curtainHighlight,
    ],
  });

  return (
    <View style={styles.container}>
      <Pressable
        onLayout={handleLayout}
        onPress={handleTrackPress}
        accessibilityRole="adjustable"
        accessibilityLabel="Löytötilan verho"
        accessibilityHint="Napauta radan vasenta, keskimmäistä tai oikeaa osaa tai säädä pyyhkäisemällä"
        accessibilityValue={{ text: ACCESSIBILITY_LABELS[mode] }}
        accessibilityActions={[
          { name: 'decrement', label: 'Vähemmän riskiä' },
          { name: 'increment', label: 'Enemmän riskiä' },
        ]}
        onAccessibilityAction={handleAccessibilityAction}
        style={[
          styles.track,
          {
            backgroundColor: baseTheme.structure,
            borderColor: baseTheme.structureLight,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.curtainFabric, { backgroundColor: curtainColor }]}
        />

        <View pointerEvents="none" style={styles.markers}>
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
            styles.handle,
            {
              backgroundColor: handleColor,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={[styles.handleLine, { backgroundColor: baseTheme.textPrimary }]} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    paddingHorizontal: TRACK_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  curtainFabric: {
    ...StyleSheet.absoluteFill,
    opacity: 0.72,
  },
  markers: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marker: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  handle: {
    width: HANDLE_WIDTH,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleLine: {
    width: 2,
    height: 12,
    borderRadius: 1,
    opacity: 0.52,
  },
});
