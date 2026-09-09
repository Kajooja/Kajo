import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { compareExportFunctionSource, loadFunctionSource, reconstructFunctionSource } from './function-source.mjs';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const source = await loadFunctionSource();
const expectedBlocks = [
  ['20260904210000_expand_profile_import_stage_limit.sql', 'private.stage_profile_import_rows_v1'],
  ['20260905003500_fix_resurfacing_null_bootstrap.sql', 'private.resurfacing_policy_decision_v1'],
];
async function fixture() {
  const db = new PGlite();
  try {
    // Definition-only fixture. SQL/PLpgSQL bodies are not executed or validated;
    // no export attachment, table data, platform dependency or network required.
    await db.exec('create schema private; set check_function_bodies=off');
    for (const definition of source.definitions) await db.exec(definition.sql);
    await db.exec(source.corrections[0].sql); // The catalog conflict patch applies unchanged.
    return db;
  } catch (error) { await db.close(); throw error; }
}
const snapshotSql = await readFile(new URL('function-schema-snapshot.sql', import.meta.url), 'utf8');
const snapshot = async db => (await db.exec(snapshotSql)).find(row => row.rows[0]?.snapshot).rows[0].snapshot;

test('function source verifies its checkpoint and rejects edited or missing history', async () => {
  assert.equal(source.definitions.length, 122);
  assert.equal(source.corrections.length, 3);
  assert.match(source.definitions.find(row => row.name === 'private.rank_items_v1_internal').sql,
    /prediction-v0\.4-bootstrap/);
  const names = (await readdir(migrations)).filter(name => /^\d{14}_.+\.sql$/.test(name) && name <= source.cutoff);
  const files = await Promise.all(names.map(async name => ({ name, sql: await readFile(new URL(name, migrations), 'utf8') })));
  assert.throws(() => reconstructFunctionSource(files.slice(1)), /source history changed/);
  assert.throws(() => reconstructFunctionSource(files.map((file, index) => index ? file : { ...file, sql: file.sql + '\n' })), /source history changed/);
});

test('unchanged source patches expose both whitespace defects and roll back all definitions', async () => {
  const db = await fixture();
  try {
    const before = await snapshot(db);
    const report = await compareExportFunctionSource(db);
    assert.equal(report.status, 'BLOCKED');
    assert.equal(report.applicationFunctions, 122);
    assert.equal(report.matchedFunctions, 120, 'Blocked definitions must not count as matches');
    assert.deepEqual(report.changed, []);
    assert.deepEqual(report.blockedPatches.map(row => [row.migration, row.function]), expectedBlocks);
    assert.ok(report.blockedPatches.every(row => row.code === 'P0001'));
    assert.deepEqual(await snapshot(db), before, 'Source patch attempts must leave definitions and ACL unchanged');
  } finally { await db.close(); }
});

test('source comparison detects definition drift and preserves changed input on rollback', async () => {
  const db = await fixture();
  try {
    await db.exec('alter function private.outcome_priority_v1(text) volatile');
    const before = await snapshot(db);
    const report = await compareExportFunctionSource(db);
    assert.equal(report.status, 'BLOCKED');
    assert.equal(report.matchedFunctions, 119);
    assert.equal(report.changed.length, 1);
    assert.match(report.changed[0].identity, /^private\.outcome_priority_v1\(/);
    assert.notEqual(report.changed[0].sourceDefinitionSha256, report.changed[0].exportDefinitionSha256);
    assert.deepEqual(await snapshot(db), before);
  } finally { await db.close(); }
});

test('missing, extra and overloaded functions fail instead of narrowing comparison silently', async () => {
  const db = await fixture();
  try {
    await db.exec('drop function public.get_profile_import_job_v1(uuid); create function public.unexpected() returns int language sql as $$select 1$$');
    const report = await compareExportFunctionSource(db);
    assert.equal(report.status, 'MISMATCH');
    assert.deepEqual(report.missing, ['public.get_profile_import_job_v1']);
    assert.deepEqual(report.unexpected, ['public.unexpected()']);
    await db.exec('create function private.outcome_priority_v1(integer) returns int language sql as $$select 1$$');
    await assert.rejects(compareExportFunctionSource(db), /Unexpected overloaded function/);
    assert.equal((await db.query('select public.unexpected() as value')).rows[0].value, 1);
  } finally { await db.close(); }
});
