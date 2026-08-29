import { Image, StyleSheet, Text, View } from 'react-native';

export function StartupSplash() {
  return (
    <View style={styles.splash}>
      <View style={styles.splashLogoViewport}>
        <Image
          accessibilityLabel="Kajo"
          resizeMode="contain"
          source={require('../../../assets/kajo-logo-color.png')}
          style={styles.splashLogo}
        />
      </View>
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
  },
  splashLogoViewport: {
    width: '98%',
    aspectRatio: 71 / 27,
    overflow: 'hidden',
  },
  splashLogo: {
    position: 'absolute',
    width: '135.22%',
    aspectRatio: 1,
    left: '-25.35%',
    top: '-129.63%',
  },
  mark: {
    width: 102,
    height: 42,
    alignItems: 'center',
    justifyContent: 'flex-start',
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
