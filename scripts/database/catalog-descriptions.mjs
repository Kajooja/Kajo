import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const hash = text => createHash('sha256').update(text).digest('hex');
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
export const descriptionFixtureItemIds = [uuid(921), uuid(922), uuid(923), uuid(924)];
const description = 'An invented traveller returns to a fictional village and explores the choices that shaped its history and the lives of its inhabitants.';
const basis = 'Artificial permission evidence for a deterministic database fixture; this does not approve any real provider record.';
const time = '2001-01-01T00:00:00Z';

function entry(n) {
  const review = { policy: 'open-library-description-pilot-v1', rights: 'approved-for-pilot',
    reason: 'edition-description', basisSha256: hash(basis) };
  const record = { key: `/books/OL9900${n}M`, fetchedAt: time, status: 'found', recordSha256: hash(`record-${n}`),
    sourceRevision: 1, sourceModifiedAt: null };
  return { expectedItemId: uuid(920 + n), expectedSourceId: uuid(930 + n), expectedItemUpdatedAt: time,
    expectedSourceUpdatedAt: time, workId: `OL9900${n}W`, editionId: `OL9900${n}M`, description,
    provenance: { contract: 'open-library-description-v1', provider: 'open_library', workKey: `/works/OL9900${n}W`,
      recordKey: record.key, field: 'description', sourceUrl: 'https://openlibrary.org' + record.key,
      sourceRevision: 1, sourceModifiedAt: null, fetchedAt: time, recordSha256: record.recordSha256,
      textSha256: hash(description), textLanguage: 'en', review },
    enrichment: { contract: 'open-library-description-v1', records: [record], review: { ...review, basis } } };
}

export function catalogDescriptionFixtureSql() {
  return `
    insert into public.items(id,item_type,title,tags,metadata,creators,release_year,image_url,original_language,discoverable,created_at,updated_at)
    values ${[1, 2, 3, 4].map(n => `('${uuid(920 + n)}','${n === 3 ? 'MOVIE' : 'BOOK'}','  Preserved title ${n}  ',array['z','a'],
      '${JSON.stringify({ openLibraryWorkId: `OL9900${n}W`, displayEditionKey: `OL9900${n}M`, displayLanguage: 'fin',
        popularity: 71, nested: { keep: ['unchanged'] } })}', array['Z Creator','A Creator'],2001,'https://example.invalid/cover-${n}.jpg',null,true,'${time}','${time}')`).join(',')};
    insert into private.item_sources(id,item_id,provider_key,provider_item_id,source_url,source_updated_at,source_hash,source_payload,created_at,updated_at,synced_at)
    values ${[1, 2].map(n => `('${uuid(930 + n)}','${uuid(920 + n)}','open_library','OL9900${n}W',
      'https://openlibrary.org/works/OL9900${n}W','${time}','original-search-hash',
      '${JSON.stringify({ key: `/works/OL9900${n}W`, title: 'Search payload', nested: { keep: [1, 2] } })}','${time}','${time}','${time}')`).join(',')};
    insert into private.item_external_ids(namespace,external_id,item_id,first_seen_provider)
    values ${[1, 2].map(n => `('open_library_work','OL9900${n}W','${uuid(920 + n)}','open_library')`).join(',')};
    create temporary table description_entries(position integer primary key, entry jsonb);
    insert into description_entries values ${[1, 2].map(n => `(${n},${literal(JSON.stringify(entry(n)))})`).join(',')};
    create function pg_temp.description_snapshot() returns jsonb language sql as $snapshot$
      select jsonb_build_object('items',(select jsonb_agg(to_jsonb(i) order by i.id) from public.items i),
        'sources',(select jsonb_agg(to_jsonb(s) order by s.id) from private.item_sources s),
        'aliases',(select jsonb_agg(to_jsonb(a) order by a.namespace,a.external_id) from private.item_external_ids a))
    $snapshot$;
    create function pg_temp.description_core() returns jsonb language sql as $snapshot$
      select jsonb_build_object('items',(select jsonb_agg((to_jsonb(i)-'description'-'metadata'-'updated_at')
          ||jsonb_build_object('metadata',i.metadata-'descriptionProvenance') order by i.id) from public.items i),
        'sources',(select jsonb_agg((to_jsonb(s)-'source_payload'-'updated_at')
          ||jsonb_build_object('source_payload',s.source_payload-'descriptionEnrichment') order by s.id) from private.item_sources s),
        'aliases',(select jsonb_agg(to_jsonb(a) order by a.namespace,a.external_id) from private.item_external_ids a))
    $snapshot$;
    create function pg_temp.changed_description(original jsonb) returns jsonb language sql as $changed$
      select jsonb_set(jsonb_set(original,'{description}',to_jsonb((original->>'description') || ' Changed.')),
        '{provenance,textSha256}',to_jsonb(encode(sha256(convert_to((original->>'description') || ' Changed.','UTF8')),'hex')))
    $changed$;
    create function pg_temp.current_description_versions(original jsonb) returns jsonb language sql as $versions$
      select original || jsonb_build_object('expectedItemUpdatedAt',i.updated_at,'expectedSourceUpdatedAt',s.updated_at)
      from public.items i join private.item_sources s on s.item_id=i.id
      where i.id=(original->>'expectedItemId')::uuid and s.id=(original->>'expectedSourceId')::uuid
    $versions$;
  `;
}

export async function catalogDescriptionSmokeSql() {
  return `begin; ${catalogDescriptionFixtureSql()} ${await readFile(new URL('catalog-description-smoke.sql', import.meta.url), 'utf8')} rollback;`;
}

export function catalogDescriptionUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_book_description_refresh.sql'));
  return `begin; ${catalogDescriptionFixtureSql()}
    create temporary table description_upgrade_before as select pg_temp.description_snapshot() as value;
    ${migration.sql}
    do $check$ begin
      if (select value from description_upgrade_before) is distinct from pg_temp.description_snapshot() then
        raise exception 'Description migration changed populated catalog rows';
      end if;
    end $check$;
    select jsonb_build_object('catalogDescriptionUpgrade','PASS: unchanged populated catalog and aliases') as snapshot;
    rollback;`;
}

export function catalogDescriptionCleanupSql() {
  const ids = descriptionFixtureItemIds.map(literal).join(',');
  // Catalog identity uses restrictive foreign keys, not cascading deletion.
  // These fixed synthetic rows exist only in the newly owned test database.
  return `begin;
    delete from private.item_external_ids where item_id in (${ids});
    delete from private.item_sources where item_id in (${ids});
    delete from public.items where id in (${ids});
    commit;`;
}

export async function catalogDescriptionConcurrency(exec, execConcurrentSql, catalogRpc,
  { mode = 'open-library-description-v1', fixtureSql = catalogDescriptionFixtureSql() } = {}) {
  assert.ok(['open-library-description-v1', 'open-library-description-v2'].includes(mode));
  const [fixture] = await exec(`begin; ${fixtureSql}
    select jsonb_build_object('entries',(select jsonb_agg(entry order by position) from description_entries)) as snapshot; commit;`);
  const entries = fixture.entries;
  const settled = promise => promise.then(value => ({ value }), error => ({ error }));
  const session = (name, values, hold = false) => `begin; set local application_name='${name}';
    set local lock_timeout='8s'; set local role service_role;
    select jsonb_agg(to_jsonb(r)) from public.upsert_catalog_batch_v1(${literal(JSON.stringify(values))}::jsonb,'${mode}') r;
    ${hold ? "select jsonb_build_object('held',true) from pg_sleep(4);" : ''} commit;`;
  const waitFor = async (name, condition) => {
    const deadline = Date.now() + 7000;
    while (Date.now() < deadline) {
      const [row] = await exec(`select jsonb_build_object('observed',exists(select 1 from pg_stat_activity
        where application_name='${name}' and ${condition})) as snapshot;`);
      if (row.observed) return;
      await new Promise(resolveWait => setTimeout(resolveWait, 50));
    }
    throw new Error(`No expected native wait observed for ${name}`);
  };
  const pending = [];
  let failure;
  try {
    const first = settled(execConcurrentSql(session('kajo_description_first', entries, true)));
    pending.push(first);
    await waitFor('kajo_description_first', "wait_event='PgSleep'");
    const second = settled(execConcurrentSql(session('kajo_description_second', [...entries].reverse())));
    pending.push(second);
    const legacy = settled(execConcurrentSql(`begin; set local application_name='kajo_description_legacy';
      set local lock_timeout='8s'; set local role service_role;
      select to_jsonb(r) from public.upsert_catalog_batch_v1('[{"providerKey":"open_library","providerItemId":"OL99001W","itemType":"BOOK","title":"Concurrent legacy refresh"}]') r; commit;`));
    pending.push(legacy);
    await waitFor('kajo_description_second', "wait_event_type='Lock'");
    await waitFor('kajo_description_legacy', "wait_event_type='Lock'");
    const [a, b, c] = await Promise.all(pending);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    assert.deepEqual(a.value[0].map(row => row.outcome), ['updated','updated']);
    assert.deepEqual(b.value[0].map(row => row.outcome), ['unchanged','unchanged']);
    assert.match(c.error?.message ?? '', /Full refresh of a managed BOOK description is blocked/);
    console.log('Description native locks PASS: reversed batch waited/no-op; waiting legacy refresh rejected');
    // Real PostgREST must resolve the named two-argument overload and preserve
    // response cardinality/IDs. This is an identical read-only replay.
    const replay = await catalogRpc({ entries, refresh_mode: mode });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body, entries.map((entry, index) => ({ input_index: index + 1,
      item_id: entry.expectedItemId, outcome: 'unchanged' })));
    const denied = await catalogRpc({ entries, refresh_mode: mode }, 'anon');
    assert.ok([401, 403, 404].includes(denied.status), 'Anonymous caller reached the catalog mutation');
    console.log('Description PostgREST PASS: exact guarded replay and anonymous denial');
    return { status: 'PASS', mode, reverseBatchLockWait: true, legacyLockWait: true,
      acknowledgedUpdates: 2, concurrentNoops: 2, postgrestReplay: 2, anonymousDenied: true };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    await Promise.all(pending);
    try { await exec(catalogDescriptionCleanupSql()); }
    catch (error) {
      if (failure) throw new Error(`${failure.message}; fixture cleanup also failed: ${error.message}`);
      throw error;
    }
  }
}
