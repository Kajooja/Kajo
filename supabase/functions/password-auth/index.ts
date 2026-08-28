import { createClient } from 'npm:@supabase/supabase-js@2';

type AuthAction =
  | 'account-exists'
  | 'request-password-reset'
  | 'sign-in'
  | 'verify-password-reset';

interface RequestBody {
  action?: AuthAction;
  identifier?: string;
  password?: string;
  token?: string;
}

const RECOVERY_REDIRECT = 'kajo://auth/recovery';
const headers = {
  'content-type': 'application/json; charset=utf-8',
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ status: 'error' }, 405);
  }

  let body: RequestBody;

  try {
    body = await request.json();
  } catch {
    return json({ status: 'error' }, 400);
  }

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

  if (body.action === 'verify-password-reset') {
    if (!email) {
      return json({ status: 'user-not-found' });
    }

    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!/^\d{6}$/.test(token)) {
      return json({ status: 'invalid-token' });
    }

    const { data, error } = await authClient.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    });

    if (error || !data.session) {
      return json({ status: 'invalid-token' });
    }

    return json({
      status: 'recovery-authenticated',
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      userId: data.user?.id ?? data.session.user.id,
    });
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

function readNamedKey(variableName: string): string | null {
  const raw = Deno.env.get(variableName);

  if (!raw) {
    return null;
  }

  try {
    const keys = JSON.parse(raw) as Record<string, unknown>;
    const defaultKey = keys.default;

    if (typeof defaultKey === 'string' && defaultKey.length > 0) {
      return defaultKey;
    }

    const firstKey = Object.values(keys).find(
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
