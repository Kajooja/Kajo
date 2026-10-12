import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

// Execute the shipped mobile adapter against actual current RPC results, rather
// than letting a hand-written mobile fixture become a second protocol truth.
const source = await readFile(new URL('../../apps/mobile/src/features/settings/personalTasteOperations.ts', import.meta.url), 'utf8');
const { sendTasteCommand } = await import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source,
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64'));

test('mobile Taste adapter consumes real session, transition, frozen challenge and removal RPC contracts', async () => {
  const db = new PGlite();
  const owner = 'ab157000-0000-4000-8000-000000000001';
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    for (const file of files) await db.exec(`begin;${file.sql}commit;`);
    await db.exec('begin;');
    await db.exec(await personalTasteSessionFixtureSql());
    const profileId = (await db.query("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [owner])).rows[0].id;
    const rpc = async (functionName, { request }) => {
      assert.ok(['taste_session_v1', 'taste_challenge_v1'].includes(functionName));
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
      await db.exec('set local role authenticated;');
      const data = (await db.query(`select public.${functionName}($1) value`, [request])).rows[0].value;
      await db.exec('set local role postgres;');
      return { data, error: null };
    };
    const call = async (functionName, request) => {
      const result = await sendTasteCommand(rpc, { functionName, request }, new AbortController().signal);
      assert.equal(result.status, 'success', `${functionName} ${request.operation} must be consumable by mobile`);
      return result.response.value;
    };
    let s = await call('taste_session_v1', { operation: 'START', profileId, requestId: randomUUID() });
    let transitionSeen = false;
    let answered = 0;
    while (s.status === 'ACTIVE') {
      const base = { profileId, sessionId: s.sessionId, requestId: randomUUID(), expectedRevision: s.revision };
      if (s.decision.kind === 'TRANSITION') {
        assert.equal(answered, 10); transitionSeen = true;
        s = await call('taste_session_v1', { ...base, operation: 'ACK_TRANSITION' });
      } else {
        const answer = answered < 8 ? { kind: 'RATING', value: answered === 0 ? 0 : answered === 1 ? 5 : 8 } : { kind: 'UNKNOWN' };
        s = await call('taste_session_v1', { ...base, operation: 'ANSWER', questionIndex: s.presentations.at(-1).index, answer });
        answered++;
        if (answered === 6) assert.equal(s.status, 'ACTIVE', 'six native bootstrap responses do not stop the longer session');
      }
      assert.ok(answered <= 24);
    }
    assert.ok(transitionSeen); assert.equal(s.counts.knownRatings, 8); assert.equal(s.status, 'STOPPED');
    let c = await call('taste_challenge_v1', { operation: 'START', profileId, sessionId: s.sessionId, requestId: randomUUID() });
    assert.equal(c.status, 'ACTIVE'); assert.equal(c.metric, null);
    while (c.status === 'ACTIVE') {
      const item = c.items.find(i => !c.answers.some(a => a.itemId === i.id));
      c = await call('taste_challenge_v1', { operation: 'ANSWER', profileId, sessionId: s.sessionId,
        challengeId: c.challengeId, expectedRevision: c.revision, requestId: randomUUID(), itemId: item.id,
        answer: { kind: 'RATING', value: c.revision === 0 ? 0 : c.revision === 1 ? 5 : 8 } });
    }
    assert.equal(c.status, 'COMPLETE'); assert.equal(c.metric.knownRatings, 6);
    const removed = await call('taste_challenge_v1', { operation: 'REMOVE', profileId, sessionId: s.sessionId,
      challengeId: c.challengeId, expectedRevision: c.revision, requestId: randomUUID() });
    assert.equal(removed.status, 'REMOVED'); assert.equal(removed.metric, null);
    s = await call('taste_session_v1', { operation: 'REMOVE', profileId, sessionId: s.sessionId,
      expectedRevision: s.revision, requestId: randomUUID() });
    assert.equal(s.status, 'REMOVED');
  } finally { await db.exec('rollback;'); await db.close(); }
});
