import { describe, expect, it, vi } from 'vitest';

import {
  signOut,
  submitEmailPassword,
  validateEmailPassword,
  type EmailPasswordAuthApi,
} from './authOperations';

function createAuthApi(): EmailPasswordAuthApi {
  return {
    signInWithPassword: vi.fn(async () => ({
      data: {
        session: { user: { id: 'user-1', email: 'reader@example.com' } },
      },
      error: null,
    })),
    signUp: vi.fn(async () => ({
      data: {
        session: { user: { id: 'user-1', email: 'reader@example.com' } },
      },
      error: null,
    })),
    signOut: vi.fn(async () => ({ error: null })),
  };
}

describe('validateEmailPassword', () => {
  it('normalizes email without changing the password', () => {
    expect(validateEmailPassword(' Reader@Example.com ', ' secret ')).toEqual({
      status: 'valid',
      credentials: {
        email: 'reader@example.com',
        password: ' secret ',
      },
    });
  });

  it('rejects invalid email and short passwords', () => {
    expect(validateEmailPassword('reader', 'secret')).toMatchObject({
      status: 'invalid',
    });
    expect(validateEmailPassword('reader@example.com', 'short')).toMatchObject({
      status: 'invalid',
    });
  });
});

describe('submitEmailPassword', () => {
  it('uses password sign-in with normalized credentials', async () => {
    const auth = createAuthApi();

    await expect(
      submitEmailPassword(auth, 'sign-in', ' Reader@Example.com ', 'secret'),
    ).resolves.toEqual({
      status: 'authenticated',
      userId: 'user-1',
      email: 'reader@example.com',
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'reader@example.com',
      password: 'secret',
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('reports when registration requires email confirmation', async () => {
    const auth = createAuthApi();
    vi.mocked(auth.signUp).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(
      submitEmailPassword(auth, 'sign-up', 'reader@example.com', 'secret'),
    ).resolves.toEqual({
      status: 'confirmation-required',
      email: 'reader@example.com',
    });
  });

  it('maps invalid credentials without exposing a backend error', async () => {
    const auth = createAuthApi();
    vi.mocked(auth.signInWithPassword).mockResolvedValueOnce({
      data: { session: null },
      error: {
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
      },
    });

    await expect(
      submitEmailPassword(auth, 'sign-in', 'reader@example.com', 'secret'),
    ).resolves.toEqual({
      status: 'error',
      message: 'Sähköposti tai salasana ei täsmää.',
    });
  });

  it('does not call Supabase when local validation fails', async () => {
    const auth = createAuthApi();

    await expect(
      submitEmailPassword(auth, 'sign-up', 'reader', 'secret'),
    ).resolves.toMatchObject({ status: 'error' });
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('reports successful and failed sign-out deterministically', async () => {
    const auth = createAuthApi();

    await expect(signOut(auth)).resolves.toEqual({ status: 'signed-out' });

    vi.mocked(auth.signOut).mockResolvedValueOnce({
      error: { message: 'network details' },
    });
    await expect(signOut(auth)).resolves.toEqual({
      status: 'error',
      message: 'Uloskirjautuminen epäonnistui. Yritä uudelleen.',
    });
  });
});
