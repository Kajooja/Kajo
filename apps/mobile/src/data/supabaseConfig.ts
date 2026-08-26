export const SUPABASE_URL_ENV_KEY = 'EXPO_PUBLIC_SUPABASE_URL';
export const SUPABASE_PUBLISHABLE_KEY_ENV_KEY =
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY';

export interface SupabaseEnvironment {
  url: string | undefined;
  publishableKey: string | undefined;
}

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export type SupabaseConfigurationState =
  | { status: 'unconfigured' }
  | {
      status: 'invalid';
      code:
        | 'MISSING_URL'
        | 'MISSING_PUBLISHABLE_KEY'
        | 'INVALID_URL'
        | 'INVALID_PUBLISHABLE_KEY';
      message: string;
    }
  | { status: 'configured'; config: SupabaseConfig };

export function readSupabaseEnvironment(): SupabaseEnvironment {
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function resolveSupabaseConfiguration(
  environment: SupabaseEnvironment,
): SupabaseConfigurationState {
  const url = normalizeValue(environment.url);
  const publishableKey = normalizeValue(environment.publishableKey);

  if (!url && !publishableKey) {
    return { status: 'unconfigured' };
  }

  if (!url) {
    return invalidConfiguration(
      'MISSING_URL',
      `${SUPABASE_URL_ENV_KEY} is required when Supabase is configured.`,
    );
  }

  if (!publishableKey) {
    return invalidConfiguration(
      'MISSING_PUBLISHABLE_KEY',
      `${SUPABASE_PUBLISHABLE_KEY_ENV_KEY} is required when Supabase is configured.`,
    );
  }

  const normalizedUrl = normalizeProjectUrl(url);

  if (!normalizedUrl) {
    return invalidConfiguration(
      'INVALID_URL',
      `${SUPABASE_URL_ENV_KEY} must be an HTTP(S) project origin without a path, query or fragment.`,
    );
  }

  if (/\s/.test(publishableKey)) {
    return invalidConfiguration(
      'INVALID_PUBLISHABLE_KEY',
      `${SUPABASE_PUBLISHABLE_KEY_ENV_KEY} must not contain whitespace.`,
    );
  }

  return {
    status: 'configured',
    config: {
      url: normalizedUrl,
      publishableKey,
    },
  };
}

function normalizeValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeProjectUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    const isOriginOnly =
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password;

    return isHttp && isOriginOnly ? url.origin : null;
  } catch {
    return null;
  }
}

function invalidConfiguration(
  code: Extract<SupabaseConfigurationState, { status: 'invalid' }>['code'],
  message: string,
): SupabaseConfigurationState {
  return { status: 'invalid', code, message };
}
