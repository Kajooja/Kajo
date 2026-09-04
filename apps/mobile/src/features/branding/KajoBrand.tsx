import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const SPLASH_MARK_SCREEN_WIDTH = 0.72;

interface StartupSplashProps {
  message?: string;
}

export function StartupSplash({ message }: StartupSplashProps) {
  const { width } = useWindowDimensions();
  const scale = (width * SPLASH_MARK_SCREEN_WIDTH) / 102;

  return (
    <View style={styles.splash}>
      <View style={styles.splashMarkFrame}>
        <View style={{ transform: [{ scale }] }}>
          <KajoMark />
        </View>
      </View>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.splashMessage}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

export function KajoMark() {
  return (
    <View accessibilityLabel="Kajo" style={styles.mark}>
      <View style={styles.wordRow}>
        <Text style={styles.word}>KAJ</Text>
        <View style={styles.earthO}>
          <View style={styles.earthVertical} />
          <View style={styles.earthHorizontal} />
        </View>
      </View>
      <View style={styles.arc} />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 28,
  },
  splashMarkFrame: {
    width: '100%',
    minHeight: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashMessage: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 22,
    opacity: 0.9,
    textAlign: 'center',
  },
  mark: {
    width: 102,
    height: 42,
    alignItems: 'center',
    justifyContent: 'flex-start',
    transform: [{ translateY: 2 }],
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 27,
  },
  word: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '300',
    letterSpacing: 2.2,
    lineHeight: 27,
  },
  earthO: {
    width: 23,
    height: 23,
    marginLeft: 2,
    borderRadius: 12,
    borderWidth: 1.7,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  earthVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1.5,
    marginLeft: -0.75,
    backgroundColor: '#FFFFFF',
  },
  earthHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1.5,
    marginTop: -0.75,
    backgroundColor: '#FFFFFF',
  },
  arc: {
    width: 48,
    height: 14,
    marginTop: 1,
    marginLeft: 48,
    borderTopWidth: 1.8,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
});
