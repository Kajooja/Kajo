import { describe, expect, it } from 'vitest';

import { parseCsv, parseHistoryImportCsv } from './historyImportParser';

describe('historyImportParser', () => {
  it('parses quoted CSV including embedded commas and newlines', () => {
    expect(parseCsv('Name,Note\n"A, B","line 1\nline 2"\n')).toEqual([
      ['Name', 'Note'],
      ['A, B', 'line 1\nline 2'],
    ]);
  });

  it('normalizes Letterboxd ratings from 0.5-5 stars to Kajo 1-10', () => {
    const result = parseHistoryImportCsv({
      fileName: 'ratings.csv',
      preferredKind: 'MOVIE',
      preferredProvider: 'LETTERBOXD',
      text: 'Date,Name,Year,Letterboxd URI,Rating\n2026-01-02,Arrival,2016,https://letterboxd.com/film/arrival/,4.5\n',
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.import.datasetKind).toBe('RATINGS');
    expect(result.import.rows).toHaveLength(1);
    expect(result.import.rows[0]).toMatchObject({
      itemType: 'MOVIE',
      title: 'Arrival',
      releaseYear: 2016,
      evidenceKind: 'RATED',
      rating: 9,
    });
  });

  it('normalizes Letterboxd watchlist as saved intent rather than consumed', () => {
    const result = parseHistoryImportCsv({
      fileName: 'watchlist.csv',
      preferredKind: 'MOVIE',
      preferredProvider: 'LETTERBOXD',
      text: 'Date,Name,Year,Letterboxd URI\n2026-01-02,Heat,1995,https://letterboxd.com/film/heat/\n',
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.import.rows.at(0)?.evidenceKind).toBe('SAVED');
  });

  it('uses IMDb Const as a canonical external alias and preserves 1-10 rating', () => {
    const result = parseHistoryImportCsv({
      fileName: 'ratings.csv',
      preferredKind: 'MOVIE',
      preferredProvider: 'IMDB',
      text: 'Const,Your Rating,Date Rated,Title,Title Type,Year,Directors\ntt0133093,10,2026-02-03,The Matrix,movie,1999,Lana Wachowski; Lilly Wachowski\n',
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.import.rows).toHaveLength(1);
    expect(result.import.rows[0]).toMatchObject({
      title: 'The Matrix',
      evidenceKind: 'RATED',
      rating: 10,
      externalIds: { imdb_title: 'tt0133093' },
    });
  });

  it('normalizes Goodreads read/to-read state and ISBN', () => {
    const result = parseHistoryImportCsv({
      fileName: 'goodreads_library_export.csv',
      preferredKind: 'BOOK',
      text: 'Book Id,Title,Author,ISBN13,My Rating,Exclusive Shelf,Original Publication Year,Date Read\n1,Dune,Frank Herbert,9780441172719,5,read,1965,2025-05-01\n2,Neuromancer,William Gibson,9780441569595,0,to-read,1984,\n',
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.import.provider).toBe('GOODREADS');
    expect(result.import.rows[0]).toMatchObject({
      evidenceKind: 'RATED',
      rating: 10,
      externalIds: { isbn13: '9780441172719' },
    });
    expect(result.import.rows.at(1)?.evidenceKind).toBe('SAVED');
  });

  it('detects StoryGraph shape and maps star ratings', () => {
    const result = parseHistoryImportCsv({
      fileName: 'storygraph.csv',
      preferredKind: 'BOOK',
      text: 'Title,Authors,ISBN/UID,Read Status,Star Rating,Last Date Read\nPiranesi,Susanna Clarke,9781635575637,read,4.25,2025-04-02\n',
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.import.provider).toBe('STORYGRAPH');
    expect(result.import.rows.at(0)?.rating).toBe(9);
  });

  it('rejects an import larger than the hosted 5000-row stage boundary', () => {
    const rows = Array.from(
      { length: 5001 },
      (_, index) => `Movie ${index},2020,true`,
    ).join('\n');
    const result = parseHistoryImportCsv({
      fileName: 'kajo.csv',
      preferredKind: 'MOVIE',
      preferredProvider: 'KAJO_CSV',
      text: `title,year,consumed\n${rows}\n`,
    });

    expect(result.status).toBe('error');
  });
});
