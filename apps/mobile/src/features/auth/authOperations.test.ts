import { describe, expect, it, vi } from 'vitest';

import {
  checkAccountAvailability,
  normalizeLoginIdentifier,
  requestEmailConfirmation,
  requestPasswordRecovery,
  signOut,
  submitEmailSignUp,
  submitIdentifierPassword,
  validateEmailPassword,
  verifyAuthEmailLink,
  type AuthEmailLinkApi,
  type EmailPasswordAuthApi,
  type PasswordAuthBridge,
} from './authOperations';

function createAuthApi(): EmailPasswordAuthApi {
  return {
    signUp: vi.fn(async () => ({
      data: {
        session: { user: { id: 'user-1', email: 'reader@example.com' } },
      },
      error: null,
    })),
    signOut: vi.fn(async () => ({ error: null })),
  };
}

function createBridge(data: unknown): PasswordAuthBridge {
  return {
    invoke: vi.fn(async () => ({ data, error: null })),
  };
}

function createEmailLinkApi(): AuthEmailLinkApi {
  const response = {
    data: {
      session: {
        user: { id: 'user-1' },
        access_token: 'access-1',
        refresh_token: 'refresh-1',
      },
    },
    error: null,
  };

  return {
    verifyOtp: vi.fn(async () => response),
    setSession: vi.fn(async () => response),
  };
}

describe('identifier normalization', () => {
  it('matches nickname casing without changing the stored display nickname', () => {
    expect(normalizeLoginIdentifier('  KeTTu  ')).toBe('kettu');
  });
});

describe('validateEmailPassword', () => {
  it('normalizes email without changing the password', () => {
    expect(validateEmailPassword(' Reader@Example.com ', ' secret ')).toEqual({
      status: 'valid',
      email: 'reader@example.com',
      password: ' secret ',
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

describe('submitIdentifierPassword', () => {
  it('signs in a mixed-case nickname through the identifier bridge', async () => {
    const bridge = createBridge({
      status: 'authenticated',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      userId: 'user-1',
    });

    await expect(
      submitIdentifierPassword(bridge, ' KeTTu ', 'secret'),
    ).resolves.toEqual({
      status: 'session',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      userId: 'user-1',
    });
    expect(bridge.invoke).toHaveBeenCalledWith({
      action: 'sign-in',
      identifier: 'kettu',
      password: 'secret',
    });
  });

  it('distinguishes a missing identifier from a wrong password', async () => {
    const missing = createBridge({ status: 'user-not-found' });
    const wrongPassword = createBridge({ status: 'wrong-password' });

    await expect(
      submitIdentifierPassword(missing, 'unknown', 'secret'),
    ).resolves.toEqual({
      status: 'error',
      message: 'Käyttäjätunnusta ei löydy.',
    });
    await expect(
      submitIdentifierPassword(wrongPassword, 'KeTTu', 'wrong-secret'),
    ).resolves.toEqual({
      status: 'error',
      message: 'Salasana on väärin.',
    });
  });

  it('reports an unconfirmed email separately', async () => {
    const bridge = createBridge({ status: 'email-not-confirmed' });

    await expect(
      submitIdentifierPassword(bridge, 'reader@example.com', 'secret'),
    ).resolves.toEqual({
      status: 'error',
      code: 'email-not-confirmed',
      message: 'Sähköpostiosoitetta ei ole vielä vahvistettu. Tarkista sähköpostisi.',
    });
  });
});

describe('registration operations', () => {
  it('detects an existing email or nickname without exposing account data', async () => {
    const bridge = createBridge({ status: 'exists' });

    await expect(
      checkAccountAvailability(bridge, ' KeTTu '),
    ).resolves.toEqual({ status: 'exists' });
    expect(bridge.invoke).toHaveBeenCalledWith({
      action: 'account-exists',
      identifier: 'kettu',
    });
  });

  it('sends the display-cased nickname and mobile confirmation redirect', async () => {
    const auth = createAuthApi();

    await expect(
      submitEmailSignUp(
        auth,
        ' Reader@Example.com ',
        'secret',
        'KeTTu',
        'kajo://auth/confirm',
      ),
    ).resolves.toEqual({
      status: 'authenticated',
      userId: 'user-1',
      email: 'reader@example.com',
    });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'reader@example.com',
      password: 'secret',
      options: {
        data: { kajo_nickname: 'KeTTu' },
        emailRedirectTo: 'kajo://auth/confirm',
      },
    });
  });

  it('reports when registration requires email confirmation', async () => {
    const auth = createAuthApi();
    vi.mocked(auth.signUp).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(
      submitEmailSignUp(
        auth,
        'reader@example.com',
        'secret',
        'KeTTu',
        'kajo://auth/confirm',
      ),
    ).resolves.toEqual({
      status: 'confirmation-required',
      email: 'reader@example.com',
    });
  });
});

describe('password recovery', () => {
  it('requests recovery with either login identifier', async () => {
    const bridge = createBridge({ status: 'recovery-sent' });

    await expect(requestPasswordRecovery(bridge, ' KeTTu ')).resolves.toEqual({
      status: 'sent',
    });
    expect(bridge.invoke).toHaveBeenCalledWith({
      action: 'request-password-reset',
      identifier: 'kettu',
    });
  });

  it('reports a missing recovery identifier', async () => {
    const bridge = createBridge({ status: 'user-not-found' });

    await expect(
      requestPasswordRecovery(bridge, 'unknown'),
    ).resolves.toEqual({
      status: 'error',
      message: 'Käyttäjätunnusta ei löydy.',
    });
  });
});

describe('auth email links', () => {
  it('verifies a scanner-safe signup token hash only inside the app', async () => {
    const auth = createEmailLinkApi();

    await expect(
      verifyAuthEmailLink(auth, {
        tokenHash: 'token-hash-1234567890',
        type: 'email',
      }),
    ).resolves.toEqual({
      status: 'verified',
      userId: 'user-1',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'token-hash-1234567890',
      type: 'email',
    });
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('verifies a scanner-safe recovery token before password reset', async () => {
    const auth = createEmailLinkApi();

    await expect(
      verifyAuthEmailLink(auth, {
        tokenHash: 'recovery-token-hash-1234567890',
        type: 'recovery',
      }),
    ).resolves.toEqual({
      status: 'verified',
      userId: 'user-1',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'recovery-token-hash-1234567890',
      type: 'recovery',
    });
  });

  it('still accepts legacy links containing an existing session', async () => {
    const auth = createEmailLinkApi();

    await expect(
      verifyAuthEmailLink(auth, {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        type: 'recovery',
      }),
    ).resolves.toEqual({
      status: 'verified',
      userId: 'user-1',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
    });
  });
});

describe('email confirmation resend', () => {
  it('requests a new signup confirmation by email or nickname', async () => {
    const bridge = createBridge({ status: 'confirmation-sent' });

    await expect(requestEmailConfirmation(bridge, ' KeTTu ')).resolves.toEqual({
      status: 'sent',
    });
    expect(bridge.invoke).toHaveBeenCalledWith({
      action: 'resend-confirmation',
      identifier: 'kettu',
    });
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
