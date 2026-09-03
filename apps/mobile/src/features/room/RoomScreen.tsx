import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAmbientPhase } from '../../domain/discovery';
import {
  getRoomTheme,
  withColorAlpha,
  type RoomTheme,
} from '../../theme/roomTheme';
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
                  styles.skyUpper,
                  { backgroundColor: withColorAlpha(theme.ambient.wash, 0.34) },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.skyHorizon,
                  { backgroundColor: withColorAlpha(theme.base.flame, 0.2) },
                ]}
              />
              {ambientPhase === 'NIGHT' ? (
                <>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.moon,
                      { backgroundColor: withColorAlpha(theme.base.textPrimary, 0.82) },
                    ]}
                  />
                  <View style={[styles.star, styles.starOne]} />
                  <View style={[styles.star, styles.starTwo]} />
                  <View style={[styles.star, styles.starThree]} />
                </>
              ) : (
                <View
                  pointerEvents="none"
                  style={[
                    styles.sun,
                    {
                      backgroundColor: withColorAlpha(
                        theme.base.flame,
                        ambientPhase === 'EVENING' ? 0.72 : 0.42,
                      ),
                    },
                  ]}
                />
              )}
              <View
                pointerEvents="none"
                style={[
                  styles.distantHill,
                  { backgroundColor: withColorAlpha(theme.base.structure, 0.58) },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.nearHill,
                  { backgroundColor: withColorAlpha(theme.base.floor, 0.78) },
                ]}
              />
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
              <View
                pointerEvents="none"
                style={[
                  styles.screenGlow,
                  { backgroundColor: withColorAlpha(theme.ambient.windowLight, 0.1) },
                ]}
              />
              <Text style={[styles.objectLabel, themedStyles.objectLabel]}>ELOKUVAT</Text>
            </View>
            <View style={[styles.mediaConsoleTop, themedStyles.structureLight]} />
            <View style={[styles.mediaConsole, themedStyles.structure]}>
              <View
                style={[
                  styles.consoleDoor,
                  { borderColor: withColorAlpha(theme.base.structureLight, 0.7) },
                ]}
              />
              <View
                style={[
                  styles.consoleDoor,
                  { borderColor: withColorAlpha(theme.base.structureLight, 0.7) },
                ]}
              />
            </View>
            <View style={styles.consoleLegs}>
              <View style={[styles.consoleLeg, themedStyles.structure]} />
              <View style={[styles.consoleLeg, themedStyles.structure]} />
            </View>
          </View>
        </View>

        <View style={[styles.roomFloor, themedStyles.roomFloor]}>
          <View
            pointerEvents="none"
            style={[
              styles.rug,
              {
                backgroundColor: withColorAlpha(theme.base.ember, 0.34),
                borderColor: withColorAlpha(theme.base.flame, 0.28),
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.floorLight,
              { backgroundColor: withColorAlpha(theme.ambient.windowLight, 0.08) },
            ]}
          />
          <View style={styles.fireplace} accessibilityLabel="Fireplace">
            <View style={[styles.mantel, themedStyles.structureLight]} />
            <View style={[styles.firebox, themedStyles.firebox]}>
              <View
                pointerEvents="none"
                style={[
                  styles.fireGlow,
                  { backgroundColor: withColorAlpha(theme.base.flame, 0.18) },
                ]}
              />
              <View style={[styles.ember, { backgroundColor: theme.base.ember }]} />
              <View style={[styles.flame, { backgroundColor: theme.base.flame }]} />
            </View>
          </View>

          <View style={styles.bench} pointerEvents="none">
            <View
              style={[
                styles.benchCushion,
                { backgroundColor: withColorAlpha(theme.base.book, 0.86) },
              ]}
            />
            <View style={styles.benchLegs}>
              <View style={[styles.benchLeg, themedStyles.structure]} />
              <View style={[styles.benchLeg, themedStyles.structure]} />
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
    paddingHorizontal: 20,
    paddingTop: 20,
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
    borderRadius: 4,
    overflow: 'hidden',
  },
  skyUpper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '58%',
  },
  skyHorizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '48%',
    bottom: 0,
  },
  windowGlow: {
    ...StyleSheet.absoluteFill,
    opacity: 0.28,
  },
  sun: {
    position: 'absolute',
    width: 25,
    height: 25,
    right: 12,
    top: 18,
    borderRadius: 13,
  },
  moon: {
    position: 'absolute',
    width: 23,
    height: 23,
    right: 13,
    top: 16,
    borderRadius: 12,
  },
  star: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(241, 237, 229, 0.78)',
  },
  starOne: {
    left: 17,
    top: 18,
  },
  starTwo: {
    left: 40,
    top: 35,
  },
  starThree: {
    right: 42,
    top: 11,
  },
  distantHill: {
    position: 'absolute',
    left: -12,
    right: '26%',
    bottom: -18,
    height: '46%',
    borderTopRightRadius: 80,
    transform: [{ rotate: '-5deg' }],
  },
  nearHill: {
    position: 'absolute',
    left: '30%',
    right: -18,
    bottom: -21,
    height: '42%',
    borderTopLeftRadius: 80,
    transform: [{ rotate: '5deg' }],
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
    overflow: 'hidden',
  },
  screenGlow: {
    ...StyleSheet.absoluteFill,
  },
  mediaConsoleTop: {
    width: '112%',
    height: 8,
    marginTop: 9,
    borderRadius: 3,
  },
  mediaConsole: {
    width: '102%',
    height: 35,
    flexDirection: 'row',
    gap: 5,
    padding: 5,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  consoleDoor: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 2,
  },
  consoleLegs: {
    width: '88%',
    height: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  consoleLeg: {
    width: 5,
    height: 10,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  roomFloor: {
    flex: 0.38,
    minHeight: 165,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  floorLight: {
    position: 'absolute',
    width: '56%',
    height: '130%',
    top: -28,
    left: '3%',
    borderRadius: 120,
    transform: [{ rotate: '-17deg' }],
  },
  rug: {
    position: 'absolute',
    width: '58%',
    height: 76,
    left: '21%',
    bottom: 8,
    borderWidth: 2,
    borderRadius: 48,
    transform: [{ scaleY: 0.72 }],
  },
  fireplace: {
    width: '34%',
    alignItems: 'center',
    zIndex: 2,
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
  fireGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 40,
    transform: [{ scale: 1.4 }],
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
  bench: {
    position: 'absolute',
    width: '27%',
    left: '36.5%',
    bottom: 20,
    zIndex: 3,
  },
  benchCushion: {
    height: 24,
    borderRadius: 10,
  },
  benchLegs: {
    height: 28,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  benchLeg: {
    width: 6,
    height: 28,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  bookshelf: {
    width: '42%',
    minHeight: 126,
    borderWidth: 4,
    paddingHorizontal: 10,
    paddingBottom: 10,
    justifyContent: 'flex-end',
    zIndex: 2,
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
