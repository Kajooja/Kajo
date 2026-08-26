import { Stack } from 'expo-router';

import { DiscoveryModeProvider } from '@/features/discovery/DiscoveryModeContext';
import { ItemInteractionProvider } from '@/features/discovery/ItemInteractionContext';

export default function RootLayout() {
  return (
    <DiscoveryModeProvider>
      <ItemInteractionProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ItemInteractionProvider>
    </DiscoveryModeProvider>
  );
}
