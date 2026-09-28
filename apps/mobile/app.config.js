const { resolveSupabaseConfiguration, validateProductionConfiguration } = require('./src/data/supabaseConfigPolicy');

module.exports = ({ config }) => {
  // Expo export forces NODE_ENV=production, including local smoke builds.
  // Demo therefore has its own explicit identity, also embedded for runtime.
  const mode = process.env.KAJO_BUILD_MODE ?? 'production';
  if (!['production', 'demo'].includes(mode)) throw new Error('KAJO_BUILD_MODE must be production or demo.');
  const environment = { url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, allowDemo: mode === 'demo' };
  if (mode === 'production') validateProductionConfiguration(environment);
  else {
    const state = resolveSupabaseConfiguration(environment);
    if (state.status === 'invalid') throw new Error(state.message);
  }
  return { ...config, extra: { ...config.extra, kajoBuildMode: mode } };
};
