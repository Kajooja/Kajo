set local role authenticated;
do $challenge$
declare profile uuid; session uuid; c jsonb; request jsonb; initial jsonb; item jsonb;
begin
  select id into strict profile from public.profiles where owner_user_id=auth.uid() and profile_type='PERSONAL';
  -- The fixture's START is an authorized resume, with no new source allocation.
  session:=(public.taste_session_v1(jsonb_build_object('operation','START','profileId',profile,'requestId',gen_random_uuid()))->>'sessionId')::uuid;
  request:=jsonb_build_object('operation','START','profileId',profile,'sessionId',session,'requestId',gen_random_uuid());
  c:=public.taste_challenge_v1(request);initial:=c;
  if c->>'status'<>'ACTIVE' or jsonb_array_length(c->'items')<>6 or c->'forecasts'<>'null'::jsonb then
    raise exception 'Challenge freeze/withholding failed';end if;
  if public.taste_challenge_v1(request)<>c then raise exception 'Challenge START retry differs';end if;
  for item in select value from jsonb_array_elements(c->'items') loop
    c:=public.taste_challenge_v1(jsonb_build_object('operation','ANSWER','profileId',profile,'sessionId',session,'challengeId',c->'challengeId',
      'requestId',gen_random_uuid(),'expectedRevision',c->'revision','itemId',item->'id',
      'answer',jsonb_build_object('kind','RATING','value',case when c->>'revision'='0' then 0 else 5 end)));
  end loop;
  if c->>'status'<>'COMPLETE' or c->'frozen'<>initial->'frozen' or c#>>'{metric,knownRatings}'<>'6'
    or c#>'{metric,accuracyPercent}'<>'null'::jsonb or c->>'learningAdmission'<>'EVALUATION_ONLY' then
    raise exception 'Challenge frozen evaluation failed';end if;
  c:=public.taste_challenge_v1(jsonb_build_object('operation','REMOVE','profileId',profile,'sessionId',session,'challengeId',c->'challengeId',
    'requestId',gen_random_uuid(),'expectedRevision',c->'revision'));
  if c->>'status'<>'REMOVED' or public.taste_challenge_v1(request)->>'status'<>'REMOVED' then
    raise exception 'Removed challenge replay resurrected answers';end if;
end;$challenge$;
set local role postgres;
select jsonb_build_object('personalTasteChallenge','PASS: canonical pre-answer freeze, ordinal evaluation, retry and removal') snapshot;
