import { describe, expect, it } from 'vitest';

import { getDiscoveryImageUrl } from './catalogImageUrl';

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
