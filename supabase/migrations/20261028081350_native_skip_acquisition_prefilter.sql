-- Reduce redundant skip reads in the existing native acquisition owner.
-- The materialized superset is statement-local under the owner's STABLE
-- snapshot. Any possibly relevant source still uses the unchanged composite
-- decision, including reversed/expired sources and tied latest source IDs.
-- No tables, grants, scorer, receipt, lock or retained record change.
do $skip_prefilter$
declare expected record; actual record; original text; definition text; rewritten text;
  old_policy constant text := $old$      case when not is_taste then private.resurfacing_policy_decision_v1(scope_profile_id,i.id,
        jsonb_build_object('consumedSuppressed',coalesce(a.consumed,false),'rating',a.rating,
          'notInterested',coalesce(a.not_interested,false),'saved',coalesce(a.saved,false)),eligibility_at) end policy$old$;
  new_policy constant text := $new$      case when not is_taste then
        case when eligibility_at >= 'epoch'::timestamptz and eligibility_at < '10000-01-01'::timestamptz
          and not exists(select 1 from potential_skips p where p.item_id=i.id)
        then private.resurfacing_before_contextual_skip_v1(scope_profile_id,i.id,
          jsonb_build_object('consumedSuppressed',coalesce(a.consumed,false),'rating',a.rating,
            'notInterested',coalesce(a.not_interested,false),'saved',coalesce(a.saved,false)),eligibility_at)
        else private.resurfacing_policy_decision_v1(scope_profile_id,i.id,
          jsonb_build_object('consumedSuppressed',coalesce(a.consumed,false),'rating',a.rating,
            'notInterested',coalesce(a.not_interested,false),'saved',coalesce(a.saved,false)),eligibility_at)
        end end policy$new$;
begin
  if current_user <> 'postgres' then raise exception 'Skip prefilter requires postgres owner'; end if;
  for expected in select * from (values
    ('private.acquire_native_candidates_v1(jsonb)','6e0aba591a90c194c5bae49f0361084f',false),
    ('private.resurfacing_policy_decision_v1(uuid,uuid,jsonb,timestamptz)','b973e2dabbeabf60e7717cb8cc694a99',true),
    ('private.resurfacing_before_contextual_skip_v1(uuid,uuid,jsonb,timestamptz)','f1bbd5d425a9d9a2aed1e8d2bf967cfc',true),
    ('private.contextual_skip_decision_v1(uuid,uuid,timestamptz,boolean)','43a08ac06d91d18953fd6dd7db8d7beb',true)
  ) checks(signature,body_hash,definer) loop
    select * into strict actual from pg_proc where oid=expected.signature::regprocedure;
    if md5(actual.prosrc)<>expected.body_hash or actual.proowner<>'postgres'::regrole
      or actual.prosecdef is distinct from expected.definer or actual.provolatile<>'s'
      or actual.prolang<>(select oid from pg_language where lanname='plpgsql')
      or actual.proleakproof or actual.proisstrict or actual.proparallel<>'u'
      or actual.proconfig is distinct from array['search_path=""']::text[]
      or exists(select 1 from aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) acl
        where acl.grantor<>actual.proowner or acl.grantee<>actual.proowner)
      or has_function_privilege('anon',actual.oid,'EXECUTE')
      or has_function_privilege('authenticated',actual.oid,'EXECUTE')
      or has_function_privilege('service_role',actual.oid,'EXECUTE') then
      raise exception 'Skip prefilter source/security drift: %',expected.signature;
    end if;
  end loop;
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.acquire_native_candidates_v1(jsonb)'::regprocedure;
  if (length(original)-length(replace(original,old_policy,'')))/length(old_policy)<>1
    or (length(original)-length(replace(original,'where is_taste and c.profile_id=scope_profile_id','')))
      /length('where is_taste and c.profile_id=scope_profile_id')<>1 then
    raise exception 'Skip prefilter patch anchor drift';
  end if;
  rewritten:=replace(original,'where is_taste and c.profile_id=scope_profile_id','where c.profile_id=scope_profile_id');
  rewritten:=replace(rewritten,old_policy,new_policy);
  execute replace(definition,original,rewritten);
end;$skip_prefilter$;
