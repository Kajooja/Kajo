import { timingSafeEqual } from 'node:crypto';

import { normalizeTmdbMovie } from '../_shared/catalog-normalizers.mjs';
import { CatalogImportFailure, createImportFailureDiagnostics } from '../_shared/catalog-import-diagnostics.mjs';
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

  const progress = {
    completedPages: [] as number[],
    failedPage: byImdb ? null : startPage,
    confirmedImportedCount: 0,
    confirmedSkippedCount: 0,
    writeOutcome: 'not-started' as 'not-started' | 'unknown',
  };
  try {
    if (byImdb) {
      // Resolve only exact movie identifiers, then verify detail aliases before
      // one atomic upsert. A missing/ambiguous/mismatched result stops this batch.
      const imdbIds = body.imdbIds!;
      const entries = await mapWithConcurrency(imdbIds, TMDB_DETAIL_CONCURRENCY, async (imdbId) => {
        const url = new URL(`${TMDB_API_BASE_URL}/find/${imdbId}`);
        url.searchParams.set('external_source', 'imdb_id');
        url.searchParams.set('language', language);
        const found = await fetchTmdbJson(url.toString(), tmdbToken, 'tmdb-find');
        if (!Array.isArray(found.movie_results) || found.movie_results.length !== 1) {
          throw new CatalogImportFailure('tmdb-find', 'identity-mismatch');
        }
        const movieId = found.movie_results[0]?.id;
        if (!Number.isSafeInteger(movieId) || movieId <= 0) throw new CatalogImportFailure('tmdb-find', 'identity-mismatch');
        const movie = await fetchLocalizedMovie(movieId, language, tmdbToken);
        const entry = normalizeMovie(movie);
        if (!entry || !eligibleTmdbMovie(movie, entry, asOf)) {
          throw new CatalogImportFailure('normalize', 'ineligible-metadata');
        }
        if (entry.externalIds.imdb_title !== imdbId) throw new CatalogImportFailure('tmdb-detail', 'identity-mismatch');
        return entry;
      });
      if (new Set(entries.map((entry) => entry.providerItemId)).size !== entries.length) {
        throw new CatalogImportFailure('tmdb-find', 'identity-mismatch');
      }
      progress.writeOutcome = 'unknown';
      const importedCount = await upsertCatalogBatch(supabaseUrl, secretKey, entries);
      return json({
        status: 'imported', provider: 'tmdb', action: TMDB_IMDB_ACTION,
        importedCount, skippedCount: 0, imdbIds, language, asOf,
      });
    }

    for (let page = startPage; page < startPage + pages; page += 1) {
      progress.failedPage = page;
      progress.writeOutcome = 'not-started';
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
        'tmdb-discover',
      );
      if (!Array.isArray(discovery.results) || discovery.results.length > 20 ||
        (bucket && discovery.page !== page)) throw new CatalogImportFailure('tmdb-discover', 'invalid-response');
      const results = discovery.results;
      const details = await mapWithConcurrency(
        results,
        TMDB_DETAIL_CONCURRENCY,
        async (movie) => {
          const movieId = movie?.id;
          if (!Number.isSafeInteger(movieId) || movieId <= 0) throw new CatalogImportFailure('tmdb-discover', 'identity-mismatch');
          return fetchLocalizedMovie(movieId, language, tmdbToken);
        },
      );
      const entries = details
        .map((movie) => {
          const entry = normalizeMovie(movie);
          return bucket && !eligibleTmdbMovie(movie, entry, asOf, bucket) ? null : entry;
        })
        .filter((entry) => entry !== null);

      for (let offset = 0; offset < entries.length; offset += UPSERT_BATCH_SIZE) {
        const batch = entries.slice(offset, offset + UPSERT_BATCH_SIZE);
        // A missing/invalid acknowledgement cannot establish database rollback.
        progress.writeOutcome = 'unknown';
        progress.confirmedImportedCount += await upsertCatalogBatch(supabaseUrl, secretKey, batch);
      }

      progress.confirmedSkippedCount += results.length - entries.length;
      progress.completedPages.push(page);
    }

    return json({
      status: 'imported',
      provider: 'tmdb',
      importedCount: progress.confirmedImportedCount,
      skippedCount: progress.confirmedSkippedCount,
      pages: progress.completedPages,
      language,
      region,
      minimumVoteCount,
      ...(bucket ? { action: TMDB_BUCKET_ACTION, bucket: bucket.id, asOf } : {}),
    });
  } catch (error) {
    const diagnostics = createImportFailureDiagnostics(error, progress);
    console.error(`catalog-import failed: ${JSON.stringify(diagnostics)}`);
    return json({ status: 'error', code: 'provider-import-failed', diagnostics }, 502);
  }
});

function normalizeMovie(movie: Record<string, unknown>) {
  try {
    return normalizeTmdbMovie(movie);
  } catch {
    throw new CatalogImportFailure('normalize', 'invalid-response');
  }
}

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
  const response = await fetchImportResponse(
    `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/upsert_catalog_batch_v1`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ entries }),
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    },
    'catalog-upsert',
  );
  const data: unknown = await readImportJson(response, 'catalog-upsert');
  if (
    !Array.isArray(data) || data.length !== entries.length ||
    data.some((row, index) =>
      !row || row.input_index !== index + 1 ||
      typeof row.item_id !== 'string' || row.item_id.length === 0
    )
  ) {
    throw new CatalogImportFailure('catalog-upsert', 'invalid-response', response.status);
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
  const localized = await fetchMovieDetails(movieId, language, token, 'tmdb-detail');

  if (language === 'en-US' || hasUsefulLocalizedCopy(localized)) {
    return localized;
  }

  const fallback = await fetchMovieDetails(movieId, 'en-US', token, 'tmdb-fallback');
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
  stage: 'tmdb-detail' | 'tmdb-fallback',
): Promise<Record<string, unknown>> {
  const url = new URL(`${TMDB_API_BASE_URL}/movie/${movieId}`);
  url.searchParams.set('language', language);
  url.searchParams.set('append_to_response', 'credits,external_ids');
  const movie = await fetchTmdbJson(url.toString(), token, stage);
  if (movie.id !== movieId) throw new CatalogImportFailure(stage, 'identity-mismatch');
  return movie;
}

async function fetchTmdbJson(
  url: string,
  token: string,
  stage: ConstructorParameters<typeof CatalogImportFailure>[0],
): Promise<Record<string, any>> {
  const response = await fetchImportResponse(url, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  }, stage);

  const data = await readImportJson(response, stage);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new CatalogImportFailure(stage, 'invalid-response', response.status);
  }

  return data as Record<string, any>;
}

async function fetchImportResponse(
  url: string,
  init: RequestInit,
  stage: ConstructorParameters<typeof CatalogImportFailure>[0],
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw transportFailure(error, stage);
  }
  if (!response.ok) {
    try { await response.body?.cancel(); } catch { /* Keep the known HTTP failure. */ }
    throw new CatalogImportFailure(stage, 'http-error', response.status);
  }
  return response;
}

async function readImportJson(response: Response, stage: ConstructorParameters<typeof CatalogImportFailure>[0]) {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw new CatalogImportFailure(stage, 'invalid-json', response.status);
    throw transportFailure(error, stage, response.status);
  }
}

function transportFailure(
  error: unknown,
  stage: ConstructorParameters<typeof CatalogImportFailure>[0],
  httpStatus: number | null = null,
) {
  const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
  return new CatalogImportFailure(stage, timeout ? 'timeout' : 'network-error', httpStatus);
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
        // Other in-flight workers may fail later; retain the first failure.
        if (!failed) {
          failed = true;
          failure = error;
        }
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
