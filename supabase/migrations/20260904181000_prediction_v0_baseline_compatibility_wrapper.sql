-- Sprint 013C hygiene: after the canonical scalar scorer is installed, keep
-- Prediction V0 only as a non-serving baseline compatibility boundary.
--
-- This removes the second active copy of the V0.3 scoring formula. Mobile
-- execution remains revoked; Prediction V1 calls private.rank_items_scalar_v1
-- directly and resolves the assigned PredictorGenome.

create or replace function public.rank_items_v0(
  target_profile_id uuid,
  requested_mode text,
  requested_item_type text default null,
  result_limit integer default 20,
  request_context jsonb default '{}'::jsonb
)
returns table (
  prediction_id uuid,
  item_id uuid,
  item_type text,
  title text,
  description text,
  tags text[],
  score double precision,
  confidence double precision,
  rank integer,
  explanation jsonb
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.rank_items_scalar_v1(
    target_profile_id,
    requested_mode,
    requested_item_type,
    result_limit,
    request_context,
    md5('kajo:predictor-genome:prediction-v1-baseline')::uuid
  );
$$;

revoke all on function public.rank_items_v0(uuid, text, text, integer, jsonb)
  from public, anon, authenticated, service_role;
