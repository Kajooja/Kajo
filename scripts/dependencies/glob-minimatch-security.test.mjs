import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { correctedSource, originalSource, projectRoot } from './security-patches.mjs';
import { globMinimatchSecurityCorrections, globSecurityCorrection, minimatchSecurityCorrection } from './glob-minimatch-security-corrections.mjs';

const lock = JSON.parse(await readFile(join(projectRoot, 'package-lock.json'), 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const minimatchNodes = Object.entries(lock.packages).filter(([path]) => path.endsWith('/minimatch'));
const globNodes = Object.entries(lock.packages).filter(([path]) => path.endsWith('/glob'));

function child(code) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8', timeout: 15000, maxBuffer: 16384,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout ? JSON.parse(result.stdout) : undefined;
}

function moduleLoad(path, format) {
  return format === 'commonjs'
    ? `const api = (await import('node:module')).createRequire(import.meta.url)(${JSON.stringify(path)});`
    : `const api = await import(${JSON.stringify(pathToFileURL(path).href)});`;
}

test('glob/minimatch corrections pin every archive and executable source, including the unchanged legacy optimizer absence', async () => {
  assert.equal(minimatchNodes.length, 4);
  assert.equal(globNodes.length, 1);
  for (const correction of globMinimatchSecurityCorrections) {
    const nodes = correction.name === 'glob' ? globNodes : minimatchNodes;
    for (const [node, entry] of nodes) {
      const variant = correction.variants?.find(value => value.version === entry.version) ?? correction;
      assert.equal(entry.version, variant.version);
      assert.equal(entry.integrity, variant.integrity);
      assert.equal(entry.resolved, `https://registry.npmjs.org/${correction.name}/-/${correction.name}-${variant.version}.tgz`);
      for (const file of variant.files) {
        const installed = await readFile(join(projectRoot, node, file.path), 'utf8');
        const pristine = originalSource(installed, file);
        assert.equal(sha256(pristine), file.sha256);
        const corrected = correctedSource(pristine, file);
        assert.equal(installed, corrected, `Missing correction: ${node}/${file.path}`);
        assert.equal(correctedSource(corrected, file), corrected);
        assert.throws(() => correctedSource(`${corrected}\n// unexpected change`, file));
        const [before, after] = file.replacements[0];
        assert.throws(() => correctedSource(corrected.replace(after, before), file));
      }
      for (const file of variant.unmodifiedFiles ?? []) {
        const source = await readFile(join(projectRoot, node, file.path), 'utf8');
        assert.equal(sha256(source), file.sha256);
        assert.equal(variant.evidenceKind, 'NOT_AFFECTED_VULNERABLE_OPTIMIZER_ABSENT');
        assert.equal(variant.files.length, 0);
        assert.doesNotMatch(source, /firstPhasePreProcess|secondPhasePreProcess|optimizationLevel/);
      }
    }
  }
});

async function minimatchProbe(api, legacy = false, pristine = false) {
  const assert = (await import('node:assert/strict')).default;
  const { Minimatch } = api;
  const options = { optimizationLevel: 2, braceExpandMax: 64 };
  const pattern = Array(pristine ? 8 : 30).fill('**/../a/b').join('/');
  const generated = new Minimatch(pattern, options);
  assert.equal(generated.set.length, legacy ? 1 : pristine ? 256 : 64);
  if (legacy) {
    assert.equal(typeof Minimatch.prototype.firstPhasePreProcess, 'undefined');
    assert.equal(typeof Minimatch.prototype.secondPhasePreProcess, 'undefined');
  } else {
    const small = new Minimatch('**/../a/b/**/../c/d', { optimizationLevel: 2 });
    assert.equal(small.set.length, 4);
    assert.equal(small.match('../a/b/../c/d'), true);
    assert.equal(small.match('x/a/b/y/c/d'), true);
    const large = new Minimatch('{x,*}/{0..999}', { optimizationLevel: 2 });
    assert.equal(large.set.length, pristine ? 1000 : 2000);
    assert.equal(large.match('x/5'), true);
    assert.equal(large.match('y/999'), true);
    assert.equal(large.match('.y/5'), false);
  }
  // Preserve the old API used by ESLint, TypeScript/Expo tooling and glob 13.
  const ordinary = new Minimatch('src/**/*.{ts,tsx}');
  assert.equal(ordinary.match('src/features/detail.tsx'), true);
  assert.equal(ordinary.match('src/features/detail.js'), false);
  assert.ok(ordinary.makeRe() instanceof RegExp);
  assert.ok(api.makeRe('*.ts') instanceof RegExp);
  assert.deepEqual(api.braceExpand('item/{book,movie}/{1..2}'), ['item/book/1', 'item/book/2', 'item/movie/1', 'item/movie/2']);
  return { legacy, pristine, generatedPatterns: generated.set.length };
}

for (const [node, entry] of minimatchNodes) {
  for (const format of entry.version === '3.1.5' ? ['commonjs'] : ['commonjs', 'esm']) {
    test(`${node} ${format} bounds optimizer growth and preserves matching APIs`, () => {
      const path = join(projectRoot, node, entry.version === '3.1.5' ? 'minimatch.js' : `dist/${format}/index.js`);
      const report = child(`${moduleLoad(path, format)}\nconsole.log(JSON.stringify(await (${minimatchProbe})(api, ${entry.version === '3.1.5'})));`);
      assert.equal(report.generatedPatterns, entry.version === '3.1.5' ? 1 : 64);
    });
  }
}

// Copy only the package under examination; dependencies remain the actual
// locked installations. Reconstruct exact archive bytes to demonstrate the
// defect rather than weakening a production guard or relying on a timeout.
async function pristinePackage(source, correction, run) {
  const temporary = await mkdtemp(join(tmpdir(), 'kajo-glob-minimatch-original-'));
  try {
    const target = join(temporary, correction.name);
    await cp(source, target, { recursive: true, filter: path => !relative(source, path).split(sep).includes('node_modules') });
    const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
    const resolver = createRequire(join(source, 'package.json'));
    for (const dependency of Object.keys(pkg.dependencies ?? {})) {
      const destination = join(target, 'node_modules', dependency);
      await mkdir(dirname(destination), { recursive: true });
      await symlink(dirname(resolver.resolve(`${dependency}/package.json`)), destination, 'dir');
    }
    const variant = correction.variants?.find(value => value.version === pkg.version) ?? correction;
    for (const file of variant.files) {
      const path = join(target, file.path);
      await writeFile(path, originalSource(await readFile(path, 'utf8'), file));
    }
    return await run(target);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

test('pristine minimatch 10 archive reproduces amplification and pairwise deduplication in CJS and ESM', async () => {
  const [node] = minimatchNodes.find(([, entry]) => entry.version === '10.2.6');
  await pristinePackage(join(projectRoot, node), minimatchSecurityCorrection, async original => {
    for (const format of ['commonjs', 'esm']) {
      const report = child(`${moduleLoad(join(original, `dist/${format}/index.js`), format)}\nconsole.log(JSON.stringify(await (${minimatchProbe})(api, false, true)));`);
      assert.equal(report.generatedPatterns, 256);
    }
  });
});

async function globOptimizerProbe(api, pristine = false) {
  const assert = (await import('node:assert/strict')).default;
  const pattern = Array(pristine ? 8 : 30).fill('**/../a/b').join('/');
  const glob = new api.Glob(pattern, { braceExpandMax: 64 });
  assert.equal(glob.patterns.length, pristine ? 256 : 64);
  return glob.patterns.length;
}

// The abort probe below uses actual filesystem callbacks and all four public
// export paths. Completion waits for outstanding callbacks, not an assumed
// elapsed-time ordering. Each run also has an independent child deadline.
async function globAbortProbe(globApi, { expectFixed }) {
  // Keep every dependency inside this function: the regression harness runs its
  // toString() in a bounded child against each published package entry point.
  const { default: assert } = await import('node:assert/strict');
  const { default: fs } = await import('node:fs');
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  assert.equal(typeof expectFixed, 'boolean');
  for (const method of ['glob', 'globSync', 'globStream', 'globStreamSync']) {
    assert.equal(typeof globApi[method], 'function', `Missing public glob API: ${method}`);
  }
  const immediate = () => new Promise(resolve => setImmediate(resolve));
  async function bounded(work) {
    let timer;
    try {
      return await Promise.race([
        work(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Glob probe operation did not settle')), 3000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  const root = await mkdtemp(join(tmpdir(), 'kajo-glob-abort-probe-'));
  const expected = [];
  const report = { version: 'glob-abort-regression-probe-v1', expectFixed, aborts: [], compatibility: [] };
  try {
    for (let index = 0; index < 4; index++) {
      const relative = `group-${index}/child/item.txt`;
      await mkdir(join(root, `group-${index}`, 'child'), { recursive: true });
      await writeFile(join(root, relative), 'fixture');
      expected.push(relative);
    }
    expected.sort();

    for (const method of ['glob', 'globStream', 'globSync', 'globStreamSync']) {
      const controller = new AbortController();
      const reason = new Error(`Deliberate ${method} fixture cancellation`);
      const io = [];
      let firstRead = true;
      let pending = 0;
      const note = operation => io.push({ operation, afterAbort: controller.signal.aborted });
      const abortAfterFirstRead = () => {
        if (firstRead) {
          firstRead = false;
          controller.abort(reason);
        }
      };
      const wrapped = { ...fs, promises: { ...fs.promises } };
      // PathScurry exposes these callback/sync/promise operations through its
      // documented fs option. Count every possible filesystem operation, not
      // only the directory reads that trigger this particular regression.
      for (const name of ['lstat', 'readlink', 'realpath']) {
        wrapped[name] = (...args) => {
          note(name);
          return fs[name](...args);
        };
        wrapped[`${name}Sync`] = (...args) => {
          note(`${name}Sync`);
          return fs[`${name}Sync`](...args);
        };
        wrapped.promises[name] = (...args) => {
          note(`promises.${name}`);
          return fs.promises[name](...args);
        };
      }
      wrapped.readdir = (path, options, callback) => {
        note('readdir');
        pending++;
        fs.readdir(path, options, (error, entries) => {
          try {
            abortAfterFirstRead();
            callback(error, entries);
          } finally {
            pending--;
          }
        });
      };
      wrapped.readdirSync = (...args) => {
        note('readdirSync');
        const entries = fs.readdirSync(...args);
        abortAfterFirstRead();
        return entries;
      };
      wrapped.promises.readdir = async (...args) => {
        note('promises.readdir');
        pending++;
        try {
          const entries = await fs.promises.readdir(...args);
          abortAfterFirstRead();
          return entries;
        } finally {
          pending--;
        }
      };
      const options = { cwd: root, signal: controller.signal, fs: wrapped };
      let failure;
      try {
        await bounded(async () => {
          // No matching file can be written to a destroyed stream. The test
          // measures continued traversal independently of write-after-destroy.
          const result = globApi[method]('**/*.missing', options);
          if (method === 'globStream' || method === 'globStreamSync') await result.collect();
          else await result;
        });
      } catch (error) {
        failure = error;
      }
      const ioAtRejection = io.length;
      // An early rejection is not proof that work stopped. Wait for the finite
      // outstanding filesystem work and one further turn before counting it.
      await bounded(async () => {
        do { await immediate(); } while (pending > 0);
        await immediate();
      });
      const entry = {
        method,
        rejectedWithReason: failure === reason,
        directoryReads: io.filter(value => /readdir/i.test(value.operation)).length,
        ioAtRejection,
        totalIo: io.length,
        afterAbortIo: io.filter(value => value.afterAbort).length,
        afterRejectionIo: io.length - ioAtRejection,
      };
      report.aborts.push(entry);
      const asynchronous = method === 'glob' || method === 'globStream';
      if (expectFixed || asynchronous) {
        assert.equal(entry.rejectedWithReason, true, `${method} must reject with the original abort reason`);
        assert.equal(firstRead, false, `${method} must actually reach the first directory read`);
      }
      if (expectFixed) {
        assert.equal(entry.directoryReads, 1, `${method} must stop after its first directory read`);
        assert.equal(entry.afterAbortIo, 0, `${method} started filesystem work after cancellation`);
        assert.equal(entry.afterRejectionIo, 0, `${method} started filesystem work after rejection`);
      } else if (asynchronous) {
        assert.ok(entry.afterAbortIo > 0, `${method} negative control did not reproduce continued traversal`);
        assert.ok(entry.afterRejectionIo > 0, `${method} negative control did not reproduce I/O after rejection`);
      }
    }

    for (const method of ['glob', 'globSync', 'globStream', 'globStreamSync']) {
      const actual = await bounded(async () => {
        const result = globApi[method]('**/*.txt', { cwd: root });
        return method === 'globStream' || method === 'globStreamSync' ? result.collect() : result;
      });
      assert.deepEqual([...actual].sort(), expected, `${method} changed ordinary matching`);
      report.compatibility.push({ method, results: actual.length });
    }
    const pausedItems = [];
    let pauses = 0;
    await bounded(() => new Promise((resolve, reject) => {
      const stream = globApi.globStream('**/*.txt', { cwd: root });
      stream.once('error', reject);
      stream.once('end', resolve);
      stream.on('data', item => {
        pausedItems.push(item);
        pauses++;
        stream.pause();
        setImmediate(() => stream.resume());
      });
    }));
    assert.deepEqual(pausedItems.sort(), expected, 'Paused stream lost or duplicated a matching file');
    assert.equal(pauses, expected.length);
    report.compatibility.push({ method: 'pausedGlobStream', results: pausedItems.length, pauses });
    return report;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

for (const format of ['commonjs', 'esm']) {
  for (const entry of ['default', 'raw']) {
    test(`glob ${entry} ${format} stops aborted I/O, bounds bundled optimization and preserves streams`, () => {
      const specifier = entry === 'raw' ? 'glob/raw' : 'glob';
      const path = format === 'commonjs'
        ? createRequire(import.meta.url).resolve(specifier)
        : fileURLToPath(import.meta.resolve(specifier));
      assert.ok(path.endsWith(join('dist', format, entry === 'raw' ? 'index.js' : 'index.min.js')));
      const report = child(`${moduleLoad(path, format)}
        await (${globOptimizerProbe})(api);
        console.log(JSON.stringify(await (${globAbortProbe})(api, { expectFixed: true })));
      `);
      assert.equal(report.aborts.length, 4);
      assert.equal(report.compatibility.length, 5);
      assert.ok(report.aborts.every(value => value.afterAbortIo === 0 && value.afterRejectionIo === 0));
    });
  }
}

test('pristine glob archive reproduces post-rejection traversal through all four public entry points', async () => {
  const [node] = globNodes[0];
  await pristinePackage(join(projectRoot, node), globSecurityCorrection, async original => {
    for (const format of ['commonjs', 'esm']) {
      for (const entry of ['default', 'raw']) {
        const path = join(original, `dist/${format}/${entry === 'raw' ? 'index.js' : 'index.min.js'}`);
        const report = child(`${moduleLoad(path, format)}
          ${entry === 'default' ? `await (${globOptimizerProbe})(api, true);` : ''}
          console.log(JSON.stringify(await (${globAbortProbe})(api, { expectFixed: false })));
        `);
        assert.ok(report.aborts.filter(value => ['glob', 'globStream'].includes(value.method))
          .every(value => value.afterRejectionIo > 0));
      }
    }
  });
});
