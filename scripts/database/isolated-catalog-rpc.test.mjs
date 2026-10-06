import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { requestIsolatedCatalogRpc } from './ci-supabase-stack.mjs';

const readKey = 'synthetic-service-role-key';
const rpcKey = 'synthetic-anonymous-rpc-key';
const options = { apiUrl: 'http://localhost:54321', readKey, rpcKey,
  body: { entries: [], refresh_mode: 'open-library-description-v1' }, stage: 'reset-10-rpc-1',
  waitImpl: async () => {} };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const transportError = code => new TypeError('fetch failed synthetic-secret', { cause: { code } });

test('RPC readiness rejects nonlocal, credential-bearing and malformed destinations before fetching', async () => {
  for (const apiUrl of ['https://127.0.0.1:54321', 'http://remote.invalid', 'http://127.0.0.1.remote.invalid',
    'http://secret@localhost:54321', 'http://localhost:54321?key=secret', 'http://localhost:54321/path', 'invalid']) {
    let requests = 0;
    await assert.rejects(requestIsolatedCatalogRpc({ ...options, apiUrl,
      fetchImpl: async () => { requests++; } }), /isolated|localhost/);
    assert.equal(requests, 0);
  }
});

test('transient readiness transport failures recover before one RPC', async () => {
  for (const code of ['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_SOCKET',
    'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'TimeoutError']) {
    const calls = [];
    const result = await requestIsolatedCatalogRpc({ ...options, fetchImpl: async (url, init) => {
      calls.push(init.method);
      if (calls.length === 1) throw code === 'TimeoutError' ? new DOMException('synthetic-secret', code) : transportError(code);
      return init.method === 'GET' ? json([]) : json({ code: 'PGRST202' }, 404);
    } });
    assert.deepEqual(calls, ['GET', 'GET', 'POST']);
    assert.deepEqual(result, { status: 404, body: { code: 'PGRST202' } });
  }
});

test('readiness gateway failures are bounded and cancelled before recovery', async () => {
  for (const status of [502, 503, 504]) {
    let gets = 0, posts = 0, cancelled = 0;
    await requestIsolatedCatalogRpc({ ...options, fetchImpl: async (url, init) => {
      if (init.method === 'POST') { posts++; return json({}); }
      if (++gets === 1) return { status, body: { cancel: async () => { cancelled++; } } };
      return json([]);
    } });
    assert.equal(gets, 2);
    assert.equal(posts, 1);
    assert.equal(cancelled, 1);
  }
});

test('persistent readiness failure exhausts twenty reads without any POST', async () => {
  for (const failure of ['transport', 'gateway']) {
    let gets = 0, posts = 0, waits = 0;
    await assert.rejects(requestIsolatedCatalogRpc({ ...options, waitImpl: async milliseconds => {
      assert.equal(milliseconds, 500); waits++;
    }, fetchImpl: async (url, init) => {
      if (init.method === 'POST') posts++;
      gets++;
      if (failure === 'transport') throw transportError('ECONNREFUSED');
      return new Response('', { status: 503 });
    } }), /readiness failed \(20 attempts exhausted; (ECONNREFUSED|HTTP 503)\)/);
    assert.equal(gets, 20); assert.equal(posts, 0); assert.equal(waits, 19);
  }
});

test('permission, schema and invalid readiness results fail immediately', async () => {
  const responses = [json({}, 401), json({}, 403), json({}, 404), json({}, 500),
    new Response('invalid synthetic-secret'), json({}), json(null), json([{ id: 'unexpected' }])];
  for (const response of responses) {
    let requests = 0;
    await assert.rejects(requestIsolatedCatalogRpc({ ...options, fetchImpl: async () => {
      requests++; return response;
    } }), /readiness failed/);
    assert.equal(requests, 1);
  }
});

test('unknown transport errors expose only the safe phase and never credentials', async () => {
  let requests = 0;
  await assert.rejects(requestIsolatedCatalogRpc({ ...options, fetchImpl: async () => {
    requests++; throw new Error('Isolated catalog RPC reset-10-rpc-1: synthetic-secret');
  } }), error => {
    assert.match(error.message, /reset-10-rpc-1: readiness failed \(unknown transport error\)/);
    assert.ok(!error.message.includes('synthetic-secret'));
    return true;
  });
  assert.equal(requests, 1);
});

test('readiness response-body disconnects retry the read only', async () => {
  const methods = [];
  await requestIsolatedCatalogRpc({ ...options, fetchImpl: async (url, init) => {
    methods.push(init.method);
    if (methods.length === 1) return { status: 200, json: async () => { throw transportError('ECONNRESET'); } };
    return init.method === 'GET' ? json([]) : json({});
  } });
  assert.deepEqual(methods, ['GET', 'GET', 'POST']);
});

test('the authenticated read and original RPC retain separate keys, deadlines and error semantics', async () => {
  for (const status of [200, 400, 401, 403, 404]) {
    const calls = [];
    const result = await requestIsolatedCatalogRpc({ ...options, fetchImpl: async (url, init) => {
      calls.push({ url, init });
      assert.equal(url.hostname, '127.0.0.1');
      assert.equal(init.redirect, 'error');
      assert.equal(init.headers.Connection, 'close');
      assert.ok(init.signal instanceof AbortSignal);
      assert.equal(init.signal.aborted, false);
      return init.method === 'GET' ? json([]) : json({ code: 'expected' }, status);
    } });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.pathname, '/rest/v1/items');
    assert.equal(calls[0].url.search, '?select=id&limit=0');
    assert.equal(calls[0].init.headers.apikey, readKey);
    assert.equal(calls[0].init.body, undefined);
    assert.equal(calls[1].url.pathname, '/rest/v1/rpc/upsert_catalog_batch_v1');
    assert.equal(calls[1].init.headers.apikey, rpcKey);
    assert.equal(calls[1].init.body, JSON.stringify(options.body));
    assert.deepEqual(result, { status, body: { code: 'expected' } });
  }
});

test('a lost RPC or malformed RPC body is never replayed', async () => {
  for (const phase of ['fetch', 'body', 'invalid-json']) {
    const calls = [];
    await assert.rejects(requestIsolatedCatalogRpc({ ...options, fetchImpl: async (url, init) => {
      calls.push(init.method);
      if (init.method === 'GET') return json([]);
      if (phase === 'fetch') throw transportError('UND_ERR_SOCKET');
      if (phase === 'body') return { status: 200, json: async () => { throw transportError('ECONNRESET'); } };
      return new Response('invalid synthetic-secret');
    } }), error => {
      assert.match(error.message, /reset-10-rpc-1: POST failed .*POST not retried/);
      assert.ok(!error.message.includes('synthetic-secret'));
      return true;
    });
    assert.deepEqual(calls, ['GET', 'POST']);
  }
});

test('real loopback HTTP recovers a disconnected read and sends the RPC once without pooled sockets', async () => {
  let reads = 0, posts = 0;
  const server = createServer((request, response) => {
    assert.equal(request.headers.connection, 'close');
    if (request.method === 'GET') {
      reads++;
      if (reads === 1) return request.socket.destroy();
      response.end('[]');
    } else {
      posts++;
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end('{"code":"22023"}');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await requestIsolatedCatalogRpc({ ...options, apiUrl: `http://localhost:${server.address().port}` });
    assert.deepEqual(result, { status: 400, body: { code: '22023' } });
    assert.equal(reads, 2); assert.equal(posts, 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('real readiness body timeout recovers even when Undici reports AbortError', async () => {
  let reads = 0, posts = 0;
  const server = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    if (request.method === 'GET') {
      if (++reads === 1) return response.write('['); // Headers arrive; body never completes.
      response.end('[]');
    } else { posts++; response.end('{}'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await requestIsolatedCatalogRpc({ ...options, apiUrl: `http://localhost:${server.address().port}` });
    assert.deepEqual(result, { status: 200, body: {} });
    assert.equal(reads, 2); assert.equal(posts, 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
