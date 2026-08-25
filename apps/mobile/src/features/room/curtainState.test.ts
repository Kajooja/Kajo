import { describe, expect, it } from 'vitest';

import {
  clampCurtainPosition,
  getCurtainPositionForMode,
  getModeForCurtainPosition,
  getModeForTrackPosition,
} from './curtainState';

describe('curtain state', () => {
  it('maps canonical modes to three normalized snap positions', () => {
    expect(getCurtainPositionForMode('FOR_YOU')).toBe(0);
    expect(getCurtainPositionForMode('SURPRISE')).toBe(0.5);
    expect(getCurtainPositionForMode('RISK')).toBe(1);
  });

  it('chooses the nearest canonical mode for a curtain position', () => {
    expect(getModeForCurtainPosition(0.1)).toBe('FOR_YOU');
    expect(getModeForCurtainPosition(0.52)).toBe('SURPRISE');
    expect(getModeForCurtainPosition(0.9)).toBe('RISK');
  });

  it('clamps positions outside the track', () => {
    expect(clampCurtainPosition(-1)).toBe(0);
    expect(clampCurtainPosition(2)).toBe(1);
    expect(getModeForTrackPosition(75, 100)).toBe('RISK');
    expect(getModeForTrackPosition(0, 0)).toBe('FOR_YOU');
  });
});
