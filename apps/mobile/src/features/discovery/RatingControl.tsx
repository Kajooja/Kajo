import { useEffect, useLayoutEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  type PanResponderCallbacks,
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
const DRAG_THRESHOLD = 6;
function horizontalIntent(dx: number, dy: number) {
  return Math.abs(dx) >= DRAG_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5;
}

function createRatingDrag() {
  let active = false; let start = 0.5;
  let trackTap = true; let touchStart: { x: number; y: number } | null = null;
  return {
    begin(enabled: boolean) { active = enabled; },
    setStart(value: number) { start = Math.min(1, Math.max(0, value)); },
    position(delta: number, travel: number) { return Math.min(1, Math.max(0, start + delta / travel)); },
    isActive() { return active; },
    move(dx: number, dy: number, touches: number) {
      if (touches !== 1 || (Math.abs(dy) >= DRAG_THRESHOLD && !horizontalIntent(dx, dy))) active = false;
      return active;
    },
    beginTouch(x: number, y: number, touches: number) {
      touchStart = { x, y }; trackTap = touches === 1;
    },
    moveTouch(x: number, y: number, touches: number) {
      if (touches !== 1 || (touchStart && Math.hypot(x - touchStart.x, y - touchStart.y) >= DRAG_THRESHOLD)) trackTap = false;
    },
    cancelTap() { trackTap = false; },
    takeTap() { const allowed = trackTap; trackTap = true; touchStart = null; return allowed; },
    finish() { const completed = active; active = false; return completed; },
    cancel() { active = false; },
  };
}

function createRatingResponder(initial: PanResponderCallbacks) {
  let callbacks = initial;
  return {
    update(next: PanResponderCallbacks) { callbacks = next; },
    responder: PanResponder.create({
      onStartShouldSetPanResponder: (event, gesture) => callbacks.onStartShouldSetPanResponder?.(event, gesture) ?? false,
      onMoveShouldSetPanResponder: (event, gesture) => callbacks.onMoveShouldSetPanResponder?.(event, gesture) ?? false,
      onPanResponderGrant: (event, gesture) => callbacks.onPanResponderGrant?.(event, gesture),
      onPanResponderMove: (event, gesture) => callbacks.onPanResponderMove?.(event, gesture),
      onPanResponderStart: (event, gesture) => callbacks.onPanResponderStart?.(event, gesture),
      onPanResponderRelease: (event, gesture) => callbacks.onPanResponderRelease?.(event, gesture),
      onPanResponderTerminationRequest: (event, gesture) => callbacks.onPanResponderTerminationRequest?.(event, gesture) ?? true,
      onPanResponderTerminate: (event, gesture) => callbacks.onPanResponderTerminate?.(event, gesture),
    }),
  };
}

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
  const [drag] = useState(createRatingDrag);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    const app = AppState.addEventListener('change', () => { drag.cancel(); position.setValue(getRatingPosition(rating)); });
    return () => {
      active = false;
      subscription.remove();
      app.remove();
      drag.cancel();
    };
  }, [drag, position, rating]);

  useEffect(() => { if (disabled) drag.cancel(); }, [disabled, drag]);

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
    if (disabled || AppState.currentState !== 'active') return;
    const snapped = clampRating(nextRating);
    animateTo(getRatingPosition(snapped), 180);
    onRatingChange(snapped);
  }

  function completeDrag(gesture: PanResponderGestureState) {
    const completed = drag.finish();
    // Release normally has zero active touches. Any earlier second finger or
    // vertical turn has already cancelled the drag and cannot be undone here.
    if (!completed || maxTravel <= 0 || gesture.numberActiveTouches > 1 ||
      !horizontalIntent(gesture.dx, gesture.dy)) {
      animateTo(getRatingPosition(rating), 180);
      return;
    }
    selectRating(drag.position(gesture.dx, maxTravel) * MAX_ITEM_RATING);
  }

  function handleTrackPress(event: GestureResponderEvent) {
    if (!drag.takeTap()) return;
    selectRating(
      getRatingForTrackPosition(event.nativeEvent.locationX, trackWidth),
    );
  }

  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    const action = event.nativeEvent.actionName;
    if (action !== 'increment' && action !== 'decrement') return;
    const current = rating ?? 5;
    const direction = action === 'increment' ? 1 : -1;
    selectRating(current + direction);
  }

  const gestureCallbacks = {
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      !disabled && AppState.currentState === 'active' && gestureState.numberActiveTouches === 1 &&
      horizontalIntent(gestureState.dx, gestureState.dy),
    onPanResponderGrant: (_, gestureState) => {
      drag.cancelTap();
      drag.begin(!disabled && AppState.currentState === 'active' && gestureState.numberActiveTouches === 1);
      position.stopAnimation((value) => {
        drag.setStart(value);
      });
    },
    onPanResponderMove: (_, gestureState) => {
      if (!drag.isActive() || disabled || maxTravel <= 0) return;
      if (!drag.move(gestureState.dx, gestureState.dy, gestureState.numberActiveTouches)) {
        animateTo(getRatingPosition(rating), 180);
        return;
      }
      if (!horizontalIntent(gestureState.dx, gestureState.dy)) return;
      const nextPosition = drag.position(gestureState.dx, maxTravel);
      position.setValue(nextPosition);
    },
    onPanResponderStart: (_, gestureState) => {
      if (gestureState.numberActiveTouches !== 1) { drag.cancel(); animateTo(getRatingPosition(rating), 180); }
    },
    onPanResponderRelease: (_, gestureState) => completeDrag(gestureState),
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => {
      drag.cancel();
      animateTo(getRatingPosition(rating), 180);
    },
  } satisfies PanResponderCallbacks;
  // PanResponder owns native gesture deltas. Keep that responder for the whole
  // mount, while invoking settings/callbacks from the latest committed render.
  // Membership/status updates in the surrounding feed must not restart a drag.
  const [gestureBridge] = useState(() => createRatingResponder(gestureCallbacks));
  useLayoutEffect(() => { gestureBridge.update(gestureCallbacks); });
  const panResponder = gestureBridge.responder;

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
        onLayout={(event: LayoutChangeEvent) => {
          drag.cancel();
          position.setValue(getRatingPosition(rating));
          setTrackWidth(event.nativeEvent.layout.width);
        }}
        hitSlop={12}
        onStartShouldSetResponderCapture={event => {
          const touch = event.nativeEvent;
          drag.beginTouch(touch.pageX, touch.pageY, touch.touches.length);
          return false;
        }}
        onTouchMove={event => {
          const touch = event.nativeEvent;
          drag.moveTouch(touch.pageX, touch.pageY, touch.touches.length);
        }}
        onTouchCancel={() => drag.cancelTap()}
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
          onTouchStart={() => drag.cancelTap()}
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
