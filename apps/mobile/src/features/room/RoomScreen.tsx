import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function RoomScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.room}>
        <View style={styles.header}>
          <Text style={styles.kicker}>OMA KAJO</Text>
          <Text style={styles.title}>Huone</Text>
        </View>

        <View style={styles.scene} accessibilityLabel="Kajo Room">
          <View style={styles.backWall}>
            <View style={styles.window} accessibilityLabel="Window">
              <View style={styles.windowGlow} />
              <View style={styles.windowBarVertical} />
              <View style={styles.windowBarHorizontal} />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open movie discovery"
              accessibilityHint="Opens the movie discovery placeholder"
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
              accessibilityHint="Opens the book discovery placeholder"
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
        </View>

        <Text style={styles.hint}>Huone on Kajo. Valitse esine, kun haluat siirtyä eteenpäin.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#171716',
  },
  room: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  header: {
    paddingTop: 18,
    paddingBottom: 18,
  },
  kicker: {
    color: '#A7A196',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.2,
  },
  title: {
    color: '#F1EDE5',
    fontSize: 34,
    fontWeight: '600',
    marginTop: 4,
  },
  scene: {
    flex: 1,
    minHeight: 430,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#262421',
    borderWidth: 1,
    borderColor: '#38342F',
  },
  backWall: {
    flex: 0.62,
    paddingHorizontal: 24,
    paddingTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  window: {
    width: '38%',
    aspectRatio: 0.78,
    borderWidth: 7,
    borderColor: '#4A443D',
    backgroundColor: '#C7BDA8',
    overflow: 'hidden',
  },
  windowGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#B9C1B8',
    opacity: 0.72,
  },
  windowBarVertical: {
    position: 'absolute',
    width: 4,
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: -2,
    backgroundColor: '#4A443D',
  },
  windowBarHorizontal: {
    position: 'absolute',
    height: 4,
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -2,
    backgroundColor: '#4A443D',
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
    borderColor: '#4A443D',
    backgroundColor: '#111210',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectorStand: {
    width: 3,
    height: 44,
    backgroundColor: '#4A443D',
  },
  roomFloor: {
    flex: 0.38,
    minHeight: 170,
    borderTopWidth: 1,
    borderTopColor: '#3A352F',
    backgroundColor: '#211E1B',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  fireplace: {
    width: '38%',
    alignItems: 'center',
  },
  mantel: {
    width: '112%',
    height: 12,
    borderRadius: 3,
    backgroundColor: '#5B5147',
  },
  firebox: {
    width: '88%',
    height: 88,
    backgroundColor: '#171513',
    borderWidth: 6,
    borderTopWidth: 4,
    borderColor: '#4B433B',
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
    backgroundColor: '#8A5A34',
  },
  flame: {
    width: 28,
    height: 42,
    marginBottom: 15,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 18,
    backgroundColor: '#C68A4A',
    transform: [{ rotate: '10deg' }],
  },
  bookshelf: {
    width: '46%',
    minHeight: 126,
    borderWidth: 4,
    borderColor: '#51473E',
    backgroundColor: '#2B2723',
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
    backgroundColor: '#62564A',
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
    backgroundColor: '#766D62',
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
    backgroundColor: '#62564A',
  },
  objectLabel: {
    color: '#D7D1C7',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.7,
  },
  hint: {
    color: '#9E988F',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
