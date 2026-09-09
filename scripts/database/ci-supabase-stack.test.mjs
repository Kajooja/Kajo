import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifySupabaseStartFailure, verifyCiPostgresImage, verifyLocalPostgresImage,
  withLocalSupabaseStack } from './ci-supabase-stack.mjs';

test('CI accepts verified Supabase registry aliases but rejects changed content, version or registry', () => {
  const digest = 'sha256:66089200353d90686fe9b252a47d17d078364bf47c50190852c33dc850a0191f';
  for (const registry of ['public.ecr.aws', 'ghcr.io']) {
    assert.doesNotThrow(() => verifyCiPostgresImage(`${registry}/supabase/postgres:17.6.1.167 ${digest}`));
  }
  assert.throws(() => verifyCiPostgresImage(`public.ecr.aws/supabase/postgres:17.6.1.167 ${digest.replace('660892', '000000')}`), /content changed/);
  assert.throws(() => verifyCiPostgresImage(`ghcr.io/supabase/postgres:latest ${digest}`), /Unreviewed/);
  assert.throws(() => verifyCiPostgresImage(`unreviewed.invalid/supabase/postgres:17.6.1.167 ${digest}`), /Unreviewed/);
});

test('failed startup reports bounded symptoms without echoing CLI credentials', () => {
  const privateOutput = 'postgresql://postgres:synthetic-secret@localhost/postgres key=synthetic-key';
  assert.deepEqual(classifySupabaseStartFailure(`failed to pull image: connection reset ${privateOutput}`), ['image-download', 'network']);
  assert.deepEqual(classifySupabaseStartFailure(`port is already allocated ${privateOutput}`), ['port-binding']);
  assert.deepEqual(classifySupabaseStartFailure(`container is unhealthy: no space left ${privateOutput}`), ['container-health', 'resource-pressure']);
  assert.deepEqual(classifySupabaseStartFailure(privateOutput), ['unclassified']);
  assert.deepEqual(classifySupabaseStartFailure(''), ['unclassified']);
});

test('local installation requires a new absolute workspace and the reviewed architecture image', async () => {
  await assert.rejects(withLocalSupabaseStack('relative-path', () => {}), /absolute path/);
  const mac = 'public.ecr.aws/supabase/postgres:17.6.1.167 sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb';
  assert.doesNotThrow(() => verifyLocalPostgresImage(mac, 'darwin', 'arm64'));
  assert.throws(() => verifyLocalPostgresImage(mac, 'linux', 'x64'), /content changed/);
  assert.throws(() => verifyLocalPostgresImage(mac, 'linux', 'arm64'), /No reviewed/);
});

test('platform-only stack lifecycle loads without application source modules or npm dependencies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-platform-module-'));
  try {
    for (const name of ['ci-supabase-stack.mjs', 'buffered-sql-command.mjs']) {
      await copyFile(new URL(name, import.meta.url), join(directory, name));
    }
    execFileSync(process.execPath, ['--input-type=module', '-e', "await import('./ci-supabase-stack.mjs')"],
      { cwd: directory, stdio: 'pipe' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
