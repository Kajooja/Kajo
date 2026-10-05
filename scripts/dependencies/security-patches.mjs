import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export async function securityPatches({ root = projectRoot, install = false } = {}) {
  const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  assert.equal(lock.lockfileVersion, 3, 'Review the dependency lock format');
  const verified = [];
  for (const correction of corrections) {
    const nodes = Object.entries(lock.packages).filter(([path]) => path.endsWith(`/node_modules/${correction.name}`) || path === `node_modules/${correction.name}`);
    assert.ok(nodes.length > 0, `Review/remove the ${correction.name} correction after upgrading`);
    for (const [path, entry] of nodes) {
      assert.equal(entry.version, correction.version, `Unreviewed ${correction.name} version`);
      assert.equal(entry.integrity, correction.integrity, `Unreviewed ${correction.name} archive`);
      assert.equal(entry.resolved, `https://registry.npmjs.org/${correction.name}/-/${correction.name}-${correction.version}.tgz`);
      const directory = resolve(root, path);
      assert.ok(directory.startsWith(resolve(root) + '/'), 'Invalid dependency path');
      assert.ok((await lstat(directory)).isDirectory(), 'Dependency must be a real installed directory');
      const pkg = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
      assert.equal(pkg.name, correction.name);
      assert.equal(pkg.version, correction.version);
      const files = [];
      for (const file of correction.files) {
        const absolute = resolve(directory, file.path);
        assert.ok((await lstat(absolute)).isFile(), 'Dependency source must be a regular file');
        const source = await readFile(absolute, 'utf8');
        const corrected = correctedSource(source, file);
        if (install && source !== corrected) await writeFile(absolute, corrected);
        else assert.equal(source, corrected, `Security correction missing: ${path}/${file.path}`);
        files.push({ path: file.path, originalSha256: file.sha256, correctedSha256: hash(corrected) });
      }
      verified.push({ name: correction.name, version: correction.version, advisory: correction.advisory, path, files });
    }
  }
  return verified;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await securityPatches({ install: true });
  console.log('Verified braces depth and node-forge DigestAlgorithm source corrections applied.');
}
