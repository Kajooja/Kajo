import { createClient } from 'npm:@supabase/supabase-js@2';

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
  const secretKey =
    readNamedKey('SUPABASE_SECRET_KEYS') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !secretKey) {
    return json({ status: 'error', code: 'server-not-configured' }, 500);
  }

  // This function is deliberately deployed with gateway JWT verification disabled:
  // modern Supabase secret keys are not JWTs. The function itself only accepts the
  // server-side project secret and never exposes provider credentials to clients.
  if (request.headers.get('authorization') !== `Bearer ${secretKey}`) {
    return json({ status: 'error', code: 'forbidden' }, 403);
  }

  let body: ImportRequest;
  try {
    body = await request.json();
  } catch {
    return json({ status: 'error', code: 'invalid-json' }, 400);
  }

  if (body.action !== 'tmdb-movies') {
    return json({ status: 'error', code: 'unsupported-action' }, 400);
  }

  const tmdbToken = Deno.env.get('TMDB_READ_ACCESS_TOKEN');
  if (!tmdbToken) {
    return json({ status: 'error', code: 'tmdb-not-configured' }, 503);
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
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
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
  } catch (error) {
    console.error('catalog-import failed', safeErrorMessage(error));
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
): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
}

function normalizeLocale(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return /^[a-z]{2}-[A-Z]{2}$/.test(normalized) ? normalized : fallback;
}

function normalizeRegion(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : fallback;
}

function readNamedKey(variableName: string): string | null {
  const raw = Deno.env.get(variableName);
  if (!raw) return null;

  try {
    const keys = JSON.parse(raw) as Record<string, unknown>;
    const defaultKey = keys.default;
    if (typeof defaultKey === 'string' && defaultKey.length > 0) return defaultKey;
    const firstKey = Object.values(keys).find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    return firstKey ?? null;
  } catch {
    return null;
  }
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
