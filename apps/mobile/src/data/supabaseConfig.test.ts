import { describe, expect, it } from 'vitest';

import { resolveSupabaseConfiguration } from './supabaseConfig';

describe('resolveSupabaseConfiguration', () => {
  it('allows an unconfigured app only in explicit demo mode', () => {
    expect(
      resolveSupabaseConfiguration({
        url: undefined,
        publishableKey: undefined,
        allowDemo: true,
      }),
    ).toEqual({ status: 'unconfigured' });
  });

  it('fails closed when build identity and backend configuration are absent', () => {
    expect(resolveSupabaseConfiguration({ url: undefined, publishableKey: undefined })).toMatchObject({
      status: 'invalid', code: 'MISSING_URL',
    });
  });

  it.each(['sb_secret_private', 'unknown-key', 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature',
    'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature'])('refuses non-public key shapes without echoing them', publishableKey => {
    const result = resolveSupabaseConfiguration({ url: 'https://example.supabase.co', publishableKey });
    expect(result).toMatchObject({ status: 'invalid', code: 'INVALID_PUBLISHABLE_KEY' });
    expect(JSON.stringify(result)).not.toContain(publishableKey);
  });

  it.each([
    {
      environment: {
        url: undefined,
        publishableKey: 'sb_publishable_example',
      },
      code: 'MISSING_URL',
    },
    {
      environment: {
        url: 'https://example.supabase.co',
        publishableKey: undefined,
      },
      code: 'MISSING_PUBLISHABLE_KEY',
    },
  ] as const)('rejects partial configuration with $code', ({ environment, code }) => {
    expect(resolveSupabaseConfiguration(environment)).toMatchObject({
      status: 'invalid',
      code,
    });
  });

  it.each([
    'ftp://example.supabase.co',
    'https://example.supabase.co/rest/v1',
    'https://example.supabase.co?debug=true',
  ])('rejects invalid project URL %s', (url) => {
    expect(
      resolveSupabaseConfiguration({
        url,
        publishableKey: 'sb_publishable_example',
      }),
    ).toMatchObject({
      status: 'invalid',
      code: 'INVALID_URL',
    });
  });

  it('rejects a publishable key containing whitespace', () => {
    expect(
      resolveSupabaseConfiguration({
        url: 'https://example.supabase.co',
        publishableKey: 'sb_publishable bad',
      }),
    ).toMatchObject({
      status: 'invalid',
      code: 'INVALID_PUBLISHABLE_KEY',
    });
  });

  it('normalizes valid public configuration', () => {
    expect(
      resolveSupabaseConfiguration({
        url: ' https://example.supabase.co/ ',
        publishableKey: ' sb_publishable_example ',
      }),
    ).toEqual({
      status: 'configured',
      config: {
        url: 'https://example.supabase.co',
        publishableKey: 'sb_publishable_example',
      },
    });
  });
});
