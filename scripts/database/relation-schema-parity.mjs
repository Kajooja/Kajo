import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function validate(snapshot, fingerprint) {
  if (snapshot?.format !== 'kajo-relation-schema-v1' || !Number.isInteger(snapshot.serverMajor)
      || snapshot.serverMajor < 14 || !Array.isArray(snapshot.relations) || !snapshot.relations.length) {
    throw new Error('Invalid or empty relation snapshot');
  }
  const rows = new Map();
  for (const row of snapshot.relations) {
    if (!row || typeof row.identity !== 'string' || !/^(public|private)\..+$/.test(row.identity)
        || typeof row.definitionSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.definitionSha256)
        || typeof row[fingerprint] !== 'string' || !/^[a-f0-9]{64}$/.test(row[fingerprint])) {
      throw new Error('Invalid relation metadata');
    }
    if (rows.has(row.identity)) throw new Error(`Duplicate relation ${row.identity}`);
    rows.set(row.identity, row[fingerprint]);
  }
  return rows;
}

export function compareRelationSchemas(expected, actual, { fingerprint = 'definitionSha256' } = {}) {
  if (!['definitionSha256', 'structureSha256'].includes(fingerprint)) throw new Error('Unknown relation fingerprint');
  const left = validate(expected, fingerprint);
  const right = validate(actual, fingerprint);
  if (expected.serverMajor !== actual.serverMajor) throw new Error('PostgreSQL major versions differ');
  const missing = [...left.keys()].filter(key => !right.has(key)).sort();
  const unexpected = [...right.keys()].filter(key => !left.has(key)).sort();
  const changed = [...left.keys()].filter(key => right.has(key) && left.get(key) !== right.get(key)).sort();
  return { status: missing.length || unexpected.length || changed.length ? 'MISMATCH' : 'MATCH',
    scope: fingerprint === 'structureSha256'
      ? 'Table/column/constraint/index/RLS definitions only; owner and ACL excluded'
      : 'Table definitions and direct table/column ACL only; see snapshot SQL exclusions',
    expectedCount: left.size, actualCount: right.size, missing, unexpected, changed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node scripts/database/relation-schema-parity.mjs <expected.json> <actual.json>');
    const inputs = await Promise.all(process.argv.slice(2).map(async path => JSON.parse(await readFile(path, 'utf8'))));
    const report = compareRelationSchemas(...inputs);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'MATCH' ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
