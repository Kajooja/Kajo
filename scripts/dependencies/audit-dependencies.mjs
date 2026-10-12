import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corrections, projectRoot, securityPatches } from './security-patches.mjs';

export function npmAuditInvocation(platform = process.platform, environment = process.env) {
  const args = ['audit', '--json', '--audit-level=moderate'];
  if (environment.npm_execpath) {
    // npm run supplies its CLI path; Node executes it without a shell on every OS.
    return { command: process.execPath, args: [environment.npm_execpath, ...args] };
  }
  if (platform === 'win32') {
    // Direct node invocation also works: Windows cannot execute npm.cmd directly.
    return { command: environment.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'npm.cmd audit --json --audit-level=moderate'] };
  }
  return { command: 'npm', args };
}

// npm identifies published archives, not installed source patches. Retain the
// complete raw report, and classify only these two *verified* source corrections.
// New advisories, missing patches, malformed reports and audit transport errors fail.
export function classifyAudit(report, verified) {
  assert.equal(report.auditReportVersion, 2, 'Unsupported npm audit report');
  assert.ok(!report.error && report.vulnerabilities && report.metadata?.vulnerabilities, 'Incomplete npm audit report');
  const vulnerabilities = report.vulnerabilities;
  assert.ok(!Array.isArray(vulnerabilities), 'Invalid vulnerability map');
  const roots = new Map();
  for (const [name, finding] of Object.entries(vulnerabilities)) {
    assert.equal(finding.name, name);
    assert.ok(Array.isArray(finding.via) && finding.via.length > 0 && Array.isArray(finding.nodes) && finding.nodes.length > 0, 'Incomplete audit finding');
    roots.set(name, new Map());
    for (const via of finding.via) {
      if (typeof via === 'string') assert.ok(vulnerabilities[via], `Missing advisory dependency: ${via}`);
      else {
        assert.ok(typeof via?.url === 'string' && typeof via.name === 'string', 'Malformed advisory');
        roots.get(name).set(`${via.name}:${via.url}`, via);
      }
    }
  }
  // Fixed point handles cycles in Expo/RN's meta-vulnerability graph without
  // treating a visited cycle as a safe leaf.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, finding] of Object.entries(vulnerabilities)) {
      for (const via of finding.via.filter(value => typeof value === 'string')) {
        for (const [key, advisory] of roots.get(via)) {
          if (!roots.get(name).has(key)) { roots.get(name).set(key, advisory); changed = true; }
        }
      }
    }
  }
  const mitigated = [];
  const unmitigated = [];
  for (const [name, finding] of Object.entries(vulnerabilities)) {
    assert.ok(['info', 'low', 'moderate', 'high', 'critical'].includes(finding.severity), 'Unknown severity');
    if (finding.severity === 'info' || finding.severity === 'low') continue;
    const sources = [...roots.get(name).values()];
    const corrected = sources.length > 0 && sources.every(advisory => {
      const correction = corrections.find(entry => entry.name === advisory.name && entry.advisory === advisory.url);
      if (!correction) return false;
      const leaf = vulnerabilities[correction.name];
      return leaf && leaf.nodes.every(path => verified.some(entry => entry.name === correction.name && entry.version === correction.version && entry.advisory === correction.advisory && entry.path === path));
    });
    (corrected ? mitigated : unmitigated).push({ name, severity: finding.severity, advisories: sources.map(source => source.url) });
  }
  // A nonzero summary without detailed findings must never look clean.
  for (const severity of ['moderate', 'high', 'critical']) {
    assert.equal(report.metadata.vulnerabilities[severity], Object.values(vulnerabilities).filter(value => value.severity === severity).length, 'Audit summary/detail mismatch');
  }
  return { mitigated, unmitigated };
}

export async function auditDependencies() {
  const verified = await securityPatches();
  const regression = spawnSync(process.execPath, ['--test', 'scripts/dependencies/security-patches.test.mjs'], {
    cwd: projectRoot, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
  });
  assert.ifError(regression.error);
  assert.equal(regression.status, 0, `Security regressions failed:\n${regression.stdout}\n${regression.stderr}`);
  const invocation = npmAuditInvocation();
  const audit = spawnSync(invocation.command, invocation.args, {
    cwd: projectRoot, encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024,
  });
  assert.ifError(audit.error);
  assert.ok(audit.status === 0 || audit.status === 1, `npm audit failed: ${audit.stderr}`);
  const rawAudit = JSON.parse(audit.stdout);
  const classification = classifyAudit(rawAudit, verified);
  assert.ok(audit.status === 0 || Object.keys(rawAudit.vulnerabilities).length > 0, 'Unexplained npm audit failure');
  const receipt = { format: 'kajo-verified-dependency-audit-v1', rawAudit, verifiedSourceCorrections: verified, ...classification };
  console.log(JSON.stringify(receipt, null, 2));
  if (classification.unmitigated.length > 0) process.exitCode = 1;
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await auditDependencies();
}
