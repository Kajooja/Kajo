import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';
import { personalEvaluationSmokeSql } from './personal-evaluation-scoring.mjs';

const owner='ab157000-0000-4000-8000-000000000001',other='ab157000-0000-4000-8000-000000000002';
const id=n=>`ab157000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const changed=new Set(['rank_items_v0','rank_items_catalog_base_v1','rank_items_scalar_v1',
  'rank_items_catalog_scalar_v1','rank_items_with_identity_v1','rank_items_catalog_with_identity_v1',
  'rank_items_v1_internal','rank_items_first_page_v1','rank_items_catalog_chain_v1']);
test('canonical explicit-candidate evaluation / complete current schema',async t=>{
  const db=new PGlite();
  const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
  const one=async(sql,args=[])=>(await query(sql,args))[0];
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const {files}=await buildFreshInstallation();
  const index=files.findIndex(f=>f.name.endsWith('_personal_evaluation_scoring.sql'));
  assert.ok(index>0);
  for(const f of files.slice(0,index))await db.exec(`begin;${f.sql}commit;`);
  const setup=async()=>{
    await db.exec(await personalTasteSessionFixtureSql());
    await query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
    return (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'",[owner])).id;
  };
  const rejects=async(fn,pattern)=>{
    await db.exec('savepoint rejection;');let error;try{await fn();}catch(caught){error=caught;}
    await db.exec('rollback to rejection;release rejection;');assert.ok(error,'expected rejection');assert.match(error.message,pattern);
  };
  const capture=async(profile,items=[id(121),id(101)],after='2000-01-01T00:00:00Z',prediction=randomUUID(),context={})=>
    (await one('select private.capture_personal_evaluation_v1($1,$2,$3,$4,$5) value',[prediction,profile,items,after,context])).value;
  const sub=async(name,fn)=>t.test(name,async()=>{
    await db.exec('begin;');try{await fn(await setup());}finally{await db.exec('rollback;');}
  });
  const rowsSnapshot=async()=>{
    const tables=await query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r' and n.nspname in('public','private','auth') order by 1`);
    return Promise.all(tables.map(async({name})=>[name,await query(`select to_jsonb(r) body from ${name} r order by to_jsonb(r)::text`)]));
  };
  const normalized=value=>{
    if(Array.isArray(value))return value.map(normalized);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value)
      .filter(([k])=>!['prediction_id','eligibilityAt'].includes(k)).map(([k,v])=>[k,normalized(v)]));
    return value;
  };
  try{
    await sub('populated forward preserves every row, old metadata and exact normal/catalogue scoring',async profile=>{
      const read=async(name,mode)=>normalized(await query(`select * from private.${name}(${name.includes('catalog')?"'{}',false,":''}$1,$2,null,50,'{}')`,[profile,mode]));
      const expected=[];
      for(const name of ['rank_items_v0','rank_items_scalar_v1','rank_items_catalog_base_v1','rank_items_catalog_scalar_v1'])
        for(const mode of ['FOR_YOU','SURPRISE','RISK'])expected.push({name,mode,result:await read(name,mode)});
      await query("select * from private.rank_items_with_identity_v1($1,$2,'FOR_YOU',null,20,'{}')",[randomUUID(),profile]);
      const rows=await rowsSnapshot();
      const functions=await query("select oid,proname,to_jsonb(p) body from pg_proc p where pronamespace in('public'::regnamespace,'private'::regnamespace) order by oid");
      await db.exec(files[index].sql);
      assert.deepEqual(await rowsSnapshot(),rows);
      for(const f of functions){
        const actual=(await one('select to_jsonb(p) body from pg_proc p where oid=$1',[f.oid])).body;
        if(changed.has(f.proname)){delete actual.prosrc;delete f.body.prosrc;}
        assert.deepEqual(actual,f.body,f.proname);
      }
      for(const row of expected)assert.deepEqual(await read(row.name,row.mode),row.result,`${row.name}/${row.mode}`);
    });
    await t.test('unknown upstream function drift aborts extraction atomically',async()=>{
      await db.exec('begin;');try{
        const f=await one("select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid='private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure");
        await db.exec(f.definition.replace(f.prosrc,()=>f.prosrc+'\n-- unknown drift'));
        await rejects(()=>db.exec(files[index].sql),/source drift/);
        assert.equal((await one("select to_regprocedure('private.capture_personal_evaluation_v1(uuid,uuid,uuid[],timestamptz,jsonb)') value")).value,null);
      }finally{await db.exec('rollback;');}
    });
    for(const f of files.slice(index))await db.exec(`begin;${f.sql}commit;`);
    await t.test('native rollback smoke covers canonical requested pool and no delivery',async()=>{
      const results=(await db.exec(await personalEvaluationSmokeSql())).flatMap(r=>r.rows);
      assert.match(results[0].snapshot.personalEvaluation,/^PASS:/);
      assert.equal((await one('select count(*)::int n from auth.users')).n,0);
    });
    await sub('a domain outside the global top 50 receives actual canonical scores',async profile=>{
      await db.exec(`insert into public.items(id,item_type,title,tags,metadata)
        select ('ab157000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'MOVIE','Evaluation distractor '||n,
          array['dominant'],'{}' from generate_series(500,559) n;
        insert into private.item_sources(item_id,provider_key,provider_item_id)
          select id,'kajo_curated',id::text from public.items where title like 'Evaluation distractor %';
        insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at)
          select gen_random_uuid(),'${owner}','${profile}',id,item_type,'ITEM_RATED','{"rating":10}',now()-interval '1 hour'
          from public.items where title='Evaluation distractor 500';`);
      const ordinary=await query("select * from private.rank_items_with_identity_v1($1,$2,'FOR_YOU',null,50,'{}')",[randomUUID(),profile]);
      assert.equal(ordinary.length,50);assert.ok(ordinary.every(i=>i.item_type==='MOVIE'),'old global-pool defect must reproduce');
      const result=await capture(profile,[id(121),id(122),id(501)]);
      assert.deepEqual(result.items.map(i=>i.status),['AVAILABLE','AVAILABLE','AVAILABLE']);
      assert.deepEqual(result.items.map(i=>i.itemType),['BOOK','BOOK','MOVIE']);
      assert.deepEqual(result.items[0].features,{version:'canonical-item-tags-v1',itemType:'BOOK',tags:['taste-1','shared-feature']});
      const frozen=await query('select * from private.prediction_candidates where prediction_id=$1',[result.predictionId]);
      assert.equal(frozen.length,3);assert.ok(frozen.every(c=>!c.selected_for_delivery));
      for(const i of result.items)assert.equal(i.score,frozen.find(c=>c.item_id===i.itemId).final_score);
      const byDomain=await query("select * from private.rank_items_with_identity_v1($1,$2,'FOR_YOU','BOOK',50,'{}')",[randomUUID(),profile]);
      for(const i of result.items.filter(i=>i.itemType==='BOOK'))assert.equal(i.score,byDomain.find(c=>c.item_id===i.itemId).score);
      const run=await one('select * from private.prediction_runs where id=$1',[result.predictionId]);
      assert.equal(run.result_count,0);assert.equal(run.candidate_count,3);
      assert.deepEqual(run.state_snapshot.evaluationInput.candidateIds,[id(121),id(122),id(501)]);
    });
    await sub('missing, withdrawn, mock-only and suppressed Items stay unavailable',async profile=>{
      await query('update public.items set discoverable=false where id=$1',[id(121)]);
      await query('delete from private.item_sources where item_id=$1',[id(122)]);
      await query("insert into private.item_sources(item_id,provider_key,provider_item_id) values($1,'kajo_mock','mock-evaluation')",[id(122)]);
      await query('insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed) values($1,$2,$3,true)',[profile,id(123),owner]);
      const r=await capture(profile,[randomUUID(),id(121),id(122),id(123),id(124)]);
      assert.deepEqual(r.items.map(i=>i.status),['UNAVAILABLE','UNAVAILABLE','UNAVAILABLE','UNAVAILABLE','AVAILABLE']);
      assert.ok(r.items.slice(0,4).every(i=>i.score===null&&i.rank===null));assert.equal(r.items[3].reason,'SUPPRESSED');
      assert.equal((await one('select count(*)::int n from public.events')).n,0);
    });
    await sub('owner scope, bounded arguments, private ACLs and cutoff guards precede capture',async profile=>{
      for(const role of ['anon','authenticated','service_role']){
        const funcs=await query("select oid from pg_proc where pronamespace='private'::regnamespace and (proname like 'rank_items_candidate_%' or proname='capture_personal_evaluation_v1')");
        assert.equal(funcs.length,4);
        for(const f of funcs)assert.equal((await one("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,f.oid])).allowed,false);
      }
      for(const actor of [other,'']){
        await query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
        await rejects(()=>capture(profile),/owner access/);
      }
      await query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
      const shared=(await one("insert into public.profiles(profile_type,name) values('SHARED','Evaluation shared') returning id")).id;
      await rejects(()=>capture(shared),/owner access/);
      for(const items of [null,[],[id(121),id(121)],[null],Array.from({length:51},()=>randomUUID()),[[id(121)],[id(122)]]])
        await rejects(()=>capture(profile,items),/distinct Item/);
      for(const cutoff of [null,'infinity',(await one('select now() value')).value,'2999-01-01'])
        await rejects(()=>capture(profile,undefined,cutoff),/Commit the required answer/);
      await rejects(()=>capture(profile,undefined,undefined,null),/Prediction id/);
      assert.equal((await one('select count(*)::int n from private.prediction_runs')).n,0);
    });
    await sub('frozen runs cannot become delivery or be rewritten, and canonical source erasure removes them',async profile=>{
      const r=await capture(profile);const before=await query('select to_jsonb(c) body from private.prediction_candidates c where prediction_id=$1',[r.predictionId]);
      await query("update public.items set tags=array['later-feature'] where id=any($1)",[r.items.map(i=>i.itemId)]);
      assert.deepEqual(await query('select to_jsonb(c) body from private.prediction_candidates c where prediction_id=$1',[r.predictionId]),before);
      await rejects(async()=>{
        await db.exec('set local role authenticated;');
        await query('update private.prediction_candidates set final_score=99 where prediction_id=$1',[r.predictionId]);
      },/permission denied/);
      await rejects(()=>capture(profile,undefined,undefined,r.predictionId),/duplicate key/);
      await query("select private.erase_prediction_sources_v1('PREDICTION_RUN',$1)",[r.predictionId]);
      assert.equal((await one('select count(*)::int n from private.prediction_candidates where prediction_id=$1',[r.predictionId])).n,0);
    });
    await t.test('committed numeric Taste prefixes match Discovery at the same native-evidence cutoff without changing frozen forecasts or another Profile',async()=>{
      await db.exec('begin;');const profile=await setup();
      const otherProfile=(await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'",[other])).id;
      const start=(await one('select public.taste_session_v1($1) value',[{operation:'START',profileId:profile,requestId:randomUUID()}])).value;
      const sessionId=start.sessionId;
      const startTime=(await one('select updated_at::text value from private.taste_sessions where id=$1',[sessionId])).value;
      await db.exec('commit;begin;');await query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
      const targets=await query(`select candidate.id,candidate.item_type from public.items candidate join public.items answered on answered.id=$1
        where candidate.id<>answered.id and candidate.item_type=answered.item_type and candidate.tags=answered.tags
        order by candidate.id limit 2`,[start.presentations[0].objectId]);
      assert.equal(targets.length,2,'two same-domain, same-tag continuation fixtures are required');
      const ids=targets.map(item=>item.id),domain=targets[0].item_type;
      const captureWithDiscoveryParity=async(targetProfile,requiredAfter)=>{
        const result=await capture(targetProfile,ids,requiredAfter);
        const discoveryId=randomUUID();
        const discovery=await query("select * from private.rank_items_with_identity_v1($1,$2,'FOR_YOU',$3,50,'{}')",
          [discoveryId,targetProfile,domain]);
        const identity=await one(`select profile_id=$2::uuid same_profile,
          requested_item_type=$3 same_domain from private.prediction_runs where id=$1`,
          [discoveryId,targetProfile,domain]);
        assert.deepEqual(identity,{same_profile:true,same_domain:true});
        const discoveryCandidates=await query('select item_id,explanation from private.prediction_candidates where prediction_id=$1',[discoveryId]);
        for(const item of result.items){
          assert.equal(item.status,'AVAILABLE');
          assert.equal(item.itemType,domain);
          // Ordinary Discovery's run envelope uses clock_timestamp(); its native
          // evidence reader and evaluation share now() within this transaction.
          // This is local explicit-answer parity, not whole-state/asOf parity.
          assert.equal(discoveryCandidates.find(candidate=>candidate.item_id===item.itemId)
            ?.explanation.scoringFeatures.nativeEvidenceAsOf,result.evidenceCutoff);
          assert.equal(item.score,discovery.find(candidate=>candidate.item_id===item.itemId)?.score,
            'evaluation and overlapping Discovery candidate must have the exact same score');
        }
        return result;
      };
      const first=await captureWithDiscoveryParity(profile,startTime);
      const firstFrozen=await query('select to_jsonb(c) body from private.prediction_candidates c where prediction_id=$1 order by item_id',[first.predictionId]);
      await query("select set_config('request.jwt.claim.sub',$1,true)",[other]);
      const otherFirst=await captureWithDiscoveryParity(otherProfile,startTime);
      const otherScores=otherFirst.items.map(item=>item.score);
      await db.exec('commit;');
      let state=start;
      const traces=new Map(),scores=new Map();
      // These are synthetic local fixtures and committed corrections to one
      // explicit answer, not population neighbors or predictive-quality evidence.
      for(const value of [10,0,5,4,9]){
        await db.exec('begin;');await query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
        state=(await one('select public.taste_session_v1($1) value',[{operation:'ANSWER',profileId:profile,sessionId,
          requestId:randomUUID(),expectedRevision:state.revision,questionIndex:0,answer:{kind:'RATING',value}}])).value;
        const receiptTime=(await one('select updated_at::text value from private.taste_sessions where id=$1',[sessionId])).value;
        await rejects(()=>capture(profile,ids,receiptTime),/Commit the required answer/);
        await db.exec('commit;begin;');await query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
        const later=await captureWithDiscoveryParity(profile,receiptTime);
        const candidates=await query('select explanation from private.prediction_candidates where prediction_id=$1 order by item_id',[later.predictionId]);
        assert.ok(new Date(later.evidenceCutoff)>new Date(receiptTime));
        for(const {explanation} of candidates){
          assert.equal(explanation.scoringFeatures.nativeEvidenceAsOf,later.evidenceCutoff);
          assert.equal(explanation.candidatePool.eligibilityAt,later.evidenceCutoff);
        }
        traces.set(value,candidates.map(candidate=>candidate.explanation.bootstrapLongTerm));
        scores.set(value,later.items.map(item=>item.score));
        await query("select set_config('request.jwt.claim.sub',$1,true)",[other]);
        const otherLater=await captureWithDiscoveryParity(otherProfile,receiptTime);
        assert.deepEqual(otherLater.items.map(item=>item.score),otherScores,'Personal answer must not affect another Profile');
        assert.deepEqual(await query('select to_jsonb(c) body from private.prediction_candidates c where prediction_id=$1 order by item_id',[first.predictionId]),firstFrozen);
        await db.exec('commit;');
      }
      assert.ok(traces.get(10).every(value=>value>0));assert.ok(traces.get(0).every(value=>value<0));
      assert.ok(traces.get(5).every(value=>value===0));
      assert.ok(traces.get(4).every(value=>value<0));assert.ok(traces.get(9).every(value=>value>0));
      for(let i=0;i<ids.length;i++){
        assert.ok(scores.get(4)[i]<first.items[i].score,'rating 4 must lower each same-tag continuation score');
        assert.ok(scores.get(9)[i]>first.items[i].score,'rating 9 must raise each same-tag continuation score');
        assert.ok(scores.get(9)[i]>scores.get(4)[i],'later scores must distinguish 4 from 9');
      }
    });
  }finally{await db.close();}
});
