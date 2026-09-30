import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

// Native-only: invoke inside the isolated CLI stack, before its next reset.
// Fixture writes are committed so independent sessions can see them.
export async function verifyPredictionPageConcurrency(exec) {
  const fixture = await readFile(new URL('existing-application-fixture.sql', import.meta.url), 'utf8');
  await exec(`begin; ${fixture} commit;`);
  const [scope] = await exec(`select jsonb_build_object('profileId',id,'runCount',
    (select count(*) from private.prediction_runs)) from public.profiles
    where owner_user_id='a2080000-0000-4000-8000-000000000001' and profile_type='PERSONAL';`);
  const actor = 'a2080000-0000-4000-8000-000000000001';
  const request = { version: 1, requestId: 'a2290000-0000-4000-8000-000000000001',
    profileId: scope.profileId, sessionId: 'a2290000-0000-4000-8000-000000000002',
    discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 20, context: {} };
  // Values originate only in this fixture. Encode SQL literals, never shell text.
  const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const transaction = (command, name, hold) => `begin;
    set local application_name='${name}';
    set local request.jwt.claim.sub='${actor}'; set local role authenticated;
    select public.rank_items_page_v1(${literal(command)});
    ${hold ? 'do $$ begin perform pg_sleep(3); end $$;' : ''} commit;`;
  const waitForLock = async (name, granted) => {
    for (let attempt=0; attempt<40; attempt++) {
      const [found] = await exec(`select to_jsonb(exists(select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid
        where a.application_name='${name}' and l.locktype='advisory' and l.granted=${granted}));`);
      if (found) return;
      await delay(50);
    }
    throw new Error(`Native race did not observe ${name} ${granted ? 'holding' : 'waiting on'} request lock`);
  };
  for (const mismatch of [false,true]) {
    const command = { ...request, requestId: mismatch ? 'a2290000-0000-4000-8000-000000000003' : request.requestId };
    // Attach rejection handlers immediately; assertions still consume all errors.
    const settle = promise => promise.then(value => ({ value }), error => ({ error }));
    const first = settle(exec(transaction(command,'kajo_page_holder',true)));
    let second;
    try {
      await waitForLock('kajo_page_holder',true);
      second = settle(exec(transaction(mismatch ? { ...command, limit: 6 } : command,'kajo_page_waiter',false)));
      await waitForLock('kajo_page_waiter',false);
      const a = await first; const b = await second;
      if (a.error) throw a.error;
      if (mismatch) assert.match(b.error?.message ?? '',/Prediction request ID already used/);
      else {
        if (b.error) throw b.error;
        assert.deepEqual(b.value,a.value,'Concurrent exact retry changed committed response');
      }
    } finally { await Promise.all([first,second]); }
  }
  const [counts] = await exec(`select jsonb_build_object('receipts',(select count(*) from private.prediction_page_receipts),
    'runs',(select count(*) from private.prediction_runs),
    'origins',(select count(distinct prediction_id) from private.prediction_page_receipts));`);
  assert.deepEqual(counts,{ receipts: 2, runs: scope.runCount+2, origins: 2 },'Concurrent retry/mismatch wrote extra traces');
  return { status: 'PASS', cases: ['observed lock wait: identical retry', 'observed lock wait: changed payload rejected'],
    receipts: counts.receipts, newRuns: counts.runs-scope.runCount };
}
