import { timingSafeEqual } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

import { normalizeTmdbMovie } from '../_shared/catalog-normalizers.mjs';

type ImportAction = 'tmdb-movies';

interface ImportRequest {
  action?: ImportAction;
  startPage?: number;
  pages?: number;
  language?: string;
  region?: string;
  minimumVoteCount?: number;
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
  if (body.action !== 'tmdb-movies') {
    return json({ status: 'error', code: 'unsupported-action' }, 400);
  }

  const startPage = boundedInteger(body.startPage, 1, 500, 1);
  const pages = boundedInteger(body.pages, 1, MAX_PAGES_PER_REQUEST, 1);
  const minimumVoteCount = boundedInteger(
    body.minimumVoteCount,
    0,
    1000000,
    DEFAULT_MINIMUM_VOTE_COUNT,
  );
  const language = normalizeLocale(body.language, DEFAULT_LANGUAGE);
  const region = normalizeRegion(body.region, DEFAULT_REGION);
  if (
    startPage === null || pages === null || minimumVoteCount === null ||
    language === null || region === null || startPage + pages - 1 > 500
  ) {
    return json({ status: 'error', code: 'invalid-request' }, 400);
  }

  const tmdbToken = Deno.env.get('TMDB_READ_ACCESS_TOKEN');
  if (!tmdbToken) {
    return json({ status: 'error', code: 'tmdb-not-configured' }, 503);
  }

  try {
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
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
        }),
        tmdbToken,
      );
      const results = Array.isArray(discovery?.results) ? discovery.results : [];
      const details = await mapWithConcurrency(
        results,
        TMDB_DETAIL_CONCURRENCY,
        async (movie) => {
          const movieId = Number(movie?.id);
          if (!Number.isInteger(movieId) || movieId <= 0) return null;
          return fetchLocalizedMovie(movieId, language, tmdbToken);
        },
      );
      const entries = details
        .map((movie) => normalizeTmdbMovie(movie))
        .filter((entry) => entry !== null);

      skippedCount += results.length - entries.length;

      for (let offset = 0; offset < entries.length; offset += UPSERT_BATCH_SIZE) {
        const batch = entries.slice(offset, offset + UPSERT_BATCH_SIZE);
        const { data, error } = await adminClient.rpc('upsert_catalog_batch_v1', {
          entries: batch,
        });

        if (error) {
          throw new Error(`Catalog batch upsert failed: ${error.message}`);
        }

        importedCount += Array.isArray(data) ? data.length : batch.length;
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
    });
  } catch {
    // Upstream errors can contain reflected credentials or provider payloads.
    console.error('catalog-import failed: provider-import-failed');
    return json({ status: 'error', code: 'provider-import-failed' }, 502);
  }
});

function buildDiscoverUrl(input: {
  page: number;
  language: string;
  region: string;
  minimumVoteCount: number;
}): string {
  const url = new URL(`${TMDB_API_BASE_URL}/discover/movie`);
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('include_video', 'false');
  url.searchParams.set('language', input.language);
  url.searchParams.set('region', input.region);
  url.searchParams.set('page', String(input.page));
  url.searchParams.set('sort_by', 'popularity.desc');
  url.searchParams.set('vote_count.gte', String(input.minimumVoteCount));
  url.searchParams.set('release_date.lte', new Date().toISOString().slice(0, 10));
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
  return fetchTmdbJson(url.toString(), token);
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
  });

  if (!response.ok) {
    throw new Error(`TMDB request failed with ${response.status}`);
  }

  const data = await response.json();
  if (!data || typeof data !== 'object') {
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

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      output[index] = await mapper(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return output;
}

function hasUsefulLocalizedCopy(movie: Record<string, unknown>): boolean {
  return Boolean(usefulString(movie.title) && usefulString(movie.overview));
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
      const keys: unknown = JSON.parse(raw);
      if (!keys || typeof keys !== 'object' || Array.isArray(keys)) return null;
      for (const key of Object.values(keys)) {
        if (!isSecretKey(key)) return null;
        modern.push(key);
      }
    }
    // The CLI provisions a singular key in local development.
    const localKey = Deno.env.get('SUPABASE_SECRET_KEY');
    if (localKey) {
      if (!isSecretKey(localKey)) return null;
      modern.push(localKey);
    }
    const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || null;
    if (legacy && !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(legacy)) return null;
    return modern.length || legacy ? { modern, legacy } : null;
  } catch {
    return null;
  }
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
