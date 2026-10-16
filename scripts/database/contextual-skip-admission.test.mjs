import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const owner = 'ab157000-0000-4000-8000-000000000001';
const other = 'ab157000-0000-4000-8000-000000000002';
const itemIds = page => page.items.map(item => item.item_id);
const version = 'kajo-contextual-skip-v1';

// Full application schema and actual public writers, each in a separate commit.
// PGlite proves serving integration here, not native concurrent-session locking.
test('confirmed neutral skips reach native admission, frozen pages and catalogue exhaustion', async t => {
  const db = new PGlite();
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const one = async (sql, args = []) => (await query(sql, args))[0];
  const authenticated = async (sql, args = [], actor = owner) => {
    await db.exec('begin');
    try {
      await query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
      await db.exec('set local role authenticated');
      const result = await query(sql, args);
      await db.exec('commit');
      return result;
    } catch (error) { await db.exec('rollback'); throw error; }
  };
  const rpc = async (name, command, actor = owner) =>
    (await authenticated(`select public.${name}($1) value`, [command], actor))[0].value;
  const request = (profileId, extra = {}) => ({ version: 3, requestId: randomUUID(), profileId,
    sessionId: randomUUID(), discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 17, context: {}, cursor: null, ...extra });
  const page = (r, actor = owner) => rpc('rank_items_page_v1', r, actor);
  const commit = c => rpc(c.origin.surface === 'TASTE' ? 'commit_taste_contextual_skip_v1' : 'commit_discovery_contextual_skip_v1', c, c.actorUserId);
  const withdrawal = c => ({ ...c, kind: 'WITHDRAW_CONTEXTUAL_SKIP', actionId: randomUUID(),
    reversesActionId: c.actionId, occurredAt: String(BigInt(Date.now()) * 1000n) });
  const expose = async (profileId, targetItem = null, actor = owner, itemType = 'BOOK') => {
    let r = request(profileId, { limit: 50, itemType }), delivered = await page(r, actor), pages = 1;
    while (targetItem && !itemIds(delivered).includes(targetItem) && delivered.nextCursor) {
      assert.ok(pages++ < 3, 'Exposure search must stay within this actual catalogue chain');
      r = { ...r, requestId: randomUUID(), cursor: delivered.nextCursor }; delivered = await page(r, actor);
    }
    const itemId = targetItem ?? itemIds(delivered)[0];
    assert.ok(itemIds(delivered).includes(itemId), 'Exposure must come from this actual delivered page');
    const impressionEventId = randomUUID();
    await query(`insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
      values($1,$2,$3,clock_timestamp()-interval '1 minute','{}')`, [r.sessionId, actor, profileId]);
    await query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,
      occurred_at,session_id,prediction_id,discovery_mode)
      values($1,$2,$3,$4,$5,'ITEM_IMPRESSION',clock_timestamp(),$6,$7,'FOR_YOU')`,
    [impressionEventId, actor, profileId, itemId, itemType, r.sessionId, delivered.predictionId]);
    return { request: r, page: delivered, command: { version, kind: 'CONTEXTUAL_SKIP', actionId: randomUUID(),
      actorUserId: actor, profileId, itemId, occurredAt: String(BigInt(Date.now()) * 1000n), contextRef: null,
      reversesActionId: null, origin: { surface: 'DISCOVERY', sessionId: r.sessionId,
        predictionId: delivered.predictionId, deliveryRequestId: delivered.requestId, impressionEventId } } };
  };
  const sourceSnapshot = async predictionId => (await one('select private.prediction_window_source_v1($1) value', [predictionId])).value;
  const bookCatalogue = async () => (await query("select id from public.items where discoverable and item_type='BOOK' order by id")).map(row => row.id);
  const assertAbsentFromCandidates = async (predictionId, itemId) => {
    assert.equal((await one('select count(*)::int n from private.prediction_candidates where prediction_id=$1 and item_id=$2',
      [predictionId, itemId])).n, 0, 'Suppression must run before the bounded candidate source admits the Item');
  };
  const assertSuppressedTrace = async (predictionId, itemId) => {
    const retained = await one('select selected_for_delivery,explanation from private.prediction_candidates where prediction_id=$1 and item_id=$2',
      [predictionId, itemId]);
    // Existing eligibility-first sources may retain a suppressed diagnostic tail
    // after all available ordinary Items; it must not displace eligible slots.
    if (retained) {
      assert.equal(retained.selected_for_delivery, false);
      assert.equal(retained.explanation.resurfacingPolicy.eligible, false);
      assert.equal(retained.explanation.resurfacingPolicy.contextualSkip.reason, 'SKIP_COOLDOWN');
    }
  };
  const fixture = async () => {
    await db.exec(await personalTasteSessionFixtureSql());
    // Eighty eligible books exceed the native fifty-candidate source. No fake
    // receipt or skip row is injected; all skips below use real command RPCs.
    await db.exec(`insert into public.items(id,item_type,title,tags,metadata)
      select ('ab157000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'BOOK','Admission fixture '||n,
        array['shared-feature'],jsonb_build_object('coldStartRecognition',0.1,'coldStartPriorSource','KAJO_CURATED_RECOGNITION')
      from generate_series(140,199) n;
      insert into private.item_sources(item_id,provider_key,provider_item_id)
      select id,'kajo_curated',id::text from public.items where title like 'Admission fixture %';`);
    return (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [owner])).id;
  };
  const cleanup = async () => db.exec(`rollback;
    delete from public.profiles where name='Contextual skip admission Shared';
    delete from auth.users where id::text like 'ab157000-%';
    delete from private.item_sources where item_id::text like 'ab157000-%';
    delete from public.items where id::text like 'ab157000-%';`);
  const scenario = (name, fn) => t.test(name, async () => {
    const profile = await fixture();
    try { await fn(profile); } finally { await cleanup(); }
  });

  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);

    await scenario('base and first-page admission refill before the top-fifty bound while exact old delivery stays immutable', async profile => {
      const exposed = await expose(profile), c = exposed.command;
      assert.equal(exposed.page.items.length, 50);
      const original = await sourceSnapshot(exposed.page.predictionId);
      const receipt = await commit(c);
      for (const mode of ['FOR_YOU', 'SURPRISE', 'RISK']) {
        const ranked = await authenticated('select * from public.rank_items_v1($1,$2,$3,$4,$5)', [profile, mode, 'BOOK', 50, {}]);
        assert.equal(ranked.length, 50, 'A skip must not consume a top-fifty admission slot');
        assert.ok(ranked.every(row => row.item_id !== c.itemId));
        await assertAbsentFromCandidates(ranked[0].prediction_id, c.itemId);
      }
      const newPage = await page(request(profile, { limit: 50 }));
      assert.equal(newPage.items.length, 50); await assertAbsentFromCandidates(newPage.predictionId, c.itemId);
      assert.deepEqual(await page(exposed.request), exposed.page);
      assert.deepEqual(await sourceSnapshot(exposed.page.predictionId), original);
      assert.deepEqual(await commit(c), receipt);
      assert.equal((await one('select count(*)::int n from public.item_interactions where profile_id=$1', [profile])).n, 0);
      assert.equal((await one('select count(*)::int n from private.profile_bootstrap_evidence where profile_id=$1', [profile])).n, 0);
    });

    await scenario('frozen v2 pages recheck a later skip without rewriting the original scores or delivered reply', async profile => {
      const rootRequest = request(profile, { version: 2, limit: 7 }), root = await page(rootRequest);
      assert.ok(root.nextCursor);
      const frozen = await sourceSnapshot(root.predictionId);
      assert.equal(frozen.candidates.length, 21, 'V2 retains its existing three-times-page-size source');
      const target = frozen.candidates.find(candidate => !candidate.selected_for_delivery).item_id;
      const { command } = await expose(profile, target); await commit(command);
      let previous = root, currentRequest = rootRequest; const seen = new Set(itemIds(root)); let pages = 1;
      while (previous.nextCursor) {
        assert.ok(pages++ < 10, 'Frozen source must terminate within its actual bounded pool');
        currentRequest = { ...currentRequest, requestId: randomUUID(), cursor: previous.nextCursor };
        const current = await page(currentRequest);
        assert.ok(!itemIds(current).includes(target));
        for (const item of itemIds(current)) { assert.ok(!seen.has(item)); seen.add(item); }
        assert.deepEqual(await page(currentRequest), current);
        const suppressed = await one('select selected_for_delivery,explanation from private.prediction_candidates where prediction_id=$1 and item_id=$2',
          [current.predictionId, target]);
        assert.equal(suppressed.selected_for_delivery, false);
        assert.equal(suppressed.explanation.resurfacingPolicy.eligible, false);
        previous = current;
      }
      assert.equal(seen.size, 20);
      assert.deepEqual([...seen].sort(), frozen.candidates.map(candidate => candidate.item_id).filter(id => id !== target).sort());
      assert.deepEqual(await sourceSnapshot(root.predictionId), frozen);
      assert.deepEqual(await page(rootRequest), root);
    });

    await scenario('catalogue v3 continues past fifty, refills around a new skip and proves genuine exhaustion', async profile => {
      const catalogue = await bookCatalogue(); assert.equal(catalogue.length, 80);
      const rootRequest = request(profile), root = await page(rootRequest), frozen = await sourceSnapshot(root.predictionId);
      const target = frozen.candidates.find(candidate => !candidate.selected_for_delivery).item_id;
      const { command } = await expose(profile, target); await commit(command);
      const seen = new Set(itemIds(root)); let current = root, currentRequest = rootRequest, count = 1;
      while (current.nextCursor) {
        assert.ok(count++ < 8, 'Catalogue continuation must exhaust this fixture');
        const previous = current;
        currentRequest = { ...currentRequest, requestId: randomUUID(), cursor: previous.nextCursor };
        current = await page(currentRequest);
        assert.equal(current.source.parentPredictionId, previous.predictionId);
        assert.equal(current.source.rootPredictionId, root.predictionId);
        assert.ok(current.source.candidateCount <= 50);
        assert.equal(current.source.seenCount, seen.size + current.items.length);
        assert.ok(current.items.length > 0, 'Skip must not create a premature empty catalogue page');
        if (catalogue.length - seen.size - 1 >= 50) await assertAbsentFromCandidates(current.predictionId, target);
        else await assertSuppressedTrace(current.predictionId, target);
        for (const item of itemIds(current)) { assert.ok(!seen.has(item)); assert.notEqual(item, target); seen.add(item); }
        assert.deepEqual(await page(currentRequest), current);
        if (current.nextCursor) assert.equal(current.items.length, 17, 'Available successors should refill the requested page');
      }
      assert.equal(current.source.continuationState, 'CATALOG_EXHAUSTED');
      assert.equal(count, 5); assert.equal(seen.size, 79);
      assert.deepEqual([...seen].sort(), catalogue.filter(id => id !== target).sort());
      assert.deepEqual(await sourceSnapshot(root.predictionId), frozen);
      assert.deepEqual(await page(rootRequest), root);
      assert.deepEqual((await one('select seen_item_ids from private.prediction_catalog_chains where id=$1', [root.source.chainId])).seen_item_ids,
        [...seen]);
    });

    await scenario('Taste PAUSE carries the confirmed cross-surface union into same-Personal Discovery through restart', async profile => {
      let taste = await rpc('taste_session_v2', { operation: 'START', profileId: profile, requestId: randomUUID() });
      const tasteCommand = (operation, extra = {}) => ({ operation, profileId: profile, sessionId: taste.sessionId,
        requestId: randomUUID(), expectedRevision: taste.revision, ...extra });
      taste = await rpc('taste_session_v2', tasteCommand('NEXT'));
      const question = taste, c = { version, kind: 'CONTEXTUAL_SKIP', actionId: randomUUID(), actorUserId: owner,
        profileId: profile, itemId: question.currentItem.id, occurredAt: String(BigInt(Date.now()) * 1000n),
        origin: question.contextualSkip.origin, contextRef: null, reversesActionId: null };
      const receipt = await commit(c);
      taste = await rpc('taste_session_v2', { operation: 'RESUME', profileId: profile, sessionId: taste.sessionId });
      assert.equal(taste.status, 'NEEDS_NEXT');
      taste = await rpc('taste_session_v2', tasteCommand('PAUSE')); assert.equal(taste.status, 'PAUSED');
      for (let restart = 0; restart < 2; restart++) {
        const r = request(profile, { itemType: question.currentItem.itemType, limit: 50 });
        await query(`insert into public.event_sessions(id,actor_user_id,profile_id,started_at)
          values($1,$2,$3,clock_timestamp())`, [r.sessionId, owner, profile]);
        const discovery = await page(r);
        assert.ok(!itemIds(discovery).includes(c.itemId)); await assertSuppressedTrace(discovery.predictionId, c.itemId);
        assert.notEqual(r.sessionId, question.sessionId);
        assert.equal((await rpc('taste_session_v2', { operation: 'RESUME', profileId: profile, sessionId: taste.sessionId })).status, 'PAUSED');
        assert.deepEqual(await commit(c), receipt);
      }
      assert.equal((await one('select count(*)::int n from public.events where profile_id=$1', [profile])).n, 0,
        'Private Taste skip cannot manufacture a Discovery impression or canonical Event');
      const discoverySkip = await expose(profile, null, owner, question.currentItem.itemType);
      assert.notEqual(discoverySkip.command.itemId, c.itemId);
      await commit(discoverySkip.command);
      const union = await page(request(profile, { itemType: question.currentItem.itemType, limit: 50 }));
      assert.ok(!itemIds(union).includes(c.itemId)); assert.ok(!itemIds(union).includes(discoverySkip.command.itemId));
      const domainSize = (await one('select count(*)::int n from public.items where discoverable and item_type=$1', [question.currentItem.itemType])).n;
      assert.equal(union.items.length, Math.min(50, domainSize - 2));
      assert.equal((await one('select count(*)::int n from private.contextual_skip_commands where profile_id=$1 and erased_at is null', [profile])).n, 2);
      assert.equal((await one('select count(*)::int n from public.events where profile_id=$1', [profile])).n, 2,
        'Only the real Discovery impression and command Event are public evidence');
      assert.equal((await one('select count(*)::int n from private.profile_bootstrap_evidence where profile_id=$1', [profile])).n, 0);
    });

    await scenario('Shared suppression crosses accepted actors but Personal scopes and independent withdrawal remain isolated', async profile => {
      const deliveredCatalogue = async (targetProfile, actor = owner) => {
        let r = request(targetProfile, { limit: 50 }), p = await page(r, actor), count = 1;
        const delivered = itemIds(p);
        while (p.nextCursor) {
          assert.ok(count++ < 3);
          r = { ...r, requestId: randomUUID(), cursor: p.nextCursor }; p = await page(r, actor);
          delivered.push(...itemIds(p));
        }
        assert.equal(new Set(delivered).size, delivered.length);
        assert.equal(p.source.continuationState, 'CATALOG_EXHAUSTED');
        return delivered;
      };
      const shared = randomUUID();
      await query("insert into public.profiles(id,profile_type,name) values($1,'SHARED','Contextual skip admission Shared')", [shared]);
      await query('insert into public.profile_members(profile_id,user_id) values($1,$2),($1,$3)', [shared, owner, other]);
      const personal = await expose(profile), target = personal.command.itemId;
      const ownerSource = await expose(shared, target), otherSource = await expose(shared, target, other);
      await commit(personal.command);
      assert.ok((await deliveredCatalogue(shared)).includes(target), 'Personal skip cannot suppress Shared');
      await commit(ownerSource.command); await commit(otherSource.command);
      for (const actor of [owner, other]) {
        const delivered = await deliveredCatalogue(shared, actor);
        assert.equal(delivered.length, 79); assert.ok(!delivered.includes(target));
      }
      await assert.rejects(commit({ ...withdrawal(otherSource.command), reversesActionId: ownerSource.command.actionId }), { code: 'KJ003' });
      await commit(withdrawal(ownerSource.command));
      const decision = (await one('select private.contextual_skip_decision_v1($1,$2,clock_timestamp()) value', [shared, target])).value;
      assert.equal(decision.reason, 'SKIP_COOLDOWN'); assert.deepEqual(decision.sourceIds, [otherSource.command.actionId]);
      const otherPersonal = (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [other])).id;
      assert.ok((await deliveredCatalogue(otherPersonal, other)).includes(target));
      await commit(withdrawal(otherSource.command));
      assert.ok((await deliveredCatalogue(shared, other)).includes(target));
      assert.ok(!(await deliveredCatalogue(profile)).includes(target), 'Shared withdrawal cannot clear Personal skip');
    });
  } finally { await db.close(); }
});
