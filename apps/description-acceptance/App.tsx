import React, { useRef, useState } from 'react';
import Constants from 'expo-constants';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ItemDescription } from '../mobile/src/features/discovery/ItemDescription';
import { getRoomTheme } from '../mobile/src/theme/roomTheme';
import type { AmbientPhase } from '../mobile/src/domain/contracts';
import { acceptanceCases } from './fixtures';

export default function App() {
  const [selectedId, setSelectedId] = useState('attributed');
  const [expanded, setExpanded] = useState(false);
  const [phase, setPhase] = useState<AmbientPhase>('DAWN');
  const [failureArmed, setFailureArmed] = useState(false);
  const failNextLink = useRef(false);
  const [linkResult, setLinkResult] = useState('Linkkejä ei ole vielä avattu.');
  const selected = acceptanceCases.find(test => test.id === selectedId)!;
  const theme = getRoomTheme(phase);
  const identity = Constants.expoConfig?.extra?.descriptionAcceptance;

  const openLink = async (url: string) => {
    if (failNextLink.current) {
      failNextLink.current = false;
      setFailureArmed(false);
      setLinkResult('Simuloitu avausvirhe. Kokeile samaa linkkiä uudelleen.');
      throw new Error('Synthetic acceptance-only link failure');
    }
    try {
      await Linking.openURL(url);
      setLinkResult(`Avauspyyntö välitetty: ${url}`);
    } catch (error) {
      setLinkResult('Käyttöjärjestelmä hylkäsi avauspyynnön. Kokeile uudelleen.');
      throw error;
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: theme.base.appBackground }]}>
        <ScrollView contentContainerStyle={styles.page}>
          <Text accessibilityRole="header" style={styles.heading}>Lähdetietojen puhelintesti</Text>
          <Text style={styles.help}>Eristetty synteettinen aineisto. Kirjautumista ei tarvita.
            Tämä testaa samaa kuvausosaa kuin Kajon kortti. Personal-, Shared- ja List-siirtymät testataan erikseen sovelluksessa.</Text>
          <Text selectable style={styles.identity}>
            {`Lähde: ${identity?.sourceCommit ?? 'TUNNISTAMATON'}${identity?.sourceDirty ? ' (työpuussa muutoksia)' : ''}\nLaite: ${Platform.OS} ${String(Platform.Version)}`}
          </Text>
          <Text style={styles.help}>Kirjaa lähdeversio, puhelinmalli ja havainnot. Kokeile myös suurta fonttia ja ruudunlukijaa. Testi ei merkitse tapauksia automaattisesti hyväksytyiksi.</Text>
          <Text accessibilityRole="header" style={styles.section}>Testitapaus</Text>
          {acceptanceCases.map(test => (
            <Pressable key={test.id} accessibilityRole="radio"
              accessibilityState={{ checked: selectedId === test.id }}
              onPress={() => { setSelectedId(test.id); setExpanded(false); }}
              style={[styles.option, selectedId === test.id && styles.selected]}>
              <Text style={styles.optionText}>{test.label}</Text>
            </Pressable>
          ))}
          <Text accessibilityRole="header" style={styles.section}>Valaistus</Text>
          <View style={styles.row}>
            {(['DAWN', 'EVENING', 'NIGHT'] as const).map((value, index) => (
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: phase === value }}
                onPress={() => setPhase(value)} style={[styles.option, phase === value && styles.selected]}>
                <Text style={styles.optionText}>{['Aamu', 'Ilta', 'Yö'][index]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.notice}>
            <Text style={styles.help}>{selected.expected}</Text>
          </View>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={{ color: theme.base.textPrimary, fontSize: 24 }}>{selected.item.title}</Text>
            <ItemDescription key={selectedId} item={selected.item} expanded={expanded}
              onExpandedChange={setExpanded} theme={theme} openLink={openLink} />
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: failureArmed }}
            disabled={failureArmed} onPress={() => { failNextLink.current = true; setFailureArmed(true); }}
            style={styles.option}>
            <Text style={styles.optionText}>{failureArmed ? 'Seuraava linkin avaus epäonnistuu' : 'Simuloi seuraavan linkin avausvirhe'}</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.help}>{linkResult}</Text>
          <Text style={styles.help}>Simulointi testaa virheilmoituksen ja uuden yrityksen. Selaimen todellinen avautuminen sekä käyttöjärjestelmän virhetilanteet kirjataan erikseen.</Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { padding: 20, paddingBottom: 40, gap: 12 },
  heading: { color: '#f1ede5', fontSize: 25, fontWeight: '700' },
  section: { color: '#f1ede5', fontSize: 18, fontWeight: '600', marginTop: 8 },
  help: { color: '#c9c5bd', fontSize: 14, lineHeight: 21 },
  identity: { color: '#c9c5bd', fontSize: 12, lineHeight: 18 },
  option: { borderWidth: 1, borderColor: '#67615a', borderRadius: 8, padding: 12, minHeight: 48, justifyContent: 'center' },
  selected: { borderColor: '#f1ede5', backgroundColor: '#38342f' },
  optionText: { color: '#f1ede5', fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { padding: 12, borderLeftWidth: 3, borderLeftColor: '#c0ad92' },
  card: { paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#67615a' },
});
