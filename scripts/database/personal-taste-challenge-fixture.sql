-- Complete genuine issued training opportunities through the public boundary.
set local request.jwt.claim.sub='ab157000-0000-4000-8000-000000000001';
set local role authenticated;
do $training$
declare profile uuid; s jsonb; n integer:=0;
begin
  select id into strict profile from public.profiles where owner_user_id=auth.uid() and profile_type='PERSONAL';
  s:=public.taste_session_v1(jsonb_build_object('operation','START','profileId',profile,'requestId',gen_random_uuid()));
  while s->>'status'='ACTIVE' loop
    if s#>>'{selection,decision,kind}'='TRANSITION' then
      s:=public.taste_session_v1(jsonb_build_object('operation','ACK_TRANSITION','profileId',profile,'sessionId',s->'sessionId',
        'requestId',gen_random_uuid(),'expectedRevision',s->'revision'));
    else
      s:=public.taste_session_v1(jsonb_build_object('operation','ANSWER','profileId',profile,'sessionId',s->'sessionId',
        'requestId',gen_random_uuid(),'expectedRevision',s->'revision','questionIndex',jsonb_array_length(s->'presentations')-1,
        'answer',case when n<8 then jsonb_build_object('kind','RATING','value',case when n%3=0 then 0 else 8 end)
          else jsonb_build_object('kind','UNKNOWN') end));
      n:=n+1;
    end if;
    if n>24 then raise exception 'Training fixture did not stop';end if;
  end loop;
  if n<>20 then raise exception 'Unexpected training opportunity count %',n;end if;
end;$training$;
set local role postgres;
