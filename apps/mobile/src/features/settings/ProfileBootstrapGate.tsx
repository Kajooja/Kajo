import { useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import type { Item } from '@/domain/contracts';
import { getAmbientPhase } from '@/domain/discovery';
import { KajoMark } from '@/features/branding/KajoBrand';
import { useDiscoveryMode } from '@/features/discovery/DiscoveryModeContext';
import { RatingControl } from '@/features/discovery/RatingControl';
import { useActiveProfile } from '@/features/profiles/ActiveProfileContext';
import { getRoomTheme } from '@/theme/roomTheme';

import {
  commitProfileCalibration,
  loadProfileBootstrapStatus,
  loadProfileCalibrationCandidates,
  shouldOfferProfileCalibration,
  type ProfileBootstrapStatus,
  type ProfileCalibrationResponse,
  type ProfileCalibrationRpc,
} from './profileCalibrationOperations';

export function ProfileBootstrapGate({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const profiles = useActiveProfile();
  const { mode } = useDiscoveryMode();
  const router = useRouter();
  const segments = useSegments();
  const routeKey = segments.join('/');
  const isSettingsRoute = segments[0] === 'settings';
  const personalProfile = profiles.personalProfile;
  const activeIsPersonal = Boolean(
    personalProfile && profiles.activeProfile?.id === personalProfile.id,
  );
  const [loadedStatus, setLoadedStatus] = useState<{
    profileId: string;
    value: ProfileBootstrapStatus;
  } | null>(null);
  const [failedOpenProfileId, setFailedOpenProfileId] = useState<string | null>(null);
  const client = connection.status === 'configured' ? connection.client : null;
  const rpc = useMemo<ProfileCalibrationRpc | null>(
    () =>
      client
        ? async (functionName, arguments_) => {
            const { data, error } = await client.rpc(functionName, arguments_);
            return {
              data,
              error: error ? { message: error.message } : null,
            };
          }
        : null,
    [client],
  );

  const refreshStatus = useCallback(async () => {
    if (!rpc || !personalProfile || !activeIsPersonal) return;
    const profileId = personalProfile.id;
    const result = await loadProfileBootstrapStatus(rpc, profileId);
    if (result.status === 'success') {
      setLoadedStatus({ profileId, value: result.value });
    }
  }, [activeIsPersonal, personalProfile, rpc]);

  useEffect(() => {
    if (!rpc || !personalProfile || !activeIsPersonal) return;

    let active = true;
    const profileId = personalProfile.id;
    void loadProfileBootstrapStatus(rpc, profileId).then((result) => {
      if (active && result.status === 'success') {
        setLoadedStatus({ profileId, value: result.value });
      }
    });
    return () => {
      active = false;
    };
  }, [activeIsPersonal, personalProfile, routeKey, rpc]);

  const status =
    personalProfile && loadedStatus?.profileId === personalProfile.id
      ? loadedStatus.value
      : null;

  if (
    isSettingsRoute ||
    !rpc ||
    !personalProfile ||
    !activeIsPersonal ||
    !status ||
    failedOpenProfileId === personalProfile.id ||
    !shouldOfferProfileCalibration(status)
  ) {
    return children;
  }

  const theme = getRoomTheme(getAmbientPhase(mode), profiles.activeProfile);

  return (
    <ProfileCalibrationScreen
      profileId={personalProfile.id}
      rpc={rpc}
      theme={theme}
      status={status}
      onOpenImport={() => router.push('/settings')}
      onFailOpen={() => setFailedOpenProfileId(personalProfile.id)}
      onCompleted={() => {
        setFailedOpenProfileId(personalProfile.id);
        void refreshStatus();
      }}
    />
  );
}

function ProfileCalibrationScreen({
  profileId,
  rpc,
  theme,
  status,
  onOpenImport,
  onFailOpen,
  onCompleted,
}: {
  profileId: string;
  rpc: ProfileCalibrationRpc;
  theme: ReturnType<typeof getRoomTheme>;
  status: ProfileBootstrapStatus;
  onOpenImport: () => void;
  onFailOpen: () => void;
  onCompleted: () => void;
}) {
  const styles = createStyles(theme);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<readonly Item[]>([]);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [exhausted, setExhausted] = useState(false);
  const current = items[index] ?? null;
  const responses: ProfileCalibrationResponse[] = Object.entries(ratings).map(
    ([itemId, rating]) => ({ itemId, rating }),
  );
  const canCommit = responses.length >= status.minimumStrongEvidence;
  const canExpand =
    items.length < status.maximumCandidateCount &&
    responses.length < status.minimumStrongEvidence;

  async function loadCandidates(limit: number, continueFromCurrent = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await loadProfileCalibrationCandidates(rpc, profileId, limit);
    if (result.status === 'error') {
      setError(result.message);
      setBusy(false);
      return;
    }

    if (result.items.length < status.minimumStrongEvidence) {
      setError(
        'Kajo ei pysty vielä tarjoamaan riittävää määrää oikeita profilointikortteja. Voit jatkaa nyt ja profilointi käynnistyy uudelleen, kun katalogi on valmis.',
      );
      setExhausted(true);
      setBusy(false);
      return;
    }

    const previousLength = items.length;
    setItems(result.items);
    if (continueFromCurrent && result.items.length > previousLength) {
      setIndex(previousLength);
    } else if (!started) {
      setIndex(0);
    }
    setStarted(true);
    setExhausted(result.items.length >= status.maximumCandidateCount);
    setBusy(false);
  }

  async function commit() {
    if (busy || !canCommit) return;
    setBusy(true);
    setError(null);
    const result = await commitProfileCalibration(
      rpc,
      profileId,
      responses,
      status.minimumStrongEvidence,
    );
    if (result.status === 'error') {
      setError(result.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    onCompleted();
  }

  function move(delta: number) {
    if (items.length === 0) return;
    setIndex((currentIndex) =>
      Math.min(items.length - 1, Math.max(0, currentIndex + delta)),
    );
  }

  function next() {
    if (index < items.length - 1) {
      move(1);
      return;
    }
    if (canExpand) {
      void loadCandidates(status.maximumCandidateCount, true);
      return;
    }
    setExhausted(true);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandWrap}>
          <KajoMark />
        </View>

        {!started ? (
          <View style={styles.panel}>
            <Text style={styles.kicker}>OMA KAJO</Text>
            <Text style={styles.title}>Anna Kajolle lähtötuntuma</Text>
            <Text style={styles.body}>
              Jos sinulla on Letterboxd-, IMDb- tai kirjahistoriaa, voit tuoda sen
              ensin. Muuten Kajo profiloi makusi lyhyellä oikean katalogin
              kierroksella.
            </Text>
            <Text style={styles.body}>
              Profilointi alkaa yleisesti tunnetuista, suosituista ja juuri nyt
              kiinnostusta keräävistä teoksista. Arvioi vähintään{' '}
              {status.minimumStrongEvidence} sellaista, jotka tunnet.
            </Text>
            <Text style={styles.body}>
              Näet ensin {status.initialCandidateCount} korttia. Tuntemattomat voi
              ohittaa, ja tarvittaessa Kajo näyttää lisää enintään{' '}
              {status.maximumCandidateCount} korttiin asti. Demografisia tietoja
              ei tarvita.
            </Text>
            <Text style={styles.help}>
              Lähtöpriori on {status.priorVersion}. Arviosi alustavat vain
              pitkäaikaista makua; tavallinen Kajo-käyttö alkaa nopeasti painaa
              enemmän.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onOpenImport}
              style={({ pressed }) => [
                styles.secondaryWideButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Tuo historia</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void loadCandidates(status.initialCandidateCount)}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Aloita profilointi</Text>
            </Pressable>
          </View>
        ) : current ? (
          <View style={styles.panel}>
            <View style={styles.progressRow}>
              <Text style={styles.kicker}>PROFILOINTI</Text>
              <Text style={styles.progressText}>
                {index + 1}/{items.length} · arvioitu {responses.length}/
                {status.minimumStrongEvidence}
              </Text>
            </View>

            {current.imageUrl ? (
              <Image
                source={{ uri: current.imageUrl }}
                resizeMode="cover"
                style={styles.image}
              />
            ) : (
              <View style={styles.imageFallback}>
                <Text style={styles.imageFallbackText}>
                  {current.itemType === 'MOVIE' ? 'ELOKUVA' : 'KIRJA'}
                </Text>
              </View>
            )}

            <Text style={styles.itemType}>
              {current.itemType === 'MOVIE' ? 'ELOKUVA' : 'KIRJA'}
            </Text>
            <Text style={styles.itemTitle}>{current.title}</Text>
            <Text style={styles.meta}>
              {[current.creators?.[0], current.releaseYear]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={styles.body}>
              Arvioi vain, jos tunnet teoksen. Muuten ohita se.
            </Text>

            <RatingControl
              disabled={busy}
              rating={ratings[current.id] ?? null}
              theme={theme}
              onRatingChange={(rating) =>
                setRatings((existing) => ({
                  ...existing,
                  [current.id]: rating,
                }))
              }
            />

            <View style={styles.navigationRow}>
              <Pressable
                accessibilityRole="button"
                disabled={busy || index === 0}
                onPress={() => move(-1)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (busy || index === 0) && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Edellinen</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={next}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {ratings[current.id] === undefined
                    ? index === items.length - 1 && canExpand
                      ? 'En tunne · näytä lisää'
                      : 'En tunne · seuraava'
                    : index === items.length - 1 && canExpand
                      ? 'Näytä lisää'
                      : 'Seuraava'}
                </Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={busy || !canCommit}
              onPress={() => void commit()}
              style={({ pressed }) => [
                styles.primaryButton,
                (busy || !canCommit) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {canCommit
                  ? `Valmis · tallenna ${responses.length} arviota`
                  : `Arvioi vielä ${status.minimumStrongEvidence - responses.length}`}
              </Text>
            </Pressable>

            {exhausted && !canCommit ? (
              <>
                <Text style={styles.help}>
                  Kävit tarjolla olevan profilointijoukon läpi, mutta tuntemia
                  teoksia löytyi liian vähän. Tätä ei käytetä syynä lukita sinua
                  ulos Kajosta.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={onFailOpen}
                  style={({ pressed }) => [
                    styles.textButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.textButtonText}>Jatka Kajoon</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            {exhausted ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onFailOpen}
                style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
              >
                <Text style={styles.textButtonText}>Jatka Kajoon</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        {busy ? <ActivityIndicator color={theme.base.textPrimary} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof getRoomTheme>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.base.appBackground },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 22,
      paddingVertical: 28,
      gap: 16,
    },
    brandWrap: { alignSelf: 'center', width: 122, marginBottom: 4 },
    panel: {
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
      gap: 13,
      padding: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.surface.panel,
    },
    kicker: {
      color: theme.base.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    title: { color: theme.base.textPrimary, fontSize: 24, fontWeight: '800' },
    body: { color: theme.base.textMuted, fontSize: 13, lineHeight: 19 },
    help: { color: theme.base.textMuted, fontSize: 11, lineHeight: 16 },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    progressText: {
      color: theme.base.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    image: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: 14,
      backgroundColor: theme.surface.raised,
    },
    imageFallback: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface.raised,
      borderWidth: 1,
      borderColor: theme.base.border,
    },
    imageFallbackText: {
      color: theme.base.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.4,
    },
    itemType: {
      color: theme.base.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
    },
    itemTitle: {
      color: theme.base.textPrimary,
      fontSize: 22,
      fontWeight: '800',
    },
    meta: { color: theme.base.textMuted, fontSize: 12 },
    navigationRow: { flexDirection: 'row', gap: 10 },
    primaryButton: {
      minHeight: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      backgroundColor: theme.base.structureLight,
    },
    primaryButtonText: {
      color: theme.base.appBackground,
      fontSize: 13,
      fontWeight: '800',
    },
    secondaryWideButton: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.base.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: theme.base.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    secondaryButtonText: {
      color: theme.base.textPrimary,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    textButton: {
      alignSelf: 'center',
      minHeight: 34,
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    textButtonText: {
      color: theme.base.textMuted,
      fontSize: 12,
      textDecorationLine: 'underline',
    },
    error: {
      color: '#ffb0b0',
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
    },
    pressed: { opacity: 0.72 },
    disabled: { opacity: 0.4 },
  });
}
