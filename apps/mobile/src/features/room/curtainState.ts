import type { DiscoveryMode } from '../../domain/contracts';

export const CURTAIN_DISCOVERY_MODES = ['FOR_YOU', 'SURPRISE', 'RISK'] as const satisfies readonly DiscoveryMode[];

export function clampCurtainPosition(position: number): number {
  return Math.min(1, Math.max(0, position));
}

export function getCurtainPositionForMode(mode: DiscoveryMode): number {
  const index = CURTAIN_DISCOVERY_MODES.indexOf(mode);
  return index / (CURTAIN_DISCOVERY_MODES.length - 1);
}

export function getModeForCurtainPosition(position: number): DiscoveryMode {
  const normalized = clampCurtainPosition(position);
  const index = Math.round(normalized * (CURTAIN_DISCOVERY_MODES.length - 1));
  return CURTAIN_DISCOVERY_MODES[index] ?? 'FOR_YOU';
}

export function getModeForTrackPosition(positionPx: number, trackWidthPx: number): DiscoveryMode {
  if (trackWidthPx <= 0) {
    return 'FOR_YOU';
  }

  const normalizedPosition = clampCurtainPosition(positionPx / trackWidthPx);
  const regionIndex = Math.min(
    CURTAIN_DISCOVERY_MODES.length - 1,
    Math.floor(normalizedPosition * CURTAIN_DISCOVERY_MODES.length),
  );

  return CURTAIN_DISCOVERY_MODES[regionIndex] ?? 'FOR_YOU';
}
