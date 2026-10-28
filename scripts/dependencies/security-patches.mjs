import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodSecurityCorrection } from './zod-security-correction.mjs';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const depthError = "throw new SyntaxError('Brace nesting exceeds the supported depth (128)');";

// These are source corrections, not package/version aliases. Keep the real npm
// identities so the raw advisory report continues to show upstream findings.
// Remove each correction only after reviewing a fixed upstream release.
export const corrections = [
  {
    name: 'braces', version: '3.0.3',
    advisory: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
    integrity: 'sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==',
    files: [
      {
        path: 'lib/parse.js', sha256: 'e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310',
        replacements: [[
          '      stack.push(block);',
          `      if (stack.length >= 128) { ${depthError} }\n      stack.push(block);`, 2,
        ]],
      },
      {
        path: 'lib/compile.js', sha256: 'dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f',
        replacements: [
          ['  const walk = (node, parent = {}) => {', `  const walk = (node, parent = {}, depth = 0) => {\n    if (depth > 128) { ${depthError} }`, 1],
          ['output += walk(child, node);', 'output += walk(child, node, depth + 1);', 1],
        ],
      },
      {
        path: 'lib/expand.js', sha256: '41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7',
        replacements: [
          ['  const walk = (node, parent = {}) => {', `  const walk = (node, parent = {}, depth = 0) => {\n    if (depth > 128) { ${depthError} }`, 1],
          ['walk(child, node);', 'walk(child, node, depth + 1);', 1],
        ],
      },
      {
        path: 'lib/stringify.js', sha256: '379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a',
        replacements: [
          ['  const stringify = (node, parent = {}) => {', `  const stringify = (node, parent = {}, depth = 0) => {\n    if (depth > 128) { ${depthError} }`, 1],
          ['output += stringify(child);', 'output += stringify(child, {}, depth + 1);', 1],
        ],
      },
    ],
  },
  {
    name: 'node-forge', version: '1.4.0',
    advisory: 'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
    integrity: 'sha512-LarFH0+6VfriEhqMMcLX2F7SwSXeWwnEAJEsYm5QKWchiVYVvJyV9v7UDvUv+w5HO23ZpQTXDv/GxdDdMyOuoQ==',
    files: [
      {
        path: 'lib/rsa.js', sha256: 'fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50',
        replacements: [[
          '            obj.value.length !== 2) {',
          "            obj.value.length !== 2 ||\n            obj.value[0].value.length !== ('parameters' in capture ? 2 : 1) ||\n            ('parameters' in capture && capture.parameters !== '')) {", 1,
        ]],
      },
      {
        path: 'dist/forge.min.js', sha256: 'd9b9074e6861200d676e25dcfe97889db5e8f4150bb766d29c491ad709a51b58',
        replacements: [[
          'if(!s.validate(n,d,o,c)||2!==n.value.length)',
          'if(!s.validate(n,d,o,c)||2!==n.value.length||n.value[0].value.length!==("parameters"in o?2:1)||("parameters"in o&&o.parameters!==""))', 1,
        ]],
      },
      {
        path: 'dist/forge.all.min.js', sha256: 'cb9ba4045a81825f8edb646c38d53a1ac30ce07665bf26042c8dea86d7208642',
        replacements: [[
          'if(!s.validate(a,d,o,c)||2!==a.value.length)',
          'if(!s.validate(a,d,o,c)||2!==a.value.length||a.value[0].value.length!==("parameters"in o?2:1)||("parameters"in o&&o.parameters!==""))', 1,
        ]],
      },
    ],
  },
  zodSecurityCorrection,
  {
    name: 'deepmerge', version: '4.3.1',
    advisory: 'https://github.com/advisories/GHSA-gcqx-w48m-w2h4',
    integrity: 'sha512-3sUqbMEc77XqpdNO7FRyRog+eW3ph+GYCbj+rK+uYyRMuwsVy0rMiVtPn+QJlKFvWP/1PYpapqYn0Me2knFn+A==',
    // Both source writes and the otherwise unguarded target-copy loop must
    // reject __proto__, independently of the target object's shape.
    files: [
      { path: 'index.js', sha256: '12440c84957c1990ea2d5e33dc0091722dc1dc1585c6d20e0c780e568ffa9d30' },
      { path: 'dist/cjs.js', sha256: '2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d' },
      { path: 'dist/umd.js', sha256: 'f33e6596482d1fb5c7c427f8ef92f2aa849eea9223acd974176b2fb27ddbf73a' },
    ].map(file => ({ ...file, replacements: [
      ['return propertyIsOnObject(target, key)', "return key === '__proto__' || propertyIsOnObject(target, key)", 1],
      ['getKeys(target).forEach(function(key) {', "getKeys(target).forEach(function(key) {\n\t\t\tif (key === '__proto__') { return; }", 1],
    ] })),
  },
];

function replaceExact(source, before, after, count) {
  assert.equal(source.split(before).length - 1, count, 'Unexpected dependency patch context');
  return source.split(before).join(after);
}

export function originalSource(source, file) {
  if (hash(source) === file.sha256) return source;
  let original = source;
  for (const [before, after, count] of [...file.replacements].reverse()) {
    original = replaceExact(original, after, before, count);
  }
  assert.equal(hash(original), file.sha256, `Unexpected dependency source: ${file.path}`);
  return original;
}

export function correctedSource(source, file) {
  let corrected = originalSource(source, file);
  for (const [before, after, count] of file.replacements) {
    corrected = replaceExact(corrected, before, after, count);
  }
  return corrected;
}

export function resolveDependencyDirectory(root, node, pathApi = path) {
  const directory = pathApi.resolve(root, node);
  const relative = pathApi.relative(pathApi.resolve(root), directory);
  assert.ok(relative && relative !== '..' &&
    !relative.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(relative),
  'Invalid dependency path');
  return directory;
}

export async function securityPatches({ root = projectRoot, install = false } = {}) {
  const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  assert.equal(lock.lockfileVersion, 3, 'Review the dependency lock format');
  const verified = [];
  for (const correction of corrections) {
    const nodes = Object.entries(lock.packages).filter(([path]) => path.endsWith(`/node_modules/${correction.name}`) || path === `node_modules/${correction.name}`);
    assert.ok(nodes.length > 0, `Review/remove the ${correction.name} correction after upgrading`);
    for (const [path, entry] of nodes) {
      const expected = correction.variants?.find(value => value.version === entry.version) ?? correction;
      assert.equal(entry.version, expected.version, `Unreviewed ${correction.name} version`);
      assert.equal(entry.integrity, expected.integrity, `Unreviewed ${correction.name} archive`);
      assert.equal(entry.resolved, `https://registry.npmjs.org/${correction.name}/-/${correction.name}-${expected.version}.tgz`);
      const directory = resolveDependencyDirectory(root, path);
      assert.ok((await lstat(directory)).isDirectory(), 'Dependency must be a real installed directory');
      const pkg = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
      assert.equal(pkg.name, correction.name);
      assert.equal(pkg.version, expected.version);
      for (const file of expected.unmodifiedFiles ?? []) {
        const absolute = resolve(directory, file.path);
        assert.ok((await lstat(absolute)).isFile(), 'Dependency source must be a regular file');
        assert.equal(hash(await readFile(absolute)), file.sha256, `Unreviewed fixed dependency source: ${path}/${file.path}`);
      }
      const files = [];
      for (const file of expected.files) {
        const absolute = resolve(directory, file.path);
        assert.ok((await lstat(absolute)).isFile(), 'Dependency source must be a regular file');
        const source = await readFile(absolute, 'utf8');
        const corrected = correctedSource(source, file);
        if (install && source !== corrected) await writeFile(absolute, corrected);
        else assert.equal(source, corrected, `Security correction missing: ${path}/${file.path}`);
        files.push({ path: file.path, originalSha256: file.sha256, correctedSha256: hash(corrected) });
      }
      verified.push({ name: correction.name, version: expected.version, advisory: correction.advisory, path, files,
        ...(expected.unmodifiedFiles ? { upstreamFixedFiles: expected.unmodifiedFiles } : {}) });
    }
  }
  return verified;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await securityPatches({ install: true });
  console.log('Verified braces, node-forge, Zod and deepmerge compatibility source corrections applied.');
}
