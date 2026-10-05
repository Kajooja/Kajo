import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, verify as verifyNative } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { corrections, correctedSource, originalSource, projectRoot, securityPatches } from './security-patches.mjs';

const require = createRequire(import.meta.url);
const braces = require('braces');
const forge = require('node-forge');

test('all locked instances contain the exact security corrections', async () => {
  const receipt = await securityPatches();
  assert.deepEqual(new Set(receipt.map(value => value.name)), new Set(['braces', 'node-forge']));
});

test('source corrections are idempotent and reject unrelated edits or partial patches', async () => {
  for (const correction of corrections) {
    for (const file of correction.files) {
      const source = await readFile(resolve(projectRoot, 'node_modules', correction.name, file.path), 'utf8');
      const original = originalSource(source, file);
      assert.equal(correctedSource(original, file), source);
      assert.equal(correctedSource(source, file), source);
      assert.throws(() => correctedSource(source + '\n// unreviewed edit', file));
      assert.throws(() => correctedSource(original + '\n// unreviewed edit', file));
      if (file.replacements.length > 1) {
        const [before, after] = file.replacements[0];
        assert.throws(() => correctedSource(source.replace(after, before), file));
      }
    }
  }
});

test('braces preserves nested choices, ranges, escaping, literals and normal micromatch consumers', () => {
  assert.deepEqual(braces.expand('src/{a,{b,c}}/{1..2}.ts'), ['src/a/1.ts', 'src/a/2.ts', 'src/b/1.ts', 'src/b/2.ts', 'src/c/1.ts', 'src/c/2.ts']);
  assert.equal(braces.compile('src/{a,b}.ts'), 'src/(a|b).ts');
  assert.equal(braces.stringify(braces.parse('a/{b,c}')), 'a/{b,c}');
  for (const input of ['\\{'.repeat(200) + 'x', '"' + '{'.repeat(200) + '"', '[' + '{'.repeat(200) + ']']) {
    assert.doesNotThrow(() => braces(input));
  }
  for (const consumer of ['@expo/metro-file-map', 'metro-file-map']) {
    const consumerRequire = createRequire(require.resolve(`${consumer}/package.json`));
    const micromatch = consumerRequire('micromatch');
    assert.deepEqual(micromatch(['src/a.ts', 'src/b.tsx', 'src/c.js'], 'src/*.{ts,tsx}'), ['src/a.ts', 'src/b.tsx']);
    assert.deepEqual(micromatch.braceExpand('item/{book,movie}/{1..2}'), ['item/book/1', 'item/book/2', 'item/movie/1', 'item/movie/2']);
  }
});

test('deep brace and parenthesis patterns fail predictably within a bounded child', () => {
  const child = spawnSync(process.execPath, ['--stack-size=512', '--input-type=commonjs', '-e', `
    const assert = require('node:assert/strict');
    const braces = require(${JSON.stringify(require.resolve('braces'))});
    for (const [open, close] of [['{', '}'], ['(', ')']]) {
      const input = open.repeat(4000) + 'a,b' + close.repeat(4000);
      for (const method of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
        assert.throws(() => method(input), { name: 'SyntaxError', message: /supported depth/ });
      }
    }
    const input = '{('.repeat(2000) + 'a,b' + ')}'.repeat(2000);
    assert.throws(() => braces(input), { name: 'SyntaxError', message: /supported depth/ });
    assert.doesNotThrow(() => braces('{'.repeat(32) + 'a,b' + '}'.repeat(32)));
  `], { encoding: 'utf8', timeout: 5000, maxBuffer: 8192 });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
});

test('direct AST calls cannot bypass walker depth limits', () => {
  const tree = () => {
    const root = { type: 'root', nodes: [] };
    let node = root;
    for (let i = 0; i < 300; i++) {
      const child = { type: 'brace', nodes: [], parent: node };
      node.nodes.push(child);
      node = child;
    }
    node.nodes.push({ type: 'text', value: 'x' });
    return root;
  };
  for (const method of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => method(tree()), { name: 'SyntaxError', message: /supported depth/ });
  }
});

const nativeKeys = generateKeyPairSync('rsa', { modulusLength: 1024, publicExponent: 3 });
const privateKey = forge.pki.privateKeyFromPem(nativeKeys.privateKey.export({ type: 'pkcs1', format: 'pem' }));
const publicKey = forge.pki.publicKeyFromPem(nativeKeys.publicKey.export({ type: 'spki', format: 'pem' }));
const message = 'Kajo isolated DigestAlgorithm regression fixture';
const digest = forge.md.sha256.create().update(message).digest().getBytes();
const asn1 = forge.asn1;
const element = (type, value, constructed = false) => asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
const oid = () => element(asn1.Type.OID, asn1.oidToDer(forge.oids.sha256).getBytes());
const nullValue = (value = '') => element(asn1.Type.NULL, value);
const garbage = () => element(asn1.Type.OCTETSTRING, 'untrusted padding');
function signature(children, extra = []) {
  const info = element(asn1.Type.SEQUENCE, [element(asn1.Type.SEQUENCE, children, true), element(asn1.Type.OCTETSTRING, digest), ...extra], true);
  return privateKey.sign(asn1.toDer(info).getBytes(), 'NONE');
}

test('valid PKCS#1 signatures, optional NULL, wrong-message rejection and PSS remain compatible', () => {
  for (const children of [[oid()], [oid(), nullValue()]]) {
    assert.equal(publicKey.verify(digest, signature(children)), true);
  }
  for (const algorithm of ['sha1', 'sha256', 'sha512']) {
    const md = forge.md[algorithm].create().update(message);
    const signed = privateKey.sign(md);
    assert.equal(verifyNative(algorithm, Buffer.from(message), nativeKeys.publicKey, Buffer.from(signed, 'binary')), true);
    assert.equal(publicKey.verify(md.digest().getBytes(), signed), true);
    assert.equal(publicKey.verify(forge.md[algorithm].create().update('other').digest().getBytes(), signed), false);
  }
  const pss = () => forge.pss.create({ md: forge.md.sha256.create(), mgf: forge.mgf.mgf1.create(forge.md.sha256.create()), saltLength: 16 });
  const signed = privateKey.sign(forge.md.sha256.create().update(message), pss());
  assert.equal(publicKey.verify(digest, signed, pss()), true);
});

const malformed = [
  ['extra child after NULL', () => [oid(), nullValue(), garbage()]],
  ['extra child instead of optional NULL', () => [oid(), garbage()]],
  ['duplicate NULL', () => [oid(), nullValue(), nullValue()]],
  ['garbage inside primitive NULL', () => [oid(), nullValue('interior padding')]],
  ['missing OID', () => [nullValue()]],
];
for (const [name, children] of malformed) {
  test(`RSA verification rejects ${name}`, () => {
    const signed = signature(children());
    assert.throws(() => publicKey.verify(digest, signed), /DigestInfo/);
    assert.equal(verifyNative('sha256', Buffer.from(message), nativeKeys.publicKey, Buffer.from(signed, 'binary')), false);
  });
}
test('outer DigestInfo count check remains enforced', () => {
  assert.throws(() => publicKey.verify(digest, signature([oid(), nullValue()], [garbage()])), /DigestInfo/);
});

test('both distributed browser bundles reject the same malformed signatures', async () => {
  for (const file of corrections.find(value => value.name === 'node-forge').files.filter(value => value.path.startsWith('dist/'))) {
    const source = await readFile(resolve(projectRoot, 'node_modules/node-forge', file.path), 'utf8');
    const load = code => {
      // forge.all also loads optional form/XHR helpers; RSA does not use jQuery.
      const sandbox = { window: {}, module: { exports: {} }, exports: {}, jQuery: null };
      runInNewContext(code, sandbox, { timeout: 1000 });
      return sandbox.module.exports.pki.publicKeyFromPem(nativeKeys.publicKey.export({ type: 'spki', format: 'pem' }));
    };
    const patched = load(source);
    const original = load(originalSource(source, file));
    assert.equal(patched.verify(digest, signature([oid(), nullValue()])), true);
    assert.equal(patched.verify(digest, signature([oid()])), true);
    for (const [, children] of malformed.slice(0, 4)) {
      const signed = signature(children());
      assert.equal(original.verify(digest, signed), true);
      assert.throws(() => patched.verify(digest, signed), /DigestInfo/);
    }
  }
});

test('negative controls reproduce both defects in pristine upstream source', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'kajo-security-controls-'));
  try {
    for (const correction of corrections) {
      const directory = join(temporary, correction.name);
      await cp(resolve(projectRoot, 'node_modules', correction.name), directory, { recursive: true });
      for (const file of correction.files) {
        const path = join(directory, file.path);
        await writeFile(path, originalSource(await readFile(path, 'utf8'), file));
      }
    }
    // Upstream braces' fill-range dependency is provided by the existing tree.
    const child = spawnSync(process.execPath, ['--stack-size=512', '--input-type=commonjs', '-e', `
      const assert = require('node:assert/strict');
      const braces = require(${JSON.stringify(join(temporary, 'braces'))});
      assert.throws(() => braces('{'.repeat(4000) + 'a,b' + '}'.repeat(4000)), { name: 'RangeError' });
    `], { encoding: 'utf8', timeout: 5000, maxBuffer: 8192, env: { ...process.env, NODE_PATH: resolve(projectRoot, 'node_modules') } });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
    const originalForge = require(join(temporary, 'node-forge'));
    const originalPublicKey = originalForge.pki.publicKeyFromPem(nativeKeys.publicKey.export({ type: 'spki', format: 'pem' }));
    for (const [, children] of malformed.slice(0, 4)) {
      assert.equal(originalPublicKey.verify(digest, signature(children())), true, 'Control must prove upstream accepts the malformed structure');
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
