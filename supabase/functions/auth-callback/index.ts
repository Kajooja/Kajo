type CallbackType = 'signup' | 'recovery';

const responseHeaders = {
  'cache-control': 'no-store',
  'content-type': 'text/plain; charset=utf-8',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

Deno.serve((request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: responseHeaders,
    });
  }

  const url = new URL(request.url);
  const tokenHash = normalizeTokenHash(url.searchParams.get('token_hash'));
  const type = normalizeCallbackType(url.searchParams.get('type'));

  if (!tokenHash || !type) {
    return new Response('Invalid Kajo authentication link', {
      status: 400,
      headers: responseHeaders,
    });
  }

  const route = type === 'recovery' ? 'recovery' : 'confirm';
  const query = new URLSearchParams({ token_hash: tokenHash, type });
  const location = /Android/i.test(request.headers.get('user-agent') ?? '')
    ? `intent://auth/${route}?${query.toString()}#Intent;scheme=kajo;package=app.kajo.mobile;end`
    : `kajo://auth/${route}?${query.toString()}`;

  // The HTTPS hop intentionally does not verify the one-time token. Automated
  // email scanners may follow this redirect, but only Kajo consumes the token.
  return new Response(null, {
    status: 303,
    headers: {
      ...responseHeaders,
      location,
    },
  });
});

function normalizeCallbackType(value: string | null): CallbackType | null {
  return value === 'signup' || value === 'recovery' ? value : null;
}

function normalizeTokenHash(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return /^[A-Za-z0-9_-]{20,256}$/.test(normalized) ? normalized : null;
}
