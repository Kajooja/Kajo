import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const actor='ab157000-0000-4000-8000-000000000001';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
// Runs only on the independently connected, disposable Supabase CLI stack.
// PGlite verifies state/permissions separately and is never called a lock proof.
export async function verifyPersonalTasteSessionConcurrency(execConcurrentSql){
  const exec=(sql,stage)=>execConcurrentSql(sql,{stage:`taste-${stage}`,timeoutMs:30_000});
  const running=[];let fixture=false;let original;let snapshots;
  const release=async session=>{
    if(!session.pid||session.done)return;
    const [ok]=await exec(`select coalesce((select to_jsonb(pg_cancel_backend(pid)) from pg_stat_activity
      where pid=${session.pid} and application_name='${session.name}' and wait_event='PgSleep'),'false');`,'release-owned-holder');
    assert.equal(ok,true);
  };
  const launch=(name,expression,hold=false,reject=null)=>{
    const s={name};running.push(s);
    const call=reject?`do $reject$ declare code text;begin begin perform ${expression};
      exception when sqlstate '${reject}' then code:=sqlstate;end;
      if code is distinct from '${reject}' then raise exception 'Expected Taste conflict';end if;end;$reject$;
      select jsonb_build_object('sqlstate','${reject}');`:`select ${expression};`;
    s.promise=exec(`begin;set local application_name='${name}';set local request.jwt.claim.sub='${actor}';set local role authenticated;
      ${call}${hold?`do $hold$ begin begin perform pg_sleep(20);exception when query_canceled then null;end;end;$hold$;`:''}commit;`,name)
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
      assert.equal(s.done,undefined,'Taste connection finished before the lock boundary');await delay(40);
    }
    throw new Error(`Taste lock boundary not observed: ${s.name}`);
  };
  const finish=async s=>{const out=await s.promise;if(out.error)throw out.error;return out.rows[0];};
  const pair=async(name,first,second,reject=null)=>{
    const a=launch(`kajo_taste_${name}_holder`,first,true);await observe(a);
    const b=launch(`kajo_taste_${name}_waiter`,second,false,reject);const lock=await observe(b,a);
    assert.notEqual(a.pid,b.pid);await release(a);return [await finish(a),await finish(b),lock];
  };
  try{
    const [reserved]=await exec(`select jsonb_build_object('users',(select count(*) from auth.users where id::text like 'ab157000-%'),
      'items',(select count(*) from public.items where id::text like 'ab157000-%'),
      'backends',(select count(*) from pg_stat_activity where application_name like 'kajo_taste_%'));`,'reserved-scope');
    assert.deepEqual(reserved,{users:0,items:0,backends:0});
    const [tables]=await exec(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth');`,'canonical-tables');
    snapshots=`select jsonb_object_agg(name,value) from (${tables.map(name=>`select '${name}' name,
      encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value from ${name} r`).join(' union all ')}) s;`;
    [original]=await exec(snapshots,'canonical-before');
    fixture=true;await exec(`begin;${await personalTasteSessionFixtureSql()}commit;`,'fixture');
    const [profile]=await exec(`select to_jsonb(id) from public.profiles where owner_user_id='${actor}' and profile_type='PERSONAL';`,'profile');
    const rpc=request=>`public.taste_session_v1(${literal(request)})`;
    const start={operation:'START',profileId:profile,requestId:randomUUID()};
    const [s,replayed,startLock]=await pair('start',rpc(start),rpc(start));assert.deepEqual(s,replayed);
    const answer={operation:'ANSWER',profileId:profile,sessionId:s.sessionId,requestId:randomUUID(),expectedRevision:s.revision,
      questionIndex:0,answer:{kind:'RATING',value:0}};
    const [rated,retry,retryLock]=await pair('retry',rpc(answer),rpc(answer));assert.deepEqual(rated,retry);
    const first={...answer,requestId:randomUUID(),expectedRevision:rated.revision,questionIndex:1,answer:{kind:'RATING',value:5}};
    const second={...first,requestId:randomUUID(),answer:{kind:'UNKNOWN'}};
    const [advanced,conflict,conflictLock]=await pair('conflict',rpc(first),rpc(second),'40001');assert.equal(conflict.sqlstate,'40001');
    const [job]=await exec(`select to_jsonb(source_job_id) from private.taste_sessions where id='${s.sessionId}';`,'source-job');
    const [removed,afterRemoval,removalLock]=await pair('remove',`public.remove_profile_import_job_v1('${job}'::uuid)`,rpc(first));
    assert.equal(removed.status,'REMOVED');assert.equal(afterRemoval.status,'REMOVED');
    const [state]=await exec(`select jsonb_build_object('active',(select count(*) from private.profile_bootstrap_evidence where source_job_id='${job}' and active),
      'copies',(select count(*) from private.taste_session_commands where session_id='${s.sessionId}'),
      'catalog',(select catalog from private.taste_sessions where id='${s.sessionId}'));`,'removal-state');
    assert.deepEqual(state,{active:0,copies:0,catalog:[]});assert.equal(advanced.revision,rated.revision+1);
    return {status:'PASS',sameRequest:'EXACTLY_ONCE',staleRevision:'40001',sourceRemoval:'NO_REPLAY_OR_REACTIVATION',
      independentLockProofs:[startLock,retryLock,conflictLock,removalLock]};
  }finally{
    for(const s of running)if(!s.done){await release(s);await s.promise;}
    if(fixture){
      await exec(`begin;delete from auth.users where id::text like 'ab157000-%';
        delete from private.item_sources where item_id::text like 'ab157000-%';
        delete from public.items where id::text like 'ab157000-%';commit;`,'cleanup');
      assert.deepEqual((await exec(snapshots,'canonical-after'))[0],original,'Taste concurrency fixture changed retained canonical state');
    }
  }
}
