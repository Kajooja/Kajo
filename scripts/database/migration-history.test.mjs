import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const directory = new URL('../../supabase/migrations/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('migration-history.json', import.meta.url), 'utf8'));

test('accepted historical migration bytes remain unchanged', async () => {
  assert.equal(manifest.formatVersion, 1);
  const entries = Object.entries(manifest.files);
  assert.ok(entries.length > 0, 'Historical manifest must not be empty');
  for (const [name, expected] of entries) {
    assert.match(name, /^\d{14}_[a-z0-9_]+\.sql$/);
    assert.match(expected, /^[a-f0-9]{64}$/);
    const actual = createHash('sha256').update(await readFile(new URL(name, directory))).digest('hex');
    assert.equal(actual, expected, `${name}: immutable history changed; use a forward migration`);
  }
});

test('new migrations are ordered after the protected history with unique versions', async () => {
  const protectedNames = Object.keys(manifest.files);
  const cutoff = protectedNames.map(name => name.slice(0, 14)).sort().at(-1);
  const versions = new Set();
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql'))) {
    assert.match(name, /^\d{14}_[a-z0-9_]+\.sql$/);
    const version = name.slice(0, 14);
    assert.ok(!versions.has(version), `Duplicate migration version ${version}`);
    versions.add(version);
    if (!Object.hasOwn(manifest.files, name)) {
      assert.ok(version > cutoff, `${name}: do not insert unrecorded migrations into protected history`);
    }
  }
});
