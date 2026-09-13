#!/usr/bin/env node

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  getTmdbBucket, MAX_IMDB_IDS_PER_REQUEST, TMDB_BETA_BUCKETS,
  TMDB_BUCKET_ACTION, TMDB_IMDB_ACTION, validImdbIds, validTmdbAsOf,
} from '../../supabase/functions/_shared/tmdb-import-plan.mjs';

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
      case '--balanced-plan':
        options.balancedPlan = true;
        break;
      case '--bucket':
        if (!getTmdbBucket(next)) throw new Error('--bucket requires a known bucket ID.');
        options.bucket = next;
        index += 1;
        break;
      case '--imdb-ids':
        options.imdbIds = next?.split(',');
        if (!validImdbIds(options.imdbIds, 50)) throw new Error('--imdb-ids requires 1–50 unique tt identifiers.');
        index += 1;
        break;
      case '--as-of':
        if (!validTmdbAsOf(next)) throw new Error('--as-of requires a valid past/current YYYY-MM-DD date since 2020.');
        options.asOf = next;
        index += 1;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const selectionCount = [options.balancedPlan, options.bucket, options.imdbIds].filter(Boolean).length;
  if (selectionCount > 1) throw new Error('Select exactly one of --balanced-plan, --bucket or --imdb-ids.');
  if (selectionCount) {
    if (!options.asOf) throw new Error('A reviewed --as-of date is required for a bounded selection.');
    const disallowed = ['--minimum-vote-count', ...(options.bucket ? [] : ['--start-page', '--pages']),
      ...(options.imdbIds ? ['--region', '--pages-per-request'] : [])];
    if (args.some((argument) => disallowed.includes(argument))) throw new Error('Selection cannot override fixed controls.');
    if (options.bucket) {
      if (!args.includes('--pages')) options.totalPages = getTmdbBucket(options.bucket).pages - options.startPage + 1;
      if (options.totalPages < 1 || options.startPage + options.totalPages - 1 > getTmdbBucket(options.bucket).pages) {
        throw new Error('Requested pages exceed the reviewed bucket budget.');
      }
    }
  } else if (options.asOf) {
    throw new Error('--as-of requires a bounded selection.');
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
  if (options.imdbIds) {
    return Array.from({ length: Math.ceil(options.imdbIds.length / MAX_IMDB_IDS_PER_REQUEST) }, (_, index) => ({
      action: TMDB_IMDB_ACTION,
      imdbIds: options.imdbIds.slice(index * MAX_IMDB_IDS_PER_REQUEST, (index + 1) * MAX_IMDB_IDS_PER_REQUEST),
      language: options.language, asOf: options.asOf,
    }));
  }
  if (options.balancedPlan || options.bucket) {
    const buckets = options.bucket ? [getTmdbBucket(options.bucket)] : TMDB_BETA_BUCKETS;
    return buckets.flatMap((bucket) => {
      const startPage = options.bucket ? options.startPage : 1;
      const totalPages = options.bucket ? options.totalPages : bucket.pages;
      return planTmdbImportBatches({ startPage, totalPages, pagesPerRequest: options.pagesPerRequest })
        .map((batch) => ({
          action: TMDB_BUCKET_ACTION, bucket: bucket.id, ...batch,
          language: options.language, region: options.region, asOf: options.asOf,
        }));
    });
  }
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

  if (expected.action === TMDB_BUCKET_ACTION || expected.action === TMDB_IMDB_ACTION) {
    if (payload.action !== expected.action || payload.asOf !== expected.asOf) {
      throw new Error('catalog-import selection contract mismatch.');
    }
  }
  if (expected.action === TMDB_IMDB_ACTION) {
    if (!Array.isArray(payload.imdbIds) || JSON.stringify(payload.imdbIds) !== JSON.stringify(expected.imdbIds) ||
      payload.language !== expected.language || payload.importedCount !== expected.imdbIds.length || payload.skippedCount !== 0) {
      throw new Error('catalog-import IMDb enrichment is incomplete or mismatched.');
    }
    return { importedCount: payload.importedCount, skippedCount: 0, imdbIds: payload.imdbIds };
  }
  if (expected.action === TMDB_BUCKET_ACTION && payload.bucket !== expected.bucket) {
    throw new Error('catalog-import bucket mismatch.');
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
  const minimumVoteCount = expected.action === TMDB_BUCKET_ACTION
    ? getTmdbBucket(expected.bucket).minimumVoteCount : expected.minimumVoteCount;
  if (payload.minimumVoteCount !== minimumVoteCount) {
    throw new Error('catalog-import returned an unexpected minimumVoteCount.');
  }
  if (payload.importedCount + payload.skippedCount > expected.pages * 20) {
    throw new Error('catalog-import counts exceed the requested page budget.');
  }

  return {
    importedCount: payload.importedCount,
    skippedCount: payload.skippedCount,
    pages: expectedPages,
    ...(expected.action === TMDB_BUCKET_ACTION ? { bucket: expected.bucket } : {}),
  };
}

export async function runTmdbBetaImport(options, dependencies) {
  const batches = planTmdbImportBatches(options);
  const results = [];

  for (const [index, batch] of batches.entries()) {
    const expected = batch.action ? batch : {
      ...batch,
      language: options.language,
      region: options.region,
      minimumVoteCount: options.minimumVoteCount,
    };
    dependencies.progress?.({ status: 'starting', request: index + 1, body: expected });
    const response = await dependencies.invoke(expected);
    const result = validateTmdbImportResponse(response, expected);
    results.push(result);
    dependencies.progress?.({ status: 'completed', request: index + 1, body: expected, result });

    if (index < batches.length - 1 && options.delayMs > 0) {
      await dependencies.sleep(options.delayMs);
    }
  }

  return batches[0]?.action
    ? {
      requestCount: results.length, results,
      importedCount: results.reduce((sum, result) => sum + result.importedCount, 0),
      skippedCount: results.reduce((sum, result) => sum + result.skippedCount, 0),
    }
    : summarizeTmdbImport(results);
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
          ...(batches[0]?.action ? {
            asOf: options.asOf,
            requestCount: batches.length,
            pageBudget: batches.reduce((sum, batch) => sum + (batch.pages ?? 0), 0),
            identifierBudget: batches.reduce((sum, batch) => sum + (batch.imdbIds?.length ?? 0), 0),
          } : { options }),
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
      progress: batches[0]?.action ? (checkpoint) => console.log(JSON.stringify(checkpoint)) : undefined,
    });

    console.log(
      JSON.stringify(
        {
          status: 'complete',
          ...summary,
          language: options.language,
          ...(batches[0]?.action ? { asOf: options.asOf } : {
            region: options.region, minimumVoteCount: options.minimumVoteCount,
          }),
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
    redirect: 'error',
    signal: AbortSignal.timeout(180_000),
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
  console.log(`Bounded catalog selections (use one):
  --balanced-plan --as-of YYYY-MM-DD   30 pages across 18 fixed buckets
  --bucket ID --as-of YYYY-MM-DD       one bucket; --start-page/--pages for recovery
  --imdb-ids tt0000001,tt0000002 --as-of YYYY-MM-DD   exact enrichment, batches of 10

Use --dry-run to print all request bodies without credentials or network I/O.
Buckets: ${TMDB_BETA_BUCKETS.map((bucket) => bucket.id).join(', ')}
The as-of date bounds release dates, not changing provider popularity snapshots.
Real runs emit a before/after checkpoint for each bounded request and never retry
an ambiguous result automatically. Recheck coverage before a manual recovery.
`);
  console.log(`Usage:\n  npm run catalog:tmdb-beta -- [options]\n\nOptions:\n  --start-page 1\n  --pages 15\n  --pages-per-request 3\n  --minimum-vote-count 40\n  --language fi-FI\n  --region FI\n  --delay-ms 350\n  --dry-run\n\nThe script orchestrates the existing hosted catalog-import Edge Function. Each\nrequest remains bounded to at most three TMDB discover pages; this script simply\nexecutes multiple bounded requests in order and fails closed on page gaps or\nprovider/configuration errors. It never sends TMDB credentials to the client.\n\nEnvironment for a real import:\n  SUPABASE_URL\n  SUPABASE_SECRET_KEY   (preferred)\n  or SUPABASE_SERVICE_ROLE_KEY (legacy fallback)\n\nThe hosted Edge Function separately requires TMDB_READ_ACCESS_TOKEN in Supabase\nEdge Function secrets. Do not store any of these secrets in Git.\n`);
}

const entryUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (entryUrl === import.meta.url) {
  await runCli();
}
