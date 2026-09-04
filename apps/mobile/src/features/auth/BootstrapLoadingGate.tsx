import type { PropsWithChildren } from 'react';

import { StartupSplash } from '../branding/KajoBrand';
import { useItemInteractions } from '../discovery/ItemInteractionContext';
import { usePersonalProfile } from '../profiles/PersonalProfileProvider';
import { useAuthSession } from './AuthSessionProvider';

export function BootstrapLoadingGate({ children }: PropsWithChildren) {
  const auth = useAuthSession();
  const personalProfile = usePersonalProfile();
  const itemInteractions = useItemInteractions();

  if (auth.status === 'loading') {
    return <StartupSplash message="Palautetaan istuntoa…" />;
  }

  if (auth.status !== 'signed-in' || auth.recoveryMode) {
    return children;
  }

  if (
    personalProfile.status === 'loading' ||
    personalProfile.status === 'inactive'
  ) {
    return <StartupSplash message="Avataan omaa profiiliasi…" />;
  }

  if (personalProfile.status !== 'ready') {
    return children;
  }

  const interactionsReady =
    itemInteractions.persistenceStatus === 'ready' ||
    itemInteractions.persistenceStatus === 'disabled' ||
    itemInteractions.hasHydratedCurrentActor;

  if (!interactionsReady && itemInteractions.persistenceStatus !== 'error') {
    return <StartupSplash message="Palautetaan valintojasi…" />;
  }

  return children;
}
