import { describe, expect, it } from 'vitest';

import { getAmbientPhase } from './discovery';

describe('getAmbientPhase', () => {
  it('maps each DiscoveryMode to its canonical AmbientPhase', () => {
    expect(getAmbientPhase('FOR_YOU')).toBe('DAWN');
    expect(getAmbientPhase('SURPRISE')).toBe('EVENING');
    expect(getAmbientPhase('RISK')).toBe('NIGHT');
  });
});
