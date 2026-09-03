import { useEffect, useState } from 'react';
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
} from 'react-native';

import { getAmbientPhase } from '../../domain/discovery';
import {
  getRoomTheme,
  ROOM_AMBIENT_BY_PHASE,
} from '../../theme/roomTheme';
import { useDiscoveryMode } from '../discovery/DiscoveryModeContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { getCurtainPositionForMode } from './curtainState';

const CABIN_ROOM_ART = require('../../../assets/room-cabin-2d.png');

const PHASE_SHADE_OPACITY = {
  DAWN: 0.02,
  EVENING: 0.1,
  NIGHT: 0.27,
} as const;

const WINDOW_GLOW_OPACITY = {
  DAWN: 0.18,
  EVENING: 0.22,
  NIGHT: 0.16,
} as const;

const FIRE_GLOW_OPACITY = {
  DAWN: 0.17,
  EVENING: 0.22,
  NIGHT: 0.16,
} as const;

const MODE_TRANSITION_DURATION_MS = 680;

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

function WindowKajo({
  phasePosition,
  pulse,
}: {
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
  const wideBeamOpacity = Animated.multiply(
    phasePosition.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.07, 0.1, 0.07],
    }),
    pulseOpacity,
  );
  const narrowBeamOpacity = Animated.multiply(
    phasePosition.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.08, 0.11, 0.08],
    }),
    pulseOpacity,
  );

  return (
    <View pointerEvents="none" style={styles.kajoLayer}>
      <Animated.View
        style={[
          styles.windowHalo,
          {
            backgroundColor: lightColor,
            opacity: haloOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.windowBeamWide,
          {
            backgroundColor: lightColor,
            opacity: wideBeamOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.windowBeamNarrow,
          {
            backgroundColor: lightColor,
            opacity: narrowBeamOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
    </View>
  );
}

function FireplaceKajo({
  color,
  phasePosition,
  pulse,
}: {
  color: string;
  phasePosition: Animated.Value;
  pulse: Animated.Value;
}) {
  const fireColor = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      color,
      color,
      ROOM_AMBIENT_BY_PHASE.NIGHT.curtainHighlight,
    ],
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
      outputRange: [0.12, 0.15, 0.11],
    }),
    pulseOpacity,
  );
  const coreOpacity = Animated.multiply(
    phasePosition.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.18, 0.22, 0.16],
    }),
    pulseOpacity,
  );

  return (
    <View pointerEvents="none" style={styles.kajoLayer}>
      <Animated.View
        style={[
          styles.fireHalo,
          {
            backgroundColor: fireColor,
            opacity: haloOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.fireMidGlow,
          {
            backgroundColor: fireColor,
            opacity: midOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.fireCore,
          {
            backgroundColor: fireColor,
            opacity: coreOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
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

  const phaseShadeColor = phasePosition.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      ROOM_AMBIENT_BY_PHASE.DAWN.wash,
      ROOM_AMBIENT_BY_PHASE.EVENING.wash,
      '#101927',
    ],
  });
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
        resizeMode="cover"
        source={CABIN_ROOM_ART}
        style={styles.roomImageFrame}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.phaseShade,
            {
              backgroundColor: phaseShadeColor,
              opacity: phaseShadeOpacity,
            },
          ]}
        />

        <WindowKajo
          phasePosition={phasePosition}
          pulse={windowPulse}
        />
        <FireplaceKajo
          color={theme.base.flame}
          phasePosition={phasePosition}
          pulse={firePulse}
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
      </ImageBackground>
    </View>
  );
}

export function RoomInteractionLayer() {
  return (
    <View pointerEvents="box-none" style={styles.interactionLayer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open movie discovery"
        accessibilityHint="Opens the movie discovery grid"
        onPress={() => router.push('/discovery/movies')}
        style={({ pressed }) => [
          styles.movieHitTarget,
          pressed && styles.pressed,
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open book discovery"
        accessibilityHint="Opens the book discovery grid"
        onPress={() => router.push('/discovery/books')}
        style={({ pressed }) => [
          styles.booksHitTarget,
          pressed && styles.pressed,
        ]}
      />
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
  },
  kajoLayer: {
    ...StyleSheet.absoluteFill,
  },
  windowHalo: {
    position: 'absolute',
    width: '54%',
    height: '36%',
    left: '-11%',
    top: '13%',
    borderRadius: 320,
  },
  windowBeamWide: {
    position: 'absolute',
    width: '46%',
    height: '24%',
    left: '-2%',
    top: '25%',
    borderRadius: 100,
  },
  windowBeamNarrow: {
    position: 'absolute',
    width: '35%',
    height: '15%',
    left: '1%',
    top: '23%',
    borderRadius: 80,
  },
  fireHalo: {
    position: 'absolute',
    width: '52%',
    aspectRatio: 1,
    left: '-12%',
    top: '39%',
    borderRadius: 360,
  },
  fireMidGlow: {
    position: 'absolute',
    width: '34%',
    aspectRatio: 1,
    left: '1%',
    top: '45%',
    borderRadius: 240,
  },
  fireCore: {
    position: 'absolute',
    width: '19%',
    height: '12%',
    left: '10%',
    top: '51%',
    borderRadius: 100,
  },
  ambientWash: {
    ...StyleSheet.absoluteFill,
  },
  interactionLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  movieHitTarget: {
    position: 'absolute',
    top: '40%',
    right: '25%',
    width: '40%',
    height: '27%',
    borderRadius: 18,
  },
  booksHitTarget: {
    position: 'absolute',
    top: '32%',
    right: '3%',
    width: '23%',
    height: '38%',
    borderRadius: 16,
  },
  pressed: {
    backgroundColor: 'rgba(255, 243, 218, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 243, 218, 0.22)',
  },
});
