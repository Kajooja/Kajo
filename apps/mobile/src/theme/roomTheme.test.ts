import { describe, expect, it } from 'vitest';

import { getRoomTheme, PERSONAL_ROOM_BASE_THEME } from './roomTheme';

describe('room theme', () => {
  it('keeps the same base identity across ambient phases', () => {
    expect(getRoomTheme('DAWN').base).toBe(PERSONAL_ROOM_BASE_THEME);
    expect(getRoomTheme('EVENING').base).toBe(PERSONAL_ROOM_BASE_THEME);
    expect(getRoomTheme('NIGHT').base).toBe(PERSONAL_ROOM_BASE_THEME);
  });

  it('applies distinct ambient tokens without replacing the base theme', () => {
    const dawn = getRoomTheme('DAWN');
    const evening = getRoomTheme('EVENING');
    const night = getRoomTheme('NIGHT');

    expect(dawn.ambient.wash).not.toBe(evening.ambient.wash);
    expect(evening.ambient.wash).not.toBe(night.ambient.wash);
    expect(dawn.base.appBackground).toBe(night.base.appBackground);
  });
});
