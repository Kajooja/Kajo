import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { bufferedSqlCommand } from './buffered-sql-command.mjs';

test('large SQL is delivered intact and an early command failure retains its error and cleans the temporary file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-sql-transport-test-'));
  try {
    const receiver = join(directory, 'receiver.mjs');
    await writeFile(receiver, `import {readFileSync,statSync} from 'node:fs';
      import {createHash} from 'node:crypto';
      const file=process.argv.find(a=>a.startsWith('--file=')).slice(7);
      const data=readFileSync(file);
      console.log(JSON.stringify({file,mode:statSync(file).mode&511,
        hash:createHash('sha256').update(data).digest('hex')}));
      if(process.argv[2]==='3') console.error('SQL guard rejected the existing installation');
      process.exitCode=Number(process.argv[2]);`);
    const sql = "-- SQL bytes: äö🙂 ' $() ` ;\n".repeat(180_000);
    for (const status of [0, 3]) {
      const command = bufferedSqlCommand([process.execPath, receiver, String(status)]);
      const result = spawnSync(command[0], command.slice(1), { input: sql, encoding: 'utf8', timeout: 15_000 });
      assert.equal(result.error, undefined, 'SQL errors must not become transport EPIPE errors');
      assert.equal(result.status, status);
      const output = JSON.parse(result.stdout);
      assert.equal(output.hash, createHash('sha256').update(sql).digest('hex'));
      assert.equal(output.mode, 0o600);
      assert.equal(existsSync(output.file), false, 'Temporary SQL must be removed after success and failure');
      if (status === 3) assert.match(result.stderr, /SQL guard rejected the existing installation/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
