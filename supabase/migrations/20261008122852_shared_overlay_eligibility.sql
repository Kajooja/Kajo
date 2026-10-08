-- Preserve the overlay's history/proposal rows while preventing discovery from
-- reintroducing Items rejected by Shared state or withdrawn from the catalogue.
do $shared_overlay_eligibility$
declare
  target regprocedure := 'private.get_shared_discovery_overlay(uuid,text)'::regprocedure;
  definition text;
  source text;
  old_expression text := $old$    coalesce(shared_interaction.consumed, false)
      or shared_interaction.rating is not null,$old$;
  new_expression text := $new$    not coalesce(item.discoverable, false)
      or coalesce(shared_interaction.not_interested, false)
      or coalesce(shared_interaction.consumed, false)
      or shared_interaction.rating is not null,$new$;
begin
  select pg_get_functiondef(p.oid), p.prosrc into strict definition, source
    from pg_proc p where p.oid = target;
  if md5(source) <> 'ffdbb9d3c1291d3cf58f0ad89e82fd95'
     or (length(source) - length(replace(source, old_expression, ''))) / length(old_expression) <> 1 then
    raise exception 'Shared overlay eligibility forward: unexpected source';
  end if;
  -- CREATE OR REPLACE retains the existing function identity, owner and grants.
  execute replace(definition, old_expression, new_expression);
end;
$shared_overlay_eligibility$;
