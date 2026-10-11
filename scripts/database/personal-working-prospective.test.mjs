import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalWorkingProspectiveUpgradeSql } from './personal-working-prospective.mjs';

const id = n => `a9171000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const signatures = [
  'private.enroll_personal_working_evaluation_v1(uuid,uuid,jsonb,integer,integer)',
  'private.capture_personal_working_outcomes_v1(uuid,uuid)',
];
const relations = ['private.personal_working_enrollments', 'private.personal_working_outcome_allocations', 'private.personal_working_outcome_captures',
  'private.personal_working_outcome_event_refs'];

test('native prospective Personal enrollment and latest terminal captures retain actual own exposure and withdrawal lineage',
  { timeout: 180_000 }, async t => {
    const db = new PGlite();
    let sequence = 100, actorSequence = 0;
    const next = () => id(sequence++);
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;
        create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      const { files } = await buildFreshInstallation();
      const index = files.findIndex(file => file.name.endsWith('_personal_working_prospective.sql'));
      assert.ok(index > 0, 'A new immutable forward owns prospective source/outcome persistence');
      assert.equal(files[index - 1].name.endsWith('_personal_working_candidate_features.sql'), true);
      for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
      const transact = async (actor, operation) => {
        await db.exec('begin;');
        try {
          await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor ?? '']);
          const result = await operation();
          await db.exec('commit;');
          return result;
        } catch (error) { await db.exec('rollback;'); throw error; }
      };
      const actorCall = async (actor, name, request) => transact(actor, async () => {
        await db.exec('set local role authenticated;');
        return (await db.query(`select public.${name}($1::jsonb) value`, [JSON.stringify(request)])).rows[0].value;
      });
      const setup = async () => {
        const actor = id(1 + actorSequence++), session = next();
        await db.query(`insert into auth.users(id,email,raw_user_meta_data)
          values($1,$2,jsonb_build_object('kajo_nickname',$3::text))`, [actor, `${actor}@example.invalid`, `Prospect ${actor.slice(-4)}`]);
        const profile = (await db.query("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).rows[0].id;
        await db.exec('update public.items set discoverable=false;');
        const evidence = [next(), next()], items = [next(), next(), next(), next()];
        for (const [number, item] of [...evidence, ...items].entries()) await db.query(`insert into public.items
          (id,item_type,title,tags,discoverable) values($1,'BOOK',$2,array['prospective-warm'],$3)`,
        [item, `Prospective fixture ${number}`, items.includes(item)]);
        const startedAt = (await db.query("select (clock_timestamp()-interval '5 minutes')::text value")).rows[0].value;
        const context = { actor, profile, session, startedAt, evidence, items };
        const command = (item, rating) => ({ version: 1, actionId: next(), actorUserId: actor, profileId: profile,
          itemId: item, occurredAt: new Date(Date.parse(startedAt) + 60_000 + rating * 1000).toISOString(),
          discoveryMode: 'FOR_YOU', predictionId: null, session: { sessionId: session, startedAt, context: {} },
          kind: 'SET_RATING', rating });
        await actorCall(actor, 'commit_item_action_v1', command(evidence[0], 0));
        await actorCall(actor, 'commit_item_action_v1', command(evidence[1], 10));
        context.request = { version: 3, requestId: next(), profileId: profile, sessionId: session,
          discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 2, context: {} };
        context.page = await actorCall(actor, 'rank_items_page_v1', context.request);
        context.source = context.page.predictionId;
        context.selected = (await db.query(`select item_id from private.prediction_candidates
          where prediction_id=$1 and selected_for_delivery order by final_rank`, [context.source])).rows.map(row => row.item_id);
        assert.equal(context.selected.length, 2, 'Actual version3 page supplies two immutable OFF selected Items');
        context.pairs = [{ pairId: next(), leftItemId: context.selected[0], rightItemId: context.selected[1] }];
        context.plan = next();
        return context;
      };
      const sourceRows = async source => (await db.query(`select to_jsonb(r) body,
        (select jsonb_agg(to_jsonb(c) order by c.final_rank) from private.prediction_candidates c where c.prediction_id=r.id) candidates,
        (select jsonb_agg(to_jsonb(d) order by d.request_id) from private.prediction_page_receipts d where d.prediction_id=r.id) receipts
        from private.prediction_runs r where r.id=$1`, [source])).rows[0];
      const upgrade = (await db.exec(await personalWorkingProspectiveUpgradeSql(files[index])))
        .flatMap(result => result.rows.map(row => row.snapshot));
      assert.match(upgrade.find(row => row?.personalWorkingProspectiveUpgrade)?.personalWorkingProspectiveUpgrade,
        /^PASS: actual active v3/, 'Reusable populated upgrade preserves all earlier owned source generations');
      const old = await setup();
      const oldRows = await sourceRows(old.source);
      const oldFunctions = (await db.query(`select p.oid,p.oid::regprocedure::text identity,to_jsonb(p)-'prosrc' properties,p.prosrc body
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f' order by p.oid`)).rows;
      await db.exec(`begin;${files[index].sql}commit;`);
      assert.deepEqual(await sourceRows(old.source), oldRows, 'A populated v3 source/candidates/receipt stays byte-identical');
      const installedFunctions = (await db.query(`select p.oid,p.oid::regprocedure::text identity,to_jsonb(p)-'prosrc' properties,p.prosrc body
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f' order by p.oid`)).rows;
      for (const before of oldFunctions) {
        const after = installedFunctions.find(row => row.oid === before.oid);
        assert.ok(after, `Old function remains: ${before.identity}`);
        assert.deepEqual(after.properties, before.properties, `Old function metadata remains: ${before.identity}`);
        if (!before.identity.startsWith('private.erase_prediction_sources_v1(')) assert.equal(after.body, before.body,
          `Old behavior remains: ${before.identity}`);
      }
      const enroll = (context, options = {}) => transact(options.actor ?? context.actor, async () => (await db.query(
        'select private.enroll_personal_working_evaluation_v1($1,$2,$3::jsonb,$4,$5) value',
        [options.plan ?? context.plan, options.source ?? context.source,
          JSON.stringify(options.pairs ?? context.pairs), options.horizon ?? 1, options.maturity ?? 0])).rows[0].value);
      const capture = (context, captureId = next(), actor = context.actor) => transact(actor, async () => (await db.query(
        'select private.capture_personal_working_outcomes_v1($1,$2) value', [captureId, context.plan])).rows[0].value);
      const event = async (context, item, type, properties = {}, options = {}) => {
        const eventId = options.id ?? next();
        return transact(options.actor ?? context.actor, async () => {
          let at = options.at ?? (await db.query('select clock_timestamp()::text value')).rows[0].value;
          const previous = context.lastEventAt?.get(item);
          if (options.at === undefined && previous && Date.parse(at) <= Date.parse(previous)) {
            await db.query('select pg_sleep(0.002)');
            at = (await db.query('select clock_timestamp()::text value')).rows[0].value;
          }
          await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,
            occurred_at,session_id,prediction_id,discovery_mode,context,properties)
            values($1,$2,$3,$4,'BOOK',$5,$6,$7,$8,$9,'{}',$10::jsonb)`,
          [eventId, options.actor ?? context.actor, context.profile, item, type, at, options.session ?? context.session,
            options.prediction === undefined ? context.source : options.prediction, options.mode ?? 'FOR_YOU', JSON.stringify(properties)]);
          context.lastEventAt ??= new Map();context.lastEventAt.set(item, at);
          return { id: eventId, at };
        });
      };
      const expose = async context => {
        const result = [];
        for (const item of context.selected) result.push(await event(context, item, 'ITEM_IMPRESSION'));
        return result;
      };
      const awaitMaturity = async enrollment => {
        const serverNow = Number((await db.query('select extract(epoch from clock_timestamp())*1000 value')).rows[0].value);
        await new Promise(resolve => setTimeout(resolve, Math.max(0, Math.ceil(enrollment.matureAt - serverNow + 20))));
      };
      const assertClosed = result => {
        for (const key of ['historicalFeatureEligible', 'learnable', 'nativeActivated']) assert.equal(result[key], false, key);
      };

      await t.test('private API ACL and unchanged source are preserved', async () => {
        for (const role of ['anon', 'authenticated', 'service_role']) {
          for (const signature of signatures) assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') value',
            [role, signature])).rows[0].value, false);
          for (const relation of relations) assert.equal((await db.query('select has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\') value',
            [role, relation])).rows[0].value, false);
        }
        assert.deepEqual(await sourceRows(old.source), oldRows);
      });

      await t.test('new enrollments reject unsupported shape, scope and isolation; native held-lock proof stays separate', async () => {
        const context = await setup();
        for (const options of [{ horizon: 0 }, { horizon: 7_776_001 }, { maturity: -1 }, { maturity: 604_801 },
          { pairs: [] }, { pairs: [{ ...context.pairs[0], rightItemId: context.pairs[0].leftItemId }] },
          { pairs: [...context.pairs, { ...context.pairs[0], pairId: next() }] },
          { pairs: [{ ...context.pairs[0], rightItemId: context.evidence[0] }] }, { source: next() }, { actor: old.actor }]) {
          await assert.rejects(enroll(context, options));
        }
        await db.exec('begin isolation level repeatable read;');
        try {
          await db.query("select set_config('request.jwt.claim.sub',$1,true)", [context.actor]);
          await assert.rejects(db.query('select private.enroll_personal_working_evaluation_v1($1,$2,$3::jsonb,1,0)',
            [context.plan, context.source, JSON.stringify(context.pairs)]));
        } finally { await db.exec('rollback;'); }
        await transact(context.actor, async () => {
          await db.query('select pg_advisory_xact_lock_shared(1946841873,232004)');
          // PGlite does not expose held advisory locks in pg_locks. The actual
          // native helper separately proves this guard; never weaken SQL for Wasm.
          const visible = (await db.query(`select exists(select 1 from pg_locks where pid=pg_backend_pid()
            and locktype='advisory' and classid=1946841873 and objid=232004 and objsubid=2
            and granted and mode='ShareLock') value`)).rows[0].value;
          if (visible) {
            await db.exec('savepoint held_share_guard;');
            try { await assert.rejects(db.query('select private.enroll_personal_working_evaluation_v1($1,$2,$3::jsonb,1,0)',
              [context.plan, context.source, JSON.stringify(context.pairs)]), error => error.code === '25001'); }
            finally { await db.exec('rollback to savepoint held_share_guard;release savepoint held_share_guard;'); }
          }
        });
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_enrollments where source_prediction_id=$1',
          [context.source])).rows[0].value, 0);
      });

      await t.test('prior own impression or terminal evidence cannot be retrospectively enrolled', async () => {
        for (const type of ['ITEM_IMPRESSION', 'ITEM_RATED']) {
          const context = await setup();
          await event(context, context.selected[0], type, type === 'ITEM_RATED' ? { rating: 0 } : {});
          await assert.rejects(enroll(context));
        }
      });

      await t.test('enrollment freezes server clocks, exact OFF controls and one source; retries reauthorize', async () => {
        const context = await setup();
        const before = await sourceRows(context.source);
        const enrollment = await enroll(context);
        assert.equal(enrollment.version, 'personal-working-enrollment-v1');
        assert.equal(enrollment.enrollmentId, context.plan); assert.equal(enrollment.sourcePredictionId, context.source);
        assert.deepEqual(enrollment.pairs, context.pairs); assertClosed(enrollment);
        assert.equal(enrollment.commitAvailability, 'UNKNOWN');
        assert.equal(enrollment.horizon.startAt, enrollment.declaredAt);
        assert.equal(enrollment.horizon.endAt, enrollment.declaredAt + 1000);
        assert.equal(enrollment.matureAt, enrollment.horizon.endAt);
        assert.deepEqual(enrollment.controls.map(row => row.control).sort(), ['OFF', 'ORDERED', 'STATIC']);
        assert.deepEqual(await enroll(context), enrollment, 'Exact retry returns the original immutable bytes');
        await assert.rejects(enroll(context, { actor: old.actor }));
        await assert.rejects(enroll(context, { plan: next() }));
        await assert.rejects(enroll(context, { horizon: 2 }));
        const actual = (await db.query(`select item_id,final_score,final_rank,selected_for_delivery,
          private.prediction_delivery_tier_v1(explanation->'resurfacingPolicy') tier,
          coalesce((explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) eligible
          from private.prediction_candidates where prediction_id=$1 order by final_rank`, [context.source])).rows;
        const off = (await db.query("select result from private.personal_working_shadow_comparisons where source_prediction_id=$1 and control='OFF'",
          [context.source])).rows[0].result;
        assert.deepEqual(off.candidates.map(row => [row.itemId, row.score, row.rank, row.selected, row.tier, row.eligible]),
          actual.map(row => [row.item_id, row.final_score, row.final_rank, row.selected_for_delivery, row.tier, row.eligible]));
        assert.deepEqual(await sourceRows(context.source), before);
        await assert.rejects(db.query("update private.personal_working_enrollments set result='{}' where id=$1", [context.plan]));
        await assert.rejects(db.query('delete from private.personal_working_enrollments where id=$1', [context.plan]));
      });

      await t.test('latest own rating zero is observed after genuine exposure; later sessions need no attribution reuse', async () => {
        const context = await setup(), enrollment = await enroll(context);
        await assert.rejects(capture(context), 'An immature window cannot produce a mature capture');
        const exposures = await expose(context);
        const laterSession = next();
        await db.query("insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context) values($1,$2,$3,clock_timestamp(),'{}')",
          [laterSession, context.actor, context.profile]);
        await event(context, context.selected[0], 'ITEM_RATED', { rating: 9 });
        const zero = await event(context, context.selected[0], 'ITEM_RATED', { rating: 0 }, { session: laterSession, prediction: null });
        const right = await event(context, context.selected[1], 'ITEM_RATED', { rating: 10 });
        await awaitMaturity(enrollment);
        const captureId = next(), result = await capture(context, captureId);
        assert.equal(result.version, 'personal-working-outcomes-v1'); assert.equal(result.resolutionVersion, 'personal-latest-terminal-v1');
        assert.equal(result.complete, true); assertClosed(result); assert.equal(result.labels.length, 2);
        for (const [index, expected] of [zero, right].entries()) {
          const label = result.labels.find(row => row.itemId === context.selected[index]);
          assert.equal(label.status, 'observed'); assert.equal(label.rating, index === 0 ? 0 : 10);
          assert.equal(label.eventId, expected.id); assert.equal(label.exposureId, exposures[index].id);
        }
        const left = result.labels.find(row => row.itemId === context.selected[0]);
        assert.equal(left.eventSessionId, laterSession); assert.equal(left.originPredictionId, null);
        assert.deepEqual(await capture(context, captureId), result);
        await assert.rejects(capture(context, captureId, old.actor));
        await assert.rejects(db.query("update private.personal_working_outcome_captures set result='{}' where id=$1", [captureId]));
        await assert.rejects(db.query('delete from private.personal_working_outcome_captures where id=$1', [captureId]));
        // Corrections occurring after the fixed maturity boundary cannot rewrite this cohort's chosen target.
        await event(context, context.selected[0], 'ITEM_RATED', { rating: 8 });
        const later = await capture(context);
        assert.deepEqual(later.labels, result.labels);
        const countBefore = (await db.query('select count(*)::integer value from private.personal_working_outcome_captures where enrollment_id=$1',
          [context.plan])).rows[0].value;
        for (let number = countBefore; number < 16; number++) await capture(context);
        await assert.rejects(capture(context), 'Capture budget remains bounded to sixteen');
      });

      await t.test('clear, unknown interest, missing and tied terminals remain unscored; valid exact UNDO restores prior active rating', async () => {
        const cases = [
          { name: 'clear', events: [['ITEM_RATED', { rating: 7 }], ['ITEM_HISTORY_CLEARED', {}]], status: 'clear' },
          { name: 'not interest', events: [['ITEM_RATED', { rating: 7 }], ['ITEM_NOT_INTERESTED', {}]], status: 'unknown' },
          { name: 'interest clear', events: [['ITEM_RATED', { rating: 7 }], ['ITEM_INTEREST_CLEARED', {}]], status: 'unknown' },
          { name: 'null rating', events: [['ITEM_RATED', { rating: null }]], status: 'unknown' },
          { name: 'string rating', events: [['ITEM_RATED', { rating: 'bad' }]], status: 'unknown' },
          { name: 'fractional rating', events: [['ITEM_RATED', { rating: 0.5 }]], status: 'unknown' },
          { name: 'out of range rating', events: [['ITEM_RATED', { rating: 11 }]], status: 'unknown' },
          { name: 'missing', events: [], status: 'missing' },
          { name: 'malformed undo', events: [['ITEM_RATED', { rating: 7 }], ['ITEM_INTERACTION_UNDONE', { reversedEventId: 'invalid' }]], status: 'unknown' },
          { name: 'absent undo', events: [['ITEM_RATED', { rating: 7 }], ['ITEM_INTERACTION_UNDONE', { reversedEventId: next() }]], status: 'unknown' },
        ];
        for (const specimen of cases) {
          const context = await setup(), enrollment = await enroll(context);
          await expose(context);
          for (const [type, properties] of specimen.events) await event(context, context.selected[0], type, properties);
          await awaitMaturity(enrollment);
          const result = await capture(context), label = result.labels.find(row => row.itemId === context.selected[0]);
          assert.equal(label.status, specimen.status, specimen.name); assert.equal(label.rating, null, specimen.name);
        }
        const tie = await setup(), tieEnrollment = await enroll(tie);
        await expose(tie);
        const at = (await db.query('select clock_timestamp()::text value')).rows[0].value;
        await event(tie, tie.selected[0], 'ITEM_RATED', { rating: 0 }, { at });
        await event(tie, tie.selected[0], 'ITEM_RATED', { rating: 10 }, { at });
        await awaitMaturity(tieEnrollment);
        const tieLabel = (await capture(tie)).labels.find(row => row.itemId === tie.selected[0]);
        assert.equal(tieLabel.status, 'unknown'); assert.equal(tieLabel.rating, null, 'UUID order does not select a tied terminal winner');
        const undo = await setup(), undoEnrollment = await enroll(undo);
        await expose(undo);
        const original = await event(undo, undo.selected[0], 'ITEM_RATED', { rating: 0 });
        const replacement = await event(undo, undo.selected[0], 'ITEM_RATED', { rating: 8 });
        await event(undo, undo.selected[0], 'ITEM_INTERACTION_UNDONE', { reversedEventId: replacement.id });
        await awaitMaturity(undoEnrollment);
        const undoLabel = (await capture(undo)).labels.find(row => row.itemId === undo.selected[0]);
        assert.equal(undoLabel.status, 'observed'); assert.equal(undoLabel.rating, 0); assert.equal(undoLabel.eventId, original.id);
      });

      await t.test('declaration commit rejects own evidence across SAVEPOINT transaction IDs; rolled-back evidence stays absent', async () => {
        const declare = async context => (await db.query('select private.enroll_personal_working_evaluation_v1($1,$2,$3::jsonb,1,0) value',
          [context.plan, context.source, JSON.stringify(context.pairs)])).rows[0].value;
        const insertExposure = async (context, eventId) => db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,
          item_type,event_type,occurred_at,session_id,prediction_id,discovery_mode,properties)
          values($1,$2,$3,$4,'BOOK','ITEM_IMPRESSION',clock_timestamp(),$5,$6,'FOR_YOU','{}')`,
        [eventId, context.actor, context.profile, context.selected[0], context.session, context.source]);
        for (const kind of ['ordinary', 'event-savepoint', 'nested-declaration-savepoint']) {
          const context = await setup(), eventId = next();
          let reachedCommit = false;
          await assert.rejects(transact(context.actor, async () => {
            if (kind === 'nested-declaration-savepoint') await db.exec('savepoint outer_declaration;savepoint inner_declaration;');
            await declare(context);
            if (kind === 'nested-declaration-savepoint') await db.exec('release savepoint inner_declaration;release savepoint outer_declaration;');
            if (kind === 'event-savepoint') await db.exec('savepoint post_declaration_event;');
            await insertExposure(context, eventId);
            if (kind === 'event-savepoint') await db.exec('release savepoint post_declaration_event;');
            reachedCommit = true;
          }), error => error.code === '55000', `${kind} evidence invalidates the declaration at commit`);
          assert.equal(reachedCommit, true, `${kind} is rejected by the deferred commit guard`);
          assert.equal((await db.query('select count(*)::integer value from private.personal_working_enrollments where id=$1',
            [context.plan])).rows[0].value, 0, `${kind} cannot leave an enrolled plan`);
          assert.equal((await db.query('select count(*)::integer value from public.events where id=$1', [eventId])).rows[0].value, 0);
          assert.equal((await db.query('select count(*)::integer value from private.personal_working_shadow_comparisons where source_prediction_id=$1',
            [context.source])).rows[0].value, 0, `${kind} rolls back the generated controls`);
        }
        const context = await setup(), rolledBackEvent = next(), attemptedCapture = next();
        const enrollment = await transact(context.actor, async () => {
          await db.exec('savepoint declaration_parent;savepoint declaration_child;');
          const value = await declare(context);
          await db.exec('release savepoint declaration_child;release savepoint declaration_parent;');
          assert.equal((await db.query(`select declared_transaction=pg_current_xact_id() value
            from private.personal_working_enrollments where id=$1`, [context.plan])).rows[0].value, true,
          'Nested declaration records its top-level transaction, rather than its tuple xmin');
          await db.exec('savepoint rolled_back_evidence;');
          await insertExposure(context, rolledBackEvent);
          await db.exec('rollback to savepoint rolled_back_evidence;release savepoint rolled_back_evidence;');
          await db.exec('savepoint attempted_capture;');
          await assert.rejects(db.query('select private.capture_personal_working_outcomes_v1($1,$2)',
            [attemptedCapture, context.plan]), error => error.code === '25001',
          'Capture cannot precede the declaration top-level transaction commit');
          await db.exec('rollback to savepoint attempted_capture;release savepoint attempted_capture;');
          return value;
        });
        assert.equal((await db.query('select count(*)::integer value from public.events where id=$1', [rolledBackEvent])).rows[0].value, 0);
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_outcome_allocations where id=$1',
          [attemptedCapture])).rows[0].value, 0, 'A rejected precommit capture consumes no revision');
        await awaitMaturity(enrollment);
        const result = await capture(context);
        assert.equal(result.complete, true);
        for (const label of result.labels) {
          assert.equal(label.status, 'missing'); assert.equal(label.reason, 'NO_TERMINAL');
          assert.equal(label.exposureId, null); assert.equal(label.eventId, null); assert.equal(label.rating, null);
        }
      });

      await t.test('receipt-only and foreign/scope-mismatched impressions cannot manufacture exposure', async () => {
        for (const kind of ['receipt-only', 'foreign-actor', 'wrong-mode', 'wrong-session']) {
          const context = await setup();
          const enrollment = await enroll(context);
          if (kind === 'foreign-actor') await assert.rejects(event(context, context.selected[0], 'ITEM_IMPRESSION', {},
            { actor: old.actor }), error => error.code === '23503', 'Session identity FK rejects a foreign actor using the owned session');
          if (kind === 'wrong-mode') await event(context, context.selected[0], 'ITEM_IMPRESSION', {}, { mode: 'RISK' });
          if (kind === 'wrong-session') {
            const otherSession = next();
            await db.query("insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context) values($1,$2,$3,clock_timestamp(),'{}')",
              [otherSession, context.actor, context.profile]);
            await event(context, context.selected[0], 'ITEM_IMPRESSION', {}, { session: otherSession });
          }
          await event(context, context.selected[0], 'ITEM_RATED', { rating: 0 });
          await awaitMaturity(enrollment);
          const label = (await capture(context)).labels.find(row => row.itemId === context.selected[0]);
          assert.notEqual(label.status, 'observed', kind); assert.equal(label.exposureId, null, kind);
        }
      });

      await t.test('complete raw source refs invalidate entire immutable capture on event withdrawal and forecast erasure cascades', async () => {
        const context = await setup(), enrollment = await enroll(context);
        const exposures = await expose(context);
        const overwritten = await event(context, context.selected[0], 'ITEM_RATED', { rating: 9 });
        await event(context, context.selected[0], 'ITEM_RATED', { rating: 0 });
        await event(context, context.selected[1], 'ITEM_RATED', { rating: 10 });
        await awaitMaturity(enrollment);
        const result = await capture(context);
        const refs = (await db.query('select event_id from private.personal_working_outcome_event_refs where capture_id=$1',
          [result.captureId])).rows.map(row => row.event_id);
        assert.ok(refs.includes(overwritten.id), 'Even superseded rating lineage participates in source withdrawal');
        assert.ok(refs.includes(exposures[0].id), 'Actual exposure lineage participates in source withdrawal');
        await assert.rejects(db.query('delete from private.personal_working_outcome_event_refs where capture_id=$1 and event_id=$2',
          [result.captureId, overwritten.id]), 'Deleting one dependency must not silently preserve a copied capture');
        await db.query('delete from public.events where id=$1', [overwritten.id]);
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_outcome_captures where id=$1',
          [result.captureId])).rows[0].value, 0, 'Whole copied capture is invalidated rather than losing one reference silently');
        const rawBefore = (await db.query('select to_jsonb(e) value from public.events e where e.profile_id=$1 order by e.id',
          [context.profile])).rows;
        await transact(context.actor, async () => db.query('select private.erase_prediction_sources_v1($1,$2)', ['PREDICTION_RUN', context.source]));
        for (const relation of ['private.personal_working_enrollments', 'private.personal_working_outcome_captures']) assert.equal(
          (await db.query(`select count(*)::integer value from ${relation} where source_prediction_id=$1`, [context.source])).rows[0].value, 0);
        assert.deepEqual((await db.query('select to_jsonb(e) value from public.events e where e.profile_id=$1 order by e.id',
          [context.profile])).rows, rawBefore, 'Forecast withdrawal does not erase unrelated canonical evidence');
      });

      await t.test('an incomplete 8193-row prefix abstains instead of accepting a truncated exposure history', async () => {
        const context = await setup(), enrollment = await enroll(context);
        await transact(context.actor, async () => db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,
          event_type,occurred_at,session_id,prediction_id,discovery_mode,properties)
          select md5($1::text||':'||n::text)::uuid,$2,$3,$4,'BOOK','ITEM_IMPRESSION',clock_timestamp(),$5,$6,'FOR_YOU','{}'
          from generate_series(1,8193) n`, [context.plan, context.actor, context.profile, context.selected[0], context.session, context.source]));
        await awaitMaturity(enrollment);
        const result = await capture(context);
        assert.equal(result.complete, false);
        assert.equal(result.labels.length, 2);
        for (const label of result.labels) {
          assert.equal(label.status, 'unknown'); assert.equal(label.reason, 'EVENT_BUDGET');
          assert.equal(label.rating, null); assert.equal(label.exposureId, null);
        }
      });

      await t.test('withdrawn captures retain consumed IDs and the sixteen-allocation lifetime budget', async () => {
        const context = await setup(), enrollment = await enroll(context);
        await expose(context);
        const discarded = await event(context, context.selected[0], 'ITEM_RATED', { rating: 9 });
        await event(context, context.selected[0], 'ITEM_RATED', { rating: 0 });
        await event(context, context.selected[1], 'ITEM_RATED', { rating: 10 });
        await awaitMaturity(enrollment);
        const captures = [];
        for (let number = 0; number < 16; number++) captures.push(await capture(context));
        assert.deepEqual(captures.map(row => row.revision), Array.from({ length: 16 }, (_, number) => number + 1));
        await db.query('delete from public.events where id=$1', [discarded.id]);
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_outcome_captures where enrollment_id=$1',
          [context.plan])).rows[0].value, 0);
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_outcome_allocations where enrollment_id=$1',
          [context.plan])).rows[0].value, 16, 'Whole capture withdrawal preserves consumed bounded allocation lineage');
        await assert.rejects(capture(context, captures[0].captureId), 'An erased ID cannot reconstruct a different historical receipt');
        await assert.rejects(capture(context), 'Source withdrawal does not replenish the lifetime allocation budget');
        await assert.rejects(db.query('delete from private.personal_working_outcome_allocations where enrollment_id=$1', [context.plan]));
        await assert.rejects(db.query('update private.personal_working_outcome_allocations set revision=1 where id=$1', [captures[1].captureId]));
      });

      await t.test('a single source row above the eight MiB budget abstains before materializing or retaining its lineage', async () => {
        const oversized = { padding: 'x'.repeat(8_388_609), rating: 0 };
        const context = await setup(), enrollment = await enroll(context, { horizon: 5 });
        await expose(context);
        await event(context, context.selected[0], 'ITEM_RATED', oversized);
        await awaitMaturity(enrollment);
        const result = await capture(context);
        assert.equal(result.complete, false);
        for (const label of result.labels) {
          assert.equal(label.status, 'unknown'); assert.equal(label.reason, 'EVENT_BUDGET');
          assert.equal(label.rating, null); assert.equal(label.eventId, null); assert.equal(label.exposureId, null);
        }
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_outcome_event_refs where capture_id=$1',
          [result.captureId])).rows[0].value, 0, 'An oversized source never retains a partial provenance prefix');
        assert.deepEqual((await db.query('select origin_prediction_ids from private.personal_working_outcome_captures where id=$1',
          [result.captureId])).rows[0].origin_prediction_ids, []);
      });

      await t.test('erasing a later rating origin invalidates its whole copied capture without erasing the enrolled source', async () => {
        const context = await setup();
        const otherPage = await actorCall(context.actor, 'rank_items_page_v1', { ...context.request, requestId: next() });
        assert.notEqual(otherPage.predictionId, context.source);
        const enrollment = await enroll(context);
        await expose(context);
        await event(context, context.selected[0], 'ITEM_RATED', { rating: 0 }, { prediction: otherPage.predictionId });
        await event(context, context.selected[1], 'ITEM_RATED', { rating: 10 });
        await awaitMaturity(enrollment);
        const result = await capture(context);
        assert.equal(result.labels.find(row => row.itemId === context.selected[0]).originPredictionId, otherPage.predictionId);
        await transact(context.actor, async () => db.query('select private.erase_prediction_sources_v1($1,$2)',
          ['PREDICTION_RUN', otherPage.predictionId]));
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_outcome_captures where id=$1',
          [result.captureId])).rows[0].value, 0);
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_enrollments where id=$1',
          [context.plan])).rows[0].value, 1, 'Independent enrolled source remains intact');
        assert.equal((await db.query('select count(*)::integer value from private.prediction_runs where id=$1',
          [context.source])).rows[0].value, 1);
        const afterWithdrawal = await capture(context);
        assert.equal(afterWithdrawal.complete, false);
        for (const label of afterWithdrawal.labels) {
          assert.equal(label.status, 'unknown'); assert.equal(label.reason, 'ORIGIN_SOURCE_UNAVAILABLE');
          assert.equal(label.rating, null); assert.equal(label.eventId, null); assert.equal(label.exposureId, null);
        }
      });

      await t.test('a foreign forecast pointer cannot be recaptured as authorized own ordinal outcome evidence', async () => {
        const context = await setup(), enrollment = await enroll(context);
        await expose(context);
        await event(context, context.selected[0], 'ITEM_RATED', { rating: 0 }, { prediction: old.source });
        await event(context, context.selected[1], 'ITEM_RATED', { rating: 10 });
        await awaitMaturity(enrollment);
        const result = await capture(context);
        assert.equal(result.complete, false);
        for (const label of result.labels) {
          assert.equal(label.status, 'unknown'); assert.equal(label.reason, 'ORIGIN_SOURCE_UNAVAILABLE');
          assert.equal(label.rating, null); assert.equal(label.eventId, null); assert.equal(label.exposureId, null);
        }
      });

      await t.test('native explicit-transaction acceptance emits one JSON acknowledgement and cleans every owned row', async () => {
        const fixture = await readFile(new URL('./personal-working-prospective-fixture.sql', import.meta.url), 'utf8');
        // Native psql -qAt emits every result value. Setup UUIDs or void sleep
        // results would break the CLI probe's strict JSON-line decoder.
        const values = (await db.exec(fixture)).flatMap(result => result.rows.flatMap(row => Object.values(row)));
        assert.equal(values.length, 1, 'Only the final JSON acknowledgement may reach native stdout');
        assert.match(values[0]?.personalWorkingProspective, /^PASS:/);
        assert.equal((await db.query("select count(*)::integer value from auth.users where id::text like 'a9172000-%'")).rows[0].value, 0);
      });
    } finally { await db.close(); }
  });
