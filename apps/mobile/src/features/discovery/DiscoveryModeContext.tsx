import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import type { DiscoveryMode } from '../../domain/contracts';

interface DiscoveryModeState {
  mode: DiscoveryMode;
  setMode: (mode: DiscoveryMode) => void;
}

const DiscoveryModeContext = createContext<DiscoveryModeState | null>(null);

export function DiscoveryModeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<DiscoveryMode>('FOR_YOU');
  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return <DiscoveryModeContext.Provider value={value}>{children}</DiscoveryModeContext.Provider>;
}

export function useDiscoveryMode(): DiscoveryModeState {
  const state = useContext(DiscoveryModeContext);

  if (!state) {
    throw new Error('useDiscoveryMode must be used within DiscoveryModeProvider');
  }

  return state;
}
