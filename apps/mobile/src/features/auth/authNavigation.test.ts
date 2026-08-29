import { describe, expect, it, vi } from 'vitest';

import { returnToSignedOutLogin } from './authNavigation';

describe('returnToSignedOutLogin', () => {
  it('clears the callback route stack before replacing it with login', () => {
    const calls: string[] = [];
    const router = {
      dismissAll: vi.fn(() => calls.push('dismissAll')),
      replace: vi.fn((path: '/') => calls.push(`replace:${path}`)),
    };

    returnToSignedOutLogin(router);

    expect(calls).toEqual(['dismissAll', 'replace:/']);
  });
});
