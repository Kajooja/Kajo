import { createClient } from 'npm:@supabase/supabase-js@2';

type AuthAction = 'account-exists' | 'sign-in';

interface RequestBody {
  action?: AuthAction;
  identifier?: string;
  password?: string;
}

const headers = {
  'content-type': 'application/json; charset=utf-8',
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  let body: RequestBody;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  const identifier = normalizeIdentifier(body.identifier);

  if (!identifier) {
    return json({ error: 'invalid_identifier' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'server_configuration_error' }, 500);
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
    return json({ error: 'identifier_resolution_failed' }, 500);
  }

  const email = typeof resolvedEmail === 'string' ? resolvedEmail : null;

  if (body.action === 'account-exists') {
    return json({ exists: Boolean(email) });
  }

  if (body.action !== 'sign-in') {
    return json({ error: 'invalid_action' }, 400);
  }

  if (!email) {
    return json({ error: 'user_not_found' }, 404);
  }

  if (!body.password || body.password.length < 6) {
    return json({ error: 'wrong_password' }, 401);
  }

  const { data, error } = await serviceClient.auth.signInWithPassword({
    email,
    password: body.password,
  });

  if (error || !data.session) {
    return json({ error: 'wrong_password' }, 401);
  }

  return json({
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
