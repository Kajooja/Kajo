import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { getAmbientPhase } from '../../domain/discovery';
import {
  getRoomTheme,
  ROOM_AMBIENT_BY_PHASE,
} from '../../theme/roomTheme';
import { useDiscoveryMode } from '../discovery/DiscoveryModeContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { getCurtainPositionForMode } from './curtainState';
import {
  mapRoomRectForCover,
  ROOM_ART_RECTS,
  type RoomRect,
  type RoomSize,
} from './roomGeometry';

const CABIN_ROOM_ART = require('../../../assets/room-cabin-2d.png');
const SOFT_KAJO_MASK = require('../../../assets/soft-kajo-mask.png');

const PHASE_SHADE_OPACITY = {
  DAWN: 0.02,
  EVENING: 0.16,
  NIGHT: 0.43,
} as const;

const WINDOW_GLOW_OPACITY = {
  DAWN: 0.3,
  EVENING: 0.22,
  NIGHT: 0.13,
} as const;

const FIRE_GLOW_OPACITY = {
  DAWN: 0.12,
  EVENING: 0.24,
  NIGHT: 0.4,
} as const;

const MODE_TRANSITION_DURATION_MS = 680;

function useRoomLayout() {
  const [layout, setLayout] = useState<RoomSize | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setLayout((current) =>
      current?.width === width && current.height === height
        ? current
        : { width, height },
    );
  }, []);

  return { layout, onLayout };
}

function getMappedStyle(layout: RoomSize, rect: RoomRect) {
  return {
    position: 'absolute' as const,
    ...mapRoomRectForCover(layout, rect),
  };
}

function useReduceMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
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

  return reduceMotion;
}

function WindowScene({
  layout,
  phasePosition,
}: {
  layout: RoomSize;
  phasePosition: Animated.Value;
}) {
  const paneColor = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      'rgba(225, 216, 188, 0.12)',
      'rgba(205, 137, 105, 0.2)',
      'rgba(20, 35, 58, 0.82)',
    ],
  });
  const sunOpacity = phasePosition.interpolate({
    inputRange: [0, 0.5, 0.78, 1],
    outputRange: [0.72, 0.9, 0.18, 0],
  });
  const moonOpacity = phasePosition.interpolate({
    inputRange: [0, 0.62, 1],
    outputRange: [0, 0, 0.92],
  });
  const starsOpacity = phasePosition.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0, 0.55],
  });
  const cloudOpacity = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 0.34, 0.22],
  });
  const topRight = mapRoomRectForCover(layout, ROOM_ART_RECTS.windowTopRight);
  const topLeft = mapRoomRectForCover(layout, ROOM_ART_RECTS.windowTopLeft);
  const cloudShift = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-topLeft.width * 0.08, topLeft.width * 0.08, topLeft.width * 0.2],
  });
  const sunShiftX = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-topRight.width * 0.2, topRight.width * 0.08, topRight.width * 0.08],
  });
  const sunShiftY = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [topRight.height * 0.28, topRight.height * 0.05, topRight.height * 0.05],
  });

  return (
    <View pointerEvents="none" style={styles.kajoLayer}>
      {[
        ROOM_ART_RECTS.windowTopLeft,
        ROOM_ART_RECTS.windowTopRight,
        ROOM_ART_RECTS.windowBottomLeft,
        ROOM_ART_RECTS.windowBottomRight,
      ].map((pane, index) => (
        <Animated.View
          key={index}
          style={[
            getMappedStyle(layout, pane),
            styles.windowPane,
            { backgroundColor: paneColor },
          ]}
        />
      ))}

      <View
        style={[
          getMappedStyle(layout, ROOM_ART_RECTS.windowTopLeft),
          styles.windowPane,
        ]}
      >
        <Animated.View
          style={[
            styles.cloud,
            {
              opacity: cloudOpacity,
              transform: [{ translateX: cloudShift }],
            },
          ]}
        >
          <View style={[styles.cloudLobe, styles.cloudLobeLeft]} />
          <View style={[styles.cloudLobe, styles.cloudLobeRight]} />
        </Animated.View>
        <Animated.View style={[styles.stars, { opacity: starsOpacity }]}>
          <View style={[styles.star, styles.starOne]} />
          <View style={[styles.star, styles.starTwo]} />
          <View style={[styles.star, styles.starThree]} />
        </Animated.View>
      </View>

      <View
        style={[
          getMappedStyle(layout, ROOM_ART_RECTS.windowTopRight),
          styles.windowPane,
        ]}
      >
        <Animated.View
          style={[
            styles.sun,
            {
              opacity: sunOpacity,
              transform: [
                { translateX: sunShiftX },
                { translateY: sunShiftY },
              ],
            },
          ]}
        />
        <Animated.View style={[styles.moon, { opacity: moonOpacity }]}>
          <View style={styles.moonShade} />
        </Animated.View>
      </View>
    </View>
  );
}

function WindowKajo({
  layout,
  phasePosition,
  pulse,
}: {
  layout: RoomSize;
  phasePosition: Animated.Value;
  pulse: Animated.Value;
}) {
  const lightColor = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      ROOM_AMBIENT_BY_PHASE.DAWN.windowLight,
      ROOM_AMBIENT_BY_PHASE.EVENING.windowLight,
      ROOM_AMBIENT_BY_PHASE.NIGHT.windowLight,
    ],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.84, 1],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.025],
  });
  const haloOpacity = Animated.multiply(
    phasePosition.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [
        WINDOW_GLOW_OPACITY.DAWN,
        WINDOW_GLOW_OPACITY.EVENING,
        WINDOW_GLOW_OPACITY.NIGHT,
      ],
    }),
    pulseOpacity,
  );
  const beamOpacity = Animated.multiply(
    phasePosition.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.16, 0.12, 0.07],
    }),
    pulseOpacity,
  );

  return (
    <View pointerEvents="none" style={styles.kajoLayer}>
      <Animated.Image
        resizeMode="stretch"
        source={SOFT_KAJO_MASK}
        style={[
          getMappedStyle(layout, ROOM_ART_RECTS.windowLight),
          {
            opacity: haloOpacity,
            tintColor: lightColor,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <Animated.Image
        resizeMode="stretch"
        source={SOFT_KAJO_MASK}
        style={[
          getMappedStyle(layout, { x: 45, y: 430, width: 650, height: 430 }),
          {
            opacity: beamOpacity,
            tintColor: lightColor,
            transform: [{ rotate: '-7deg' }, { scale: pulseScale }],
          },
        ]}
      />
    </View>
  );
}

function FireplaceKajo({
  layout,
  phasePosition,
  pulse,
}: {
  layout: RoomSize;
  phasePosition: Animated.Value;
  pulse: Animated.Value;
}) {
  const fireColor = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#D39B58', '#D9824F', '#79A9D5'],
  });
  const fireCoreColor = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#F2C36E', '#F3AE61', '#C9E2F2'],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.68, 1],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.035],
  });
  const haloOpacity = Animated.multiply(
    phasePosition.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [
        FIRE_GLOW_OPACITY.DAWN,
        FIRE_GLOW_OPACITY.EVENING,
        FIRE_GLOW_OPACITY.NIGHT,
      ],
    }),
    pulseOpacity,
  );
  const midOpacity = Animated.multiply(
    phasePosition.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.08, 0.16, 0.28],
    }),
    pulseOpacity,
  );
  const flameScale = Animated.multiply(
    phasePosition.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.68, 0.98, 1.28],
    }),
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.94, 1.06],
    }),
  );

  return (
    <View pointerEvents="none" style={styles.kajoLayer}>
      <View
        style={[
          getMappedStyle(layout, { x: 161, y: 912, width: 70, height: 103 }),
          styles.originalFlameCover,
        ]}
      />
      <Animated.Image
        resizeMode="stretch"
        source={SOFT_KAJO_MASK}
        style={[
          getMappedStyle(layout, ROOM_ART_RECTS.fireplaceLight),
          {
            opacity: haloOpacity,
            tintColor: fireColor,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <Animated.Image
        resizeMode="stretch"
        source={SOFT_KAJO_MASK}
        style={[
          getMappedStyle(layout, { x: 72, y: 790, width: 360, height: 430 }),
          {
            opacity: midOpacity,
            tintColor: fireColor,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <View
        style={[
          getMappedStyle(layout, ROOM_ART_RECTS.flame),
          styles.flameAnchor,
        ]}
      >
        <Animated.View
          style={[
            styles.flameOuter,
            {
              backgroundColor: fireColor,
              transform: [{ scale: flameScale }, { rotate: '45deg' }],
            },
          ]}
        >
          <Animated.View
            style={[styles.flameInner, { backgroundColor: fireCoreColor }]}
          />
        </Animated.View>
      </View>
    </View>
  );
}

export function RoomScreen() {
  return (
    <View pointerEvents="box-none" style={styles.route}>
      <StatusBar style="light" />
    </View>
  );
}

export function RoomBackdrop() {
  const activeProfile = useActiveProfile();
  const { mode: discoveryMode } = useDiscoveryMode();
  const reduceMotion = useReduceMotionPreference();
  const ambientPhase = getAmbientPhase(discoveryMode);
  const theme = getRoomTheme(ambientPhase, activeProfile.activeProfile);
  const { layout, onLayout } = useRoomLayout();
  const [phasePosition] = useState(
    () => new Animated.Value(getCurtainPositionForMode(discoveryMode)),
  );
  const [windowPulse] = useState(() => new Animated.Value(0));
  const [firePulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const target = getCurtainPositionForMode(discoveryMode);

    if (reduceMotion) {
      phasePosition.setValue(target);
      return;
    }

    Animated.timing(phasePosition, {
      toValue: target,
      duration: MODE_TRANSITION_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [discoveryMode, phasePosition, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      windowPulse.setValue(0.5);
      firePulse.setValue(0.5);
      return;
    }

    windowPulse.setValue(0);
    firePulse.setValue(0);

    const windowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(windowPulse, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(windowPulse, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    const fireAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(firePulse, {
          toValue: 1,
          duration: 460,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(firePulse, {
          toValue: 0,
          duration: 680,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );

    windowAnimation.start();
    fireAnimation.start();

    return () => {
      windowAnimation.stop();
      fireAnimation.stop();
    };
  }, [firePulse, reduceMotion, windowPulse]);

  const phaseShadeOpacity = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      PHASE_SHADE_OPACITY.DAWN,
      PHASE_SHADE_OPACITY.EVENING,
      PHASE_SHADE_OPACITY.NIGHT,
    ],
  });
  const ambientWashColor = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      ROOM_AMBIENT_BY_PHASE.DAWN.wash,
      ROOM_AMBIENT_BY_PHASE.EVENING.wash,
      ROOM_AMBIENT_BY_PHASE.NIGHT.wash,
    ],
  });
  const ambientWashOpacity = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      ROOM_AMBIENT_BY_PHASE.DAWN.washOpacity * 0.72,
      ROOM_AMBIENT_BY_PHASE.EVENING.washOpacity * 0.72,
      ROOM_AMBIENT_BY_PHASE.NIGHT.washOpacity * 0.72,
    ],
  });

  return (
    <View style={[styles.backdrop, { backgroundColor: theme.base.appBackground }]}>
      <ImageBackground
        accessibilityLabel={`Kajo Room, ${ambientPhase.toLowerCase()} ambient phase`}
        imageStyle={styles.roomImage}
        onLayout={onLayout}
        resizeMode="cover"
        source={CABIN_ROOM_ART}
        style={styles.roomImageFrame}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.phaseShade, { opacity: phaseShadeOpacity }]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ambientWash,
            {
              backgroundColor: ambientWashColor,
              opacity: ambientWashOpacity,
            },
          ]}
        />

        {layout ? (
          <>
            <WindowScene layout={layout} phasePosition={phasePosition} />
            <WindowKajo
              layout={layout}
              phasePosition={phasePosition}
              pulse={windowPulse}
            />
            <FireplaceKajo
              layout={layout}
              phasePosition={phasePosition}
              pulse={firePulse}
            />
          </>
        ) : null}
      </ImageBackground>
    </View>
  );
}

export function RoomInteractionLayer() {
  const { layout, onLayout } = useRoomLayout();

  return (
    <View
      onLayout={onLayout}
      pointerEvents="box-none"
      style={styles.interactionLayer}
    >
      {layout ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open movie discovery"
            accessibilityHint="Opens the movie discovery grid"
            onPress={() => router.push('/discovery/movies')}
            style={({ pressed }) => [
              getMappedStyle(layout, ROOM_ART_RECTS.tv),
              styles.hitTarget,
              pressed && styles.pressed,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open book discovery"
            accessibilityHint="Opens the book discovery grid"
            onPress={() => router.push('/discovery/books')}
            style={({ pressed }) => [
              getMappedStyle(layout, ROOM_ART_RECTS.bookshelf),
              styles.hitTarget,
              pressed && styles.pressed,
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  route: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    flex: 1,
    overflow: 'hidden',
  },
  roomImageFrame: {
    flex: 1,
    overflow: 'hidden',
  },
  roomImage: {
    width: '100%',
    height: '100%',
  },
  phaseShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#101927',
  },
  ambientWash: {
    ...StyleSheet.absoluteFill,
  },
  kajoLayer: {
    ...StyleSheet.absoluteFill,
  },
  windowPane: {
    overflow: 'hidden',
  },
  cloud: {
    position: 'absolute',
    left: '6%',
    top: '52%',
    width: '58%',
    height: '14%',
    borderRadius: 100,
    backgroundColor: 'rgba(220, 224, 218, 0.72)',
  },
  cloudLobe: {
    position: 'absolute',
    bottom: '18%',
    borderRadius: 100,
    backgroundColor: 'rgba(220, 224, 218, 0.72)',
  },
  cloudLobeLeft: {
    left: '16%',
    width: '34%',
    height: '155%',
  },
  cloudLobeRight: {
    right: '12%',
    width: '28%',
    height: '120%',
  },
  stars: {
    ...StyleSheet.absoluteFill,
  },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#DCE6ED',
  },
  starOne: {
    left: '18%',
    top: '20%',
  },
  starTwo: {
    left: '62%',
    top: '34%',
  },
  starThree: {
    left: '38%',
    top: '58%',
  },
  sun: {
    position: 'absolute',
    left: '34%',
    top: '8%',
    width: '25%',
    aspectRatio: 1,
    borderRadius: 100,
    backgroundColor: '#F2D49A',
  },
  moon: {
    position: 'absolute',
    right: '16%',
    top: '13%',
    width: '25%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: 100,
    backgroundColor: '#D5DEE3',
  },
  moonShade: {
    position: 'absolute',
    left: '-26%',
    top: '-12%',
    width: '88%',
    height: '88%',
    borderRadius: 100,
    backgroundColor: '#26384F',
  },
  originalFlameCover: {
    borderRadius: 40,
    backgroundColor: '#37322A',
  },
  flameAnchor: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  flameOuter: {
    width: '43%',
    height: '43%',
    marginBottom: '16%',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
    borderBottomLeftRadius: 76,
    borderBottomRightRadius: 18,
  },
  flameInner: {
    width: '48%',
    height: '52%',
    marginRight: '8%',
    marginBottom: '5%',
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 12,
  },
  interactionLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  hitTarget: {
    borderRadius: 12,
  },
  pressed: {
    backgroundColor: 'rgba(255, 243, 218, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 243, 218, 0.08)',
  },
});
