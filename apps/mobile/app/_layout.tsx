import { useEffect, useState } from 'react';
import { Stack, useSegments } from 'expo-router';

import { SupabaseProvider } from '@/data/SupabaseProvider';
import { AuthGate } from '@/features/auth/AuthGate';
import { AuthSessionProvider } from '@/features/auth/AuthSessionProvider';
import { StartupSplash } from '@/features/branding/KajoBrand';
import { DiscoveryModeProvider } from '@/features/discovery/DiscoveryModeContext';
import { DiscoveryModeShell } from '@/features/discovery/DiscoveryModeShell';
import { ItemInteractionProvider } from '@/features/discovery/ItemInteractionContext';
import { SharedEndorsementProvider } from '@/features/discovery/SharedEndorsementContext';
import { EventTrackingProvider } from '@/features/events/EventTrackingContext';
import { ItemListsProvider } from '@/features/lists/ItemListsContext';
import { ProfileMessagesProvider } from '@/features/messages/ProfileMessagesContext';
import { ActiveProfileProvider } from '@/features/profiles/ActiveProfileContext';
import { PersonalProfileProvider } from '@/features/profiles/PersonalProfileProvider';

const STARTUP_SPLASH_DURATION_MS = 2000;

export default function RootLayout() {
  const segments = useSegments();
  const [showStartupSplash, setShowStartupSplash] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(
      () => setShowStartupSplash(false),
      STARTUP_SPLASH_DURATION_MS,
    );

    return () => clearTimeout(timeout);
  }, []);

  if (showStartupSplash) {
    return <StartupSplash />;
  }

  const navigator = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
  const isAuthCallbackRoute = segments[0] === 'auth';

  return (
    <SupabaseProvider>
      <AuthSessionProvider>
        <PersonalProfileProvider>
          <ActiveProfileProvider>
            <ItemListsProvider>
              <ProfileMessagesProvider>
                <EventTrackingProvider>
                  <SharedEndorsementProvider>
                    <ItemInteractionProvider>
                      <DiscoveryModeProvider>
                        {isAuthCallbackRoute ? (
                          navigator
                        ) : (
                          <AuthGate>
                            <DiscoveryModeShell>{navigator}</DiscoveryModeShell>
                          </AuthGate>
                        )}
                      </DiscoveryModeProvider>
                    </ItemInteractionProvider>
                  </SharedEndorsementProvider>
                </EventTrackingProvider>
              </ProfileMessagesProvider>
            </ItemListsProvider>
          </ActiveProfileProvider>
        </PersonalProfileProvider>
      </AuthSessionProvider>
    </SupabaseProvider>
  );
}
