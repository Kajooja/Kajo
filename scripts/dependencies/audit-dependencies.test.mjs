import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { classifyAudit, npmAuditInvocation } from './audit-dependencies.mjs';
import { corrections } from './security-patches.mjs';

const verified = corrections.map(value => ({ ...value, path: `node_modules/${value.name}` }));
const findingCount = corrections.length + 2;

test('npm-run CLI execution preserves argument boundaries on Windows and POSIX', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'kajo-npm-invocation-'));
  try {
    const cli = join(temporary, 'npm cli & fixture.cjs');
    await writeFile(cli, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));');
    for (const platform of ['win32', 'linux']) {
      const invocation = npmAuditInvocation(platform, { npm_execpath: cli });
      const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8', timeout: 5000 });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), ['audit', '--json', '--audit-level=moderate']);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('direct Windows audit uses the command interpreter and a fixed audit command', () => {
  const invocation = npmAuditInvocation('win32', {});
  assert.equal(invocation.command, 'cmd.exe');
  assert.deepEqual(invocation.args, ['/d', '/s', '/c', 'npm.cmd audit --json --audit-level=moderate']);
  assert.equal(npmAuditInvocation('linux', {}).command, 'npm');
});

function fixture() {
  const vulnerabilities = Object.fromEntries(corrections.map(value => [value.name, {
    name: value.name, severity: 'high', nodes: [`node_modules/${value.name}`],
    via: [{ name: value.name, url: value.advisory }],
  }]));
  vulnerabilities.expo = { name: 'expo', severity: 'high', nodes: ['node_modules/expo'], via: ['braces', 'node-forge', 'zod', 'metro'] };
  vulnerabilities.metro = { name: 'metro', severity: 'high', nodes: ['node_modules/metro'], via: ['expo'] };
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: findingCount, critical: 0, total: findingCount } } };
}

test('audit preserves upstream findings and resolves only verified corrections through cyclic parents', () => {
  const report = fixture();
  const before = structuredClone(report);
  const result = classifyAudit(report, verified);
  assert.equal(result.mitigated.length, findingCount);
  assert.deepEqual(result.unmitigated, []);
  assert.deepEqual(report, before);
});

test('a new advisory on an already corrected package still blocks its parents', () => {
  const report = fixture();
  report.vulnerabilities.braces.via.push({ name: 'braces', url: 'https://github.com/advisories/GHSA-unknown-new-issue' });
  assert.deepEqual(classifyAudit(report, verified).unmitigated.map(value => value.name), ['braces', 'expo', 'metro']);
});

test('missing, differently versioned and additional unverified copies block audit', () => {
  assert.equal(classifyAudit(fixture(), []).unmitigated.length, findingCount);
  const report = fixture();
  report.vulnerabilities.braces.nodes.push('apps/mobile/node_modules/braces');
  assert.equal(classifyAudit(report, verified).unmitigated.length, 3);
  assert.equal(classifyAudit(fixture(), verified.map(value => ({ ...value, version: 'unknown' }))).unmitigated.length, findingCount);
});

test('Zod classification needs the exact reported copy and never borrows a fixed archive identity', () => {
  const report = fixture();
  report.vulnerabilities.zod.nodes.push('node_modules/@expo/cli/node_modules/zod');
  assert.deepEqual(classifyAudit(report, verified).unmitigated.map(value => value.name), ['zod', 'expo', 'metro']);
  const differentlyVersioned = verified.map(value => value.name === 'zod' ? { ...value, version: '4.6.7' } : value);
  assert.deepEqual(classifyAudit(fixture(), differentlyVersioned).unmitigated.map(value => value.name), ['zod', 'expo', 'metro']);
});

test('audit refuses unknown graph edges, advisory shapes, severities and summary mismatches', () => {
  for (const change of [
    report => { report.vulnerabilities.expo.via.push('absent'); },
    report => { report.vulnerabilities.braces.via = [{}]; },
    report => { report.vulnerabilities.braces.severity = 'unknown'; },
    report => { report.metadata.vulnerabilities.high = 0; },
    report => { report.error = { code: 'ENETUNREACH' }; },
    report => { delete report.metadata; },
  ]) {
    const report = fixture(); change(report);
    assert.throws(() => classifyAudit(report, verified));
  }
});

test('cycles without a real advisory leaf are blocked', () => {
  const report = fixture();
  report.vulnerabilities.expo.via = ['metro'];
  assert.deepEqual(classifyAudit(report, verified).unmitigated.map(value => value.name), ['expo', 'metro']);
});

test('ordinary clean reports remain clean after verified source checks', () => {
  assert.deepEqual(classifyAudit({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { moderate: 0, high: 0, critical: 0 } } }, verified), { mitigated: [], unmitigated: [] });
});

test('a low deepmerge leaf still requires its exact correction for a high Expo parent', () => {
  const report = fixture();
  report.vulnerabilities.deepmerge.severity = 'low';
  report.vulnerabilities.expo.via.push('deepmerge');
  report.metadata.vulnerabilities.high--;
  report.metadata.vulnerabilities.low++;
  assert.deepEqual(classifyAudit(report, verified).unmitigated, []);
  assert.deepEqual(classifyAudit(report, verified.filter(value => value.name !== 'deepmerge')).unmitigated.map(value => value.name), ['expo', 'metro']);
});
