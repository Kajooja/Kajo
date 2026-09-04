import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isUsefulOpenLibraryEdition,
  normalizeCatalogTag,
  normalizeOpenLibraryEdition,
  normalizeTmdbMovie,
  parseOpenLibraryDumpLine,
} from '../../supabase/functions/_shared/catalog-normalizers.mjs';

test('normalizes TMDB movie into one generic Kajo Item payload', () => {
  const normalized = normalizeTmdbMovie({
    id: 550,
    title: 'Fight Club',
    original_title: 'Fight Club',
    overview: '  An insomniac office worker   meets a soap maker. ',
    genres: [{ id: 18, name: 'Drama' }, { id: 53, name: 'Thriller' }],
    release_date: '1999-10-15',
    poster_path: '/poster.jpg',
    original_language: 'en',
    runtime: 139,
    popularity: 50.5,
    vote_average: 8.4,
    vote_count: 30000,
    production_countries: [{ iso_3166_1: 'US' }],
    external_ids: { imdb_id: 'tt0137523' },
    credits: {
      crew: [
        { job: 'Director', name: 'David Fincher' },
        { job: 'Producer', name: 'Someone Else' },
      ],
      cast: [{ name: 'Brad Pitt' }, { name: 'Edward Norton' }],
    },
  });

  assert.deepEqual(normalized, {
    providerKey: 'tmdb',
    providerItemId: '550',
    itemType: 'MOVIE',
    title: 'Fight Club',
    description: 'An insomniac office worker meets a soap maker.',
    tags: ['drama', 'thriller'],
    metadata: {
      originalTitle: 'Fight Club',
      runtimeMinutes: 139,
      popularity: 50.5,
      voteAverage: 8.4,
      voteCount: 30000,
      cast: ['Brad Pitt', 'Edward Norton'],
      productionCountries: ['US'],
    },
    creators: ['David Fincher'],
    releaseYear: 1999,
    imageUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    originalLanguage: 'en',
    externalIds: { tmdb_movie: '550', imdb_title: 'tt0137523' },
    sourceUrl: 'https://www.themoviedb.org/movie/550',
    sourceUpdatedAt: null,
    sourceHash: null,
    sourcePayload: {
      id: 550,
      title: 'Fight Club',
      original_title: 'Fight Club',
      overview: '  An insomniac office worker   meets a soap maker. ',
      genres: [{ id: 18, name: 'Drama' }, { id: 53, name: 'Thriller' }],
      release_date: '1999-10-15',
      poster_path: '/poster.jpg',
      original_language: 'en',
      runtime: 139,
      popularity: 50.5,
      vote_average: 8.4,
      vote_count: 30000,
      production_countries: [{ iso_3166_1: 'US' }],
      external_ids: { imdb_id: 'tt0137523' },
      credits: {
        crew: [
          { job: 'Director', name: 'David Fincher' },
          { job: 'Producer', name: 'Someone Else' },
        ],
        cast: [{ name: 'Brad Pitt' }, { name: 'Edward Norton' }],
      },
    },
    discoverable: true,
  });
});

test('parses and normalizes an Open Library edition dump row', () => {
  const record = {
    key: '/books/OL123M',
    title: 'Example Book',
    by_statement: 'Example Author',
    publish_date: '2004',
    publishers: ['Example Press'],
    isbn_13: ['978-1-2345-6789-7'],
    isbn_10: ['123456789X'],
    covers: [4567],
    languages: [{ key: '/languages/fin' }],
    works: [{ key: '/works/OL999W' }],
    subjects: ['Science Fiction', 'Finnish literature'],
    number_of_pages: 321,
  };
  const line = [
    '/type/edition',
    '/books/OL123M',
    '7',
    '2026-08-01T12:30:00.000000',
    JSON.stringify(record),
  ].join('\t');

  const parsed = parseOpenLibraryDumpLine(line);
  assert.equal(parsed?.revision, 7);
  assert.equal(parsed?.lastModified, '2026-08-01T12:30:00.000000');
  assert.equal(isUsefulOpenLibraryEdition(parsed), true);

  const normalized = normalizeOpenLibraryEdition(parsed.record, {
    lastModified: parsed.lastModified,
  });

  assert.equal(normalized.providerKey, 'open_library');
  assert.equal(normalized.providerItemId, 'OL123M');
  assert.equal(normalized.itemType, 'BOOK');
  assert.equal(normalized.title, 'Example Book');
  assert.deepEqual(normalized.creators, ['Example Author']);
  assert.equal(normalized.releaseYear, 2004);
  assert.equal(normalized.originalLanguage, 'fi');
  assert.equal(
    normalized.imageUrl,
    'https://covers.openlibrary.org/b/id/4567-L.jpg?default=false',
  );
  assert.deepEqual(normalized.externalIds, {
    open_library_edition: 'OL123M',
    open_library_work: 'OL999W',
    isbn13: '9781234567897',
    isbn10: '123456789X',
  });
  assert.deepEqual(normalized.tags, ['science-fiction', 'finnish-literature']);
});

test('Open Library curated gate requires work, ISBN and cover while allowing launch languages', () => {
  const base = {
    record: {
      key: '/books/OL1M',
      title: 'Book',
      publish_date: '2020',
      isbn_13: ['9780000000001'],
      covers: [1],
      works: [{ key: '/works/OL1W' }],
      languages: [{ key: '/languages/eng' }],
    },
  };

  assert.equal(isUsefulOpenLibraryEdition(base), true);
  assert.equal(
    isUsefulOpenLibraryEdition({
      record: { ...base.record, covers: [] },
    }),
    false,
  );
  assert.equal(
    isUsefulOpenLibraryEdition({
      record: {
        ...base.record,
        languages: [{ key: '/languages/rus' }],
      },
    }),
    false,
  );
});

test('catalog tags are deterministic slugs', () => {
  assert.equal(normalizeCatalogTag('  Science & Fiction  '), 'science-and-fiction');
  assert.equal(normalizeCatalogTag('Jännitys / rikos'), 'jannitys-rikos');
  assert.equal(normalizeCatalogTag('!'), null);
});
