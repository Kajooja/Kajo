import test from 'node:test';
import assert from 'node:assert/strict';

import {
  invokeCatalogImport,
  parseTmdbImportArguments,
  planTmdbImportBatches,
  runTmdbBetaImport,
  validateTmdbImportResponse,
} from './import-tmdb-beta.mjs';

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
