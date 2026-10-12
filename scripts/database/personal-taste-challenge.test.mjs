import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteChallengeFixtureSql,personalTasteChallengeSmokeSql } from './personal-taste-challenge.mjs';
import { verifyPersonalTasteChallengeConcurrency } from './personal-taste-challenge-concurrency.mjs';
import { runIsolatedSqlProbe } from './ci-supabase-stack.mjs';

const owner='ab157000-0000-4000-8000-000000000001',other='ab157000-0000-4000-8000-000000000002';
test('challenge native lock probes reach the actual SQL runner and clean their owned fixture on failure',async()=>{
  const stages=[];let reached=false;
  await assert.rejects(verifyPersonalTasteChallengeConcurrency((sql,options)=>runIsolatedSqlProbe(()=>{
    stages.push(options.stage);
    if(sql.includes("set local application_name='kajo_challenge_start_holder'")){
      reached=true;throw new Error('simulated native connection failure');
    }
    const results={
      'challenge-reserved-scope':{users:0,items:0,backends:0},'challenge-canonical-tables':['public.profiles'],
      'challenge-canonical-before':{'public.profiles':'unchanged'},'challenge-canonical-after':{'public.profiles':'unchanged'},
      'challenge-profile':'ab157000-0000-4000-8000-000000000010','challenge-training':{id:randomUUID()},
      'challenge-observe-owned-lock':null,
    };
    if(options.stage in results)return JSON.stringify(results[options.stage]);
    assert.ok(['challenge-fixture','challenge-cleanup'].includes(options.stage));return '';
  },'disposable-test-container',sql,options)),/simulated native connection failure/);
  assert.equal(reached,true);assert.ok(stages.includes('challenge-cleanup'));assert.equal(stages.at(-1),'challenge-canonical-after');
});
test('own Personal frozen Taste challenge / full current schema',async t=>{
  const db=new PGlite();
  const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const {files}=await buildFreshInstallation();
  const index=files.findIndex(f=>f.name.endsWith('_personal_taste_challenge.sql'));
  assert.ok(index>0);
  for(const f of files.slice(0,index))await db.exec(`begin;${f.sql}commit;`);
  const rpc=async(request,actor=owner,role='authenticated')=>{
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor??'']);await db.exec(`set local role ${role};`);
    const out=(await query('select public.taste_challenge_v1($1) value',[request]))[0].value;
    await db.exec('set local role postgres;');return out;
  };
  const rejects=async(fn,pattern)=>{
    await db.exec('savepoint rejection;');let error;try{await fn();}catch(caught){error=caught;}
    await db.exec('rollback to rejection;release rejection;');assert.ok(error,'expected rejection');assert.match(error.message,pattern);
  };
  const sub=async(name,fn)=>t.test(name,async()=>{
    await db.exec('begin;');
    try{
      await db.exec(await personalTasteChallengeFixtureSql());
      const s=(await query('select * from private.taste_sessions'))[0];
      const startRequest={operation:'START',profileId:s.profile_id,sessionId:s.id,requestId:randomUUID()};
      const start=()=>rpc(startRequest);
      const command=(c,operation,extra={})=>({operation,profileId:s.profile_id,sessionId:s.id,challengeId:c.challengeId,
        requestId:randomUUID(),expectedRevision:c.revision,...extra});
      const answer=(c,item=c.items[c.revision],value=5,kind='RATING')=>rpc(command(c,'ANSWER',{
        itemId:item.id,answer:kind==='RATING'?{kind,value}:{kind}}));
      const resume=c=>rpc({operation:'RESUME',profileId:s.profile_id,sessionId:s.id,challengeId:c.challengeId});
      await fn({s,start,startRequest,command,answer,resume});
    }finally{await db.exec('rollback;');}
  });
  try{
    await t.test('populated forward preserves existing rows, function identities, bodies and ACLs',async()=>{
      await db.exec('begin;');
      try{
        await db.exec(await personalTasteChallengeFixtureSql());
        const tables=await query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where c.relkind='r' and n.nspname in('public','private','auth') order by 1`);
        const rows=await Promise.all(tables.map(async({name})=>[name,await query(`select to_jsonb(r) body from ${name} r order by to_jsonb(r)::text`)]));
        const functions=await query(`select oid,to_jsonb(p) body from pg_proc p where pronamespace in('public'::regnamespace,'private'::regnamespace,'auth'::regnamespace) order by oid`);
        await db.exec(files[index].sql);
        for(const [name,before] of rows)assert.deepEqual(await query(`select to_jsonb(r) body from ${name} r order by to_jsonb(r)::text`),before,name);
        for(const f of functions)assert.deepEqual((await query('select to_jsonb(p) body from pg_proc p where oid=$1',[f.oid]))[0].body,f.body);
      }finally{await db.exec('rollback;');}
    });
    for(const f of files.slice(index))await db.exec(f.sql);
    await t.test('native SQL smoke uses real canonical serving and public commands, with complete rollback',async()=>{
      try{const rows=(await db.exec(await personalTasteChallengeSmokeSql())).flatMap(r=>r.rows);assert.match(rows[0].snapshot.personalTasteChallenge,/^PASS:/);}
      finally{await db.exec('rollback;');}
      assert.equal((await query('select count(*)::int n from auth.users'))[0].n,0);
    });
    await sub('reserves unseen Items before one canonical freeze and withholds scores until completion',async({s,start,startRequest,answer,resume})=>{
      let c=await start();const frozen=c.frozen;
      assert.equal(c.items.length,6);assert.equal(c.forecasts,null);assert.equal(c.metric,null);
      assert.ok(c.items.every(i=>!s.presentations.some(p=>p.objectId===i.id)));
      const stored=(await query('select * from private.taste_challenges'))[0];
      const candidates=await query('select * from private.prediction_candidates where prediction_id=$1',[stored.prediction_id]);
      for(const i of stored.items){
        const p=candidates.find(p=>p.item_id===i.id);assert.ok(p?.selected_for_delivery);
        assert.deepEqual(i.forecast,{status:'AVAILABLE',score:p.final_score,rank:p.final_rank});
      }
      const digest=(await query(`select encode(sha256(convert_to(jsonb_build_object('run',to_jsonb(r),
        'candidates',(select jsonb_agg(to_jsonb(p) order by p.item_id) from private.prediction_candidates p where p.prediction_id=r.id),
        'genomeConfig',(select config from private.predictor_genomes where id=r.genome_id),'holdouts',$2::jsonb)::text,'UTF8')),'hex') value
        from private.prediction_runs r where r.id=$1`,[stored.prediction_id,stored.items]))[0].value;
      assert.equal(frozen.traceDigest,digest,'commitment covers the actual run, full pool, genome and reserved forecasts');
      const before=await query('select to_jsonb(r) body from private.prediction_runs r');
      const evidence=await query('select to_jsonb(b) body from private.profile_bootstrap_evidence b order by id');
      const training=await query('select to_jsonb(s) body from private.taste_sessions s');
      for(let i=0;i<4;i++)assert.deepEqual(await rpc({...startRequest,requestId:randomUUID()}),c);
      while(c.status==='ACTIVE')c=await answer(c,undefined,c.revision===0?0:5);
      assert.deepEqual(c.frozen,frozen);assert.deepEqual(c.forecasts,stored.items);assert.equal(c.metric.knownRatings,6);
      assert.equal(c.metric.accuracyPercent,null);assert.equal(c.metric.ratingError,null);assert.equal(c.metric.qualityAdmitted,false);
      assert.equal(c.answers[0].answer.value,0);assert.equal(c.answers[1].answer.value,5);
      assert.ok(c.answers.every(a=>a.receivedAt>frozen.frozenAt));
      assert.deepEqual(await query('select to_jsonb(r) body from private.prediction_runs r'),before);
      assert.deepEqual(await query('select to_jsonb(b) body from private.profile_bootstrap_evidence b order by id'),evidence);
      assert.deepEqual(await query('select to_jsonb(s) body from private.taste_sessions s'),training);
      assert.equal((await query('select count(*)::int n from public.events'))[0].n,0);
      assert.deepEqual(await resume(c),c);assert.equal(c.learningAdmission,'EVALUATION_ONLY');
    });
    await sub('current authorization, RLS, API permissions and anonymous identity apply before replay',async({start,startRequest,command})=>{
      const c=await start();
      for(const role of ['anon','authenticated','service_role'])for(const table of ['taste_challenges','taste_challenge_commands'])
        assert.equal((await query("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') allowed",[role,`private.${table}`]))[0].allowed,false);
      for(const role of ['anon','service_role'])assert.equal((await query("select has_function_privilege($1,'public.taste_challenge_v1(jsonb)','EXECUTE') allowed",[role]))[0].allowed,false);
      for(const helper of ['taste_challenge_metric_v1(jsonb,jsonb)','guard_taste_challenge_v1()','withdraw_taste_challenge_v1()'])
        assert.equal((await query("select has_function_privilege('authenticated',$1,'EXECUTE') allowed",[`private.${helper}`]))[0].allowed,false);
      await rejects(()=>rpc(startRequest,other),/owner access/);await rejects(()=>rpc(startRequest,null),/Authentication/);
      await rejects(()=>rpc(startRequest,null,'anon'),/permission denied/);
      const shared=(await query("insert into public.profiles(profile_type,name) values('SHARED','Challenge shared') returning id"))[0].id;
      await rejects(()=>rpc({...startRequest,profileId:shared}),/owner access/);
      await db.exec('alter table auth.users add column is_anonymous boolean default false;');
      await query('update auth.users set is_anonymous=true where id=$1',[owner]);
      await rejects(()=>rpc(startRequest),/Anonymous/);
      await rejects(()=>rpc(command(c,'REMOVE')),/Anonymous/);
    });
    await sub('exact retry, CAS and first-answer lock reject conflicting or malformed requests atomically',async({start,startRequest,command,answer,resume})=>{
      let c=await start();const req=command(c,'ANSWER',{itemId:c.items[0].id,answer:{kind:'RATING',value:0}});
      c=await rpc(req);assert.deepEqual(await rpc(req),c);
      await rejects(()=>rpc({...req,answer:{kind:'RATING',value:10}}),/identity conflict/);
      await rejects(()=>rpc({...req,requestId:randomUUID()}),/revision conflict/);
      await rejects(()=>answer(c,c.items[0],10),/already accepted/);
      for(const value of [null,'0',11,-1,2.5])await rejects(()=>answer(c,undefined,value),/rating/);
      for(const bad of [{kind:'RATING',wrong:0},{kind:'UNKNOWN',value:0},{kind:'WITHDRAWN'},{kind:'RATING',value:5,extra:true}])
        await rejects(()=>rpc(command(c,'ANSWER',{itemId:c.items[1].id,answer:bad})),/answer|rating/);
      await rejects(()=>rpc({...startRequest,items:c.items}),/fields/);
      await rejects(()=>rpc(command(c,'ANSWER',{itemId:randomUUID(),answer:{kind:'UNKNOWN'}})),/answer/);
      assert.deepEqual(await resume(c),c);assert.equal((await query('select count(*)::int n from private.taste_challenge_commands'))[0].n,2);
    });
    await sub('later training corrections or catalog features never recompute forecasts or observed score',async({s,start,answer,resume})=>{
      let c=await start();const snapshot=(await query('select frozen,items from private.taste_challenges'))[0];
      await query("select public.taste_session_v1($1)",[{operation:'ANSWER',profileId:s.profile_id,sessionId:s.id,requestId:randomUUID(),
        expectedRevision:s.revision,questionIndex:0,answer:{kind:'RATING',value:10}}]);
      await db.exec("update public.items set tags=array['later-unseen-feature'],metadata='{}' where title like 'Taste fixture %';");
      c=await answer(c,undefined,undefined,'UNKNOWN');
      c=await answer(c,undefined,undefined,'NOT_INTERESTED');
      while(c.status==='ACTIVE')c=await answer(c);
      assert.deepEqual((await query('select frozen,items from private.taste_challenges'))[0],snapshot);
      assert.equal(c.metric.unknown,1);assert.equal(c.metric.notInterested,1);assert.equal(c.metric.knownRatings,4);
      assert.deepEqual(await resume(c),c);
      await rejects(()=>query("update private.taste_challenges set frozen='{}'"),/immutable/);
    });
    await sub('any native evidence excludes holdouts; exhausted catalog is explicit',async({s,start})=>{
      await query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at)
        select gen_random_uuid(),$1,$2,id,item_type,'ITEM_OPENED','{}',clock_timestamp() from public.items where title like 'Taste fixture %'`,[owner,s.profile_id]);
      const c=await start();assert.equal(c.status,'UNAVAILABLE');assert.equal(c.reason,'NO_UNSEEN_HOLDOUTS');
      assert.deepEqual(c.items,[]);assert.equal(c.metric.comparablePairs,0);assert.equal(c.metric.availability,'INSUFFICIENT_COMPARABLE_PAIRS');
    });
    await sub('inactive historical bootstrap excludes an otherwise unseen holdout and incomplete Taste cannot start',async({s,start})=>{
      await query("update private.taste_sessions set status='ACTIVE' where id=$1",[s.id]);
      await rejects(start,/Finish Taste/);
      assert.equal((await query('select count(*)::int n from private.prediction_runs'))[0].n,0);
      await query("update private.taste_sessions set status='STOPPED' where id=$1",[s.id]);
      const item=s.catalog.find(i=>!s.presentations.some(p=>p.objectId===i.id));
      await query(`insert into private.profile_bootstrap_evidence(actor_user_id,profile_id,item_id,item_type,source_provider,dataset_kind,
        source_job_id,source_row_key,evidence_kind,rating,source_occurred_at,imported_at,active,source_metadata)
        values($1,$2,$3::uuid,$4,'KAJO_CALIBRATION','TASTE_SESSION_V1',$5,$3::text,'RATED',0,clock_timestamp(),clock_timestamp(),false,'{}')`,
        [owner,s.profile_id,item.id,item.itemType,s.source_job_id]);
      assert.ok(!(await start()).items.some(i=>i.id===item.id));
    });
    await sub('canonical pool absence is honest missing forecast, never replaced by a proxy',async({start,answer})=>{
      // More highly scored real candidates outside the frozen Taste dictionary.
      await db.exec(`insert into public.items(id,item_type,title,tags,metadata)
        select ('ab157000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'MOVIE','Challenge distractor '||n,
          array['taste-1','shared-feature'],'{"coldStartRecognition":1,"coldStartPriorSource":"KAJO_CURATED_RECOGNITION"}' from generate_series(500,559) n;
        insert into private.item_sources(item_id,provider_key,provider_item_id)
          select id,'kajo_curated',id::text from public.items where title like 'Challenge distractor %';`);
      let c=await start();while(c.status==='ACTIVE')c=await answer(c,undefined,c.revision);
      assert.ok(c.forecasts.some(i=>i.forecast.status==='UNAVAILABLE'));
      assert.ok(c.metric.missingForecastPairs>0);assert.equal(c.metric.accuracyPercent,null);
    });
    await sub('catalog withdrawal blocks stale receipts and new answers while REMOVE remains available',async({start,startRequest,command,answer})=>{
      const c=await start();await query('update public.items set discoverable=false where id=$1',[c.items[0].id]);
      assert.equal((await rpc(startRequest)).status,'CATALOG_UNAVAILABLE');assert.equal((await answer(c)).status,'CATALOG_UNAVAILABLE');
      assert.equal((await rpc(command(c,'REMOVE'))).status,'REMOVED');assert.equal((await rpc(startRequest)).status,'REMOVED');
      assert.deepEqual((await query('select frozen,items,answers from private.taste_challenges'))[0],{frozen:{},items:[],answers:[]});
      assert.equal((await query('select count(*)::int n from private.taste_challenge_commands'))[0].n,0);
    });
    await sub('Taste import removal and source Prediction erasure clear all copied forecasts/answers/retries',async({s,start,startRequest,answer})=>{
      let c=await start();c=await answer(c);
      await db.exec('savepoint retained;');
      await query('select public.remove_profile_import_job_v1($1)',[s.source_job_id]);
      assert.equal((await rpc(startRequest)).status,'REMOVED');
      assert.equal((await query('select count(*)::int n from private.taste_challenge_commands'))[0].n,0);
      await db.exec('rollback to retained;release retained;');
      await query("select private.erase_prediction_sources_v1('PREDICTION_RUN',$1)",[c.frozen.predictionId]);
      assert.equal((await rpc(startRequest)).status,'REMOVED');
      assert.deepEqual((await query('select frozen,items,answers from private.taste_challenges'))[0],{frozen:{},items:[],answers:[]});
      assert.equal((await query('select count(*)::int n from private.taste_challenge_commands'))[0].n,0);
    });
    await sub('account deletion cascades private challenge state without recreating a session',async({start,answer})=>{
      await answer(await start());
      await query("select private.erase_prediction_sources_v1('ACTOR',$1)",[owner]);
      await query('delete from auth.users where id=$1',[owner]);
      assert.equal((await query('select count(*)::int n from private.taste_challenges'))[0].n,0);
      assert.equal((await query('select count(*)::int n from private.taste_challenge_commands'))[0].n,0);
    });
    await t.test('ordinal metric distinguishes dependency, ties, missing predictions and unknown from measured agreement',async()=>{
      const items=[['a','MOVIE',3],['b','MOVIE',2],['c','MOVIE',2],['d','MOVIE',null],['e','BOOK',9],['f','BOOK',8]]
        .map(([id,itemType,score])=>({id,itemType,forecast:score===null?{status:'UNAVAILABLE'}:{status:'AVAILABLE',score}}));
      const answers=[['a',0],['b',5],['c',5],['d',10],['e',0],['f',10]].map(([itemId,value])=>({itemId,answer:{kind:'RATING',value}}));
      const m=(await query('select private.taste_challenge_metric_v1($1,$2) metric',[items,answers]))[0].metric;
      assert.deepEqual([m.ratedPairs,m.missingForecastPairs,m.ratingTiePairs,m.forecastTiePairs,m.comparablePairs,m.concordantPairs,m.discordantPairs],[7,3,1,0,3,0,3]);
      answers[2].answer.value=10;
      const tied=(await query('select private.taste_challenge_metric_v1($1,$2) metric',[items,answers]))[0].metric;
      assert.equal(tied.forecastTiePairs,1);assert.equal(tied.comparablePairs,3);assert.equal(tied.uncertainty,'UNAVAILABLE_SMALL_DEPENDENT_SAMPLE');
    });
  }finally{await db.close();}
});
