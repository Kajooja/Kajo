// Offline source reconciliation for a pinned checkpoint, NOT migration replay.
// Only called with the export diagnostic's disposable PGlite database.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const cutoff = '20260907155201_bootstrap_personal_ranking.sql';
const checkpoint = '755d0b0b4787bec834ed184b85b2fe56cbd095c26090c8aec37342a71f3df6af';
const hash = value => createHash('sha256').update(value).digest('hex');
// These are the only final definitions at this checkpoint that still require
// source DO patches. V0/V1 and Shared have later complete literal definitions.
const patches = [
  ['20260904193200_fix_catalog_upsert_source_conflict.sql', 'public.upsert_catalog_item_v1'],
  ['20260904210000_expand_profile_import_stage_limit.sql', 'private.stage_profile_import_rows_v1'],
  ['20260905003500_fix_resurfacing_null_bootstrap.sql', 'private.resurfacing_policy_decision_v1'],
];

export function reconstructFunctionSource(files) {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  assert.equal(hash(sorted.map(({ name, sql }) => `${name}:${hash(sql)}`).join('\n')), checkpoint,
    'Function source history changed; review reconstruction before comparing');
  const definitions = new Map();
  for (const { name, sql } of sorted) {
    // Deliberately restricted to the hash-verified repository syntax. Never use
    // this extraction as a generic SQL parser or run an unreviewed new history.
    const matches = [...sql.matchAll(/^create(?: or replace)? function\s+((?:public|private)\.[a-z_][a-z0-9_]*)\s*\([\s\S]*?\bas\s+(\$(?:[a-z_][a-z0-9_]*)?\$)[\s\S]*?\2\s*;/gim)];
    assert.equal(matches.length, [...sql.matchAll(/^create(?: or replace)? function\b/gim)].length,
      `Unrecognized function syntax in ${name}`);
    for (const match of matches) {
      definitions.set(match[1].toLowerCase(), { name: match[1].toLowerCase(), migration: name, sql: match[0] });
    }
  }
  assert.equal(definitions.size, 122, 'Unexpected source function count');
  const corrections = patches.map(([migration, name]) => {
    const file = sorted.find(file => file.name === migration);
    assert.ok(file, `Missing source patch ${migration}`);
    assert.ok(definitions.get(name).migration < migration, `Patch superseded for ${name}`);
    return { migration, name, sql: file.sql };
  });
  return { checkpoint, cutoff, definitions: [...definitions.values()], corrections };
}

export async function loadFunctionSource() {
  const names = (await readdir(migrations)).filter(name => /^\d{14}_.+\.sql$/.test(name) && name <= cutoff).sort();
  const files = await Promise.all(names.map(async name => ({ name, sql: await readFile(new URL(name, migrations), 'utf8') })));
  return reconstructFunctionSource(files);
}

const snapshotSql = `select n.nspname || '.' || p.proname as name,
  format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as identity,
  encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') as hash
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private') and p.prokind in ('f','p') order by 2`;

export async function compareExportFunctionSource(db) {
  const source = await loadFunctionSource();
  const names = new Set(source.definitions.map(row => row.name));
  await db.exec('begin; set local search_path = pg_catalog; set local check_function_bodies = off');
  try {
    const actual = (await db.query(snapshotSql)).rows;
    // The pinned application checkpoint contains no overloaded function names.
    // Reject overloads rather than collapsing two signatures into one entry.
    assert.equal(new Set(actual.map(row => row.name)).size, actual.length, 'Unexpected overloaded function');
    const missing = source.definitions.filter(row => !actual.some(item => item.name === row.name)).map(row => row.name).sort();
    const unexpected = actual.filter(row => !names.has(row.name) && row.name !== 'private.rls_auto_enable').map(row => row.identity).sort();
    if (missing.length || unexpected.length) return { status: 'MISMATCH', missing, unexpected, changed: [], blockedPatches: [] };
    for (const definition of source.definitions) {
      // CREATE OR REPLACE preserves the export's owner/ACL. We therefore compare
      // definitions only and explicitly make no source owner/ACL assertion here.
      await db.exec(definition.sql.replace(/^create(?: or replace)? function/i, 'create or replace function'));
    }
    const blockedPatches = [];
    for (const correction of source.corrections) {
      await db.exec('savepoint source_patch');
      try { await db.exec(correction.sql); }
      catch (error) {
        await db.exec('rollback to savepoint source_patch');
        blockedPatches.push({ migration: correction.migration, function: correction.name,
          code: error.code, message: error.message });
      }
      await db.exec('release savepoint source_patch');
    }
    const expected = (await db.query(snapshotSql)).rows.filter(row => names.has(row.name));
    assert.equal(expected.length, source.definitions.length, 'Reconstruction changed function signatures');
    const changed = expected.flatMap(row => {
      const original = actual.find(item => item.name === row.name);
      return original.identity !== row.identity || original.hash !== row.hash
        ? [{ identity: row.identity, source: source.definitions.find(item => item.name === row.name).migration,
          patches: source.corrections.filter(item => item.name === row.name).map(item => item.migration),
          sourceDefinitionSha256: row.hash, exportDefinitionSha256: original.hash }] : [];
    });
    return { status: blockedPatches.length ? 'BLOCKED' : changed.length ? 'MISMATCH' : 'MATCH', applicationFunctions: expected.length,
      matchedFunctions: expected.filter(row => !changed.some(item => item.identity === row.identity)
        && !blockedPatches.some(item => item.function === row.name)).length,
      checkpoint: source.checkpoint, cutoff: source.cutoff,
      excluded: actual.filter(row => row.name === 'private.rls_auto_enable').map(row => row.identity),
      missing, unexpected, changed, blockedPatches,
      scope: 'Canonical application function definitions only; not source owner/ACL, runtime, platform function or migration replay parity' };
  } finally { await db.exec('rollback'); }
}
