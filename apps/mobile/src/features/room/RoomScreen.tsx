import { useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAmbientPhase } from '../../domain/discovery';
import { getRoomTheme, type RoomTheme } from '../../theme/roomTheme';
import { useAuthSession } from '../auth/AuthSessionProvider';
import { useDiscoveryMode } from '../discovery/DiscoveryModeContext';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { usePersonalProfile } from '../profiles/PersonalProfileProvider';

export function RoomScreen() {
  const auth = useAuthSession();
  const activeProfile = useActiveProfile();
  const personalProfile = usePersonalProfile();
  const { mode: discoveryMode } = useDiscoveryMode();
  const ambientPhase = getAmbientPhase(discoveryMode);
  const theme = getRoomTheme(ambientPhase);
  const styles = createStyles(theme);
  const [signingOut, setSigningOut] = useState(false);
  const identityLabel = getRoomIdentityLabel(activeProfile, personalProfile);

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    const result = await auth.signOut();

    if (result.status === 'error') {
      setSigningOut(false);
      Alert.alert('Uloskirjautuminen epäonnistui', result.message);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="light" />
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

      <View style={styles.room}>
        <View style={styles.header}>
          <View style={styles.identity}>
            <Text numberOfLines={1} style={styles.kicker}>
              {identityLabel}
            </Text>
            <Text style={styles.title}>Huone</Text>
          </View>
          {auth.status === 'signed-in' ? (
            <Pressable
              accessibilityRole="button"
              disabled={signingOut}
              onPress={() => void handleSignOut()}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && styles.pressed,
                signingOut && styles.disabled,
              ]}
            >
              <Text style={styles.signOutText}>
                {signingOut ? 'Kirjaudutaan…' : 'Kirjaudu ulos'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View
          style={styles.scene}
          accessibilityLabel={`Kajo Room, ${ambientPhase.toLowerCase()} ambient phase`}
        >
          <View style={styles.backWall}>
            <View style={styles.windowAssembly}>
              <View
                style={[
                  styles.window,
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
                <View style={styles.windowBarVertical} />
                <View style={styles.windowBarHorizontal} />
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Avaa yhteiset Kajot"
              accessibilityHint="Näyttää yhteiset Kajo-profiilit ja niiden jäsenet"
              onPress={() => router.push('/profiles/shared')}
              style={({ pressed }) => [
                styles.sharedFrame,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.sharedPortraitRow}>
                <View style={styles.sharedPerson} />
                <View style={styles.sharedPerson} />
              </View>
              <Text style={styles.sharedObjectLabel}>YHTEINEN</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open movie discovery"
              accessibilityHint="Opens the movie discovery grid"
              onPress={() => router.push('/discovery/movies')}
              style={({ pressed }) => [styles.movieScreen, pressed && styles.pressed]}
            >
              <View style={styles.screenSurface}>
                <Text style={styles.objectLabel}>ELOKUVAT</Text>
              </View>
              <View style={styles.projectorStand} />
            </Pressable>
          </View>

          <View style={styles.roomFloor}>
            <View style={styles.fireplace} accessibilityLabel="Fireplace">
              <View style={styles.mantel} />
              <View style={styles.firebox}>
                <View style={styles.ember} />
                <View style={styles.flame} />
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open book discovery"
              accessibilityHint="Opens the book discovery grid"
              onPress={() => router.push('/discovery/books')}
              style={({ pressed }) => [styles.bookshelf, pressed && styles.pressed]}
            >
              <View style={styles.shelfTop} />
              <View style={styles.booksRow}>
                <View style={[styles.book, styles.bookTall]} />
                <View style={styles.book} />
                <View style={[styles.book, styles.bookShort]} />
                <View style={[styles.book, styles.bookTall]} />
                <View style={styles.book} />
              </View>
              <View style={styles.shelfLine} />
              <Text style={styles.objectLabel}>KIRJAT</Text>
            </Pressable>
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

        <Text style={styles.hint}>
          Huone on Kajo. Valitse kirjat, elokuvat tai yhteinen Kajo.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function getRoomIdentityLabel(
  activeProfile: ReturnType<typeof useActiveProfile>,
  personalProfile: ReturnType<typeof usePersonalProfile>,
): string {
  if (activeProfile.activeProfile?.type === 'SHARED') {
    return `YHTEINEN KAJO · ${activeProfile.activeProfile.name}`;
  }

  return personalProfile.status === 'ready'
    ? `OMA KAJO · ${personalProfile.identity.user.nickname}`
    : 'OMA KAJO';
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.base.appBackground,
    },
    appAmbient: {
      ...StyleSheet.absoluteFill,
    },
    room: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    header: {
      paddingTop: 18,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    identity: {
      flex: 1,
      paddingRight: 12,
    },
    kicker: {
      color: theme.base.textMuted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 2.2,
    },
    title: {
      color: theme.base.textPrimary,
      fontSize: 34,
      fontWeight: '600',
      marginTop: 4,
    },
    signOutButton: {
      minHeight: 42,
      borderColor: theme.base.border,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    signOutText: {
      color: theme.base.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    scene: {
      flex: 1,
      minHeight: 390,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: theme.base.sceneBackground,
      borderWidth: 1,
      borderColor: theme.base.border,
    },
    sceneAmbient: {
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
      borderColor: theme.base.structure,
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
      backgroundColor: theme.base.structure,
    },
    windowBarHorizontal: {
      position: 'absolute',
      height: 4,
      left: 0,
      right: 0,
      top: '50%',
      marginTop: -2,
      backgroundColor: theme.base.structure,
    },
    sharedFrame: {
      position: 'absolute',
      left: '44%',
      bottom: 16,
      width: 58,
      minHeight: 58,
      zIndex: 3,
      borderWidth: 3,
      borderColor: theme.base.structureLight,
      backgroundColor: theme.base.appBackground,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 7,
    },
    sharedPortraitRow: {
      flexDirection: 'row',
      gap: 5,
    },
    sharedPerson: {
      width: 13,
      height: 13,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: theme.base.textMuted,
    },
    sharedObjectLabel: {
      color: theme.base.textMuted,
      fontSize: 7,
      fontWeight: '700',
      letterSpacing: 0.8,
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
      borderColor: theme.base.structure,
      backgroundColor: theme.base.screen,
      alignItems: 'center',
      justifyContent: 'center',
    },
    projectorStand: {
      width: 3,
      height: 44,
      backgroundColor: theme.base.structure,
    },
    roomFloor: {
      flex: 0.38,
      minHeight: 165,
      borderTopWidth: 1,
      borderTopColor: theme.base.border,
      backgroundColor: theme.base.floor,
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
      backgroundColor: theme.base.structureLight,
    },
    firebox: {
      width: '88%',
      height: 88,
      backgroundColor: theme.base.appBackground,
      borderWidth: 6,
      borderTopWidth: 4,
      borderColor: theme.base.structure,
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
      backgroundColor: theme.base.ember,
    },
    flame: {
      width: 28,
      height: 42,
      marginBottom: 15,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 5,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 18,
      backgroundColor: theme.base.flame,
      transform: [{ rotate: '10deg' }],
    },
    bookshelf: {
      width: '46%',
      minHeight: 126,
      borderWidth: 4,
      borderColor: theme.base.structure,
      backgroundColor: theme.base.floor,
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
      backgroundColor: theme.base.structureLight,
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
      backgroundColor: theme.base.book,
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
      backgroundColor: theme.base.structureLight,
    },
    objectLabel: {
      color: theme.base.textPrimary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.7,
    },
    hint: {
      color: theme.base.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 12,
      paddingHorizontal: 4,
    },
    pressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
