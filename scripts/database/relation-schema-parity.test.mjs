import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { compareRelationSchemas } from './relation-schema-parity.mjs';

const sql = await readFile(new URL('relation-schema-snapshot.sql', import.meta.url), 'utf8');
const snapshot = async db => (await db.exec(sql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;
const fixture = `create role reader; create role writer;
  create table public.items(id integer primary key, score integer default 0,
    constraint positive check(score >= 0));
  create index score_idx on public.items(score) where score > 0;
  alter table public.items enable row level security;
  create policy visible on public.items to reader using(score > 0) with check(score > 0);`;

test('relation fingerprints are independent of object OIDs and ACL insertion order', async () => {
  const a = new PGlite(); const b = new PGlite();
  try {
    await a.exec(fixture);
    await b.exec('create schema padding; create table padding.offset_ids(id integer);');
    await b.exec(fixture);
    await a.exec('grant select on public.items to reader; grant update on public.items to writer;');
    await b.exec('grant update on public.items to writer; grant select on public.items to reader;');
    assert.equal(compareRelationSchemas(await snapshot(a), await snapshot(b)).status, 'MATCH');
  } finally { await a.close(); await b.close(); }
});

test('definition drift is detected even when table/index/policy counts stay equal', async () => {
  const db = new PGlite();
  try {
    await db.exec(fixture);
    const baseline = await snapshot(db);
    const mutations = [
      'alter table public.items alter column score set default 1',
      'alter table public.items alter column score set not null',
      'alter table public.items alter column id type bigint',
      'alter table public.items rename column score to rating',
      'alter table public.items disable row level security',
      'alter table public.items force row level security',
      'alter policy visible on public.items using(score > 1)',
      'alter policy visible on public.items with check(score > 1)',
      'alter policy visible on public.items to writer',
      'grant select on public.items to reader',
      'grant select(score) on public.items to reader',
      'alter table public.items owner to writer',
      'alter table public.items drop constraint positive; alter table public.items add constraint positive check(score > 0)',
      'alter table public.items drop constraint positive; alter table public.items add constraint positive check(score >= 0) not valid',
      'drop index public.score_idx; create index score_idx on public.items(score) where score > 1',
    ];
    // Snapshot SQL owns a read-only transaction; restore each mutation explicitly.
    for (const mutation of mutations) {
      const changedDb = new PGlite();
      try {
        await changedDb.exec(fixture);
        await changedDb.exec(mutation);
        const report = compareRelationSchemas(baseline, await snapshot(changedDb));
        assert.equal(report.status, 'MISMATCH', mutation);
        assert.deepEqual(report.changed, ['public.items'], mutation);
        assert.equal(report.expectedCount, report.actualCount);
      } finally { await changedDb.close(); }
    }
  } finally { await db.close(); }
});

test('relation comparison fails closed on malformed inputs and reports added/missing tables', () => {
  const row = { identity: 'public.items', definitionSha256: 'a'.repeat(64) };
  const base = { format: 'kajo-relation-schema-v1', serverMajor: 17, relations: [row] };
  for (const bad of [null, {}, { ...base, relations: [] }, { ...base, relations: [row, row] },
    { ...base, relations: [{ ...row, definitionSha256: 'bad' }] }, { ...base, serverMajor: 18 }]) {
    assert.throws(() => compareRelationSchemas(base, bad));
  }
  const report = compareRelationSchemas(base, { ...base, relations: [{ ...row, identity: 'private.other' }] });
  assert.deepEqual(report.missing, ['public.items']);
  assert.deepEqual(report.unexpected, ['private.other']);
});
