import type { DescriptionAttribution } from '@kajo/catalog-contracts';
import { isAttributionUrl } from '@kajo/catalog-contracts';
import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

export function DescriptionCredit({ attribution, color }: { attribution: DescriptionAttribution; color: string }) {
  const textStyle = [styles.text, { color }];
  const open = async (url: string) => {
    if (!isAttributionUrl(url)) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Linkki ei auennut', 'Yritä uudelleen hetken kuluttua.'); }
  };
  return (
    <View style={styles.credit}>
      <Text style={textStyle}>{attribution.credit}</Text>
      <Pressable accessibilityRole="link" accessibilityLabel={`Kuvauksen lähde: ${attribution.sourceTitle}`}
        onPress={() => void open(attribution.sourceUrl)} style={styles.link}>
        <Text style={[textStyle, styles.underlined]}>Lähde: {attribution.sourceTitle}</Text>
      </Pressable>
      {attribution.sourceRevision ? <Text style={textStyle}>Versio: {attribution.sourceRevision}</Text> : null}
      <Pressable accessibilityRole="link" accessibilityLabel={`Kuvauksen lisenssi: ${attribution.licenseName}`}
        onPress={() => void open(attribution.licenseUrl)} style={styles.link}>
        <Text style={[textStyle, styles.underlined]}>{attribution.licenseName}</Text>
      </Pressable>
      <Text style={textStyle}>Muutokset: {attribution.changes}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  credit: { gap: 3, marginTop: 10 },
  text: { fontSize: 12, lineHeight: 18 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  underlined: { textDecorationLine: 'underline' },
});
