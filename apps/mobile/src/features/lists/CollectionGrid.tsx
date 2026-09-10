import { useCallback, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, Text, View, type ViewToken } from 'react-native';
import type { Item } from '../../domain/contracts';
import type { RoomTheme } from '../../theme/roomTheme';
import { DiscoveryItemCard } from '../discovery/DiscoveryItemCard';
import { getDiscoveryImageUrl } from '../discovery/catalogImageUrl';
import type { ItemInteraction } from '../discovery/itemInteraction';

export interface CollectionGridEntry {
  item: Item;
  interaction: ItemInteraction;
  provenance?: string | null;
  caption?: string;
}

// One virtualized cover grid for saved Lists and consumed history. Card browsing
// opens the same loaded collection, never a fresh recommendation query.
export function CollectionGrid({ entries, theme, header, refreshing, onRefresh, onOpen, renderActions }: {
  entries: readonly CollectionGridEntry[];
  theme: RoomTheme;
  header: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (item: Item) => void;
  renderActions?: (item: Item) => ReactNode;
}) {
  const list = useRef<FlatList<CollectionGridEntry>>(null);
  const [imageWindow, setImageWindow] = useState({ first: 0, last: 7 });
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<CollectionGridEntry>[] }) => {
    const indexes = viewableItems.flatMap(token => token.isViewable && token.index !== null ? [token.index] : []);
    if (indexes.length) setImageWindow({ first: Math.max(0, Math.min(...indexes) - 2), last: Math.max(...indexes) + 2 });
  }, []);
  return <FlatList ref={list} data={entries} numColumns={2} keyExtractor={entry => entry.item.id}
    initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7}
    refreshing={refreshing} onRefresh={onRefresh} alwaysBounceVertical
    onViewableItemsChanged={onViewableItemsChanged}
    contentContainerStyle={{ paddingHorizontal: 3, paddingBottom: 32, flexGrow: 1 }}
    columnWrapperStyle={{ gap: 3, marginBottom: 3 }}
    ListHeaderComponent={<>
      {header}
      <View accessibilityLabel="Listan näkymä" style={{ flexDirection: 'row', gap: 18, paddingHorizontal: 18, paddingBottom: 12 }}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: true }}
          onPress={() => list.current?.scrollToOffset({ offset: 0, animated: true })} style={{ paddingVertical: 8 }}>
          <Text style={{ color: theme.base.textPrimary, fontWeight: '700' }}>Ruudukko</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!entries.length || refreshing}
          accessibilityHint="Selaa tämän listan teoksia pyyhkäistävinä kortteina"
          onPress={() => { if (entries[0]) onOpen(entries[0].item); }} style={{ paddingVertical: 8 }}>
          <Text style={{ color: entries.length ? theme.ambient.curtainHighlight : theme.base.textMuted, fontWeight: '700' }}>Kortit</Text>
        </Pressable>
      </View>
    </>}
    renderItem={({ item: entry, index }) => <View style={{ flex: 1, maxWidth: '50%' }}>
      <DiscoveryItemCard item={entry.item} index={index} theme={theme} interaction={entry.interaction}
        discoveryImageUrl={entry.item.imageUrl ? getDiscoveryImageUrl(entry.item.imageUrl) : null}
        loadImage={index >= imageWindow.first && index <= imageWindow.last}
        pendingApprovalLabel={null} sharedProvenance={entry.provenance ?? null}
        onImageLoaded={() => {}} onOpen={() => onOpen(entry.item)} />
      {entry.caption ? <Text style={{ color: theme.base.textMuted, fontSize: 10, paddingHorizontal: 8, paddingTop: 4 }}>{entry.caption}</Text> : null}
      {renderActions?.(entry.item)}
    </View>}
  />;
}
