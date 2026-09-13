import assert from 'node:assert/strict';

// Exercise the handlers registered by the real deployment entrypoints, over
// local HTTP. Provider/Data API responses and environment configuration are
// fixtures; no hosted keys or data are read. The optional packet URL exercises
// only the packaged catalog handler with npm/remote imports disabled.
const catalogPacket = Deno.args[0];
type Handler = (request: Request) => Response | Promise<Response>;
const handlers = new Map<string, Handler>();
const realServe = Deno.serve;
const realGetEnv = Deno.env.get;
const realFetch = globalThis.fetch;
let registering = '';
let environment: Record<string, string | undefined> = {};
Deno.env.get = (name) => environment[name];
Deno.serve = ((handler: Handler) => {
  assert.equal(typeof handler, 'function');
  handlers.set(registering, handler);
  return {};
}) as typeof Deno.serve;
try {
  registering = 'catalog-import';
  if (catalogPacket) {
    await import(new URL('catalog-import/index.ts', catalogPacket).href);
  } else {
    await import('./catalog-import/index.ts');
    registering = 'password-auth';
    await import('./password-auth/index.ts');
    registering = 'auth-callback';
    await import('./auth-callback/index.ts');
  }
} finally {
  Deno.serve = realServe;
  Deno.env.get = realGetEnv;
}

// Deliberately synthetic credentials, generated only from public fixture text.
const modern = 'sb_secret_catalog_fixture';
const rotated = 'sb_secret_rotated_fixture';
const publishable = 'sb_publishable_fixture';
function fixtureJwt(role: string): string {
  const encode = (value: string) =>
    btoa(value).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode('{"alg":"HS256"}')}.${encode(JSON.stringify({ role }))}.fixture`;
}
const legacy = fixtureJwt('service_role');
const ordinaryUser = fixtureJwt('authenticated');
const providerToken = 'tmdb-fixture-token';
const defaultEnvironment = {
  SUPABASE_URL: 'https://catalog.test',
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: modern, rotation: rotated }),
  SUPABASE_SERVICE_ROLE_KEY: legacy,
  SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: publishable }),
  TMDB_READ_ACCESS_TOKEN: providerToken,
};

interface Fixture {
  outgoing: Request[];
  logs: string[];
  upstream: (request: Request) => Response | Promise<Response>;
  request: (body: unknown, headers?: HeadersInit, method?: string) => Promise<Response>;
}

async function withEdge(
  run: (fixture: Fixture) => Promise<void>,
  overrides: Record<string, string | undefined> = {},
  entrypoint = 'catalog-import',
): Promise<void> {
  environment = { ...defaultEnvironment, ...overrides };
  Deno.env.get = (name) => environment[name];
  const realError = console.error;
  const handler = handlers.get(entrypoint);
  assert.ok(handler, `Entrypoint ${entrypoint} must register a handler`);
  const server = realServe({ hostname: '127.0.0.1', port: 0, onListen() {} }, handler);
  const baseUrl = `http://127.0.0.1:${server.addr.port}`;
  const fixture: Fixture = {
    outgoing: [],
    logs: [],
    upstream: (request) => {
      const url = new URL(request.url);
      if (url.hostname === 'api.themoviedb.org') {
        assert.equal(request.headers.get('authorization'), `Bearer ${providerToken}`);
        assert.equal(request.headers.get('apikey'), null);
        if (url.pathname === '/3/discover/movie') {
          return Response.json({ page: Number(url.searchParams.get('page')), results: [{ id: 1 }] });
        }
        assert.equal(url.pathname, '/3/movie/1');
        const english = url.searchParams.get('language') === 'en-US';
        return Response.json({
          id: 1,
          title: english ? 'Fixture movie' : 'Testielokuva',
          overview: english ? 'English fallback description' : '',
          poster_path: '/fixture.jpg',
          release_date: '2001-01-01',
          genres: [{ id: 18, name: 'Drama' }],
          original_language: 'en',
          adult: false,
          video: false,
          runtime: 120,
          popularity: 50,
          vote_count: 100,
          credits: { crew: [{ job: 'Director', name: 'Fixture Director' }] },
          external_ids: { imdb_id: 'tt0000001' },
        });
      }
      assert.equal(url.hostname, 'catalog.test');
      assert.equal(url.pathname, '/rest/v1/rpc/upsert_catalog_batch_v1');
      return Response.json([{ input_index: 1, item_id: 'fixture-item' }]);
    },
    request: (body, headers = { apikey: modern }, method = 'POST') =>
      realFetch(baseUrl, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body),
        redirect: 'manual',
      }),
  };
  console.error = (...args: unknown[]) => fixture.logs.push(args.map(String).join(' '));
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    fixture.outgoing.push(request.clone());
    return await fixture.upstream(request);
  };
  try {
    await run(fixture);
  } finally {
    await server.shutdown();
    globalThis.fetch = realFetch;
    Deno.env.get = realGetEnv;
    console.error = realError;
    environment = {};
  }
}

async function expectError(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { status: 'error', code });
}

Deno.test('catalog rejects anonymous, user, publishable, foreign and misplaced modern keys before I/O', async () => {
  await withEdge(async (f) => {
    const rejected: HeadersInit[] = [
      {},
      { apikey: publishable },
      { authorization: `Bearer ${ordinaryUser}` },
      { apikey: publishable, authorization: `Bearer ${ordinaryUser}` },
      { apikey: fixtureJwt('anon') },
      { apikey: 'sb_secret_foreign_fixture' },
      { apikey: `${modern}x` },
      { authorization: `Bearer ${modern}` },
      { authorization: `Bearer ${fixtureJwt('service_role')}forged` },
    ];
    for (const headers of rejected) {
      // An invalid body confirms credentials are checked before body handling.
      await expectError(await f.request(null, headers), 403, 'forbidden');
    }
    assert.equal(f.outgoing.length, 0);
    assert.deepEqual(f.logs, []);
  });
});

Deno.test('modern apikey imports normalized FI/EN data through the privileged Data API RPC', async () => {
  await withEdge(async (f) => {
    const response = await f.request({ action: 'tmdb-movies' }, {
      apikey: modern,
      authorization: `Bearer ${ordinaryUser}`,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'imported',
      provider: 'tmdb',
      importedCount: 1,
      skippedCount: 0,
      pages: [1],
      language: 'fi-FI',
      region: 'FI',
      minimumVoteCount: 40,
    });
    assert.equal(f.outgoing.length, 4);
    const discover = new URL(f.outgoing[0].url);
    assert.equal(discover.searchParams.get('page'), '1');
    assert.equal(discover.searchParams.get('include_adult'), 'false');
    assert.equal(discover.searchParams.get('vote_count.gte'), '40');
    const rpc = f.outgoing[3];
    assert.equal(rpc.method, 'POST');
    assert.equal(rpc.headers.get('apikey'), modern);
    assert.equal(rpc.headers.get('authorization'), null);
    assert.equal(rpc.redirect, 'error');
    assert.match(rpc.headers.get('content-type') ?? '', /^application\/json/);
    const { entries } = await rpc.json();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].providerKey, 'tmdb');
    assert.equal(entries[0].title, 'Testielokuva');
    assert.equal(entries[0].description, 'English fallback description');
    assert.deepEqual(entries[0].externalIds, { tmdb_movie: '1', imdb_title: 'tt0000001' });
    assert.equal(entries[0].imageUrl, 'https://image.tmdb.org/t/p/w500/fixture.jpg');
  });
});

Deno.test('each named rotation key is accepted and the matched key scopes the RPC', async () => {
  await withEdge(async (f) => {
    const response = await f.request({ action: 'tmdb-movies' }, { apikey: rotated });
    assert.equal(response.status, 200);
    await response.json();
    assert.equal(f.outgoing.at(-1)?.headers.get('apikey'), rotated);
  });
});

Deno.test('singular local modern key works without any legacy key', async () => {
  await withEdge(async (f) => {
    const response = await f.request({ action: 'tmdb-movies' });
    assert.equal(response.status, 200);
    await response.json();
  }, {
    SUPABASE_SECRET_KEYS: undefined,
    SUPABASE_SECRET_KEY: modern,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
  });
});

Deno.test('exact legacy apikey or Bearer remains valid while modern keys are configured', async () => {
  await withEdge(async (f) => {
    const accepted: HeadersInit[] = [{ apikey: legacy }, { authorization: `bearer ${legacy}` }];
    for (const headers of accepted) {
      const response = await f.request({ action: 'tmdb-movies' }, headers);
      assert.equal(response.status, 200);
      await response.json();
      assert.equal(f.outgoing.at(-1)?.headers.get('apikey'), legacy);
      assert.equal(f.outgoing.at(-1)?.headers.get('authorization'), `Bearer ${legacy}`);
    }
  });
});

Deno.test('legacy-only configuration works; removing a configured key immediately denies it', async () => {
  await withEdge(async (f) => {
    const response = await f.request({ action: 'tmdb-movies' }, {
      authorization: `Bearer ${legacy}`,
    });
    assert.equal(response.status, 200);
    await response.json();
    environment.SUPABASE_SECRET_KEYS = JSON.stringify({ default: rotated });
    environment.SUPABASE_SERVICE_ROLE_KEY = undefined;
    f.outgoing.length = 0;
    await expectError(await f.request(null, { apikey: legacy }), 403, 'forbidden');
    await expectError(await f.request(null, { apikey: modern }), 403, 'forbidden');
    assert.equal(f.outgoing.length, 0);
  }, { SUPABASE_SECRET_KEYS: undefined });
});

Deno.test('valid modern keys work independently of malformed optional legacy credentials', async () => {
  for (const invalidLegacy of ['not-a-service-jwt', 'sb_secret_legacy_only_fixture']) {
    for (const modernKeys of [
      { SUPABASE_SECRET_KEYS: JSON.stringify({ default: modern, rotation: rotated }) },
      { SUPABASE_SECRET_KEYS: undefined, SUPABASE_SECRET_KEY: modern },
    ]) {
      await withEdge(async (f) => {
        const rejected: HeadersInit[] = [
          {},
          { apikey: invalidLegacy },
          { authorization: `Bearer ${invalidLegacy}` },
          { apikey: publishable, authorization: `Bearer ${ordinaryUser}` },
          { apikey: legacy },
          { authorization: `Bearer ${modern}` },
          { apikey: 'sb_secret_foreign_fixture' },
        ];
        for (const headers of rejected) {
          await expectError(await f.request(null, headers), 403, 'forbidden');
        }
        assert.equal(f.outgoing.length, 0);
        const accepted = modernKeys.SUPABASE_SECRET_KEYS ? [modern, rotated] : [modern];
        for (const key of accepted) {
          const response = await f.request({ action: 'tmdb-movies' }, {
            apikey: key,
            authorization: `Bearer ${invalidLegacy}`,
          });
          assert.equal(response.status, 200);
          assert.equal((await response.json()).importedCount, 1);
          const rpc = f.outgoing.at(-1);
          assert.equal(rpc?.headers.get('apikey'), key);
          assert.equal(rpc?.headers.get('authorization'), null);
        }
        assert.equal(f.outgoing.length, accepted.length * 4);
        assert.deepEqual(f.logs, []);
      }, { ...modernKeys, SUPABASE_SERVICE_ROLE_KEY: invalidLegacy });
    }
  }
});

Deno.test('missing or malformed server configuration fails closed before provider access', async () => {
  const cases: [Record<string, string | undefined>, string][] = [
    [{ SUPABASE_URL: undefined }, 'missing-supabase-url'],
    [{ SUPABASE_SECRET_KEYS: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, 'missing-server-key'],
    [{ SUPABASE_SECRET_KEYS: '{}', SUPABASE_SERVICE_ROLE_KEY: undefined }, 'missing-server-key'],
    [{ SUPABASE_SECRET_KEYS: `{${modern}` }, 'invalid-secret-keys-json'],
    ...['null', '[]', '"string"'].map((SUPABASE_SECRET_KEYS): [Record<string, string>, string] => [
      { SUPABASE_SECRET_KEYS }, 'invalid-secret-keys-object',
    ]),
    ...['{"default":42}', `{"default":"${publishable}"}`,
      JSON.stringify({ default: modern, sensitive_fixture_name: `${modern}!${providerToken}` })]
      .map((SUPABASE_SECRET_KEYS): [Record<string, string>, string] => [
        { SUPABASE_SECRET_KEYS }, 'invalid-secret-keys-value',
      ]),
    [{ SUPABASE_SECRET_KEY: publishable }, 'invalid-local-secret-key'],
    ...[undefined, '{}'].map((SUPABASE_SECRET_KEYS): [Record<string, string | undefined>, string] => [
      { SUPABASE_SECRET_KEYS, SUPABASE_SERVICE_ROLE_KEY: `not-a-service-jwt:${legacy}` },
      'invalid-legacy-service-role-key',
    ]),
  ];
  for (const [overrides, reason] of cases) {
    await withEdge(async (f) => {
      await expectError(await f.request(null), 500, 'server-not-configured');
      assert.equal(f.outgoing.length, 0);
      // Exact output excludes environment values, arbitrary key names and the
      // JSON parser's potentially sensitive error text. HTTP stays generic.
      assert.deepEqual(f.logs, [`catalog-import configuration failed: ${reason}`]);
    }, overrides);
  }
});

Deno.test('server key read failures never reflect environment error details', async () => {
  await withEdge(async (f) => {
    const read = Deno.env.get;
    Deno.env.get = (name) => {
      if (name === 'SUPABASE_SECRET_KEY') throw new Error(`${modern} ${providerToken}`);
      return read(name);
    };
    await expectError(await f.request(null), 500, 'server-not-configured');
    assert.equal(f.outgoing.length, 0);
    assert.deepEqual(f.logs, [
      'catalog-import configuration failed: unreadable-server-key-configuration',
    ]);
  });
});

Deno.test('catalog validates method, JSON object and action', async () => {
  await withEdge(async (f) => {
    await expectError(await f.request(null, {}, 'GET'), 405, 'method-not-allowed');
    await expectError(await f.request(undefined), 400, 'invalid-json');
    for (const body of [null, [], 'string', 1, true]) {
      await expectError(await f.request(body), 400, 'invalid-request');
    }
    await expectError(await f.request({ action: 'other' }), 400, 'unsupported-action');
    assert.equal(f.outgoing.length, 0);
  });
});

Deno.test('catalog rejects invalid explicit parameters and ranges beyond TMDB page 500', async () => {
  await withEdge(async (f) => {
    for (
      const parameters of [
        { pages: 4 },
        { pages: 0 },
        { pages: 1.5 },
        { pages: '1' },
        { pages: true },
        { startPage: 0 },
        { startPage: 501 },
        { startPage: null },
        { startPage: 500, pages: 2 },
        { startPage: 499, pages: 3 },
        { minimumVoteCount: -1 },
        { minimumVoteCount: 1000001 },
        { language: 'fi' },
        { language: 1 },
        { region: 'FIN' },
        { region: null },
      ]
    ) {
      await expectError(
        await f.request({ action: 'tmdb-movies', ...parameters }),
        400,
        'invalid-request',
      );
    }
    assert.equal(f.outgoing.length, 0);
  });
});

Deno.test('maximum bounded page range returns exact completed pages', async () => {
  await withEdge(async (f) => {
    const response = await f.request({
      action: 'tmdb-movies',
      startPage: 498,
      pages: 3,
      region: 'se',
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.pages, [498, 499, 500]);
    assert.equal(body.importedCount, 3);
    assert.equal(body.region, 'SE');
    assert.equal(f.outgoing.filter((request) => request.url.includes('/discover/movie')).length, 3);
  });
});

Deno.test('missing TMDB configuration returns actionable error without network work', async () => {
  await withEdge(async (f) => {
    await expectError(await f.request({ action: 'tmdb-movies' }), 503, 'tmdb-not-configured');
    assert.equal(f.outgoing.length, 0);
  }, { TMDB_READ_ACCESS_TOKEN: undefined });
});

Deno.test('upstream failures stop import and cannot reflect credentials into logs or responses', async () => {
  for (const failure of ['provider', 'database']) {
    await withEdge(async (f) => {
      const normal = f.upstream;
      f.upstream = (request) => {
        if (failure === 'provider' || new URL(request.url).hostname === 'catalog.test') {
          return Response.json({ message: `${modern} ${providerToken}` }, { status: 500 });
        }
        return normal(request);
      };
      await expectError(
        await f.request({ action: 'tmdb-movies', pages: 3 }),
        502,
        'provider-import-failed',
      );
      assert.equal(f.outgoing.length, failure === 'provider' ? 1 : 4);
      assert.deepEqual(f.logs, ['catalog-import failed: provider-import-failed']);
    });
  }
});

Deno.test('incomplete or malformed Data API success never reports a completed import', async () => {
  for (const payload of [null, {}, [], [{ input_index: 2, item_id: 'fixture-item' }],
    [{ input_index: 1, item_id: null }]]) {
    await withEdge(async (f) => {
      const normal = f.upstream;
      f.upstream = (request) => new URL(request.url).hostname === 'catalog.test'
        ? Response.json(payload)
        : normal(request);
      await expectError(
        await f.request({ action: 'tmdb-movies', pages: 3 }),
        502,
        'provider-import-failed',
      );
      assert.equal(f.outgoing.length, 4);
    });
  }
});

Deno.test('versioned catalog selections reject unknown, mixed and unbounded controls before I/O', async () => {
  await withEdge(async (f) => {
    const base = { action: 'tmdb-movie-bucket-v1', bucket: 'finnish', asOf: '2026-09-13' };
    for (const body of [
      { ...base, bucket: 'unknown' }, { ...base, asOf: undefined },
      { ...base, asOf: '9999-01-01' }, { ...base, asOf: '2026-02-30' },
      { ...base, startPage: 3, pages: 2 }, { ...base, minimumVoteCount: 0 },
      { action: 'tmdb-movies', bucket: 'finnish' },
      ...[[], ['tt0000001', 'tt0000001'], ['1'], [1], Array(11).fill('tt0000001')].map((imdbIds) => ({
        action: 'tmdb-movies-by-imdb-v1', imdbIds, asOf: '2026-09-13',
      })),
      { action: 'tmdb-movies-by-imdb-v1', imdbIds: ['tt0000001'], asOf: '2026-09-13', pages: 1 },
    ]) await expectError(await f.request(body), 400, 'invalid-request');
    assert.equal(f.outgoing.length, 0);
  });
});

Deno.test('catalog buckets bind primary dates, original language and genre independently of FI localization', async () => {
  const cases = [
    { bucket: 'finnish', filter: 'with_original_language', value: 'fi', changes: { original_language: 'fi' }, votes: '10' },
    { bucket: 'classics', filter: 'primary_release_date.lte', value: '1989-12-31', changes: { release_date: '1984-01-01' }, votes: '40' },
    { bucket: 'animation', filter: 'with_genres', value: '16', changes: { genres: [{ id: 16, name: 'Animation' }] }, votes: '40' },
  ];
  for (const { bucket, filter, value, changes, votes } of cases) {
    await withEdge(async (f) => {
      const normal = f.upstream;
      f.upstream = async (request) => {
        const response = await normal(request);
        return new URL(request.url).pathname === '/3/movie/1'
          ? Response.json({ ...await response.json(), ...changes }) : response;
      };
      const response = await f.request({ action: 'tmdb-movie-bucket-v1', bucket, asOf: '2026-09-13' });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.importedCount, 1);
      assert.equal(result.action, 'tmdb-movie-bucket-v1');
      assert.equal(result.bucket, bucket);
      assert.equal(result.asOf, '2026-09-13');
      const url = new URL(f.outgoing[0].url);
      assert.equal(url.searchParams.get(filter), value);
      assert.equal(url.searchParams.get('language'), 'fi-FI');
      assert.equal(url.searchParams.get('region'), 'FI');
      assert.equal(url.searchParams.get('vote_count.gte'), votes);
      assert.equal(url.searchParams.get('release_date.lte'), '2026-09-13');
      assert.equal(f.outgoing[0].redirect, 'error');
    });
  }
});

Deno.test('bucket admission counts sparse, unreleased and off-filter details without overwriting Items', async () => {
  for (const changes of [
    { poster_path: null }, { overview: '' }, { runtime: 0 }, { vote_count: 1 },
    { release_date: '2027-01-01' }, { release_date: '2001-02-30' },
    { original_language: 'fi' }, { adult: true }, { credits: {} },
  ]) {
    await withEdge(async (f) => {
      const normal = f.upstream;
      f.upstream = async (request) => {
        const response = await normal(request);
        return new URL(request.url).pathname === '/3/movie/1'
          ? Response.json({ ...await response.json(), original_language: 'fr', ...changes }) : response;
      };
      const response = await f.request({ action: 'tmdb-movie-bucket-v1', bucket: 'language-fr', asOf: '2026-09-13' });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.importedCount, 0);
      assert.equal(result.skippedCount, 1);
      assert.ok(f.outgoing.every((request) => new URL(request.url).hostname === 'api.themoviedb.org'));
    });
  }
});

Deno.test('malformed or mismatched provider pages and detail identities stop before writes', async () => {
  for (const payload of [{}, { results: {} }, { page: 2, results: [] },
    { page: 1, results: Array(21).fill({ id: 1 }) }, { page: 1, results: [{ id: '1' }] }]) {
    await withEdge(async (f) => {
      f.upstream = () => Response.json(payload);
      await expectError(await f.request({ action: 'tmdb-movie-bucket-v1', bucket: '2000s', asOf: '2026-09-13' }), 502, 'provider-import-failed');
      assert.equal(f.outgoing.length, 1);
    });
  }
  await withEdge(async (f) => {
    const normal = f.upstream;
    f.upstream = (request) => new URL(request.url).pathname === '/3/movie/1'
      ? Response.json({ id: 2 }) : normal(request);
    await expectError(await f.request({ action: 'tmdb-movies' }), 502, 'provider-import-failed');
    assert.equal(f.outgoing.length, 2);
  });
});

Deno.test('IMDb enrichment verifies each exact movie alias then uses one atomic canonical batch', async () => {
  await withEdge(async (f) => {
    const normal = f.upstream;
    f.upstream = async (request) => {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/3/find/')) {
        assert.equal(url.searchParams.get('external_source'), 'imdb_id');
        return Response.json({ movie_results: [{ id: Number(url.pathname.slice(-1)) }] });
      }
      if (url.pathname.startsWith('/3/movie/')) {
        const id = Number(url.pathname.slice(-1));
        const fixtureUrl = new URL(request.url);
        fixtureUrl.pathname = '/3/movie/1';
        const fixture = await (await normal(new Request(fixtureUrl, request))).json();
        return Response.json({ ...fixture, id, external_ids: { imdb_id: `tt000000${id}` } });
      }
      const { entries } = await request.json();
      assert.deepEqual(entries.map((entry: { externalIds: unknown }) => entry.externalIds), [
        { tmdb_movie: '1', imdb_title: 'tt0000001' }, { tmdb_movie: '2', imdb_title: 'tt0000002' },
      ]);
      return Response.json(entries.map((_: unknown, index: number) => ({ input_index: index + 1, item_id: `existing-${index}` })));
    };
    const response = await f.request({
      action: 'tmdb-movies-by-imdb-v1', imdbIds: ['tt0000001', 'tt0000002'], asOf: '2026-09-13',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'imported', provider: 'tmdb', action: 'tmdb-movies-by-imdb-v1',
      importedCount: 2, skippedCount: 0, imdbIds: ['tt0000001', 'tt0000002'],
      language: 'fi-FI', asOf: '2026-09-13',
    });
    assert.equal(f.outgoing.filter((request) => new URL(request.url).hostname === 'catalog.test').length, 1);
    assert.ok(f.outgoing.every((request) => !request.url.includes('/discover/') && !request.url.includes('/search/')));
  });
});

Deno.test('missing, ambiguous, conflicting or sparse IMDb results cannot write catalog entries', async () => {
  for (const failure of ['missing', 'ambiguous', 'alias', 'metadata']) {
    await withEdge(async (f) => {
      const normal = f.upstream;
      f.upstream = async (request) => {
        const url = new URL(request.url);
        if (url.pathname.startsWith('/3/find/')) return Response.json({ movie_results:
          failure === 'missing' ? [] : failure === 'ambiguous' ? [{ id: 1 }, { id: 2 }] : [{ id: 1 }],
        });
        const response = await normal(request);
        return Response.json({ ...await response.json(), ...(failure === 'alias'
          ? { external_ids: { imdb_id: 'tt9999999' } } : { poster_path: null }) });
      };
      await expectError(await f.request({ action: 'tmdb-movies-by-imdb-v1', imdbIds: ['tt0000001'], asOf: '2026-09-13' }), 502, 'provider-import-failed');
      assert.ok(f.outgoing.every((request) => new URL(request.url).hostname === 'api.themoviedb.org'));
    });
  }
});

if (!catalogPacket) {
  Deno.test('password-auth entrypoint uses the pinned SDK for existing server-side resolution', async () => {
    await withEdge(
      async (f) => {
        f.upstream = (request) => {
          assert.equal(request.url, 'https://catalog.test/rest/v1/rpc/resolve_login_email');
          assert.equal(request.headers.get('apikey'), modern);
          return Response.json('fixture@example.invalid');
        };
        const response = await f.request({ action: 'account-exists', identifier: 'Fixture' }, {});
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'exists' });
        assert.deepEqual(await f.outgoing[0].json(), { input_identifier: 'fixture' });
      },
      {},
      'password-auth',
    );
  });

  Deno.test('auth-callback entrypoint rejects an invalid link without outbound work', async () => {
    await withEdge(
      async (f) => {
        const response = await f.request(null, {}, 'GET');
        assert.equal(response.status, 400);
        assert.equal(await response.text(), 'Invalid Kajo authentication link');
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(f.outgoing.length, 0);
      },
      {},
      'auth-callback',
    );
  });
}
