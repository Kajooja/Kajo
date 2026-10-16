import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';

const code = await readFile(new URL('../../packages/prediction-engine/src/contextual-skip.ts', import.meta.url), 'utf8');
const { decideContextualSkip } = await import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(code,
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64'));
const accepted = 1792152000000001n, cooldown = 86400000000n;
const record = { id: 'taste', subjectId: 'personal', objectId: 'item', acceptedAt: String(accepted), withdrawnAt: null };
const input = (patch = {}) => ({ subjectId: 'personal', objectId: 'item', asOf: String(accepted),
  records: [record], otherwiseEligible: true, ...patch });

test('independent disposable SQL agrees with the contextual-skip policy reference', async t => {
  const db = new PGlite();
  const run = async value => (await db.query('select pg_temp.contextual_skip_reference_v1($1::jsonb) value', [value])).rows[0].value;
  try {
    // Force the disposable temporary namespace; nothing enters application migrations.
    await db.exec('create temp table contextual_skip_oracle_scope(id integer);');
    await db.exec(await readFile(new URL('./contextual-skip-reference.sql', import.meta.url), 'utf8'));
    await t.test('exact cooldown, zero epoch, future prefix, terminal policy and withdrawal boundaries', async () => {
      const samples = [input({ records: [] }), input({ records: [], otherwiseEligible: false }),
        input({ records: [{ ...record, acceptedAt: '0' }], asOf: '0' })];
      for (const delta of [-1n, 0n, 1n, cooldown - 1n, cooldown, cooldown + 1n]) {
        for (const otherwiseEligible of [true, false]) {
          const asOf = String(accepted + delta);
          samples.push(input({ asOf, otherwiseEligible }), input({ asOf, otherwiseEligible,
            records: [{ ...record, withdrawnAt: String(accepted + 1n) }] }));
        }
      }
      for (const sample of samples) assert.deepEqual(await run(sample), decideContextualSkip(sample));
      assert.equal((await run(input({ asOf: String(accepted + cooldown - 1n) }))).eligible, false);
      assert.equal((await run(input({ asOf: String(accepted + cooldown) }))).eligible, true);
    });
    await t.test('Taste/Discovery same-Profile union, tied sources, actor/session independence and isolated scopes', async () => {
      const records = [record, { ...record, id: 'discovery', acceptedAt: String(accepted + 50n) },
        { ...record, id: 'shared', subjectId: 'shared', acceptedAt: String(accepted + 100n) },
        { ...record, id: 'other-item', objectId: 'other', acceptedAt: String(accepted + 200n) }];
      const samples = [input({ records, asOf: String(accepted + 500n) }), input({ records, subjectId: 'shared' }),
        input({ records: [record, { ...record, id: 'a-discovery' }] }),
        input({ records: [record, { ...record, id: 'withdrawn', acceptedAt: String(accepted + 100n), withdrawnAt: String(accepted + 200n) }],
          asOf: String(accepted + 200n) })];
      for (const sample of samples) assert.deepEqual(await run(sample), decideContextualSkip(sample));
      assert.deepEqual((await run(samples[0])).sourceIds, ['discovery']);
    });
    await t.test('deterministic mixed prefixes test latest-surviving receipt, not insertion order', async () => {
      for (let seed = 0; seed < 60; seed++) {
        const records = Array.from({ length: 12 }, (_, n) => ({ id: `source-${n}`, subjectId: n % 5 === 0 ? 'other' : 'personal',
          objectId: n % 7 === 0 ? 'other' : 'item', acceptedAt: String(accepted + BigInt((seed * 17 + n * 37) % 800)),
          withdrawnAt: (seed + n) % 3 === 0 ? String(accepted + 900n) : null }));
        const sample = input({ records: seed % 2 ? records.reverse() : records, asOf: String(accepted + BigInt(seed * 25)),
          otherwiseEligible: seed % 4 !== 0 });
        assert.deepEqual(await run(sample), decideContextualSkip(sample), `seed ${seed}`);
      }
    });
    await t.test('both implementations reject malformed clocks, duplicated sources and prefix overflow', async () => {
      const bad = [null, input({ asOf: null }), input({ asOf: '01' }), input({ asOf: '1e10' }),
        input({ asOf: '253402300800000000' }), input({ otherwiseEligible: null }), input({ subjectId: '' }),
        input({ records: [record, record] }), input({ records: [{ ...record, withdrawnAt: '0' }] }),
        input({ records: [{ ...record, withdrawnAt: undefined }] }),
        input({ records: Array.from({ length: 257 }, (_, n) => ({ ...record, id: String(n) })) })];
      for (const sample of bad) {
        assert.throws(() => decideContextualSkip(sample)); await assert.rejects(run(sample));
      }
    });
  } finally { await db.close(); }
});

test('current native consumers stay neutral and old rating/not-interest meanings remain unchanged', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    const rows = (await db.query(`select event_type,private.event_evidence_weight_v1(event_type,'{}') weight,
      private.outcome_priority_v1(event_type) priority,private.outcome_reward_v1(event_type,'{}') reward
      from unnest(array['ITEM_CONTEXTUALLY_SKIPPED','ITEM_CONTEXTUAL_SKIP_WITHDRAWN']) event_type order by event_type`)).rows;
    assert.equal(rows.length, 2);
    for (const row of rows) assert.deepEqual({ weight: row.weight, priority: row.priority, reward: row.reward }, { weight: 0, priority: 0, reward: 0 });
    assert.deepEqual((await db.query(`select private.event_evidence_weight_v1('ITEM_RATED',jsonb_build_object('rating',n)) weight,
      private.outcome_reward_v1('ITEM_RATED',jsonb_build_object('rating',n)) reward,
      private.bootstrap_evidence_weight_v1('RATED',n) bootstrap from unnest(array[0,5,10]) n`)).rows,
    [{ weight: -6, reward: -1, bootstrap: -3.75 }, { weight: 0, reward: 0, bootstrap: 0 }, { weight: 6, reward: 1, bootstrap: 3.75 }]);
    assert.equal((await db.query("select private.event_evidence_weight_v1('ITEM_NOT_INTERESTED','{}') weight")).rows[0].weight, -5.5);
    // This packet intentionally does not admit a new native Event or executable API.
    const constraint = (await db.query(`select pg_get_constraintdef(oid) definition from pg_constraint
      where conrelid='public.events'::regclass and conname='events_event_type_valid'`)).rows[0].definition;
    assert.equal(constraint.includes('ITEM_CONTEXTUALLY_SKIPPED'), false);
    assert.equal(constraint.includes('ITEM_CONTEXTUAL_SKIP_WITHDRAWN'), false);
  } finally { await db.close(); }
});
