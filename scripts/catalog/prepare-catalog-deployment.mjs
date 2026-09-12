#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DENO = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'deno.cmd' : 'deno');
const FILES = [
  'catalog-import/index.ts',
  'catalog-import/deno.json',
  '_shared/catalog-normalizers.mjs',
];
const sha256 = (content) => createHash('sha256').update(content).digest('hex');

// Preparation only: no credentials, provider requests, CLI deployment or SQL.
// The returned payload is the exact deploy_edge_function tool argument.
export async function prepareCatalogDeployment({
  projectRef,
  outputDirectory,
  sourceRoot = join(REPO_ROOT, 'supabase', 'functions'),
}) {
  assert.match(projectRef, /^[a-z]{20}$/, 'A Supabase project ref is required');
  const scratch = await mkdtemp(join(tmpdir(), 'kajo-catalog-packet-'));
  try {
    const staging = join(scratch, 'functions');
    const files = [];
    for (const name of FILES) {
      const content = await readFile(join(sourceRoot, name), 'utf8');
      files.push({ name, content });
      await mkdir(dirname(join(staging, name)), { recursive: true });
      await writeFile(join(staging, name), content);
    }
    assert.deepEqual(JSON.parse(files[1].content), {
      nodeModulesDir: 'none', lock: false, imports: {},
    }, 'Review deployment configuration changes before packaging');

    // A fresh cache and disabled npm/remote resolution prove that the actual
    // staged entrypoint needs only the shipped files and a runtime builtin.
    const options = {
      cwd: staging,
      env: { ...process.env, DENO_DIR: join(scratch, 'cache'), DENO_NO_PACKAGE_JSON: '1' },
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 60_000,
    };
    assert.match(execFileSync(DENO, ['--version'], options), /^deno 2\.1\.4 /);
    const graph = JSON.parse(execFileSync(DENO, [
      'info', '--no-config', '--no-lock', '--no-npm', '--no-remote', '--json',
      join(staging, FILES[0]),
    ], options));
    const expectedModules = [
      pathToFileURL(join(staging, FILES[0])).href,
      pathToFileURL(join(staging, FILES[2])).href,
      'node:crypto',
    ];
    assert.deepEqual(graph.modules.map((module) => {
      assert.equal(module.error, undefined, 'Every deployment dependency must resolve');
      return module.specifier;
    }).sort(), expectedModules.sort(), 'Unexpected deployment dependency');
    assert.deepEqual(graph.npmPackages, {});
    assert.deepEqual(graph.redirects, {});

    const testOutput = execFileSync(DENO, [
      'test', '--no-config', '--no-lock', '--no-check', '--no-npm', '--no-remote',
      '--cached-only', '--no-prompt', '--allow-net=127.0.0.1',
      `--allow-read=${staging}`,
      join(REPO_ROOT, 'supabase', 'functions', 'entrypoints.test.ts'),
      '--', pathToFileURL(`${staging}/`).href,
    ], options);

    const payload = {
      project_id: projectRef,
      name: 'catalog-import',
      entrypoint_path: FILES[0],
      import_map_path: FILES[1],
      verify_jwt: false,
      files,
    };
    const serializedPayload = `${JSON.stringify(payload, null, 2)}\n`;
    const manifest = {
      schema: 'kajo-catalog-deployment-v1',
      projectRef,
      functionName: payload.name,
      entrypoint: payload.entrypoint_path,
      verifyJwt: false,
      verifiedWith: 'Deno 2.1.4; fresh cache; npm and remote modules disabled',
      runtimeBuiltins: ['node:crypto'],
      files: files.map(({ name, content }) => ({
        name, bytes: Buffer.byteLength(content), sha256: sha256(content),
      })),
      payloadSha256: sha256(serializedPayload),
    };
    // Publish output only after graph verification and handler tests succeed.
    // Refuse an existing packet rather than mixing old and newly checked files.
    const output = resolve(outputDirectory);
    await mkdir(dirname(output), { recursive: true });
    await mkdir(output);
    await writeFile(join(output, 'deploy-payload.json'), serializedPayload);
    await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(join(output, 'verification.txt'), testOutput);
    return { manifest, outputDirectory: output };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function runCli() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: npm run catalog:prepare-deployment -- --project-ref REF --output NEW_DIRECTORY');
    return;
  }
  assert.equal(args.length, 4, 'Use --project-ref REF --output NEW_DIRECTORY');
  assert.equal(args[0], '--project-ref');
  assert.equal(args[2], '--output');
  const result = await prepareCatalogDeployment({ projectRef: args[1], outputDirectory: args[3] });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
