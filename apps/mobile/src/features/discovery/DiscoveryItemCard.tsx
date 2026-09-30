import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Item } from '../../domain/contracts';
import type { RoomTheme } from '../../theme/roomTheme';
import type { ItemInteraction } from './itemInteraction';
import { getConsumedItemLabels } from './itemInteractionLabels';

interface ItemCardProps {
  item: Item;
  index: number;
  discoveryImageUrl: string | null;
  loadImage: boolean;
  interaction: ItemInteraction;
  pendingApprovalLabel: string | null;
  sharedProvenance: string | null;
  theme: RoomTheme;
  onImageLoaded: () => void;
  onOpen: () => void;
}

export function DiscoveryItemCard({
  item,
  index,
  discoveryImageUrl,
  loadImage,
  interaction,
  pendingApprovalLabel,
  sharedProvenance,
  theme,
  onImageLoaded,
  onOpen,
}: ItemCardProps) {
  const styles = createStyles(theme);
  const byline = getItemByline(item);
  const coverOpacity = 0.42 + (index % 3) * 0.12;
  const consumedLabel = getConsumedItemLabels(item.itemType).status;
  const renderRemoteImage = Boolean(discoveryImageUrl && loadImage);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      accessibilityHint="Opens swipe browsing and item details"
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.cover,
          {
            backgroundColor: theme.ambient.curtain,
            borderColor: theme.ambient.curtainHighlight,
          },
        ]}
      >
        {renderRemoteImage && discoveryImageUrl ? (
          <>
            <Image
              accessibilityIgnoresInvertColors
              source={{
                uri: discoveryImageUrl,
                cache: 'force-cache',
              }}
              resizeMode="cover"
              fadeDuration={80}
              onLoad={onImageLoaded}
              style={styles.coverImage}
            />
            <View pointerEvents="none" style={styles.coverImageShade} />
          </>
        ) : (
          <View
            pointerEvents="none"
            style={[
              styles.coverLight,
              {
                backgroundColor: theme.ambient.windowLight,
                opacity: coverOpacity,
              },
            ]}
          />
        )}

        {pendingApprovalLabel ? (
          <View style={styles.approvalBanner}>
            <Text numberOfLines={2} style={styles.approvalBannerText}>
              {pendingApprovalLabel}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.cardStatusRow,
            pendingApprovalLabel && styles.cardStatusRowWithApproval,
          ]}
        >
          {interaction.saved ? (
            <Text style={styles.cardStatus}>★</Text>
          ) : (
            <View />
          )}
          {interaction.rating !== null || interaction.consumed ? (
            <Text style={styles.cardStatus}>{interaction.rating !== null ? `${interaction.rating}/10` : consumedLabel}</Text>
          ) : null}
        </View>

        {!renderRemoteImage ? (
          <View style={styles.coverPlaceholderContent}>
            <Text style={styles.coverType}>
              {item.itemType === 'BOOK' ? 'KIRJA' : 'ELOKUVA'}
            </Text>
            <Text numberOfLines={3} style={styles.coverTitle}>
              {item.title}
            </Text>
            {byline ? (
              <Text numberOfLines={1} style={styles.cardByline}>
                {byline}
              </Text>
            ) : null}
            {sharedProvenance ? (
              <Text numberOfLines={1} style={styles.endorsementProvenance}>
                {sharedProvenance}
              </Text>
            ) : null}
          </View>
        ) : (
          <View pointerEvents="none" style={styles.cardMetaOverlay}>
            {sharedProvenance ? (
              <Text numberOfLines={1} style={styles.endorsementProvenance}>
                {sharedProvenance}
              </Text>
            ) : null}
            <Text numberOfLines={2} style={styles.cardTitle}>
              {item.title}
            </Text>
            {byline ? (
              <Text numberOfLines={1} style={styles.cardByline}>
                {byline}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function getItemByline(item: Item): string | null {
  const parts: string[] = [];
  const creator = item.creators?.[0]?.trim();

  if (creator) parts.push(creator);
  if (item.releaseYear) parts.push(String(item.releaseYear));

  return parts.length > 0 ? parts.join(' · ') : null;
}

function createStyles(theme: RoomTheme) {
  return StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
    },
    approvalBanner: {
      position: 'absolute',
      top: 6,
      left: 6,
      right: 6,
      zIndex: 4,
      minHeight: 36,
      paddingHorizontal: 9,
      paddingVertical: 6,
      justifyContent: 'center',
      borderRadius: 5,
      borderWidth: 1,
      borderColor: 'rgba(117, 190, 132, 0.78)',
      backgroundColor: 'rgba(34, 94, 51, 0.78)',
    },
    approvalBannerText: {
      color: '#d5f5dc',
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
    },
    cover: {
      aspectRatio: 0.8,
      borderRadius: 2,
      borderWidth: 0.5,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    coverImage: {
      ...StyleSheet.absoluteFill,
    },
    coverImageShade: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    coverLight: {
      ...StyleSheet.absoluteFill,
    },
    coverPlaceholderContent: {
      padding: 12,
    },
    cardMetaOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 7,
      backgroundColor: 'rgba(0, 0, 0, 0.56)',
    },
    cardStatusRow: {
      position: 'absolute',
      zIndex: 3,
      top: 8,
      left: 8,
      right: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardStatusRowWithApproval: {
      top: 49,
    },
    cardStatus: {
      color: theme.base.textPrimary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textShadowColor: 'rgba(0, 0, 0, 0.72)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    coverType: {
      color: theme.base.textPrimary,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.4,
      marginBottom: 6,
    },
    coverTitle: {
      color: theme.base.textPrimary,
      fontSize: 19,
      lineHeight: 22,
      fontWeight: '700',
    },
    cardTitle: {
      color: '#ffffff',
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '700',
      textShadowColor: 'rgba(0, 0, 0, 0.66)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    endorsementProvenance: {
      color: '#d2f3d9',
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      marginBottom: 3,
    },
    cardByline: {
      color: 'rgba(255, 255, 255, 0.78)',
      fontSize: 10,
      lineHeight: 13,
      marginTop: 3,
    },
    pressed: {
      opacity: 0.78,
    },
  });
}
