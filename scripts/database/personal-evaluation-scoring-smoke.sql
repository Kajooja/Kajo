set local request.jwt.claim.sub='ab157000-0000-4000-8000-000000000001';
do $evaluation$
declare profile uuid; result jsonb; frozen private.prediction_runs;
begin
  select id into strict profile from public.profiles where owner_user_id=auth.uid() and profile_type='PERSONAL';
  result:=private.capture_personal_evaluation_v1(gen_random_uuid(),profile,
    array['ab157000-0000-4000-8000-000000000101','ab157000-0000-4000-8000-000000000121']::uuid[],now()-interval '1 second');
  if jsonb_array_length(result->'items')<>2
    or exists(select 1 from jsonb_array_elements(result->'items') i where i->>'status'<>'AVAILABLE') then
    raise exception 'Requested canonical BOOK/MOVIE pool is incomplete';
  end if;
  select * into strict frozen from private.prediction_runs where id=(result->>'predictionId')::uuid;
  if frozen.requested_at<>now() or frozen.candidate_count<>2 or frozen.result_count<>0
    or frozen.state_snapshot#>>'{evaluationInput,scope}'<>'REQUESTED_CANDIDATES'
    or exists(select 1 from private.prediction_candidates where prediction_id=frozen.id and selected_for_delivery) then
    raise exception 'Evaluation cutoff/scope/delivery invariant failed';
  end if;
  begin
    perform private.capture_personal_evaluation_v1(gen_random_uuid(),profile,
      array['ab157000-0000-4000-8000-000000000101']::uuid[],clock_timestamp());
    raise exception 'Uncommitted answer cutoff was accepted';
  exception when serialization_failure then null;
  end;
  if exists(select 1 from public.events) then raise exception 'Evaluation fabricated Events';end if;
end;
$evaluation$;
select jsonb_build_object('personalEvaluation','PASS: canonical explicit BOOK/MOVIE pool, committed cutoff, frozen non-delivery capture') as snapshot;
