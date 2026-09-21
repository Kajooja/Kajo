import React, { type Dispatch, type SetStateAction } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Item } from '../../domain/contracts';
import { visibleItemDescription } from '../../domain/itemDescription';
import type { RoomTheme } from '../../theme/roomTheme';
import { DescriptionCredit, type DescriptionLinkOpener } from './DescriptionCredit';

// Shared with the isolated native acceptance app: the same visibility boundary,
// collapse controls, typography and credit renderer used in real Item details.
export function ItemDescription({ item, expanded, onExpandedChange, theme, openLink }: {
  item: Item;
  expanded: boolean;
  onExpandedChange: Dispatch<SetStateAction<boolean>>;
  theme: RoomTheme;
  openLink?: DescriptionLinkOpener;
}) {
  const description = visibleItemDescription(item);
  if (!description.description) return null;

  return (
    <View style={styles.block}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={expanded ? 'Tiivistä kuvaus' : 'Laajenna kuvaus'}
        accessibilityState={{ expanded }}
        onPress={() => onExpandedChange(current => !current)}>
        <Text ellipsizeMode="tail" numberOfLines={expanded ? undefined : 2}
          style={[styles.description, { color: theme.base.textMuted }]}>
          {description.description}
        </Text>
      </Pressable>
      {description.descriptionAttribution ? (
        <DescriptionCredit attribution={description.descriptionAttribution}
          color={theme.base.textMuted} {...(openLink ? { openLink } : {})} />
      ) : null}
      {expanded ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tiivistä kuvaus"
          onPress={() => onExpandedChange(false)}
          style={({ pressed }) => [styles.collapse, pressed && styles.pressed]}>
          <Text style={[styles.collapseText, { color: theme.ambient.curtainHighlight }]}>
            Näytä vähemmän
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 10 },
  description: { fontSize: 13, lineHeight: 18 },
  collapse: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: 2 },
  collapseText: { fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
