import { describe, expect, it } from 'vitest';

import {
  getDiscoveryImagePlan,
  getDiscoveryImageUrl,
} from './catalogImageUrl';

describe('Discovery image URL', () => {
  it('uses the medium Open Library cover in the grid', () => {
    expect(
      getDiscoveryImageUrl(
        'https://covers.openlibrary.org/b/id/14608471-L.jpg?default=false',
      ),
    ).toBe(
      'https://covers.openlibrary.org/b/id/14608471-M.jpg?default=false',
    );
  });

  it('leaves non-Open-Library image URLs unchanged', () => {
    const url = 'https://image.tmdb.org/t/p/w500/example.jpg';
    expect(getDiscoveryImageUrl(url)).toBe(url);
  });
});

describe('Discovery image window', () => {
  it('keeps a small mount window while prefetching farther ahead', () => {
    expect(getDiscoveryImagePlan([4, 5, 6, 7], 30)).toEqual({
      mount: { first: 2, last: 13 },
      prefetch: { first: 8, lastExclusive: 22 },
    });
  });

  it('clamps image work to the available item range', () => {
    expect(getDiscoveryImagePlan([0, 1], 8)).toEqual({
      mount: { first: 0, last: 7 },
      prefetch: { first: 2, lastExclusive: 8 },
    });
  });

  it('does nothing without visible items', () => {
    expect(getDiscoveryImagePlan([], 20)).toBeNull();
  });
});
