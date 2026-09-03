import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useDiscoveryMode } from '../discovery/DiscoveryModeContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';

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
  const ambientPhase = getAmbientPhase(discoveryMode);
  const theme = getRoomTheme(ambientPhase, activeProfile.activeProfile);
  const themedStyles = createThemedStyles(theme);

  return (
    <View style={styles.backdrop}>
      <View
        pointerEvents="none"
        style={[
          styles.appAmbient,
          {
            backgroundColor: theme.ambient.wash,
            opacity: theme.ambient.washOpacity * 1.35,
          },
        ]}
      />

      <View
        style={themedStyles.scene}
        accessibilityLabel={`Kajo Room, ${ambientPhase.toLowerCase()} ambient phase`}
      >
        <View style={styles.backWall}>
          <View style={styles.windowAssembly}>
            <View
              style={[
                styles.window,
                themedStyles.window,
                { backgroundColor: theme.ambient.windowLight },
              ]}
              accessibilityLabel="Window"
            >
              <View
                pointerEvents="none"
                style={[
                  styles.windowGlow,
                  { backgroundColor: theme.ambient.windowLight },
                ]}
              />
              <View style={[styles.windowBarVertical, themedStyles.structure]} />
              <View style={[styles.windowBarHorizontal, themedStyles.structure]} />
            </View>
          </View>

          <View style={styles.movieScreen}>
            <View style={[styles.screenSurface, themedStyles.screenSurface]}>
              <Text style={[styles.objectLabel, themedStyles.objectLabel]}>ELOKUVAT</Text>
            </View>
            <View style={[styles.projectorStand, themedStyles.structure]} />
          </View>
        </View>

        <View style={[styles.roomFloor, themedStyles.roomFloor]}>
          <View style={styles.fireplace} accessibilityLabel="Fireplace">
            <View style={[styles.mantel, themedStyles.structureLight]} />
            <View style={[styles.firebox, themedStyles.firebox]}>
              <View style={[styles.ember, { backgroundColor: theme.base.ember }]} />
              <View style={[styles.flame, { backgroundColor: theme.base.flame }]} />
            </View>
          </View>

          <View style={[styles.bookshelf, themedStyles.bookshelf]}>
            <View style={[styles.shelfTop, themedStyles.structureLight]} />
            <View style={styles.booksRow}>
              <View style={[styles.book, styles.bookTall, themedStyles.book]} />
              <View style={[styles.book, themedStyles.book]} />
              <View style={[styles.book, styles.bookShort, themedStyles.book]} />
              <View style={[styles.book, styles.bookTall, themedStyles.book]} />
              <View style={[styles.book, themedStyles.book]} />
            </View>
            <View style={[styles.shelfLine, themedStyles.structureLight]} />
            <Text style={[styles.objectLabel, themedStyles.objectLabel]}>KIRJAT</Text>
          </View>
        </View>

        <View
          pointerEvents="none"
          style={[
            styles.sceneAmbient,
            {
              backgroundColor: theme.ambient.wash,
              opacity: theme.ambient.washOpacity * 1.35,
            },
          ]}
        />
      </View>
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

function createThemedStyles(theme: RoomTheme) {
  return StyleSheet.create({
    scene: {
      flex: 1,
      overflow: 'hidden',
      backgroundColor: theme.base.sceneBackground,
    },
    window: {
      borderColor: theme.base.structure,
    },
    structure: {
      backgroundColor: theme.base.structure,
    },
    structureLight: {
      backgroundColor: theme.base.structureLight,
    },
    screenSurface: {
      borderColor: theme.base.structure,
      backgroundColor: theme.base.screen,
    },
    roomFloor: {
      borderTopColor: theme.base.border,
      backgroundColor: theme.base.floor,
    },
    firebox: {
      backgroundColor: theme.base.appBackground,
      borderColor: theme.base.structure,
    },
    bookshelf: {
      borderColor: theme.base.structure,
      backgroundColor: theme.base.floor,
    },
    book: {
      backgroundColor: theme.base.book,
    },
    objectLabel: {
      color: theme.base.textPrimary,
    },
  });
}

const styles = StyleSheet.create({
  route: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    flex: 1,
  },
  appAmbient: {
    ...StyleSheet.absoluteFill,
  },
  backWall: {
    flex: 0.62,
    paddingHorizontal: 24,
    paddingTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  windowAssembly: {
    width: '40%',
    alignItems: 'stretch',
    zIndex: 1,
  },
  window: {
    width: '100%',
    aspectRatio: 0.78,
    borderWidth: 7,
    overflow: 'hidden',
  },
  windowGlow: {
    ...StyleSheet.absoluteFill,
    opacity: 0.82,
  },
  windowBarVertical: {
    position: 'absolute',
    width: 4,
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: -2,
  },
  windowBarHorizontal: {
    position: 'absolute',
    height: 4,
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -2,
  },
  movieScreen: {
    width: '46%',
    alignItems: 'center',
  },
  screenSurface: {
    width: '100%',
    aspectRatio: 1.45,
    borderRadius: 8,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectorStand: {
    width: 3,
    height: 44,
  },
  roomFloor: {
    flex: 0.38,
    minHeight: 165,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  fireplace: {
    width: '38%',
    alignItems: 'center',
  },
  mantel: {
    width: '112%',
    height: 12,
    borderRadius: 3,
  },
  firebox: {
    width: '88%',
    height: 88,
    borderWidth: 6,
    borderTopWidth: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  ember: {
    position: 'absolute',
    bottom: 12,
    width: '62%',
    height: 8,
    borderRadius: 8,
  },
  flame: {
    width: 28,
    height: 42,
    marginBottom: 15,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 18,
    transform: [{ rotate: '10deg' }],
  },
  bookshelf: {
    width: '46%',
    minHeight: 126,
    borderWidth: 4,
    paddingHorizontal: 10,
    paddingBottom: 10,
    justifyContent: 'flex-end',
  },
  shelfTop: {
    position: 'absolute',
    left: -7,
    right: -7,
    top: -7,
    height: 10,
    borderRadius: 2,
  },
  booksRow: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  book: {
    flex: 1,
    height: 49,
    borderRadius: 2,
  },
  bookTall: {
    height: 62,
  },
  bookShort: {
    height: 40,
  },
  shelfLine: {
    height: 5,
    marginTop: 5,
    marginBottom: 8,
  },
  objectLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.7,
  },
  sceneAmbient: {
    ...StyleSheet.absoluteFill,
  },
  interactionLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  movieHitTarget: {
    position: 'absolute',
    top: 18,
    right: 16,
    width: '52%',
    height: '42%',
  },
  booksHitTarget: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    width: '54%',
    height: '33%',
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
