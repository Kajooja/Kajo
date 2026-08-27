export const AUTH_CONFIRM_REDIRECT = 'kajo://auth/confirm';
export const AUTH_RECOVERY_REDIRECT = 'kajo://auth/recovery';

export type AuthDeepLinkResult =
  | { status: 'ignored' }
  | { status: 'error'; message: string }
  | {
      status: 'session';
      accessToken: string;
      refreshToken: string;
      recovery: boolean;
    };

export function parseAuthDeepLink(url: string): AuthDeepLinkResult {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return { status: 'ignored' };
  }

  if (parsed.protocol !== 'kajo:' || parsed.hostname !== 'auth') {
    return { status: 'ignored' };
  }

  const route = parsed.pathname.replace(/^\//, '');

  if (route !== 'confirm' && route !== 'recovery') {
    return { status: 'ignored' };
  }

  const fragmentParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const errorCode =
    fragmentParams.get('error_code') ?? parsed.searchParams.get('error_code');

  if (errorCode) {
    return {
      status: 'error',
      message:
        route === 'recovery'
          ? 'Salasanan palautuslinkki ei ole enää voimassa. Pyydä uusi linkki.'
          : 'Sähköpostin vahvistuslinkki ei ole enää voimassa. Yritä kirjautua uudelleen.',
    };
  }

  const accessToken =
    fragmentParams.get('access_token') ?? parsed.searchParams.get('access_token');
  const refreshToken =
    fragmentParams.get('refresh_token') ?? parsed.searchParams.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return {
      status: 'error',
      message: 'Kirjautumislinkkiä ei voitu käsitellä. Yritä uudelleen.',
    };
  }

  return {
    status: 'session',
    accessToken,
    refreshToken,
    recovery: route === 'recovery',
  };
}
