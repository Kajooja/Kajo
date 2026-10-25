// Presentation-only repair: never insert Items, ratings, users or provider aliases.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Jimp from 'jimp-compact';

export const COVER_REPAIR_VERSION = 'curated-book-cover-v1';
export const COVER_REPAIR_TARGETS_SQL = `select s.provider_item_id as slug, to_jsonb(i) as item
from public.items i join private.item_sources s on s.item_id=i.id
where i.item_type='BOOK' and i.discoverable and nullif(btrim(i.image_url),'') is null
  and s.provider_key='kajo_curated' order by s.provider_item_id;`;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const normalized = value => String(value).normalize('NFKD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const same = (left, right) => normalized(left) === normalized(right);
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const record = (bytes, key, type, hash) => {
  assert.ok(Buffer.isBuffer(bytes) && bytes.length <= 2_000_000, 'bounded provider record required');
  assert.equal(sha256(bytes), hash, 'provider bytes changed since review');
  const value = JSON.parse(bytes.toString('utf8'));
  assert.equal(value.key, key, 'provider identity mismatch');
  assert.equal(value.type?.key, `/type/${type}`, 'provider record type mismatch');
  assert.ok(!value.location || value.location === key, 'redirect requires identity review');
  return value;
};

// Re-read and decode the exact reviewed bytes. A URL or a JPEG header is not
// evidence that the image is usable. Files are operator inputs, not Git fixtures.
export async function verifyCoverMapping(mapping, evidence) {
  assert.match(mapping.slug, /^[a-z0-9-]+$/);
  assert.match(mapping.workId, /^OL\d+W$/);
  assert.match(mapping.editionId, /^OL\d+M$/);
  assert.ok(Number.isSafeInteger(mapping.coverId) && mapping.coverId > 0);
  assert.ok(typeof mapping.title === 'string' && mapping.title.trim());
  assert.ok(Array.isArray(mapping.creators) && mapping.creators.length === 1);
  assert.ok(Number.isInteger(mapping.releaseYear));
  assert.ok(mapping.review?.identity === true && mapping.review?.cover === true,
    'explicit identity and visual cover review required');
  assert.ok(typeof mapping.review.notes === 'string' && mapping.review.notes.trim());
  const work = record(evidence.work, `/works/${mapping.workId}`, 'work', mapping.workSha256);
  const edition = record(evidence.edition, `/books/${mapping.editionId}`, 'edition', mapping.editionSha256);
  assert.ok(typeof work.title === 'string' && work.title.trim());
  assert.ok(typeof edition.title === 'string' && edition.title.trim());
  assert.ok(same(work.title, mapping.title) || (mapping.review.workTitle && same(work.title, mapping.review.workTitle)),
    'work title requires an explicit reviewed variant');
  assert.ok(same(edition.title, mapping.title) || (mapping.review.editionTitle && same(edition.title, mapping.review.editionTitle)),
    'edition title requires an explicit reviewed variant');
  assert.deepEqual(edition.works, [{ key: `/works/${mapping.workId}` }], 'edition must belong to this one Work');
  assert.ok(!/audio|cassette|compact disc|mp3|cd-rom/i.test(`${edition.title} ${edition.physical_format ?? ''}`),
    'audio/software packaging is not a print book cover');
  assert.ok(edition.languages?.some(value => value.key === '/languages/eng'), 'English display edition required');
  assert.ok(edition.covers?.includes(mapping.coverId), 'cover must belong to the exact Edition');
  assert.ok(Array.isArray(mapping.authors) && mapping.authors.length > 0);
  const workAuthors = work.authors?.map(value => value.author?.key).sort();
  assert.deepEqual(workAuthors, mapping.authors.map(value => `/authors/${value.id}`).sort(),
    'all Work authors must be reviewed');
  const authors = mapping.authors.map(author => {
    assert.match(author.id, /^OL\d+A$/);
    return record(evidence.authors[author.id], `/authors/${author.id}`, 'author', author.sha256);
  });
  const creatorAuthors = authors.filter(author => same(author.name, mapping.creators[0])
    || author.alternate_names?.some(name => same(name, mapping.creators[0])));
  assert.ok(creatorAuthors.length > 0, 'canonical creator mismatch');
  assert.ok(!edition.authors?.length || edition.authors.some(author =>
    creatorAuthors.some(creator => creator.key === author.key)), 'edition creator mismatch');
  assert.ok(Buffer.isBuffer(evidence.image) && evidence.image.length <= 5_000_000);
  assert.equal(sha256(evidence.image), mapping.imageSha256, 'cover bytes changed since visual review');
  assert.equal(evidence.image[0], 0xff, 'JPEG required');
  assert.equal(evidence.image[1], 0xd8, 'JPEG required');
  const image = await Jimp.read(evidence.image);
  assert.deepEqual([image.bitmap.width, image.bitmap.height], [mapping.width, mapping.height]);
  assert.ok(mapping.width >= 100 && mapping.height >= 150
    && mapping.width <= 2500 && mapping.height <= 3500, 'unusable cover dimensions');
  return {
    provider: 'open_library', workId: mapping.workId, editionId: mapping.editionId,
    coverId: mapping.coverId, sourceUrl: `https://openlibrary.org/books/${mapping.editionId}`,
    imageSha256: mapping.imageSha256, width: mapping.width, height: mapping.height,
    verificationVersion: COVER_REPAIR_VERSION,
  };
}

export async function prepareCoverRepair(manifest, targets, loadEvidence) {
  assert.equal(manifest.version, COVER_REPAIR_VERSION);
  assert.ok(Number.isFinite(Date.parse(manifest.verifiedAt)), 'verification time required');
  assert.ok(Array.isArray(manifest.rows) && manifest.rows.length > 0 && manifest.rows.length <= 30);
  assert.equal(new Set(manifest.rows.map(row => row.slug)).size, manifest.rows.length, 'duplicate target');
  assert.equal(new Set(manifest.rows.map(row => row.workId)).size, manifest.rows.length, 'duplicate Work');
  assert.equal(targets.length, manifest.rows.length, 'exact target set required');
  assert.equal(new Set(targets.map(row => row.item?.id)).size, targets.length, 'duplicate Item');
  const entries = [];
  for (const mapping of manifest.rows) {
    const target = targets.find(row => row.slug === mapping.slug);
    assert.ok(target?.item, 'target source identity missing');
    const item = target.item;
    assert.match(item.id, /^[0-9a-f-]{36}$/);
    assert.equal(item.item_type, 'BOOK');
    assert.equal(item.title, mapping.title);
    assert.deepEqual(item.creators, mapping.creators);
    assert.equal(item.release_year, mapping.releaseYear);
    assert.equal(item.metadata?.source, 'KAJO_CURATED_BETA');
    assert.equal(item.discoverable, true);
    assert.ok(item.image_url === null || item.image_url === '', 'do not overwrite an existing image');
    assert.ok(!Object.hasOwn(item.metadata, 'coverAttribution'), 'existing attribution requires review');
    let attribution;
    try { attribution = await verifyCoverMapping(mapping, await loadEvidence(mapping)); }
    catch (error) { throw new Error(`${mapping.slug}: ${error.message}`, { cause: error }); }
    entries.push({ slug: mapping.slug, expected: item,
      imageUrl: `https://covers.openlibrary.org/b/id/${mapping.coverId}-L.jpg?default=false`,
      attribution: { ...attribution, verifiedAt: manifest.verifiedAt } });
  }
  return buildCoverRepairSql(entries);
}

// Exact row guards reject stale snapshots before any write. Replaying the exact
// already-applied repair is a no-op; competing presentation changes fail closed.
export function buildCoverRepairSql(entries) {
  assert.ok(entries.length > 0 && entries.length <= 30);
  const block = `$cover_${sha256(JSON.stringify(entries)).slice(0, 24)}$`;
  assert.ok(!JSON.stringify(entries).includes(block));
  return `begin;
set local standard_conforming_strings = on;
set local lock_timeout = '5s';
set local statement_timeout = '20s';
do ${block}
declare
  entries jsonb := ${literal(entries)};
  entry jsonb;
  current_row jsonb;
  expected_after jsonb;
begin
  perform 1 from public.items i
    where i.id in (select (e->'expected'->>'id')::uuid from jsonb_array_elements(entries) e)
    order by i.id for update;
  perform 1 from private.item_sources s
    where s.item_id in (select (e->'expected'->>'id')::uuid from jsonb_array_elements(entries) e)
    order by s.item_id for share;
  for entry in select value from jsonb_array_elements(entries) loop
    select to_jsonb(i) into current_row from public.items i
      join private.item_sources s on s.item_id=i.id
      where i.id=(entry->'expected'->>'id')::uuid
        and s.provider_key='kajo_curated' and s.provider_item_id=entry->>'slug';
    if current_row is null then raise exception 'cover repair source identity changed'; end if;
    expected_after := (entry->'expected') || jsonb_build_object(
      'image_url', entry->>'imageUrl',
      'metadata', (entry->'expected'->'metadata') || jsonb_build_object('coverAttribution',entry->'attribution'));
    if current_row - 'updated_at' = expected_after - 'updated_at' then continue; end if;
    if current_row <> entry->'expected' then raise exception 'cover repair stale Item snapshot'; end if;
    update public.items set image_url=entry->>'imageUrl',
      metadata=metadata || jsonb_build_object('coverAttribution',entry->'attribution')
      where id=(entry->'expected'->>'id')::uuid;
    select to_jsonb(i) into current_row from public.items i where i.id=(entry->'expected'->>'id')::uuid;
    if current_row - 'updated_at' <> expected_after - 'updated_at' then
      raise exception 'cover repair changed an unexpected field';
    end if;
  end loop;
end ${block};
commit;
`;
}

async function main() {
  const [manifestPath, targetsPath, evidenceDirectory, outputPath, ...extra] = process.argv.slice(2);
  assert.ok(outputPath && extra.length === 0,
    'Usage: node scripts/catalog/curated-book-covers.mjs MANIFEST TARGETS EVIDENCE_DIRECTORY NEW_SQL');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const targets = JSON.parse(await readFile(targetsPath, 'utf8'));
  for (const mapping of manifest.rows) {
    assert.match(mapping.workId, /^OL\d+W$/);
    assert.match(mapping.editionId, /^OL\d+M$/);
    assert.ok(Number.isSafeInteger(mapping.coverId) && mapping.coverId > 0);
    for (const author of mapping.authors) assert.match(author.id, /^OL\d+A$/);
  }
  const sql = await prepareCoverRepair(manifest, targets, async mapping => ({
    work: await readFile(join(evidenceDirectory, `${mapping.workId}.json`)),
    edition: await readFile(join(evidenceDirectory, `${mapping.editionId}.json`)),
    image: await readFile(join(evidenceDirectory, `${mapping.coverId}.jpg`)),
    authors: Object.fromEntries(await Promise.all(mapping.authors.map(async author =>
      [author.id, await readFile(join(evidenceDirectory, `${author.id}.json`))]))),
  }));
  await writeFile(outputPath, sql, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ version: COVER_REPAIR_VERSION, items: targets.length, sqlSha256: sha256(sql) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
