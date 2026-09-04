import { useEffect, useMemo, useState } from 'react';
import { File } from 'expo-file-system';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { getAmbientPhase } from '@/domain/discovery';
import { getRoomTheme } from '@/theme/roomTheme';
import { useActiveProfile } from '@/features/profiles/ActiveProfileContext';
import { useDiscoveryMode } from '@/features/discovery/DiscoveryModeContext';
import { loadCatalogItems } from '@/features/discovery/catalogItemOperations';
import type { Item } from '@/domain/contracts';

import {
  commitHistoryImport,
  type HistoryImportJob,
  type HistoryImportJobRow,
  type HistoryImportRpc,
  loadHistoryImports,
  removeHistoryImport,
  resolveHistoryImportRow,
  stageHistoryImport,
} from './historyImportOperations';
import {
  parseHistoryImportCsv,
  type HistoryImportKind,
  type HistoryImportProvider,
} from './historyImportParser';

type ImportSource = {
  key: string;
  label: string;
  description: string;
  kind: HistoryImportKind;
  provider?: HistoryImportProvider;
};

const IMPORT_SOURCES: ImportSource[] = [
  {
    key: 'letterboxd',
    label: 'Letterboxd',
    description:
      'Valitse puretusta Letterboxd-exportista ratings.csv, watched.csv, diary.csv tai watchlist.csv.',
    kind: 'MOVIE',
    provider: 'LETTERBOXD',
  },
  {
    key: 'imdb',
    label: 'IMDb',
    description:
      'Valitse IMDb:n oma ratings-, watchlist-, check-ins- tai list-CSV.',
    kind: 'MOVIE',
    provider: 'IMDB',
  },
  {
    key: 'books',
    label: 'Kirjahistoria',
    description:
      'Goodreads- tai StoryGraph-CSV tunnistetaan automaattisesti. Myös geneerinen Kajo CSV toimii.',
    kind: 'BOOK',
  },
];

export function SettingsScreen() {
  const { mode } = useDiscoveryMode();
  const profiles = useActiveProfile();
  const connection = useSupabaseConnection();
  const theme = getRoomTheme(getAmbientPhase(mode), profiles.activeProfile);
  const styles = createStyles(theme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<HistoryImportJob | null>(null);
  const [existingImports, setExistingImports] = useState<
    readonly HistoryImportJob[]
  >([]);
  const [candidateItems, setCandidateItems] = useState<Record<string, Item>>({});
  const personalProfile = profiles.personalProfile;
  const activeIsPersonal = Boolean(
    personalProfile && profiles.activeProfile?.id === personalProfile.id,
  );
  const client = connection.status === 'configured' ? connection.client : null;
  const rpc = useMemo<HistoryImportRpc | null>(
    () =>
      client
        ? async (functionName, arguments_) => {
            const { data, error: rpcError } = await client.rpc(
              functionName,
              arguments_,
            );
            return {
              data,
              error: rpcError ? { message: rpcError.message } : null,
            };
          }
        : null,
    [client],
  );

  useEffect(() => {
    if (!rpc || !personalProfile || !activeIsPersonal) return;
    let active = true;

    void loadHistoryImports(rpc, personalProfile.id).then((result) => {
      if (!active) return;
      if (result.status === 'success') {
        setExistingImports(result.jobs);
      }
    });

    return () => {
      active = false;
    };
  }, [activeIsPersonal, personalProfile, rpc]);

  async function reloadExistingImports() {
    if (!rpc || !personalProfile) return;
    const result = await loadHistoryImports(rpc, personalProfile.id);
    if (result.status === 'success') setExistingImports(result.jobs);
  }

  async function chooseAndStage(source: ImportSource) {
    if (!rpc || !client || !personalProfile || !activeIsPersonal || busy) return;

    setBusy(true);
    setError(null);
    try {
      const picked = await File.pickFileAsync({
        multipleFiles: false,
        mimeTypes: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
      });
      if (picked.canceled) return;

      const file = picked.result;
      if (file.size > 8 * 1024 * 1024) {
        setError(
          'CSV-tiedosto on liian suuri tähän tuontiin. Enimmäiskoko on 8 Mt.',
        );
        return;
      }
      if (file.extension.toLowerCase() === '.zip') {
        setError(
          'Pura Letterboxd ZIP ensin ja valitse sen sisältä CSV-tiedosto.',
        );
        return;
      }

      const text = await file.text();
      const parsed = parseHistoryImportCsv({
        fileName: file.name,
        text,
        preferredKind: source.kind,
        ...(source.provider ? { preferredProvider: source.provider } : {}),
      });
      if (parsed.status === 'error') {
        setError(parsed.message);
        return;
      }

      const staged = await stageHistoryImport(
        rpc,
        personalProfile.id,
        file.name,
        parsed.import,
      );
      if (staged.status === 'error') {
        setError(staged.message);
        return;
      }

      setJob(staged.job);
      await refreshCandidateItems(staged.job);
    } catch {
      setError('Tiedoston avaaminen tai historian valmistelu epäonnistui.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshCandidateItems(nextJob: HistoryImportJob) {
    if (!client) return;
    const ids = [
      ...new Set(
        nextJob.rows
          .filter((row) => row.matchStatus === 'AMBIGUOUS')
          .flatMap((row) => row.candidateItemIds),
      ),
    ];
    if (ids.length === 0) {
      setCandidateItems({});
      return;
    }

    const loaded = await loadCatalogItems(client, ids);
    if (loaded.status !== 'success') return;
    setCandidateItems(
      Object.fromEntries(loaded.items.map((item) => [item.id, item])),
    );
  }

  async function resolveRow(row: HistoryImportJobRow, itemId: string | null) {
    if (!rpc || busy) return;
    setBusy(true);
    setError(null);
    const result = await resolveHistoryImportRow(rpc, row.rowId, itemId);
    if (result.status === 'error') setError(result.message);
    else {
      setJob(result.job);
      await refreshCandidateItems(result.job);
    }
    setBusy(false);
  }

  async function commit() {
    if (!rpc || !job || busy) return;
    const unresolved = job.ambiguousRows + job.unmatchedRows;
    if (unresolved > 0) {
      setError(
        'Korjaa tai ohita ensin kaikki epäselvät ja löytymättömät rivit.',
      );
      return;
    }

    setBusy(true);
    setError(null);
    const result = await commitHistoryImport(rpc, job.jobId);
    if (result.status === 'error') setError(result.message);
    else {
      setJob(result.job);
      await reloadExistingImports();
    }
    setBusy(false);
  }

  function confirmRemove(target: HistoryImportJob) {
    if (!rpc || busy) return;
    Alert.alert(
      'Poistetaanko tuonnin vaikutus?',
      'Tämä poistaa tämän tiedoston bootstrap-vaikutuksen omasta Kajostasi. Kajossa itse tehdyt valinnat säilyvät.',
      [
        { text: 'Peruuta', style: 'cancel' },
        {
          text: 'Poista',
          style: 'destructive',
          onPress: () => void removeImport(target),
        },
      ],
    );
  }

  async function removeImport(target: HistoryImportJob) {
    if (!rpc) return;
    setBusy(true);
    setError(null);
    const result = await removeHistoryImport(rpc, target.jobId);
    if (result.status === 'error') setError(result.message);
    else {
      if (job?.jobId === target.jobId) setJob(null);
      await reloadExistingImports();
    }
    setBusy(false);
  }

  function switchToPersonal() {
    if (personalProfile) profiles.selectProfile(personalProfile.id);
  }

  const unresolvedRows =
    job?.rows.filter(
      (row) =>
        row.matchStatus === 'AMBIGUOUS' || row.matchStatus === 'UNMATCHED',
    ) ?? [];
  const priorImports = existingImports.filter(
    (existing) => existing.jobId !== job?.jobId,
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Asetukset</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Oman Kajon lähtötiedot</Text>
          <Text style={styles.bodyText}>
            Voit tuoda aiemmat katselu- ja lukutietosi omaan henkilökohtaiseen
            Kajoosi. Tuonti alustaa makuprofiiliasi, mutta uudet Kajo-valintasi
            painavat ajan myötä enemmän.
          </Text>
          <Text style={styles.bodyText}>
            Ryhmäprofiiliin ei tuoda historiaa suoraan. Ryhmän yhteinen Kajo voi
            käyttää hyväksyttyjen jäsenten henkilökohtaisia makusignaaleja
            common-fit-laskennassa ilman että henkilökohtainen historia
            kopioidaan ryhmään.
          </Text>
        </View>

        {!activeIsPersonal ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Tuonti kuuluu omaan Kajoon</Text>
            <Text style={styles.bodyText}>
              Olet nyt ryhmäprofiilissa. Vaihda henkilökohtaiseen Kajoosi, jotta
              voit lisätä tai muuttaa historiaa.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={switchToPersonal}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Vaihda omaan Kajoon</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tuo historia</Text>
              {IMPORT_SOURCES.map((source) => (
                <View key={source.key} style={styles.importRow}>
                  <View style={styles.importCopy}>
                    <Text style={styles.importTitle}>{source.label}</Text>
                    <Text style={styles.mutedText}>{source.description}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || !rpc}
                    onPress={() => void chooseAndStage(source)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                      (busy || !rpc) && styles.disabled,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Valitse CSV</Text>
                  </Pressable>
                </View>
              ))}
              <Text style={styles.helpText}>
                Letterboxd: lataa omista asetuksistasi data-export, pura ZIP ja
                valitse haluamasi CSV. IMDb: vie ratings/watchlist/check-ins/list
                CSV. Kirjoissa Goodreads- ja StoryGraph-exportit tunnistetaan
                otsikoista.
              </Text>
            </View>

            {job ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tuonnin yhteenveto</Text>
                <Text style={styles.summaryTitle}>
                  {job.fileName ?? job.sourceProvider}
                </Text>
                <View style={styles.statsRow}>
                  <Stat label="Rivejä" value={job.totalRows} styles={styles} />
                  <Stat
                    label="Yhdistetty"
                    value={job.matchedRows}
                    styles={styles}
                  />
                  <Stat
                    label="Epäselvä"
                    value={job.ambiguousRows}
                    styles={styles}
                  />
                  <Stat
                    label="Ei löytynyt"
                    value={job.unmatchedRows}
                    styles={styles}
                  />
                </View>

                {unresolvedRows.slice(0, 50).map((row) => (
                  <View key={row.rowId} style={styles.problemRow}>
                    <Text style={styles.problemTitle}>
                      {row.title}
                      {row.releaseYear ? ` (${row.releaseYear})` : ''}
                    </Text>
                    <Text style={styles.mutedText}>
                      {row.matchStatus === 'AMBIGUOUS'
                        ? 'Useampi mahdollinen osuma. Valitse oikea tai ohita.'
                        : 'Katalogista ei löytynyt turvallista osumaa.'}
                    </Text>
                    {row.matchStatus === 'AMBIGUOUS' ? (
                      <View style={styles.candidateList}>
                        {row.candidateItemIds.map((itemId) => {
                          const item = candidateItems[itemId];
                          return (
                            <Pressable
                              key={itemId}
                              accessibilityRole="button"
                              disabled={busy}
                              onPress={() => void resolveRow(row, itemId)}
                              style={({ pressed }) => [
                                styles.candidateButton,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text style={styles.candidateText}>
                                {item?.title ?? 'Mahdollinen osuma'}
                                {item?.releaseYear
                                  ? ` (${item.releaseYear})`
                                  : ''}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void resolveRow(row, null)}
                      style={({ pressed }) => [
                        styles.skipButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.skipButtonText}>Ohita tämä rivi</Text>
                    </Pressable>
                  </View>
                ))}

                {unresolvedRows.length > 50 ? (
                  <Text style={styles.helpText}>
                    Näytetään ensimmäiset 50 tarkistettavaa riviä. Korjaukset
                    päivittävät listaa.
                  </Text>
                ) : null}

                {job.status === 'COMMITTED' ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successTitle}>
                      Historia lisätty omaan Kajoon
                    </Text>
                    <Text style={styles.bodyText}>
                      Yhdistetyt arviot sekä katsotut/luetut teokset vaikuttavat
                      nyt pitkäaikaiseen makuprofiiliisi. Kajon omat uudet
                      valinnat alkavat tämän jälkeen painaa enemmän.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => confirmRemove(job)}
                      style={({ pressed }) => [
                        styles.skipButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.skipButtonText}>
                        Poista tämän tuonnin vaikutus
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || job.ambiguousRows + job.unmatchedRows > 0}
                    onPress={() => void commit()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.pressed,
                      (busy || job.ambiguousRows + job.unmatchedRows > 0) &&
                        styles.disabled,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Hyväksy tuonti</Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {priorImports.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aiemmat tuonnit</Text>
                {priorImports.map((existing) => (
                  <View key={existing.jobId} style={styles.previousImportRow}>
                    <View style={styles.importCopy}>
                      <Text style={styles.importTitle}>
                        {existing.fileName ?? existing.sourceProvider}
                      </Text>
                      <Text style={styles.mutedText}>
                        {existing.sourceProvider} · {existing.datasetKind} ·{' '}
                        {existing.matchedRows} yhdistettyä
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => confirmRemove(existing)}
                      style={({ pressed }) => [
                        styles.smallRemoveButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.skipButtonText}>Poista</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {busy ? <ActivityIndicator color={theme.base.textPrimary} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  styles,
}: {
  label: string;
  value: number;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof getRoomTheme>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    content: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 42,
      gap: 18,
    },
    title: { color: theme.base.textPrimary, fontSize: 26, fontWeight: '800' },
    section: {
      gap: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.surface.panel,
    },
    sectionTitle: {
      color: theme.base.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    bodyText: { color: theme.base.textMuted, fontSize: 13, lineHeight: 19 },
    mutedText: { color: theme.base.textMuted, fontSize: 12, lineHeight: 17 },
    helpText: { color: theme.base.textMuted, fontSize: 11, lineHeight: 16 },
    notice: {
      gap: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.base.border,
      backgroundColor: theme.surface.panel,
    },
    noticeTitle: {
      color: theme.base.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    importRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    importCopy: { flex: 1, gap: 3 },
    importTitle: {
      color: theme.base.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    primaryButton: {
      minHeight: 44,
      borderRadius: 13,
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
    secondaryButton: {
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.base.border,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: theme.base.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    summaryTitle: {
      color: theme.base.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stat: {
      minWidth: 70,
      flexGrow: 1,
      padding: 9,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.base.border,
    },
    statValue: {
      color: theme.base.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    statLabel: { color: theme.base.textMuted, fontSize: 10, marginTop: 2 },
    problemRow: {
      gap: 8,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.base.border,
    },
    problemTitle: {
      color: theme.base.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    candidateList: { gap: 6 },
    candidateButton: {
      minHeight: 38,
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.base.border,
      paddingHorizontal: 10,
    },
    candidateText: {
      color: theme.base.textPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    skipButton: {
      alignSelf: 'flex-start',
      minHeight: 34,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    skipButtonText: {
      color: theme.base.textMuted,
      fontSize: 12,
      textDecorationLine: 'underline',
    },
    successBox: { gap: 8, paddingTop: 8 },
    successTitle: {
      color: theme.base.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    previousImportRow: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingTop: 9,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.base.border,
    },
    smallRemoveButton: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    errorText: { color: '#ffb0b0', fontSize: 12, lineHeight: 18 },
    pressed: { opacity: 0.72 },
    disabled: { opacity: 0.42 },
  });
}
