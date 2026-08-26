import { Stack } from 'expo-router';

import { SupabaseProvider } from '@/data/SupabaseProvider';
import { DiscoveryModeProvider } from '@/features/discovery/DiscoveryModeContext';
import { ItemInteractionProvider } from '@/features/discovery/ItemInteractionContext';

export default function RootLayout() {
  return (
    <SupabaseProvider>
      <DiscoveryModeProvider>
        <ItemInteractionProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ItemInteractionProvider>
      </DiscoveryModeProvider>
    </SupabaseProvider>
  );
}
