import React, { type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DescriptionAttribution } from '@kajo/catalog-contracts';
import fixture from '../../../../../packages/catalog-contracts/fixtures.json';
import { DescriptionCredit } from './DescriptionCredit';

const native = vi.hoisted(() => ({ openURL: vi.fn(), alert: vi.fn() }));
vi.mock('react-native', () => ({
  Alert: { alert: native.alert }, Linking: { openURL: native.openURL },
  Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: (value: unknown) => value },
}));
type Props = { children?: ReactNode; accessibilityRole?: string; accessibilityLabel?: string;
  onPress?: () => void; numberOfLines?: number };
function elements(node: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
const attribution = fixture.attribution as DescriptionAttribution;

describe('description credit links', () => {
  beforeEach(() => { vi.resetAllMocks(); native.openURL.mockResolvedValue(undefined); });
  it('keeps all required credit visible and opens separately labelled source and license links', () => {
    const tree = DescriptionCredit({ attribution, color: '#fff' });
    const nodes = elements(tree);
    const links = nodes.filter(node => node.props.accessibilityRole === 'link');
    expect(links.map(link => link.props.accessibilityLabel)).toEqual([
      `Kuvauksen lähde: ${attribution.sourceTitle}`, `Kuvauksen lisenssi: ${attribution.licenseName}`,
    ]);
    const rendered = JSON.stringify(tree);
    for (const value of [attribution.credit, attribution.sourceTitle, attribution.sourceRevision,
      attribution.licenseName, attribution.changes]) expect(rendered).toContain(value);
    expect(nodes.every(node => node.props.numberOfLines === undefined)).toBe(true);
    links.forEach(link => link.props.onPress!());
    expect(native.openURL.mock.calls).toEqual([[attribution.sourceUrl], [attribution.licenseUrl]]);
  });
  it('rechecks link safety before invoking the native opener', () => {
    const tree = DescriptionCredit({ attribution: { ...attribution, sourceUrl: 'javascript:alert(1)' }, color: '#fff' });
    elements(tree).find(node => node.props.accessibilityRole === 'link')!.props.onPress!();
    expect(native.openURL).not.toHaveBeenCalled();
  });
  it('reports native link errors without exposing transport details', async () => {
    native.openURL.mockRejectedValue(new Error('Private native detail'));
    const tree = DescriptionCredit({ attribution, color: '#fff' });
    elements(tree).find(node => node.props.accessibilityRole === 'link')!.props.onPress!();
    await Promise.resolve();
    expect(native.alert).toHaveBeenCalledWith('Linkki ei auennut', 'Yritä uudelleen hetken kuluttua.');
  });
  it('recovers after one injected failure using the same link without changing production defaults', async () => {
    const openLink = vi.fn().mockRejectedValueOnce(new Error('Synthetic failure')).mockResolvedValue(undefined);
    const tree = DescriptionCredit({ attribution, color: '#fff', openLink });
    const link = elements(tree).find(node => node.props.accessibilityRole === 'link')!;
    link.props.onPress!();
    await Promise.resolve();
    link.props.onPress!();
    await Promise.resolve();
    expect(openLink.mock.calls).toEqual([[attribution.sourceUrl], [attribution.sourceUrl]]);
    expect(native.alert).toHaveBeenCalledTimes(1);
    expect(native.openURL).not.toHaveBeenCalled();
  });
});
