import { expect, it } from 'vitest';
import { fitRatingResponse, predictRatingResponse } from '../src/research-response.js';
import { shrunkRatingResidual } from '../src/rating-location.js';

const config = { spreadShrinkage: 25, minimumRatings: 10, minimumBaseVariance: .01,
  minimumCorrection: -.75, maximumCorrection: 1 };
it('matches the centered penalized normal equations without adding a second location', () => {
  const bases = Array.from({ length: 20 }, (_, i) => 3 + i / 10);
  const center = bases.reduce((a, b) => a + b, 0) / bases.length;
  const values = bases.map(b => b + .3 + .6 * (b - center));
  const fit = fitRatingResponse(bases, values, 10, config);
  const ss = bases.reduce((s, b) => s + (b - center) ** 2, 0);
  expect(fit.location).toBe(shrunkRatingResidual(values.map((v, i) => v - bases[i]!), 10));
  expect(fit.correction).toBeCloseTo(.6 * ss / (ss + 25), 13);
  expect(fit.location).toBeCloseTo(.2, 13);
  expect(bases.reduce((s, b) => s + fit.correction * (b - fit.center), 0)).toBeCloseTo(0, 13);
  expect(fit.support).toBe('SUPPORTED');
  // Direct gradient of the constrained centered objective, away from the bounds.
  const residual = values.map((v, i) => v - bases[i]! - fit.location - fit.correction * (bases[i]! - fit.center));
  expect(residual.reduce((s, r) => s + r, 0) - 10 * fit.location).toBeCloseTo(0, 12);
  expect(residual.reduce((s, r, i) => s + r * (bases[i]! - fit.center), 0) - 25 * fit.correction).toBeCloseTo(0, 12);
});
it('reduces exactly to control at zero correction and keeps constant-rating location, including zero', () => {
  for (const value of [0, 5, 10]) {
    const bases = Array.from({ length: 30 }, (_, i) => 2 + i / 10);
    const fit = fitRatingResponse(bases, bases.map(() => value), 10, config);
    expect(fit.support).toBe('CONSTANT_GRADES'); expect(fit.correction).toBe(0);
    expect(fit.location).toBe(shrunkRatingResidual(bases.map(b => value - b), 10));
    const p = predictRatingResponse(fit, 3, 0, 10);
    expect(p['response-spread']).toBe(p['profile-offset']);
  }
  const empty = fitRatingResponse([], [], 10, config);
  expect(empty.support).toBe('EMPTY');
  expect(predictRatingResponse(empty, 6, 1, 10)).toEqual({ 'profile-offset': 6, 'response-spread': 6 });
});
it('falls back for sparse or constant-base histories and clips both variants to the actual source scale', () => {
  const sparse = fitRatingResponse([1, 9], [10, 1], 10, config);
  expect(sparse.support).toBe('SPARSE'); expect(sparse.correction).toBe(0);
  const flat = fitRatingResponse(Array(20).fill(4), Array.from({ length: 20 }, (_, i) => i % 11), 10, config);
  expect(flat.support).toBe('CONSTANT_BASE'); expect(flat.correction).toBe(0);
  for (const base of [2, 10]) {
    const p = predictRatingResponse({ ...flat, location: 8, correction: 1, center: 5 }, base, 2, 10);
    expect(Object.values(p).every(x => x >= 2 && x <= 10)).toBe(true);
  }
});
it('bounds the added slope, shrinks with stronger penalty, and supports a non-media numeric task', () => {
  const bases = Array.from({ length: 100 }, (_, i) => i % 2 ? 6 : 4);
  const values = bases.map(b => b === 6 ? 10 : 0);
  const fitted = fitRatingResponse(bases, values, 10, config);
  expect(fitted.correction).toBe(1);
  expect(fitRatingResponse(bases, values, 10, { ...config, spreadShrinkage: 10000 }).correction).toBeLessThan(1);
  expect(fitRatingResponse(bases, values.map(x => 10 - x), 10, config).correction).toBe(-.75);
  expect(Object.isFrozen(fitted)).toBe(true);
});
it('rejects invalid support, values, bounds and shrinkage without changing the native helper', () => {
  for (const change of [{ spreadShrinkage: 0 }, { minimumRatings: 1 }, { minimumBaseVariance: 0 },
    { minimumCorrection: -1 }, { maximumCorrection: NaN }]) {
    expect(() => fitRatingResponse([], [], 10, { ...config, ...change })).toThrow();
  }
  expect(() => fitRatingResponse([4], [], 10, config)).toThrow();
  expect(() => fitRatingResponse([4], [NaN], 10, config)).toThrow();
  expect(() => fitRatingResponse([], [], 0, config)).toThrow();
  expect(() => predictRatingResponse(fitRatingResponse([], [], 10, config), 0, 1, 10)).toThrow();
});
