-- Sprint 014A / #182
-- First real BOOK/MOVIE beta catalog. Preserve historical mock references but
-- retire KAJO_MOCK from normal discovery after the guarded real-content seed.

do $$
declare r record;
declare ids jsonb;
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
('MOVIE','no-country-2007','No Country for Old Men',2007,'Joel Coen, Ethan Coen','crime|thriller|bleak','tt0477348'),
('MOVIE','there-will-be-blood-2007','There Will Be Blood',2007,'Paul Thomas Anderson','drama|historical|dark','tt0469494'),
('MOVIE','departed-2006','The Departed',2006,'Martin Scorsese','crime|thriller|drama','tt0407887'),
('MOVIE','goodfellas-1990','Goodfellas',1990,'Martin Scorsese','crime|drama|gangster','tt0099685'),
('MOVIE','godfather-1972','The Godfather',1972,'Francis Ford Coppola','crime|drama|classic','tt0068646'),
('MOVIE','alien-1979','Alien',1979,'Ridley Scott','science-fiction|horror|suspense','tt0078748'),
('MOVIE','terminator-2-1991','Terminator 2: Judgment Day',1991,'James Cameron','science-fiction|action|thriller','tt0103064'),
('MOVIE','jurassic-park-1993','Jurassic Park',1993,'Steven Spielberg','adventure|science-fiction|family','tt0107290'),
('MOVIE','spirited-away-2001','Spirited Away',2001,'Hayao Miyazaki','animation|fantasy|adventure','tt0245429'),
('MOVIE','social-network-2010','The Social Network',2010,'David Fincher','drama|biography|technology','tt1285016'),
('MOVIE','moonlight-2016','Moonlight',2016,'Barry Jenkins','drama|coming-of-age|intimate','tt4975722'),
('MOVIE','grand-budapest-2014','The Grand Budapest Hotel',2014,'Wes Anderson','comedy|adventure|stylized','tt2278388'),
('MOVIE','pans-labyrinth-2006','Pan''s Labyrinth',2006,'Guillermo del Toro','fantasy|drama|dark','tt0457430'),
('MOVIE','children-of-men-2006','Children of Men',2006,'Alfonso Cuarón','science-fiction|thriller|dystopian','tt0206634'),
('MOVIE','truman-show-1998','The Truman Show',1998,'Peter Weir','drama|comedy|satire','tt0120382'),
('MOVIE','groundhog-day-1993','Groundhog Day',1993,'Harold Ramis','comedy|romance|feel-good','tt0107048'),
('MOVIE','fargo-1996','Fargo',1996,'Joel Coen','crime|dark-comedy|thriller','tt0116282'),
('MOVIE','oldboy-2003','Oldboy',2003,'Park Chan-wook','thriller|mystery|dark','tt0364569'),
('MOVIE','city-of-god-2002','City of God',2002,'Fernando Meirelles, Kátia Lund','crime|drama|intense','tt0317248'),
('MOVIE','amelie-2001','Amélie',2001,'Jean-Pierre Jeunet','romance|comedy|whimsical','tt0211915'),
('MOVIE','get-out-2017','Get Out',2017,'Jordan Peele','horror|thriller|satire','tt5052448'),
('MOVIE','ex-machina-2014','Ex Machina',2014,'Alex Garland','science-fiction|thriller|psychological','tt0470752'),
('MOVIE','hereditary-2018','Hereditary',2018,'Ari Aster','horror|drama|dark','tt7784604'),
('MOVIE','coco-2017','Coco',2017,'Lee Unkrich','animation|family|music','tt2380307'),
('MOVIE','wall-e-2008','WALL·E',2008,'Andrew Stanton','animation|science-fiction|family','tt0910970'),
('MOVIE','tuntematon-sotilas-2017','Tuntematon sotilas',2017,'Aku Louhimies','war|drama|finnish',null),
('MOVIE','rare-exports-2010','Rare Exports',2010,'Jalmari Helander','horror|comedy|finnish','tt1401143'),
('MOVIE','sisu-2022','Sisu',2022,'Jalmari Helander','action|war|finnish','tt14846026'),
('MOVIE','mies-vailla-menneisyytta-2002','Mies vailla menneisyyttä',2002,'Aki Kaurismäki','drama|comedy|finnish','tt0311519'),
('MOVIE','kuolleet-lehdet-2023','Kuolleet lehdet',2023,'Aki Kaurismäki','drama|romance|finnish',null),
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
('BOOK','gone-girl-book-2012','Gone Girl',2012,'Gillian Flynn','thriller|mystery|dark',null),
('BOOK','girl-dragon-tattoo-2005','The Girl with the Dragon Tattoo',2005,'Stieg Larsson','crime|thriller|mystery',null),
('BOOK','shining-1977','The Shining',1977,'Stephen King','horror|psychological|classic',null),
('BOOK','it-1986','It',1986,'Stephen King','horror|coming-of-age|dark',null),
('BOOK','pet-sematary-1983','Pet Sematary',1983,'Stephen King','horror|dark|supernatural',null),
('BOOK','haunting-hill-house-1959','The Haunting of Hill House',1959,'Shirley Jackson','horror|gothic|psychological',null),
('BOOK','frankenstein-1818','Frankenstein',1818,'Mary Shelley','classic|gothic|science-fiction',null),
('BOOK','dracula-1897','Dracula',1897,'Bram Stoker','classic|gothic|horror',null),
('BOOK','master-margarita-1967','The Master and Margarita',1967,'Mikhail Bulgakov','literary|satire|surreal',null),
('BOOK','one-hundred-solitude-1967','One Hundred Years of Solitude',1967,'Gabriel García Márquez','literary|magical-realism|family',null),
('BOOK','love-time-cholera-1985','Love in the Time of Cholera',1985,'Gabriel García Márquez','literary|romance|historical',null),
('BOOK','beloved-1987','Beloved',1987,'Toni Morrison','literary|historical|drama',null),
('BOOK','color-purple-1982','The Color Purple',1982,'Alice Walker','literary|drama|historical',null),
('BOOK','little-life-2015','A Little Life',2015,'Hanya Yanagihara','literary|drama|dark',null),
('BOOK','normal-people-2018','Normal People',2018,'Sally Rooney','literary|romance|contemporary',null),
('BOOK','circe-2018','Circe',2018,'Madeline Miller','fantasy|mythology|literary',null),
('BOOK','song-achilles-2011','The Song of Achilles',2011,'Madeline Miller','fantasy|romance|mythology',null),
('BOOK','station-eleven-2014','Station Eleven',2014,'Emily St. John Mandel','post-apocalyptic|literary|science-fiction',null),
('BOOK','project-hail-mary-2021','Project Hail Mary',2021,'Andy Weir','science-fiction|space|adventure',null),
('BOOK','martian-2011','The Martian',2011,'Andy Weir','science-fiction|space|adventure',null),
('BOOK','three-body-2006','The Three-Body Problem',2006,'Liu Cixin','science-fiction|hard-science-fiction|mystery',null),
('BOOK','sapiens-2011','Sapiens',2011,'Yuval Noah Harari','nonfiction|history|society',null),
('BOOK','thinking-fast-slow-2011','Thinking, Fast and Slow',2011,'Daniel Kahneman','nonfiction|psychology|decision-making',null),
('BOOK','atomic-habits-2018','Atomic Habits',2018,'James Clear','nonfiction|self-development|habits',null),
('BOOK','educated-2018','Educated',2018,'Tara Westover','memoir|nonfiction|coming-of-age',null),
('BOOK','sinuhe-1945','Sinuhe egyptiläinen',1945,'Mika Waltari','historical|literary|finnish',null),
('BOOK','tuntematon-sotilas-book-1954','Tuntematon sotilas',1954,'Väinö Linna','war|literary|finnish',null),
('BOOK','taalla-pohjantahden-alla-1959','Täällä Pohjantähden alla',1959,'Väinö Linna','historical|literary|finnish',null),
('BOOK','seitseman-veljesta-1870','Seitsemän veljestä',1870,'Aleksis Kivi','classic|literary|finnish',null),
('BOOK','puhdistus-2008','Puhdistus',2008,'Sofi Oksanen','historical|literary|finnish',null),
('BOOK','janiksen-vuosi-1975','Jäniksen vuosi',1975,'Arto Paasilinna','comedy|literary|finnish',null)
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
        when r.imdb_id is not null
          then 'https://www.imdb.com/title/' || r.imdb_id || '/'
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
  ) < 50 then
    raise exception 'Real MOVIE beta catalog coverage gate failed';
  end if;

  if (
    select count(*) from public.items
    where item_type = 'BOOK'
      and discoverable
      and coalesce(metadata ->> 'source', '') <> 'KAJO_MOCK'
  ) < 50 then
    raise exception 'Real BOOK beta catalog coverage gate failed';
  end if;

  update public.items
  set discoverable = false
  where metadata ->> 'source' = 'KAJO_MOCK';
end;
$$;
