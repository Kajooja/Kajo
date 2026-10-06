import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve('@expo/cli/package.json'));
const postcssRequire = createRequire(require.resolve('postcss/package.json'));
const compressionPath = expoRequire.resolve('compression');
const sourceMapPath = postcssRequire.resolve('source-map-js');

function boundedChild(source, { heap = 128, timeout = 8000 } = {}) {
  const result = spawnSync(process.execPath, [
    `--max-old-space-size=${heap}`, '--input-type=commonjs', '-e', source,
  ], { encoding: 'utf8', timeout, maxBuffer: 16384 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('Expo compression preserves responses and frees streams after client abandonment', () => {
  // The child isolates global zlib instrumentation and owns every local socket.
  // GHSA-vc2v-76pw-4v95 concerns native stream lifetime, not fluctuating RSS.
  boundedChild(String.raw`
    const assert = require('node:assert/strict');
    const http = require('node:http');
    const zlib = require('node:zlib');
    const compression = require(${JSON.stringify(compressionPath)});
    const payload = Buffer.from('Kajo compressed recommendation fixture. '.repeat(4096));
    const codecs = [
      ['gzip', 'createGzip', 'gunzipSync'],
      ['deflate', 'createDeflate', 'inflateSync'],
      ['br', 'createBrotliCompress', 'brotliDecompressSync'],
    ];

    async function listen(server) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
    }

    async function close(server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }

    async function ordinary(encoding, decode) {
      const middleware = compression({ threshold: 0 });
      const server = http.createServer((req, res) => middleware(req, res, () => {
        res.setHeader('Content-Type', 'text/plain');
        res.end(payload);
      }));
      let request;
      try {
        await listen(server);
        const received = await new Promise((resolve, reject) => {
          request = http.get({ host: '127.0.0.1', port: server.address().port,
            headers: { 'Accept-Encoding': encoding }, agent: false }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.once('error', reject);
            res.once('end', () => resolve({ encoding: res.headers['content-encoding'],
              bytes: Buffer.concat(chunks) }));
          });
          request.once('error', reject);
        });
        assert.equal(received.encoding, encoding);
        assert.deepEqual(zlib[decode](received.bytes), payload);
      } finally {
        request?.destroy();
        await close(server);
      }
    }

    async function abandoned(encoding, factory, closeBeforeWrite = false) {
      const descriptor = Object.getOwnPropertyDescriptor(zlib, factory);
      let stream;
      let nativeClosed;
      Object.defineProperty(zlib, factory, { ...descriptor, value: function (...args) {
        stream = descriptor.value.apply(this, args);
        nativeClosed = new Promise(resolve => stream.once('close', resolve));
        return stream;
      } });
      const middleware = compression({ threshold: 0 });
      let serverResponse;
      let responseClosed;
      const completed = new Promise(resolve => { responseClosed = resolve; });
      const server = http.createServer((req, res) => middleware(req, res, () => {
        serverResponse = res;
        res.setHeader('Content-Type', 'text/plain');
        res.once('close', () => {
          if (closeBeforeWrite) {
            // A late eligible write creates a stream after the only close event.
            res.write(payload);
            res.end();
          }
          responseClosed();
        });
        if (closeBeforeWrite) {
          res.destroy();
        } else {
          res.write(payload);
          res.flush();
        }
      }));
      let request;
      let receivedEncoding;
      try {
        await listen(server);
        request = http.get({ host: '127.0.0.1', port: server.address().port,
          headers: { 'Accept-Encoding': encoding }, agent: false }, res => {
          receivedEncoding = res.headers['content-encoding'];
          res.once('data', () => res.destroy());
          res.on('error', () => {});
        });
        // Reset is expected when the server/client deliberately abandons a socket.
        request.on('error', () => {});
        await completed;
        await new Promise(resolve => setImmediate(resolve));
        assert.ok(stream, 'the fixture must create a real compression stream');
        if (!closeBeforeWrite) {
          assert.equal(receivedEncoding, encoding);
          assert.equal(serverResponse.writableEnded, false, 'abort must precede response end');
        }
        assert.equal(stream.destroyed, true, 'abandoned response must release its stream');
        await nativeClosed;
        assert.equal(stream.closed, true);
      } finally {
        request?.destroy();
        stream?.destroy();
        Object.defineProperty(zlib, factory, descriptor);
        await close(server);
      }
    }

    (async () => {
      for (const [encoding, factory, decode] of codecs) {
        await ordinary(encoding, decode);
        await abandoned(encoding, factory);
      }
      await abandoned('gzip', 'createGzip', true);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
});

test('PostCSS source-map dependency preserves ordinary mappings and generated code', () => {
  const { SourceMapConsumer, SourceMapGenerator, SourceNode } = postcssRequire('source-map-js');
  const generator = new SourceMapGenerator({ file: 'compiled.js' });
  generator.addMapping({ generated: { line: 1, column: 0 },
    original: { line: 7, column: 2 }, source: 'original.js', name: 'recommend' });
  generator.setSourceContent('original.js', 'recommend();');
  const consumer = new SourceMapConsumer(generator.toJSON());
  assert.deepEqual(consumer.originalPositionFor({ line: 1, column: 0 }),
    { source: 'original.js', line: 7, column: 2, name: 'recommend' });
  assert.equal(consumer.sourceContentFor('original.js'), 'recommend();');
  assert.equal(SourceNode.fromStringWithSourceMap('recommend();\n', consumer).toString(), 'recommend();\n');
});

test('indexed source maps reject amplification and bound accepted offset processing', () => {
  // GHSA-68fv-2mgg-jv7q: heap/deadline limits contain failures in old versions.
  boundedChild(String.raw`
    const assert = require('node:assert/strict');
    const { SourceMapConsumer, SourceMapGenerator, SourceNode } = require(${JSON.stringify(sourceMapPath)});
    const basic = () => ({ version: 3, sources: ['source.js'], sourcesContent: ['x'],
      names: [], mappings: 'AAAA' });
    const indexed = (line, column = 0, map = basic()) => ({ version: 3,
      sections: [{ offset: { line, column }, map }] });

    for (const value of [-1, 0.5, NaN, Infinity, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => new SourceMapConsumer(indexed(value)), /offset/);
      assert.throws(() => new SourceMapConsumer(indexed(0, value)), /offset/);
    }
    assert.throws(() => new SourceMapConsumer(indexed(10000001)), /must not exceed/);
    assert.throws(() => new SourceMapConsumer(indexed(6000000, 0,
      indexed(6000000))), /nested sections/);

    const far = new SourceMapConsumer(indexed(10000000));
    assert.equal(far.originalPositionFor({ line: 10000001, column: 1 }).source, 'source.js');
    const node = SourceNode.fromStringWithSourceMap('x;\n', far);
    assert.equal(node.toString(), 'x;\n', 'offset padding must stop when code is exhausted');
    const generator = new SourceMapGenerator({ file: 'compiled.js' });
    far.eachMapping(mapping => generator.addMapping({
      generated: { line: mapping.generatedLine, column: mapping.generatedColumn },
      original: { line: mapping.originalLine, column: mapping.originalColumn },
      source: mapping.source,
    }));
    const copied = generator.toJSON();
    assert.equal(copied.mappings.length, 10000004);
    assert.equal(copied.mappings.slice(-4), 'AAAA');

    let nested = basic();
    for (let i = 0; i < 40; i++) nested = indexed(0, 0, nested);
    const deep = new SourceMapConsumer(nested);
    assert.deepEqual(deep.sources, ['source.js']);
    assert.equal(SourceNode.fromStringWithSourceMap('x;\n', deep).toString(), 'x;\n');
  `, { timeout: 5000 });
});
