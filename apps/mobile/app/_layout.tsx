import { Stack } from 'expo-router';

import { SupabaseProvider } from '@/data/SupabaseProvider';
import { AuthGate } from '@/features/auth/AuthGate';
import { AuthSessionProvider } from '@/features/auth/AuthSessionProvider';
import { DiscoveryModeProvider } from '@/features/discovery/DiscoveryModeContext';
import { ItemInteractionProvider } from '@/features/discovery/ItemInteractionContext';

export default function RootLayout() {
  return (
    <SupabaseProvider>
      <AuthSessionProvider>
        <AuthGate>
          <DiscoveryModeProvider>
            <ItemInteractionProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </ItemInteractionProvider>
          </DiscoveryModeProvider>
        </AuthGate>
      </AuthSessionProvider>
    </SupabaseProvider>
  );
}
