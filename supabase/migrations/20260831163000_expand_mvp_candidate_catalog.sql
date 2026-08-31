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
    '00000000-0000-4000-8000-000000000007',
    'BOOK',
    'Tide Signal',
    'A coastal suspense novel about a radio operator who starts receiving warnings from tomorrow.',
    array['thriller', 'coastal', 'tense'],
    '{"source":"KAJO_MOCK","slug":"book-tide-signal"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000008',
    'BOOK',
    'Ember Atlas',
    'An adventurous fantasy about cartographers mapping a warm volcanic archipelago that keeps changing shape.',
    array['fantasy', 'adventure', 'warm'],
    '{"source":"KAJO_MOCK","slug":"book-ember-atlas"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000009',
    'BOOK',
    'Zero Chorus',
    'Experimental science fiction told through the rehearsals of a choir trying to communicate with a silent machine.',
    array['science-fiction', 'experimental', 'music'],
    '{"source":"KAJO_MOCK","slug":"book-zero-chorus"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000010',
    'BOOK',
    'Winter Orchard',
    'A reflective family novel about three generations returning to an orchard during its final winter.',
    array['literary', 'family', 'reflective'],
    '{"source":"KAJO_MOCK","slug":"book-winter-orchard"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000011',
    'BOOK',
    'Signal Below',
    'A psychological horror story about a research team hearing impossible messages beneath polar ice.',
    array['horror', 'psychological', 'dark'],
    '{"source":"KAJO_MOCK","slug":"book-signal-below"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    'BOOK',
    'Borrowed Hours',
    'A playful contemporary romance in which two strangers repeatedly inherit the same hour of free time.',
    array['romance', 'playful', 'contemporary'],
    '{"source":"KAJO_MOCK","slug":"book-borrowed-hours"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000107',
    'MOVIE',
    'Blue Static',
    'A tense technology thriller about a citywide signal that appears only on abandoned television channels.',
    array['thriller', 'technology', 'tense'],
    '{"source":"KAJO_MOCK","slug":"movie-blue-static"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000108',
    'MOVIE',
    'Soft Gravity',
    'Hopeful science-fiction romance following two engineers maintaining a drifting research habitat.',
    array['science-fiction', 'romance', 'hopeful'],
    '{"source":"KAJO_MOCK","slug":"movie-soft-gravity"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000109',
    'MOVIE',
    'Midnight Orchard',
    'An atmospheric slow-burn horror film set in an orchard where the trees bloom only after midnight.',
    array['horror', 'atmospheric', 'slow-burn'],
    '{"source":"KAJO_MOCK","slug":"movie-midnight-orchard"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000110',
    'MOVIE',
    'Paper Planets',
    'An imaginative animated family film about siblings building a universe from discarded maps.',
    array['animation', 'family', 'imaginative'],
    '{"source":"KAJO_MOCK","slug":"movie-paper-planets"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000111',
    'MOVIE',
    'North Glass',
    'A reflective documentary following winter light, wildlife and isolated communities above the Arctic Circle.',
    array['documentary', 'nature', 'reflective'],
    '{"source":"KAJO_MOCK","slug":"movie-north-glass"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000112',
    'MOVIE',
    'Uncommon Frequency',
    'A bold experimental music film assembled from one concert heard differently by every person in the room.',
    array['experimental', 'music', 'bold'],
    '{"source":"KAJO_MOCK","slug":"movie-uncommon-frequency"}'::jsonb
  )
on conflict (id) do nothing;
