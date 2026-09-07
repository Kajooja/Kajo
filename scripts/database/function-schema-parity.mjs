import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const format = 'kajo-function-schema-v1';
const fields = ['definitionSha256', 'owner', 'acl'];
function validate(snapshot) {
  if (snapshot?.format !== format || !Number.isInteger(snapshot.serverMajor)
      || snapshot.serverMajor < 14 || !Array.isArray(snapshot.functions) || !snapshot.functions.length) {
    throw new Error('Invalid or empty function snapshot');
  }
  const rows = new Map();
  for (const row of snapshot.functions) {
    if (!row || typeof row.identity !== 'string' || !/^(public|private)\..+\(.*\)$/.test(row.identity)
        || !/^[a-f0-9]{64}$/.test(row.definitionSha256) || typeof row.owner !== 'string' || !row.owner
        || !Array.isArray(row.acl)) throw new Error('Invalid function metadata');
    if (rows.has(row.identity)) throw new Error(`Duplicate function ${row.identity}`);
    const acl = row.acl.map(grant => {
      if (!grant || !['grantor', 'grantee'].every(key => typeof grant[key] === 'string' && grant[key])
          || grant.privilege !== 'EXECUTE' || typeof grant.grantable !== 'boolean') {
        throw new Error('Invalid function ACL');
      }
      return JSON.stringify([grant.grantor, grant.grantee, grant.privilege, grant.grantable]);
    }).sort();
    if (new Set(acl).size !== acl.length) throw new Error('Duplicate function ACL');
    rows.set(row.identity, { definitionSha256: row.definitionSha256, owner: row.owner, acl });
  }
  return rows;
}

export function compareFunctionSchemas(expected, actual) {
  const left = validate(expected);
  const right = validate(actual);
  if (expected.serverMajor !== actual.serverMajor) throw new Error('PostgreSQL major versions differ');
  const missing = [...left.keys()].filter(key => !right.has(key)).sort();
  const unexpected = [...right.keys()].filter(key => !left.has(key)).sort();
  const changed = [...left.keys()].filter(key => right.has(key)).sort().flatMap(identity => {
    const differences = fields.filter(field => JSON.stringify(left.get(identity)[field]) !== JSON.stringify(right.get(identity)[field]));
    return differences.length ? [{ identity, fields: differences }] : [];
  });
  return { status: missing.length || unexpected.length || changed.length ? 'MISMATCH' : 'MATCH',
    scope: 'Functions and direct ACL (including defaults) only; not complete schema or behavioral parity',
    expectedCount: left.size, actualCount: right.size, missing, unexpected, changed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node scripts/database/function-schema-parity.mjs <expected.json> <actual.json>');
    const snapshots = await Promise.all(process.argv.slice(2).map(async path => JSON.parse(await readFile(path, 'utf8'))));
    const report = compareFunctionSchemas(...snapshots);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'MATCH' ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
