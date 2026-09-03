import { describe, expect, it } from 'vitest';

import { isRoomPathname } from './roomPresentation';

describe('room presentation', () => {
  it('keeps the Room sharp only on the home route', () => {
    expect(isRoomPathname('/')).toBe(true);
    expect(isRoomPathname('/discovery/movies')).toBe(false);
    expect(isRoomPathname('/lists')).toBe(false);
    expect(isRoomPathname('/messages/profile-1')).toBe(false);
  });
});
