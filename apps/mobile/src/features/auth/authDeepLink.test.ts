import { describe, expect, it } from 'vitest';

import { parseAuthDeepLink, rewriteAuthSystemPath } from './authDeepLink';

describe('parseAuthDeepLink', () => {
  it('creates a normal session from a confirmation link', () => {
    expect(
      parseAuthDeepLink(
        'kajo://auth/confirm#access_token=access-1&refresh_token=refresh-1',
      ),
    ).toEqual({
      status: 'session',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      recovery: false,
    });
  });

  it('marks password recovery links as recovery sessions', () => {
    expect(
      parseAuthDeepLink(
        'kajo://auth/recovery#access_token=access-1&refresh_token=refresh-1',
      ),
    ).toMatchObject({ status: 'session', recovery: true });
  });

  it('ignores links outside the Kajo auth scheme', () => {
    expect(parseAuthDeepLink('https://example.com/auth/confirm')).toEqual({
      status: 'ignored',
    });
  });

  it('turns Supabase redirect errors into user-facing failures', () => {
    expect(
      parseAuthDeepLink(
        'kajo://auth/recovery#error_code=otp_expired&error_description=expired',
      ),
    ).toEqual({
      status: 'error',
      message: 'Salasanan palautuslinkki ei ole enää voimassa. Pyydä uusi linkki.',
    });
  });
});

describe('rewriteAuthSystemPath', () => {
  it('preserves confirmation tokens in an Expo Router route', () => {
    expect(
      rewriteAuthSystemPath(
        'kajo://auth/confirm#access_token=access-1&refresh_token=refresh-1',
      ),
    ).toBe('/auth/confirm?access_token=access-1&refresh_token=refresh-1');
  });

  it('preserves recovery tokens in an Expo Router route', () => {
    expect(
      rewriteAuthSystemPath(
        'kajo://auth/recovery#access_token=access-1&refresh_token=refresh-1&type=recovery',
      ),
    ).toBe(
      '/auth/recovery?access_token=access-1&refresh_token=refresh-1&type=recovery',
    );
  });

  it('also handles an already normalized auth route', () => {
    expect(rewriteAuthSystemPath('/auth/confirm?code=test')).toBe(
      '/auth/confirm?code=test',
    );
  });

  it('leaves unrelated links unchanged', () => {
    expect(rewriteAuthSystemPath('https://example.com/auth/confirm')).toBe(
      'https://example.com/auth/confirm',
    );
    expect(rewriteAuthSystemPath('/discovery/books')).toBe('/discovery/books');
  });
});
