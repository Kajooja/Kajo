-- Synthetic real-provider-shaped Items in a disposable database, never hosted data.
insert into auth.users(id,email,raw_user_meta_data) values
 ('ab157000-0000-4000-8000-000000000001','taste-owner@example.invalid','{"kajo_nickname":"Taste owner"}'),
 ('ab157000-0000-4000-8000-000000000002','taste-other@example.invalid','{"kajo_nickname":"Taste other"}');
insert into public.items(id,item_type,title,tags,metadata)
select ('ab157000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  case when n<120 then 'MOVIE' else 'BOOK' end,'Taste fixture '||n,
  case when n%5=0 then '{}'::text[] else array['taste-'||(n%4)::text,'shared-feature'] end,
  jsonb_build_object('coldStartRecognition',(140-n)::double precision/100,'coldStartPriorSource','KAJO_CURATED_RECOGNITION')
from generate_series(100,139) n;
insert into private.item_sources(item_id,provider_key,provider_item_id)
select id,'kajo_curated',id::text from public.items where title like 'Taste fixture %';
