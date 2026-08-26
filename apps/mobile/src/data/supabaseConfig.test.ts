import { describe, expect, it } from 'vitest';

import { resolveSupabaseConfiguration } from './supabaseConfig';

describe('resolveSupabaseConfiguration', () => {
  it('keeps the app unconfigured when both public values are absent', () => {
    expect(
      resolveSupabaseConfiguration({
        url: undefined,
        publishableKey: undefined,
      }),
    ).toEqual({ status: 'unconfigured' });
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
