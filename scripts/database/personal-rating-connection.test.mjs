import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { personalRatingConnectionCommand, probePersonalRatingSqlSession, readPersonalRatingConnectionConfig,
  runPersonalRatingConnectionCli, withPersonalRatingSqlSession } from './personal-rating-connection.mjs';

const config = { version: 'personal-rating-connection-v1', projectRef: 'abcdefghijklmnopqrst',
  psqlPath: '/reviewed/psql', caFile: '/private/ca.pem', passwordFile: '/private/password' };
const identity = { database: 'postgres', user: 'postgres', sessionUser: 'postgres', serverVersionNum: 170006 };

test('explicit target and TLS command excludes inherited connection overrides and credentials', () => {
  const command = personalRatingConnectionCommand(config);
  assert.equal(command.command, config.psqlPath);
  assert.deepEqual(command.args, ['-X', '-qAt', '-w', '--no-readline', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=sqlstate']);
  const env = command.options.env;
  assert.equal(env.PGHOST, 'db.abcdefghijklmnopqrst.supabase.co');
  assert.equal(env.PGSSLMODE, 'verify-full');
  assert.equal(env.PGSSLROOTCERT, config.caFile);
  assert.equal(env.PGPASSFILE, config.passwordFile);
  assert.equal(env.PGGSSENCMODE, 'disable');
  for (const key of ['PGPASSWORD', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'NODE_OPTIONS', 'LD_PRELOAD', 'SUPABASE_ACCESS_TOKEN']) {
    assert.equal(Object.hasOwn(env, key), false, key);
  }
  assert.ok(!command.args.some(value => value.includes(config.projectRef) || value.includes(config.passwordFile)));
  assert.match(env.PGOPTIONS, /statement_timeout=30000.*lock_timeout=5000.*idle_in_transaction_session_timeout=30000/);
  assert.notEqual(personalRatingConnectionCommand(config).options.env.PGAPPNAME, env.PGAPPNAME);
});

test('unknown overrides, URI-like targets and unsafe paths fail before connection', () => {
  for (const value of [null, [], { ...config, password: 'synthetic-secret' }, { ...config, host: 'foreign.example' },
    { ...config, projectRef: 'postgres://synthetic-secret@foreign' }, { ...config, projectRef: 'abcdefghijklmnopqrst,foreign' },
    { ...config, psqlPath: 'psql' }, { ...config, caFile: '/private/ca\nfile' }, { ...config, version: 'unknown' }]) {
    assert.throws(() => personalRatingConnectionCommand(value), error => /^PERSONAL_RATING_CONNECTION_/.test(error.message)
      && !/secret|foreign/.test(error.message));
  }
});

function fakeSession(change = {}) {
  const calls = [];let marker, witness = 0;
  return { calls, run: async work => work(async (sql, { stage }) => {
    calls.push({ sql, stage });
    if (stage === 'probe-rollback' && change.rollbackError) throw new Error('rollback failed');
    const match = /set local kajo.personal_rating_probe='([a-z0-9-]+)'/.exec(sql);
    if (match) marker = match[1];
    if (!stage.startsWith('probe-bef') && stage !== 'probe-after') return [];
    const row = { ...identity, pid: 123, transactionAt: '2026-01-01 00:00:00.123456+00',
      isolation: 'repeatable read', readOnly: 'on', marker };
    return [{ ...row, ...(witness++ === 0 ? change.before : change.after) }];
  }) };
}

test('probe spans awaited JavaScript inside read-only transaction and always rolls back', async () => {
  const session = fakeSession();
  const result = await probePersonalRatingSqlSession(session.run);
  assert.equal(result.status, 'PASS');assert.equal(result.javascriptRoundTrip, true);
  assert.equal(result.applicationRowsRead, false);assert.equal(result.collectionStarted, false);
  assert.deepEqual(session.calls.map(row => row.stage),
    ['probe-begin', 'probe-before', 'probe-compute', 'probe-after', 'probe-rollback']);
  assert.match(session.calls[0].sql, /begin isolation level repeatable read read only/);
  assert.match(session.calls[2].sql, /'[a-f0-9]{64}'/);
  assert.equal(session.calls.at(-1).sql, 'rollback;');
  assert.ok(session.calls.every(row => !/\b(?:commit|insert|update|delete|create|alter)\b/i.test(row.sql)));
  assert.ok(!/pid|transactionAt|marker/.test(JSON.stringify(result)));
});

test('changed backend, transaction, role, major version, read-only state or computed marker fails closed', async () => {
  for (const after of [{ pid: 124 }, { transactionAt: 'changed' }, { user: 'service_role' },
    { sessionUser: 'foreign' }, { database: 'foreign' }, { serverVersionNum: 180000 },
    { readOnly: 'off' }, { isolation: 'read committed' }, { marker: 'not-the-computed-result' }]) {
    const session = fakeSession({ after });
    await assert.rejects(probePersonalRatingSqlSession(session.run), /PROBE_CONTINUITY/);
    assert.equal(session.calls.at(-1).stage, 'probe-rollback');
  }
  const badBegin = fakeSession({ before: { readOnly: 'off' } });
  await assert.rejects(probePersonalRatingSqlSession(badBegin.run), /PROBE_CONTEXT/);
  assert.equal(badBegin.calls.at(-1).stage, 'probe-rollback');
  await assert.rejects(probePersonalRatingSqlSession(fakeSession({ rollbackError: true }).run), /rollback failed/);
});

// An actual spawned process exercises launch/environment/framing/cleanup only.
// The native CI probe separately verifies PostgreSQL transaction semantics.
async function fixture(run, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'kajo-rating-connection-'));
  const cfg = { ...config, psqlPath: join(dir, 'psql-fixture'), caFile: join(dir, 'ca.pem'),
    passwordFile: join(dir, 'password') };
  const configPath = join(dir, 'connection.json');
  const source = `#!${process.execPath}
const fs=require('node:fs');const input=require('node:readline').createInterface({input:process.stdin});
fs.writeFileSync(${JSON.stringify(join(dir, 'launch.json'))},JSON.stringify({argv:process.argv.slice(2),env:process.env,pid:process.pid}));
let sql='',marker='';input.on('line',line=>{
 if(line==='\\\\q')process.exit(0);
 if(line.startsWith('\\\\echo ')){
  const match=/set local kajo.personal_rating_probe='([a-z0-9-]+)'/.exec(sql);if(match)marker=match[1];
  if(sql.includes('jsonb_build_object')){
   const row=sql.includes('transactionAt')?${JSON.stringify({ ...identity, pid: 456, transactionAt: '2026-01-01+00', isolation: 'repeatable read', readOnly: 'on' })}:${JSON.stringify({ ...identity, ssl: options.ssl ?? true, ...options.identity })};
   if(sql.includes('transactionAt'))row.marker=marker;
   process.stdout.write(JSON.stringify(row)+'\\n');
  }
  process.stdout.write(line.slice(6)+'\\n');sql='';
 }else sql+=line+'\\n';
});input.on('close',()=>process.exit(0));
`;
  try {
    await writeFile(cfg.psqlPath, source, { mode: 0o700 });
    await writeFile(cfg.caFile, 'synthetic-certificate');
    await writeFile(cfg.passwordFile, 'synthetic-private-password', { mode: 0o600 });
    await writeFile(configPath, JSON.stringify(cfg), { mode: 0o600 });
    await run({ dir, cfg, configPath });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('private config file parsing refuses permissive files, symlinks, unknown secrets and oversized input', async () => {
  await fixture(async ({ cfg, configPath, dir }) => {
    assert.deepEqual(await readPersonalRatingConnectionConfig(configPath), cfg);
    await chmod(configPath, 0o644);
    await assert.rejects(readPersonalRatingConnectionConfig(configPath), /PRIVATE_FILE/);
    await chmod(configPath, 0o600);
    const link = join(dir, 'link');await symlink(configPath, link);
    await assert.rejects(readPersonalRatingConnectionConfig(link), /CONNECTION_FILE/);
    await writeFile(configPath, JSON.stringify({ ...cfg, password: 'synthetic-secret' }));
    await assert.rejects(readPersonalRatingConnectionConfig(configPath), /CONNECTION_CONFIG/);
    await writeFile(configPath, ' '.repeat(8193));
    await assert.rejects(readPersonalRatingConnectionConfig(configPath), /CONFIG_SIZE/);
    await assert.rejects(readPersonalRatingConnectionConfig('relative.json'), /CONFIG_PATH/);
  });
});

test('configured connection uses one owned process without inheriting malicious PG or Node options', async () => {
  await fixture(async ({ cfg, dir }) => {
    const saved = process.env.PGHOSTADDR;process.env.PGHOSTADDR = '192.0.2.1';
    try {
      const result = await probePersonalRatingSqlSession(work => withPersonalRatingSqlSession(cfg, work));
      assert.equal(result.status, 'PASS');
    } finally { if (saved === undefined) delete process.env.PGHOSTADDR;else process.env.PGHOSTADDR = saved; }
    const launch = JSON.parse(await readFile(join(dir, 'launch.json'), 'utf8'));
    assert.equal(launch.env.PGHOSTADDR, undefined);
    assert.equal(launch.env.PGPASSWORD, undefined);
    assert.equal(launch.env.PGSSLMODE, 'verify-full');
    assert.throws(() => process.kill(launch.pid, 0), { code: 'ESRCH' });
  });
});

test('missing TLS or wrong server identity refuses callback and closes process', async () => {
  for (const options of [{ ssl: false }, { identity: { user: 'service_role' } }, { identity: { serverVersionNum: 160000 } }]) {
    await fixture(async ({ cfg, dir }) => {
      let called = false;
      await assert.rejects(withPersonalRatingSqlSession(cfg, async () => { called = true; }), /IDENTITY_OR_TLS/);
      assert.equal(called, false);
      const { pid } = JSON.parse(await readFile(join(dir, 'launch.json'), 'utf8'));
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    }, options);
  }
});

test('password-file permission failure happens before process launch', async () => {
  await fixture(async ({ cfg, dir }) => {
    await chmod(cfg.passwordFile, 0o644);
    await assert.rejects(withPersonalRatingSqlSession(cfg, async () => {}), /PRIVATE_FILE/);
    await assert.rejects(readFile(join(dir, 'launch.json')), { code: 'ENOENT' });
  });
});

test('CLI exposes only probe, prints no private paths or server output on failure', async () => {
  await assert.rejects(runPersonalRatingConnectionCli(['capture', '/private/config']), /USAGE/);
  const result = spawnSync(process.execPath, ['scripts/database/personal-rating-connection.mjs', 'probe', '/missing/private-secret'], { encoding: 'utf8' });
  assert.equal(result.status, 1);assert.equal(result.stdout, '');
  assert.ok(!/private-secret|ENOENT|stack|password/.test(result.stderr));
});
