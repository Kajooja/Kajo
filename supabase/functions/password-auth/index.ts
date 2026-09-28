import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

type AuthAction =
  | 'account-exists'
  | 'resend-confirmation'
  | 'request-password-reset'
  | 'sign-in';

interface RequestBody {
  action: AuthAction;
  identifier: string;
  password?: string;
}

const RECOVERY_REDIRECT = 'kajo://auth/recovery';
const CONFIRM_REDIRECT = 'kajo://auth/confirm';
const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};
const MAX_BODY_BYTES = 8192;

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ status: 'error' }, 405);
  }

  let input: unknown;

  try {
    input = await readBoundedBody(request);
  } catch {
    return json({ status: 'error' }, 400);
  }

  if (!isRequestBody(input)) return json({ status: 'error' }, 400);
  const body = input;

  const identifier = normalizeIdentifier(body.identifier);

  if (!identifier) {
    return json({ status: 'invalid-identifier' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey =
    readNamedKey('SUPABASE_SECRET_KEYS') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey =
    readNamedKey('SUPABASE_PUBLISHABLE_KEYS') ??
    Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !secretKey || !publishableKey) {
    return json({ status: 'error' }, 500);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: resolvedEmail, error: resolutionError } = await adminClient.rpc(
    'resolve_login_email',
    { input_identifier: identifier },
  );

  if (resolutionError) {
    return json({ status: 'error' }, 500);
  }

  const email = typeof resolvedEmail === 'string' ? resolvedEmail : null;

  if (body.action === 'account-exists') {
    return json({ status: email ? 'exists' : 'available' });
  }

  if (body.action === 'request-password-reset') {
    if (!email) {
      return json({ status: 'user-not-found' });
    }

    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: RECOVERY_REDIRECT,
    });

    return json({ status: error ? 'error' : 'recovery-sent' }, error ? 500 : 200);
  }

  if (body.action === 'resend-confirmation') {
    if (!email) {
      return json({ status: 'user-not-found' });
    }

    const { error } = await authClient.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: CONFIRM_REDIRECT },
    });

    return json(
      { status: error ? 'error' : 'confirmation-sent' },
      error ? 500 : 200,
    );
  }

  if (body.action !== 'sign-in') {
    return json({ status: 'error' }, 400);
  }

  if (!email) {
    return json({ status: 'user-not-found' });
  }

  if (!body.password || body.password.length < 6) {
    return json({ status: 'wrong-password' });
  }

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password: body.password,
  });

  if (error) {
    if (error.code === 'email_not_confirmed') {
      return json({ status: 'email-not-confirmed' });
    }

    if (error.code === 'invalid_credentials') {
      return json({ status: 'wrong-password' });
    }

    return json({ status: 'error' }, 500);
  }

  if (!data.session) {
    return json({ status: 'error' }, 500);
  }

  return json({
    status: 'authenticated',
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userId: data.user?.id ?? data.session.user.id,
  });
});

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length >= 2 && normalized.length <= 320 ? normalized : null;
}

function isRequestBody(value: unknown): value is RequestBody {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  const actions = ['account-exists', 'resend-confirmation', 'request-password-reset', 'sign-in'];
  if (typeof body.action !== 'string' || !actions.includes(body.action)
    || typeof body.identifier !== 'string' || body.identifier.length > 320
    || /[\u0000-\u001f\u007f]/.test(body.identifier)) return false;
  const allowed = body.action === 'sign-in' ? ['action', 'identifier', 'password'] : ['action', 'identifier'];
  if (Object.keys(body).some(key => !allowed.includes(key))) return false;
  return body.action !== 'sign-in' || typeof body.password === 'string' && body.password.length >= 6 && body.password.length <= 1024;
}

async function readBoundedBody(request: Request): Promise<unknown> {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new Error('invalid-body');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid-body');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let complete = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('invalid-body')), 5000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) { complete = true; break; }
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES || chunks.length >= MAX_BODY_BYTES) throw new Error('invalid-body');
      chunks.push(value);
    }
    const raw = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  } finally {
    clearTimeout(timer);
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function readNamedKey(variableName: string): string | null {
  const raw = Deno.env.get(variableName);

  if (!raw) {
    return null;
  }

  try {
    const keys: unknown = JSON.parse(raw);
    if (keys === null || typeof keys !== 'object' || Array.isArray(keys)) return null;
    const values = keys as Record<string, unknown>;
    const defaultKey = values.default;

    if (typeof defaultKey === 'string' && defaultKey.length > 0) {
      return defaultKey;
    }

    const firstKey = Object.values(values).find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    return firstKey ?? null;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
