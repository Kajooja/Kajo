import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPEN_LIBRARY_BETA_BUCKETS,
  assertOpenLibraryBetaCoverage,
  buildOpenLibrarySearchUrl,
  normalizeOpenLibrarySearchWork,
  selectOpenLibraryBetaEntries,
} from './open-library-search-beta.mjs';

test('Open Library beta URL requests language-preferred edition fields without provider-side sort dependency', () => {
  const bucket = OPEN_LIBRARY_BETA_BUCKETS.find((entry) => entry.key === 'finnish-editions');
  const url = new URL(buildOpenLibrarySearchUrl(bucket, 50));

  assert.equal(url.origin, 'https://openlibrary.org');
  assert.equal(url.pathname, '/search.json');
  assert.equal(url.searchParams.get('lang'), 'fi');
  assert.equal(url.searchParams.get('limit'), '50');
  assert.equal(url.searchParams.has('sort'), false);
  assert.match(url.searchParams.get('fields'), /editions\.title/);
  assert.match(url.searchParams.get('fields'), /readinglog_count/);
});

test('normalizes Open Library work into canonical BOOK using preferred edition title and cover', () => {
  const normalized = normalizeOpenLibrarySearchWork(
    {
      key: '/works/OL20019347W',
      title: 'コーヒーが冷めないうちに',
      author_name: ['Toshikazu Kawaguchi'],
      cover_i: 100,
      first_publish_year: 2015,
      edition_count: 42,
      ratings_count: 67,
      ratings_average: 3.8,
      readinglog_count: 2200,
      language: ['eng', 'jpn'],
      isbn: ['9780000000001'],
      subject: ['Japanese fiction', 'Time travel'],
      editions: {
        docs: [
          {
            key: '/books/OL123M',
            title: 'Before the Coffee Gets Cold',
            language: ['eng'],
            cover_i: 200,
          },
        ],
      },
    },
    { key: 'recent-popular', lang: 'en' },
  );

  assert.equal(normalized.providerKey, 'open_library');
  assert.equal(normalized.providerItemId, 'OL20019347W');
  assert.equal(normalized.itemType, 'BOOK');
  assert.equal(normalized.title, 'Before the Coffee Gets Cold');
  assert.equal(normalized.imageUrl, 'https://covers.openlibrary.org/b/id/200-L.jpg?default=false');
  assert.deepEqual(normalized.creators, ['Toshikazu Kawaguchi']);
  assert.deepEqual(normalized.tags, ['japanese-fiction', 'time-travel']);
  assert.deepEqual(normalized.externalIds, { open_library_work: 'OL20019347W' });
  assert.equal(normalized.metadata.popularity, 2200);
  assert.equal(normalized.metadata.voteCount, 67);
  assert.equal(normalized.metadata.openLibraryWorkId, 'OL20019347W');
  assert.equal(normalized.metadata.displayEditionKey, 'OL123M');
  assert.equal(normalized.metadata.displayLanguage, 'eng');
  assert.equal(normalized.metadata.displayTitleSource, 'OPEN_LIBRARY_EDITION_LANG_V1');
});

test('beta candidate selection refreshes known work IDs, rejects new existing-title collisions and deduplicates work IDs', () => {
  const base = (workId, title, popularity, voteCount = 0) => ({
    providerKey: 'open_library',
    providerItemId: workId,
    itemType: 'BOOK',
    title,
    metadata: { popularity, voteCount, openLibraryWorkId: workId },
  });

  const selected = selectOpenLibraryBetaEntries(
    [
      base('OL1W', 'Known Refresh', 10),
      base('OL2W', 'Existing Curated Title', 100),
      base('OL3W', 'Fresh Title', 50),
      base('OL3W', 'Fresh Title', 80),
      base('OL4W', 'Fresh Title', 70),
    ],
    [
      { title: 'Known Refresh', metadata: { openLibraryWorkId: 'OL1W' } },
      { title: 'Existing Curated Title', metadata: {} },
    ],
  );

  assert.deepEqual(
    selected.map((entry) => [entry.providerItemId, entry.title, entry.metadata.popularity]),
    [
      ['OL3W', 'Fresh Title', 80],
      ['OL1W', 'Known Refresh', 10],
    ],
  );
});

test('coverage gate fails closed below item or bucket threshold', () => {
  assert.doesNotThrow(() =>
    assertOpenLibraryBetaCoverage(
      { selectedCount: 385, successfulBuckets: 13 },
      { minimumItems: 180, minimumBuckets: 8 },
    ),
  );
  assert.throws(
    () =>
      assertOpenLibraryBetaCoverage(
        { selectedCount: 120, successfulBuckets: 13 },
        { minimumItems: 180, minimumBuckets: 8 },
      ),
    /coverage gate failed/,
  );
  assert.throws(
    () =>
      assertOpenLibraryBetaCoverage(
        { selectedCount: 300, successfulBuckets: 4 },
        { minimumItems: 180, minimumBuckets: 8 },
      ),
    /coverage gate failed/,
  );
});
