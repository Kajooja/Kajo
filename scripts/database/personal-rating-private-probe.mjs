import { chmod, lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { personalRatingConnectionCommand, runPersonalRatingConnectionCli } from './personal-rating-connection.mjs';
import { isolatedSqlFailureDetails } from './isolated-sql-session.mjs';

const check = value => { if (!value) throw new Error('PERSONAL_RATING_PRIVATE_PROBE_CONFIGURATION'); };

const runnerStages = new Set(['RUNTIME', 'EVENT', 'SOURCE', 'CONTEXT', 'CLIENT', 'PRIVATE_FILES', 'CONNECTION']);
const connectionCauses = new Set(['CONFIG', 'TARGET', 'POOLER_HOST', 'PATH', 'FILE', 'PRIVATE_FILE',
  'EXECUTABLE', 'SESSION_SETTINGS', 'IDENTITY_OR_TLS', 'CALLBACK', 'PROBE_CONTEXT', 'PROBE_CONTINUITY',
  'CONFIG_PATH', 'CONFIG_SIZE', 'USAGE_PROBE_ABSOLUTE_CONFIG']);
const queryStages = new Set(['session-settings', 'identify', 'probe-begin', 'probe-before',
  'probe-compute', 'probe-after', 'probe-rollback']);
const sqlstates = new Set(['08000', '08001', '08004', '08006', '08P01', '28000', '28P01', '3D000',
  '42501', '53300', '55000', '55P03', '57014', '57P01', '57P03']);

/** Fixed categories only: never serialize an Error, path, SQL, environment or
 * arbitrary server text. A hint identifies a diagnostic category, not proof of
 * its cause; unknown failures remain unknown and all guards still fail closed. */
export function personalRatingPrivateProbeFailure(error, stage) {
  const report = { version: 'personal-rating-private-probe-failure-v1', status: 'FAIL',
    stage: runnerStages.has(stage) ? stage : 'UNKNOWN', cause: 'UNKNOWN',
    queryStage: null, connectionHint: 'UNKNOWN', sqlstate: null };
  const message = error instanceof Error ? Object.getOwnPropertyDescriptor(error, 'message')?.value : null;
  if (message === 'PERSONAL_RATING_PRIVATE_PROBE_CONFIGURATION') report.cause = 'CONFIGURATION';
  const prefix = 'PERSONAL_RATING_CONNECTION_';
  if (typeof message === 'string' && message.startsWith(prefix) && connectionCauses.has(message.slice(prefix.length))) {
    report.cause = message.slice(prefix.length);
  }
  const detail = isolatedSqlFailureDetails(error);
  if (detail?.stage === 'personal-rating-connection') {
    report.cause = detail.reason;
    report.queryStage = queryStages.has(detail.queryStage) ? detail.queryStage : null;
    report.connectionHint = detail.connectionHint;
    report.sqlstate = sqlstates.has(detail.sqlstate) ? detail.sqlstate : null;
  }
  return Object.freeze(report);
}

/** This runner is deliberately separate from the generic private connection API.
 * Its deployment requires an owner-approved PRIVATE operational repository. */
export function validatePersonalRatingPrivateRun(event, env, sourceHead) {
  check(env && typeof env.GITHUB_REPOSITORY_OWNER === 'string' && env.GITHUB_REPOSITORY_OWNER.length > 0
    && typeof env.GITHUB_REPOSITORY === 'string'
    && env.GITHUB_REPOSITORY.startsWith(env.GITHUB_REPOSITORY_OWNER + '/')
    && /^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY)
    && env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_NAME === 'workflow_dispatch'
    && env.GITHUB_REF === 'refs/heads/main' && event?.repository?.private === true
    && event.repository.full_name === env.GITHUB_REPOSITORY
    && event.repository.owner?.login === env.GITHUB_REPOSITORY_OWNER
    && env.GITHUB_ACTOR === env.GITHUB_REPOSITORY_OWNER
    && env.GITHUB_TRIGGERING_ACTOR === env.GITHUB_REPOSITORY_OWNER
    && typeof env.KAJO_REVIEWED_SOURCE_SHA === 'string'
    && /^[a-f0-9]{40}$/.test(env.KAJO_REVIEWED_SOURCE_SHA)
    && sourceHead === env.KAJO_REVIEWED_SOURCE_SHA);
}

/** Secret inputs are supplied only to this step, never command-line arguments.
 * Private files exist for one callback and are removed even if it rejects. */
export async function withPersonalRatingPrivateFiles(input, work) {
  check(input && typeof input === 'object' && typeof work === 'function');
  check(typeof input.password === 'string' && input.password.length > 0 && input.password.length <= 4096
    && !/[\r\n\0]/.test(input.password));
  check(typeof input.ca === 'string' && input.ca.length > 0 && input.ca.length <= 32768
    && input.ca.includes('-----BEGIN CERTIFICATE-----') && !input.ca.includes('\0'));
  const dir = await mkdtemp(join(tmpdir(), 'kajo-private-probe-'));
  try {
    await chmod(dir, 0o700);
    const configPath = join(dir, 'connection.json');
    const config = { version: 'personal-rating-session-connection-v1', projectRef: input.projectRef,
      poolerHost: input.poolerHost, psqlPath: input.psqlPath,
      caFile: join(dir, 'ca.crt'), passwordFile: join(dir, 'connection.pgpass') };
    personalRatingConnectionCommand(config);
    const escaped = input.password.replaceAll('\\', '\\\\').replaceAll(':', '\\:');
    await writeFile(config.passwordFile,
      `${config.poolerHost}:5432:postgres:postgres.${config.projectRef}:${escaped}\n`, { mode: 0o600, flag: 'wx' });
    await writeFile(config.caFile, input.ca, { mode: 0o600, flag: 'wx' });
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
    return await work(configPath);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

let failureStage = 'RUNTIME';
async function main() {
  const env = process.env;
  check(process.argv.length === 2 && Number(process.versions.node.split('.')[0]) === 22);
  failureStage = 'EVENT';
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  failureStage = 'SOURCE';
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const childOptions = { cwd: repo, encoding: 'utf8', timeout: 5000,
    env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] };
  const sourceHead = execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], childOptions).trim();
  failureStage = 'CONTEXT';
  validatePersonalRatingPrivateRun(event, env, sourceHead);
  failureStage = 'CLIENT';
  const psqlPath = '/usr/lib/postgresql/16/bin/psql';
  const binary = await lstat(psqlPath);
  check(binary.isFile() && !binary.isSymbolicLink());
  check(/^psql \(PostgreSQL\) 16\./.test(execFileSync(psqlPath, ['--version'], childOptions)));
  const input = { projectRef: env.KAJO_PROJECT_REF, poolerHost: env.KAJO_POOLER_HOST,
    password: env.KAJO_DB_PASSWORD, ca: env.KAJO_DB_CA, psqlPath };
  for (const key of ['KAJO_PROJECT_REF', 'KAJO_POOLER_HOST', 'KAJO_DB_PASSWORD', 'KAJO_DB_CA']) delete env[key];
  failureStage = 'PRIVATE_FILES';
  const result = await withPersonalRatingPrivateFiles(input,
    path => { failureStage = 'CONNECTION';return runPersonalRatingConnectionCli(['probe', path]); });
  // Only the bounded existing report is printed, in the approved private run.
  process.stdout.write(JSON.stringify({ ...result, sourceHead }) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(JSON.stringify(personalRatingPrivateProbeFailure(error, failureStage)) + '\n');
    process.exitCode = 1;
  });
}
