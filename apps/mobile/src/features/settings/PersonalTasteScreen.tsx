import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KajoMark } from '../branding/KajoBrand';
import { RatingControl } from '../discovery/RatingControl';
import type { getRoomTheme } from '../../theme/roomTheme';
import type { PersonalTasteSnapshot } from './personalTasteFlow';
import { challengeResultCopy, type TasteAnswer } from './personalTasteOperations';

export function PersonalTasteScreen({ state, theme, begun, draftRating, confirmRemoval,
  onBegin, onDraftChange, onAnswer, onBooks, onChallenge, onRetry, onReload, onContinue,
  onOpenImport, onAskRemoval, onCancelRemoval, onRemove }: {
  state: PersonalTasteSnapshot; theme: ReturnType<typeof getRoomTheme>; begun: boolean;
  draftRating: number | null; confirmRemoval: boolean;
  onBegin: () => void; onDraftChange: (rating: number) => void; onAnswer: (answer: TasteAnswer) => void;
  onBooks: () => void; onChallenge: () => void; onRetry: () => void; onReload: () => void;
  onContinue: () => void; onOpenImport: () => void; onAskRemoval: () => void;
  onCancelRemoval: () => void; onRemove: () => void;
}) {
  const styles = createStyles(theme);
  const { session, challenge } = state;
  const current = challenge?.status === 'ACTIVE' ? challenge.items.find(i => !challenge.answers.some(a => a.itemId === i.id))
    : !challenge && session?.status === 'ACTIVE' && session.decision?.kind === 'QUESTION' ? session.item : null;
  const intro = state.needsStart || !challenge && session?.status === 'ACTIVE' && !begun && session.counts?.answered === 0;
  const unavailable = challenge?.status === 'CATALOG_UNAVAILABLE' || session?.status === 'CATALOG_UNAVAILABLE';
  const removed = challenge?.status === 'REMOVED' || session?.status === 'REMOVED';
  const disabled = state.busy || state.pending || state.blocked;
  function button(label: string, onPress: () => void, primary = false, blocked = disabled) {
    return <Pressable accessibilityRole="button" disabled={blocked} onPress={onPress}
      style={({ pressed }) => [primary ? styles.primary : styles.secondary, blocked && styles.disabled, pressed && styles.pressed]}>
      <Text style={primary ? styles.primaryText : styles.buttonText}>{label}</Text>
    </Pressable>;
  }
  return <SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.brand}><KajoMark /></View>
      <View style={styles.panel}>
        <Text style={styles.kicker}>{challenge ? 'KAJON ENNUSTEHAASTE' : 'OMA KAJO · MAKUTESTI'}</Text>
        {!session && !challenge && !state.needsStart ? <>
          <Text style={styles.title}>Haetaan makutestin jatkoa</Text>
          <Text style={styles.body}>Kajo palauttaa palvelimelle tallennetun vaiheesi.</Text>
        </> : removed ? <>
          <Text style={styles.title}>{challenge ? 'Haaste poistettu' : 'Makutesti poistettu'}</Text>
          <Text style={styles.body}>{challenge ? 'Haasteen vastaukset ja ennusteet on poistettu. Makutestin arviot säilyvät.'
            : 'Makutestin arviot on poistettu tämän makutestin lähtötiedoista. Voit jatkaa Kajoon.'}</Text>
          {button('Jatka Kajoon', onContinue, true)}
        </> : unavailable ? <>
          <Text style={styles.title}>Teos ei ole enää saatavilla</Text>
          <Text style={styles.body}>Kajo ei vaihda jäädytettyjä kysymyksiä tai ennusteita kesken kierroksen. Voit palata myöhemmin, poistaa kierroksen tai jatkaa Kajoon.</Text>
          {button('Jatka Kajoon', onContinue, true)}
        </> : intro ? <>
          <Text style={styles.title}>Anna Kajolle lähtötuntuma</Text>
          <Text style={styles.body}>Ensin elokuvia, sitten kirjoja. Arvioi vain tuntemiasi teoksia asteikolla 0–10. Tuntemattoman voi aina ohittaa.</Text>
          <Text style={styles.body}>Kajo valitsee seuraavan kortin vastaustesi perusteella. Kierros päättyy viimeistään 24 korttiin. Vastaukset tallentuvat yksi kerrallaan.</Text>
          {button('Tuo historia', onOpenImport)}
          {button('Aloita makutesti', onBegin, true)}
        </> : current ? <>
          <Text style={styles.progress}>{challenge ? `${challenge.answers.length + 1}/${challenge.items.length} · ennuste on lukittu`
            : `${session?.counts?.presented ?? 0}/24 korttia · arvioita ${session?.counts?.knownRatings ?? 0}`}</Text>
          <Text style={styles.kicker}>{current.itemType === 'MOVIE' ? 'ELOKUVA' : 'KIRJA'}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{challenge ? 'Ennusteet näytetään vasta, kun kaikki vastaukset on lukittu. Anna oma arviosi.' : 'Arvioi vain, jos tunnet teoksen. Myös 0 ja 5 ovat oikeita arvioita.'}</Text>
          <RatingControl disabled={disabled} rating={draftRating} theme={theme} onRatingChange={onDraftChange} />
          {button('Tallenna arvio ja jatka', () => { if (draftRating !== null) onAnswer({ kind: 'RATING', value: draftRating }); }, true, disabled || draftRating === null)}
          {button('En tunne', () => onAnswer({ kind: 'UNKNOWN' }))}
          {button('Ei kiinnosta', () => onAnswer({ kind: 'NOT_INTERESTED' }))}
          {challenge ? <Text style={styles.help}>Haasteen ensimmäinen vastaus lukitaan. Haaste ei lisää vastauksia makutestin oppimisaineistoon.</Text> : null}
        </> : !challenge && session?.decision?.kind === 'TRANSITION' ? <>
          <Text style={styles.title}>Seuraavaksi kirjat</Text>
          <Text style={styles.body}>Elokuvavaihe on valmis. Jatketaan kirjoihin; tuntemattoman voi edelleen ohittaa.</Text>
          {button('Jatka kirjoihin', onBooks, true)}
        </> : !challenge && session?.status === 'STOPPED' ? <>
          <Text style={styles.title}>Makutesti on valmis</Text>
          <Text style={styles.body}>Tallennettuja arvioita: {session.counts?.knownRatings ?? 0}. Tuntemattomia: {session.counts?.unknown ?? 0}.</Text>
          {session.decision?.kind === 'STOP' && session.decision.failOpen ? <Text style={styles.body}>Tuntemia teoksia löytyi vähän. Voit silti jatkaa Kajoon; kierros ei todista ennusteiden hyödyllisyyttä.</Text> : null}
          <Text style={styles.body}>Seuraavassa haasteessa Kajo lukitsee ennusteet ennen vastauksiasi. Haaste vertaa teosten järjestystä, eikä ennusta arvosanaa asteikolla 0–10.</Text>
          {button('Jatka ennustehaasteeseen', onChallenge, true)}
          {button('Jatka Kajoon', onContinue)}
        </> : challenge?.metric ? <>
          <Text style={styles.title}>{challenge.status === 'UNAVAILABLE' ? 'Erillisiä haasteteoksia ei löytynyt' : 'Kierroksen järjestysvertailu'}</Text>
          {challengeResultCopy(challenge.metric).map((line, index) => <Text key={index} style={styles.body}>{line}</Text>)}
          {button('Jatka Kajoon', onContinue, true)}
        </> : null}

        {state.message ? <View accessibilityLiveRegion="polite" style={styles.message}>
          <Text style={styles.body}>{state.message}</Text>
          {state.conflict ? button('Lataa nykyinen vaihe', onReload, true, state.busy)
            : button('Yritä uudelleen', onRetry, true, state.busy)}
          {button('Jatka Kajoon', onContinue, false, state.busy)}
        </View> : null}
        {state.busy ? <ActivityIndicator accessibilityLabel="Tallennetaan makutestin vaihetta" color={theme.base.textPrimary} /> : null}
        {!removed && (session?.revision !== null && session || challenge?.revision !== null && challenge) ?
          confirmRemoval ? <>
            <Text style={styles.body}>{challenge ? 'Poistetaanko haasteen vastaukset ja lukitut ennusteet? Makutestin arviot säilyvät.'
              : 'Poistetaanko makutestin arviot ja siihen liittyvä haaste? Tätä kierrosta ei voi aloittaa uudelleen.'}</Text>
            {button(challenge ? 'Vahvista haasteen poisto' : 'Vahvista makutestin poisto', onRemove)}
            {button('Peruuta poisto', onCancelRemoval)}
          </> : button(challenge ? 'Poista haaste' : 'Poista makutesti', onAskRemoval) : null}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function createStyles(theme: ReturnType<typeof getRoomTheme>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.base.appBackground },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 28, gap: 16 },
    brand: { alignSelf: 'center', width: 122 },
    panel: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 14, padding: 20,
      borderRadius: 18, borderWidth: 1, borderColor: theme.base.border, backgroundColor: theme.surface.panel },
    kicker: { color: theme.base.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
    title: { color: theme.base.textPrimary, fontSize: 24, fontWeight: '800' },
    body: { color: theme.base.textMuted, fontSize: 14, lineHeight: 21 },
    help: { color: theme.base.textMuted, fontSize: 12, lineHeight: 18 },
    progress: { color: theme.base.textMuted, fontSize: 12, fontWeight: '700' },
    primary: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center', backgroundColor: theme.base.structureLight },
    secondary: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.base.border },
    primaryText: { color: theme.base.appBackground, fontSize: 14, fontWeight: '800', textAlign: 'center' },
    buttonText: { color: theme.base.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    message: { gap: 12 }, disabled: { opacity: 0.4 }, pressed: { opacity: 0.72 },
  });
}
