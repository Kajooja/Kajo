import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, open, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertOrdinalReportPlatform, runOrdinalReport } from '../../packages/prediction-engine/scripts/ordinal-report.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../../packages/prediction-engine/scripts/ordinal-report.mjs', import.meta.url));
const manifest = overrides => ({ contractVersion: 'kajo-shared-ordinal-manifest-v1',
  selectionBasis: 'OWNER_DECLARED_NONOVERLAPPING_PAIRS', evaluationAsOf: 1_000_000, pairs: [], ...overrides });
const command = (...args) => spawnSync(process.execPath, [cli, ...args], {
  cwd: root, encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024,
});
async function workspace(work) {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-ordinal-report-'));
  try { return await work(directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
async function absent(path) { await assert.rejects(stat(path), { code: 'ENOENT' }); }
function failure(result, code) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `ORDINAL_REPORT_${code}\n`);
  assert.doesNotMatch(result.stderr, /synthetic-private-secret|postgresql:|Error:|node:/);
}

test('private owner CLI explicitly requires Linux/macOS capabilities before paths while the engine remains portable', async () => {
  assert.doesNotThrow(() => assertOrdinalReportPlatform());
  for (const platform of ['win32', 'freebsd', 'synthetic-private-secret']) {
    assert.throws(() => assertOrdinalReportPlatform(platform), error => error.message === 'ORDINAL_REPORT_PLATFORM');
  }
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  try {
    await assert.rejects(runOrdinalReport('/synthetic-private-secret-input', '/missing/private/report.json'),
      error => error.message === 'ORDINAL_REPORT_PLATFORM');
  } finally { Object.defineProperty(process, 'platform', platform); }
});

test('owner CLI creates a private declared-selection report without inventing evidence from an empty batch', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    await writeFile(input, JSON.stringify(manifest()));
    const result = command(input, output);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'ORDINAL_REPORT_CREATED\n');
    assert.equal(result.stderr, '');
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(report, { contractVersion: 'kajo-shared-ordinal-report-v1',
      selectionBasis: 'OWNER_DECLARED_NONOVERLAPPING_PAIRS', sampleInterpretation: 'CONDITIONAL_ON_PRODUCTION_EXPOSURE',
      selectionWasProspective: 'NOT_ESTABLISHED', evaluationAsOf: 1_000_000,
      result: { contractVersion: 'group-ordinal-batch-v1', pairs: [], comparablePairUnits: 0, unscoredPairUnits: 0,
        observed: { pairUnits: 0, production: { agreement: 0, tie: 0, disagreement: 0 },
          shadow: { agreement: 0, tie: 0, disagreement: 0 } },
        synthetic: { pairUnits: 0, production: { agreement: 0, tie: 0, disagreement: 0 },
          shadow: { agreement: 0, tie: 0, disagreement: 0 } },
        independence: 'not-established', uncertainty: 'unavailable', historicalFeatureEligible: false, learnable: false } });
  });
});

test('argument, JSON and manifest failures emit fixed codes without paths, secrets or partial reports', async () => {
  await workspace(async directory => {
    const input = join(directory, 'synthetic-private-secret.json'), output = join(directory, 'report.json');
    failure(command(), 'ARGUMENTS');
    failure(command('synthetic-private-secret'), 'ARGUMENTS');
    failure(command(input, output), 'INPUT_FILE');
    await writeFile(input, '{"synthetic-private-secret":"postgresql://private:secret@localhost');
    failure(command(input, output), 'MANIFEST_INVALID');
    for (const value of [null, [], manifest({ contractVersion: 'synthetic-private-secret' }),
      manifest({ selectionBasis: 'PROSPECTIVE_SAMPLE' }), manifest({ evaluationAsOf: null }),
      manifest({ evaluationAsOf: -1 }), manifest({ pairs: {} }), { ...manifest(), extra: 'synthetic-private-secret' }]) {
      await writeFile(input, JSON.stringify(value));
      failure(command(input, output), 'MANIFEST_INVALID');
      await absent(output);
    }
  });
});

test('CLI enforces pair counts, consistent as-of and duplicate declared IDs before normalizing snapshots', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    const pair = { pairId: 'synthetic-private-secret', leftComparison: null, rightComparison: null,
      anchor: {}, references: {} };
    for (const value of [manifest({ pairs: Array.from({ length: 257 }, () => pair) }),
      manifest({ pairs: [{ ...pair, evaluationAsOf: 1 }] }), manifest({ pairs: [{ ...pair, unknown: true }] }),
      manifest({ pairs: [{ pairId: 'synthetic-private-secret' }] })]) {
      await writeFile(input, JSON.stringify(value));
      failure(command(input, output), 'MANIFEST_INVALID');
    }
    await writeFile(input, JSON.stringify(manifest({ pairs: [pair, structuredClone(pair)] })));
    failure(command(input, output), 'PAIRS_OVERLAP');
    await writeFile(input, JSON.stringify(manifest({ pairs: [pair] })));
    failure(command(input, output), 'SNAPSHOT_REJECTED');
    await absent(output);
  });
});

test('CLI accepts at most 16 MiB from a regular file and rejects input symlinks and directories', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    await writeFile(input, ' '.repeat(16 * 1024 * 1024 + 1));
    failure(command(input, output), 'INPUT_TOO_LARGE');
    await absent(output);
    const payload = JSON.stringify(manifest());
    await writeFile(input, payload + ' '.repeat(16 * 1024 * 1024 - Buffer.byteLength(payload)));
    assert.equal(command(input, output).status, 0);
    await rm(output);
    const link = join(directory, 'input-link.json');
    await symlink(input, link);
    failure(command(link, output), 'INPUT_FILE');
    failure(command(directory, output), 'INPUT_FILE');
    await absent(output);
  });
});

test('exclusive output preserves existing files and symlink targets and creates no directories', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    await writeFile(input, JSON.stringify(manifest()));
    await writeFile(output, 'synthetic-private-secret');
    failure(command(input, output), 'OUTPUT_EXISTS');
    assert.equal(await readFile(output, 'utf8'), 'synthetic-private-secret');
    const linkedOutput = join(directory, 'report-link.json');
    await symlink(output, linkedOutput);
    failure(command(input, linkedOutput), 'OUTPUT_EXISTS');
    assert.equal(await readFile(output, 'utf8'), 'synthetic-private-secret');
    const missing = join(directory, 'missing-directory');
    failure(command(input, join(missing, 'report.json')), 'OUTPUT_LOCATION');
    await absent(missing);
  });
});

test('output must remain outside Git repositories/worktrees, including realpath aliases', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json');
    await writeFile(input, JSON.stringify(manifest()));
    const actualOutput = join(root, 'synthetic-private-secret-ordinal-report.json');
    failure(command(input, actualOutput), 'OUTPUT_LOCATION');
    await absent(actualOutput);
    const alias = join(directory, 'repository-alias');
    await symlink(root, alias);
    failure(command(input, join(alias, 'synthetic-private-secret-ordinal-report.json')), 'OUTPUT_LOCATION');
    // A .git file represents a worktree just as a .git directory marks a repo.
    await writeFile(join(directory, '.git'), 'gitdir: synthetic-private-secret');
    const output = join(directory, 'report.json');
    failure(command(input, output), 'OUTPUT_LOCATION');
    await absent(output);
  });
});

test('bare Git repositories and their symlink aliases also reject private report output', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), bare = join(directory, 'bare-repository');
    await writeFile(input, JSON.stringify(manifest()));
    execFileSync('git', ['init', '--bare', '--initial-branch=main', bare], { stdio: 'pipe' });
    const output = join(bare, 'synthetic-private-secret-report.json');
    failure(command(input, output), 'OUTPUT_LOCATION');
    await absent(output);
    const alias = join(directory, 'bare-alias');
    await symlink(bare, alias);
    failure(command(input, join(alias, 'synthetic-private-secret-report.json')), 'OUTPUT_LOCATION');
    await absent(output);
    // Storage/admin markers can be links; even an unavailable linked target
    // cannot turn the enclosing repository into a report destination.
    await rm(join(bare, 'objects'), { recursive: true });
    await symlink(join(directory, 'unavailable-shared-objects'), join(bare, 'objects'));
    failure(command(input, output), 'OUTPUT_LOCATION');
    await absent(output);
  });
});

test('a failed write removes only the newly created output and keeps CLI-safe errors', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    await writeFile(input, JSON.stringify(manifest()));
    const probe = await open(join(directory, 'probe'), 'wx');
    const prototype = Object.getPrototypeOf(probe), original = prototype.writeFile;
    await probe.close();
    prototype.writeFile = async function () {
      await this.write('partial-private-report');
      throw new Error('synthetic-private-secret');
    };
    try {
      await assert.rejects(runOrdinalReport(input, output), error => error.message === 'ORDINAL_REPORT_OUTPUT_WRITE');
    } finally { prototype.writeFile = original; }
    await absent(output);
    assert.equal(JSON.parse(await readFile(input, 'utf8')).contractVersion, 'kajo-shared-ordinal-manifest-v1');
  });
});

test('post-open fstat failure removes an identified reservation or explicitly retains an unidentifiable empty file', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    await writeFile(input, JSON.stringify(manifest()));
    const probe = await open(join(directory, 'probe'), 'wx');
    const prototype = Object.getPrototypeOf(probe), original = prototype.stat;
    await probe.close();
    for (const persistent of [false, true]) {
      let calls = 0;
      prototype.stat = async function (...args) {
        calls++;
        // Input identity is the first call; report reservation is second.
        if (calls === 2 || (persistent && calls > 2)) throw new Error('synthetic-private-secret');
        return original.apply(this, args);
      };
      try {
        await assert.rejects(runOrdinalReport(input, output),
          error => error.message === `ORDINAL_REPORT_${persistent ? 'OUTPUT_CLEANUP' : 'OUTPUT_WRITE'}`);
      } finally { prototype.stat = original; }
      if (persistent) {
        assert.equal((await stat(output)).size, 0, 'No report data written without fd identity');
        assert.equal((await stat(output)).mode & 0o777, 0o600);
        await rm(output);
      } else await absent(output);
      assert.equal(JSON.parse(await readFile(input, 'utf8')).contractVersion, 'kajo-shared-ordinal-manifest-v1');
    }
  });
});
