export const SUPABASE_URL_ENV_KEY: 'EXPO_PUBLIC_SUPABASE_URL';
export const SUPABASE_PUBLISHABLE_KEY_ENV_KEY: 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
export interface SupabaseEnvironment {
  url: string | undefined;
  publishableKey: string | undefined;
  allowDemo?: boolean;
}
export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}
export type SupabaseConfigurationState =
  | { status: 'unconfigured' }
  | { status: 'invalid'; code: 'MISSING_URL' | 'MISSING_PUBLISHABLE_KEY' | 'INVALID_URL' | 'INVALID_PUBLISHABLE_KEY'; message: string }
  | { status: 'configured'; config: SupabaseConfig };
export function resolveSupabaseConfiguration(environment: SupabaseEnvironment): SupabaseConfigurationState;
export function validateProductionConfiguration(environment: SupabaseEnvironment): SupabaseConfig;
