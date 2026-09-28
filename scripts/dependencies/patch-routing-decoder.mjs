import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGINAL_SHA256 = 'caa3f2c8b45dfe1e91db22ae10743af68de8d96f26515132bb52485ec0f037fa';
const originalImport = "const decodeComponent = require('decode-uri-component');";
const fixedImport = "const decodeComponent = require('decode-uri-component').default;";
const hash = value => createHash('sha256').update(value).digest('hex');

// query-string 7 is the CommonJS API used by Expo Router 57. Its safe decoder
// release is ESM. Retain the parent API and unwrap only that reviewed export;
// overriding either package alone otherwise breaks native deep links.
export function routingDecoderInterop(source) {
  if (source.includes(fixedImport)) {
    const original = source.replace(fixedImport, originalImport);
    assert.equal(hash(original), ORIGINAL_SHA256, 'Unexpected patched query-string source; review the dependency change');
    return source;
  }
  assert.equal(hash(source), ORIGINAL_SHA256, 'Unexpected query-string source; review the dependency change');
  return source.replace(originalImport, fixedImport);
}

export async function installRoutingDecoderInterop() {
  const require = createRequire(import.meta.url);
  const routerRequire = createRequire(require.resolve('expo-router/package.json'));
  const path = routerRequire.resolve('query-string');
  const queryPackage = JSON.parse(await readFile(join(dirname(path), 'package.json'), 'utf8'));
  assert.equal(queryPackage.version, '7.1.3', 'Review/remove decoder interop when upgrading the routing parent');
  const decoder = createRequire(path).resolve('decode-uri-component');
  const decoderPackage = JSON.parse(await readFile(join(dirname(decoder), 'package.json'), 'utf8'));
  assert.equal(decoderPackage.version, '0.5.0', 'The patched, reviewed decoder is required');
  const source = await readFile(path, 'utf8');
  const patched = routingDecoderInterop(source);
  if (patched !== source) await writeFile(path, patched);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await installRoutingDecoderInterop();
  console.log('Reviewed query-string/decoder compatibility applied.');
}
