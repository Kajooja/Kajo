import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { prepareCatalogDeployment } from './prepare-catalog-deployment.mjs';

const projectRef = 'abcdefghijklmnopqrst';

test('deployment payload passes actual catalog HTTP tests without npm or remote modules', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-packet-test-'));
  try {
    const outputDirectory = join(root, 'packet');
    const { manifest } = await prepareCatalogDeployment({ projectRef, outputDirectory });
    const serialized = await readFile(join(outputDirectory, 'deploy-payload.json'), 'utf8');
    assert.equal(createHash('sha256').update(serialized).digest('hex'), manifest.payloadSha256);
    const payload = JSON.parse(serialized);
    assert.equal(payload.project_id, projectRef);
    assert.equal(payload.verify_jwt, false);
    assert.equal(payload.files.length, 3);
    assert.ok(payload.files.some((file) => file.name === payload.entrypoint_path));
    assert.ok(payload.files.some((file) => file.name === payload.import_map_path));
    const verification = await readFile(join(outputDirectory, 'verification.txt'), 'utf8');
    assert.match(verification, /[1-9]\d* passed \| 0 failed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a newly introduced registry dependency prevents publishing a deployment payload', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-packet-test-'));
  try {
    const sourceRoot = join(root, 'source');
    await cp(fileURLToPath(new URL('../../supabase/functions/', import.meta.url)), sourceRoot, { recursive: true });
    await appendFile(join(sourceRoot, 'catalog-import/index.ts'), '\nimport "npm:unreviewed-fixture-package@1.0.0";\n');
    const outputDirectory = join(root, 'packet');
    await assert.rejects(prepareCatalogDeployment({ projectRef, sourceRoot, outputDirectory }));
    await assert.rejects(stat(outputDirectory), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
