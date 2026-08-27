import { Stack } from 'expo-router';

import { SupabaseProvider } from '@/data/SupabaseProvider';
import { AuthGate } from '@/features/auth/AuthGate';
import { AuthSessionProvider } from '@/features/auth/AuthSessionProvider';
import { DiscoveryModeProvider } from '@/features/discovery/DiscoveryModeContext';
import { ItemInteractionProvider } from '@/features/discovery/ItemInteractionContext';
import { PersonalProfileProvider } from '@/features/profiles/PersonalProfileProvider';

export default function RootLayout() {
  return (
    <SupabaseProvider>
      <AuthSessionProvider>
        <PersonalProfileProvider>
          <AuthGate>
            <DiscoveryModeProvider>
              <ItemInteractionProvider>
                <Stack screenOptions={{ headerShown: false }} />
              </ItemInteractionProvider>
            </DiscoveryModeProvider>
          </AuthGate>
        </PersonalProfileProvider>
      </AuthSessionProvider>
    </SupabaseProvider>
  );
}
