#!/usr/bin/env node

import {
  OPEN_LIBRARY_BETA_BUCKETS,
  assertOpenLibraryBetaCoverage,
  buildOpenLibrarySearchUrl,
  normalizeOpenLibrarySearchWork,
  selectOpenLibraryBetaEntries,
} from './open-library-search-beta.mjs';

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') ?? null;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

if (!options.dryRun && (!supabaseUrl || !secretKey)) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required unless --dry-run is used.');
  process.exit(2);
}

const existingItems = !options.dryRun
  ? await fetchExistingBooks(supabaseUrl, secretKey)
  : [];

const candidates = [];
const bucketStatus = [];

for (const bucket of OPEN_LIBRARY_BETA_BUCKETS) {
  const url = buildOpenLibrarySearchUrl(bucket, options.limitPerBucket);
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'KajoCatalogImporter/1.0 (+https://github.com/Kajooja/Kajo)',
      },
    });

    if (!response.ok) {
      bucketStatus.push({ bucket: bucket.key, status: response.status, returned: 0 });
      await sleep(options.delayMs);
      continue;
    }

    const payload = await response.json();
    const docs = Array.isArray(payload?.docs) ? payload.docs : [];
    const normalized = docs
      .map((doc) => normalizeOpenLibrarySearchWork(doc, bucket))
      .filter((entry) => entry !== null);

    candidates.push(...normalized);
    bucketStatus.push({ bucket: bucket.key, status: response.status, returned: normalized.length });
  } catch (error) {
    bucketStatus.push({ bucket: bucket.key, status: 599, returned: 0 });
    console.warn(`Open Library bucket ${bucket.key} failed: ${safeErrorMessage(error)}`);
  }

  await sleep(options.delayMs);
}

const selected = selectOpenLibraryBetaEntries(candidates, existingItems);
const successfulBuckets = bucketStatus.filter((entry) => entry.status === 200 && entry.returned > 0).length;
assertOpenLibraryBetaCoverage(
  { selectedCount: selected.length, successfulBuckets },
  { minimumItems: options.minimumItems, minimumBuckets: options.minimumBuckets },
);

console.log(
  JSON.stringify(
    {
      selectedCount: selected.length,
      successfulBuckets,
      bucketStatus,
      sample: selected.slice(0, 8).map((entry) => ({
        workId: entry.providerItemId,
        title: entry.title,
        creators: entry.creators,
        releaseYear: entry.releaseYear,
        bucket: entry.metadata.searchBucket,
        displayLanguage: entry.metadata.displayLanguage ?? null,
        popularity: entry.metadata.popularity,
        voteCount: entry.metadata.voteCount,
      })),
    },
    null,
    2,
  ),
);

if (options.dryRun) {
  console.log('Dry run complete; nothing was written.');
  process.exit(0);
}

let imported = 0;
for (let offset = 0; offset < selected.length; offset += options.batchSize) {
  const batch = selected.slice(offset, offset + options.batchSize);
  imported += await upsertBatch(supabaseUrl, secretKey, batch);
  console.log(`Imported ${imported}/${selected.length} BOOK Items...`);
}

console.log(`Open Library search beta import complete: ${imported} Items upserted.`);

async function fetchExistingBooks(baseUrl, apiKey) {
  const url = new URL(`${baseUrl}/rest/v1/items`);
  url.searchParams.set('select', 'title,metadata');
  url.searchParams.set('item_type', 'eq.BOOK');
  url.searchParams.set('discoverable', 'eq.true');
  url.searchParams.set('limit', '5000');

  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
      'user-agent': 'KajoCatalogImporter/1.0 (+https://github.com/Kajooja/Kajo)',
    },
  });
  if (!response.ok) {
    throw new Error(`Existing BOOK lookup failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  const result = await response.json();
  return Array.isArray(result) ? result : [];
}

async function upsertBatch(baseUrl, apiKey, entries) {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/upsert_catalog_batch_v1`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'user-agent': 'KajoCatalogImporter/1.0 (+https://github.com/Kajooja/Kajo)',
    },
    body: JSON.stringify({ entries }),
  });
  if (!response.ok) {
    throw new Error(`Supabase catalog batch failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  const result = await response.json();
  return Array.isArray(result) ? result.length : entries.length;
}

function parseArguments(args) {
  const result = {
    limitPerBucket: 50,
    batchSize: 25,
    minimumItems: 180,
    minimumBuckets: 8,
    delayMs: 450,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const next = args[index + 1];
    switch (argument) {
      case '--limit-per-bucket':
        result.limitPerBucket = boundedInteger(next, 1, 100, result.limitPerBucket);
        index += 1;
        break;
      case '--batch-size':
        result.batchSize = boundedInteger(next, 1, 50, result.batchSize);
        index += 1;
        break;
      case '--minimum-items':
        result.minimumItems = boundedInteger(next, 1, 5000, result.minimumItems);
        index += 1;
        break;
      case '--minimum-buckets':
        result.minimumBuckets = boundedInteger(next, 1, OPEN_LIBRARY_BETA_BUCKETS.length, result.minimumBuckets);
        index += 1;
        break;
      case '--delay-ms':
        result.delayMs = boundedInteger(next, 0, 10000, result.delayMs);
        index += 1;
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
      default:
        console.error(`Unknown argument: ${argument}`);
        result.help = true;
        break;
    }
  }
  return result;
}

function boundedInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message : 'unknown error';
}

function printHelp() {
  console.log(`Usage:\n  node scripts/catalog/import-open-library-search-beta.mjs [options]\n\nOptions:\n  --limit-per-bucket 50\n  --batch-size 25\n  --minimum-items 180\n  --minimum-buckets 8\n  --delay-ms 450\n  --dry-run\n\nThis is a bounded beta bootstrap adapter, not the long-term bulk catalog path.\nIt makes a small fixed set of Open Library Search API requests, chooses the\nuser-language-preferred display edition, normalizes every result into the one\ncanonical Kajo Item contract, applies duplicate/coverage gates, then writes only\nthrough the service-only upsert_catalog_batch_v1 boundary. Open Library monthly\ndumps remain the canonical large-scale import path.\n\nEnvironment for writes:\n  SUPABASE_URL\n  SUPABASE_SECRET_KEY   (preferred)\n  or SUPABASE_SERVICE_ROLE_KEY (legacy fallback)\n`);
}
