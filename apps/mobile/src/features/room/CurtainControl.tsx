import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
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
  FOR_YOU: 'For you discovery mode',
  SURPRISE: 'Surprise discovery mode',
  RISK: 'Risk discovery mode',
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
  const currentPositionRef = useRef(getCurtainPositionForMode(mode));
  const dragStartPositionRef = useRef(currentPositionRef.current);
  const maxTravel = Math.max(0, trackWidth - HANDLE_WIDTH - TRACK_PADDING * 2);

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
    const listenerId = position.addListener(({ value }) => {
      currentPositionRef.current = clampCurtainPosition(value);
    });

    return () => position.removeListener(listenerId);
  }, [position]);

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

    const finalPosition = clampCurtainPosition(
      dragStartPositionRef.current + deltaX / maxTravel,
    );
    const nextMode = getModeForCurtainPosition(finalPosition);

    if (nextMode === mode) {
      snapToCurrentMode();
    }

    onModeChange(nextMode);
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 2,
    onPanResponderGrant: () => {
      position.stopAnimation();
      dragStartPositionRef.current = currentPositionRef.current;
    },
    onPanResponderMove: (_, gestureState) => {
      if (maxTravel <= 0) {
        return;
      }

      const normalized = clampCurtainPosition(
        dragStartPositionRef.current + gestureState.dx / maxTravel,
      );
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
    <View style={styles.container} accessibilityLabel="Discovery curtain control">
      <View
        onLayout={handleLayout}
        style={[styles.track, { backgroundColor: baseTheme.structure }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.curtainFabric, { backgroundColor: curtainColor }]}
        />

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
            styles.handle,
            {
              backgroundColor: handleColor,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={[styles.handleLine, { backgroundColor: baseTheme.textPrimary }]} />
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
    height: 34,
    borderRadius: 17,
    paddingHorizontal: TRACK_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  curtainFabric: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.72,
  },
  markers: {
    ...StyleSheet.absoluteFillObject,
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
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleLine: {
    width: 2,
    height: 14,
    borderRadius: 1,
    opacity: 0.52,
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
