// Owns a new, unlinked Supabase stack only on an ephemeral GitHub Ubuntu runner.
// Historical application migrations and hosted connection settings are not used.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probePlatformDefaults } from './platform-default-probe.mjs';

const cliVersion = '2.117.0';
const projectId = 'kajo_ci_platform';
const container = `supabase_db_${projectId}`;
const environment = { ...process.env };
for (const name of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'SUPABASE_PROJECT_ID',
  'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSERVICE', 'PGSERVICEFILE', 'PGPASSFILE',
  'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete environment[name];
Object.assign(environment, { DOCKER_HOST: 'unix:///var/run/docker.sock',
  SUPABASE_NO_UPDATE_NOTIFIER: '1', SUPABASE_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' });
let directory;
let started = false;

function run(command, args, { input, timeout = 120_000 } = {}) {
  const result = spawnSync(command, args, { cwd: directory, env: environment,
    input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout });
  if (result.error) throw result.error;
  // CLI stdout may contain local keys/connection strings. Keep it out of logs.
  if (result.status !== 0) {
    // psql receives only this repository's metadata/probe SQL, never credentials.
    const detail = command === 'docker' && args.includes('psql') ? `: ${result.stderr.trim().slice(-3000)}` : '';
    throw new Error(`${command} ${args[0]} failed with exit ${result.status}${detail}`);
  }
  return result.stdout;
}
const cli = (args, options) => run('npx', ['--yes', `supabase@${cliVersion}`, ...args], options);
const docker = (args, options) => run('docker', ['--host', 'unix:///var/run/docker.sock', ...args], options);

try {
  assert.equal(process.platform, 'linux', 'This runner requires GitHub Ubuntu');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'This runner is restricted to GitHub Actions');
  assert.equal(process.env.CI, 'true');
  assert.equal(process.argv.length, 3, 'Usage: node run-ci-platform-probe.mjs <new-report.json>');
  const names = docker(['ps', '-a', '--format', '{{.Names}}']).trim().split('\n');
  assert.ok(!names.includes(container), 'Refusing to reuse an existing Supabase stack');
  directory = await mkdtemp(join(tmpdir(), 'kajo-ci-platform-'));
  assert.equal(cli(['--version']).trim(), cliVersion);
  cli(['init']);
  const configPath = join(directory, 'supabase', 'config.toml');
  const originalConfig = await readFile(configPath, 'utf8');
  assert.match(originalConfig, /^major_version = 17$/m);
  const config = originalConfig.replace(/^project_id = ".*"$/m, `project_id = "${projectId}"`);
  assert.notEqual(config, originalConfig);
  await writeFile(configPath, config);
  console.log(`Starting isolated Supabase CLI ${cliVersion} stack`);
  started = true;
  cli(['start', '--exclude', 'studio,postgres-meta,edge-runtime,imgproxy,logflare,vector,supavisor'], { timeout: 720_000 });
  const image = docker(['inspect', '--format', '{{.Config.Image}} {{.Image}}', container]).trim();
  assert.match(image, /(?:^|\/)supabase\/postgres:17\.6\.1\.167 sha256:[0-9a-f]{64}$/,
    'Unexpected Postgres image; review before running the forward migration');
  const execSnapshots = async sql => {
    const output = docker(['exec', '-i', container, 'psql', '-X', '-qAt',
      '--set=ON_ERROR_STOP=1', '--username=postgres', '--dbname=postgres'], { input: sql });
    return output.trim() ? output.trim().split('\n').map(line => JSON.parse(line)) : [];
  };
  const result = await probePlatformDefaults(execSnapshots);
  cli(['stop', '--no-backup'], { timeout: 120_000 });
  started = false;
  const report = { ...result, cliVersion, image, architecture: process.arch,
    commit: process.env.GITHUB_SHA, cleanup: 'PASS',
    configSha256: createHash('sha256').update(config).digest('hex') };
  await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(`KAJO CI PLATFORM PROBE PASS — ${result.existingFunctions.count} existing functions unchanged; rollback and cleanup verified`);
  console.log(`Image: ${image}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) {
    try { cli(['stop', '--no-backup'], { timeout: 120_000 }); }
    catch { console.error('Isolated stack cleanup failed'); process.exitCode = 1; }
  }
  if (directory) await rm(directory, { recursive: true, force: true });
}
