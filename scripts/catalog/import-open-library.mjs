#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

import {
  isUsefulOpenLibraryEdition,
  normalizeOpenLibraryEdition,
  parseOpenLibraryDumpLine,
} from '../../supabase/functions/_shared/catalog-normalizers.mjs';

const options = parseArguments(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

if (!options.ratings || !options.editions) {
  console.error('Both --ratings and --editions are required.');
  printHelp();
  process.exit(2);
}

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') ?? null;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  null;

if (!options.dryRun && (!supabaseUrl || !secretKey)) {
  console.error(
    'SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required unless --dry-run is used.',
  );
  process.exit(2);
}

const workPoolSize = Math.max(options.maxItems * 4, options.maxItems);
console.log(`Selecting up to ${workPoolSize} highly-rated Open Library works...`);
const targetWorks = await selectTopRatedWorks(
  options.ratings,
  workPoolSize,
  options.minimumRatingCount,
);

console.log(
  `Scanning editions for ${targetWorks.size} candidate works in ${options.languages.join(', ')}...`,
);
const selected = await selectBestEditions(options.editions, targetWorks, options);
const entries = [...selected.values()]
  .sort(compareEditionCandidates)
  .slice(0, options.maxItems)
  .map((candidate) => candidate.entry);

console.log(
  `Selected ${entries.length} canonical BOOK candidates from Open Library bulk dumps.`,
);

if (entries.length === 0) {
  process.exit(0);
}

if (options.dryRun) {
  console.log(JSON.stringify(entries.slice(0, 5), null, 2));
  console.log('Dry run complete; nothing was written.');
  process.exit(0);
}

let imported = 0;
for (let offset = 0; offset < entries.length; offset += options.batchSize) {
  const batch = entries.slice(offset, offset + options.batchSize);
  const count = await upsertBatch(supabaseUrl, secretKey, batch);
  imported += count;
  console.log(`Imported ${imported}/${entries.length} BOOK Items...`);
}

console.log(`Open Library import complete: ${imported} Items upserted.`);

async function selectTopRatedWorks(path, limit, minimumRatingCount) {
  const stats = new Map();
  const lines = createLineReader(path);

  for await (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const [rawWorkKey, , rawRating] = line.split('\t');
    const workKey = normalizeWorkKey(rawWorkKey);
    const rating = Number(rawRating);
    if (!workKey || !Number.isFinite(rating)) continue;

    const current = stats.get(workKey) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += rating;
    stats.set(workKey, current);
  }

  return new Set(
    [...stats.entries()]
      .filter(([, stat]) => stat.count >= minimumRatingCount)
      .sort((left, right) => {
        const countDelta = right[1].count - left[1].count;
        if (countDelta !== 0) return countDelta;
        const rightAverage = right[1].sum / right[1].count;
        const leftAverage = left[1].sum / left[1].count;
        if (rightAverage !== leftAverage) return rightAverage - leftAverage;
        return left[0].localeCompare(right[0]);
      })
      .slice(0, limit)
      .map(([workKey]) => workKey),
  );
}

async function selectBestEditions(path, targetWorks, inputOptions) {
  const selected = new Map();
  const lines = createLineReader(path);
  let inspected = 0;
  let eligible = 0;

  for await (const line of lines) {
    inspected += 1;
    const parsed = parseOpenLibraryDumpLine(line);
    if (!parsed) continue;

    const workKey = firstWorkKey(parsed.record);
    if (!workKey || !targetWorks.has(workKey)) continue;
    if (
      !isUsefulOpenLibraryEdition(parsed, {
        languages: inputOptions.languages,
        minimumYear: inputOptions.minimumYear,
        maximumYear: inputOptions.maximumYear,
      })
    ) {
      continue;
    }

    const entry = normalizeOpenLibraryEdition(parsed.record, {
      lastModified: parsed.lastModified,
    });
    if (!entry) continue;

    eligible += 1;
    const candidate = {
      entry,
      score: scoreEdition(entry),
      ratingRank: targetWorksOrder(targetWorks, workKey),
    };
    const current = selected.get(workKey);

    if (!current || compareEditionCandidates(candidate, current) < 0) {
      selected.set(workKey, candidate);
    }

    if (inspected % 1000000 === 0) {
      console.log(
        `Scanned ${inspected.toLocaleString()} edition rows; ${eligible.toLocaleString()} eligible; ${selected.size} works resolved.`,
      );
    }
  }

  return selected;
}

function targetWorksOrder(targetWorks, workKey) {
  let index = 0;
  for (const value of targetWorks) {
    if (value === workKey) return index;
    index += 1;
  }
  return Number.MAX_SAFE_INTEGER;
}

function scoreEdition(entry) {
  let score = 0;
  if (entry.originalLanguage === 'fi') score += 30;
  else if (entry.originalLanguage === 'sv') score += 18;
  else if (entry.originalLanguage === 'en') score += 14;
  if (entry.creators?.length) score += 12;
  if (entry.description) score += 6;
  if (entry.tags?.length) score += Math.min(entry.tags.length, 6);
  if (entry.externalIds?.isbn13) score += 8;
  if (entry.releaseYear && entry.releaseYear >= 1980) score += 3;
  return score;
}

function compareEditionCandidates(left, right) {
  const scoreDelta = right.score - left.score;
  if (scoreDelta !== 0) return scoreDelta;
  const rankDelta = left.ratingRank - right.ratingRank;
  if (rankDelta !== 0) return rankDelta;
  return left.entry.providerItemId.localeCompare(right.entry.providerItemId);
}

async function upsertBatch(baseUrl, apiKey, entries) {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/upsert_catalog_batch_v1`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'content-type': 'application/json',
      'user-agent': 'KajoCatalogImporter/1.0',
    },
    body: JSON.stringify({ entries }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase catalog batch failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const result = await response.json();
  return Array.isArray(result) ? result.length : entries.length;
}

function createLineReader(path) {
  const source = createReadStream(path);
  const input = path.endsWith('.gz') ? source.pipe(createGunzip()) : source;
  return createInterface({ input, crlfDelay: Infinity });
}

function firstWorkKey(record) {
  if (!Array.isArray(record?.works)) return null;
  for (const value of record.works) {
    const key = normalizeWorkKey(value?.key ?? value);
    if (key) return key;
  }
  return null;
}

function normalizeWorkKey(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (/^OL\d+W$/.test(normalized)) return `/works/${normalized}`;
  return /^\/works\/OL\d+W$/.test(normalized) ? normalized : null;
}

function parseArguments(args) {
  const result = {
    ratings: null,
    editions: null,
    maxItems: 1000,
    batchSize: 25,
    languages: ['eng', 'fin', 'swe'],
    minimumYear: 1950,
    maximumYear: new Date().getUTCFullYear() + 1,
    minimumRatingCount: 3,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const next = args[index + 1];

    switch (argument) {
      case '--ratings':
        result.ratings = next ?? null;
        index += 1;
        break;
      case '--editions':
        result.editions = next ?? null;
        index += 1;
        break;
      case '--max':
        result.maxItems = boundedInteger(next, 1, 10000, result.maxItems);
        index += 1;
        break;
      case '--batch-size':
        result.batchSize = boundedInteger(next, 1, 50, result.batchSize);
        index += 1;
        break;
      case '--languages':
        result.languages = String(next ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        index += 1;
        break;
      case '--min-year':
        result.minimumYear = boundedInteger(next, 1400, 2100, result.minimumYear);
        index += 1;
        break;
      case '--max-year':
        result.maximumYear = boundedInteger(next, 1400, 2200, result.maximumYear);
        index += 1;
        break;
      case '--minimum-rating-count':
        result.minimumRatingCount = boundedInteger(
          next,
          1,
          1000000,
          result.minimumRatingCount,
        );
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
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
}

function printHelp() {
  console.log(`Usage:
  node scripts/catalog/import-open-library.mjs \\
    --ratings /path/to/ol_dump_ratings_latest.txt.gz \\
    --editions /path/to/ol_dump_editions_latest.txt.gz \\
    [--max 1000] [--languages eng,fin,swe] [--min-year 1950] [--dry-run]

The importer uses Open Library monthly bulk dumps only. It first selects highly-rated
Work IDs from the ratings dump, then streams the editions dump and chooses one useful
cover+ISBN edition per Work. Writes go through the service-only
upsert_catalog_batch_v1 boundary.

Environment for writes:
  SUPABASE_URL
  SUPABASE_SECRET_KEY   (preferred sb_secret_... key)
  or SUPABASE_SERVICE_ROLE_KEY (legacy fallback)
`);
}
