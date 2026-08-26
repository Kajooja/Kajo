import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { readSupabaseEnvironment } from './supabaseConfig';
import {
  createSupabaseConnection,
  type SupabaseConnection,
} from './supabaseConnection';

export const supabaseConnection: SupabaseConnection<SupabaseClient> =
  createSupabaseConnection(readSupabaseEnvironment(), ({ url, publishableKey }) =>
    createClient(url, publishableKey, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }),
  );
