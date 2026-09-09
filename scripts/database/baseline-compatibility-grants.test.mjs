import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createSourceRelationDatabase } from './relation-source.mjs';
import { compareFunctionSchemas } from './function-schema-parity.mjs';
import { compareRelationSchemas } from './relation-schema-parity.mjs';

const compatibility = await readFile(new URL('baseline-compatibility-grants.sql', import.meta.url), 'utf8');
const defaults = await readFile(new URL('../../supabase/migrations/20260909131913_close_postgres_function_defaults.sql', import.meta.url), 'utf8');
const functionSql = await readFile(new URL('function-schema-snapshot.sql', import.meta.url), 'utf8');
const relationSql = await readFile(new URL('relation-schema-snapshot.sql', import.meta.url), 'utf8');
const snapshot = async (db, sql) => (await db.exec(sql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;
const tableAclSql = `select n.nspname || '.' || c.relname as identity,
  case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
  pg_get_userbyid(a.grantor) as grantor, a.privilege_type, a.is_grantable
  from pg_class c join pg_namespace n on n.oid=c.relnamespace,
  lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  where n.nspname in('public','private') and c.relkind in('r','p')
  order by 1,2,3,4,5`;

test('compatibility grants preserve every non-service permission and remain bounded to existing objects', async () => {
  const { db } = await createSourceRelationDatabase();
  try {
    await db.exec(defaults);
    const originalFunctions = await snapshot(db, functionSql);
    const originalRelations = await snapshot(db, relationSql);
    const originalTables = (await db.query(tableAclSql)).rows;
    await db.exec(compatibility);
    const functions = await snapshot(db, functionSql);
    const relations = await snapshot(db, relationSql);
    const tables = (await db.query(tableAclSql)).rows;
    const functionDiff = compareFunctionSchemas(originalFunctions, functions);
    assert.equal(functionDiff.changed.length, 18);
    assert.ok(functionDiff.changed.every(row => row.fields.length === 1 && row.fields[0] === 'acl'));
    assert.equal(compareRelationSchemas(originalRelations, relations).changed.length, 12);
    assert.equal(compareRelationSchemas(originalRelations, relations, { fingerprint: 'structureSha256' }).status, 'MATCH');
    const nonService = rows => rows.filter(row => row.grantee !== 'service_role');
    assert.deepEqual(nonService(tables), nonService(originalTables));
    for (const before of originalFunctions.functions) {
      const after = functions.functions.find(row => row.identity === before.identity);
      assert.deepEqual(nonService(after.acl), nonService(before.acl));
      for (const grant of before.acl) assert.ok(after.acl.some(row => JSON.stringify(row) === JSON.stringify(grant)));
    }
    assert.ok(tables.every(row => !row.is_grantable));
    assert.deepEqual((await db.query(`select has_table_privilege('service_role','public.profile_messages','select') as table_access,
      has_function_privilege('service_role','public.get_my_personal_profile()','execute') as function_access`)).rows[0],
    { table_access: false, function_access: false });
    await db.exec(compatibility);
    assert.equal(compareFunctionSchemas(functions, await snapshot(db, functionSql)).status, 'MATCH');
    assert.equal(compareRelationSchemas(relations, await snapshot(db, relationSql)).status, 'MATCH');
    // A new object gets no compatibility grant merely because it is in public.
    await db.exec(`create table public.future_table_probe(id integer);
      create function public.future_function_probe() returns integer language sql as $$select 1$$;`);
    assert.equal((await db.query(`select has_table_privilege('service_role','public.future_table_probe','select') as allowed`)).rows[0].allowed, false);
    assert.equal((await db.query(`select has_function_privilege('service_role','public.future_function_probe()','execute') as allowed`)).rows[0].allowed, false);
  } finally { await db.close(); }
});
