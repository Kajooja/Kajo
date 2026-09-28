import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import { readSupabaseEnvironment } from './supabaseConfig';
import {
  createSupabaseConnection,
  type SupabaseConnection,
} from './supabaseConnection';

export const supabaseConnection: SupabaseConnection<SupabaseClient> =
  createSupabaseConnection(readSupabaseEnvironment(Constants.expoConfig?.extra?.kajoBuildMode), ({ url, publishableKey }) =>
    createClient(url, publishableKey, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }),
  );
