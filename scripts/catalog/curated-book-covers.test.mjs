import assert from 'node:assert/strict';
import test from 'node:test';
import Jimp from 'jimp-compact';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from '../database/fresh-installation.mjs';
import { COVER_REPAIR_VERSION, sha256, verifyCoverMapping, prepareCoverRepair,
  buildCoverRepairSql } from './curated-book-covers.mjs';

const bytes = value => Buffer.from(JSON.stringify(value));
async function fixture() {
  const image = await new Jimp(120, 180, 0x334455ff).getBufferAsync(Jimp.MIME_JPEG);
  const evidence = {
    work: bytes({ key: '/works/OL1W', type: { key: '/type/work' }, title: 'Fixture Book',
      authors: [{ author: { key: '/authors/OL3A' } }] }),
    edition: bytes({ key: '/books/OL2M', type: { key: '/type/edition' }, title: 'Fixture Book',
      works: [{ key: '/works/OL1W' }], languages: [{ key: '/languages/eng' }], covers: [4] }),
    authors: { OL3A: bytes({ key: '/authors/OL3A', type: { key: '/type/author' }, name: 'Fixture Author' }) },
    image,
  };
  const mapping = { slug: 'fixture-book-2000', title: 'Fixture Book', creators: ['Fixture Author'],
    releaseYear: 2000, workId: 'OL1W', editionId: 'OL2M', coverId: 4,
    workSha256: sha256(evidence.work), editionSha256: sha256(evidence.edition),
    authors: [{ id: 'OL3A', sha256: sha256(evidence.authors.OL3A) }],
    imageSha256: sha256(image), width: 120, height: 180,
    review: { identity: true, cover: true, notes: 'Synthetic test only.' } };
  const manifest = { version: COVER_REPAIR_VERSION, verifiedAt: '2026-10-25T12:00:00Z', rows: [mapping] };
  return { evidence, mapping, manifest };
}

test('verified Work → Edition → real decoded cover produces attributed presentation only', async () => {
  const { mapping, evidence } = await fixture();
  const result = await verifyCoverMapping(mapping, evidence);
  assert.equal(result.sourceUrl, 'https://openlibrary.org/books/OL2M');
  assert.equal(result.imageSha256, mapping.imageSha256);
  assert.equal(result.verificationVersion, COVER_REPAIR_VERSION);
});

test('rejects changed source, wrong Work/Edition/author, missing visual review and broken images', async () => {
  const original = await fixture();
  const cases = [
    [m => { m.review.cover = false; }, /visual cover review/],
    [m => { m.workSha256 = '0'.repeat(64); }, /provider bytes changed/],
    [m => { m.workId = 'OL9W'; }, /provider identity/],
    [m => { m.coverId = 99; }, /exact Edition/],
    [m => { m.creators = ['Wrong Author']; }, /creator mismatch/],
    [m => { m.width = 121; }, /deep-equal/],
  ];
  for (const [mutate, error] of cases) {
    const mapping = structuredClone(original.mapping); mutate(mapping);
    await assert.rejects(verifyCoverMapping(mapping, original.evidence), error);
  }
  for (const change of [
    e => { e.works = [{ key: '/works/OL9W' }]; },
    e => { e.works.push({ key: '/works/OL9W' }); },
    e => { e.languages = [{ key: '/languages/fin' }]; },
    e => { e.authors = [{ key: '/authors/OL9A' }]; },
    e => { e.physical_format = 'Audio CD'; },
    e => { delete e.title; },
    e => { e.location = '/books/OL9M'; },
  ]) {
    const evidence = { ...original.evidence }; const mapping = structuredClone(original.mapping);
    const edition = JSON.parse(evidence.edition); change(edition);
    evidence.edition = bytes(edition); mapping.editionSha256 = sha256(evidence.edition);
    await assert.rejects(verifyCoverMapping(mapping, evidence));
  }
  const invalid = Buffer.from([0xff, 0xd8, 0, 0, 0xff, 0xd9]);
  await assert.rejects(verifyCoverMapping({ ...original.mapping, imageSha256: sha256(invalid) },
    { ...original.evidence, image: invalid }));
});

async function catalog() {
  const db = new PGlite();
  await db.exec(`create schema private;
    create table public.items(id uuid primary key,item_type text,title text,creators text[],
      release_year int,image_url text,metadata jsonb,discoverable boolean,updated_at timestamptz default now());
    create table private.item_sources(item_id uuid references public.items(id),provider_key text,
      provider_item_id text,unique(provider_key,provider_item_id));
    create table public.fixture_ratings(item_id uuid references public.items(id),rating int);
    insert into public.items values
      ('00000000-0000-0000-0000-000000000001','BOOK','Fixture Book',array['Fixture Author'],2000,null,
       '{"source":"KAJO_CURATED_BETA","coldStartRecognition":0.9000}',true,'2026-10-24'),
      ('00000000-0000-0000-0000-000000000002','MOVIE','Other Item',array['Other'],2020,'existing.jpg','{}',true,'2026-10-24');
    insert into private.item_sources values ('00000000-0000-0000-0000-000000000001','kajo_curated','fixture-book-2000');
    insert into public.fixture_ratings values ('00000000-0000-0000-0000-000000000001',4);`);
  return db;
}
const snapshot = async db => (await db.query(`select
  (select jsonb_agg(to_jsonb(i) order by id) from public.items i) items,
  (select jsonb_agg(to_jsonb(s)) from private.item_sources s) sources,
  (select jsonb_agg(to_jsonb(r)) from public.fixture_ratings r) ratings`)).rows[0];

test('atomic SQL preserves Item identity, ratings, prior metadata and non-target rows; exact replay is inert', async () => {
  const db = await catalog();
  try {
    const { manifest, evidence } = await fixture(); const before = await snapshot(db);
    const sql = await prepareCoverRepair(manifest, [{ slug: manifest.rows[0].slug, item: before.items[0] }], async () => evidence);
    await db.exec(sql);
    const after = await snapshot(db);
    assert.equal((await db.query("select (metadata->'coldStartRecognition')::text value from public.items where item_type='BOOK'")).rows[0].value,
      '0.9000', 'preserve existing JSONB numeric representation when adding attribution');
    assert.equal(after.items[0].image_url, 'https://covers.openlibrary.org/b/id/4-L.jpg?default=false');
    assert.equal(after.items[0].metadata.coverAttribution.editionId, 'OL2M');
    const restored = structuredClone(after);
    restored.items[0].image_url = null; delete restored.items[0].metadata.coverAttribution;
    assert.deepEqual(restored, before);
    await db.exec(sql); assert.deepEqual(await snapshot(db), after);
  } finally { await db.close(); }
});

test('stale later target rolls back earlier updates; source reassignment also rejects the batch', async () => {
  const db = await catalog();
  try {
    const { mapping, evidence } = await fixture(); const before = await snapshot(db);
    const attribution = await verifyCoverMapping(mapping, evidence);
    const valid = { slug: mapping.slug, expected: before.items[0], imageUrl: 'cover.jpg', attribution };
    const sql = buildCoverRepairSql([valid, { ...valid, slug: 'missing' }]);
    await assert.rejects(db.exec(sql), /source identity changed/);
    await db.exec('rollback'); assert.deepEqual(await snapshot(db), before);
    await db.exec(`update public.items set title='Changed' where item_type='BOOK'`);
    const changed = await snapshot(db);
    await assert.rejects(db.exec(buildCoverRepairSql([valid])), /stale Item snapshot/);
    await db.exec('rollback'); assert.deepEqual(await snapshot(db), changed);
  } finally { await db.close(); }
});

test('manifest rejects duplicate identities, mismatched targets and overwriting existing covers', async () => {
  const db = await catalog();
  try {
    const { manifest, evidence } = await fixture(); const before = await snapshot(db);
    const target = { slug: manifest.rows[0].slug, item: before.items[0] };
    await assert.rejects(prepareCoverRepair({ ...manifest, rows: [...manifest.rows, ...manifest.rows] }, [target], async () => evidence), /duplicate target/);
    await assert.rejects(prepareCoverRepair(manifest, [], async () => evidence), /exact target set/);
    target.item.image_url = 'existing.jpg';
    await assert.rejects(prepareCoverRepair(manifest, [target], async () => evidence), /overwrite/);
  } finally { await db.close(); }
});

test('SQL literal quotes and procedural delimiters cannot become executable content', async () => {
  const db = await catalog();
  try {
    const before = await snapshot(db);
    const entry = { slug: 'fixture-book-2000', expected: before.items[0], imageUrl: 'cover.jpg',
      attribution: { text: "quote' \\ $repair$; drop table public.fixture_ratings; --" } };
    await db.exec(buildCoverRepairSql([entry]));
    const after = await snapshot(db);
    assert.deepEqual(after.ratings, before.ratings);
    assert.deepEqual(after.items[0].metadata.coverAttribution, entry.attribution);
  } finally { await db.close(); }
});

test('repair on the full current schema changes only cover presentation under real triggers', async () => {
  const db = new PGlite();
  try {
    const installation = await buildFreshInstallation();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of installation.files) await db.exec(`begin; ${file.sql} commit;`);
    await db.exec(`insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000007','cover-fixture@example.test');
      insert into public.items(id,item_type,title,creators,release_year,metadata)
        values ('00000000-0000-0000-0000-000000000001','BOOK','Fixture Book',array['Fixture Author'],2000,
          '{"source":"KAJO_CURATED_BETA","coldStartRecognition":0.9}');
      insert into private.item_sources(item_id,provider_key,provider_item_id)
        values ('00000000-0000-0000-0000-000000000001','kajo_curated','fixture-book-2000');
      insert into public.item_interactions(profile_id,item_id,actor_user_id,interest)
        select id,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000007','LIKED'
        from public.profiles where profile_type='PERSONAL';`);
    const tableRows = async () => {
      const tables = (await db.query(`select schemaname,tablename from pg_tables
        where schemaname in ('public','private','auth') order by schemaname,tablename`)).rows;
      const result = {};
      for (const { schemaname, tablename } of tables) {
        assert.match(schemaname + '.' + tablename, /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/);
        result[schemaname + '.' + tablename] = (await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') data
          from "${schemaname}"."${tablename}" t`)).rows[0].data;
      }
      return result;
    };
    const before = await tableRows(); const { manifest, evidence } = await fixture();
    const sql = await prepareCoverRepair(manifest,
      [{ slug: 'fixture-book-2000', item: before['public.items'][0] }], async () => evidence);
    await db.exec(sql);
    const after = await tableRows();
    assert.ok(after['public.items'][0].image_url);
    after['public.items'][0].image_url = before['public.items'][0].image_url;
    after['public.items'][0].updated_at = before['public.items'][0].updated_at;
    delete after['public.items'][0].metadata.coverAttribution;
    assert.deepEqual(after, before, 'all auth, Profile, rating, catalog source and engine rows remain unchanged');
  } finally { await db.close(); }
});
