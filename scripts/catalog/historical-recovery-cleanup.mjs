// Local POSIX recovery only. Never log key bytes, private paths or child output.
import { execFileSync, spawnSync } from 'node:child_process';
import { lstat, open, readFile, readdir, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const historicalKeyPaths = out => [
  'predecessor-inputs/recipient-key',
  'edition-recovery/predecessor-inputs/recipient-key',
  'edition-recovery/conflict-recovery/predecessor-inputs/recipient-key',
].map(path => join(resolve(out), path));

// SIGKILL being sent is not evidence that an in-flight descendant has stopped.
// Ignore zombies (which cannot execute), but wait for every live group member
// before erasing files. ps uses no caller-controlled options or shell expansion.
export async function waitForHistoricalGroupExit(groupId, timeoutMs = 3000) {
  if (!Number.isSafeInteger(groupId) || groupId <= 0 || process.platform === 'win32')
    throw new Error('invalid-historical-process-group');
  const deadline = Date.now() + timeoutMs;
  do {
    let rows;
    try {
      if (process.platform === 'linux') {
        // Some container runtimes cannot run procps from a nested child. Read
        // Linux's process state directly. /proc can belong to an outer PID
        // namespace: translate NSpgid at our depth instead of falsely treating
        // a namespaced group ID as absent in the host's stat files.
        const ownStatus = await readFile('/proc/self/status', 'utf8');
        const ownIds = /^NSpid:\s+(.+)$/m.exec(ownStatus)?.[1].trim().split(/\s+/).map(Number);
        if (!ownIds || ownIds.at(-1) !== process.pid) throw new Error('unknown-pid-namespace');
        const depth = ownIds.length - 1;
        const pids = (await readdir('/proc')).filter(name => /^\d+$/.test(name));
        rows = await Promise.all(pids.map(async pid => {
          let status;
          try { status = await readFile(`/proc/${pid}/status`, 'utf8'); }
          catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) return ''; throw error; }
          const groups = /^NSpgid:\s+(.+)$/m.exec(status)?.[1].trim().split(/\s+/).map(Number);
          const state = /^State:\s+(\S+)/m.exec(status)?.[1];
          if (!groups || !state) throw new Error('unknown-process-state');
          return `${groups[depth] ?? 0} ${state}`;
        }));
      } else {
        rows = execFileSync('ps', ['-eo', 'pgid=,stat='], { encoding: 'utf8', timeout: 1000,
          maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n');
      }
    } catch { throw new Error('historical-process-group-unverified'); }
    const live = rows.some(row => {
      const [group, state] = row.trim().split(/\s+/);
      return Number(group) === groupId && state && !/^[ZX]/.test(state);
    });
    if (!live) return;
    await delay(10);
  } while (Date.now() < deadline);
  throw new Error('historical-process-group-still-running');
}

const verifyScript = `import { lstatSync } from 'node:fs';
for (const path of process.argv.slice(1)) {
  try { lstatSync(path); process.exit(1); }
  catch (error) { if (error.code !== 'ENOENT') process.exit(1); }
}`;

// A fresh process observes the deletions independently of the recovery's fs
// objects. Operators must additionally verify absence after the command returns.
export function verifyHistoricalKeysAbsent(out) {
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', verifyScript, ...historicalKeyPaths(out)],
    { env: { ...process.env, NODE_OPTIONS: '' }, timeout: 5000, stdio: 'ignore' });
  if (child.error || child.signal || child.status !== 0) throw new Error('historical-key-cleanup-unverified');
}

export async function cleanHistoricalKeys(out) {
  const results = await Promise.allSettled(historicalKeyPaths(out).map(async path => {
    try { await unlink(path); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Flush directory metadata, including a deletion already made by the child.
    let directory;
    try { directory = await open(dirname(path), 'r'); await directory.sync(); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    finally { await directory?.close(); }
    try { await lstat(path); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    throw new Error('historical-key-still-present');
  }));
  // Attempt every removal even when an earlier path is inaccessible. Never let
  // a cleanup error expose a path, or leave the remaining copies unattempted.
  if (results.some(result => result.status === 'rejected')) throw new Error('historical-key-cleanup-failed');
  verifyHistoricalKeysAbsent(out);
}
