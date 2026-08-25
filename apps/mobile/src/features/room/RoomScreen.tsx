import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface RoomScreenProps {
  onOpenBooks: () => void;
  onOpenMovies: () => void;
}

const roomColors = {
  background: '#F4F0E9',
  wall: '#E8E0D4',
  floor: '#C9B39B',
  line: '#4E433A',
  window: '#C8DDE4',
  windowGlow: '#EAF3F4',
  wood: '#705443',
  woodDark: '#4D392F',
  screen: '#F8F6F1',
  fire: '#D77745',
  fireGlow: '#E7A36F',
  text: '#302A26',
  mutedText: '#746A61',
  actionSurface: '#EEE7DD',
} as const;

export function RoomScreen({ onOpenBooks, onOpenMovies }: RoomScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.kicker}>OMA KAJO</Text>
          <Text style={styles.title}>Huone</Text>
          <Text style={styles.subtitle}>Valitse huoneesta, mihin haluat mennä.</Text>
        </View>

        <View
          accessibilityLabel="Kajon henkilökohtainen huone"
          style={styles.room}
        >
          <View style={styles.wall} />
          <View style={styles.floor} />

          <View accessibilityLabel="Ikkuna" style={styles.window}>
            <View style={styles.windowGlow} />
            <View style={styles.windowVertical} />
            <View style={styles.windowHorizontal} />
          </View>

          <Pressable
            accessibilityHint="Avaa elokuvien alue"
            accessibilityLabel="Elokuvat"
            accessibilityRole="button"
            onPress={onOpenMovies}
            style={({ pressed }) => [styles.movieScreen, pressed && styles.pressed]}
          >
            <View style={styles.screenSurface}>
              <Text style={styles.objectEyebrow}>PROJEKTORI</Text>
              <Text style={styles.objectTitle}>Elokuvat</Text>
            </View>
            <View style={styles.screenStand} />
          </Pressable>

          <Pressable
            accessibilityHint="Avaa kirjojen alue"
            accessibilityLabel="Kirjat"
            accessibilityRole="button"
            onPress={onOpenBooks}
            style={({ pressed }) => [styles.bookshelf, pressed && styles.pressed]}
          >
            <View style={styles.shelfTop} />
            <View style={styles.booksRow}>
              <View style={[styles.book, styles.bookTall]} />
              <View style={styles.book} />
              <View style={[styles.book, styles.bookShort]} />
              <View style={[styles.book, styles.bookTall]} />
            </View>
            <View style={styles.shelf} />
            <View style={styles.booksRowLower}>
              <View style={[styles.book, styles.bookShort]} />
              <View style={[styles.book, styles.bookTall]} />
              <View style={styles.book} />
            </View>
            <View style={styles.shelf} />
            <Text style={styles.bookshelfLabel}>Kirjat</Text>
          </Pressable>

          <View accessibilityLabel="Takka" style={styles.fireplace}>
            <View style={styles.mantel} />
            <View style={styles.firebox}>
              <View style={styles.fireGlow} />
              <View style={styles.flame} />
            </View>
            <Text style={styles.fireplaceLabel}>Kajo</Text>
          </View>
        </View>

        <Text style={styles.hint}>Kirjahylly ja projektori ovat huoneen ensimmäiset ovet.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: roomColors.background,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  header: {
    width: '100%',
    maxWidth: 520,
    paddingTop: 18,
    paddingBottom: 18,
  },
  kicker: {
    color: roomColors.mutedText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  title: {
    color: roomColors.text,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
    marginTop: 4,
  },
  subtitle: {
    color: roomColors.mutedText,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
  room: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    minHeight: 430,
    borderColor: roomColors.line,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  wall: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: roomColors.wall,
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '34%',
    backgroundColor: roomColors.floor,
    borderTopColor: roomColors.line,
    borderTopWidth: 1,
  },
  window: {
    position: 'absolute',
    top: '10%',
    left: '8%',
    width: '31%',
    height: '29%',
    borderColor: roomColors.line,
    borderWidth: 3,
    backgroundColor: roomColors.window,
    overflow: 'hidden',
  },
  windowGlow: {
    position: 'absolute',
    top: '12%',
    left: '10%',
    width: '54%',
    height: '44%',
    borderRadius: 999,
    backgroundColor: roomColors.windowGlow,
    opacity: 0.8,
  },
  windowVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '49%',
    width: 2,
    backgroundColor: roomColors.line,
  },
  windowHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '49%',
    height: 2,
    backgroundColor: roomColors.line,
  },
  movieScreen: {
    position: 'absolute',
    top: '12%',
    right: '7%',
    width: '43%',
    height: '30%',
    alignItems: 'center',
  },
  screenSurface: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: roomColors.line,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: roomColors.screen,
    padding: 10,
  },
  screenStand: {
    width: '34%',
    height: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: roomColors.line,
  },
  objectEyebrow: {
    color: roomColors.mutedText,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  objectTitle: {
    color: roomColors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 3,
  },
  bookshelf: {
    position: 'absolute',
    left: '7%',
    bottom: '7%',
    width: '25%',
    height: '39%',
    borderColor: roomColors.line,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: roomColors.wood,
    paddingHorizontal: 7,
    paddingTop: 7,
  },
  shelfTop: {
    height: 5,
    borderRadius: 4,
    backgroundColor: roomColors.woodDark,
    marginBottom: 6,
  },
  booksRow: {
    height: '26%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  booksRowLower: {
    height: '25%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    paddingTop: 4,
  },
  book: {
    flex: 1,
    height: '78%',
    borderRadius: 2,
    backgroundColor: roomColors.actionSurface,
  },
  bookTall: {
    height: '96%',
  },
  bookShort: {
    height: '61%',
  },
  shelf: {
    height: 5,
    borderRadius: 4,
    backgroundColor: roomColors.woodDark,
    marginTop: 5,
  },
  bookshelfLabel: {
    color: roomColors.screen,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 'auto',
    paddingBottom: 7,
    textAlign: 'center',
  },
  fireplace: {
    position: 'absolute',
    left: '39%',
    bottom: '7%',
    width: '26%',
    height: '28%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderColor: roomColors.line,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    backgroundColor: roomColors.woodDark,
    padding: 8,
  },
  mantel: {
    position: 'absolute',
    top: -9,
    width: '118%',
    height: 11,
    borderRadius: 6,
    backgroundColor: roomColors.wood,
    borderColor: roomColors.line,
    borderWidth: 1,
  },
  firebox: {
    width: '78%',
    height: '58%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderColor: roomColors.line,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 2,
    backgroundColor: '#2F2926',
  },
  fireGlow: {
    position: 'absolute',
    bottom: -20,
    width: '100%',
    height: '70%',
    borderRadius: 999,
    backgroundColor: roomColors.fireGlow,
    opacity: 0.52,
  },
  flame: {
    width: '34%',
    height: '52%',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: 999,
    transform: [{ rotate: '45deg' }],
    backgroundColor: roomColors.fire,
    marginBottom: 6,
  },
  fireplaceLabel: {
    color: roomColors.screen,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 5,
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.98 }],
  },
  hint: {
    width: '100%',
    maxWidth: 520,
    color: roomColors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    paddingTop: 12,
    textAlign: 'center',
  },
});
