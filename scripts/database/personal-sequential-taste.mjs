import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const actor='ab157000-0000-4000-8000-000000000001';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;

// Independent transactions/connections on the disposable native CI stack only.
// Never call this with hosted/operator executors or wrap it in one transaction.
export async function verifyPersonalSequentialTaste(execConcurrentSql){
  const exec=(sql,stage)=>execConcurrentSql(sql,{stage:`sequential-taste-${stage}`,timeoutMs:30_000});
  const running=[];let fixture=false;let snapshots,original;
  const release=async s=>{
    if(!s.pid||s.done)return;
    const [ok]=await exec(`select coalesce((select to_jsonb(pg_cancel_backend(pid)) from pg_stat_activity
      where pid=${s.pid} and application_name='${s.name}' and wait_event='PgSleep'),'false');`,'release-owned-holder');
    assert.equal(ok,true);
  };
  const launch=(name,expression,hold=false,reject=null,holdBefore=false)=>{
    const s={name};running.push(s);
    const call=reject?`do $reject$ declare code text;begin begin perform ${expression};
      exception when sqlstate '${reject}' then code:=sqlstate;end;
      if code is distinct from '${reject}' then raise exception 'Expected sequential Taste conflict';end if;end;$reject$;
      select jsonb_build_object('sqlstate','${reject}');`:`select ${expression};`;
    const barrier=`do $hold$ begin begin perform pg_sleep(20);exception when query_canceled then null;end;end;$hold$;`;
    s.promise=exec(`begin;set local application_name='${name}';set local request.jwt.claim.sub='${actor}';set local role authenticated;
      ${holdBefore?barrier:''}${call}${hold?barrier:''}commit;`,name.replaceAll('_','-'))
      .then(rows=>(s.done={rows}),error=>(s.done={error}));return s;
  };
  const observe=async(s,holder=null)=>{
    const deadline=Date.now()+7000;
    while(Date.now()<deadline){
      const [row]=await exec(`select coalesce((select jsonb_build_object('pid',pid,'blockers',pg_blocking_pids(pid),'wait',wait_event_type)
        from pg_stat_activity where application_name='${s.name}' and state='active'
          ${holder?`and wait_event_type='Lock' and ${holder.pid}=any(pg_blocking_pids(pid))`:"and wait_event='PgSleep'"}),'null');`,'observe-owned-lock');
      if(row){s.pid=row.pid;return row;}
      if(s.done?.error)throw s.done.error;
      assert.equal(s.done,undefined,'Sequential Taste connection ended before the lock boundary');await delay(40);
    }
    throw new Error(`Sequential Taste lock boundary not observed: ${s.name}`);
  };
  const finish=async s=>{const out=await s.promise;if(out.error)throw out.error;return out.rows[0];};
  const pair=async(name,first,second,reject=null)=>{
    const a=launch(`kajo_seq_${name}_holder`,first,true);await observe(a);
    const b=launch(`kajo_seq_${name}_waiter`,second,false,reject);const proof=await observe(b,a);
    assert.notEqual(a.pid,b.pid);await release(a);return [await finish(a),await finish(b),proof];
  };
  try{
    const [reserved]=await exec(`select jsonb_build_object('users',(select count(*) from auth.users where id::text like 'ab157000-%'),
      'items',(select count(*) from public.items where id::text like 'ab157000-%'),
      'backends',(select count(*) from pg_stat_activity where application_name like 'kajo_seq_%'));`,'reserved-scope');
    assert.deepEqual(reserved,{users:0,items:0,backends:0});
    const [tables]=await exec(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth');`,'canonical-tables');
    snapshots=`select jsonb_object_agg(name,value) from (${tables.map(name=>`select '${name}' name,
      encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value from ${name} r`).join(' union all ')}) s;`;
    [original]=await exec(snapshots,'canonical-before');
    fixture=true;await exec(`begin;${await personalTasteSessionFixtureSql()}commit;`,'fixture');
    const [profileId]=await exec(`select to_jsonb(id) from public.profiles where owner_user_id='${actor}' and profile_type='PERSONAL';`,'profile');
    const rpc=r=>`public.taste_session_v2(${literal(r)})`;
    const call=async r=>(await exec(`begin;set local request.jwt.claim.sub='${actor}';set local role authenticated;select ${rpc(r)};commit;`,'committed-command'))[0];
    const command=(s,operation,extra={})=>({operation,profileId,sessionId:s.sessionId,requestId:randomUUID(),expectedRevision:s.revision,...extra});
    const [s,startRetry,startLock]=await pair('start',rpc({operation:'START',profileId,requestId:actor}),rpc({operation:'START',profileId,requestId:actor}));
    assert.deepEqual(s,startRetry);assert.equal(s.status,'NEEDS_NEXT');
    const offer=command(s,'NEXT');
    const [q,qRetry,offerLock]=await pair('offer',rpc(offer),rpc(offer));assert.deepEqual(q,qRetry);assert.equal(q.status,'QUESTION');
    const answer=command(q,'ANSWER',{questionId:q.questionId,answer:{kind:'RATING',value:10}});
    const [accepted,answerRetry,answerLock]=await pair('answer',rpc(answer),rpc(answer));assert.deepEqual(accepted,answerRetry);
    const [q2,conflict,conflictLock]=await pair('conflict',rpc(command(accepted,'NEXT')),rpc(command(accepted,'NEXT')),'40001');
    assert.equal(conflict.sqlstate,'40001');
    const reply=command(q2,'ANSWER',{questionId:q2.questionId,answer:{kind:'RATING',value:5}});
    // Begin NEXT before ANSWER's server receipt, then release it into the
    // Profile lock while ANSWER is still uncommitted. Merely launching a waiter
    // after the holder's answer would not test this earlier transaction clock.
    const earlyWaiter=launch('kajo_seq_cutoff_waiter',rpc({...command(q2,'NEXT'),expectedRevision:q2.revision+1}),false,'40001',true);
    await observe(earlyWaiter);
    const answerHolder=launch('kajo_seq_cutoff_holder',rpc(reply),true);await observe(answerHolder);
    await release(earlyWaiter);const cutoffLock=await observe(earlyWaiter,answerHolder);await release(answerHolder);
    const a2=await finish(answerHolder),early=await finish(earlyWaiter);
    assert.equal(early.sqlstate,'40001','A waiter transaction begun before the answer receipt must not score after its lock wait');
    const q3=await call(command(a2,'NEXT'));assert.equal(q3.status,'QUESTION');
    const [observed]=await exec(`select jsonb_build_object('panels',(select count(*) from private.sequential_taste_panels where session_id='${s.sessionId}'),
      'ratings',(select count(*) from private.profile_bootstrap_evidence where profile_id='${profileId}' and active),
      'events',(select count(*) from public.events where profile_id='${profileId}'),
      'delivered',(select count(*) from private.prediction_candidates c join private.sequential_taste_panels p on p.prediction_id=c.prediction_id
        where p.session_id='${s.sessionId}' and c.selected_for_delivery),
      'positiveBootstrap',exists(select 1 from private.prediction_candidates c join private.sequential_taste_panels p on p.prediction_id=c.prediction_id
        where p.session_id='${s.sessionId}' and p.prefix_revision=${a2.revision} and (c.explanation->>'bootstrapLongTerm')::double precision>0));`,'canonical-evidence');
    assert.deepEqual(observed,{panels:3,ratings:2,events:0,delivered:0,positiveBootstrap:true});
    const [job]=await exec(`select to_jsonb(source_job_id) from private.sequential_taste_sessions where id='${s.sessionId}';`,'source-job');
    const [removed,retryAfterRemoval,removalLock]=await pair('remove',`public.remove_profile_import_job_v1('${job}'::uuid)`,rpc(answer));
    assert.equal(removed.status,'REMOVED');assert.equal(retryAfterRemoval.status,'REMOVED');
    const [cleared]=await exec(`select jsonb_build_object('panels',(select count(*) from private.sequential_taste_panels where session_id='${s.sessionId}'),
      'commands',(select count(*) from private.sequential_taste_commands where session_id='${s.sessionId}'),
      'active',(select count(*) from private.profile_bootstrap_evidence where source_job_id='${job}' and active));`,'erasure');
    assert.deepEqual(cleared,{panels:0,commands:0,active:0});
    return {status:'PASS',forecastAnswerNext:'SEPARATE_COMMITTED_TRANSACTIONS',concurrentRetry:'EXACTLY_ONCE',
      earlyNext:'40001',staleRevision:'40001',sourceRemoval:'NO_REPLAY_OR_REACTIVATION',nonDelivery:true,
      independentLockProofs:[startLock,offerLock,answerLock,conflictLock,cutoffLock,removalLock]};
  }finally{
    for(const s of running)if(!s.done&&s.pid){
      await exec(`select to_jsonb(pg_cancel_backend(pid)) from pg_stat_activity
        where pid=${s.pid} and application_name='${s.name}' and state='active';`,'cancel-owned-fixture-connection');
    }
    await Promise.all(running.map(s=>s.promise));
    if(fixture){
      await exec(`begin;delete from auth.users where id::text like 'ab157000-%';
        delete from private.item_sources where item_id::text like 'ab157000-%';delete from public.items where id::text like 'ab157000-%';commit;`,'cleanup');
      assert.deepEqual((await exec(snapshots,'canonical-after'))[0],original,'Sequential fixture changed retained canonical state');
    }
  }
}
