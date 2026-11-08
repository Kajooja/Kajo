-- Opt-in successor for legacy ASCII Q/q statement GUID prefixes only.
-- Entity/value QIDs, external IDs, qualifiers, ranks, film types and bounds
-- retain their earlier rules. Original bytes are never normalized or rewritten.
-- No rows, public grants, declarations, ingestion or serving activation.
-- Clone exact frozen bodies; all earlier generation functions remain intact.

do $successor$
declare original text;definition text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.wikidata_statement_value_v1(jsonb,text,text)'::regprocedure;
  if md5(original)<>'78d636ee9b1994023a938241880fe464' or to_regprocedure('private.wikidata_statement_value_v2(jsonb,text,text)') is not null then
    raise exception 'Statement-ID predecessor drift: wikidata_statement_value_v1' using errcode='55000';end if;
  if cardinality(string_to_array(definition,$before$wikidata_statement_value_v1$before$))<>2 then
    raise exception 'Statement-ID replacement drift: wikidata_statement_value_v1' using errcode='55000';end if;
  definition:=replace(definition,$before$wikidata_statement_value_v1$before$,$after$wikidata_statement_value_v2$after$);
  if cardinality(string_to_array(definition,$before$'^'||entity_id||$before$))<>2 then
    raise exception 'Statement-ID replacement drift: wikidata_statement_value_v1' using errcode='55000';end if;
  definition:=replace(definition,$before$'^'||entity_id||$before$,$after$'^[Qq]'||substring(entity_id from 2)||$after$);
  execute definition;
end;$successor$;

do $successor$
declare original text;definition text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.project_wikidata_film_v1(text,text,text,text,text,text)'::regprocedure;
  if md5(original)<>'f0634ef447e8214a1b2521e4195612d7' or to_regprocedure('private.project_wikidata_film_v2(text,text,text,text,text,text)') is not null then
    raise exception 'Statement-ID predecessor drift: project_wikidata_film_v1' using errcode='55000';end if;
  if cardinality(string_to_array(definition,$before$project_wikidata_film_v1$before$))<>2 then
    raise exception 'Statement-ID replacement drift: project_wikidata_film_v1' using errcode='55000';end if;
  definition:=replace(definition,$before$project_wikidata_film_v1$before$,$after$project_wikidata_film_v2$after$);
  if cardinality(string_to_array(definition,$before$wikidata_statement_value_v1$before$))<>2 then
    raise exception 'Statement-ID replacement drift: project_wikidata_film_v1' using errcode='55000';end if;
  definition:=replace(definition,$before$wikidata_statement_value_v1$before$,$after$wikidata_statement_value_v2$after$);
  execute definition;
end;$successor$;

do $successor$
declare original text;definition text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.capture_personal_rating_content_v2(jsonb,jsonb)'::regprocedure;
  if md5(original)<>'f9401e9f6c16331354a5fbd294c3a073' or to_regprocedure('private.capture_personal_rating_content_v3(jsonb,jsonb)') is not null then
    raise exception 'Statement-ID predecessor drift: capture_personal_rating_content_v2' using errcode='55000';end if;
  if cardinality(string_to_array(definition,$before$capture_personal_rating_content_v2$before$))<>2 then
    raise exception 'Statement-ID replacement drift: capture_personal_rating_content_v2' using errcode='55000';end if;
  definition:=replace(definition,$before$capture_personal_rating_content_v2$before$,$after$capture_personal_rating_content_v3$after$);
  if cardinality(string_to_array(definition,$before$Invoked by v4$before$))<>2 then
    raise exception 'Statement-ID replacement drift: capture_personal_rating_content_v2' using errcode='55000';end if;
  definition:=replace(definition,$before$Invoked by v4$before$,$after$Invoked by v5$after$);
  if cardinality(string_to_array(definition,$before$project_wikidata_film_v1$before$))<>2 then
    raise exception 'Statement-ID replacement drift: capture_personal_rating_content_v2' using errcode='55000';end if;
  definition:=replace(definition,$before$project_wikidata_film_v1$before$,$after$project_wikidata_film_v2$after$);
  if cardinality(string_to_array(definition,$before$kajo-personal-content-features-v2$before$))<>2 then
    raise exception 'Statement-ID replacement drift: capture_personal_rating_content_v2' using errcode='55000';end if;
  definition:=replace(definition,$before$kajo-personal-content-features-v2$before$,$after$kajo-personal-content-features-v3$after$);
  if cardinality(string_to_array(definition,$before$wikidata-open-library-concepts-v1$before$))<>2 then
    raise exception 'Statement-ID replacement drift: capture_personal_rating_content_v2' using errcode='55000';end if;
  definition:=replace(definition,$before$wikidata-open-library-concepts-v1$before$,$after$wikidata-open-library-concepts-v2$after$);
  if cardinality(string_to_array(definition,$before$34292c63cb0f2ee2e26df033fdf2bc0ea9628b552b4c62fe2eba82ec56a203fb$before$))<>2 then
    raise exception 'Statement-ID replacement drift: capture_personal_rating_content_v2' using errcode='55000';end if;
  definition:=replace(definition,$before$34292c63cb0f2ee2e26df033fdf2bc0ea9628b552b4c62fe2eba82ec56a203fb$before$,$after$ec790415ce0bc45cfdc5bdf5fb65b9e2c5557f98b07c6f5bf4e88b09812abf1d$after$);
  execute definition;
end;$successor$;

do $successor$
declare original text;definition text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.prepare_personal_rating_forecast_v4(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure;
  if md5(original)<>'84dc64a7841d7e75a1b6ee325f8feed5' or to_regprocedure('private.prepare_personal_rating_forecast_v5(uuid,uuid,uuid,integer,text,jsonb)') is not null then
    raise exception 'Statement-ID predecessor drift: prepare_personal_rating_forecast_v4' using errcode='55000';end if;
  if cardinality(string_to_array(definition,$before$prepare_personal_rating_forecast_v4$before$))<>3 then
    raise exception 'Statement-ID replacement drift: prepare_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$prepare_personal_rating_forecast_v4$before$,$after$prepare_personal_rating_forecast_v5$after$);
  if cardinality(string_to_array(definition,$before$kajo-personal-content-rating-preparation-v3$before$))<>3 then
    raise exception 'Statement-ID replacement drift: prepare_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$kajo-personal-content-rating-preparation-v3$before$,$after$kajo-personal-content-rating-preparation-v4$after$);
  if cardinality(string_to_array(definition,$before$personal-wikidata-content-rating-v3$before$))<>2 then
    raise exception 'Statement-ID replacement drift: prepare_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$personal-wikidata-content-rating-v3$before$,$after$personal-wikidata-content-rating-v4$after$);
  if cardinality(string_to_array(definition,$before$kajo-personal-content-rating-prefix-v3$before$))<>2 then
    raise exception 'Statement-ID replacement drift: prepare_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$kajo-personal-content-rating-prefix-v3$before$,$after$kajo-personal-content-rating-prefix-v4$after$);
  if cardinality(string_to_array(definition,$before$native-wikidata-content:$before$))<>2 then
    raise exception 'Statement-ID replacement drift: prepare_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$native-wikidata-content:$before$,$after$native-wikidata-content-v2:$after$);
  if cardinality(string_to_array(definition,$before$capture_personal_rating_content_v2$before$))<>2 then
    raise exception 'Statement-ID replacement drift: prepare_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$capture_personal_rating_content_v2$before$,$after$capture_personal_rating_content_v3$after$);
  execute definition;
end;$successor$;

do $successor$
declare original text;definition text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.finalize_personal_rating_forecast_v4(uuid,jsonb)'::regprocedure;
  if md5(original)<>'aa63c85acc361ccca54fed5ab4759bc7' or to_regprocedure('private.finalize_personal_rating_forecast_v5(uuid,jsonb)') is not null then
    raise exception 'Statement-ID predecessor drift: finalize_personal_rating_forecast_v4' using errcode='55000';end if;
  if cardinality(string_to_array(definition,$before$finalize_personal_rating_forecast_v4$before$))<>2 then
    raise exception 'Statement-ID replacement drift: finalize_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$finalize_personal_rating_forecast_v4$before$,$after$finalize_personal_rating_forecast_v5$after$);
  if cardinality(string_to_array(definition,$before$kajo-personal-content-rating-preparation-v3$before$))<>2 then
    raise exception 'Statement-ID replacement drift: finalize_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$kajo-personal-content-rating-preparation-v3$before$,$after$kajo-personal-content-rating-preparation-v4$after$);
  if cardinality(string_to_array(definition,$before$wikidata-open-library-concepts-v1$before$))<>2 then
    raise exception 'Statement-ID replacement drift: finalize_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$wikidata-open-library-concepts-v1$before$,$after$wikidata-open-library-concepts-v2$after$);
  if cardinality(string_to_array(definition,$before$34292c63cb0f2ee2e26df033fdf2bc0ea9628b552b4c62fe2eba82ec56a203fb$before$))<>2 then
    raise exception 'Statement-ID replacement drift: finalize_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$34292c63cb0f2ee2e26df033fdf2bc0ea9628b552b4c62fe2eba82ec56a203fb$before$,$after$ec790415ce0bc45cfdc5bdf5fb65b9e2c5557f98b07c6f5bf4e88b09812abf1d$after$);
  if cardinality(string_to_array(definition,$before$owned-rating-source-v3:$before$))<>2 then
    raise exception 'Statement-ID replacement drift: finalize_personal_rating_forecast_v4' using errcode='55000';end if;
  definition:=replace(definition,$before$owned-rating-source-v3:$before$,$after$owned-rating-source-v4:$after$);
  execute definition;
end;$successor$;

-- Extend only the shared training-source retirement dependency to v5 captures.
do $training_lifecycle$
declare original text;definition text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.withdraw_personal_rating_training_source_v2()'::regprocedure;
  if md5(original)<>'d6d04e67e1d5599286b330843c986841' or cardinality(string_to_array(original,$before$i.preparation->>'version' in('kajo-personal-content-rating-preparation-v2','kajo-personal-content-rating-preparation-v3')$before$))<>2 then
    raise exception 'Statement-ID training lifecycle predecessor drift' using errcode='55000';end if;
  execute replace(definition,original,replace(original,$before$i.preparation->>'version' in('kajo-personal-content-rating-preparation-v2','kajo-personal-content-rating-preparation-v3')$before$,$after$i.preparation->>'version' in('kajo-personal-content-rating-preparation-v2','kajo-personal-content-rating-preparation-v3','kajo-personal-content-rating-preparation-v4')$after$));
end;$training_lifecycle$;
revoke all on function
  private.wikidata_statement_value_v2(jsonb,text,text),private.project_wikidata_film_v2(text,text,text,text,text,text),
  private.capture_personal_rating_content_v3(jsonb,jsonb),
  private.prepare_personal_rating_forecast_v5(uuid,uuid,uuid,integer,text,jsonb),
  private.finalize_personal_rating_forecast_v5(uuid,jsonb) from public,anon,authenticated,service_role;
