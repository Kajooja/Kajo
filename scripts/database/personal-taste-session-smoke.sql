do $taste$
declare profile uuid;s jsonb;request jsonb;old_result jsonb;first_item uuid;i integer;
begin
  select id into strict profile from public.profiles where owner_user_id='ab157000-0000-4000-8000-000000000001' and profile_type='PERSONAL';
  perform set_config('request.jwt.claim.sub','ab157000-0000-4000-8000-000000000001',true);
  perform set_config('role','authenticated',true);
  request:=jsonb_build_object('operation','START','profileId',profile,'requestId',gen_random_uuid());
  s:=public.taste_session_v1(request);
  if s#>>'{selection,decision,kind}'<>'QUESTION' or s#>>'{currentItem,itemType}'<>'MOVIE' then raise exception 'Taste initial question missing';end if;
  if public.taste_session_v1(request)<>s then raise exception 'Taste START retry differs';end if;
  first_item:=(s#>>'{currentItem,id}')::uuid;
  request:=jsonb_build_object('operation','ANSWER','profileId',profile,'sessionId',s->'sessionId','requestId',gen_random_uuid(),
    'expectedRevision',s->'revision','questionIndex',0,'answer',jsonb_build_object('kind','RATING','value',0));
  s:=public.taste_session_v1(request);old_result:=s;
  if public.taste_session_v1(request)<>s then raise exception 'Taste ANSWER retry differs';end if;
  for i in 1..19 loop
    if s#>>'{selection,decision,kind}'='TRANSITION' then
      s:=public.taste_session_v1(jsonb_build_object('operation','ACK_TRANSITION','profileId',profile,'sessionId',s->'sessionId',
        'requestId',gen_random_uuid(),'expectedRevision',s->'revision'));
    end if;
    s:=public.taste_session_v1(jsonb_build_object('operation','ANSWER','profileId',profile,'sessionId',s->'sessionId',
      'requestId',gen_random_uuid(),'expectedRevision',s->'revision','questionIndex',i,'answer',jsonb_build_object('kind','RATING','value',i%11)));
  end loop;
  if s#>>'{selection,decision,reason}'<>'SUFFICIENT_RESPONSES' or s#>>'{selection,counts,knownRatings}'<>'20' then
    raise exception 'Taste bounded completion missing';end if;
  if public.taste_session_v1(request)<>old_result then raise exception 'Taste later retry is not frozen';end if;
  perform set_config('role','postgres',true);
  if not exists(select 1 from private.profile_bootstrap_evidence where profile_id=profile and item_id=first_item
    and rating=0 and active and source_metadata->>'source'='TASTE_TEST') then raise exception 'Taste zero/provenance lost';end if;
  if exists(select 1 from public.events where profile_id=profile) then raise exception 'Taste invented native Events';end if;
  perform set_config('role','authenticated',true);
  s:=public.taste_session_v1(jsonb_build_object('operation','REMOVE','profileId',profile,'sessionId',s->'sessionId',
    'requestId',gen_random_uuid(),'expectedRevision',s->'revision'));
  if public.taste_session_v1(request)->>'status'<>'REMOVED' then raise exception 'Removed Taste retry resurrected data';end if;
  perform set_config('role','postgres',true);
  if exists(select 1 from private.profile_bootstrap_evidence where profile_id=profile and active)
    or exists(select 1 from private.taste_session_commands where session_id=(s->>'sessionId')::uuid) then
    raise exception 'Taste removal retained active evidence/receipt copies';end if;
exception when others then perform set_config('role','postgres',true);raise;
end;$taste$;
select jsonb_build_object('personalTasteSession','PASS: own durable Taste, frozen retries, zero bootstrap, stages and removal') snapshot;
