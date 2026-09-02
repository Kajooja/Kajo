import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadRecentListIds, rememberRecentList } from './listRecentUse';

describe('recent List destination storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('moves the latest chosen List to the front inside one Profile scope', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    rememberRecentList('profile-a', 'list-a');
    rememberRecentList('profile-a', 'list-b');
    rememberRecentList('profile-a', 'list-a');

    expect(loadRecentListIds('profile-a')).toEqual(['list-a', 'list-b']);
    expect(loadRecentListIds('profile-b')).toEqual([]);
  });

  it('falls back safely when device ordering storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('unavailable'); },
      setItem: () => { throw new Error('unavailable'); },
    });

    expect(loadRecentListIds('profile-a')).toEqual([]);
    expect(rememberRecentList('profile-a', 'list-a')).toEqual(['list-a']);
  });
});
