import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAudit } from './audit-dependencies.mjs';
import { corrections } from './security-patches.mjs';

const verified = corrections.map(value => ({ ...value, path: `node_modules/${value.name}` }));
function fixture() {
  const vulnerabilities = Object.fromEntries(corrections.map(value => [value.name, {
    name: value.name, severity: 'high', nodes: [`node_modules/${value.name}`],
    via: [{ name: value.name, url: value.advisory }],
  }]));
  vulnerabilities.expo = { name: 'expo', severity: 'high', nodes: ['node_modules/expo'], via: ['braces', 'node-forge', 'metro'] };
  vulnerabilities.metro = { name: 'metro', severity: 'high', nodes: ['node_modules/metro'], via: ['expo'] };
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 4, critical: 0, total: 4 } } };
}

test('audit preserves upstream findings and resolves only verified corrections through cyclic parents', () => {
  const report = fixture();
  const before = structuredClone(report);
  const result = classifyAudit(report, verified);
  assert.equal(result.mitigated.length, 4);
  assert.deepEqual(result.unmitigated, []);
  assert.deepEqual(report, before);
});

test('a new advisory on an already corrected package still blocks its parents', () => {
  const report = fixture();
  report.vulnerabilities.braces.via.push({ name: 'braces', url: 'https://github.com/advisories/GHSA-unknown-new-issue' });
  assert.deepEqual(classifyAudit(report, verified).unmitigated.map(value => value.name), ['braces', 'expo', 'metro']);
});

test('missing, differently versioned and additional unverified copies block audit', () => {
  assert.equal(classifyAudit(fixture(), []).unmitigated.length, 4);
  const report = fixture();
  report.vulnerabilities.braces.nodes.push('apps/mobile/node_modules/braces');
  assert.equal(classifyAudit(report, verified).unmitigated.length, 3);
  assert.equal(classifyAudit(fixture(), verified.map(value => ({ ...value, version: 'unknown' }))).unmitigated.length, 4);
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
