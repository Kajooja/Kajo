// Shared by Expo configuration and mobile. Shape checks are not authentication.
const SUPABASE_URL_ENV_KEY = 'EXPO_PUBLIC_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY_ENV_KEY = 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
const invalid = (code, message) => ({ status: 'invalid', code, message });

function isPublicKey(value) {
  if (value.length > 4096 || /\s/.test(value)) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  const parts = value.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    const payload = JSON.parse(globalThis.atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload !== null && typeof payload === 'object' && !Array.isArray(payload) && payload.role === 'anon';
  } catch { return false; }
}

function resolveSupabaseConfiguration(environment) {
  const url = environment.url?.trim() || null;
  const publishableKey = environment.publishableKey?.trim() || null;
  if (!url && !publishableKey && environment.allowDemo === true) return { status: 'unconfigured' };
  if (!url) return invalid('MISSING_URL', `${SUPABASE_URL_ENV_KEY} is required outside explicit demo mode.`);
  if (!publishableKey) return invalid('MISSING_PUBLISHABLE_KEY', `${SUPABASE_PUBLISHABLE_KEY_ENV_KEY} is required.`);
  let parsed;
  try { parsed = new URL(url); } catch { /* Return a fixed message without the input. */ }
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/'
    || parsed.search || parsed.hash || parsed.username || parsed.password)
    return invalid('INVALID_URL', `${SUPABASE_URL_ENV_KEY} must be an HTTP(S) project origin without credentials, path, query or fragment.`);
  if (!isPublicKey(publishableKey))
    return invalid('INVALID_PUBLISHABLE_KEY', `${SUPABASE_PUBLISHABLE_KEY_ENV_KEY} must be a publishable key or legacy anon key.`);
  return { status: 'configured', config: { url: parsed.origin, publishableKey } };
}

function validateProductionConfiguration(environment) {
  const configuration = resolveSupabaseConfiguration({ ...environment, allowDemo: false });
  if (configuration.status !== 'configured') throw new Error(configuration.message);
  const url = new URL(configuration.config.url);
  if (url.protocol !== 'https:' || url.hostname === 'localhost' || url.hostname.endsWith('.localhost')
    || url.hostname === '[::1]' || /^127\./.test(url.hostname) || url.hostname === '0.0.0.0')
    throw new Error('Production Supabase URL must be a non-loopback HTTPS origin.');
  return configuration.config;
}

module.exports = { SUPABASE_URL_ENV_KEY, SUPABASE_PUBLISHABLE_KEY_ENV_KEY,
  resolveSupabaseConfiguration, validateProductionConfiguration };
