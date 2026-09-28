import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { routingDecoderInterop } from './patch-routing-decoder.mjs';

const require = createRequire(import.meta.url);
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const queryPath = routerRequire.resolve('query-string');
const query = routerRequire('query-string');
const fromPath = routerRequire('./build/react-navigation/core/getStateFromPath.js').getStateFromPath;
const toPath = routerRequire('./build/react-navigation/core/getPathFromState.js').getPathFromState;

test('installed CommonJS routing keeps Unicode, repeated, empty, null and plus parameters', () => {
  const params = { q: 'ää / 東京 🎬', repeated: ['one', 'two'], empty: '', bare: null, token_hash: 'a+b/c=' };
  const encoded = query.stringify(params, { sort: false });
  assert.deepEqual({ ...query.parse(encoded) }, params);
  assert.equal(query.parse('q=a+b').q, 'a b');
  assert.equal(query.parse('q=%2B').q, '+');
  assert.deepEqual(query.parse('x=1&x=2').x, ['1', '2']);
  assert.equal(query.parse('x=1&x=2&empty=&bare').empty, '');
  assert.equal(query.parse('x=1&x=2&empty=&bare').bare, null);
});

test('real Expo Router path readers/writers preserve canonical item and auth callback parameters', () => {
  const config = { screens: { Detail: 'discovery/:itemId', Confirm: 'auth/confirm', Recovery: 'auth/recovery' } };
  for (const [name, params] of [
    ['Detail', { itemId: 'canonical-item', deliveryId: 'actual-delivery', q: 'ää 東京' }],
    ['Confirm', { token_hash: 'a+b/c=', type: 'signup', empty: '' }],
    ['Recovery', { code: 'a+b/c=', type: 'recovery', next: 'one,two' }],
  ]) {
    const path = toPath({ routes: [{ name, params }] }, config);
    const restored = fromPath(path, config);
    assert.equal(restored.routes[0].name, name);
    assert.deepEqual({ ...restored.routes[0].params }, params);
  }
});

test('malformed percent input completes in a bounded separate process through the installed router parser', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { createRequire } from 'node:module';
    import assert from 'node:assert/strict';
    const require = createRequire(${JSON.stringify(import.meta.url)});
    const router = createRequire(require.resolve('expo-router/package.json'));
    const parse = router('./build/react-navigation/core/getStateFromPath.js').getStateFromPath;
    const hostile = '%E0%A4'.repeat(10000) + '%';
    const state = parse('/auth/confirm?token_hash=' + hostile + '&empty=&bare', { screens: { Confirm: 'auth/confirm' } });
    assert.equal(state.routes[0].name, 'Confirm');
    assert.equal(state.routes[0].params.empty, '');
    assert.equal(state.routes[0].params.bare, null);
    assert.equal(typeof state.routes[0].params.token_hash, 'string');
  `], { timeout: 3000, encoding: 'utf8', maxBuffer: 4096 });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
});

test('reviewed install patch is idempotent and rejects unexpected parent changes', () => {
  const installed = readFileSync(queryPath, 'utf8');
  assert.ok(routingDecoderInterop(installed) === installed, 'npm install must apply the reviewed decoder interop');
  assert.throws(() => routingDecoderInterop(installed + '\n// changed dependency\n'), /Unexpected patched query-string/);
  const decoderPath = createRequire(queryPath).resolve('decode-uri-component');
  assert.equal(JSON.parse(readFileSync(join(dirname(decoderPath), 'package.json'), 'utf8')).version, '0.5.0');
});

test('xcode uses the patched CommonJS UUID API to generate valid unique project identifiers', () => {
  const xcodePath = require.resolve('xcode');
  const xcodeRequire = createRequire(xcodePath);
  assert.equal(xcodeRequire('uuid/package.json').version, '11.1.1');
  const project = require('xcode').project('synthetic.xcodeproj/project.pbxproj');
  project.hash = { project: { objects: {} } };
  const ids = new Set(Array.from({ length: 100 }, () => project.generateUuid()));
  assert.equal(ids.size, 100);
  for (const id of ids) assert.match(id, /^[0-9A-F]{24}$/);
});
