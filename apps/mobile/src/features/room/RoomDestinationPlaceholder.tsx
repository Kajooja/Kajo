import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface RoomDestinationPlaceholderProps {
  title: string;
  description: string;
}

export function RoomDestinationPlaceholder({ title, description }: RoomDestinationPlaceholderProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ROOM NAVIGATION BOUNDARY</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Room"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Takaisin huoneeseen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#171716' },
  content: { flex: 1, justifyContent: 'center', padding: 28 },
  eyebrow: { color: '#99938A', fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  title: { color: '#F1EDE5', fontSize: 34, fontWeight: '600', marginTop: 8 },
  description: { color: '#B9B3AA', fontSize: 16, lineHeight: 24, marginTop: 14 },
  button: {
    alignSelf: 'flex-start',
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#5B544C',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: { color: '#E7E1D8', fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.65 },
});
