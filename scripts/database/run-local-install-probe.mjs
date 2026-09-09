// Mac Docker Desktop only. Never accepts a hosted URL, password or remote context.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: 'utf8', input, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed (${result.status})`);
  return result.stdout;
}
let directory;
try {
  assert.equal(process.argv.length, 3, 'Usage: node scripts/database/run-local-install-probe.mjs <kajo-schema.sql>');
  assert.equal(process.platform, 'darwin', 'This runner is restricted to the owner\'s Mac Docker Desktop');
  const context = JSON.parse(run('docker', ['context', 'inspect', 'desktop-linux']))[0];
  assert.ok(context?.Endpoints?.docker?.Host?.startsWith('unix://'), 'Docker context must use a local Unix socket');
  const docker = args => ['--context', 'desktop-linux', ...args];
  const names = run('docker', docker(['ps', '--format', '{{.Names}}']))
    .trim().split('\n').filter(name => name.startsWith('supabase_db_'));
  assert.equal(names.length, 1, 'Expected exactly one running local supabase_db_ container; report container names if there are several');
  const name = names[0];
  const image = run('docker', docker(['inspect', '--format', '{{.Config.Image}} {{.Image}}', name])).trim();
  console.log(`Local database: ${name}\nImage: ${image}`);
  const platformSql = await readFile(new URL('platform-schema-snapshot.sql', import.meta.url), 'utf8');
  const platformSnapshot = () => JSON.parse(run('docker', docker(['exec', '-i', name, 'psql', '-X', '-qAt',
    '--set=ON_ERROR_STOP=1', '--username=postgres', '--dbname=postgres']), platformSql));
  const platformBefore = platformSnapshot();
  directory = await mkdtemp(join(tmpdir(), 'kajo-local-probe-'));
  const probe = join(directory, 'probe.sql');
  run(process.execPath, [fileURLToPath(new URL('build-local-install-probe.mjs', import.meta.url)), process.argv[2], probe]);
  const sql = await readFile(probe, 'utf8');
  const output = run('docker', docker(['exec', '-i', name, 'psql', '-X', '--set=ON_ERROR_STOP=1',
    '--username=postgres', '--dbname=postgres']), sql);
  assert.ok(output.includes('KAJO LOCAL INSTALL PROBE PASS - all probe changes rolled back'),
    'psql finished without the expected probe result');
  assert.deepEqual(platformSnapshot(), platformBefore, 'Probe rollback changed platform/schema/default-privilege metadata');
  const report = join(process.cwd(), `kajo-install-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(report, JSON.stringify({ format: 'kajo-local-install-report-v1', status: 'PASS',
    container: name, image, nodeVersion: process.version,
    probeSha256: createHash('sha256').update(sql).digest('hex'),
    platformRestored: true, platform: platformBefore }, null, 2) + '\n', { flag: 'wx' });
  console.log('KAJO LOCAL INSTALL PROBE PASS - all probe changes rolled back');
  console.log('Verified: Auth provisioning, authenticated V1 bootstrap ranking, import removal, outsider denial, persisted trace version.');
  console.log('Verified: Shared member ranking, aggregate explanation, outsider/revoked-member denial, Shared trace versions.');
  console.log('Verified: source-derived functions, 5000-row import, 5001-row rejection, import correction/removal, null-bootstrap eligibility.');
  console.log('Verified: future public/private functions start closed; explicit authenticated grant enables execution.');
  console.log(`Report: ${report}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (directory) await rm(directory, { recursive: true, force: true });
}
