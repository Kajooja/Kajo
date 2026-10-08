import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifySupabaseStartFailure, verifyCiPostgresImage, verifyLocalPostgresImage,
  withLocalSupabaseStack, runIsolatedSqlProbe } from './ci-supabase-stack.mjs';

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

test('named SQL probes preserve input, bound both server and client, and retain SQL failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-sql-budget-'));
  try {
    const receiver = join(directory, 'receiver.mjs');
    await writeFile(receiver, `import {readFileSync} from 'node:fs';
      const sql=readFileSync(process.argv.find(a=>a.startsWith('--file=')).slice(7),'utf8');
      console.log(JSON.stringify({sql}));`);
    const sql = "begin; -- äö $() ` ' \n rollback;";
    let requested;
    const docker = (args, options) => {
      requested = { args, options };
      const command = args.slice(args.indexOf('sh'));
      command.splice(command.indexOf('psql'), 1, process.execPath, receiver);
      return execFileSync(command[0], command.slice(1), { input: options.input, timeout: options.timeout, encoding: 'utf8' });
    };
    assert.deepEqual(await runIsolatedSqlProbe(docker, 'owned-container', sql,
      { stage: 'catalog-chain-upgrade', timeoutMs: 360_000 }), [{ sql }]);
    assert.equal(requested.options.timeout, 360_000);
    assert.ok(requested.args.includes('PGOPTIONS=-c statement_timeout=355000 -c lock_timeout=30000'));
    assert.ok(requested.args.includes('owned-container'));
    await runIsolatedSqlProbe(docker, 'owned-container', sql);
    assert.equal(requested.options.timeout, 120_000, 'Existing probes retain the original bounded default');
    assert.ok(requested.args.includes('PGOPTIONS=-c statement_timeout=115000 -c lock_timeout=30000'));
    await assert.rejects(runIsolatedSqlProbe(() => { throw new Error('ERROR: source hash guard rejected'); },
      'owned-container', sql, { stage: 'catalog-chain-upgrade' }), /catalog-chain-upgrade failed: ERROR: source hash guard rejected/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a real SQL client deadline identifies its stage without leaking input or process diagnostics', async () => {
  const sql = 'synthetic-private-sql';
  const docker = (_args, options) => {
    assert.ok(_args.includes('PGOPTIONS=-c statement_timeout=500 -c lock_timeout=30000'));
    const result = spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'],
      { input: options.input, timeout: options.timeout, encoding: 'utf8' });
    if (result.error) throw result.error;
    return result.stdout;
  };
  await assert.rejects(runIsolatedSqlProbe(docker, 'owned-container', sql,
    { stage: 'catalog-chain-upgrade', timeoutMs: 1000 }), error => {
    assert.equal(error.message, 'Isolated SQL catalog-chain-upgrade exceeded Docker deadline 1000ms');
    assert.equal(error.cause.code, 'ETIMEDOUT');
    assert.ok(!error.message.includes(sql));
    return true;
  });
  for (const options of [{ stage: 'secret query text' }, { timeoutMs: 600_001 }, { timeoutMs: Infinity }, { timeoutMs: 0 }]) {
    await assert.rejects(runIsolatedSqlProbe(() => assert.fail('Invalid options must not start a process'),
      'owned-container', sql, options));
  }
});
