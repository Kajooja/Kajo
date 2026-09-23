import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Item, ItemId } from '../../domain/contracts';
import type { RoomTheme } from '../../theme/roomTheme';
import { startCatalogDetailLoad, type CatalogDetailResult } from './catalogDetailLoad';

export function CatalogDetailEntry({ client, scopeKey, itemId, theme, onBack, children }: {
  client: SupabaseClient | null;
  scopeKey: string | null;
  itemId: ItemId;
  theme: RoomTheme;
  onBack: () => void;
  children: (item: Item) => ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  const request = useMemo(() => ({ client, scopeKey, itemId, attempt }), [client, scopeKey, itemId, attempt]);
  const [snapshot, setSnapshot] = useState<{ request: typeof request; result: CatalogDetailResult } | null>(null);

  useEffect(() => {
    if (!request.client || !request.scopeKey) return;
    return startCatalogDetailLoad(request.client, request.itemId, result => setSnapshot({ request, result }));
  }, [request]);

  const result = snapshot?.request === request ? snapshot.result : null;
  if (result?.status === 'ready') return children(result.item);

  const available = Boolean(client && scopeKey);
  const loading = available && !result;
  const color = { color: theme.base.textPrimary };
  return (
    <SafeAreaView edges={['bottom']} style={styles.page}>
      <View style={styles.notice}>
        {loading ? <ActivityIndicator color={theme.base.textMuted} /> : null}
        <Text accessibilityLiveRegion="polite" style={[styles.message, color]}>
          {loading ? 'Ladataan kohteen tietoja…' : result?.status === 'missing'
            ? 'Kohdetta ei löytynyt.' : 'Kohteen tietoja ei saatu ladattua.'}
        </Text>
        {!loading && available ? (
          <Pressable accessibilityRole="button" onPress={() => setAttempt(current => current + 1)} style={styles.button}>
            <Text style={color}>Yritä uudelleen</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.button}>
          <Text style={color}>Takaisin</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  notice: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  message: { fontSize: 17, textAlign: 'center' },
  button: { minHeight: 48, paddingHorizontal: 20, justifyContent: 'center' },
});
