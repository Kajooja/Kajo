-- Maintenance actors are synthetic. Existing SQL serving/response/capture
-- producers supply these artifacts; the fixture makes no native quality claim.
create temp table prediction_input_fixture(
  round_id uuid,n_round_id uuid,source_capture_id uuid,comparison_id uuid
) on commit drop;
create function pg_temp.input_capture(actor uuid,capture uuid,profile uuid,round uuid,
  revision integer,sources uuid[] default '{}') returns jsonb language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  return private.capture_shared_round_prediction_input_v1(capture,profile,round,revision,sources);
end; $$;
create function pg_temp.input_open(actor uuid,profile uuid,item uuid,round uuid default gen_random_uuid())
returns uuid language plpgsql as $$ begin
  perform pg_temp.outcome_commit(actor,pg_temp.outcome_command(actor,profile,round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
  return round;
end; $$;
do $input_fixture$ declare f record;c record; source_id uuid := 'a232f100-0000-4000-8000-000000000050';
  comparison_id uuid := 'a232f100-0000-4000-8000-000000000051';
  round_id uuid := 'a232f100-0000-4000-8000-000000000030';
  n_round_id uuid := 'a232f100-0000-4000-8000-000000000031';
begin
  select * into strict f from pg_temp.outcome_fixture;select * into strict c from pg_temp.capture_fixture;
  perform private.capture_shared_rating_round_outcome_v1(source_id,f.pair,c.round_id,
    c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds');
  perform private.compare_shared_round_outcome_capture_v1(comparison_id,source_id,c.genome_id,c.window_id);
  perform pg_temp.input_open(f.actor,f.pair,f.movie,round_id);
  perform pg_temp.input_open(f.actor,f.multi,f.book,n_round_id);
  insert into pg_temp.prediction_input_fixture values(round_id,n_round_id,source_id,comparison_id);
end; $input_fixture$;
