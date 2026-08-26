import { createContext, useContext, type PropsWithChildren } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseConnection } from './supabase';
import type { SupabaseConnection } from './supabaseConnection';

type SupabaseContextState = SupabaseConnection<SupabaseClient>;

const SupabaseContext = createContext<SupabaseContextState | null>(null);

export function SupabaseProvider({ children }: PropsWithChildren) {
  return (
    <SupabaseContext.Provider value={supabaseConnection}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabaseConnection(): SupabaseContextState {
  const connection = useContext(SupabaseContext);

  if (!connection) {
    throw new Error('useSupabaseConnection must be used within SupabaseProvider');
  }

  return connection;
}
