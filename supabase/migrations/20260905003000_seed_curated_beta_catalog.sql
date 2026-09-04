-- Sprint 014A / #182
-- First real BOOK/MOVIE beta catalog. Preserve historical mock references but
-- retire KAJO_MOCK from normal discovery after the guarded real-content seed.

do $$
declare
  r record;
  ids jsonb;
begin
  for r in
    select * from (values
      ('MOVIE','inception-2010','Inception',2010,'Christopher Nolan','science-fiction|thriller|mind-bending','tt1375666'),
      ('MOVIE','interstellar-2014','Interstellar',2014,'Christopher Nolan','science-fiction|drama|space','tt0816692'),
      ('MOVIE','matrix-1999','The Matrix',1999,'Lana Wachowski, Lilly Wachowski','science-fiction|action|cyberpunk','tt0133093'),
      ('MOVIE','dark-knight-2008','The Dark Knight',2008,'Christopher Nolan','crime|action|drama','tt0468569'),
      ('MOVIE','fight-club-1999','Fight Club',1999,'David Fincher','drama|psychological|dark','tt0137523'),
      ('MOVIE','pulp-fiction-1994','Pulp Fiction',1994,'Quentin Tarantino','crime|dark-comedy|stylized','tt0110912'),
      ('MOVIE','shawshank-1994','The Shawshank Redemption',1994,'Frank Darabont','drama|hopeful|prison','tt0111161'),
      ('MOVIE','forrest-gump-1994','Forrest Gump',1994,'Robert Zemeckis','drama|romance|feel-good','tt0109830'),
      ('MOVIE','seven-1995','Se7en',1995,'David Fincher','crime|thriller|dark','tt0114369'),
      ('MOVIE','silence-lambs-1991','The Silence of the Lambs',1991,'Jonathan Demme','thriller|crime|psychological','tt0102926'),
      ('MOVIE','gladiator-2000','Gladiator',2000,'Ridley Scott','action|drama|historical','tt0172495'),
      ('MOVIE','lotr-fellowship-2001','The Lord of the Rings: The Fellowship of the Ring',2001,'Peter Jackson','fantasy|adventure|epic','tt0120737'),
      ('MOVIE','lotr-two-towers-2002','The Lord of the Rings: The Two Towers',2002,'Peter Jackson','fantasy|adventure|epic','tt0167261'),
      ('MOVIE','lotr-return-king-2003','The Lord of the Rings: The Return of the King',2003,'Peter Jackson','fantasy|adventure|epic','tt0167260'),
      ('MOVIE','parasite-2019','Parasite',2019,'Bong Joon Ho','thriller|drama|satire','tt6751668'),
      ('MOVIE','whiplash-2014','Whiplash',2014,'Damien Chazelle','drama|music|intense','tt2582802'),
      ('MOVIE','arrival-2016','Arrival',2016,'Denis Villeneuve','science-fiction|drama|thoughtful','tt2543164'),
      ('MOVIE','blade-runner-2049-2017','Blade Runner 2049',2017,'Denis Villeneuve','science-fiction|neo-noir|slow-burn','tt1856101'),
      ('MOVIE','dune-2021','Dune',2021,'Denis Villeneuve','science-fiction|adventure|epic','tt1160419'),
      ('MOVIE','dune-part-two-2024','Dune: Part Two',2024,'Denis Villeneuve','science-fiction|adventure|epic','tt15239678'),
      ('MOVIE','everything-everywhere-2022','Everything Everywhere All at Once',2022,'Daniel Kwan, Daniel Scheinert','science-fiction|comedy|experimental','tt6710474'),
      ('MOVIE','oppenheimer-2023','Oppenheimer',2023,'Christopher Nolan','drama|history|biography','tt15398776'),
      ('MOVIE','la-la-land-2016','La La Land',2016,'Damien Chazelle','romance|music|drama','tt3783958'),
      ('MOVIE','mad-max-fury-road-2015','Mad Max: Fury Road',2015,'George Miller','action|adventure|post-apocalyptic','tt1392190'),
      ('MOVIE','her-2013','Her',2013,'Spike Jonze','science-fiction|romance|melancholic','tt1798709'),
      ('MOVIE','eternal-sunshine-2004','Eternal Sunshine of the Spotless Mind',2004,'Michel Gondry','romance|science-fiction|melancholic','tt0338013'),
      ('MOVIE','memento-2000','Memento',2000,'Christopher Nolan','thriller|mystery|mind-bending','tt0209144'),
      ('MOVIE','prestige-2006','The Prestige',2006,'Christopher Nolan','mystery|drama|dark','tt0482571'),
      ('MOVIE','prisoners-2013','Prisoners',2013,'Denis Villeneuve','thriller|crime|dark','tt1392214'),
      ('MOVIE','gone-girl-2014','Gone Girl',2014,'David Fincher','thriller|mystery|dark','tt2267998'),
      ('BOOK','1984-1949','Nineteen Eighty-Four',1949,'George Orwell','dystopian|science-fiction|political',null),
      ('BOOK','animal-farm-1945','Animal Farm',1945,'George Orwell','satire|political|classic',null),
      ('BOOK','pride-prejudice-1813','Pride and Prejudice',1813,'Jane Austen','romance|classic|society',null),
      ('BOOK','jane-eyre-1847','Jane Eyre',1847,'Charlotte Brontë','classic|romance|gothic',null),
      ('BOOK','wuthering-heights-1847','Wuthering Heights',1847,'Emily Brontë','classic|romance|gothic',null),
      ('BOOK','great-gatsby-1925','The Great Gatsby',1925,'F. Scott Fitzgerald','classic|drama|society',null),
      ('BOOK','mockingbird-1960','To Kill a Mockingbird',1960,'Harper Lee','classic|drama|justice',null),
      ('BOOK','catcher-rye-1951','The Catcher in the Rye',1951,'J. D. Salinger','classic|coming-of-age|literary',null),
      ('BOOK','brave-new-world-1932','Brave New World',1932,'Aldous Huxley','dystopian|science-fiction|classic',null),
      ('BOOK','fahrenheit-451-1953','Fahrenheit 451',1953,'Ray Bradbury','dystopian|science-fiction|classic',null),
      ('BOOK','hobbit-1937','The Hobbit',1937,'J. R. R. Tolkien','fantasy|adventure|classic',null),
      ('BOOK','lotr-fellowship-1954','The Fellowship of the Ring',1954,'J. R. R. Tolkien','fantasy|adventure|epic',null),
      ('BOOK','lotr-two-towers-1954','The Two Towers',1954,'J. R. R. Tolkien','fantasy|adventure|epic',null),
      ('BOOK','lotr-return-king-1955','The Return of the King',1955,'J. R. R. Tolkien','fantasy|adventure|epic',null),
      ('BOOK','dune-book-1965','Dune',1965,'Frank Herbert','science-fiction|epic|political',null),
      ('BOOK','foundation-1951','Foundation',1951,'Isaac Asimov','science-fiction|space|classic',null),
      ('BOOK','neuromancer-1984','Neuromancer',1984,'William Gibson','science-fiction|cyberpunk|dark',null),
      ('BOOK','left-hand-darkness-1969','The Left Hand of Darkness',1969,'Ursula K. Le Guin','science-fiction|literary|society',null),
      ('BOOK','handmaids-tale-1985','The Handmaid''s Tale',1985,'Margaret Atwood','dystopian|literary|political',null),
      ('BOOK','road-2006','The Road',2006,'Cormac McCarthy','post-apocalyptic|literary|dark',null),
      ('BOOK','never-let-me-go-2005','Never Let Me Go',2005,'Kazuo Ishiguro','science-fiction|literary|melancholic',null),
      ('BOOK','remains-day-1989','The Remains of the Day',1989,'Kazuo Ishiguro','literary|drama|melancholic',null),
      ('BOOK','norwegian-wood-1987','Norwegian Wood',1987,'Haruki Murakami','literary|romance|melancholic',null),
      ('BOOK','kafka-shore-2002','Kafka on the Shore',2002,'Haruki Murakami','literary|surreal|mystery',null),
      ('BOOK','wind-up-bird-1994','The Wind-Up Bird Chronicle',1994,'Haruki Murakami','literary|surreal|mystery',null),
      ('BOOK','name-of-rose-1980','The Name of the Rose',1980,'Umberto Eco','mystery|historical|literary',null),
      ('BOOK','shadow-wind-2001','The Shadow of the Wind',2001,'Carlos Ruiz Zafón','mystery|historical|gothic',null),
      ('BOOK','secret-history-1992','The Secret History',1992,'Donna Tartt','literary|mystery|dark-academia',null),
      ('BOOK','goldfinch-2013','The Goldfinch',2013,'Donna Tartt','literary|drama|coming-of-age',null),
      ('BOOK','gone-girl-book-2012','Gone Girl',2012,'Gillian Flynn','thriller|mystery|dark',null)
    ) as seed(item_type, slug, title, release_year, creator, tag_pipe, imdb_id)
  loop
    ids := jsonb_build_object('kajo_curated_slug', r.slug);
    if r.imdb_id is not null then
      ids := ids || jsonb_build_object('imdb_title', r.imdb_id);
    end if;

    perform public.upsert_catalog_item_v1(
      provider_key => 'kajo_curated',
      provider_item_id => r.slug,
      item_type => r.item_type,
      title => r.title,
      tags => string_to_array(r.tag_pipe, '|'),
      metadata => jsonb_build_object(
        'source', 'KAJO_CURATED_BETA',
        'curationVersion', 'beta-v1'
      ),
      creators => string_to_array(r.creator, ', '),
      release_year => r.release_year,
      external_ids => ids,
      source_url => case
        when r.imdb_id is not null then 'https://www.imdb.com/title/' || r.imdb_id || '/'
        else null
      end,
      source_payload => jsonb_build_object('curated', true),
      discoverable => true
    );
  end loop;

  if (
    select count(*) from public.items
    where item_type = 'MOVIE'
      and discoverable
      and coalesce(metadata ->> 'source', '') <> 'KAJO_MOCK'
  ) < 30 then
    raise exception 'Real MOVIE beta catalog coverage gate failed';
  end if;

  if (
    select count(*) from public.items
    where item_type = 'BOOK'
      and discoverable
      and coalesce(metadata ->> 'source', '') <> 'KAJO_MOCK'
  ) < 30 then
    raise exception 'Real BOOK beta catalog coverage gate failed';
  end if;

  update public.items
  set discoverable = false
  where metadata ->> 'source' = 'KAJO_MOCK';
end;
$$;
