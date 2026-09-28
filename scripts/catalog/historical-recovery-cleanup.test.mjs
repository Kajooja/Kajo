import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { cleanHistoricalKeys, historicalKeyPaths, verifyHistoricalKeysAbsent, waitForHistoricalGroupExit } from './historical-recovery-cleanup.mjs';

async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'kajo-cleanup-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function stage(root) {
  for (const path of historicalKeyPaths(root)) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, 'SYNTHETIC_KEY', { mode: 0o600 });
  }
}

test('a live Linux group is not mistaken for an absent group inside a nested PID namespace', { skip: process.platform !== 'linux' }, async () => {
  const status = await readFile('/proc/self/status', 'utf8');
  const group = Number(/^NSpgid:\s+(.+)$/m.exec(status)[1].trim().split(/\s+/).at(-1));
  await assert.rejects(waitForHistoricalGroupExit(group, 1), /historical-process-group-still-running/);
});

test('cleanup completes across separate process exit and independent verifier, including repeated cleanup', async t => {
  const root = await directory(t); await stage(root);
  assert.throws(() => verifyHistoricalKeysAbsent(root), /historical-key-cleanup-unverified/);
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval',
    `import { cleanHistoricalKeys } from ${JSON.stringify(new URL('./historical-recovery-cleanup.mjs', import.meta.url).href)};
await cleanHistoricalKeys(process.argv[1]);`, root], { encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout, '');
  verifyHistoricalKeysAbsent(root);
  await cleanHistoricalKeys(root);
  for (const path of historicalKeyPaths(root)) await assert.rejects(lstat(path), { code: 'ENOENT' });
});

test('one failed removal cannot prevent either remaining key from being erased', async t => {
  const root = await directory(t); await stage(root);
  const [blocked, ...others] = historicalKeyPaths(root);
  await rm(blocked); await mkdir(blocked);
  await assert.rejects(cleanHistoricalKeys(root), error => error.message === 'historical-key-cleanup-failed');
  for (const path of others) await assert.rejects(lstat(path), { code: 'ENOENT' });
  assert.throws(() => verifyHistoricalKeysAbsent(root), /historical-key-cleanup-unverified/);
});

test('a dangling key symlink is removed rather than mistaken for an absent key', async t => {
  const root = await directory(t), [path] = historicalKeyPaths(root);
  await mkdir(dirname(path)); await symlink(join(root, 'missing'), path);
  assert.throws(() => verifyHistoricalKeysAbsent(root), /historical-key-cleanup-unverified/);
  await cleanHistoricalKeys(root); await assert.rejects(lstat(path), { code: 'ENOENT' });
});
