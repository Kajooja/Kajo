// Each invocation owns a new unlinked project on an ephemeral GitHub Ubuntu
// runner. Shared by the platform and application installation checks.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { bufferedSqlCommand } from './buffered-sql-command.mjs';

const cliVersion = '2.117.0';
// Linux x64 image verified in CI #385. A moved tag fails closed.
const imageId = 'sha256:66089200353d90686fe9b252a47d17d078364bf47c50190852c33dc850a0191f';

// Return fixed diagnostic labels only: CLI output can include local credentials.
// These are observed symptoms, not a claimed root cause or an automatic retry rule.
export function classifySupabaseStartFailure(output) {
  const signals = [
    ['image-download', /failed to pull|pull access denied|manifest unknown|toomanyrequests|error pulling/i],
    ['port-binding', /address already in use|port is already allocated|ports are not available/i],
    ['container-health', /unhealthy|health check failed|failed to become healthy/i],
    ['resource-pressure', /no space left|out of memory|cannot allocate memory/i],
    ['network', /connection refused|connection reset|network is unreachable|TLS handshake timeout|i\/o timeout|temporary failure in name resolution/i],
  ].filter(([, pattern]) => pattern.test(output)).map(([label]) => label);
  return signals.length ? signals : ['unclassified'];
}

export function verifyCiPostgresImage(image) {
  verifyLocalPostgresImage(image, 'linux', 'x64');
}

export function verifyLocalPostgresImage(image, platform = process.platform, architecture = process.arch) {
  const [reference, digest, ...extra] = image.split(' ');
  assert.equal(extra.length, 0, 'Unexpected Docker image identity format');
  assert.ok(['public.ecr.aws/supabase/postgres:17.6.1.167',
    'ghcr.io/supabase/postgres:17.6.1.167'].includes(reference), 'Unreviewed Postgres image reference');
  const expected = { 'linux/x64': imageId,
    'darwin/arm64': 'sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb' }[`${platform}/${architecture}`];
  assert.ok(expected, 'No reviewed Postgres image for this platform/architecture');
  assert.equal(digest, expected, 'Postgres image content changed; review its actual digest before running application SQL');
}

export async function withCiSupabaseStack(projectId, work) {
  assert.equal(process.platform, 'linux', 'This runner requires GitHub Ubuntu');
  assert.equal(process.arch, 'x64', 'This image checkpoint is for Linux x64');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'This runner is restricted to GitHub Actions');
  assert.equal(process.env.CI, 'true');
  assert.match(projectId, /^kajo_ci_[a-z_]+$/);
  return withNewSupabaseStack(projectId, work);
}

// Persistent development entry: only a newly owned local workspace/stack, never
// an existing project or a supplied database URL. Failure cleans up that stack.
export async function withLocalSupabaseStack(workspace, work) {
  assert.ok(isAbsolute(workspace), 'Supply an absolute path for a NEW local workspace');
  const destination = resolve(workspace);
  const projectId = `kajo_local_${createHash('sha256').update(destination).digest('hex').slice(0, 12)}`;
  return withNewSupabaseStack(projectId, work, destination);
}

async function withNewSupabaseStack(projectId, work, destination) {
  assert.ok((process.platform === 'linux' && process.arch === 'x64')
    || (process.platform === 'darwin' && process.arch === 'arm64'), 'Requires Linux x64 or macOS arm64 with local Docker');
  const container = `supabase_db_${projectId}`;
  const environment = { ...process.env };
  for (const name of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'SUPABASE_PROJECT_ID', 'SUPABASE_WORKDIR',
    'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSERVICE', 'PGSERVICEFILE', 'PGPASSFILE',
    'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete environment[name];
  Object.assign(environment, { DOCKER_HOST: 'unix:///var/run/docker.sock',
    SUPABASE_NO_UPDATE_NOTIFIER: '1', SUPABASE_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' });
  let directory;
  let started = false;
  let retained = false;
  let dockerHost = 'unix:///var/run/docker.sock';
  function run(command, args, { input, timeout = 120_000 } = {}) {
    const result = spawnSync(command, args, { cwd: directory, env: environment,
      input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      // SQL is repository-owned metadata/probe input. CLI output can contain
      // development keys/connection strings, so is never logged here.
      let detail = command === 'docker' && args.includes('psql') ? `: ${result.stderr.trim().slice(-3000)}` : '';
      if (command === 'npx' && args.includes('start')) {
        detail = `: start signals=${classifySupabaseStartFailure(result.stdout + '\n' + result.stderr).join(',')}; raw CLI output withheld`;
      }
      if (command === 'npx' && (args.includes('reset') || args.includes('migration'))) {
        // Reset diagnostics include only SQL error/flag lines, not CLI status
        // output with development connection strings or keys.
        detail = ': ' + result.stderr.split('\n').filter(line => /ERROR:|SQLSTATE|unknown flag:/.test(line))
          .join('\n').replace(/postgres(?:ql)?:\/\/\S+/gi, '[local connection]').slice(-3000);
      }
      throw new Error(`${command} ${args[0]} failed with exit ${result.status}${detail}`);
    }
    return result.stdout;
  }
  const cli = (args, options) => run('npx', ['--yes', `supabase@${cliVersion}`, '--workdir', directory, ...args], options);
  const docker = (args, options) => run('docker', ['--host', dockerHost, ...args], options);
  try {
    if (process.platform === 'darwin') {
      const context = JSON.parse(run('docker', ['context', 'inspect', 'desktop-linux']))[0];
      dockerHost = context?.Endpoints?.docker?.Host;
      assert.ok(dockerHost?.startsWith('unix://'), 'Docker Desktop must use a local Unix socket');
      environment.DOCKER_HOST = dockerHost;
    }
    const names = docker(['ps', '-a', '--format', '{{.Names}}']).trim().split('\n');
    assert.ok(!names.includes(container), 'Refusing to reuse an existing Supabase stack');
    const volumes = docker(['volume', 'ls', '--format', '{{.Name}}']).trim().split('\n');
    assert.ok(!volumes.some(name => name.endsWith(`_${projectId}`)), 'Refusing to restore an existing Supabase volume');
    if (destination) {
      await mkdir(destination, { mode: 0o700 }); // Exclusive: existing files/directories are never reused.
      directory = destination;
    } else directory = await mkdtemp(join(tmpdir(), 'kajo-ci-database-'));
    assert.equal(cli(['--version']).trim(), cliVersion);
    cli(['init']);
    const configPath = join(directory, 'supabase', 'config.toml');
    const originalConfig = await readFile(configPath, 'utf8');
    assert.match(originalConfig, /^major_version = 17$/m);
    const config = originalConfig.replace(/^project_id = ".*"$/m, `project_id = "${projectId}"`);
    assert.notEqual(config, originalConfig);
    await writeFile(configPath, config);
    console.log(`Starting isolated Supabase CLI ${cliVersion} stack ${projectId}`);
    started = true;
    cli(['start', '--exclude', 'studio,postgres-meta,edge-runtime,imgproxy,logflare,vector,supavisor'], { timeout: 720_000 });
    const image = docker(['inspect', '--format', '{{.Config.Image}} {{.Image}}', container]).trim();
    console.log(`Image: ${image}`);
    verifyLocalPostgresImage(image);
    const containerId = docker(['inspect', '--format', '{{.Id}}', container]).trim();
    const execSnapshots = async sql => {
      const output = docker(['exec', '-i', container, ...bufferedSqlCommand(['psql', '-X', '-qAt',
        '--set=ON_ERROR_STOP=1', '--username=postgres', '--dbname=postgres'])], { input: sql });
      return output.trim() ? output.trim().split('\n').map(line => JSON.parse(line)) : [];
    };
    let applied = false;
    const applyMigrations = async files => {
      assert.equal(applied, false, 'Fresh installation can execute only once');
      const { validateMigrationFiles } = await import('./fresh-installation.mjs');
      validateMigrationFiles(files);
      const path = join(directory, 'supabase', 'migrations');
      await mkdir(path, { recursive: true });
      assert.deepEqual(await readdir(path), [], 'New migration workspace must be empty');
      for (const file of files) await writeFile(join(path, file.name), file.sql, { flag: 'wx' });
      assert.match(cli(['migration', 'up', '--help']), /--local/);
      applied = true;
      cli(['migration', 'up', '--local'], { timeout: 360_000 });
      const actual = docker(['inspect', '--format', '{{.Config.Image}} {{.Image}}', container]).trim();
      verifyLocalPostgresImage(actual);
      return { image: actual, containerId };
    };
    const resetFromMigrations = async files => {
      assert.equal(projectId, 'kajo_ci_cli_install', 'CLI reset is restricted to its newly owned test stack');
      const { validateMigrationFiles } = await import('./fresh-installation.mjs');
      validateMigrationFiles(files);
      // This directory belongs only to the freshly created CI workspace above.
      // No repository migration directory or existing Supabase project is used.
      const path = join(directory, 'supabase', 'migrations');
      await rm(path, { recursive: true, force: true });
      await mkdir(path);
      for (const file of files) await writeFile(join(path, file.name), file.sql, { flag: 'wx' });
      cli(['db', 'reset', '--local', '--no-seed', '--yes'], { timeout: 360_000 });
      const resetImage = docker(['inspect', '--format', '{{.Config.Image}} {{.Image}}', container]).trim();
      verifyCiPostgresImage(resetImage);
      return { image: resetImage, containerId: docker(['inspect', '--format', '{{.Id}}', container]).trim() };
    };
    const result = await work(execSnapshots, { resetFromMigrations, applyMigrations });
    if (destination) {
      const report = { result, cliVersion, image, architecture: process.arch, projectId, containerId,
        workspace: directory, installedAt: new Date().toISOString(), cleanup: 'RETAINED_LOCAL',
        configSha256: createHash('sha256').update(config).digest('hex') };
      await writeFile(join(directory, 'kajo-installation.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
      retained = true;
      return report;
    }
    cli(['stop', '--no-backup'], { timeout: 120_000 });
    started = false;
    assert.ok(!docker(['ps', '-a', '--format', '{{.Names}}']).trim().split('\n').includes(container),
      'Stopped project container still exists');
    return { result, cliVersion, image, architecture: process.arch, projectId, containerId,
      commit: process.env.GITHUB_SHA, cleanup: 'PASS',
      configSha256: createHash('sha256').update(config).digest('hex') };
  } finally {
    if (started && !retained) cli(['stop', '--no-backup'], { timeout: 120_000 });
    if (directory && !retained) await rm(directory, { recursive: true, force: true });
  }
}
