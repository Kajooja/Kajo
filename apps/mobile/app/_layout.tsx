import { Stack } from 'expo-router';

import { DiscoveryModeProvider } from '@/features/discovery/DiscoveryModeContext';

export default function RootLayout() {
  return (
    <DiscoveryModeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </DiscoveryModeProvider>
  );
}
