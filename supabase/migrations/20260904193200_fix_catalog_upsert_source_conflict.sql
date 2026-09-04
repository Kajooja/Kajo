-- Forward fix for hosted catalog_provider_foundation.
--
-- PL/pgSQL treats the column names in ON CONFLICT (provider_key,
-- provider_item_id) as ambiguous because the upsert function has parameters
-- with the same names. Use the already-defined unique constraint explicitly.

do $$
declare
  function_oid oid;
  function_definition text;
  expected_fragment text :=
    'on conflict (provider_key, provider_item_id) do update';
  replacement_fragment text :=
    'on conflict on constraint item_sources_provider_item_unique do update';
begin
  select p.oid
  into function_oid
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'upsert_catalog_item_v1'
    and pg_get_function_identity_arguments(p.oid) =
      'provider_key text, provider_item_id text, item_type text, title text, description text, tags text[], metadata jsonb, creators text[], release_year integer, image_url text, original_language text, external_ids jsonb, source_url text, source_updated_at timestamp with time zone, source_hash text, source_payload jsonb, discoverable boolean';

  if function_oid is null then
    raise exception 'Expected public.upsert_catalog_item_v1 signature was not found';
  end if;

  function_definition := pg_get_functiondef(function_oid);

  if position(expected_fragment in function_definition) = 0 then
    raise exception 'Expected ambiguous catalog source conflict target was not found';
  end if;

  execute replace(
    function_definition,
    expected_fragment,
    replacement_fragment
  );
end;
$$;
