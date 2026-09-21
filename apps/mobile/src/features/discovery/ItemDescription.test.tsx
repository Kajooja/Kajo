import React, { type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../../../../packages/catalog-contracts/fixtures.json';
import { ATTRIBUTED_DESCRIPTION } from '@kajo/catalog-contracts';
import type { Item } from '../../domain/contracts';
import { readCatalogDescription } from '../../domain/itemDescription';
import { getRoomTheme } from '../../theme/roomTheme';
import { DescriptionCredit } from './DescriptionCredit';
import { ItemDescription } from './ItemDescription';

vi.mock('react-native', () => ({
  Pressable: 'Pressable', Text: 'Text', View: 'View',
  Alert: { alert: vi.fn() }, Linking: { openURL: vi.fn() },
  StyleSheet: { create: (value: unknown) => value },
}));

type Props = { children?: ReactNode; onPress?: () => void; numberOfLines?: number;
  accessibilityState?: { expanded: boolean }; attribution?: unknown; openLink?: unknown };
function elements(node: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
const item: Item = {
  id: 'test-item', itemType: 'BOOK', title: 'Synthetic book',
  ...readCatalogDescription(fixture.description, { descriptionProvenance: {
    contract: ATTRIBUTED_DESCRIPTION, textSha256: fixture.attribution.textSha256,
    recordSha256: fixture.attribution.recordSha256, attribution: fixture.attribution,
  } }),
};
const theme = getRoomTheme('DAWN');

describe('the shared native Item description', () => {
  it('keeps full credit beside collapsed text and exposes the actual expand/collapse controls', () => {
    const onExpandedChange = vi.fn();
    for (const expanded of [false, true]) {
      const nodes = elements(ItemDescription({ item, expanded, onExpandedChange, theme }));
      const paragraph = nodes.find(node => node.props.children === fixture.description)!;
      expect(paragraph.props.numberOfLines).toBe(expanded ? undefined : 2);
      const credit = nodes.find(node => node.type === DescriptionCredit)!;
      expect(credit.props.attribution).toEqual(fixture.attribution);
      const toggle = nodes.find(node => node.props.accessibilityState)!;
      expect(toggle.props.accessibilityState).toEqual({ expanded });
      toggle.props.onPress!();
      const update = onExpandedChange.mock.calls.at(-1)![0] as (current: boolean) => boolean;
      expect(update(expanded)).toBe(!expanded);
      expect(update(update(expanded))).toBe(expanded);
      if (expanded) {
        nodes.filter(node => node.props.onPress).at(-1)!.props.onPress!();
        expect(onExpandedChange).toHaveBeenLastCalledWith(false);
      }
    }
  });

  it('revalidates cached managed text and hides the entire invalid description block', () => {
    const { descriptionAttribution: _credit, ...missing } = item;
    for (const invalid of [missing, { ...item, description: 'Changed' },
      { ...item, descriptionAttribution: { ...item.descriptionAttribution!, sourceUrl: 'javascript:alert(1)' } },
      { ...item, descriptionStatus: 'unverified' as const }]) {
      expect(ItemDescription({ item: invalid, expanded: false, onExpandedChange: vi.fn(), theme })).toBeNull();
    }
  });

  it('retains legacy paragraphs without credit and passes only explicit test opener overrides', () => {
    const legacy: Item = { ...item, ...readCatalogDescription(fixture.description, {}) };
    delete legacy.descriptionAttribution;
    const nodes = elements(ItemDescription({ item: legacy, expanded: false, onExpandedChange: vi.fn(), theme }));
    expect(nodes.some(node => node.props.children === fixture.description)).toBe(true);
    expect(nodes.some(node => node.type === DescriptionCredit)).toBe(false);
    const openLink = vi.fn();
    const injected = elements(ItemDescription({ item, expanded: false, onExpandedChange: vi.fn(), theme, openLink }));
    expect(injected.find(node => node.type === DescriptionCredit)!.props.openLink).toBe(openLink);
  });
});
