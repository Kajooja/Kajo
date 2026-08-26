import { describe, expect, it, vi } from 'vitest';

import { createSupabaseConnection } from './supabaseConnection';

describe('createSupabaseConnection', () => {
  it('does not create a client without configuration', () => {
    const createClient = vi.fn(() => ({ kind: 'client' }));

    expect(
      createSupabaseConnection(
        { url: undefined, publishableKey: undefined },
        createClient,
      ),
    ).toEqual({ status: 'unconfigured' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('does not create a client from invalid configuration', () => {
    const createClient = vi.fn(() => ({ kind: 'client' }));

    expect(
      createSupabaseConnection(
        {
          url: 'https://example.supabase.co/path',
          publishableKey: 'sb_publishable_example',
        },
        createClient,
      ),
    ).toMatchObject({ status: 'invalid', code: 'INVALID_URL' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('creates one client from normalized valid configuration', () => {
    const client = { kind: 'client' };
    const createClient = vi.fn(() => client);

    const connection = createSupabaseConnection(
      {
        url: 'https://example.supabase.co/',
        publishableKey: 'sb_publishable_example',
      },
      createClient,
    );

    expect(connection).toEqual({
      status: 'configured',
      config: {
        url: 'https://example.supabase.co',
        publishableKey: 'sb_publishable_example',
      },
      client,
    });
    expect(createClient).toHaveBeenCalledOnce();
  });
});
