import { describe, expect, it } from 'vitest';

import {
  clampRating,
  getRatingForTrackPosition,
  getRatingPosition,
} from './ratingState';

describe('rating slider state', () => {
  it('maps the 0–10 scale to normalized positions', () => {
    expect(getRatingPosition(0)).toBe(0);
    expect(getRatingPosition(5)).toBe(0.5);
    expect(getRatingPosition(10)).toBe(1);
    expect(getRatingPosition(null)).toBe(0.5);
  });

  it('snaps taps and drags to whole 0–10 ratings', () => {
    expect(getRatingForTrackPosition(0, 200)).toBe(0);
    expect(getRatingForTrackPosition(51, 200)).toBe(3);
    expect(getRatingForTrackPosition(200, 200)).toBe(10);
    expect(clampRating(-2)).toBe(0);
    expect(clampRating(12)).toBe(10);
  });
});
