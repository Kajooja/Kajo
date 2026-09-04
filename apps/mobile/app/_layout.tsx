import { Stack, useSegments } from 'expo-router';

import { SupabaseProvider } from '@/data/SupabaseProvider';
import { AuthGate } from '@/features/auth/AuthGate';
import { AuthSessionProvider } from '@/features/auth/AuthSessionProvider';
import { BootstrapLoadingGate } from '@/features/auth/BootstrapLoadingGate';
import { DiscoveryModeProvider } from '@/features/discovery/DiscoveryModeContext';
import { DiscoveryModeShell } from '@/features/discovery/DiscoveryModeShell';
import { ItemInteractionProvider } from '@/features/discovery/ItemInteractionContext';
import { SharedEndorsementProvider } from '@/features/discovery/SharedEndorsementContext';
import { EventTrackingProvider } from '@/features/events/EventTrackingContext';
import { ItemListsProvider } from '@/features/lists/ItemListsContext';
import { ProfileMessagesProvider } from '@/features/messages/ProfileMessagesContext';
import { ActiveProfileProvider } from '@/features/profiles/ActiveProfileContext';
import { PersonalProfileProvider } from '@/features/profiles/PersonalProfileProvider';
import { ROUTE_TRANSITION_ANIMATION } from '@/features/room/roomPresentation';

export default function RootLayout() {
  const segments = useSegments();

  const navigator = (
    <Stack
      screenOptions={{
        animation: ROUTE_TRANSITION_ANIMATION,
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
                          <BootstrapLoadingGate>
                            <AuthGate>
                              <DiscoveryModeShell>{navigator}</DiscoveryModeShell>
                            </AuthGate>
                          </BootstrapLoadingGate>
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
