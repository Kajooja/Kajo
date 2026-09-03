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

const HANDLE_WIDTH = 22;
const TRACK_PADDING = 2;

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
      const nextPosition = Math.min(
        1,
        Math.max(0, activeDragStart + gestureState.dx / maxTravel),
      );
      position.setValue(nextPosition);
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
      <View style={styles.previewRail} pointerEvents="none">
        <Animated.View style={[styles.previewBubble, { transform: [{ translateX }] }]}>
          {Array.from({ length: MAX_ITEM_RATING + 1 }, (_, value) => {
            const center = value / MAX_ITEM_RATING;
            const opacity = value === 0
              ? position.interpolate({
                  inputRange: [0, 0.055],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                })
              : value === MAX_ITEM_RATING
                ? position.interpolate({
                    inputRange: [0.945, 1],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                  })
                : position.interpolate({
                    inputRange: [center - 0.055, center, center + 0.055],
                    outputRange: [0, 1, 0],
                    extrapolate: 'clamp',
                  });

            return (
              <Animated.Text
                key={value}
                style={[
                  styles.value,
                  { color: theme.base.textPrimary, opacity },
                ]}
              >
                {value}
              </Animated.Text>
            );
          })}
        </Animated.View>
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
          text: rating === null ? 'Valitse arvosana, lähtöarvo 5' : `${rating} / 10`,
        }}
        accessibilityActions={[{ name: 'decrement' }, { name: 'increment' }]}
        onAccessibilityAction={handleAccessibilityAction}
        style={[
          styles.track,
          {
            backgroundColor: theme.surface.raised,
            borderColor: theme.base.structureLight,
          },
          disabled && styles.disabled,
        ]}
      >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 2 },
  previewRail: {
    height: 18,
    paddingHorizontal: TRACK_PADDING,
  },
  previewBubble: {
    width: HANDLE_WIDTH,
    height: 18,
    alignItems: 'center',
  },
  value: {
    position: 'absolute',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  track: {
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: TRACK_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  handle: {
    width: HANDLE_WIDTH,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleLine: { width: 2, height: 10, borderRadius: 1, opacity: 0.56 },
  disabled: { opacity: 0.4 },
});
