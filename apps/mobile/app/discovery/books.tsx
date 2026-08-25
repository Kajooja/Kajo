import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BooksPlaceholderScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.kicker}>KIRJAHYLLY</Text>
        <Text style={styles.title}>Kirjat</Text>
        <Text style={styles.body}>
          Huoneen kirjahylly on nyt oma navigointireittinsä. Varsinainen visuaalinen
          discovery-näkymä rakennetaan myöhemmässä sprintissä.
        </Text>
        <Pressable
          accessibilityLabel="Palaa huoneeseen"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Takaisin huoneeseen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F0E9',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  kicker: {
    color: '#746A61',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  title: {
    color: '#302A26',
    fontSize: 38,
    fontWeight: '700',
    marginTop: 6,
  },
  body: {
    color: '#625A53',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 460,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 28,
    borderColor: '#4E433A',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonPressed: {
    opacity: 0.62,
  },
  buttonText: {
    color: '#302A26',
    fontSize: 14,
    fontWeight: '700',
  },
});
