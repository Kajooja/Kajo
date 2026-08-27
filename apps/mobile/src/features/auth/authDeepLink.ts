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

export function rewriteAuthSystemPath(path: string): string {
  const authUrl = normalizeAuthSystemUrl(path);

  if (!authUrl) {
    return path;
  }

  let parsed: URL;

  try {
    parsed = new URL(authUrl);
  } catch {
    return path;
  }

  if (parsed.protocol !== 'kajo:' || parsed.hostname !== 'auth') {
    return path;
  }

  const route = parsed.pathname.replace(/^\//, '');

  if (route !== 'confirm' && route !== 'recovery') {
    return path;
  }

  const params = new URLSearchParams(parsed.search);
  const fragmentParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));

  fragmentParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.append(key, value);
    }
  });

  const query = params.toString();
  const target = `/auth/${route}`;
  return query ? `${target}?${query}` : target;
}

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

function normalizeAuthSystemUrl(path: string): string | null {
  if (path.startsWith('kajo://')) {
    return path;
  }

  const match = path.match(/^\/?auth\/(confirm|recovery)(.*)$/);

  if (!match) {
    return null;
  }

  return `kajo://auth/${match[1]}${match[2] ?? ''}`;
}
