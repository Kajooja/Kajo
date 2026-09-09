-- Caller owns the transaction; the local installation probe always rolls back.
-- Deliberately no OR REPLACE: an unexpected pre-existing probe function fails.
create function public.kajo_default_acl_probe() returns integer
language sql security definer set search_path = '' as $$ select 1 $$;
create function private.kajo_default_acl_probe() returns integer
language sql security definer set search_path = '' as $$ select 1 $$;

do $defaults$
declare signature text; caller text;
begin
  foreach signature in array array['public.kajo_default_acl_probe()', 'private.kajo_default_acl_probe()'] loop
    foreach caller in array array['anon', 'authenticated', 'service_role'] loop
      if has_function_privilege(caller, signature, 'execute') then
        raise exception 'Future function % is callable by % without an explicit grant', signature, caller;
      end if;
    end loop;
  end loop;
end;
$defaults$;

set local role anon;
do $denied$
begin
  begin
    perform public.kajo_default_acl_probe();
    raise exception 'Anonymous execution unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$denied$;
reset role;

grant execute on function public.kajo_default_acl_probe() to authenticated;
set local role authenticated;
do $allowed$
begin
  if public.kajo_default_acl_probe() <> 1 then
    raise exception 'Explicit authenticated grant did not enable execution';
  end if;
end;
$allowed$;
reset role;
drop function public.kajo_default_acl_probe();
drop function private.kajo_default_acl_probe();
