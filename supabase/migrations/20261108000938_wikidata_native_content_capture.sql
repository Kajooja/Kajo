-- Private, opt-in Wikidata generation. No ingestion, grants or serving activation.
-- Raw EntityData is retained only in the private source row. A bounded claims
-- projection is frozen with independent original-byte and projection hashes.
create function private.wikidata_bounded_json_v1(source_text text)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare parsed jsonb; nodes integer; invalid boolean;
begin
  if source_text is null or octet_length(source_text) not between 1 and 2097152
    or not (source_text is json object with unique keys) then return null;end if;
  parsed:=source_text::jsonb;
  with recursive walk(value,depth) as (
    select parsed,0 union all
    select child.value,parent.depth+1 from walk parent cross join lateral (
      select value from jsonb_each(case jsonb_typeof(parent.value) when 'object' then parent.value else '{}'::jsonb end)
      union all select value from jsonb_array_elements(case jsonb_typeof(parent.value) when 'array' then parent.value else '[]'::jsonb end)
    ) child where parent.depth<=32
  ), bounded as (select * from walk limit 100001)
  -- JavaScript parses JSON numbers as binary64. A fractional original that
  -- rounds to an integer could change Q-id/reference eligibility in the worker.
  -- Reject that source before deriving any vector; ordinary fractions remain valid.
  select count(*),coalesce(bool_or(depth>32 or case when jsonb_typeof(value)='number'
    then (value::text)::double precision in('Infinity'::float8,'-Infinity'::float8)
      or ((value::text)::numeric<>trunc((value::text)::numeric)
        and (value::text)::double precision=trunc((value::text)::double precision))
    else false end),false)
    into nodes,invalid from bounded;
  if nodes>100000 or invalid then return null;end if;
  return parsed;
exception when data_exception or program_limit_exceeded then return null;
end;$$;

create function private.wikidata_snak_map_v1(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare entry record;snak jsonb;
begin
  if jsonb_typeof(value) is distinct from 'object' or (select count(*) from jsonb_object_keys(value))>32 then return false;end if;
  for entry in select * from jsonb_each(value) loop
    if entry.key!~'^P[1-9][0-9]*$' or jsonb_typeof(entry.value) is distinct from 'array' then return false;end if;
    if jsonb_array_length(entry.value) not between 1 and 32 then return false;end if;
    for snak in select * from jsonb_array_elements(entry.value) loop
      if jsonb_typeof(snak) is distinct from 'object' or snak->>'property' is distinct from entry.key
        or coalesce(snak->>'snaktype','') not in('value','somevalue','novalue') then return false;end if;
    end loop;
  end loop;
  return true;
end;$$;

create function private.wikidata_key_order_v1(value jsonb,keys jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
begin
  if value is null then return true;end if;
  if jsonb_typeof(value) is distinct from 'array' then return false;end if;
  return jsonb_array_length(value)=(select count(*) from jsonb_object_keys(keys))
    and (select count(distinct v) from jsonb_array_elements(value) v)=jsonb_array_length(value)
    and not exists(select 1 from jsonb_array_elements(value) v where jsonb_typeof(v)<>'string' or not keys?(v#>>'{}'));
end;$$;

create function private.wikidata_tmdb_reference_v1(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare child jsonb;marker jsonb;literal text;decoded text;host text;bytes bytea;pos integer;
  url_text text;authority text;
begin
  if jsonb_typeof(value)='string' then
    literal:=value#>>'{}';if upper(literal)='Q20828898' then return true;end if;
    decoded:=literal;
    begin
      bytes:=''::bytea;pos:=1;
      while pos<=char_length(literal) loop
        if substr(literal,pos,1)='%' then
          if substr(literal,pos+1,2)!~'^[0-9a-fA-F]{2}$' then raise data_exception;end if;
          bytes:=bytes||decode(substr(literal,pos+1,2),'hex');pos:=pos+3;
        else bytes:=bytes||convert_to(substr(literal,pos,1),'UTF8');pos:=pos+1;end if;
      end loop;
      decoded:=convert_from(bytes,'UTF8');
    exception when data_exception then decoded:=literal;end;
    -- The portable extractor uses WHATWG URL parsing. SQL does not implement
    -- IDNA or special-URL repair: decline those original sources before freezing
    -- any vector, rather than disagreeing with the independent worker later.
    -- Plain Unicode reference prose is still allowed; this fence is URL-only.
    url_text:=regexp_replace(regexp_replace(decoded,E'[\\t\\r\\n]','','g'),'^[[:cntrl:] ]+|[[:cntrl:] ]+$','','g');
    if url_text~'^(?:[A-Za-z][A-Za-z0-9+.-]*:)?//' or url_text~*'^(?:https?|ftp|wss?|file):' then
      authority:=substring(url_text from '^(?:[A-Za-z][A-Za-z0-9+.-]*:)?//([^/?#]*)');
      if authority is null or authority='' or url_text is distinct from decoded
        or octet_length(authority)<>char_length(authority)
        or authority~'[[:cntrl:][:space:]%]' or position(chr(92) in authority)>0
        or lower(authority)~'(^|[.@])xn--' then
        raise data_exception; -- project_wikidata_film_v1 returns unavailable.
      end if;
    end if;
    -- WHATWG removes at most one terminal dot for this marker check.
    host:=lower(regexp_replace(substring(decoded from '^(?:[A-Za-z][A-Za-z0-9+.-]*:)?//(?:[^/@]*@)?([^/:?#]+)'),'\.$',''));
    return coalesce(host in('themoviedb.org','tmdb.org') or host like '%.themoviedb.org' or host like '%.tmdb.org',false)
      or decoded~*'(^|[^a-z0-9-])(themoviedb|tmdb)\.org($|[^a-z0-9.-])';
  elsif jsonb_typeof(value)='object' then
    marker:=value->'numeric-id';
    while jsonb_typeof(marker)='array' loop
      if jsonb_array_length(marker)<>1 then raise data_exception;end if;marker:=marker->0;
    end loop;
    -- A compound numeric-id can invoke object-to-string coercion in JavaScript
    -- (including malformed own toString values). Decline the whole native source
    -- before the independent extractor receives such a frozen reference.
    if jsonb_typeof(marker)='object' then raise data_exception;end if;
    if value?'P4947' or value->>'property'='P4947' or marker='"20828898"'::jsonb
      or (jsonb_typeof(marker)='number' and marker='20828898'::jsonb) then return true;end if;
    for child in select v from jsonb_each(value) x(k,v) loop if private.wikidata_tmdb_reference_v1(child) then return true;end if;end loop;
  elsif jsonb_typeof(value)='array' then
    for child in select * from jsonb_array_elements(value) loop if private.wikidata_tmdb_reference_v1(child) then return true;end if;end loop;
  end if;
  return false;
end;$$;

-- NULL means ineligible, never a negative assertion or a fallback rank.
create function private.wikidata_statement_value_v1(statement jsonb,property text,entity_id text)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare ref jsonb;snak jsonb:=statement->'mainsnak';data jsonb;value jsonb;qualifiers jsonb:=coalesce(statement->'qualifiers','{}');
begin
  if jsonb_typeof(statement) is distinct from 'object' or statement->>'type' is distinct from 'statement'
    or coalesce(statement->>'id','')!~('^'||entity_id||'\$[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
    or jsonb_typeof(snak) is distinct from 'object' or snak->>'property' is distinct from property
    or not private.wikidata_snak_map_v1(qualifiers)
    or not private.wikidata_key_order_v1(statement->'qualifiers-order',qualifiers) then return null;end if;
  if statement?'references' then
    if jsonb_typeof(statement->'references') is distinct from 'array' then return null;end if;
    if jsonb_array_length(statement->'references')>16 then return null;end if;
    for ref in select * from jsonb_array_elements(statement->'references') loop
      if jsonb_typeof(ref) is distinct from 'object' or jsonb_typeof(ref->'hash') is distinct from 'string'
        or (ref->>'hash')!~'^[0-9a-f]{40}$' or not private.wikidata_snak_map_v1(ref->'snaks')
        or not private.wikidata_key_order_v1(ref->'snaks-order',ref->'snaks') then return null;end if;
    end loop;
  end if;
  if qualifiers<>'{}'::jsonb or snak->>'snaktype' is distinct from 'value'
    or (property='P136' and private.wikidata_tmdb_reference_v1(statement->'references')) then return null;end if;
  data:=snak->'datavalue';value:=data->'value';
  if jsonb_typeof(data) is distinct from 'object' then return null;end if;
  if property in('P345','P4947') then
    if snak->>'datatype' is distinct from 'external-id' or data->>'type' is distinct from 'string'
      or jsonb_typeof(value) is distinct from 'string'
      or (value#>>'{}')!~(case property when 'P345' then '^tt[0-9]{7,12}$' else '^[1-9][0-9]{0,15}$' end) then return null;end if;
    return value#>>'{}';
  end if;
  if snak->>'datatype' is distinct from 'wikibase-item' or data->>'type' is distinct from 'wikibase-entityid'
    or jsonb_typeof(value) is distinct from 'object' or value->>'entity-type' is distinct from 'item'
    or jsonb_typeof(value->'id') is distinct from 'string' or (value->>'id')!~'^Q[1-9][0-9]{0,15}$' then return null;end if;
  if value?'numeric-id' then
    if jsonb_typeof(value->'numeric-id') is distinct from 'number' then return null;end if;
    if (value->>'numeric-id')::numeric not between 1 and 9007199254740991
      or (value->>'numeric-id')::numeric<>substring(value->>'id' from 2)::numeric then return null;end if;
  end if;
  return value->>'id';
end;$$;

create function private.project_wikidata_film_v1(source_text text,entity_id text,imdb_id text,tmdb_id text,retrieved_micros text,cutoff_micros text)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare source jsonb;entity jsonb;claims jsonb:='{}';property text;statements jsonb;statement jsonb;
  ids text[]:='{}';rank text;value text;selected integer;genres text[]:='{}';assertions jsonb;vector jsonb;projection text;modified timestamptz;
begin
  if coalesce(entity_id,'')!~'^Q[1-9][0-9]{0,15}$' or coalesce(imdb_id,'')!~'^tt[0-9]{7,12}$'
    or coalesce(tmdb_id,'')!~'^[1-9][0-9]{0,15}$' or coalesce(retrieved_micros,'')!~'^(0|[1-9][0-9]{0,17})$'
    or coalesce(cutoff_micros,'')!~'^(0|[1-9][0-9]{0,17})$' then return null;end if;
  if retrieved_micros::numeric>cutoff_micros::numeric or cutoff_micros::numeric>253402300799999999 then return null;end if;
  source:=private.wikidata_bounded_json_v1(source_text);
  if source is null or (select array_agg(k) from jsonb_object_keys(source) k) is distinct from array['entities']::text[]
    or jsonb_typeof(source->'entities') is distinct from 'object' then return null;end if;
  if (select array_agg(k) from jsonb_object_keys(source->'entities') k) is distinct from array[entity_id] then return null;end if;
  entity:=source#>array['entities',entity_id];
  if jsonb_typeof(entity) is distinct from 'object' or entity->>'id' is distinct from entity_id
    or entity->>'type' is distinct from 'item' or entity?|array['redirect','redirects','missing','deleted']
    or jsonb_typeof(entity->'lastrevid') is distinct from 'number' or jsonb_typeof(entity->'modified') is distinct from 'string'
    or (entity->>'modified')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'
    or jsonb_typeof(entity->'claims') is distinct from 'object' then return null;end if;
  if (entity->>'lastrevid')::numeric not between 1 and 9007199254740991
    or trunc((entity->>'lastrevid')::numeric)<>(entity->>'lastrevid')::numeric then return null;end if;
  modified:=(entity->>'modified')::timestamptz;
  if to_char(modified at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')<>entity->>'modified'
    or extract(epoch from modified)*1000000 not between 0 and retrieved_micros::numeric then return null;end if;
  foreach property in array array['P31','P345','P4947','P136','P577','P57','P1476'] loop
    statements:=coalesce(entity#>array['claims',property],'[]');
    if jsonb_typeof(statements) is distinct from 'array' then return null;end if;
    if jsonb_array_length(statements)>128 then return null;end if;
    for statement in select * from jsonb_array_elements(statements) loop
      if jsonb_typeof(statement) is distinct from 'object' or coalesce(statement->>'rank','') not in('normal','preferred','deprecated') then return null;end if;
      if exists(select 1 from jsonb_object_keys(statement) k where k<>all(array['id','type','rank','mainsnak','qualifiers','qualifiers-order','references'])) then return null;end if;
      if jsonb_typeof(statement->'id')='string' then
        if lower(statement->>'id')=any(ids) then return null;end if;ids:=array_append(ids,lower(statement->>'id'));
      end if;
      if jsonb_typeof(statement->'references')='array' then
        if jsonb_array_length(statement->'references')>16 then return null;end if;
      end if;
    end loop;
    claims:=claims||jsonb_build_object(property,statements);
  end loop;
  foreach property in array array['P31','P345','P4947','P136'] loop
    statements:=claims->property;selected:=0;
    rank:=case when exists(select 1 from jsonb_array_elements(statements) s where s->>'rank'='preferred') then 'preferred' else 'normal' end;
    for statement in select s from jsonb_array_elements(statements) s where s->>'rank'=rank loop
      selected:=selected+1;value:=private.wikidata_statement_value_v1(statement,property,entity_id);
      if property='P345' and value is distinct from imdb_id then return null;end if;
      if property='P4947' and value is distinct from tmdb_id then return null;end if;
      if property='P31' and coalesce(value,'') not in('Q11424','Q24869') then return null;end if;
      if property='P136' and value=any(array['Q157394','Q200092','Q1200678','Q1054574','Q471839','Q2484376']) then genres:=array_append(genres,value);end if;
    end loop;
    if property<>'P136' and selected=0 then return null;end if;
  end loop;
  projection:=jsonb_build_object('entities',jsonb_build_object(entity_id,jsonb_build_object('id',entity_id,'type','item',
    'lastrevid',entity->'lastrevid','modified',entity->'modified','claims',claims)))::text;
  if octet_length(projection)>65536 then return null;end if;
  select jsonb_agg(case when g=any(genres) then 1 else null end order by n),jsonb_agg(case when g=any(genres) then 1 else 0 end order by n)
    into assertions,vector from unnest(array['Q157394','Q200092','Q1200678','Q1054574','Q471839','Q2484376']) with ordinality x(g,n);
  return jsonb_build_object('assertions',assertions,'values',case when cardinality(genres)>0 then vector else null end,
    'projectionText',projection,'projectionHash',encode(sha256(convert_to(projection,'UTF8')),'hex'),
    'sourceHash',encode(sha256(convert_to(source_text,'UTF8')),'hex'),
    'sourceUrl','https://www.wikidata.org/wiki/Special:EntityData/'||entity_id||'.json?revision='||(entity->>'lastrevid')::numeric::bigint::text,
    'sourceUpdatedAtMicros',(extract(epoch from modified)*1000000)::bigint::text);
exception when data_exception or program_limit_exceeded then return null;
end;$$;

create function private.validate_personal_rating_feature_use_v2(feature_use jsonb,evidence_origin text,cutoff_micros text,horizon_micros text)
returns void language plpgsql security invoker set search_path='' as $$
declare entry jsonb;
begin
  if feature_use is null or feature_use='null'::jsonb then return;end if;
  if jsonb_typeof(feature_use) is distinct from 'object' or octet_length(feature_use::text)>4096
    or (select array_agg(k order by k) from jsonb_object_keys(feature_use) k)
      is distinct from array['origin','purpose','retention','reviewRef','sources','validFromMicros','validUntilMicros','version']::text[]
    or feature_use->>'version' is distinct from 'personal-content-feature-use-v2'
    or feature_use->>'purpose' is distinct from 'PRIVATE_NATIVE_EVALUATION'
    or feature_use->>'origin' is distinct from evidence_origin
    or feature_use->>'retention' is distinct from 'SOURCE_BOUND_UNTIL_WITHDRAWAL'
    or jsonb_typeof(feature_use->'reviewRef') is distinct from 'string' or char_length(feature_use->>'reviewRef') not between 1 and 256
    or jsonb_typeof(feature_use->'validFromMicros') is distinct from 'string'
    or jsonb_typeof(feature_use->'validUntilMicros') is distinct from 'string'
    or coalesce(feature_use->>'validFromMicros','')!~'^(0|[1-9][0-9]{0,17})$'
    or coalesce(feature_use->>'validUntilMicros','')!~'^(0|[1-9][0-9]{0,17})$'
    or jsonb_typeof(feature_use->'sources') is distinct from 'array' then
    raise exception 'Invalid explicit content feature-use manifest' using errcode='22023';end if;
  if (feature_use->>'validFromMicros')::numeric>cutoff_micros::numeric
    or (feature_use->>'validUntilMicros')::numeric<horizon_micros::numeric
    or (feature_use->>'validUntilMicros')::numeric>253402300799999999
    or jsonb_array_length(feature_use->'sources')>2 then
    raise exception 'Content feature-use interval or source budget invalid' using errcode='22023';end if;
  for entry in select value from jsonb_array_elements(feature_use->'sources') loop
    if jsonb_typeof(entry) is distinct from 'object'
      or (select array_agg(k order by k) from jsonb_object_keys(entry) k) is distinct from array['disposition','evidenceKind','providerKey']::text[]
      or entry->>'disposition' is distinct from 'PERMITTED'
      or ((entry->>'providerKey'='wikidata' and entry->>'evidenceKind'='wikidata-direct-film-genre')
        or (entry->>'providerKey'='open_library' and entry->>'evidenceKind'='provider-subject')) is not true then
      raise exception 'Invalid explicit content feature-use source' using errcode='22023';end if;
  end loop;
  if (select count(distinct value->>'providerKey') from jsonb_array_elements(feature_use->'sources'))<>jsonb_array_length(feature_use->'sources') then
    raise exception 'Duplicate content feature-use source' using errcode='22023';end if;
end;$$;

-- xmin equality with the top-level XID misses released SAVEPOINT writes. Resolve
-- a visible tuple's 32-bit xmin near the current full XID and ask commit status.
-- Old/frozen visible tuples may have discarded commit metadata; an unknown past
-- XID is eligible, whereas unknown/future or in-progress IDs fail closed.
create function private.personal_rating_source_committed_v1(source_xmin xid)
returns boolean language plpgsql volatile security invoker set search_path='' as $$
declare current_id numeric:=pg_current_xact_id()::text::numeric;full_id numeric;status text;
begin
  if source_xmin is null then return false;end if;
  if source_xmin='2'::xid then return true;end if;
  if source_xmin::text::numeric<3 then return false;end if;
  full_id:=current_id-mod(current_id,4294967296)+source_xmin::text::numeric;
  if full_id-current_id>2147483647 then full_id:=full_id-4294967296;
  elsif current_id-full_id>2147483647 then full_id:=full_id+4294967296;end if;
  if full_id<3 then return false;end if;
  status:=pg_xact_status(full_id::text::xid8);
  return coalesce(status='committed',false) or (status is null and full_id<current_id);
exception when invalid_parameter_value then return false;
end;$$;

create function private.capture_personal_rating_content_v2(input jsonb,feature_use jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare objects jsonb:='[]';row_value jsonb;object_id uuid;source private.item_sources%rowtype;
  cutoff timestamptz:=to_timestamp((input->>'cutoffMicros')::numeric/1000000);projected jsonb;aliases jsonb;imdb text;tmdb text;
  feature_ids jsonb;book jsonb;result jsonb;retrieved text;
begin
  -- Invoked by v4 under the complete catalogue SHARE fences, never by a client.
  if input->>'itemType'='BOOK' then
    book:=private.capture_personal_rating_content_v1(input,case when feature_use is null or feature_use='null'::jsonb then null else
      feature_use||jsonb_build_object('version','personal-content-feature-use-v1','sources',
        (select coalesce(jsonb_agg(s),'[]') from jsonb_array_elements(feature_use->'sources') s where s->>'providerKey'='open_library')) end);
    feature_ids:=book->'featureIds';
    for row_value in select * from jsonb_array_elements(book->'objects') loop
      if row_value->'provenance'<>'null'::jsonb then
        if not exists(select 1 from private.item_sources s where s.id=(row_value->>'sourceId')::uuid
          and private.personal_rating_source_committed_v1(s.xmin))
        or not exists(select 1 from private.item_external_ids a where a.namespace=row_value#>>'{provenance,alias,namespace}'
          and a.external_id=row_value#>>'{provenance,alias,externalId}' and private.personal_rating_source_committed_v1(a.xmin)) then
          row_value:=row_value||jsonb_build_object('sourceId','unavailable:'||(row_value->>'objectId'),
            'status','UNAVAILABLE','assertions',null,'values',null,'provenance',null);
        end if;
      end if;
      objects:=objects||jsonb_build_array(row_value);
    end loop;
  elsif input->>'itemType'='MOVIE' then
    select jsonb_agg('wikidata-direct-film-genre:'||c order by n) into feature_ids
      from unnest(array['fantasy','horror','mystery','romance','science-fiction','thriller']) with ordinality x(c,n);
    for object_id in select id from (
      select (l->>'itemId')::uuid id from jsonb_array_elements(input->'labels') l
      union select (p->>'id')::uuid from jsonb_array_elements(input#>'{candidatePool,items}') p
    ) inventory order by id loop
      row_value:=jsonb_build_object('objectId',object_id,'domainId','MOVIE','sourceId','unavailable:'||object_id,
        'availableAtMicros',input->'cutoffMicros','status','UNAVAILABLE','assertions',null,'values',null,'provenance',null);
      if feature_use is null or feature_use='null'::jsonb or not exists(select 1 from jsonb_array_elements(feature_use->'sources') a
        where a->>'providerKey'='wikidata' and a->>'evidenceKind'='wikidata-direct-film-genre' and a->>'disposition'='PERMITTED') then
        objects:=objects||jsonb_build_array(row_value);continue;end if;
      select s.* into source from private.item_sources s join public.items i on i.id=s.item_id
        where s.item_id=object_id and i.item_type='MOVIE' and s.provider_key='wikidata'
          and (select count(*) from private.item_sources other where other.item_id=object_id and other.provider_key='wikidata')=1;
      if not found then objects:=objects||jsonb_build_array(row_value);continue;end if;
      -- The source uniqueness constraint and alias primary key are global. Both
      -- external aliases and the Q alias are required, with exactly one per Item.
      select jsonb_agg(jsonb_build_object('namespace',a.namespace,'externalId',a.external_id) order by a.namespace)
        into aliases from private.item_external_ids a where a.item_id=object_id
          and a.namespace in('imdb_title','tmdb_movie','wikidata_item')
          and isfinite(a.created_at) and a.created_at<=cutoff and a.created_at>=timestamptz 'epoch'
          and private.personal_rating_source_committed_v1(a.xmin);
      if jsonb_array_length(aliases) is distinct from 3
        or (select count(distinct a->>'namespace') from jsonb_array_elements(aliases) a)<>3
        or (select count(*) from private.item_external_ids a where a.item_id=object_id and a.namespace in('imdb_title','tmdb_movie','wikidata_item'))<>3
        or aliases->2->>'externalId' is distinct from source.provider_item_id
        or not isfinite(source.created_at) or source.created_at not between timestamptz 'epoch' and cutoff
        or not isfinite(source.updated_at) or source.updated_at not between timestamptz 'epoch' and cutoff
        or not isfinite(source.synced_at) or source.synced_at not between timestamptz 'epoch' and cutoff
        or not exists(select 1 from private.item_sources s where s.id=source.id and private.personal_rating_source_committed_v1(s.xmin))
        or (select array_agg(k order by k) from jsonb_object_keys(source.source_payload) k)
          is distinct from array['retrievedAtMicros','sourceText','version']::text[]
        or source.source_payload->>'version' is distinct from 'wikidata-entitydata-source-v1'
        or jsonb_typeof(source.source_payload->'sourceText') is distinct from 'string'
        or jsonb_typeof(source.source_payload->'retrievedAtMicros') is distinct from 'string' then
        objects:=objects||jsonb_build_array(row_value);continue;end if;
      imdb:=aliases->0->>'externalId';tmdb:=aliases->1->>'externalId';retrieved:=source.source_payload->>'retrievedAtMicros';
      projected:=private.project_wikidata_film_v1(source.source_payload->>'sourceText',source.provider_item_id,
        imdb,tmdb,retrieved,input->>'cutoffMicros');
      if projected is null then objects:=objects||jsonb_build_array(row_value);continue;end if;
      if source.source_hash is distinct from projected->>'sourceHash' or source.source_url is distinct from projected->>'sourceUrl'
        or source.source_updated_at is null or not isfinite(source.source_updated_at)
        or extract(epoch from source.source_updated_at)*1000000<>(projected->>'sourceUpdatedAtMicros')::numeric
        or retrieved::numeric>extract(epoch from source.synced_at)*1000000 then
        objects:=objects||jsonb_build_array(row_value);continue;end if;
      row_value:=row_value||jsonb_build_object('sourceId',source.id,'assertions',projected->'assertions','values',projected->'values',
        'status',case when projected->'values'='null'::jsonb then 'UNAVAILABLE' else 'AVAILABLE' end,
        'provenance',jsonb_build_object('providerKey','wikidata','providerItemId',source.provider_item_id,'sourceUrl',source.source_url,
          'sourceHash',source.source_hash,'sourceUpdatedAtMicros',projected->'sourceUpdatedAtMicros',
          'rowUpdatedAtMicros',(extract(epoch from source.updated_at)*1000000)::bigint::text,
          'syncedAtMicros',(extract(epoch from source.synced_at)*1000000)::bigint::text,
          'alias',aliases->2,'aliases',aliases,'evidenceKind','wikidata-direct-film-genre','projectionHash',projected->'projectionHash',
          'featurePayload',jsonb_build_object('projectionText',projected->'projectionText','retrievedAtMicros',retrieved,
            'identity',jsonb_build_object('imdbId',imdb,'tmdbMovieId',tmdb))));
      objects:=objects||jsonb_build_array(row_value);
    end loop;
  else raise exception 'Unsupported native content domain' using errcode='22023';end if;
  result:=jsonb_build_object('version','kajo-personal-content-features-v2','cutoffMicros',input->'cutoffMicros',
    'mappingVersion','wikidata-open-library-concepts-v1','mappingHash','34292c63cb0f2ee2e26df033fdf2bc0ea9628b552b4c62fe2eba82ec56a203fb',
    'transformVersion','catalog-assertion-presence-v1','semantics','ASSERTION_PRESENCE','featureUse',feature_use,
    'featureIds',feature_ids,'objects',objects);
  if octet_length(result::text)>4194304 then raise exception 'Native content prefix exceeds complete byte budget' using errcode='54000';end if;
  return result;
end;$$;

-- Includes unavailable rows: adding a second source/alias changes the complete
-- identity census too. No new source may silently change a frozen opportunity.
create table private.personal_rating_catalog_item_refs (
  forecast_id uuid not null references private.personal_rating_inputs(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  primary key(forecast_id,item_id)
);
create index personal_rating_catalog_item_idx on private.personal_rating_catalog_item_refs(item_id);
alter table private.personal_rating_catalog_item_refs enable row level security;
revoke all on private.personal_rating_catalog_item_refs from public,anon,authenticated,service_role;
create trigger personal_rating_catalog_item_immutable before update or delete on private.personal_rating_catalog_item_refs
  for each row execute function private.guard_personal_rating_content_artifact_v1();

create function private.withdraw_personal_rating_catalog_v2()
returns trigger language plpgsql security definer set search_path='' as $$
declare items uuid[];forecast_ids uuid[];
begin
  if tg_relid not in('public.items'::regclass,'private.item_sources'::regclass,'private.item_external_ids'::regclass)
    or tg_when<>'BEFORE' or tg_level<>'ROW' or tg_op not in('INSERT','UPDATE','DELETE') then
    raise exception 'Native catalog withdrawal trigger denied' using errcode='42501';end if;
  if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
  if tg_relid='public.items'::regclass then
    if tg_op='UPDATE' and row(new.id,new.item_type,new.discoverable) is not distinct from row(old.id,old.item_type,old.discoverable) then return new;end if;
    items:=array[old.id];
  elsif tg_op='INSERT' then items:=array[new.item_id];
  elsif tg_op='DELETE' then items:=array[old.item_id];
  else items:=array[old.item_id,new.item_id];end if;
  select array_agg(r.forecast_id) into forecast_ids from (select distinct forecast_id from private.personal_rating_catalog_item_refs
    where item_id=any(items) limit 250001) r;
  if coalesce(cardinality(forecast_ids),0)>0 then
    if current_setting('transaction_isolation')<>'read committed' then
      raise exception 'Native catalog withdrawal requires READ COMMITTED' using errcode='25001';end if;
    perform private.check_personal_rating_content_withdrawal_budget_v1(forecast_ids);
    delete from private.personal_rating_inputs where id=any(forecast_ids);
  end if;
  if tg_op='DELETE' then return old;end if;return new;
end;$$;
create trigger personal_rating_catalog_source_withdrawal before insert or update or delete on private.item_sources
  for each row execute function private.withdraw_personal_rating_catalog_v2();
create trigger personal_rating_catalog_alias_withdrawal before insert or update or delete on private.item_external_ids
  for each row execute function private.withdraw_personal_rating_catalog_v2();
create trigger personal_rating_catalog_item_withdrawal before update or delete on public.items
  for each row execute function private.withdraw_personal_rating_catalog_v2();


-- Exact frozen predecessor bodies generate new functions; v3 remains untouched.
do $new_capture$
declare original text;definition text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc where oid='private.prepare_personal_rating_forecast_v3(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure;
  if md5(original)<>'1eb94facead8b215544d6d4aadc57472' or to_regprocedure('private.prepare_personal_rating_forecast_v4(uuid,uuid,uuid,integer,text,jsonb)') is not null then raise exception 'Wikidata prepare predecessor drift' using errcode='55000';end if;
  definition:=replace(definition,$before$prepare_personal_rating_forecast_v3$before$,$after$prepare_personal_rating_forecast_v4$after$);
  definition:=replace(definition,$before$kajo-personal-content-rating-preparation-v2$before$,$after$kajo-personal-content-rating-preparation-v3$after$);
  definition:=replace(definition,$before$personal-owned-content-rating-v2$before$,$after$personal-wikidata-content-rating-v3$after$);
  definition:=replace(definition,$before$kajo-personal-content-rating-prefix-v2$before$,$after$kajo-personal-content-rating-prefix-v3$after$);
  definition:=replace(definition,$before$native-owned-content:$before$,$after$native-wikidata-content:$after$);
  definition:=replace(definition,$before$validate_personal_rating_feature_use_v1$before$,$after$validate_personal_rating_feature_use_v2$after$);
  definition:=replace(definition,$before$capture_personal_rating_content_v1$before$,$after$capture_personal_rating_content_v2$after$);
  definition:=replace(definition,$before$    select forecast_id,f#>>'{provenance,alias,namespace}',f#>>'{provenance,alias,externalId}'
      from jsonb_array_elements(input#>'{contentFeatures,objects}') f where f->'provenance'<>'null'::jsonb;$before$,$after$    select forecast_id,a->>'namespace',a->>'externalId'
      from jsonb_array_elements(input#>'{contentFeatures,objects}') f
      cross join lateral jsonb_array_elements(case when f#>>'{provenance,providerKey}'='wikidata'
        then f#>'{provenance,aliases}' else jsonb_build_array(f#>'{provenance,alias}') end) a
      where f->'provenance'<>'null'::jsonb;
  insert into private.personal_rating_catalog_item_refs(forecast_id,item_id)
    select forecast_id,(f->>'objectId')::uuid from jsonb_array_elements(input#>'{contentFeatures,objects}') f;$after$);
  execute definition;
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc where oid='private.finalize_personal_rating_forecast_v3(uuid,jsonb)'::regprocedure;
  if md5(original)<>'0c60ec99c2b97842db4db976e898f84d' or to_regprocedure('private.finalize_personal_rating_forecast_v4(uuid,jsonb)') is not null then raise exception 'Wikidata finalize predecessor drift' using errcode='55000';end if;
  definition:=replace(definition,$before$finalize_personal_rating_forecast_v3$before$,$after$finalize_personal_rating_forecast_v4$after$);
  definition:=replace(definition,$before$kajo-personal-content-rating-preparation-v2$before$,$after$kajo-personal-content-rating-preparation-v3$after$);
  definition:=replace(definition,$before$catalog-concepts-v1:b4319f2554c8627b35f4d77428ff91a576e66ef7ab58fbb1d35f6f64d66f1642:catalog-assertion-presence-v1$before$,$after$wikidata-open-library-concepts-v1:34292c63cb0f2ee2e26df033fdf2bc0ea9628b552b4c62fe2eba82ec56a203fb:catalog-assertion-presence-v1$after$);
  definition:=replace(definition,$before$owned-rating-source-v2:$before$,$after$owned-rating-source-v3:$after$);
  execute definition;
end;$new_capture$;

-- Only dependency handling changes in shared predecessor functions.
do $native_lifecycle$
declare signature text;expected text;before_text text;after_text text;original text;definition text;
begin
  for signature,expected,before_text,after_text in values
    ('private.check_personal_rating_content_withdrawal_budget_v1(uuid[])','52b1a14bf8a3735b8fcc516491edaac1',$before$    union all select 1 from private.personal_rating_event_refs r where r.forecast_id=any(forecast_ids)$before$,$after$    union all select 1 from private.personal_rating_event_refs r where r.forecast_id=any(forecast_ids)
    union all select 1 from private.personal_rating_catalog_item_refs r where r.forecast_id=any(forecast_ids)$after$),
    ('private.erase_prediction_sources_v1(text,uuid)','8a333abe821ed4af0e15165466dfb114',$before$    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)$before$,$after$    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_rating_catalog_item_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)$after$),
    ('private.withdraw_personal_rating_training_source_v2()','85db4eb4ce7c3b90974f86da227c74bd',$before$i.preparation->>'version'='kajo-personal-content-rating-preparation-v2'$before$,$after$i.preparation->>'version' in('kajo-personal-content-rating-preparation-v2','kajo-personal-content-rating-preparation-v3')$after$)
  loop
    select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc where oid=signature::regprocedure;
    if md5(original)<>expected or cardinality(string_to_array(original,before_text))<>2 then
      raise exception 'Wikidata lifecycle predecessor drift: %',signature using errcode='55000';end if;
    execute replace(definition,original,replace(original,before_text,after_text));
  end loop;
end;$native_lifecycle$;
revoke all on function private.wikidata_bounded_json_v1(text),private.wikidata_snak_map_v1(jsonb),
  private.wikidata_key_order_v1(jsonb,jsonb),private.wikidata_tmdb_reference_v1(jsonb),
  private.wikidata_statement_value_v1(jsonb,text,text),private.project_wikidata_film_v1(text,text,text,text,text,text),
  private.validate_personal_rating_feature_use_v2(jsonb,text,text,text),private.personal_rating_source_committed_v1(xid),
  private.capture_personal_rating_content_v2(jsonb,jsonb),
  private.withdraw_personal_rating_catalog_v2(),private.prepare_personal_rating_forecast_v4(uuid,uuid,uuid,integer,text,jsonb),
  private.finalize_personal_rating_forecast_v4(uuid,jsonb) from public,anon,authenticated,service_role;
