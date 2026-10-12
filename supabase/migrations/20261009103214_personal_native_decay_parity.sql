-- Native LongTerm v2: one unclamped 180-day kernel for live memory and ranking.
-- The structural memory-state-v1 / prediction-features-v2 payloads are unchanged;
-- new per-snapshot/per-run metadata names this live extraction interpretation.
-- Existing frozen features, traces, source receipts, genomes and replay are untouched.
-- Native occurrence-time selection excludes nonfinite/future Events and UNDOs.
-- This is not a commit-availability certificate: memory uses its explicit state_as_of,
-- and the base scorer retains its transaction now(), both recorded in new metadata.

do $native_decay_preflight$
declare
  patch jsonb;
  current_source text;
  replacement jsonb;
  before_text text;
begin
  for patch in select value from jsonb_array_elements($native_decay_manifest$[{"signature":"private.build_profile_memory_state_v1(uuid,timestamptz)","sourceMd5":"3d15d0332c523aaf0f0dfbcea59104f6","replacements":[{"before":"            else exp(\n              -greatest(\n                0.0,\n                extract(epoch from (state_as_of - weighted_events.occurred_at)) / 86400.0\n              ) / 180.0\n            )","after":"            else private.native_long_term_decay_v2(\n              state_as_of, weighted_events.occurred_at\n            )","count":1},{"before":"      and event.occurred_at <= state_as_of","after":"      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= state_as_of","count":2},{"before":"    'version', 'memory-state-v1',","after":"    'version', 'memory-state-v1',\n    'nativeDecayVersion', 'native-long-term-decay-v2',\n    'nativeEvidenceAsOf', state_as_of,","count":1}]},{"signature":"private.rank_items_v0(uuid,text,text,integer,jsonb)","sourceMd5":"33ec3578a917d585d657d73ccc79b223","replacements":[{"before":"        * exp(\n            -least(\n              365.0,\n              greatest(\n                0.0,\n                extract(epoch from (now() - weighted_events.occurred_at))\n                  / 86400.0\n              )\n            )\n            / 180.0\n          )","after":"        * private.native_long_term_decay_v2(now(), weighted_events.occurred_at)","count":1},{"before":"      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and event.properties ? 'reversedEventId'","after":"      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.properties ? 'reversedEventId'","count":1},{"before":"      and event.item_id is not null\n      and event.event_type in (","after":"      and event.item_id is not null\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.event_type in (","count":1},{"before":"        'version', 'prediction-features-v2',","after":"        'version', 'prediction-features-v2',\n        'nativeDecayVersion', 'native-long-term-decay-v2',\n        'nativeEvidenceAsOf', now(),","count":1},{"before":"      'version', 'prediction-v0.4-bootstrap',","after":"      'version', 'prediction-v0.5-native-decay',\n      'nativeDecayVersion', 'native-long-term-decay-v2',\n      'nativeEvidenceAsOf', now(),","count":1}]},{"signature":"private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)","sourceMd5":"2173e0d10a5ec02091e3b356724088cf","replacements":[{"before":"        * exp(\n            -least(\n              365.0,\n              greatest(\n                0.0,\n                extract(epoch from (now() - weighted_events.occurred_at))\n                  / 86400.0\n              )\n            )\n            / 180.0\n          )","after":"        * private.native_long_term_decay_v2(now(), weighted_events.occurred_at)","count":1},{"before":"      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and event.properties ? 'reversedEventId'","after":"      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.properties ? 'reversedEventId'","count":1},{"before":"      and event.item_id is not null\n      and event.event_type in (","after":"      and event.item_id is not null\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.event_type in (","count":1},{"before":"        'version', 'prediction-features-v2',","after":"        'version', 'prediction-features-v2',\n        'nativeDecayVersion', 'native-long-term-decay-v2',\n        'nativeEvidenceAsOf', now(),","count":1},{"before":"      'version', 'prediction-v0.4-bootstrap',","after":"      'version', 'prediction-v0.5-native-decay',\n      'nativeDecayVersion', 'native-long-term-decay-v2',\n      'nativeEvidenceAsOf', now(),","count":1}]},{"signature":"private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)","sourceMd5":"5ab93187a675ac86197660997bbee2e5","replacements":[{"before":"'prediction-v0.4-bootstrap'","after":"'prediction-v0.5-native-decay'","count":2}]},{"signature":"private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)","sourceMd5":"6924cd358fe60455764c3d8379162d3a","replacements":[{"before":"'prediction-v0.4-bootstrap'","after":"'prediction-v0.5-native-decay'","count":2}]}]$native_decay_manifest$::jsonb) loop
    select p.prosrc into strict current_source from pg_catalog.pg_proc p
      where p.oid=(patch->>'signature')::regprocedure;
    if pg_catalog.md5(current_source) is distinct from patch->>'sourceMd5' then
      raise exception 'Native decay source drift: %',patch->>'signature' using errcode='55000';
    end if;
    for replacement in select value from jsonb_array_elements(patch->'replacements') loop
      before_text := replacement->>'before';
      if before_text='' or (pg_catalog.length(current_source)-pg_catalog.length(pg_catalog.replace(current_source,before_text,'')))
        /pg_catalog.length(before_text)<>(replacement->>'count')::integer then
        raise exception 'Native decay anchor drift: %',patch->>'signature' using errcode='55000';
      end if;
    end loop;
  end loop;
end;
$native_decay_preflight$;

create function private.native_long_term_decay_v2(state_as_of timestamptz,evidence_at timestamptz)
returns double precision
language plpgsql immutable strict security invoker set search_path=''
as $native_long_term_decay$
begin
  if not pg_catalog.isfinite(state_as_of) or not pg_catalog.isfinite(evidence_at) then
    raise exception 'Native decay timestamps must be finite' using errcode='22023';
  end if;
  -- Keep the existing memory numeric exponential before its double-precision result.
  return pg_catalog.exp(-greatest(0.0,
    extract(epoch from (state_as_of-evidence_at))/86400.0)/180.0);
end;
$native_long_term_decay$;
revoke all on function private.native_long_term_decay_v2(timestamptz,timestamptz)
  from public,anon,authenticated,service_role;
comment on function private.native_long_term_decay_v2(timestamptz,timestamptz) is
  'native-long-term-decay-v2: finite occurrence age, no 365-day cap, max(0,age)/180; native evidence only, not bootstrap or historical replay.';

do $native_decay_patch$
declare
  patch jsonb;
  replacement jsonb;
  previous record;
  next_source text;
  next_definition text;
  before_text text;
begin
  for patch in select value from jsonb_array_elements($native_decay_manifest$[{"signature":"private.build_profile_memory_state_v1(uuid,timestamptz)","sourceMd5":"3d15d0332c523aaf0f0dfbcea59104f6","replacements":[{"before":"            else exp(\n              -greatest(\n                0.0,\n                extract(epoch from (state_as_of - weighted_events.occurred_at)) / 86400.0\n              ) / 180.0\n            )","after":"            else private.native_long_term_decay_v2(\n              state_as_of, weighted_events.occurred_at\n            )","count":1},{"before":"      and event.occurred_at <= state_as_of","after":"      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= state_as_of","count":2},{"before":"    'version', 'memory-state-v1',","after":"    'version', 'memory-state-v1',\n    'nativeDecayVersion', 'native-long-term-decay-v2',\n    'nativeEvidenceAsOf', state_as_of,","count":1}]},{"signature":"private.rank_items_v0(uuid,text,text,integer,jsonb)","sourceMd5":"33ec3578a917d585d657d73ccc79b223","replacements":[{"before":"        * exp(\n            -least(\n              365.0,\n              greatest(\n                0.0,\n                extract(epoch from (now() - weighted_events.occurred_at))\n                  / 86400.0\n              )\n            )\n            / 180.0\n          )","after":"        * private.native_long_term_decay_v2(now(), weighted_events.occurred_at)","count":1},{"before":"      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and event.properties ? 'reversedEventId'","after":"      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.properties ? 'reversedEventId'","count":1},{"before":"      and event.item_id is not null\n      and event.event_type in (","after":"      and event.item_id is not null\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.event_type in (","count":1},{"before":"        'version', 'prediction-features-v2',","after":"        'version', 'prediction-features-v2',\n        'nativeDecayVersion', 'native-long-term-decay-v2',\n        'nativeEvidenceAsOf', now(),","count":1},{"before":"      'version', 'prediction-v0.4-bootstrap',","after":"      'version', 'prediction-v0.5-native-decay',\n      'nativeDecayVersion', 'native-long-term-decay-v2',\n      'nativeEvidenceAsOf', now(),","count":1}]},{"signature":"private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)","sourceMd5":"2173e0d10a5ec02091e3b356724088cf","replacements":[{"before":"        * exp(\n            -least(\n              365.0,\n              greatest(\n                0.0,\n                extract(epoch from (now() - weighted_events.occurred_at))\n                  / 86400.0\n              )\n            )\n            / 180.0\n          )","after":"        * private.native_long_term_decay_v2(now(), weighted_events.occurred_at)","count":1},{"before":"      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and event.properties ? 'reversedEventId'","after":"      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.properties ? 'reversedEventId'","count":1},{"before":"      and event.item_id is not null\n      and event.event_type in (","after":"      and event.item_id is not null\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.event_type in (","count":1},{"before":"        'version', 'prediction-features-v2',","after":"        'version', 'prediction-features-v2',\n        'nativeDecayVersion', 'native-long-term-decay-v2',\n        'nativeEvidenceAsOf', now(),","count":1},{"before":"      'version', 'prediction-v0.4-bootstrap',","after":"      'version', 'prediction-v0.5-native-decay',\n      'nativeDecayVersion', 'native-long-term-decay-v2',\n      'nativeEvidenceAsOf', now(),","count":1}]},{"signature":"private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)","sourceMd5":"5ab93187a675ac86197660997bbee2e5","replacements":[{"before":"'prediction-v0.4-bootstrap'","after":"'prediction-v0.5-native-decay'","count":2}]},{"signature":"private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)","sourceMd5":"6924cd358fe60455764c3d8379162d3a","replacements":[{"before":"'prediction-v0.4-bootstrap'","after":"'prediction-v0.5-native-decay'","count":2}]}]$native_decay_manifest$::jsonb) loop
    select p.oid,p.prosrc,pg_catalog.to_jsonb(p)-'prosrc' as metadata,
      pg_catalog.pg_get_functiondef(p.oid) as definition into strict previous
      from pg_catalog.pg_proc p where p.oid=(patch->>'signature')::regprocedure;
    if pg_catalog.md5(previous.prosrc) is distinct from patch->>'sourceMd5' then
      raise exception 'Native decay source changed after preflight: %',patch->>'signature' using errcode='55000';
    end if;
    next_source := previous.prosrc;
    for replacement in select value from jsonb_array_elements(patch->'replacements') loop
      before_text := replacement->>'before';
      if before_text='' or (pg_catalog.length(next_source)-pg_catalog.length(pg_catalog.replace(next_source,before_text,'')))
        /pg_catalog.length(before_text)<>(replacement->>'count')::integer then
        raise exception 'Native decay replacement drift: %',patch->>'signature' using errcode='55000';
      end if;
      next_source := pg_catalog.replace(next_source,before_text,replacement->>'after');
    end loop;
    if (pg_catalog.length(previous.definition)-pg_catalog.length(pg_catalog.replace(previous.definition,previous.prosrc,'')))
      /pg_catalog.length(previous.prosrc)<>1 then
      raise exception 'Native decay definition drift: %',patch->>'signature' using errcode='55000';
    end if;
    next_definition := pg_catalog.replace(previous.definition,previous.prosrc,next_source);
    execute next_definition;
    if not exists(select 1 from pg_catalog.pg_proc p where p.oid=previous.oid
      and pg_catalog.to_jsonb(p)-'prosrc'=previous.metadata and p.prosrc=next_source) then
      raise exception 'Native decay function identity or metadata drift: %',patch->>'signature' using errcode='55000';
    end if;
  end loop;
end;
$native_decay_patch$;
