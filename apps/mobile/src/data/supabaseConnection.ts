import {
  resolveSupabaseConfiguration,
  type SupabaseConfig,
  type SupabaseConfigurationState,
  type SupabaseEnvironment,
} from './supabaseConfig';

export type SupabaseConnection<TClient> =
  | Exclude<SupabaseConfigurationState, { status: 'configured' }>
  | { status: 'configured'; config: SupabaseConfig; client: TClient };

export type SupabaseClientFactory<TClient> = (config: SupabaseConfig) => TClient;

export function createSupabaseConnection<TClient>(
  environment: SupabaseEnvironment,
  createClient: SupabaseClientFactory<TClient>,
): SupabaseConnection<TClient> {
  const configuration = resolveSupabaseConfiguration(environment);

  if (configuration.status !== 'configured') {
    return configuration;
  }

  return {
    ...configuration,
    client: createClient(configuration.config),
  };
}
