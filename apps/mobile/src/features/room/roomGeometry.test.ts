import { describe, expect, it } from 'vitest';

import {
  mapRoomRectForCover,
  ROOM_ART_RECTS,
  ROOM_ART_SIZE,
} from './roomGeometry';

describe('room cover geometry', () => {
  it('preserves image coordinates when the viewport matches the source', () => {
    expect(mapRoomRectForCover(ROOM_ART_SIZE, ROOM_ART_RECTS.tv)).toEqual({
      left: 388,
      top: 748,
      width: 238,
      height: 173,
    });
  });

  it('accounts for the horizontal crop on a taller phone viewport', () => {
    const result = mapRoomRectForCover(
      { width: 941, height: 2090 },
      ROOM_ART_RECTS.bookshelf,
    );

    expect(result.left).toBeCloseTo(713.625);
    expect(result.top).toBeCloseTo(696.25);
    expect(result.width).toBeCloseTo(235);
    expect(result.height).toBeCloseTo(707.5);
  });

  it('accounts for the vertical crop on a wider viewport', () => {
    const result = mapRoomRectForCover(
      { width: 1200, height: 1672 },
      ROOM_ART_RECTS.tv,
    );

    expect(result.left).toBeCloseTo(494.793);
    expect(result.top).toBeCloseTo(723.779);
    expect(result.width).toBeCloseTo(303.507);
    expect(result.height).toBeCloseTo(220.616);
  });
});
