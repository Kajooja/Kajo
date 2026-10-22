import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KajoMark } from '../branding/KajoBrand';
import type { Item } from '../../domain/contracts';
import { FeedItemCard } from '../discovery/FeedItemCard';
import { RatingControl } from '../discovery/RatingControl';
import type { getRoomTheme } from '../../theme/roomTheme';
import type { PersonalTasteSnapshot } from './personalTasteFlow';
import { challengeResultCopy, type TasteAnswer } from './personalTasteOperations';

export function PersonalTasteScreen({ state, theme, begun, draftRating, confirmRemoval,
  onBegin, onDraftChange, onAnswer, onBooks, onChallenge, onRetry, onReload, onContinue,
  onOpenImport, onAskRemoval, onCancelRemoval, onRemove, presentationItem, onSkip, helpScope }: {
  presentationItem?: Item | null; onSkip?: () => boolean; helpScope?: string;
  state: PersonalTasteSnapshot; theme: ReturnType<typeof getRoomTheme>; begun: boolean;
  draftRating: number | null; confirmRemoval: boolean;
  onBegin: () => void; onDraftChange: (rating: number) => void; onAnswer: (answer: TasteAnswer) => void;
  onBooks: () => void; onChallenge: () => void; onRetry: () => void; onReload: () => void;
  onContinue: () => void; onOpenImport: () => void; onAskRemoval: () => void;
  onCancelRemoval: () => void; onRemove: () => void;
}) {
  const styles = createStyles(theme);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { session, challenge, sequential } = state;
  const current = sequential?.status === 'QUESTION' ? sequential.item : challenge?.status === 'ACTIVE' ? challenge.items.find(i => !challenge.answers.some(a => a.itemId === i.id))
    : !challenge && session?.status === 'ACTIVE' && session.decision?.kind === 'QUESTION' ? session.item : null;
  const intro = state.needsStart || !challenge && session?.status === 'ACTIVE' && !begun && session.counts?.answered === 0;
  const unavailable = challenge?.status === 'CATALOG_UNAVAILABLE' || session?.status === 'CATALOG_UNAVAILABLE';
  const removed = sequential?.status === 'REMOVED' || challenge?.status === 'REMOVED' || session?.status === 'REMOVED';
  const disabled = state.busy || state.pending || state.blocked;
  function button(label: string, onPress: () => void, primary = false, blocked = disabled) {
    return <Pressable accessibilityRole="button" disabled={blocked} onPress={onPress}
      style={({ pressed }) => [primary ? styles.primary : styles.secondary, blocked && styles.disabled, pressed && styles.pressed]}>
      <Text style={primary ? styles.primaryText : styles.buttonText}>{label}</Text>
    </Pressable>;
  }
  // The sequential question owns the whole available viewport. Recovery and
  // account controls are overlays, so an idle header/help row cannot shrink it.
  // Existing v1 and frozen challenge presentations keep their explicit contract.
  if (sequential && current && !intro) {
    const title = `Makutesti. Tallennettuja vastauksia: ${sequential.answered}. Ennuste on vielä alustava.`;
    const feedDisabled = disabled || optionsOpen || confirmRemoval || Boolean(state.message);
    return <SafeAreaView style={styles.safeArea}>
      <View style={styles.feedHeader}>
        <Text accessibilityRole="header" accessibilityLabel={title} style={styles.feedTitle}>Makutesti</Text>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={onContinue}
          style={[styles.feedHeaderButton, disabled && styles.disabled]}>
          <Text style={styles.buttonText}>Jatka selaamaan</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Makutestin valinnat"
          accessibilityState={{ expanded: optionsOpen }} onPress={() => setOptionsOpen(value => !value)}
          style={styles.feedOptionsButton}><Text style={styles.feedOptionsGlyph}>⋯</Text></Pressable>
      </View>
      <View testID="taste-feed-viewport" style={styles.feedViewport}
        onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}>
        <FeedItemCard key={`${sequential.sessionId}:${sequential.questionId}:${sequential.revision}`}
          item={presentationItem?.id === current.id ? presentationItem : current} theme={theme} disabled={feedDisabled}
          {...(helpScope ? { helpScope } : {})} {...(viewportHeight > 0 ? { viewportHeight } : {})}
          hasInteracted={sequential.answered > 0}
          {...(sequential.contextualSkip && onSkip ? { onSkip: () => !feedDisabled && onSkip() } : {})}>
          <RatingControl disabled={feedDisabled} rating={draftRating} theme={theme} onRatingChange={rating => {
            if (feedDisabled) return;
            onDraftChange(rating);
            onAnswer({ kind: 'RATING', value: rating });
          }} />
          {!sequential.contextualSkip ? <Text style={styles.help}>Ohitus ei ole juuri nyt käytettävissä. Voit jatkaa selaamaan.</Text> : null}
        </FeedItemCard>
        {state.busy && !state.message ? <View pointerEvents="none" style={styles.feedBusy}>
          <ActivityIndicator accessibilityLabel="Tallennetaan makutestin vaihetta" color={theme.base.textPrimary} />
        </View> : null}
        {state.message ? <View accessibilityLiveRegion="polite" style={[styles.feedOverlay, styles.message]}>
          <Text style={styles.body}>{state.message}</Text>
          {state.conflict ? button('Lataa nykyinen vaihe', onReload, true, state.busy)
            : button('Yritä uudelleen', onRetry, true, state.busy)}
        </View> : null}
        {optionsOpen || confirmRemoval ? <View accessibilityViewIsModal style={styles.feedOverlay}>
          {confirmRemoval ? <>
            <Text style={styles.body}>Poistetaanko makutestin vastaukset ja niiden vaikutus ennusteeseen? Tätä kierrosta ei voi aloittaa uudelleen.</Text>
            {button('Vahvista makutestin poisto', onRemove)}
            {button('Peruuta poisto', onCancelRemoval)}
          </> : <>
            <Text style={styles.body}>Tallennettuja vastauksia: {sequential.answered}. Ennuste on vielä alustava.</Text>
            {button('Poista makutesti', onAskRemoval)}
            {button('Sulje valinnat', () => setOptionsOpen(false), false, false)}
          </>}
        </View> : null}
      </View>
    </SafeAreaView>;
  }
  return <SafeAreaView style={styles.safeArea}>
    <ScrollView key={sequential ? `${sequential.sessionId}:${sequential.questionId}:${sequential.revision}` : 'legacy'} contentContainerStyle={styles.content}>
      <View style={styles.brand}><KajoMark /></View>
      <View style={styles.panel}>
        <Text style={styles.kicker}>{challenge ? 'KAJON ENNUSTEHAASTE' : 'OMA KAJO · MAKUTESTI'}</Text>
        {!sequential && !session && !challenge && !state.needsStart ? <>
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
          <Text style={styles.body}>Arvioi tuntemiasi elokuvia ja kirjoja asteikolla 0–10. Tuntemattoman voi aina ohittaa.</Text>
          <Text style={styles.body}>{session ? 'Ensin elokuvia, sitten kirjoja. Tämä aiemmin aloitettu kierros päättyy viimeistään 24 korttiin.'
            : 'Jokainen vastaus auttaa valitsemaan seuraavan kortin. Voit siirtyä selaamaan milloin vain; Kajo jatkaa oppimista samalla profiililla.'}</Text>
          {button('Tuo historia', onOpenImport)}
          {button('Aloita makutesti', onBegin, true)}
          {!session ? button('Jatka selaamaan', onContinue) : null}
        </> : current ? <>
          <Text style={styles.progress}>{sequential ? `Tallennettuja vastauksia: ${sequential.answered} · ennuste päivittyy` : challenge ? `${challenge.answers.length + 1}/${challenge.items.length} · ennuste on lukittu`
            : `${session?.counts?.presented ?? 0}/24 korttia · arvioita ${session?.counts?.knownRatings ?? 0}`}</Text>
          <Text style={styles.kicker}>{current.itemType === 'MOVIE' ? 'ELOKUVA' : 'KIRJA'}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{challenge ? 'Ennusteet näytetään vasta, kun kaikki vastaukset on lukittu. Anna oma arviosi.' : 'Arvioi vain, jos tunnet teoksen. Myös 0 ja 5 ovat oikeita arvioita.'}</Text>
          <RatingControl disabled={disabled} rating={draftRating} theme={theme} onRatingChange={onDraftChange} />
          {button('Tallenna arvio ja jatka', () => { if (draftRating !== null) onAnswer({ kind: 'RATING', value: draftRating }); }, true, disabled || draftRating === null)}
          {button('En tunne', () => onAnswer({ kind: 'UNKNOWN' }))}
          {button('Ei kiinnosta', () => onAnswer({ kind: 'NOT_INTERESTED' }))}
          {challenge ? <Text style={styles.help}>Haasteen ensimmäinen vastaus lukitaan. Haaste ei lisää vastauksia makutestin oppimisaineistoon.</Text> : null}
        </> : sequential ? <>
          <Text style={styles.title}>{sequential.status === 'PAUSED' ? 'Makutesti on tauolla'
            : sequential.status === 'STOPPED' ? 'Jatketaan tutustumista selaamalla' : 'Päivitetään seuraavaa kysymystä'}</Text>
          <Text style={styles.body}>Ennuste on vielä alustava. Tallennetut vastaukset säilyvät, ja uudet valintasi tarkentavat ennustetta samalla profiililla.</Text>
          {sequential.status === 'PAUSED' ? button('Jatka makutestiä', onBegin, true) : null}
          {sequential.status === 'NEEDS_NEXT' ? button('Hae seuraava kysymys', onRetry, true) : null}
          {button('Jatka selaamaan', onContinue, sequential.status === 'STOPPED')}
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
          {button(sequential ? 'Jatka selaamaan' : 'Jatka Kajoon', onContinue, false, disabled)}
        </View> : null}
        {state.busy ? <ActivityIndicator accessibilityLabel="Tallennetaan makutestin vaihetta" color={theme.base.textPrimary} /> : null}
        {!removed && (sequential?.revision !== null && sequential || session?.revision !== null && session || challenge?.revision !== null && challenge) ?
          confirmRemoval ? <>
            <Text style={styles.body}>{challenge ? 'Poistetaanko haasteen vastaukset ja lukitut ennusteet? Makutestin arviot säilyvät.'
              : sequential ? 'Poistetaanko makutestin vastaukset ja niiden vaikutus ennusteeseen? Tätä kierrosta ei voi aloittaa uudelleen.'
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
    feedHeader: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    feedTitle: { flex: 1, color: theme.base.textPrimary, fontSize: 14, fontWeight: '700' },
    feedHeaderButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
    feedOptionsButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    feedOptionsGlyph: { color: theme.base.textPrimary, fontSize: 26, fontWeight: '700' },
    feedViewport: { flex: 1, minHeight: 0, overflow: 'hidden' },
    feedBusy: { position: 'absolute', top: 8, right: 12 },
    feedOverlay: { position: 'absolute', top: 8, left: 12, right: 12, borderRadius: 14,
      padding: 16, gap: 12, backgroundColor: theme.surface.panel, borderWidth: 1, borderColor: theme.base.border },
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
