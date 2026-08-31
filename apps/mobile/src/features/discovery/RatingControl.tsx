import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import type { RoomTheme } from '../../theme/roomTheme';
import {
  MAX_ITEM_RATING,
  clampRating,
  getRatingForTrackPosition,
  getRatingPosition,
} from './ratingState';

interface RatingControlProps {
  rating: number | null;
  disabled: boolean;
  theme: RoomTheme;
  onRatingChange: (rating: number) => void;
}

const HANDLE_WIDTH = 24;
const TRACK_PADDING = 4;

export function RatingControl({
  rating,
  disabled,
  theme,
  onRatingChange,
}: RatingControlProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [position] = useState(
    () => new Animated.Value(getRatingPosition(rating)),
  );
  const maxTravel = Math.max(0, trackWidth - HANDLE_WIDTH - TRACK_PADDING * 2);
  let activeDragStart = getRatingPosition(rating);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const target = getRatingPosition(rating);

    if (reduceMotion) {
      position.setValue(target);
      return;
    }

    Animated.timing(position, {
      toValue: target,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [position, rating, reduceMotion]);

  function animateTo(target: number, duration: number) {
    if (reduceMotion) {
      position.setValue(target);
      return;
    }
    Animated.timing(position, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  function selectRating(nextRating: number) {
    const snapped = clampRating(nextRating);
    animateTo(getRatingPosition(snapped), 180);
    onRatingChange(snapped);
  }

  function completeDrag(deltaX: number) {
    if (maxTravel <= 0) return;
    selectRating((activeDragStart + deltaX / maxTravel) * MAX_ITEM_RATING);
  }

  function handleTrackPress(event: GestureResponderEvent) {
    selectRating(
      getRatingForTrackPosition(event.nativeEvent.locationX, trackWidth),
    );
  }

  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    const current = rating ?? 5;
    const direction = event.nativeEvent.actionName === 'increment' ? 1 : -1;
    selectRating(current + direction);
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      !disabled && Math.abs(gestureState.dx) > 2,
    onPanResponderGrant: () => {
      position.stopAnimation((value) => {
        activeDragStart = Math.min(1, Math.max(0, value));
      });
    },
    onPanResponderMove: (_, gestureState) => {
      if (maxTravel <= 0) return;
      position.setValue(
        Math.min(1, Math.max(0, activeDragStart + gestureState.dx / maxTravel)),
      );
    },
    onPanResponderRelease: (_, gestureState) => completeDrag(gestureState.dx),
    onPanResponderTerminate: (_, gestureState) => completeDrag(gestureState.dx),
  });

  const translateX = position.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxTravel],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <View style={styles.labels} pointerEvents="none">
        <Text style={[styles.edgeLabel, { color: theme.base.textMuted }]}>EN PIDÄ</Text>
        <Text style={[styles.value, { color: theme.base.textPrimary }]}>
          {rating === null ? '–' : rating}
        </Text>
        <Text style={[styles.edgeLabel, { color: theme.base.textMuted }]}>PIDÄN</Text>
      </View>
      <Pressable
        disabled={disabled}
        onLayout={(event: LayoutChangeEvent) =>
          setTrackWidth(event.nativeEvent.layout.width)
        }
        onPress={handleTrackPress}
        accessibilityRole="adjustable"
        accessibilityLabel="Arvosana"
        accessibilityHint="Napauta asteikkoa tai säädä vetämällä nollan ja kymmenen välillä"
        accessibilityValue={{
          min: 0,
          max: 10,
          now: rating ?? 5,
          text: rating === null ? 'Ei arvosanaa' : `${rating} / 10`,
        }}
        accessibilityActions={[{ name: 'decrement' }, { name: 'increment' }]}
        onAccessibilityAction={handleAccessibilityAction}
        style={[
          styles.track,
          {
            backgroundColor: theme.base.structure,
            borderColor: theme.base.structureLight,
          },
          disabled && styles.disabled,
        ]}
      >
        <View pointerEvents="none" style={styles.markers}>
          {Array.from({ length: 11 }, (_, value) => (
            <View
              key={value}
              style={[
                styles.marker,
                { backgroundColor: theme.base.structureLight },
              ]}
            />
          ))}
        </View>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.handle,
            {
              backgroundColor: theme.ambient.curtainHighlight,
              transform: [{ translateX }],
            },
          ]}
        >
          <View
            style={[
              styles.handleLine,
              { backgroundColor: theme.base.appBackground },
            ]}
          />
        </Animated.View>
      </Pressable>
      <View style={styles.numbers} pointerEvents="none">
        <Text style={[styles.number, { color: theme.base.textMuted }]}>0</Text>
        <Text style={[styles.number, { color: theme.base.textMuted }]}>10</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 6 },
  labels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  edgeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  value: { minWidth: 24, textAlign: 'center', fontSize: 15, fontWeight: '800' },
  track: {
    height: 34,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: TRACK_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  markers: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marker: { width: 3, height: 6, borderRadius: 2 },
  handle: {
    width: HANDLE_WIDTH,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleLine: { width: 2, height: 16, borderRadius: 1, opacity: 0.56 },
  numbers: { flexDirection: 'row', justifyContent: 'space-between' },
  number: { fontSize: 10, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
