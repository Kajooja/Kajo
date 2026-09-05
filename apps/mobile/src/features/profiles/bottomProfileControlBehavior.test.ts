import { describe, expect, it } from 'vitest';

import { getBottomProfileControlAction } from './bottomProfileControlBehavior';

describe('Bottom profile control behavior', () => {
  it('returns Home first from secondary screens', () => {
    expect(getBottomProfileControlAction('/discovery/books')).toBe('HOME');
    expect(getBottomProfileControlAction('/settings')).toBe('HOME');
  });

  it('opens the profile switcher when already on Home', () => {
    expect(getBottomProfileControlAction('/')).toBe('SWITCHER');
  });
});
