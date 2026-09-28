import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import test from 'node:test';
import { curlAcquisitionTransport } from './acquire-open-library-dumps.mjs';
import { acquireEditionPrefixDiagnostic } from './acquire-edition-prefix-diagnostic.mjs';
import { recipientFingerprint, sealPayload, unsealPayload } from './seal-dump-acquisition.mjs';
import { validateConflictDumpAcquisitionRequest } from './seal-conflict-dump-acquisition.mjs';
import { EDITION_PREVIOUS_CONFLICT, EDITION_PREFIX_CORE_HEAD, EDITION_PREFIX_MAX_PLAINTEXT,
  constructEditionPrefixRequest, editionPrefixRange, validateEditionPrefixRequest, validateEditionPrefixHeaders,
  validateEditionPrefixPayload, validateEditionPrefixResult, sealEditionPrefixDiagnostic, unsealEditionPrefixDiagnostic } from './seal-edition-prefix-diagnostic.mjs';
import { previousConflict, fixture, header, rehash, responseHeaders, transportFor } from './fixtures/edition-prefix-fixture.mjs';

test('request binds the exact consumed conflict, original roster/pins/key and new explicit limits', () => {
  const { request } = fixture();
  assert.equal(previousConflict.requestSha256, EDITION_PREVIOUS_CONFLICT.requestSha256);
  assert.equal(validateEditionPrefixRequest(request), request); assert.equal(request.roster.length, 383);
  assert.equal(request.diagnosticSourceHead, EDITION_PREFIX_CORE_HEAD);
  assert.deepEqual(Object.keys(request.previousConflict).sort(), ['requestHead', 'requestSha256', 'runId', 'sourceHead']);
  for (const mutate of [r => { r.extra = 'PRIVATE'; }, r => { r.roster.pop(); }, r => { r.roster.reverse(); },
    r => { r.recipientPublicKey += 'x'; }, r => { r.sourcePins.editions.bytes++; }, r => { r.limits.maxRows++; },
    r => { r.conflictPolicy.maxConflictedPairs++; }, r => { r.previousConflict.runId = '1'; },
    r => { r.previousConflict.artifactId = 'PRIVATE'; }, r => { r.diagnosticSourceHead = '0'.repeat(40); },
    r => { r.purpose = 'retry'; }, r => { r.sourceHead = ['a'.repeat(40)]; }]) {
    const invalid = structuredClone(request); mutate(invalid); assert.throws(() => validateEditionPrefixRequest(rehash(invalid)));
  }
  assert.throws(() => validateConflictDumpAcquisitionRequest(request));
  assert.throws(() => constructEditionPrefixRequest({ previousConflict: rehash({ ...previousConflict, sourceHead: '0'.repeat(40) }),
    sourceHead: request.sourceHead, diagnosticLimits: request.diagnosticLimits }));
});

test('diagnostic caps have no defaults and cannot widen original line/resource bounds', () => {
  const { request } = fixture();
  for (const patch of [{}, { prefixBytes: 4097 }, { compressedBytes: 1024 ** 3 + 1 }, { maxDecodedBytes: 8 * 1024 ** 3 + 1 },
    { maxRows: 10000001 }, { timeoutMs: 1200001 }, { lineBytes: request.limits.lineBytes - 1 }, { prefixBytes: 0 }, { extra: 1 }]) {
    const limits = Object.keys(patch).length ? { ...request.diagnosticLimits, ...patch } : patch;
    assert.throws(() => validateEditionPrefixRequest(rehash({ ...request, diagnosticLimits: limits })));
  }
  const changed = rehash({ ...request, diagnosticLimits: { ...request.diagnosticLimits, prefixBytes: 64 } });
  assert.equal(validateEditionPrefixRequest(changed), changed); assert.notEqual(changed.requestSha256, request.requestSha256);
});

test('HTTP policy requires an exact single identity-encoded 206 range before decoding', () => {
  const { request } = fixture(), good = { status: 206, headers: responseHeaders(request) };
  assert.equal(validateEditionPrefixHeaders(good, request), true);
  for (const bad of [{ ...good, status: 200 }, { ...good, status: 416 }, ...[
    { 'content-range': good.headers['content-range'].replace('bytes 0-', 'bytes 1-') }, { 'content-length': '1' },
    { 'content-encoding': 'gzip' }, { 'transfer-encoding': 'chunked' }, { 'content-type': 'multipart/byteranges' },
    { 'content-type': ['application/gzip'] },
  ].map(patch => ({ status: 206, headers: { ...good.headers, ...patch } }))])
    assert.throws(() => validateEditionPrefixHeaders(bad, request), /edition-prefix-/);
});

test('actual curl framing rejects a bundled full response before it can reach the scanner', async () => {
  const { request } = fixture(); let killed = false, observed = 0;
  const transport = (url, options) => curlAcquisitionTransport(url, options, (_name, args) => {
    assert.ok(args.includes('--range')); assert.equal(args.includes('--location'), false);
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.kill = () => { killed = true; };
    queueMicrotask(() => child.stdout.write('HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nBAD'));
    return child;
  });
  const result = await acquireEditionPrefixDiagnostic(request, { transport: (url, options) => transport(url,
    { ...options, observeBodyBytes: n => { observed += n; options.observeBodyBytes(n); } }) });
  assert.equal(result.code, 'edition-prefix-range-not-honored'); assert.equal(result.diagnostic, null);
  assert.equal(observed, 3); assert.equal(killed, true); assert.equal(result.transport.requests.editions, 1);
});

test('bounded Edition scan diagnoses only its own header and emits no complete record', async () => {
  for (const key of ['/books/OL999999999M', '/books/' + previousConflict.roster[0].editionId]) {
    const f = fixture(header(key) + 'PRIVATE'.repeat(200000));
    const result = await acquireEditionPrefixDiagnostic(f.request, { transport: transportFor(f.request, f.zipped) });
    assert.equal(result.status, 'diagnosed'); assert.equal(result.code, 'dump-line-limit');
    assert.equal(result.diagnostic.failureEvidence.envelopeSelection.status, key.includes('999999999') ? 'unrelated' : 'selected');
    assert.equal(result.diagnostic.publisherChecksumsVerified, false); assert.equal(result.provenanceVerified, false);
    assert.deepEqual(result.transport.requests, { works: 0, editions: 1, metadata: 0 });
    assert.equal(validateEditionPrefixResult(result, f.request), result); assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  }
});

test('safe redirects retain the same range and enforce a cumulative body cap', async () => {
  const f = fixture(), target = f.request.sourcePins.editions.url.replace('archive.org/download', 'ia800001.us.archive.org/4/items');
  let calls = 0;
  const result = await acquireEditionPrefixDiagnostic(f.request, { transport: async (url, options) => {
    assert.deepEqual(options.range, editionPrefixRange(f.request)); calls++;
    if (calls === 1) return { status: 302, headers: { location: target }, body: Readable.from([]) };
    assert.equal(url, target); return transportFor(f.request, f.zipped)(url, options);
  } });
  assert.equal(result.status, 'diagnosed'); assert.equal(calls, 2); assert.equal(result.transport.redirects.length, 1);
  assert.equal(result.transport.response.finalUrl, target);
});

test('unsafe redirects, loops and a fifth redirect stop without another provider request', async () => {
  const f = fixture();
  for (const location of ['https://example.invalid/private', f.request.sourcePins.works.url,
    f.request.sourcePins.editions.url + '?key=PRIVATE', f.request.sourcePins.editions.url]) {
    let calls = 0;
    const result = await acquireEditionPrefixDiagnostic(f.request, { transport: async () => {
      calls++; return { status: 302, headers: { location }, body: Readable.from([]) };
    } });
    assert.equal(result.status, 'failed'); assert.equal(result.diagnostic, null); assert.equal(calls, 1);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  }
  let calls = 0;
  const result = await acquireEditionPrefixDiagnostic(f.request, { transport: async () => ({ status: 302,
    headers: { location: f.request.sourcePins.editions.url.replace('archive.org/download', `ia${++calls}.archive.org/items`) }, body: Readable.from([]) }) });
  assert.equal(calls, 5); assert.equal(result.code, 'acquisition-redirect-limit');
});

test('redirect-body exhaustion and observed overrun fail with truthful accounting and no evidence', async () => {
  for (const extra of [0, 1]) {
    const f = fixture(); let calls = 0;
    const result = await acquireEditionPrefixDiagnostic(f.request, { transport: async (_url, options) => {
      calls++; options.observeBodyBytes(f.request.diagnosticLimits.compressedBytes + extra);
      return { status: 302, headers: { location: f.request.sourcePins.editions.url.replace('/download/', '/serve/') }, body: Readable.from([]) };
    } });
    assert.equal(calls, 1); assert.equal(result.code, 'edition-prefix-body-limit'); assert.equal(result.diagnostic, null);
    assert.equal(result.transport.receivedBodyBytes, f.request.diagnosticLimits.compressedBytes + extra);
  }
});

test('partial gzip and row/decoded exhaustion are inconclusive; truncated or corrupt input fails', async () => {
  const cases = [
    { raw: 'x\n'.repeat(30), limits: { maxRows: 2 }, code: 'edition-line-row-limit' },
    { raw: 'x'.repeat(100), limits: { maxDecodedBytes: 10 }, code: 'edition-line-decoded-limit' },
    { raw: 'x\n', limits: {}, code: 'edition-line-prefix-exhausted' },
  ];
  for (const value of cases) {
    const f = fixture(value.raw, value.limits), r = await acquireEditionPrefixDiagnostic(f.request, { transport: transportFor(f.request, f.zipped) });
    assert.equal(r.status, 'inconclusive'); assert.equal(r.code, value.code);
  }
  const f = fixture('x\n'.repeat(30)), partial = rehash({ ...f.request,
    diagnosticLimits: { ...f.request.diagnosticLimits, compressedBytes: f.zipped.length - 8 } });
  const exact = await acquireEditionPrefixDiagnostic(partial, { transport: transportFor(partial, f.zipped.subarray(0, -8)) });
  assert.equal(exact.status, 'inconclusive');
  const truncated = await acquireEditionPrefixDiagnostic(partial, { transport: transportFor(partial, f.zipped.subarray(0, -10)) });
  assert.equal(truncated.status, 'failed'); assert.equal(truncated.code, 'edition-line-prefix-truncated');
  const corrupted = Buffer.from(f.zipped); corrupted[0] = 0;
  const invalid = await acquireEditionPrefixDiagnostic(f.request, { transport: transportFor(f.request, corrupted) });
  assert.equal(invalid.status, 'failed'); assert.equal(invalid.code, 'edition-line-gzip-invalid');
});

test('pre-abort, transport timeout and private exceptions never fabricate a diagnosis', async () => {
  const f = fixture(undefined, { timeoutMs: 15 }), controller = new AbortController(); controller.abort(); let calls = 0;
  const aborted = await acquireEditionPrefixDiagnostic(f.request, { signal: controller.signal, transport: async () => { calls++; } });
  assert.equal(aborted.code, 'edition-prefix-aborted'); assert.equal(calls, 0);
  const keepAlive = setInterval(() => {}, 100);
  try {
    const timed = await acquireEditionPrefixDiagnostic(f.request, { transport: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('PRIVATE')), { once: true });
    }) });
    assert.equal(timed.code, 'edition-prefix-timeout'); assert.equal(timed.diagnostic, null);
  } finally { clearInterval(keepAlive); }
  const failed = await acquireEditionPrefixDiagnostic(f.request, { transport: async () => { throw new Error('PRIVATE dump-line-limit'); } });
  assert.equal(failed.code, 'edition-prefix-failed'); assert.ok(!JSON.stringify(failed).includes('PRIVATE'));
});

test('caller mutations cannot change in-flight range, source or diagnostic bindings', async () => {
  const f = fixture(), original = structuredClone(f.request);
  const result = await acquireEditionPrefixDiagnostic(f.request, { transport: async (url, options) => {
    f.request.roster.pop(); f.request.diagnosticLimits.compressedBytes = 1;
    return transportFor(original, f.zipped)(url, options);
  } });
  assert.equal(validateEditionPrefixResult(result, original), result);
});

test('closed transport/result replay rejects extra actions, altered limits, routes and classifications', async () => {
  const f = fixture(), result = await acquireEditionPrefixDiagnostic(f.request, { transport: transportFor(f.request, f.zipped) });
  for (const mutate of [r => { r.candidates = 1; }, r => { r.provenanceVerified = true; }, r => { r.extra = 'PRIVATE'; },
    r => { r.transport.requests.works = 1; }, r => { r.transport.requests.editions = 2; }, r => { r.transport.receivedBodyBytes = 0; },
    r => { r.transport.response.contentLength--; }, r => { r.transport.response.finalUrl += '?PRIVATE'; },
    r => { r.diagnostic.failureEvidence.envelopeSelection.status = 'selected'; }, r => { r.diagnostic.limits.lineBytes++; },
    r => { r.diagnostic.fullSourceComplete = true; }, r => { r.diagnostic = null; }, r => { r.status = 'failed'; },
    r => { r.completedAt = '2020-01-01T00:00:00Z'; }, r => { r.requestSha256 = '0'.repeat(64); }]) {
    const invalid = structuredClone(result); mutate(invalid); assert.throws(() => validateEditionPrefixResult(invalid, f.request));
  }
});

test('one neutral encrypted kind covers all outcomes and rejects invalid production recipients', async () => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  for (const raw of [undefined, 'x\n', null]) {
    const f = fixture(raw ?? undefined), result = await acquireEditionPrefixDiagnostic(f.request,
      { transport: raw === null ? async () => { throw new Error('PRIVATE'); } : transportFor(f.request, f.zipped) });
    const production = sealEditionPrefixDiagnostic(result, f.request);
    assert.equal(production.header.payloadKind, 'edition-prefix-diagnostic'); assert.ok(!JSON.stringify(production).includes('prefixBase64'));
    assert.throws(() => unsealEditionPrefixDiagnostic(production, f.request, keys.privateKey), /unseal-failed/);
    // Test-only cryptographic context cannot pass the production request gate.
    const context = rehash({ ...f.request, recipientPublicKey: keys.publicKey, recipientFingerprint: recipientFingerprint(keys.publicKey) });
    const payload = { ...result, requestSha256: context.requestSha256 };
    assert.throws(() => validateEditionPrefixRequest(context));
    const kind = () => 'edition-prefix-diagnostic';
    const sealed = sealPayload(payload, context, validateEditionPrefixPayload, EDITION_PREFIX_MAX_PLAINTEXT, kind);
    const decrypt = value => unsealPayload(value, context, keys.privateKey, validateEditionPrefixPayload,
      EDITION_PREFIX_MAX_PLAINTEXT, ['edition-prefix-diagnostic'], kind);
    assert.deepEqual(decrypt(sealed), payload);
    for (const field of Object.keys(sealed.header)) {
      const altered = structuredClone(sealed); altered.header[field] = typeof altered.header[field] === 'number' ? 1 : 'forged';
      assert.throws(() => decrypt(altered));
    }
    const forged = sealPayload({ ...payload, candidates: 1 }, context, () => {}, EDITION_PREFIX_MAX_PLAINTEXT, kind);
    assert.throws(() => decrypt(forged), /unseal-failed/);
  }
});
