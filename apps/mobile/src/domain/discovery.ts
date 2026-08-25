import type { AmbientPhase, DiscoveryMode } from './contracts';

export const AMBIENT_PHASE_BY_DISCOVERY_MODE: Readonly<Record<DiscoveryMode, AmbientPhase>> = {
  FOR_YOU: 'DAWN',
  SURPRISE: 'EVENING',
  RISK: 'NIGHT',
};

export function getAmbientPhase(discoveryMode: DiscoveryMode): AmbientPhase {
  return AMBIENT_PHASE_BY_DISCOVERY_MODE[discoveryMode];
}
