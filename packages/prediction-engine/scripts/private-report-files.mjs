// Shared POSIX-only filesystem boundary for the two ephemeral owner reports.
import { constants } from 'node:fs';
import { lstat, open, realpath, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

export function createPrivateReportFiles({ reject, isReportError, maximumInputBytes, maximumOutputBytes }) {
  const assertPlatform = (platform = process.platform) => {
    if (!['linux', 'darwin'].includes(platform) || !Number.isInteger(constants.O_NOFOLLOW)
      || constants.O_NOFOLLOW <= 0 || !Number.isInteger(constants.O_NONBLOCK) || constants.O_NONBLOCK <= 0) reject('PLATFORM');
  };
  const readManifest = async path => {
    let handle;
    try {
      handle = await open(resolve(path), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const stat = await handle.stat();
      if (!stat.isFile()) reject('INPUT_FILE');
      if (stat.size > maximumInputBytes) reject('INPUT_TOO_LARGE');
      const bytes = Buffer.alloc(maximumInputBytes + 1);
      let length = 0;
      while (true) {
        if (length > maximumInputBytes) reject('INPUT_TOO_LARGE');
        const read = await handle.read(bytes, length, Math.min(64 * 1024, bytes.length - length), null);
        if (read.bytesRead === 0) break;
        length += read.bytesRead;
      }
      try { return JSON.parse(bytes.subarray(0, length).toString('utf8')); }
      catch { reject('MANIFEST_INVALID'); }
    } catch (error) {
      if (isReportError(error)) throw error;
      reject('INPUT_FILE');
    } finally { await handle?.close().catch(() => {}); }
  };
  const reportPath = async path => {
    // Traverse real ancestors, including worktree .git files and bare repos.
    const requested = resolve(path);
    let parent;
    try {
      parent = await realpath(dirname(requested));
      let ancestor = parent;
      while (true) {
        try { await lstat(join(ancestor, '.git')); reject('OUTPUT_LOCATION'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        try {
          await lstat(join(ancestor, 'HEAD'));
          await lstat(join(ancestor, 'objects'));
          await lstat(join(ancestor, 'refs'));
          reject('OUTPUT_LOCATION');
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        const next = dirname(ancestor);
        if (next === ancestor) break;
        ancestor = next;
      }
    } catch (error) {
      if (isReportError(error)) throw error;
      reject('OUTPUT_LOCATION');
    }
    return join(parent, basename(requested));
  };
  const writeReport = async (path, report) => {
    // Expanded support reports must be bounded by the exact bytes written, not
    // by their smaller compact JSON representation. Reserve no file on excess.
    let serialized;
    if (maximumOutputBytes !== undefined) {
      serialized = `${JSON.stringify(report, null, 2)}\n`;
      if (Buffer.byteLength(serialized, 'utf8') > maximumOutputBytes) reject('OUTPUT_TOO_LARGE');
    }
    let handle, identity, created = false;
    try {
      handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      created = true;
      identity = await handle.stat();
      await handle.writeFile(serialized ?? `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
    } catch (error) {
      // Never write before fd identity or unlink a preexisting/replaced inode.
      if (created && !identity) {
        try { identity = await handle.stat(); } catch { /* fail closed below */ }
      }
      await handle?.close().catch(() => {});
      if (created) {
        if (!identity) reject('OUTPUT_CLEANUP');
        try {
          const current = await lstat(path);
          if (current.dev !== identity.dev || current.ino !== identity.ino) reject('OUTPUT_CLEANUP');
          await unlink(path);
        } catch (cleanupError) { if (cleanupError.code !== 'ENOENT') reject('OUTPUT_CLEANUP'); }
      }
      reject(error.code === 'EEXIST' && !created ? 'OUTPUT_EXISTS' : 'OUTPUT_WRITE');
    }
  };
  return { assertPlatform, readManifest, reportPath, writeReport };
}
