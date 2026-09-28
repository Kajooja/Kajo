import type { SupabaseEnvironment } from './supabaseConfigPolicy';

export {
  SUPABASE_URL_ENV_KEY,
  SUPABASE_PUBLISHABLE_KEY_ENV_KEY,
  resolveSupabaseConfiguration,
  type SupabaseEnvironment,
  type SupabaseConfig,
  type SupabaseConfigurationState,
} from './supabaseConfigPolicy';

export function readSupabaseEnvironment(buildMode: unknown = 'production'): SupabaseEnvironment {
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    allowDemo: buildMode === 'demo',
  };
}
