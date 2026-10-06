import React, { type ReactElement, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import type { ItemType } from '../../domain/contracts';
import { getRoomTheme } from '../../theme/roomTheme';
import { DiscoveryCollectionHeader } from './DiscoveryCollectionHeader';

const hook = vi.hoisted(() => ({ expandedItemType: null as ItemType | null }));
vi.mock('react', async () => ({
  ...await vi.importActual<typeof import('react')>('react'),
  useState: () => [hook.expandedItemType, (value: ItemType | null) => { hook.expandedItemType = value; }],
}));
vi.mock('expo-router', () => ({ router: { replace: vi.fn(), push: vi.fn() } }));
vi.mock('react-native', () => ({
  Pressable: 'Pressable', Text: 'Text', View: 'View',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 },
}));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());

type Props = { children?: ReactNode; accessibilityLabel?: string; accessibilityState?: { expanded?: boolean; selected?: boolean };
  onPress?: () => void; style?: unknown };
function elements(node: ReactNode): ReactElement<Props>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function text(node: ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<Props>(child)
    ? text(child.props.children) : String(child)).join(' ');
}
function render(itemType: ItemType = 'MOVIE') {
  return DiscoveryCollectionHeader({ itemType, title: itemType === 'MOVIE' ? 'Elokuvat' : 'Kirjat', theme: getRoomTheme('DAWN') });
}
function button(tree: ReactNode, label: string) {
  return elements(tree).find(node => node.props.accessibilityLabel?.startsWith(label))!.props;
}

beforeEach(() => { hook.expandedItemType = null; vi.clearAllMocks(); });
describe('compact Discovery category and collection navigation', () => {
  it.each(['MOVIE', 'BOOK'] as const)('keeps the title and collection choices in one responsive row for %s', itemType => {
    const tree = render(itemType);
    const row = elements(tree).find(node => node.props.accessibilityLabel === 'Sisältölaji ja kokoelma')!;
    expect(text(row)).toBe(itemType === 'MOVIE' ? 'Elokuvat ▾ Löydä Katsotut' : 'Kirjat ▾ Löydä Luetut');
    expect(row.props.style).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(button(tree, 'Löydä.').accessibilityState).toEqual({ selected: true });
    expect(elements(tree).filter(node => node.type === 'Pressable')).toHaveLength(3);
  });

  it('opens the category selector on demand and replaces only the current category route', () => {
    button(render(), 'Vaihda sisältölajia.').onPress!();
    const expanded = render();
    expect(button(expanded, 'Vaihda sisältölajia.').accessibilityState).toEqual({ expanded: true });
    expect(button(expanded, 'Valitse elokuvat').accessibilityState).toEqual({ selected: true });
    button(expanded, 'Valitse kirjat').onPress!();
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/discovery/books');
    expect(button(render('BOOK'), 'Vaihda sisältölajia.').accessibilityState).toEqual({ expanded: false });
  });

  it('selecting the current category or Löydä preserves the loaded recommendation run', () => {
    button(render(), 'Vaihda sisältölajia.').onPress!();
    button(render(), 'Valitse elokuvat').onPress!();
    expect(router.replace).not.toHaveBeenCalled();
    button(render(), 'Vaihda sisältölajia.').onPress!();
    button(render(), 'Löydä.').onPress!();
    expect(button(render(), 'Vaihda sisältölajia.').accessibilityState).toEqual({ expanded: false });
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each(['MOVIE', 'BOOK'] as const)('opens the canonical consumed history with the same %s type', itemType => {
    button(render(itemType), 'Vaihda sisältölajia.').onPress!();
    button(render(itemType), itemType === 'MOVIE' ? 'Avaa katsotut' : 'Avaa luetut').onPress!();
    expect(router.push).toHaveBeenCalledExactlyOnceWith({ pathname: '/lists/history', params: { itemType } });
    expect(hook.expandedItemType).toBeNull();
  });

  it('does not keep an expanded old-domain menu in a newly selected domain', () => {
    button(render('MOVIE'), 'Vaihda sisältölajia.').onPress!();
    expect(button(render('BOOK'), 'Vaihda sisältölajia.').accessibilityState).toEqual({ expanded: false });
    expect(elements(render('BOOK')).some(node => node.props.accessibilityLabel?.startsWith('Valitse'))).toBe(false);
  });
});
