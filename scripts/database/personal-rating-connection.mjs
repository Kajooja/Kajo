import { createHash, randomUUID } from 'node:crypto';
import { access, lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { withIsolatedSqlSession } from './isolated-sql-session.mjs';

const check = (condition, code) => {
  if (!condition) throw new Error(`PERSONAL_RATING_CONNECTION_${code}`);
};
const keys = ['version', 'projectRef', 'psqlPath', 'caFile', 'passwordFile'];

/** Explicit direct-connection configuration only. No linked-project, environment,
 * service-file or credential discovery. A password never enters JSON or argv. */
export function personalRatingConnectionCommand(config) {
  check(config !== null && typeof config === 'object' && !Array.isArray(config)
    && Object.keys(config).length === keys.length && keys.every(key => Object.hasOwn(config, key)), 'CONFIG');
  check(config.version === 'personal-rating-connection-v1'
    && typeof config.projectRef === 'string' && /^[a-z]{20}$/.test(config.projectRef), 'TARGET');
  for (const key of ['psqlPath', 'caFile', 'passwordFile']) {
    check(typeof config[key] === 'string' && isAbsolute(config[key]) && config[key].length <= 4096
      && !/[\r\n\0]/.test(config[key]), 'PATH');
  }
  return {
    command: config.psqlPath,
    args: ['-X', '-qAt', '-w', '--no-readline', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=sqlstate'],
    // Deliberately do not spread process.env: PGHOSTADDR, PGSERVICE, PGOPTIONS,
    // PGPASSWORD, startup hooks and unrelated application secrets cannot override
    // the reviewed target or leak into this privileged child.
    options: { stage: 'personal-rating-connection', timeoutMs: 60_000, env: {
      LANG: 'C', LC_ALL: 'C', PGHOST: `db.${config.projectRef}.supabase.co`, PGPORT: '5432',
      PGDATABASE: 'postgres', PGUSER: 'postgres', PGPASSFILE: config.passwordFile,
      PGSSLMODE: 'verify-full', PGSSLROOTCERT: config.caFile, PGGSSENCMODE: 'disable',
      PGSSLMINPROTOCOLVERSION: 'TLSv1.2', PGCONNECT_TIMEOUT: '10', PGCLIENTENCODING: 'UTF8',
      PGAPPNAME: `kajo_rating_${randomUUID().replaceAll('-', '')}`,
      PGOPTIONS: '-c search_path=pg_catalog -c timezone=UTC -c statement_timeout=30000'
        + ' -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000',
    } },
  };
}

async function regularFile(path, privateFile) {
  let info;
  try { info = await lstat(path); } catch { check(false, 'FILE'); }
  check(info.isFile() && !info.isSymbolicLink(), 'FILE');
  if (privateFile) check(typeof process.getuid === 'function' && info.uid === process.getuid()
    && (info.mode & 0o077) === 0 && (info.mode & 0o400) !== 0, 'PRIVATE_FILE');
  return info;
}

function validIdentity(row) {
  return row?.database === 'postgres' && row.user === 'postgres' && row.sessionUser === 'postgres'
    && Number.isInteger(row.serverVersionNum) && Math.floor(row.serverVersionNum / 10000) === 17;
}
const identityFields = `'database',current_database(),'user',current_user,'sessionUser',session_user,
  'serverVersionNum',current_setting('server_version_num')::integer`;

/** Compatible with the existing capture/census callback contract. Each invocation
 * owns one psql process; its caller still owns BEGIN/COMMIT. This does not authorize
 * a cohort or a write, and a successful probe does not admit a model. */
export async function withPersonalRatingSqlSession(config, work) {
  const launch = personalRatingConnectionCommand(config);
  const paths = { psqlPath: config.psqlPath, caFile: config.caFile, passwordFile: config.passwordFile };
  check(typeof work === 'function', 'CALLBACK');
  await regularFile(paths.psqlPath, false);
  await regularFile(paths.caFile, false);
  await regularFile(paths.passwordFile, true);
  try { await access(paths.psqlPath, constants.X_OK); } catch { check(false, 'EXECUTABLE'); }
  return withIsolatedSqlSession(launch.command, launch.args, launch.options, async exec => {
    const rows = await exec(`select jsonb_build_object(${identityFields},'ssl',
      coalesce((select ssl from pg_stat_ssl where pid=pg_backend_pid()),false));`, { stage: 'identify' });
    check(rows.length === 1 && validIdentity(rows[0]) && rows[0].ssl === true, 'IDENTITY_OR_TLS');
    return work(exec);
  });
}

/** Read-only, schema-independent probe. CI can run this same protocol on its
 * disposable native transport; that establishes transaction mechanics, not TLS
 * or credentials for an actual hosted connection. No application rows are read. */
export async function probePersonalRatingSqlSession(withSqlSession) {
  return withSqlSession(async exec => {
    const nonce = randomUUID();
    const witness = `select jsonb_build_object(${identityFields},'pid',pg_backend_pid(),
      'transactionAt',transaction_timestamp()::text,'isolation',current_setting('transaction_isolation'),
      'readOnly',current_setting('transaction_read_only'),'marker',current_setting('kajo.personal_rating_probe'));`;
    try {
      await exec(`begin isolation level repeatable read read only;
        set local search_path=pg_catalog;set local timezone='UTC';
        set local statement_timeout='5s';set local idle_in_transaction_session_timeout='10s';
        set local kajo.personal_rating_probe='${nonce}';`, { stage: 'probe-begin' });
      const beforeRows = await exec(witness, { stage: 'probe-before' });
      const before = beforeRows[0];
      check(beforeRows.length === 1 && validIdentity(before) && Number.isInteger(before.pid) && before.pid > 0
        && typeof before.transactionAt === 'string' && before.transactionAt.length > 0
        && before.isolation === 'repeatable read' && before.readOnly === 'on' && before.marker === nonce, 'PROBE_CONTEXT');
      // Actual JavaScript computation occurs between two awaited SQL calls.
      const computed = createHash('sha256').update(JSON.stringify(before)).digest('hex');
      await exec(`set local kajo.personal_rating_probe='${computed}';`, { stage: 'probe-compute' });
      const afterRows = await exec(witness, { stage: 'probe-after' });
      const after = afterRows[0];
      check(afterRows.length === 1 && validIdentity(after) && after.pid === before.pid
        && after.transactionAt === before.transactionAt && after.isolation === before.isolation
        && after.readOnly === before.readOnly && after.marker === computed, 'PROBE_CONTINUITY');
      return { version: 'personal-rating-connection-probe-v1', status: 'PASS', postgresMajor: 17,
        sameBackend: true, sameTransaction: true, readOnly: true, javascriptRoundTrip: true,
        applicationRowsRead: false, collectionStarted: false, qualityAdmission: 'NONE', servingActivation: 'NONE' };
    } finally {
      // A failed rollback must also fail the probe. A successful result is never
      // returned while the connection may still retain its transaction.
      await exec('rollback;', { stage: 'probe-rollback' });
    }
  });
}

export async function readPersonalRatingConnectionConfig(path) {
  check(typeof path === 'string' && isAbsolute(path), 'CONFIG_PATH');
  const info = await regularFile(path, true);
  check(info.size > 0 && info.size <= 8192, 'CONFIG_SIZE');
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await file.stat();
    check(opened.isFile() && opened.uid === process.getuid() && (opened.mode & 0o077) === 0, 'PRIVATE_FILE');
    const buffer = Buffer.alloc(8193);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    check(bytesRead > 0 && bytesRead <= 8192, 'CONFIG_SIZE');
    const value = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
    personalRatingConnectionCommand(value);
    return Object.freeze(value);
  } catch { check(false, 'CONFIG'); }
  finally { await file?.close(); }
}

export async function runPersonalRatingConnectionCli(args) {
  check(args.length === 2 && args[0] === 'probe', 'USAGE_PROBE_ABSOLUTE_CONFIG');
  const config = await readPersonalRatingConnectionConfig(args[1]);
  const result = await probePersonalRatingSqlSession(work => withPersonalRatingSqlSession(config, work));
  return { ...result, transport: 'DIRECT_PSQL_VERIFY_FULL', tlsVerified: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPersonalRatingConnectionCli(process.argv.slice(2)).then(result => {
    process.stdout.write(JSON.stringify(result) + '\n');
  }).catch(() => {
    // Configuration paths, SQL, server exception text and credentials are private.
    process.stderr.write('Personal rating connection probe failed; check the private configuration and connection.\n');
    process.exitCode = 1;
  });
}
