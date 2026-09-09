import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const sql = await readFile(new URL('platform-schema-snapshot.sql', import.meta.url), 'utf8');
const snapshot = async db => (await db.exec(sql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;
const fixture = `create role anon; create role authenticated; create role service_role;
  create schema private;
  create table public.items(secret text);
  insert into public.items values('PERSONAL_PRIVATE_EVIDENCE');
  grant usage on schema private to authenticated;
  alter default privileges for role postgres in schema public grant execute on functions to authenticated;
  create function private.platform_hook() returns event_trigger language plpgsql as $$
    begin perform 'FUNCTION_BODY_MARKER'; end; $$;
  create event trigger platform_hook on ddl_command_end when tag in ('CREATE TABLE')
    execute function private.platform_hook();`;

test('platform metadata resolves OIDs, omits data/bodies and detects default/event-trigger drift and rollback', async () => {
  const a = new PGlite(); const b = new PGlite();
  try {
    await a.exec(fixture);
    await b.exec('create role padding_role; create schema padding; create table padding.offset_ids(id integer);');
    await b.exec(fixture);
    const baseline = await snapshot(a);
    assert.deepEqual(await snapshot(b), baseline);
    assert.equal(JSON.stringify(baseline).includes('PERSONAL_PRIVATE_EVIDENCE'), false);
    assert.equal(JSON.stringify(baseline).includes('FUNCTION_BODY_MARKER'), false);
    assert.equal(baseline.eventTriggers[0].extension, null, 'Schema private is not extension ownership');
    await b.exec('alter event trigger platform_hook disable;');
    assert.notDeepEqual((await snapshot(b)).eventTriggers, baseline.eventTriggers);
    await b.exec('alter event trigger platform_hook enable;');
    await b.exec('begin; alter default privileges for role postgres revoke execute on functions from public; rollback;');
    assert.deepEqual(await snapshot(b), baseline);
    await b.exec('alter default privileges for role postgres revoke execute on functions from public;');
    assert.notDeepEqual((await snapshot(b)).creatorDefaults, baseline.creatorDefaults);
  } finally { await a.close(); await b.close(); }
});
