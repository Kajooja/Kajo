-- Share the current canonical Item/provider availability boundary between V4
-- acquisition and explicit-candidate evaluation. This is not historical catalog
-- reconstruction: current discoverability/content and policy eligibility remain
-- owned by each caller. Ordinary Discovery keeps its existing null-ID policy.
create function private.canonical_item_source_available_v1(target_item_id uuid,cutoff timestamptz)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.items i
    where i.id=target_item_id and isfinite(cutoff)
      and isfinite(i.created_at) and i.created_at<=cutoff
      and exists(select 1 from private.item_sources src
        where src.item_id=i.id and src.provider_key<>'kajo_mock'
          and isfinite(src.created_at) and src.created_at<=cutoff));
$$;
revoke all on function private.canonical_item_source_available_v1(uuid,timestamptz)
  from public,anon,authenticated,service_role;

-- Replace only the reviewed availability predicates. Preserve function identity,
-- grants, settings, score math, V4 selection and all retained session evidence.
do $catalog_source_cutoff$
declare patch record;p record;body text;
begin
  for patch in select * from (values
    ('private.taste_candidate_catalog_v4(uuid,timestamp with time zone)',
      '8c24c01b7351ec7b184ea897607844fd','sql','s',array['search_path=""']::text[],
      $old$    where i.item_type in('BOOK','MOVIE') and i.discoverable and isfinite(i.created_at) and i.created_at<=cutoff
      and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'
        and isfinite(src.created_at) and src.created_at<=cutoff)$old$,
      $new$    where i.item_type in('BOOK','MOVIE') and i.discoverable
      and private.canonical_item_source_available_v1(i.id,cutoff)$new$),
    ('private.rank_items_candidate_base_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb)',
      '72d59b1761a51436b4b307a779e47520','plpgsql','v',array['search_path=""','extra_float_digits=3']::text[],
      $old$      and (_candidate_ids is null or (candidate.id=any(_candidate_ids)
        and exists(select 1 from private.item_sources source where source.item_id=candidate.id and source.provider_key<>'kajo_mock')))$old$,
      $new$      and (_candidate_ids is null or (candidate.id=any(_candidate_ids)
        and private.canonical_item_source_available_v1(candidate.id,eligibility_time)))$new$)
  ) changes(signature,hash,language,volatility,settings,before_text,after_text) loop
    select proc.*,pg_get_functiondef(proc.oid) definition into strict p from pg_proc proc
      where proc.oid=patch.signature::regprocedure;
    if md5(p.prosrc)<>patch.hash or p.proowner<>'postgres'::regrole or p.prosecdef
      or p.provolatile::text<>patch.volatility
      or p.prolang<>(select oid from pg_language where lanname=patch.language)
      or p.proleakproof or p.proisstrict or p.proparallel<>'u'
      or p.proconfig is distinct from patch.settings
      or has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
      or has_function_privilege('service_role',p.oid,'EXECUTE')
      or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
        where acl.grantor<>p.proowner or acl.grantee<>p.proowner) then
      raise exception 'Catalog source cutoff source/security drift: %',patch.signature;
    end if;
    body:=p.prosrc;
    if (length(body)-length(replace(body,patch.before_text,'')))/length(patch.before_text)<>1 then
      raise exception 'Catalog source cutoff replacement drift: %',patch.signature;
    end if;
    execute replace(p.definition,p.prosrc,replace(body,patch.before_text,patch.after_text));
  end loop;
end;$catalog_source_cutoff$;
