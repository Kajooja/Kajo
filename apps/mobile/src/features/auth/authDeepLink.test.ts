import { describe, expect, it } from 'vitest';

import { rewriteAuthSystemPath } from './authDeepLink';

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

  it('preserves scanner-safe token hashes in the native route', () => {
    expect(
      rewriteAuthSystemPath(
        'kajo://auth/recovery?token_hash=token-hash-1234567890&type=recovery',
      ),
    ).toBe(
      '/auth/recovery?token_hash=token-hash-1234567890&type=recovery',
    );
  });

  it('recovers the token from an Android intent path', () => {
    expect(
      rewriteAuthSystemPath(
        'intent://auth/confirm/token-hash-1234567890?type=email#Intent;scheme=kajo;package=app.kajo.mobile;end',
      ),
    ).toBe(
      '/auth/confirm?type=email&token_hash=token-hash-1234567890',
    );
  });

  it('also accepts the previous query-only Android intent format', () => {
    expect(
      rewriteAuthSystemPath(
        'intent://auth/recovery?token_hash=token-hash-1234567890&type=recovery#Intent;scheme=kajo;package=app.kajo.mobile;end',
      ),
    ).toBe(
      '/auth/recovery?token_hash=token-hash-1234567890&type=recovery',
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
