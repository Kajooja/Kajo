import { timingSafeEqual } from 'node:crypto';

import { normalizeTmdbMovie } from '../_shared/catalog-normalizers.mjs';
import {
  bucketDiscoverFilters,
  eligibleTmdbMovie,
  getTmdbBucket,
  TMDB_BUCKET_ACTION,
  TMDB_IMDB_ACTION,
  validImdbIds,
  validTmdbAsOf,
} from '../_shared/tmdb-import-plan.mjs';

type ImportAction = 'tmdb-movies' | typeof TMDB_BUCKET_ACTION | typeof TMDB_IMDB_ACTION;

interface ImportRequest {
  action?: ImportAction;
  startPage?: number;
  pages?: number;
  language?: string;
  region?: string;
  minimumVoteCount?: number;
  bucket?: string;
  asOf?: string;
  imdbIds?: string[];
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};
const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const DEFAULT_LANGUAGE = 'fi-FI';
const DEFAULT_REGION = 'FI';
const DEFAULT_MINIMUM_VOTE_COUNT = 40;
const MAX_PAGES_PER_REQUEST = 3;
const TMDB_DETAIL_CONCURRENCY = 4;
const UPSERT_BATCH_SIZE = 25;

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ status: 'error', code: 'method-not-allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serverKeys = readServerKeys();

  if (!supabaseUrl || !serverKeys) {
    if (!supabaseUrl) invalidServerConfiguration('missing-supabase-url');
    return json({ status: 'error', code: 'server-not-configured' }, 500);
  }

  // verify_jwt=false is declared in config.toml. Neither a user JWT nor an
  // arbitrary sb_secret_ prefix grants access: match a configured server key.
  // Modern keys must use apikey; exact legacy service_role Bearer calls remain
  // supported independently while that legacy key is configured.
  const suppliedApiKey = request.headers.get('apikey');
  const suppliedBearer = readBearerToken(request.headers.get('authorization'));
  const secretKey = serverKeys.modern.find((key) => keysEqual(suppliedApiKey, key)) ??
    (serverKeys.legacy && (
        keysEqual(suppliedApiKey, serverKeys.legacy) ||
        keysEqual(suppliedBearer, serverKeys.legacy)
      )
      ? serverKeys.legacy
      : null);
  if (!secretKey) {
    return json({ status: 'error', code: 'forbidden' }, 403);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ status: 'error', code: 'invalid-json' }, 400);
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ status: 'error', code: 'invalid-request' }, 400);
  }
  const body = input as ImportRequest;
  if (!['tmdb-movies', TMDB_BUCKET_ACTION, TMDB_IMDB_ACTION].includes(body.action ?? '')) {
    return json({ status: 'error', code: 'unsupported-action' }, 400);
  }

  const byImdb = body.action === TMDB_IMDB_ACTION;
  const selectedBucket = body.action === TMDB_BUCKET_ACTION;
  const bucket = selectedBucket ? getTmdbBucket(body.bucket) : null;
  const asOf = body.asOf ?? new Date().toISOString().slice(0, 10);
  // Reject mixed/unknown controls; never silently ignore a requested selection.
  const fields = byImdb
    ? ['action', 'imdbIds', 'language', 'asOf']
    : selectedBucket
    ? ['action', 'bucket', 'startPage', 'pages', 'language', 'region', 'asOf']
    : ['action', 'startPage', 'pages', 'language', 'region', 'minimumVoteCount'];
  if (Object.keys(body).some((key) => !fields.includes(key)) ||
    ((byImdb || selectedBucket) && !validTmdbAsOf(body.asOf)) ||
    (byImdb && !validImdbIds(body.imdbIds)) || (selectedBucket && !bucket)) {
    return json({ status: 'error', code: 'invalid-request' }, 400);
  }

  const startPage = boundedInteger(body.startPage, 1, 500, 1);
  const pages = boundedInteger(body.pages, 1, MAX_PAGES_PER_REQUEST, 1);
  const minimumVoteCount = boundedInteger(
    bucket?.minimumVoteCount ?? body.minimumVoteCount,
    0,
    1000000,
    DEFAULT_MINIMUM_VOTE_COUNT,
  );
  const language = normalizeLocale(body.language, DEFAULT_LANGUAGE);
  const region = normalizeRegion(body.region, DEFAULT_REGION);
  if (
    startPage === null || pages === null || minimumVoteCount === null ||
    language === null || region === null || startPage + pages - 1 > 500 ||
    (bucket && startPage + pages - 1 > bucket.pages)
  ) {
    return json({ status: 'error', code: 'invalid-request' }, 400);
  }

  const tmdbToken = Deno.env.get('TMDB_READ_ACCESS_TOKEN');
  if (!tmdbToken) {
    return json({ status: 'error', code: 'tmdb-not-configured' }, 503);
  }

  try {
    if (byImdb) {
      // Resolve only exact movie identifiers, then verify detail aliases before
      // one atomic upsert. A missing/ambiguous/mismatched result stops this batch.
      const imdbIds = body.imdbIds!;
      const entries = await mapWithConcurrency(imdbIds, TMDB_DETAIL_CONCURRENCY, async (imdbId) => {
        const url = new URL(`${TMDB_API_BASE_URL}/find/${imdbId}`);
        url.searchParams.set('external_source', 'imdb_id');
        url.searchParams.set('language', language);
        const found = await fetchTmdbJson(url.toString(), tmdbToken);
        if (!Array.isArray(found.movie_results) || found.movie_results.length !== 1) {
          throw new Error('IMDb movie mapping is unavailable or ambiguous');
        }
        const movieId = found.movie_results[0]?.id;
        if (!Number.isSafeInteger(movieId) || movieId <= 0) throw new Error('Invalid TMDB ID');
        const movie = await fetchLocalizedMovie(movieId, language, tmdbToken);
        const entry = normalizeTmdbMovie(movie);
        if (!entry || !eligibleTmdbMovie(movie, entry, asOf) || entry.externalIds.imdb_title !== imdbId) {
          throw new Error('IMDb detail identity or metadata mismatch');
        }
        return entry;
      });
      if (new Set(entries.map((entry) => entry.providerItemId)).size !== entries.length) {
        throw new Error('Conflicting IMDb mappings');
      }
      const importedCount = await upsertCatalogBatch(supabaseUrl, secretKey, entries);
      return json({
        status: 'imported', provider: 'tmdb', action: TMDB_IMDB_ACTION,
        importedCount, skippedCount: 0, imdbIds, language, asOf,
      });
    }

    let importedCount = 0;
    let skippedCount = 0;
    const completedPages: number[] = [];

    for (let page = startPage; page < startPage + pages; page += 1) {
      const discovery = await fetchTmdbJson(
        buildDiscoverUrl({
          page,
          language,
          region,
          minimumVoteCount,
          asOf,
          bucket,
        }),
        tmdbToken,
      );
      if (!Array.isArray(discovery.results) || discovery.results.length > 20 ||
        (bucket && discovery.page !== page)) throw new Error('Invalid discovery page');
      const results = discovery.results;
      const details = await mapWithConcurrency(
        results,
        TMDB_DETAIL_CONCURRENCY,
        async (movie) => {
          const movieId = movie?.id;
          if (!Number.isSafeInteger(movieId) || movieId <= 0) throw new Error('Invalid TMDB ID');
          return fetchLocalizedMovie(movieId, language, tmdbToken);
        },
      );
      const entries = details
        .map((movie) => {
          const entry = normalizeTmdbMovie(movie);
          return bucket && !eligibleTmdbMovie(movie, entry, asOf, bucket) ? null : entry;
        })
        .filter((entry) => entry !== null);

      skippedCount += results.length - entries.length;

      for (let offset = 0; offset < entries.length; offset += UPSERT_BATCH_SIZE) {
        const batch = entries.slice(offset, offset + UPSERT_BATCH_SIZE);
        importedCount += await upsertCatalogBatch(supabaseUrl, secretKey, batch);
      }

      completedPages.push(page);
    }

    return json({
      status: 'imported',
      provider: 'tmdb',
      importedCount,
      skippedCount,
      pages: completedPages,
      language,
      region,
      minimumVoteCount,
      ...(bucket ? { action: TMDB_BUCKET_ACTION, bucket: bucket.id, asOf } : {}),
    });
  } catch {
    // Upstream errors can contain reflected credentials or provider payloads.
    console.error('catalog-import failed: provider-import-failed');
    return json({ status: 'error', code: 'provider-import-failed' }, 502);
  }
});

// A single native Data API call keeps this deployment free of registry
// dependencies. The canonical database function still owns the atomic write.
async function upsertCatalogBatch(
  supabaseUrl: string,
  secretKey: string,
  entries: unknown[],
): Promise<number> {
  const headers: Record<string, string> = {
    ...JSON_HEADERS,
    accept: 'application/json',
    apikey: secretKey,
  };
  // Modern keys are not JWTs. Only the matched legacy service-role key needs
  // Bearer authorization; never forward the incoming caller's Authorization.
  if (!secretKey.startsWith('sb_secret_')) {
    headers.authorization = `Bearer ${secretKey}`;
  }
  const response = await fetch(
    `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/upsert_catalog_batch_v1`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ entries }),
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('Catalog batch upsert failed');
  }
  const data: unknown = await response.json();
  if (
    !Array.isArray(data) || data.length !== entries.length ||
    data.some((row, index) =>
      !row || row.input_index !== index + 1 ||
      typeof row.item_id !== 'string' || row.item_id.length === 0
    )
  ) {
    throw new Error('Catalog batch upsert returned incomplete results');
  }
  return data.length;
}

function buildDiscoverUrl(input: {
  page: number;
  language: string;
  region: string;
  minimumVoteCount: number;
  asOf: string;
  bucket: ReturnType<typeof getTmdbBucket>;
}): string {
  const url = new URL(`${TMDB_API_BASE_URL}/discover/movie`);
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('include_video', 'false');
  url.searchParams.set('language', input.language);
  url.searchParams.set('region', input.region);
  url.searchParams.set('page', String(input.page));
  url.searchParams.set('sort_by', 'popularity.desc');
  url.searchParams.set('vote_count.gte', String(input.minimumVoteCount));
  url.searchParams.set('release_date.lte', input.asOf);
  if (input.bucket) {
    for (const [key, value] of Object.entries(bucketDiscoverFilters(input.bucket, input.asOf))) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function fetchLocalizedMovie(
  movieId: number,
  language: string,
  token: string,
): Promise<Record<string, unknown>> {
  const localized = await fetchMovieDetails(movieId, language, token);

  if (language === 'en-US' || hasUsefulLocalizedCopy(localized)) {
    return localized;
  }

  const fallback = await fetchMovieDetails(movieId, 'en-US', token);
  return {
    ...fallback,
    ...localized,
    title: usefulString(localized.title) ?? fallback.title,
    overview: usefulString(localized.overview) ?? fallback.overview,
    poster_path: usefulString(localized.poster_path) ?? fallback.poster_path,
  };
}

async function fetchMovieDetails(
  movieId: number,
  language: string,
  token: string,
): Promise<Record<string, unknown>> {
  const url = new URL(`${TMDB_API_BASE_URL}/movie/${movieId}`);
  url.searchParams.set('language', language);
  url.searchParams.set('append_to_response', 'credits,external_ids');
  const movie = await fetchTmdbJson(url.toString(), token);
  if (movie.id !== movieId) throw new Error('TMDB detail identity mismatch');
  return movie;
}

async function fetchTmdbJson(
  url: string,
  token: string,
): Promise<Record<string, any>> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`TMDB request failed with ${response.status}`);
  }

  const data = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('TMDB returned a non-object response');
  }

  return data as Record<string, any>;
}

async function mapWithConcurrency<TInput, TOutput>(
  values: readonly TInput[],
  concurrency: number,
  mapper: (value: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const output = new Array<TOutput>(values.length);
  let nextIndex = 0;
  let failed = false;
  let failure: unknown;

  async function worker() {
    while (!failed) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      try {
        output[index] = await mapper(values[index]);
      } catch (error) {
        failed = true;
        failure = error;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  if (failed) throw failure;
  return output;
}

function hasUsefulLocalizedCopy(movie: Record<string, unknown>): boolean {
  return Boolean(usefulString(movie.title) && usefulString(movie.overview) && usefulString(movie.poster_path));
}

function usefulString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number | null {
  if (value === undefined) return fallback;
  return typeof value === 'number' && Number.isInteger(value) &&
      value >= minimum && value <= maximum
    ? value
    : null;
}

function normalizeLocale(value: unknown, fallback: string): string | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return /^[a-z]{2}-[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizeRegion(value: unknown, fallback: string): string | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function readBearerToken(value: string | null): string | null {
  return value?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}

function readServerKeys(): { modern: string[]; legacy: string | null } | null {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  const modern: string[] = [];
  try {
    if (raw) {
      let keys: unknown;
      try {
        keys = JSON.parse(raw);
      } catch {
        return invalidServerConfiguration('invalid-secret-keys-json');
      }
      if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
        return invalidServerConfiguration('invalid-secret-keys-object');
      }
      for (const key of Object.values(keys)) {
        if (!isSecretKey(key)) {
          return invalidServerConfiguration('invalid-secret-keys-value');
        }
        modern.push(key);
      }
    }
    // The CLI provisions a singular key in local development.
    const localKey = Deno.env.get('SUPABASE_SECRET_KEY');
    if (localKey) {
      if (!isSecretKey(localKey)) {
        return invalidServerConfiguration('invalid-local-secret-key');
      }
      modern.push(localKey);
    }
    let legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || null;
    if (legacy && !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(legacy)) {
      if (!modern.length) {
        return invalidServerConfiguration('invalid-legacy-service-role-key');
      }
      // Modern keys work independently of optional legacy JWT compatibility.
      // A malformed legacy value must never become an accepted credential.
      legacy = null;
    }
    return modern.length || legacy
      ? { modern, legacy }
      : invalidServerConfiguration('missing-server-key');
  } catch {
    return invalidServerConfiguration('unreadable-server-key-configuration');
  }
}

function invalidServerConfiguration(
  reason:
    | 'missing-supabase-url'
    | 'invalid-secret-keys-json'
    | 'invalid-secret-keys-object'
    | 'invalid-secret-keys-value'
    | 'invalid-local-secret-key'
    | 'invalid-legacy-service-role-key'
    | 'missing-server-key'
    | 'unreadable-server-key-configuration',
): null {
  // Only fixed reason codes enter the private function log. JSON parse errors,
  // key values/names and request data must never reach logs or the HTTP response.
  console.error(`catalog-import configuration failed: ${reason}`);
  return null;
}

function isSecretKey(value: unknown): value is string {
  return typeof value === 'string' && /^sb_secret_[A-Za-z0-9_-]+$/.test(value);
}

function keysEqual(supplied: string | null, expected: string): boolean {
  if (!supplied) return false;
  const encoder = new TextEncoder();
  const left = encoder.encode(supplied);
  const right = encoder.encode(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
