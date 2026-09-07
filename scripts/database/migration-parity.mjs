// Compare metadata only; never infer successful application from a matching name.
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function compareMigrationHistory(local, hosted) {
  for (const rows of [local, hosted]) {
    if (!Array.isArray(rows)) throw new Error('Expected an array of {version,name} rows');
    const versions = new Set();
    for (const row of rows) {
      if (!row || !/^\d{14}$/.test(row.version) || typeof row.name !== 'string' || !row.name) {
        throw new Error('Invalid migration metadata');
      }
      if (versions.has(row.version)) throw new Error(`Duplicate migration version ${row.version}`);
      versions.add(row.version);
    }
  }
  const key = row => `${row.version}:${row.name}`;
  const localKeys = new Set(local.map(key));
  const hostedKeys = new Set(hosted.map(key));
  const localOnly = local.filter(row => !hostedKeys.has(key(row)));
  const hostedOnly = hosted.filter(row => !localKeys.has(key(row)));
  return { status: localOnly.length || hostedOnly.length ? 'MISMATCH' : 'MATCH',
    localOnly, hostedOnly,
    ambiguousHostedNames: [...new Set(hosted.map(row => row.name))]
      .filter(name => hosted.filter(row => row.name === name).length > 1) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/database/migration-parity.mjs <metadata.json>');
    // metadata.json: JSON array from SELECT version,name FROM supabase_migrations.schema_migrations.
    // Do not supply statement payloads or application data. Input is read only.
    const hosted = JSON.parse(await readFile(process.argv[2], 'utf8'));
    const names = await readdir(new URL('../../supabase/migrations/', import.meta.url));
    const local = names.filter(name => name.endsWith('.sql')).sort().map(filename => {
      const match = /^(\d{14})_(.+)\.sql$/.exec(filename);
      if (!match) throw new Error(`Invalid migration filename ${filename}`);
      return { version: match[1], name: match[2] };
    });
    const report = compareMigrationHistory(local, hosted);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'MATCH' ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
