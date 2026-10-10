import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalWorkingResetCanonicalEvidenceSql, personalWorkingResetNativeCleanupSql,
  personalWorkingResetNativeFixtureSql, personalWorkingResetNativeProbeSql,
  personalWorkingResetNativeReservedSql, personalWorkingResetNativeSourcesSql,
  verifyPersonalWorkingResetConcurrency } from './personal-working-reset-concurrency.mjs';

test('native reset fixture executes real sources and controls, preserves full state and cleans only owned roots (full schema)', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    for (const file of files) await db.exec(`begin;${file.sql}commit;`);
    const values = async sql => (await db.exec(sql)).flatMap(result => result.rows).map(row => Object.values(row)[0]);
    const evidence = async () => (await values(personalWorkingResetCanonicalEvidenceSql()))[0];
    const outsider = 'a9147300-0000-4000-8000-000000000001';
    const partner = 'a9147300-0000-4000-8000-000000000002';
    const shared = 'a9147300-0000-4000-8000-000000000010';
    const personalList = 'a9147300-0000-4000-8000-000000000020';
    const sharedList = 'a9147300-0000-4000-8000-000000000021';
    const session = 'a9147300-0000-4000-8000-000000000030';
    const reset = 'a9147300-0000-4000-8000-000000000031';
    await db.exec(`begin;
      insert into auth.users(id,email,raw_user_meta_data) values
        ('${outsider}','unrelated-reset-owner@example.invalid','{"kajo_nickname":"Unrelated reset owner"}'),
        ('${partner}','unrelated-reset-partner@example.invalid','{"kajo_nickname":"Unrelated reset partner"}');
      insert into public.profiles(id,profile_type,name) values('${shared}','SHARED','Unrelated reset Shared');
      insert into public.profile_members(profile_id,user_id) values('${shared}','${outsider}'),('${shared}','${partner}');
      insert into public.item_lists(id,profile_id,list_kind,name,created_by_user_id)
        select '${personalList}',id,'CUSTOM','Unrelated reset Personal list','${outsider}'
        from public.profiles where owner_user_id='${outsider}' and profile_type='PERSONAL';
      insert into public.item_lists(id,profile_id,list_kind,name,created_by_user_id)
        values('${sharedList}','${shared}','CUSTOM','Unrelated reset Shared list','${outsider}');
      insert into public.event_sessions(id,actor_user_id,profile_id,started_at)
        select '${session}','${outsider}',id,date_trunc('milliseconds',clock_timestamp())-interval '1 minute'
        from public.profiles where owner_user_id='${outsider}' and profile_type='PERSONAL';
      set local request.jwt.claim.sub='${outsider}';
      select private.commit_personal_working_reset_v1('${reset}','${outsider}',
        (select id from public.profiles where owner_user_id='${outsider}' and profile_type='PERSONAL'),'${session}');
      commit;`);
    const original = await evidence();
    assert.equal(original['private.personal_working_resets'].count, 1);
    assert.equal(original['public.item_lists'].count, 5);
    const emptyNamespace = { users: 0, items: 0, sessions: 0, resets: 0, requests: 0, backends: 0 };
    assert.deepEqual((await values(personalWorkingResetNativeReservedSql()))[0], emptyNamespace,
      'Actual native namespace SQL must execute on the complete installed schema');
    await db.exec(personalWorkingResetNativeFixtureSql());
    const pages = await values(personalWorkingResetNativeSourcesSql());
    assert.equal(pages.length, 3);
    for (const page of pages) assert.match(page.predictionId, /^[0-9a-f-]{36}$/);
    assert.deepEqual((await values(personalWorkingResetNativeReservedSql()))[0],
      { users: 4, items: 2, sessions: 5, resets: 0, requests: 3, backends: 0 });
    const initialized = await evidence();
    assert.equal(initialized['public.item_lists'].count, original['public.item_lists'].count + 2,
      'Both actual fixture Auth roots produce Personal system Lists');
    const authenticated = sql => `begin;set local request.jwt.claim.sub='a9147200-0000-4000-8000-000000000001';${sql}commit;`;
    const [first] = await values(authenticated(`select ${personalWorkingResetNativeProbeSql.same};`));
    const [retried] = await values(authenticated(`select ${personalWorkingResetNativeProbeSql.same};`));
    assert.deepEqual(retried, first, 'Exact native fixture retry changed the frozen receipt');
    assert.equal(first.version, 'personal-working-reset-v1');
    assert.equal(first.affects, 'WORKING_STATE_ONLY');
    assert.equal(first.resetAt, first.createdAt);
    await values(authenticated(`select ${personalWorkingResetNativeProbeSql.distinctFirst};
      select ${personalWorkingResetNativeProbeSql.distinctSecond};`));
    await db.exec(personalWorkingResetNativeProbeSql.quotaFill);
    const [last] = await values(authenticated(`select ${personalWorkingResetNativeProbeSql.quotaFirst};`));
    try {
      await assert.rejects(db.exec(authenticated(`select ${personalWorkingResetNativeProbeSql.quotaSecond};`)), { code: '54000' });
    } finally { await db.exec('rollback;'); }
    const [quotaRetry] = await values(authenticated(`select ${personalWorkingResetNativeProbeSql.quotaFirst};`));
    assert.deepEqual(quotaRetry, last, 'Full native quota rejected or changed an exact retry');
    const afterControls = await evidence();
    assert.equal(afterControls['private.personal_working_resets'].count, 132);
    const exceptControls = snapshot => Object.fromEntries(Object.entries(snapshot)
      .filter(([relation]) => relation !== 'private.personal_working_resets'));
    assert.deepEqual(exceptControls(afterControls), exceptControls(initialized),
      'Controller fixture changed evidence, canonical lists or frozen prediction bytes');
    await values(authenticated(`select ${personalWorkingResetNativeProbeSql.lifecycleFirst};`));
    const [beforeErase] = await values(`select to_jsonb(r) from private.personal_working_resets r
      where id='a9147200-0000-4000-8000-000000000105';`);
    await db.query(`select private.erase_prediction_sources_v1('PREDICTION_RUN',$1::uuid);`, [pages[0].predictionId]);
    const [afterErase] = await values(`select to_jsonb(r) from private.personal_working_resets r
      where id='a9147200-0000-4000-8000-000000000105';`);
    assert.deepEqual(afterErase, beforeErase, 'Source erasure removed or changed the raw reset control');
    const [remaining] = await values(personalWorkingResetNativeCleanupSql());
    assert.deepEqual(remaining, { users: 0, profiles: 0, items: 0, sessions: 0, resets: 0, sources: 0 });
    assert.deepEqual((await values(personalWorkingResetNativeReservedSql()))[0], emptyNamespace);
    assert.deepEqual(await evidence(), original, 'Owned cleanup failed the complete unrelated row snapshot');
    await db.exec('begin;');
    try {
      await db.query(`update public.item_lists set created_at=created_at-interval '1 second' where id=$1::uuid;`, [sharedList]);
      const changed = await evidence();
      assert.equal(changed['public.item_lists'].count, original['public.item_lists'].count);
      assert.throws(() => assert.deepEqual(changed, original), assert.AssertionError,
        'Constant-count unrelated row mutation escaped canonical preservation');
    } finally { await db.exec('rollback;'); }
    assert.deepEqual(await evidence(), original);
    t.diagnostic('Exact exported native fixture/source/quota/controller/erasure/cleanup SQL executes on full schema. Native independent-session concurrency remains a separate CI gate.');
  } finally { await db.close(); }
});

test('native reset concurrency refuses denied ACL or occupied fixture namespace without cleanup ownership', async () => {
  for (const guard of ['acl', 'namespace']) {
    const stages = [];
    await assert.rejects(verifyPersonalWorkingResetConcurrency(async (_sql, { stage }) => {
      stages.push(stage);
      if (stage === 'working-reset-owner-only-acl') return [{ functions: 1, ownerOnlyInvoker: guard !== 'acl' }];
      if (stage === 'working-reset-reserved-fixture-guard') return [{ users: 1, items: 0, sessions: 0, resets: 0, requests: 0, backends: 0 }];
      throw new Error(`Unexpected stage before fixture ownership: ${stage}`);
    }), assert.AssertionError);
    assert.equal(stages.some(stage => /fixture$|cleanup|original-canonical/.test(stage)), false,
      'Denied preflight must neither allocate nor clean roots');
  }
});

test('native reset concurrency retains the original allocation failure and owned cleanup failure', async () => {
  const allocationFailure = new Error('owned fixture allocation failed');
  const cleanupFailure = new Error('owned fixture cleanup failed');
  await assert.rejects(verifyPersonalWorkingResetConcurrency(async (_sql, { stage }) => {
    if (stage === 'working-reset-owner-only-acl') return [{ functions: 1, ownerOnlyInvoker: true }];
    if (stage === 'working-reset-reserved-fixture-guard') return [{ users: 0, items: 0, sessions: 0, resets: 0, requests: 0, backends: 0 }];
    if (stage === 'working-reset-original-canonical-state') return [{}];
    if (stage === 'working-reset-owned-fixture') throw allocationFailure;
    if (stage === 'working-reset-cleanup-only-owned-fixture') throw cleanupFailure;
    throw new Error(`Unexpected native stage: ${stage}`);
  }), error => error instanceof AggregateError && error.errors[0] === allocationFailure
    && error.errors[1] === cleanupFailure && error.errors.length === 2);
});
