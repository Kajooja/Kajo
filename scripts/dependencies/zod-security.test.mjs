import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { corrections, originalSource, projectRoot, securityPatches } from './security-patches.mjs';

const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve('@expo/cli/package.json'));
const directories = [dirname(require.resolve('zod/package.json')), dirname(expoRequire.resolve('zod/package.json'))];
const lock = JSON.parse(await readFile(resolve(projectRoot, 'package-lock.json'), 'utf8'));
const correction = corrections.find(value => value.name === 'zod');

function boundedChild(source, { heap = 192, timeout = 8000 } = {}) {
  const result = spawnSync(process.execPath, [`--max-old-space-size=${heap}`, '--input-type=module', '-e', source],
    { encoding: 'utf8', timeout, maxBuffer: 16384 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

async function checkClassic(z, { v4 = false } = {}) {
  let parsed = 0;
  let refined = 0;
  const element = z.string().refine(() => { parsed += 1; return true; });
  for (const schema of [z.array(element).max(1, 'too many'), z.array(element).length(1),
    z.set(element).max(1), z.set(element).size(1)]) {
    const value = schema.safeParse instanceof Function && schema instanceof z.ZodSet
      ? new Set(['a', 'b']) : ['a', 'b'];
    const result = schema.refine(() => { refined += 1; return true; }).safeParse(value);
    assert.equal(result.success, false);
    assert.equal(result.error.issues.length, 1);
    assert.equal(result.error.issues[0].code, 'too_big');
  }
  assert.equal(parsed, 0, 'oversized containers must not parse elements');
  assert.equal(refined, 0, 'later refinements must not receive unparsed elements');
  const invalid = z.object({ values: z.array(z.string()).max(1, 'limit') }).safeParse({ values: [0, 1] });
  assert.deepEqual(invalid.error.issues.map(issue => [issue.code, issue.path, issue.message]), [['too_big', ['values'], 'limit']]);
  assert.deepEqual(z.array(z.string().transform(value => value.toUpperCase())).max(2).parse(['a', 'b']), ['A', 'B']);
  assert.deepEqual(z.preprocess(value => value.slice(0, 1), z.array(z.string()).max(1)).parse(['a', 'b']), ['a']);
  assert.equal(z.array(z.string()).min(2).safeParse(['a']).error.issues[0].code, 'too_small');
  assert.equal(z.set(z.string()).min(2).safeParse(new Set(['a'])).error.issues[0].code, 'too_small');
  assert.equal(z.array(z.string()).max(1).safeParse('bad').error.issues[0].code, 'invalid_type');
  assert.equal(z.array(z.string()).safeParse([0, 1]).error.issues.length, 2, 'unbounded errors remain unchanged');
  assert.equal(z.array(z.string()).max(3).safeParse([0, 1]).error.issues.length, 2, 'in-bound errors remain unchanged');
  assert.equal(z.set(z.string()).max(3).safeParse(new Set([0, 1])).error.issues.length, 2);
  let asyncParsed = 0;
  const asyncElement = z.string().refine(async () => { asyncParsed += 1; return true; });
  assert.equal((await z.array(asyncElement).max(1).safeParseAsync(['a', 'b'])).error.issues.length, 1);
  assert.equal((await z.set(asyncElement).max(1).safeParseAsync(new Set(['a', 'b']))).error.issues.length, 1);
  assert.equal(asyncParsed, 0);
  assert.deepEqual(await z.array(asyncElement).max(1).parseAsync(['a']), ['a']);
  assert.equal(asyncParsed, 1);
  if (v4) {
    let overwritten = 0;
    assert.deepEqual(z.array(z.number()).overwrite(values => values.slice(0, 1)).max(1).parse([1, 2]), [1]);
    assert.equal(z.array(z.number()).max(1).overwrite(values => { overwritten += 1; return values; })
      .safeParse([1, 2]).error.issues[0].code, 'too_big');
    assert.equal(overwritten, 0);
    let before = 0;
    const ordered = z.array(z.string()).refine(() => { before += 1; return true; }).max(1);
    assert.equal(ordered.safeParse(['a', 'b']).error.issues.length, 1);
    assert.equal(before, 1, 'a non-size check before the bound retains its original order');
  }
}

function checkMini(z) {
  for (const [schema, value] of [
    [z.array(z.string()).check(z.maxLength(1)), [0, 1]],
    [z.set(z.string()).check(z.maxSize(1)), new Set([0, 1])],
    [z.map(z.string(), z.string()).check(z.maxSize(1)), new Map([[0, 0], [1, 1]])],
  ]) {
    const result = schema.safeParse(value);
    assert.equal(result.success, false);
    assert.equal(result.error.issues.length, 1);
    assert.equal(result.error.issues[0].code, 'too_big');
  }
  assert.deepEqual(z.array(z.string()).check(z.maxLength(1)).parse(['ok']), ['ok']);
}

function checkCore(core) {
  const string = () => new core.$ZodString({ type: 'string' });
  for (const [schema, value] of [
    [new core.$ZodArray({ type: 'array', element: string(), checks: [new core.$ZodCheckMaxLength({ check: 'max_length', maximum: 1 })] }), [0, 1]],
    [new core.$ZodSet({ type: 'set', valueType: string(), checks: [new core.$ZodCheckMaxSize({ check: 'max_size', maximum: 1 })] }), new Set([0, 1])],
    [new core.$ZodMap({ type: 'map', keyType: string(), valueType: string(), checks: [new core.$ZodCheckMaxSize({ check: 'max_size', maximum: 1 })] }), new Map([[0, 0], [1, 1]])],
  ]) {
    const result = core.safeParse(schema, value);
    assert.equal(result.success, false);
    assert.equal(result.error.issues.length, 1);
    assert.equal(result.error.issues[0].code, 'too_big');
  }
}

for (const directory of directories) {
  const version = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).version;
  test(`Zod ${version} CJS and ESM public APIs reject upper bounds before walking elements`, async () => {
    const localRequire = createRequire(join(directory, 'package.json'));
    for (const extension of ['cjs', 'js']) {
      const load = async path => extension === 'cjs' ? localRequire(`./${path}.${extension}`)
        : import(pathToFileURL(join(directory, `${path}.${extension}`)).href);
      await checkClassic((await load('v3/index')).z);
      await checkClassic((await load('v4/index')).z, { v4: true });
      await checkClassic((await load('index')).z, { v4: version.startsWith('4.') });
      for (const alias of ['v4-mini/index', 'v4/mini/index']) checkMini(await load(alias));
      checkCore(await load('v4/core/index'));
    }
  });
}

test('million-element invalid arrays remain bounded through actual installed consumers', () => {
  boundedChild(`
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(import.meta.url)});
    const expo = createRequire(require.resolve('@expo/cli/package.json'));
    const values = Array(1_000_000).fill(0);
    for (const z of [require('zod').z, require('zod/v3').z, expo('zod').z, expo('zod/v4').z]) {
      const result = z.array(z.string()).max(1).safeParse(values);
      assert.equal(result.success, false);
      assert.equal(result.error.issues.length, 1);
      assert.equal(result.error.issues[0].code, 'too_big');
    }
    const schemas = expo('./build/src/start/server/DevToolsPlugin.schema.js');
    assert.equal(schemas.PluginSchema.safeParse({ packageName: 'kajo', packageRoot: '/kajo' }).success, true);
    assert.equal(schemas.PluginSchema.safeParse({ packageName: '', packageRoot: '/kajo' }).success, false);
  `);
});

test('source-condition v3/v4 files compile to the same guarded behavior', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'kajo-zod-source-'));
  try {
    for (const directory of directories) {
      const version = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).version;
      const copy = join(temporary, version);
      await cp(directory, copy, { recursive: true });
      for (const file of ['v3/types', 'v4/core/schemas']) {
        const source = await readFile(join(copy, `src/${file}.ts`), 'utf8');
        const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
        await writeFile(join(copy, `${file}.js`), compiled.outputText);
      }
      await checkClassic((await import(pathToFileURL(join(copy, 'v3/index.js')).href)).z);
      await checkClassic((await import(pathToFileURL(join(copy, 'v4/index.js')).href)).z, { v4: true });
      checkMini(await import(pathToFileURL(join(copy, 'v4/mini/index.js')).href));
      checkCore(await import(pathToFileURL(join(copy, 'v4/core/index.js')).href));
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('pristine upstream negative controls reproduce v3 and bundled v4 issue amplification', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'kajo-zod-control-'));
  try {
    for (const directory of directories) {
      const version = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).version;
      const expected = correction.variants.find(value => value.version === version) ?? correction;
      const copy = join(temporary, version);
      await cp(directory, copy, { recursive: true });
      for (const file of expected.files) {
        const path = join(copy, file.path);
        await writeFile(path, originalSource(await readFile(path, 'utf8'), file));
      }
      const z3 = (await import(pathToFileURL(join(copy, 'v3/index.js')).href)).z;
      assert.equal(z3.array(z3.string()).max(1).safeParse([0, 1, 2]).error.issues.length, 4);
      assert.equal(z3.set(z3.string()).max(1).safeParse(new Set([0, 1, 2])).error.issues.length, 4);
      if (version.startsWith('3.')) {
        const z4 = (await import(pathToFileURL(join(copy, 'v4/index.js')).href)).z;
        assert.equal(z4.array(z4.string()).max(1).safeParse([0, 1, 2]).error.issues.length, 4);
      }
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('unknown archive versions and modified fixed v4 execution files fail closed', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'kajo-zod-verification-'));
  try {
    for (const [path] of Object.entries(lock.packages).filter(([path]) => corrections.some(value =>
      path === `node_modules/${value.name}` || path.endsWith(`/node_modules/${value.name}`)))) {
      await cp(resolve(projectRoot, path), join(temporary, path), { recursive: true });
    }
    await writeFile(join(temporary, 'package-lock.json'), JSON.stringify(lock));
    await securityPatches({ root: temporary });
    const compile = join(temporary, 'node_modules/zod/v4/core/compile.js');
    const source = await readFile(compile, 'utf8');
    await writeFile(compile, source + '\n// unreviewed change');
    await assert.rejects(securityPatches({ root: temporary }), /Unreviewed fixed dependency source/);
    await writeFile(compile, source);
    const unknown = structuredClone(lock);
    unknown.packages['node_modules/zod'].version = '4.6.8';
    await writeFile(join(temporary, 'package-lock.json'), JSON.stringify(unknown));
    await assert.rejects(securityPatches({ root: temporary }), /Unreviewed zod version/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
