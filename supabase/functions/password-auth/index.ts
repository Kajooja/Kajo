import { createClient } from 'npm:@supabase/supabase-js@2';

type AuthAction = 'account-exists' | 'request-password-reset' | 'sign-in';

interface RequestBody {
  action?: AuthAction;
  identifier?: string;
  password?: string;
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ status: 'error' }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: resolvedEmail, error: resolutionError } = await serviceClient.rpc(
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

    const { error } = await serviceClient.auth.resetPasswordForEmail(email, {
      redirectTo: RECOVERY_REDIRECT,
    });

    return json({ status: error ? 'error' : 'recovery-sent' }, error ? 500 : 200);
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

  const { data, error } = await serviceClient.auth.signInWithPassword({
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
