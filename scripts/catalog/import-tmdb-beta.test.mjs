import test from 'node:test';
import assert from 'node:assert/strict';

import {
  invokeCatalogImport,
  parseTmdbImportArguments,
  planTmdbImportBatches,
  runTmdbBetaImport,
  validateTmdbImportResponse,
} from './import-tmdb-beta.mjs';
import { TMDB_BETA_BUCKETS } from '../../supabase/functions/_shared/tmdb-import-plan.mjs';

test('admin transport sends server credentials only as apikey to the canonical Edge route', async () => {
  const realFetch = globalThis.fetch;
  const batch = { startPage: 1, pages: 3, language: 'fi-FI', region: 'FI', minimumVoteCount: 40 };
  try {
    for (const apiKey of ['sb_secret_transport_fixture', 'legacy.service.fixture']) {
      globalThis.fetch = async (url, init) => {
        assert.equal(url, 'https://fixture.invalid/functions/v1/catalog-import');
        assert.equal(init.method, 'POST');
        assert.equal(init.headers.apikey, apiKey);
        assert.equal(init.headers.authorization, undefined);
        assert.deepEqual(JSON.parse(init.body), { action: 'tmdb-movies', ...batch });
        return Response.json({ status: 'imported' });
      };
      assert.deepEqual(await invokeCatalogImport('https://fixture.invalid', apiKey, batch), { status: 'imported' });
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('plans bounded sequential TMDB Edge Function requests', () => {
  const options = parseTmdbImportArguments([
    '--start-page',
    '4',
    '--pages',
    '8',
    '--pages-per-request',
    '3',
  ]);

  assert.deepEqual(planTmdbImportBatches(options), [
    { startPage: 4, pages: 3 },
    { startPage: 7, pages: 3 },
    { startPage: 10, pages: 2 },
  ]);
});

test('uses safe beta defaults and normalizes region casing', () => {
  const defaults = parseTmdbImportArguments([]);
  assert.equal(defaults.startPage, 1);
  assert.equal(defaults.totalPages, 15);
  assert.equal(defaults.pagesPerRequest, 3);
  assert.equal(defaults.minimumVoteCount, 40);
  assert.equal(defaults.language, 'fi-FI');
  assert.equal(defaults.region, 'FI');

  const custom = parseTmdbImportArguments(['--region', 'se']);
  assert.equal(custom.region, 'SE');
});

test('fails closed on invalid page ranges and arguments', () => {
  assert.throws(
    () => parseTmdbImportArguments(['--pages-per-request', '4']),
    /between 1 and 3/,
  );
  assert.throws(
    () => parseTmdbImportArguments(['--start-page', '495', '--pages', '10']),
    /exceeds TMDB page 500/,
  );
  assert.throws(
    () => parseTmdbImportArguments(['--language', 'fi']),
    /ll-CC format/,
  );
  assert.throws(
    () => parseTmdbImportArguments(['--unknown']),
    /Unknown argument/,
  );
});

test('validates exact pages and import response metadata', () => {
  const expected = {
    startPage: 7,
    pages: 3,
    language: 'fi-FI',
    region: 'FI',
    minimumVoteCount: 40,
  };

  assert.deepEqual(
    validateTmdbImportResponse(
      {
        status: 'imported',
        provider: 'tmdb',
        importedCount: 58,
        skippedCount: 2,
        pages: [7, 8, 9],
        language: 'fi-FI',
        region: 'FI',
        minimumVoteCount: 40,
      },
      expected,
    ),
    {
      importedCount: 58,
      skippedCount: 2,
      pages: [7, 8, 9],
    },
  );

  assert.throws(
    () =>
      validateTmdbImportResponse(
        {
          status: 'imported',
          provider: 'tmdb',
          importedCount: 40,
          skippedCount: 0,
          pages: [7, 9],
          language: 'fi-FI',
          region: 'FI',
          minimumVoteCount: 40,
        },
        expected,
      ),
    /page mismatch/,
  );
});

test('surfaces missing TMDB Edge Function secret explicitly', () => {
  assert.throws(
    () =>
      validateTmdbImportResponse(
        { status: 'error', code: 'tmdb-not-configured' },
        {
          startPage: 1,
          pages: 1,
          language: 'fi-FI',
          region: 'FI',
          minimumVoteCount: 40,
        },
      ),
    /TMDB_READ_ACCESS_TOKEN/,
  );
});

test('runs batches in order and summarizes results', async () => {
  const calls = [];
  const sleeps = [];
  const options = parseTmdbImportArguments([
    '--start-page',
    '1',
    '--pages',
    '5',
    '--pages-per-request',
    '2',
    '--delay-ms',
    '25',
  ]);

  const summary = await runTmdbBetaImport(options, {
    invoke: async (request) => {
      calls.push(request);
      const pages = Array.from(
        { length: request.pages },
        (_, offset) => request.startPage + offset,
      );
      return {
        status: 'imported',
        provider: 'tmdb',
        importedCount: request.pages * 20,
        skippedCount: 0,
        pages,
        language: request.language,
        region: request.region,
        minimumVoteCount: request.minimumVoteCount,
      };
    },
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
    },
  });

  assert.deepEqual(
    calls.map(({ startPage, pages }) => ({ startPage, pages })),
    [
      { startPage: 1, pages: 2 },
      { startPage: 3, pages: 2 },
      { startPage: 5, pages: 1 },
    ],
  );
  assert.deepEqual(sleeps, [25, 25]);
  assert.deepEqual(summary, {
    requestCount: 3,
    completedPages: [1, 2, 3, 4, 5],
    importedCount: 100,
    skippedCount: 0,
  });
});

test('balanced plan fixes 30 pages across original-language, era and genre buckets without repeating the canary', () => {
  const options = parseTmdbImportArguments(['--balanced-plan', '--as-of', '2026-09-13', '--dry-run']);
  const batches = planTmdbImportBatches(options);
  assert.equal(batches.length, 18);
  assert.equal(batches.reduce((sum, batch) => sum + batch.pages, 0), 30);
  assert.ok(batches.every((batch) => batch.action === 'tmdb-movie-bucket-v1' && batch.pages <= 3));
  assert.equal(batches[0].bucket, 'finnish');
  assert.deepEqual(TMDB_BETA_BUCKETS.filter((bucket) => bucket.filters.with_original_language)
    .map((bucket) => bucket.filters.with_original_language), ['fi', 'sv', 'fr', 'de', 'ja', 'ko', 'es']);
  assert.equal(TMDB_BETA_BUCKETS[0].minimumVoteCount, 10);
  assert.ok(batches.every((batch) => batch.asOf === '2026-09-13' && batch.language === 'fi-FI'));
  assert.equal(planTmdbImportBatches(parseTmdbImportArguments([
    '--bucket', 'finnish', '--as-of', '2026-09-13', '--start-page', '2',
  ]))[0].pages, 2);
});

test('selection refuses ambiguous controls, future dates and budget overruns', () => {
  for (const args of [
    ['--balanced-plan'], ['--as-of', '2026-09-13'],
    ['--balanced-plan', '--bucket', 'finnish', '--as-of', '2026-09-13'],
    ['--balanced-plan', '--pages', '30', '--as-of', '2026-09-13'],
    ['--bucket', 'finnish', '--minimum-vote-count', '1', '--as-of', '2026-09-13'],
    ['--bucket', 'finnish', '--start-page', '3', '--pages', '2', '--as-of', '2026-09-13'],
    ['--balanced-plan', '--as-of', '9999-01-01'],
    ['--balanced-plan', '--as-of', '2026-02-30'],
    ['--imdb-ids', 'tt0000001,tt0000001', '--as-of', '2026-09-13'],
  ]) assert.throws(() => parseTmdbImportArguments(args));
});

test('IMDb plan chunks exact identifiers and validates complete enrichment including leading zeros', () => {
  const ids = Array.from({ length: 29 }, (_, index) => `tt${String(index + 1).padStart(7, '0')}`);
  const batches = planTmdbImportBatches(parseTmdbImportArguments([
    '--imdb-ids', ids.join(','), '--as-of', '2026-09-13', '--dry-run',
  ]));
  assert.deepEqual(batches.map((batch) => batch.imdbIds.length), [10, 10, 9]);
  assert.deepEqual(batches.flatMap((batch) => batch.imdbIds), ids);
  const expected = batches[0];
  const payload = { ...expected, status: 'imported', provider: 'tmdb', importedCount: 10, skippedCount: 0 };
  assert.equal(validateTmdbImportResponse(payload, expected).importedCount, 10);
  for (const changes of [{ importedCount: 9 }, { skippedCount: 1 }, { imdbIds: [...expected.imdbIds].reverse() },
    { action: 'tmdb-movies' }, { asOf: '2026-09-12' }]) {
    assert.throws(() => validateTmdbImportResponse({ ...payload, ...changes }, expected));
  }
});

test('bucket run records completed work and stops on the first failure without automatic retry', async () => {
  const options = parseTmdbImportArguments(['--balanced-plan', '--as-of', '2026-09-13']);
  const calls = [];
  const checkpoints = [];
  await assert.rejects(runTmdbBetaImport(options, {
    invoke: async (expected) => {
      calls.push(expected);
      if (calls.length === 2) throw new Error('fixture provider failure');
      return { status: 'imported', provider: 'tmdb', action: expected.action,
        bucket: expected.bucket, asOf: expected.asOf, importedCount: 55, skippedCount: 5,
        pages: [1, 2, 3], language: 'fi-FI', region: 'FI', minimumVoteCount: 10 };
    },
    sleep: async () => {}, progress: (checkpoint) => checkpoints.push(checkpoint),
  }), /fixture provider failure/);
  assert.deepEqual(calls.map((call) => call.bucket), ['finnish', 'classics']);
  assert.deepEqual(checkpoints.map((checkpoint) => checkpoint.status), ['starting', 'completed', 'starting']);
  const first = checkpoints[1].result;
  assert.equal(first.importedCount, 55);
  const expected = calls[0];
  const response = { status: 'imported', provider: 'tmdb', action: expected.action,
    bucket: 'finnish', asOf: expected.asOf, importedCount: 60, skippedCount: 0,
    pages: [1, 2, 3], language: 'fi-FI', region: 'FI', minimumVoteCount: 10 };
  for (const changes of [{ action: undefined }, { bucket: 'classics' }, { minimumVoteCount: 40 },
    { importedCount: 61 }]) {
    assert.throws(() => validateTmdbImportResponse({ ...response, ...changes }, expected));
  }
});
