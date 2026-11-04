import assert from 'node:assert/strict';
import { lstat, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { personalRatingPrivateProbeFailure, validatePersonalRatingPrivateRun, withPersonalRatingPrivateFiles } from './personal-rating-private-probe.mjs';
import { readPersonalRatingConnectionConfig } from './personal-rating-connection.mjs';
import { withIsolatedSqlSession } from './isolated-sql-session.mjs';

const source = 'a'.repeat(40);
const event = { repository: { private: true, full_name: 'owner/private-ops', owner: { login: 'owner' } } };
const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main',
  GITHUB_REPOSITORY: 'owner/private-ops', GITHUB_REPOSITORY_OWNER: 'owner', GITHUB_ACTOR: 'owner',
  GITHUB_TRIGGERING_ACTOR: 'owner', KAJO_REVIEWED_SOURCE_SHA: source };
const input = { projectRef: 'abcdefghijklmnopqrst', poolerHost: 'aws-0-eu-west-1.pooler.supabase.com',
  psqlPath: '/reviewed/psql', password: 'synthetic:password\\with-symbols',
  ca: '-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----\n' };

test('private runner rejects public, automatic, foreign-owner, non-main and unreviewed source contexts', () => {
  assert.doesNotThrow(() => validatePersonalRatingPrivateRun(event, env, source));
  for (const change of [{ GITHUB_ACTIONS: 'false' }, { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_EVENT_NAME: 'pull_request_target' }, { GITHUB_REF: 'refs/heads/feature' },
    { GITHUB_REPOSITORY: 'other/private-ops' }, { GITHUB_REPOSITORY_OWNER: '' },
    { GITHUB_ACTOR: 'collaborator' }, { GITHUB_TRIGGERING_ACTOR: 'collaborator' },
    { KAJO_REVIEWED_SOURCE_SHA: 'main' }, { KAJO_REVIEWED_SOURCE_SHA: 'b'.repeat(40) }]) {
    assert.throws(() => validatePersonalRatingPrivateRun(event, { ...env, ...change }, source), /CONFIGURATION/);
  }
  assert.throws(() => validatePersonalRatingPrivateRun({ repository: { ...event.repository, private: false } }, env, source), /CONFIGURATION/);
  assert.throws(() => validatePersonalRatingPrivateRun({ repository: { private: true } },
    { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: env.GITHUB_REF,
      KAJO_REVIEWED_SOURCE_SHA: source }, source), /CONFIGURATION/);
});

test('private inputs create exact non-wildcard password record, closed config and owner-only temporary files', async () => {
  let folder;
  await withPersonalRatingPrivateFiles(input, async path => {
    folder = dirname(path);
    assert.equal((await lstat(folder)).mode & 0o777, 0o700);
    const config = await readPersonalRatingConnectionConfig(path);
    assert.equal(config.version, 'personal-rating-session-connection-v1');
    assert.equal(config.poolerHost, input.poolerHost);
    const password = await readFile(config.passwordFile, 'utf8');
    assert.equal(password,
      'aws-0-eu-west-1.pooler.supabase.com:5432:postgres:postgres.abcdefghijklmnopqrst:synthetic\\:password\\\\with-symbols\n');
    for (const file of [path, config.passwordFile, config.caFile]) assert.equal((await lstat(file)).mode & 0o777, 0o600);
    assert.ok(!(await readFile(path, 'utf8')).includes(input.password));
    assert.equal(await readFile(config.caFile, 'utf8'), input.ca);
  });
  await assert.rejects(lstat(folder), { code: 'ENOENT' });
});

test('private input rejection and callback failure cannot leave secret files behind', async () => {
  for (const password of ['', 'with\nnewline', 'with\rreturn', 'with\0nul', 'a'.repeat(4097)]) {
    let called = false;
    await assert.rejects(withPersonalRatingPrivateFiles({ ...input, password }, () => { called = true; }), /CONFIGURATION/);
    assert.equal(called, false);
  }
  let folder;
  await assert.rejects(withPersonalRatingPrivateFiles(input, path => {
    folder = dirname(path);throw new Error('synthetic callback failure');
  }), /callback failure/);
  await assert.rejects(lstat(folder), { code: 'ENOENT' });
  await assert.rejects(withPersonalRatingPrivateFiles({ ...input, poolerHost: 'foreign.example' }, () => {}), /POOLER_HOST/);
});

test('private CLI failure does not print credentials, paths, environment or child errors', () => {
  const result = spawnSync(process.execPath, ['scripts/database/personal-rating-private-probe.mjs'], {
    encoding: 'utf8', env: { PATH: '/usr/bin:/bin', KAJO_DB_PASSWORD: 'synthetic-private-secret',
      GITHUB_EVENT_PATH: '/missing/private-event-path' },
  });
  assert.equal(result.status, 1);assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    version: 'personal-rating-private-probe-failure-v1', status: 'FAIL',
    stage: Number(process.versions.node.split('.')[0]) === 22 ? 'EVENT' : 'RUNTIME',
    cause: Number(process.versions.node.split('.')[0]) === 22 ? 'UNKNOWN' : 'CONFIGURATION',
    queryStage: null, connectionHint: 'UNKNOWN', sqlstate: null,
  });
  assert.doesNotMatch(result.stderr, /synthetic-private-secret|private-event-path|ENOENT/);
});

test('private diagnostics allow only exact connection invariants and fixed runner stages', () => {
  for (const cause of ['TARGET', 'POOLER_HOST', 'PRIVATE_FILE', 'SESSION_SETTINGS', 'IDENTITY_OR_TLS',
    'PROBE_CONTEXT', 'PROBE_CONTINUITY']) {
    const report = personalRatingPrivateProbeFailure(new Error('PERSONAL_RATING_CONNECTION_' + cause), 'CONNECTION');
    assert.equal(report.cause, cause);assert.equal(report.stage, 'CONNECTION');
  }
  const secret = 'synthetic-private-value';
  for (const error of [new Error(secret), new Error('PERSONAL_RATING_CONNECTION_' + secret),
    new Error('PERSONAL_RATING_CONNECTION_IDENTITY_OR_TLS\n' + secret),
    { message: 'PERSONAL_RATING_CONNECTION_IDENTITY_OR_TLS', reason: secret, connectionHint: secret },
    secret, undefined, null]) {
    const report = personalRatingPrivateProbeFailure(error, secret);
    assert.equal(report.stage, 'UNKNOWN');assert.equal(report.cause, 'UNKNOWN');
    assert.doesNotMatch(JSON.stringify(report), /synthetic-private-value/);
    assert.equal(Object.isFrozen(report), true);
  }
  const getterError = new Error();
  Object.defineProperty(getterError, 'message', { get() { throw new Error(secret); } });
  assert.equal(personalRatingPrivateProbeFailure(getterError, 'SOURCE').cause, 'UNKNOWN');
});

test('real child failures produce bounded private categories without raw stderr or query values', async () => {
  const cases = [
    ['psql: password authentication failed for user "synthetic-private-value"', 'AUTHENTICATION', null],
    ['psql: SSL error: certificate verify failed: synthetic-private-value', 'TLS_VERIFICATION', null],
    ['psql: could not translate host name "synthetic-private-value" to address', 'NETWORK', null],
    ['ERROR:  28P01\nsynthetic-private-value', 'UNKNOWN', '28P01'],
    ['ERROR:  ABCDE\nsynthetic-private-value', 'UNKNOWN', null],
    ['synthetic-private-value', 'UNKNOWN', null],
  ];
  for (const [stderr, hint, sqlstate] of cases) {
    let caught;
    await assert.rejects(withIsolatedSqlSession(process.execPath,
      ['--input-type=module', '-e', `process.stderr.write(${JSON.stringify(stderr)},()=>process.exit(1));`],
      { stage: 'personal-rating-connection', timeoutMs: 5000, env: {} },
      exec => exec('select synthetic_private_value;', { stage: 'session-settings' })), error => {
      caught = error;return true;
    });
    const report = personalRatingPrivateProbeFailure(caught, 'CONNECTION');
    assert.equal(report.status, 'FAIL');assert.equal(report.cause, 'PROCESS_EXIT');
    assert.equal(report.queryStage, 'session-settings');
    assert.equal(report.connectionHint, hint);assert.equal(report.sqlstate, sqlstate);
    assert.doesNotMatch(JSON.stringify(report), /synthetic.private.value|ABCDE|password authentication|SSL error/);
  }
});

test('caller-supplied transport stages and forged diagnostic objects cannot escape the private allowlist', async () => {
  let caught;
  await assert.rejects(withIsolatedSqlSession(process.execPath,
    ['--input-type=module', '-e', 'process.stdout.write("not-json\\n");'],
    { stage: 'personal-rating-connection', timeoutMs: 5000, env: {} },
    exec => exec('select 1;', { stage: 'synthetic-private-stage' })), error => { caught = error;return true; });
  const report = personalRatingPrivateProbeFailure(caught, 'CONNECTION');
  assert.equal(report.cause, 'INVALID_ACKNOWLEDGEMENT');assert.equal(report.queryStage, null);
  assert.doesNotMatch(JSON.stringify(report), /synthetic-private-stage|not-json/);
  const forged = Object.assign(new Error('private'), { reason: 'PROCESS_EXIT', stage: 'personal-rating-connection',
    queryStage: 'identify', connectionHint: 'AUTHENTICATION', sqlstate: '28P01' });
  assert.equal(personalRatingPrivateProbeFailure(forged, 'CONNECTION').cause, 'UNKNOWN');
});

test('runner remains a private manual template outside executable public workflows', async () => {
  const path = new URL('personal-rating-private-probe.workflow.yml', import.meta.url);
  const text = await readFile(path, 'utf8');
  assert.match(text, /on:\n  workflow_dispatch:/);
  assert.match(text, /github\.event\.repository\.private == true/);
  assert.match(text, /github\.triggering_actor == github\.repository_owner/);
  assert.match(text, /ref: \$\{\{ vars\.KAJO_REVIEWED_SOURCE_SHA \}\}/);
  assert.match(text, /persist-credentials: false/);
  assert.match(text, /uses: actions\/checkout@[a-f0-9]{40}/);
  assert.ok(!/pull_request:|pull_request_target:|schedule:|npm |upload-artifact|secrets: inherit/.test(text));
  await assert.rejects(lstat(new URL('../../.github/workflows/personal-rating-private-probe.yml', import.meta.url)), { code: 'ENOENT' });
});
