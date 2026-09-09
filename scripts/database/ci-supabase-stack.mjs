// Each invocation owns a new unlinked project on an ephemeral GitHub Ubuntu
// runner. Shared by the platform and application installation checks.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bufferedSqlCommand } from './buffered-sql-command.mjs';

const cliVersion = '2.117.0';
// Linux x64 image verified in CI #385. A moved tag fails closed.
const imageId = 'sha256:66089200353d90686fe9b252a47d17d078364bf47c50190852c33dc850a0191f';

export async function withCiSupabaseStack(projectId, work) {
  assert.equal(process.platform, 'linux', 'This runner requires GitHub Ubuntu');
  assert.equal(process.arch, 'x64', 'This image checkpoint is for Linux x64');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'This runner is restricted to GitHub Actions');
  assert.equal(process.env.CI, 'true');
  assert.match(projectId, /^kajo_ci_[a-z_]+$/);
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
    if (result.status !== 0) {
      // SQL is repository-owned metadata/probe input. CLI output can contain
      // development keys/connection strings, so is never logged here.
      const detail = command === 'docker' && args.includes('psql') ? `: ${result.stderr.trim().slice(-3000)}` : '';
      throw new Error(`${command} ${args[0]} failed with exit ${result.status}${detail}`);
    }
    return result.stdout;
  }
  const cli = (args, options) => run('npx', ['--yes', `supabase@${cliVersion}`, ...args], options);
  const docker = (args, options) => run('docker', ['--host', 'unix:///var/run/docker.sock', ...args], options);
  try {
    const names = docker(['ps', '-a', '--format', '{{.Names}}']).trim().split('\n');
    assert.ok(!names.includes(container), 'Refusing to reuse an existing Supabase stack');
    directory = await mkdtemp(join(tmpdir(), 'kajo-ci-database-'));
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
    assert.equal(image, `public.ecr.aws/supabase/postgres:17.6.1.167 ${imageId}`,
      'Postgres image changed; review its actual digest before running application SQL');
    const containerId = docker(['inspect', '--format', '{{.Id}}', container]).trim();
    const execSnapshots = async sql => {
      const output = docker(['exec', '-i', container, ...bufferedSqlCommand(['psql', '-X', '-qAt',
        '--set=ON_ERROR_STOP=1', '--username=postgres', '--dbname=postgres'])], { input: sql });
      return output.trim() ? output.trim().split('\n').map(line => JSON.parse(line)) : [];
    };
    const result = await work(execSnapshots);
    cli(['stop', '--no-backup'], { timeout: 120_000 });
    started = false;
    assert.ok(!docker(['ps', '-a', '--format', '{{.Names}}']).trim().split('\n').includes(container),
      'Stopped project container still exists');
    return { result, cliVersion, image, architecture: process.arch, projectId, containerId,
      commit: process.env.GITHUB_SHA, cleanup: 'PASS',
      configSha256: createHash('sha256').update(config).digest('hex') };
  } finally {
    if (started) cli(['stop', '--no-backup'], { timeout: 120_000 });
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
