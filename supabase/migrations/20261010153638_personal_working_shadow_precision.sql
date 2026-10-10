-- Keep frozen Working comparison float8 values exact across JSON serialization.
-- CLI 2.117.0 generated this forward; all 71 earlier migrations are immutable.
-- Only the serializer's function-local configuration changes. Existing rows,
-- scorer/body/identity/owner/ACL and both captured-source generations stay intact.
do $working_precision_preflight$
declare current_function record;
begin
  select p.prosrc,p.proconfig,p.prosecdef,p.provolatile,p.prorettype,p.prolang
    into strict current_function from pg_catalog.pg_proc p
    where p.oid='private.record_personal_working_shadow_v1(uuid,text)'::regprocedure;
  if pg_catalog.md5(current_function.prosrc) is distinct from '0f13cc96568e3fc72d944c62ef27340e'
    or current_function.proconfig is distinct from array['search_path=""']::text[]
    or current_function.prosecdef
    or current_function.provolatile is distinct from 'v'::"char"
    or current_function.prorettype is distinct from 'jsonb'::regtype
    or current_function.prolang is distinct from
      (select l.oid from pg_catalog.pg_language l where l.lanname='plpgsql') then
    raise exception 'Personal working precision approved source/config is unavailable' using errcode='55000';
  end if;
end;
$working_precision_preflight$;

-- Decimal JSON must round-trip to the same binary score as the frozen source.
-- Function-local SET restores the caller's setting on return, including retries.
alter function private.record_personal_working_shadow_v1(uuid,text)
  set extra_float_digits = '3';
