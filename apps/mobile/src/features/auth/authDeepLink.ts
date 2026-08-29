export const AUTH_CONFIRM_REDIRECT = 'kajo://auth/confirm';

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

  const [route, tokenHashFromPath, ...rest] = parsed.pathname
    .replace(/^\//, '')
    .split('/');

  if (
    (route !== 'confirm' && route !== 'recovery') ||
    rest.length > 0
  ) {
    return path;
  }

  const params = new URLSearchParams(parsed.search);

  if (tokenHashFromPath && !params.has('token_hash')) {
    params.set('token_hash', tokenHashFromPath);
  }

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

function normalizeAuthSystemUrl(path: string): string | null {
  if (path.startsWith('intent://auth/')) {
    const intentMarker = path.indexOf('#Intent;');
    const dataUrl = intentMarker >= 0 ? path.slice(0, intentMarker) : path;
    return dataUrl.replace(/^intent:\/\//, 'kajo://');
  }

  if (path.startsWith('kajo://')) {
    return path;
  }

  const match = path.match(/^\/?auth\/(confirm|recovery)(.*)$/);

  if (!match) {
    return null;
  }

  return `kajo://auth/${match[1]}${match[2] ?? ''}`;
}
