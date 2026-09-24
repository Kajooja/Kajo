import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createServer, get } from 'node:http';
import { PassThrough, Readable } from 'node:stream';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { ACQUISITION_LIMITS, ACQUISITION_RELEASE, acquireOpenLibraryDumps, curlAcquisitionTransport,
  inspectOpenLibraryDumpMetadata, safeAcquisitionError,
  validateAcquisitionMetadata, validateAcquisitionRoster, validateAcquisitionUrl } from './acquire-open-library-dumps.mjs';
import { digest, sha256 } from './open-library-descriptions.mjs';
import { validateDumpSources } from './open-library-dump-descriptions.mjs';

const release = ACQUISITION_RELEASE;
const roster = [{ workId: 'OL123W', editionId: 'OL456M' }];
const modifiedAt = '2026-08-15T10:00:00.000';
const description = 'A fictional traveller follows a quiet river and discovers how the choices of an earlier generation still shape the town.';
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
function row(kind, extra = {}, envelope = {}) {
  const key = kind === 'work' ? '/works/OL123W' : '/books/OL456M';
  const data = { key, type: { key: `/type/${kind}` }, revision: 3,
    last_modified: { type: '/type/datetime', value: modifiedAt }, description,
    ...(kind === 'edition' ? { works: [{ key: '/works/OL123W' }], languages: [{ key: '/languages/fin' }] } : {}), ...extra };
  return [envelope.type ?? `/type/${kind}`, envelope.key ?? key, envelope.revision ?? 3,
    envelope.modifiedAt ?? modifiedAt, JSON.stringify(data)].join('\t') + '\n';
}
function dataFixture({ works = row('work'), editions = row('edition'), mutateMetadata = () => {}, truncate = false } = {}) {
  const bytes = { works: gzipSync(works), editions: gzipSync(editions) };
  if (truncate) bytes.works = bytes.works.subarray(0, -8);
  const document = { metadata: { identifier: `ol_dump_${release}` }, files: Object.entries(bytes).map(([kind, data]) => ({
    name: `ol_dump_${kind}_${release}.txt.gz`, size: String(data.length), md5: hash('md5', data), sha1: hash('sha1', data),
  })) };
  mutateMetadata(document);
  return { bytes, document, metadata: Buffer.from(JSON.stringify(document)) };
}

// The production URLs and redirect policy remain unchanged. Only this injected
// fixture transport sends bytes through an ephemeral loopback HTTP server.
async function fixture(t, options = {}) {
  const data = dataFixture(options), calls = [];
  const server = createServer((request, response) => {
    if (options.respond?.(request, response, data)) return;
    if (request.url === `/metadata/ol_dump_${release}`) {
      response.end(data.metadata); return;
    }
    for (const kind of ['works', 'editions']) if (request.url.endsWith(`ol_dump_${kind}_${release}.txt.gz`)) {
      response.end(data.bytes[kind]); return;
    }
    response.writeHead(404); response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const transport = (url, { signal }) => new Promise((resolve, reject) => {
    calls.push(url);
    const parsed = new URL(url);
    const request = get({ hostname: '127.0.0.1', port: server.address().port,
      path: parsed.pathname + parsed.search, signal }, response => resolve({ status: response.statusCode,
      headers: response.headers, body: response }));
    request.on('error', reject);
  });
  return { ...data, calls, transport, run: extra => acquireOpenLibraryDumps({ release, roster, transport, ...extra }) };
}

test('public roster is exact, unique and canonical; private bindings and broad releases are rejected before transport', async () => {
  assert.deepEqual(validateAcquisitionRoster(roster), roster);
  for (const value of [[], [{ ...roster[0], itemId: 'private' }], [...roster, ...roster],
    [{ workId: 'OL123W', editionId: '/books/OL456M' }], Array(386).fill(roster[0])])
    assert.throws(() => validateAcquisitionRoster(value), /(?:invalid|duplicate)-acquisition/);
  let calls = 0;
  await assert.rejects(acquireOpenLibraryDumps({ release: 'latest', roster, transport: () => calls++ }), /invalid-acquisition-release/);
  assert.equal(calls, 0);
});

test('complete official-shaped streams verify both publisher hashes, calculate SHA256 and retain only unreviewed exact pairs', async t => {
  const f = await fixture(t, { works: row('work') + '/type/work\t/works/OL999W\t1\t2026-01-01T00:00:00\t{}\n' });
  const result = await f.run();
  assert.equal(result.status, 'collected');
  assert.equal(f.calls.length, 3);
  assert.equal(result.rosterSha256, digest(roster));
  assert.equal(result.metadata.sha256, sha256(f.metadata));
  assert.equal(result.metadata.raw, f.metadata.toString('utf8'));
  assert.equal(result.sources.works.sha256, sha256(f.bytes.works));
  assert.equal(result.sources.works.md5, hash('md5', f.bytes.works));
  assert.equal(result.sources.works.sha1, hash('sha1', f.bytes.works));
  assert.equal(result.sources.works.complete, true);
  assert.equal(result.sources.works.publisherChecksumsVerified, true);
  assert.equal(result.sources.works.rows, 2);
  assert.equal(result.sources.works.unrelatedRows, 1);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].work.inspection.description.text, description);
  assert.equal(result.records[0].edition.inspection.description.text, description);
  assert.equal(result.records[0].itemId, undefined);
  assert.equal(result.rights, 'unreviewed');
  assert.equal(result.approved, 0);
  assert.equal(result.databaseWrites, 0);
  assert.equal(result.individualProviderRequests, 0);
  assert.equal(result.coverage.found, 2);
  assert.equal(result.coverage.targetsWithEligibleText, 1);
  assert.equal(validateDumpSources(result.sourceManifest), result.sourceManifest);
});

test('missing exact records and rejected text remain explicit sparse results without notes fallback or implicit language approval', async t => {
  const f = await fixture(t, { works: row('work', { description: null, notes: description }), editions: '' });
  const result = await f.run();
  assert.equal(result.records[0].work.inspection.description.status, 'missing');
  assert.equal(result.records[0].edition, null);
  assert.equal(result.coverage.missing, 1);
  assert.equal(result.coverage.eligibleTexts, 0);
  assert.equal(result.rights, 'unreviewed');
});

test('both metadata identities/checksums/byte bounds are frozen before any source GET', async t => {
  const mutations = [
    data => { data.metadata.identifier = 'different-release'; },
    data => { data.error = 'private text never exposed'; },
    data => { data.files.push(data.files[0]); },
    data => { data.files.pop(); },
    data => { delete data.files[1].md5; },
    data => { delete data.files[1].sha1; },
    data => { data.files[0].size = '-1'; },
    data => { data.files[0].size = String(ACQUISITION_LIMITS.totalCompressedBytes); },
    data => { data.files[0].sha1 = 'not-a-digest'; },
    data => { data.files[1].name = 'ol_dump_editions_latest.txt.gz'; },
  ];
  for (const mutateMetadata of mutations) {
    const f = await fixture(t, { mutateMetadata });
    await assert.rejects(f.run(), /(?:invalid-acquisition|acquisition-compressed-byte-limit)/);
    assert.equal(f.calls.length, 1);
  }
});

test('metadata inspection retains exact complete bytes before every validation failure without starting dumps', async () => {
  const cases = [
    [Buffer.from([0xff, 0xfe]), 'invalid-acquisition-metadata'],
    [Buffer.from('{private malformed JSON'), 'invalid-acquisition-metadata'],
    [Buffer.from('{}'), 'invalid-acquisition-metadata'],
    [dataFixture({ mutateMetadata: data => { data.files.pop(); } }).metadata, 'invalid-acquisition-source-count'],
    [dataFixture({ mutateMetadata: data => { delete data.files[0].md5; } }).metadata, 'invalid-acquisition-source-integrity'],
    [dataFixture({ mutateMetadata: data => { data.files[0].size = String(ACQUISITION_LIMITS.totalCompressedBytes); } }).metadata,
      'acquisition-compressed-byte-limit'],
  ];
  for (const [raw, code] of cases) {
    const calls = [];
    const transport = async url => {
      calls.push(url);
      assert.equal(url, `https://archive.org/metadata/ol_dump_${release}`);
      return { status: 200, headers: {}, body: Readable.from([raw]) };
    };
    const inspected = await inspectOpenLibraryDumpMetadata({ release, transport });
    assert.equal(inspected.status, 'inspected');
    assert.deepEqual(inspected.validation, { valid: false, code, pinnedSources: null });
    assert.equal(inspected.metadata.complete, true);
    assert.equal(inspected.metadata.bytes, raw.length);
    assert.equal(inspected.metadata.sha256, sha256(raw));
    assert.deepEqual(Buffer.from(inspected.metadata.rawBase64, 'base64'), raw);
    assert.deepEqual(inspected.accounting.requests, { metadata: 1, works: 0, editions: 0 });
    assert.equal(inspected.dumpRequests, 0);
    assert.equal(calls.length, 1);
    await assert.rejects(acquireOpenLibraryDumps({ release, roster, transport }), error => {
      assert.equal(error.message, code);
      assert.equal(error.accounting.metadata.sha256, sha256(raw));
      assert.deepEqual(Buffer.from(error.accounting.metadata.rawBase64, 'base64'), raw);
      assert.deepEqual(error.accounting.requests, { metadata: 1, works: 0, editions: 0 });
      return true;
    });
    assert.equal(calls.length, 2);
  }
});

test('valid metadata-only inspection returns pinned source fields but never opens either dump', async () => {
  const data = dataFixture(), calls = [];
  const result = await inspectOpenLibraryDumpMetadata({ release, limits: { maxRedirects: 0, timeoutMs: 30000 },
    transport: async url => {
      calls.push(url);
      assert.ok(url.includes('/metadata/'));
      return { status: 200, headers: {}, body: Readable.from([data.metadata]) };
    } });
  assert.equal(result.validation.valid, true);
  assert.equal(result.validation.code, null);
  assert.deepEqual(result.validation.pinnedSources, validateAcquisitionMetadata(data.document, release));
  assert.equal(calls.length, 1);
  assert.deepEqual(result.accounting.sources, {});
  assert.equal(result.accounting.requests.works + result.accounting.requests.editions, 0);
});

test('metadata-only limit and connection failures preserve partial accounting but never pretend complete evidence', async () => {
  const raw = Buffer.from('too many metadata bytes');
  await assert.rejects(inspectOpenLibraryDumpMetadata({ release, limits: { metadataBytes: 2 },
    transport: async () => ({ status: 200, headers: {}, body: Readable.from([raw]) }) }), error => {
    assert.equal(error.message, 'acquisition-metadata-limit');
    assert.equal(error.accounting.metadata.complete, false);
    assert.equal(error.accounting.metadata.bytes, raw.length);
    assert.equal(error.accounting.metadata.rawBase64, undefined);
    assert.deepEqual(error.accounting.requests, { metadata: 1, works: 0, editions: 0 });
    return true;
  });
  assert.equal(safeAcquisitionError(new Error('invalid-acquisition-secret-provider-text')), 'acquisition-failed');
  assert.equal(safeAcquisitionError(new Error('invalid-acquisition-source-count')), 'invalid-acquisition-source-count');
});

test('publisher MD5 and SHA1 independently reject incorrect bytes even when the other matches', async t => {
  for (const algorithm of ['md5', 'sha1']) {
    const f = await fixture(t, { mutateMetadata: data => { data.files[1][algorithm] = '0'.repeat(algorithm === 'md5' ? 32 : 40); } });
    await assert.rejects(f.run(), /dump-checksum-mismatch/);
    assert.equal(f.calls.length, 3);
  }
});

test('truncated gzip fails despite matching publisher byte hashes; a late duplicate after the match also fails', async t => {
  const truncated = await fixture(t, { truncate: true });
  await assert.rejects(truncated.run(), /acquisition-failed/);
  const duplicate = await fixture(t, { works: row('work') + 'irrelevant\n' + row('work') });
  await assert.rejects(duplicate.run(), /duplicate-dump-target-record/);
  assert.equal(duplicate.calls.length, 2);
});

test('identity/envelope conflicts stop collection without trying Editions or falling back to provider APIs', async t => {
  const f = await fixture(t, { works: row('work', {}, { revision: 4 }) });
  await assert.rejects(f.run(), /invalid-dump-target-envelope/);
  assert.equal(f.calls.length, 2);
});

test('metadata, decoded bytes, line length, retained bytes and row ceilings terminate bounded streams', async t => {
  for (const [limits, options, expected] of [
    [{ metadataBytes: 10 }, {}, /acquisition-metadata-limit/],
    [{ maxDecodedBytes: 20 }, {}, /dump-decoded-byte-limit/],
    [{ lineBytes: 20 }, {}, /dump-line-limit/],
    [{ retainedBytes: 20 }, {}, /dump-staging-limit/],
    [{ maxRows: 1 }, { works: row('work') + 'unrelated\n' }, /dump-row-limit/],
  ]) {
    const f = await fixture(t, options);
    await assert.rejects(f.run({ limits }), expected);
  }
  let calls = 0;
  await assert.rejects(acquireOpenLibraryDumps({ release, roster, limits: { maxRows: ACQUISITION_LIMITS.maxRows + 1 },
    transport: () => calls++ }), /invalid-acquisition-limits/);
  assert.equal(calls, 0);
});

test('safe HTTPS Archive redirects are recorded; foreign/downgrade/credential/loop redirects stop before next GET', async t => {
  const good = await fixture(t, { respond(request, response) {
    if (request.url === `/metadata/ol_dump_${release}`) {
      response.writeHead(302, { location: `https://ia800123.us.archive.org/metadata/ol_dump_${release}?fixture=1` }); response.end(); return true;
    }
    if (request.url === `/metadata/ol_dump_${release}?fixture=1`) { response.end(JSON.stringify(dataFixture().document)); return true; }
  } });
  const result = await good.run();
  assert.equal(result.metadata.redirects.length, 1);
  assert.equal(result.metadata.finalUrl, `https://ia800123.us.archive.org/metadata/ol_dump_${release}?fixture=1`);
  for (const location of ['https://archive.org.evil.example/file', 'http://archive.org/file',
    'https://user:password@archive.org/file', 'https://archive.org:444/file', `https://archive.org/metadata/ol_dump_${release}`]) {
    const f = await fixture(t, { respond(_request, response) {
      response.writeHead(302, { location }); response.end(); return true;
    } });
    await assert.rejects(f.run(), /(?:unsafe-acquisition-url|acquisition-redirect-loop)/);
    assert.equal(f.calls.length, 1);
  }
  const perItem = await fixture(t, { respond(_request, response) {
    response.writeHead(302, { location: 'https://openlibrary.org/books/OL456M.json' }); response.end(); return true;
  } });
  await assert.rejects(perItem.run(), /unsafe-acquisition-source-route/);
  assert.equal(perItem.calls.length, 1);
  const mirror = await fixture(t, { respond(request, response) {
    if (request.url.startsWith('/download/') && request.url.includes('_works_')) {
      response.writeHead(302, { location: `https://ia800123.us.archive.org/12/items/ol_dump_${release}/ol_dump_works_${release}.txt.gz` });
      response.end(); return true;
    }
  } });
  const mirrored = await mirror.run();
  assert.equal(mirrored.sources.works.redirects.length, 1);
  assert.equal(mirrored.sources.works.complete, true);
});

test('redirect ceiling, HTTP errors and unexpected content encoding fail without retries', async t => {
  for (const [status, headers, limits, expected] of [
    [302, { location: 'https://archive.org/next' }, { maxRedirects: 0 }, /acquisition-redirect-limit/],
    [429, {}, {}, /acquisition-http-failed/], [503, {}, {}, /acquisition-http-failed/],
    [200, { 'content-encoding': 'gzip' }, {}, /acquisition-content-encoding/],
  ]) {
    const f = await fixture(t, { respond(_request, response) { response.writeHead(status, headers); response.end('private-error'); return true; } });
    await assert.rejects(f.run({ limits }), expected);
    assert.equal(f.calls.length, 1);
  }
});

test('compressed length mismatch fails and transport exceptions never disclose provider text', async t => {
  const f = await fixture(t, { mutateMetadata: data => { data.files[0].size = String(Number(data.files[0].size) + 1); } });
  await assert.rejects(f.run(), /dump-file-size-mismatch/);
  await assert.rejects(acquireOpenLibraryDumps({ release, roster, transport() { throw new Error('secret response body'); } }),
    error => error.message === 'acquisition-failed');
  assert.equal(safeAcquisitionError(new Error('secret text')), 'acquisition-failed');
});

test('failure accounting preserves verified prior source and actual partial bytes, without text or invented completion', async t => {
  const f = await fixture(t, { respond(request, response, data) {
    if (request.url.includes('_editions_')) {
      response.writeHead(200, { 'content-length': String(data.bytes.editions.length) });
      response.write(data.bytes.editions.subarray(0, Math.floor(data.bytes.editions.length / 2)));
      setTimeout(() => response.destroy(), 15);
      return true;
    }
  } });
  await assert.rejects(f.run(), error => {
    assert.equal(error.message, 'acquisition-failed');
    assert.equal(error.accounting.activeSource, 'editions');
    assert.equal(error.accounting.metadata.bytes, f.metadata.length);
    assert.equal(error.accounting.metadata.complete, true);
    assert.equal(error.accounting.sources.works.complete, true);
    assert.equal(error.accounting.sources.works.bytes, f.bytes.works.length);
    assert.equal(error.accounting.sources.editions.complete, false);
    assert.ok(error.accounting.sources.editions.bytes > 0);
    assert.ok(error.accounting.sources.editions.bytes < f.bytes.editions.length);
    assert.deepEqual(error.accounting.requests, { metadata: 1, works: 1, editions: 1 });
    assert.ok(!JSON.stringify(error.accounting).includes(description));
    assert.equal(error.accounting.databaseWrites, 0);
    return true;
  });
});

test('outer abort and metadata deadline close pending connections rather than waiting for unbounded network', async t => {
  const waiting = await fixture(t, { respond() { return true; } });
  await assert.rejects(waiting.run({ limits: { timeoutMs: 40 } }), /acquisition-aborted/);
  const meta = await fixture(t, { respond() { return true; } });
  await assert.rejects(meta.run({ limits: { metadataTimeoutMs: 40 } }), /acquisition-metadata-timeout/);
  const controller = new AbortController(); controller.abort();
  const f = await fixture(t);
  await assert.rejects(f.run({ signal: controller.signal }), /acquisition-aborted/);
  assert.equal(f.calls.length, 0);
});

test('transport body chunk boundaries and final lines preserve exact raw Unicode hashes', async () => {
  const data = dataFixture({ works: row('work', { description: description + ' Kävelijä.' }).trimEnd() });
  const transport = async url => {
    const bytes = url.includes('/metadata/') ? data.metadata : url.includes('_works_') ? data.bytes.works : data.bytes.editions;
    return { status: 200, headers: {}, body: Readable.from([...bytes].map(value => Buffer.from([value]))) };
  };
  const result = await acquireOpenLibraryDumps({ release, roster, transport });
  assert.equal(result.sources.works.sha256, sha256(data.bytes.works));
  assert.equal(result.records[0].work.inspection.recordSha256, sha256(result.records[0].work.raw));
  assert.ok(result.records[0].work.raw.includes('Kävelijä'));
});

test('metadata validator and URL validator reject ambiguous identities without requiring network', () => {
  const data = dataFixture();
  assert.equal(validateAcquisitionMetadata(data.document, release).works.bytes, data.bytes.works.length);
  for (const url of ['file:///tmp/input', 'https://localhost/a', 'https://evilarchive.org/a', 'https://archive.org/a#fragment'])
    assert.throws(() => validateAcquisitionUrl(url), /unsafe-acquisition-url/);
});

test('curl transport separates fragmented headers/body and inherits proxy environment without curlrc, redirects, retries or TLS overrides', async () => {
  let invocation;
  const spawnProcess = (command, args, options) => {
    invocation = { command, args, options };
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.kill = () => { child.stdout.destroy(); child.emit('close', null); };
    process.nextTick(() => {
      child.stdout.once('end', () => process.nextTick(() => child.emit('close', 0)));
      child.stdout.write('HTTP/1.1 100 Continue\r\n\r\nHTTP/2 200\r\ncontent-len');
      child.stdout.end('gth: 5\r\n\r\nhello');
    });
    return child;
  };
  const response = await curlAcquisitionTransport('https://archive.org/metadata/ol_dump_2026-08-31',
    { signal: new AbortController().signal, timeoutMs: 30000, maxBytes: 1024 }, spawnProcess);
  const chunks = [];
  for await (const chunk of response.body) chunks.push(chunk);
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-length'], '5');
  assert.equal(Buffer.concat(chunks).toString(), 'hello');
  assert.equal(invocation.command, 'curl');
  assert.equal(invocation.args[0], '--disable');
  assert.equal(invocation.options.shell, undefined);
  assert.equal(invocation.options.env, undefined);
  for (const forbidden of ['--location', '--retry', '--insecure', '-k', '--noproxy', '--proxy'])
    assert.equal(invocation.args.includes(forbidden), false);
  assert.ok(invocation.args.includes('--suppress-connect-headers'));
  assert.ok(invocation.args.includes('--max-filesize'));
});

test('curl transport never treats stdout EOF before a failing process exit as a successful body', async () => {
  const spawnProcess = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.kill = () => {};
    process.nextTick(() => {
      child.stdout.once('end', () => process.nextTick(() => child.emit('close', 28)));
      child.stdout.end('HTTP/1.1 200 OK\r\n\r\npartial');
    });
    return child;
  };
  const response = await curlAcquisitionTransport('https://archive.org/file',
    { signal: new AbortController().signal, timeoutMs: 30000, maxBytes: 1024 }, spawnProcess);
  await assert.rejects(async () => { for await (const _chunk of response.body) { /* consume to EOF */ } },
    /acquisition-transport-failed/);
});
