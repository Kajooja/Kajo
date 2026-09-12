#!/usr/bin/env node

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_OPTIONS = Object.freeze({
  startPage: 1,
  totalPages: 15,
  pagesPerRequest: 3,
  minimumVoteCount: 40,
  language: 'fi-FI',
  region: 'FI',
  delayMs: 350,
  dryRun: false,
  help: false,
});

const MAX_TOTAL_PAGES = 30;
const MAX_PAGES_PER_REQUEST = 3;
const MAX_TMDB_PAGE = 500;

export function parseTmdbImportArguments(args) {
  const options = { ...DEFAULT_OPTIONS };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const next = args[index + 1];

    switch (argument) {
      case '--start-page':
        options.startPage = parseBoundedIntegerFlag(
          '--start-page',
          next,
          1,
          MAX_TMDB_PAGE,
        );
        index += 1;
        break;
      case '--pages':
        options.totalPages = parseBoundedIntegerFlag(
          '--pages',
          next,
          1,
          MAX_TOTAL_PAGES,
        );
        index += 1;
        break;
      case '--pages-per-request':
        options.pagesPerRequest = parseBoundedIntegerFlag(
          '--pages-per-request',
          next,
          1,
          MAX_PAGES_PER_REQUEST,
        );
        index += 1;
        break;
      case '--minimum-vote-count':
        options.minimumVoteCount = parseBoundedIntegerFlag(
          '--minimum-vote-count',
          next,
          0,
          1_000_000,
        );
        index += 1;
        break;
      case '--language':
        options.language = parseLocaleFlag('--language', next);
        index += 1;
        break;
      case '--region':
        options.region = parseRegionFlag('--region', next);
        index += 1;
        break;
      case '--delay-ms':
        options.delayMs = parseBoundedIntegerFlag('--delay-ms', next, 0, 10_000);
        index += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const finalPage = options.startPage + options.totalPages - 1;
  if (finalPage > MAX_TMDB_PAGE) {
    throw new Error(
      `Requested page range ${options.startPage}-${finalPage} exceeds TMDB page ${MAX_TMDB_PAGE}.`,
    );
  }

  return options;
}

export function planTmdbImportBatches(options) {
  const batches = [];
  let page = options.startPage;
  let remaining = options.totalPages;

  while (remaining > 0) {
    const pages = Math.min(options.pagesPerRequest, remaining);
    batches.push({ startPage: page, pages });
    page += pages;
    remaining -= pages;
  }

  return batches;
}

export function validateTmdbImportResponse(payload, expected) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('catalog-import returned a non-object response.');
  }

  if (payload.status !== 'imported' || payload.provider !== 'tmdb') {
    const code = typeof payload.code === 'string' ? payload.code : 'unexpected-response';
    if (code === 'tmdb-not-configured') {
      throw new Error(
        'TMDB_READ_ACCESS_TOKEN is not configured in Supabase Edge Function secrets.',
      );
    }
    throw new Error(`catalog-import failed with code: ${code}`);
  }

  const expectedPages = Array.from(
    { length: expected.pages },
    (_, offset) => expected.startPage + offset,
  );
  if (
    !Array.isArray(payload.pages) ||
    payload.pages.length !== expectedPages.length ||
    payload.pages.some((page, index) => page !== expectedPages[index])
  ) {
    throw new Error(
      `catalog-import page mismatch: expected ${expectedPages.join(',')}, received ${formatPages(payload.pages)}.`,
    );
  }

  if (!isNonNegativeInteger(payload.importedCount)) {
    throw new Error('catalog-import returned an invalid importedCount.');
  }
  if (!isNonNegativeInteger(payload.skippedCount)) {
    throw new Error('catalog-import returned an invalid skippedCount.');
  }

  if (payload.language !== expected.language || payload.region !== expected.region) {
    throw new Error('catalog-import returned unexpected locale/region values.');
  }
  if (payload.minimumVoteCount !== expected.minimumVoteCount) {
    throw new Error('catalog-import returned an unexpected minimumVoteCount.');
  }

  return {
    importedCount: payload.importedCount,
    skippedCount: payload.skippedCount,
    pages: expectedPages,
  };
}

export async function runTmdbBetaImport(options, dependencies) {
  const batches = planTmdbImportBatches(options);
  const results = [];

  for (const [index, batch] of batches.entries()) {
    const expected = {
      ...batch,
      language: options.language,
      region: options.region,
      minimumVoteCount: options.minimumVoteCount,
    };
    const response = await dependencies.invoke(expected);
    results.push(validateTmdbImportResponse(response, expected));

    if (index < batches.length - 1 && options.delayMs > 0) {
      await dependencies.sleep(options.delayMs);
    }
  }

  return summarizeTmdbImport(results);
}

export function summarizeTmdbImport(results) {
  return {
    requestCount: results.length,
    completedPages: results.flatMap((result) => result.pages),
    importedCount: results.reduce((sum, result) => sum + result.importedCount, 0),
    skippedCount: results.reduce((sum, result) => sum + result.skippedCount, 0),
  };
}

async function runCli() {
  let options;
  try {
    options = parseTmdbImportArguments(process.argv.slice(2));
  } catch (error) {
    console.error(safeErrorMessage(error));
    printHelp();
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  const batches = planTmdbImportBatches(options);
  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          status: 'dry-run',
          options,
          batches,
        },
        null,
        2,
      ),
    );
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') ?? null;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    null;

  if (!supabaseUrl || !secretKey) {
    console.error(
      'SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required.',
    );
    process.exitCode = 2;
    return;
  }

  try {
    const summary = await runTmdbBetaImport(options, {
      invoke: (batch) => invokeCatalogImport(supabaseUrl, secretKey, batch),
      sleep,
    });

    console.log(
      JSON.stringify(
        {
          status: 'complete',
          ...summary,
          language: options.language,
          region: options.region,
          minimumVoteCount: options.minimumVoteCount,
        },
        null,
        2,
      ),
    );
    printVerificationSql();
  } catch (error) {
    console.error(`TMDB beta import failed: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  }
}

export async function invokeCatalogImport(baseUrl, apiKey, batch) {
  const response = await fetch(`${baseUrl}/functions/v1/catalog-import`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'KajoCatalogImporter/1.0 (+https://github.com/Kajooja/Kajo)',
    },
    body: JSON.stringify({ action: 'tmdb-movies', ...batch }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // The HTTP status below remains the primary failure signal.
  }

  if (!response.ok) {
    if (payload?.code === 'tmdb-not-configured') return payload;
    const code = typeof payload?.code === 'string' ? `: ${payload.code}` : '';
    throw new Error(`catalog-import HTTP ${response.status}${code}`);
  }

  return payload;
}

function parseBoundedIntegerFlag(name, value, minimum, maximum) {
  if (value === undefined) throw new Error(`${name} requires a value.`);
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return number;
}

function parseLocaleFlag(name, value) {
  if (value === undefined || !/^[a-z]{2}-[A-Z]{2}$/.test(value)) {
    throw new Error(`${name} must use ll-CC format, for example fi-FI.`);
  }
  return value;
}

function parseRegionFlag(name, value) {
  if (value === undefined || !/^[A-Za-z]{2}$/.test(value)) {
    throw new Error(`${name} must be a two-letter region code, for example FI.`);
  }
  return value.toUpperCase();
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function formatPages(value) {
  return Array.isArray(value) ? value.join(',') : 'none';
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message : 'unknown error';
}

function printVerificationSql() {
  console.log(`\nVerify hosted MOVIE coverage after the import:\n\nselect\n  count(*) filter (where discoverable) as discoverable_movies,\n  count(*) filter (where discoverable and image_url is not null) as movies_with_posters,\n  count(*) filter (where discoverable and description is not null) as movies_with_descriptions\nfrom public.items\nwhere item_type = 'MOVIE';\n`);
}

function printHelp() {
  console.log(`Usage:\n  npm run catalog:tmdb-beta -- [options]\n\nOptions:\n  --start-page 1\n  --pages 15\n  --pages-per-request 3\n  --minimum-vote-count 40\n  --language fi-FI\n  --region FI\n  --delay-ms 350\n  --dry-run\n\nThe script orchestrates the existing hosted catalog-import Edge Function. Each\nrequest remains bounded to at most three TMDB discover pages; this script simply\nexecutes multiple bounded requests in order and fails closed on page gaps or\nprovider/configuration errors. It never sends TMDB credentials to the client.\n\nEnvironment for a real import:\n  SUPABASE_URL\n  SUPABASE_SECRET_KEY   (preferred)\n  or SUPABASE_SERVICE_ROLE_KEY (legacy fallback)\n\nThe hosted Edge Function separately requires TMDB_READ_ACCESS_TOKEN in Supabase\nEdge Function secrets. Do not store any of these secrets in Git.\n`);
}

const entryUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (entryUrl === import.meta.url) {
  await runCli();
}
