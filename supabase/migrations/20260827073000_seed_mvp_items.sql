insert into public.items (
  id,
  item_type,
  title,
  description,
  tags,
  metadata
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'BOOK',
    'The Lantern Archive',
    'A quiet mystery about a coastal archive, old letters and a light that appears before storms.',
    array['mystery', 'atmospheric', 'slow-burn'],
    '{"source":"KAJO_MOCK","slug":"book-lantern-archive"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'BOOK',
    'Orbit Garden',
    'Near-future fiction about a botanist building a small living ecosystem above Earth.',
    array['science-fiction', 'hopeful', 'nature'],
    '{"source":"KAJO_MOCK","slug":"book-orbit-garden"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'BOOK',
    'Northbound Sleepers',
    'A nocturnal train journey where six strangers slowly discover why they boarded the same carriage.',
    array['literary', 'character-driven', 'night'],
    '{"source":"KAJO_MOCK","slug":"book-northbound-sleepers"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'BOOK',
    'Paper Kingdoms',
    'An unusual speculative story built from maps, marginal notes and contradictory histories.',
    array['experimental', 'fantasy', 'unusual'],
    '{"source":"KAJO_MOCK","slug":"book-paper-kingdoms"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'BOOK',
    'Small Weather',
    'A warm contemporary novel about friendship, routine and noticing small changes in ordinary days.',
    array['contemporary', 'warm', 'reflective'],
    '{"source":"KAJO_MOCK","slug":"book-small-weather"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000006',
    'BOOK',
    'Glass Animal',
    'A tense surreal fable about memory, identity and a city where every reflection behaves differently.',
    array['surreal', 'psychological', 'bold'],
    '{"source":"KAJO_MOCK","slug":"book-glass-animal"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000101',
    'MOVIE',
    'Last Light House',
    'A restrained drama about two siblings restoring an abandoned lighthouse before winter.',
    array['drama', 'atmospheric', 'family'],
    '{"source":"KAJO_MOCK","slug":"movie-last-light-house"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'MOVIE',
    'Static Summer',
    'A playful coming-of-age film about a pirate radio station operating for one impossible summer.',
    array['coming-of-age', 'music', 'playful'],
    '{"source":"KAJO_MOCK","slug":"movie-static-summer"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    'MOVIE',
    'Quiet Orbit',
    'Minimal science fiction following a repair crew during the final week of an orbital station.',
    array['science-fiction', 'minimal', 'slow-burn'],
    '{"source":"KAJO_MOCK","slug":"movie-quiet-orbit"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    'MOVIE',
    'The Red Museum',
    'A fragmented thriller in which every gallery room tells a different version of the same crime.',
    array['thriller', 'experimental', 'unusual'],
    '{"source":"KAJO_MOCK","slug":"movie-red-museum"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000105',
    'MOVIE',
    'After Rain',
    'A gentle relationship drama set during one long weekend in a nearly empty city.',
    array['romance', 'quiet', 'warm'],
    '{"source":"KAJO_MOCK","slug":"movie-after-rain"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000106',
    'MOVIE',
    'Mirror Run',
    'A kinetic surreal adventure where a courier races through overlapping versions of the same city.',
    array['surreal', 'adventure', 'bold'],
    '{"source":"KAJO_MOCK","slug":"movie-mirror-run"}'::jsonb
  );
