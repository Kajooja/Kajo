#!/usr/bin/env node
// Isolated sensitivity fixture, never a production scorer or database client.
import assert from 'node:assert/strict';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { canonicalJson, inspectItemFeatures, MAPPING_REGISTRY, MAPPING_SHA256,
  MAX_SNAPSHOT_BYTES, sha256 } from './item-features.mjs';

const ROOT = new URL('../../', import.meta.url);
const PROTOCOL = new URL('../../research/manifests/catalog-feature-baseline-273.json', import.meta.url);
export const ARMS = ['A', 'B', 'C'];
export const CLOCK_SQL = `create or replace function pg_catalog.now() returns timestamptz
language sql stable as $$ select current_setting('kajo.fixture_as_of')::timestamptz $$;`;
const FUNCTIONS = [
  ['supabase/migrations/20260826203000_backend_foundation.sql', 'private.is_profile_member'],
  ['supabase/migrations/20260904203000_profile_bootstrap_import_foundation.sql', 'private.bootstrap_evidence_weight_v1'],
  ['supabase/migrations/20260902223000_prediction_nervous_system_v1.sql', 'private.event_evidence_weight_v1'],
  ...['bootstrap_decay_v1', 'bootstrap_weighted_evidence_v1', 'build_profile_memory_state_v1', 'rank_items_v0']
    .map(name => ['supabase/migrations/20260907155201_bootstrap_personal_ranking.sql', `private.${name}`]),
];
const SOURCE_FILES = [...new Set([
  'scripts/catalog/evaluate-feature-baseline.mjs', 'scripts/catalog/item-features.mjs',
  'supabase/functions/_shared/catalog-normalizers.mjs',
  'scripts/database/bootstrap-ranking.fixture.sql', 'package-lock.json', ...FUNCTIONS.map(([path]) => path),
])];
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ACTOR = uuid(927300);
const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = value => sha256(canonicalJson(value));

function definition(sql, name) {
  const pattern = new RegExp(`^create (?:or replace )?function ${name.replaceAll('.', '\\.')}\\(`, 'm');
  const start = sql.search(pattern);
  assert.notEqual(start, -1, 'missing-canonical-function');
  const end = sql.indexOf('$$;', start);
  assert.notEqual(end, -1, 'invalid-canonical-function');
  return sql.slice(start, end + 3);
}

export async function loadBaselineSource() {
  const files = Object.fromEntries(await Promise.all(SOURCE_FILES.map(async path =>
    [path, await readFile(new URL(path, ROOT), 'utf8')])));
  const definitions = FUNCTIONS.map(([path, name]) => ({ name, path, sql: definition(files[path], name) }));
  // This clock fixture supports the existing now() dependency only. A source
  // change introducing another clock requires an explicitly reviewed protocol.
  for (const { sql } of definitions) {
    assert.ok(!/\b(current_timestamp|transaction_timestamp|statement_timestamp|clock_timestamp|timeofday|current_date)\b/i.test(sql),
      'unsupported-clock-dependency');
  }
  return { fixture: files['scripts/database/bootstrap-ranking.fixture.sql'], definitions,
    implementation: Object.fromEntries(SOURCE_FILES.map(path => [path, sha256(files[path])])),
    functionSha256: Object.fromEntries(definitions.map(row => [row.name, sha256(row.sql)])),
    clockSha256: sha256(CLOCK_SQL),
    runtime: { node: process.version, v8: process.versions.v8, platform: process.platform,
      architecture: process.arch, pglite: JSON.parse(files['package-lock.json']).packages['node_modules/@electric-sql/pglite'].version } };
}

export function buildBaselinePlan(snapshot, protocol) {
  assert.equal(protocol.contract, 'catalog-feature-baseline-protocol-v1');
  assert.equal(protocol.mappingSha256, MAPPING_SHA256, 'changed-feature-mapping');
  assert.ok(Number.isFinite(Date.parse(protocol.asOf)) && Date.parse(protocol.asOf) >= Date.parse(snapshot.checkedAt), 'unavailable-features');
  assert.equal(snapshot.checkedAt, protocol.snapshotCheckedAt, 'changed-snapshot-time');
  // This protocol uses the exact observation instant. Date.parse alone loses
  // microseconds and could admit a just-earlier fixed clock in the same ms.
  assert.equal(protocol.asOf, snapshot.checkedAt, 'fixed-observation-clock-required');
  assert.equal(snapshot.items.length, protocol.items, 'changed-catalog-size');
  const { artifact } = inspectItemFeatures(snapshot);
  const originals = new Map(snapshot.items.map(item => [item.itemId, item]));
  const items = artifact.features.map(row => {
    assert.match(row.itemId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'invalid-item-uuid');
    const projection = (existingOnly) => [...new Set(row.assertions
      .filter(assertion => !existingOnly || assertion.inItemTags)
      .map(assertion => `${assertion.evidenceKind}:${assertion.concept}`))].sort(lexical);
    return { itemId: row.itemId, itemType: row.itemType,
      tags: { A: originals.get(row.itemId).tags, B: projection(true), C: projection(false) } };
  });
  const anchors = [];
  const missingBuckets = [];
  for (const itemType of ['BOOK', 'MOVIE']) {
    const kind = itemType === 'BOOK' ? 'provider-subject' : 'provider-genre';
    for (const concept of MAPPING_REGISTRY.concepts) {
      const feature = `${kind}:concept:${concept}`;
      const eligible = items.filter(item => item.itemType === itemType && item.tags.C.includes(feature));
      if (!eligible.length) { missingBuckets.push({ itemType, concept }); continue; }
      const preferred = itemType === 'BOOK' ? eligible.filter(item => !item.tags.B.includes(feature)) : eligible;
      const anchor = (preferred.length ? preferred : eligible)[0]; // already lexical Item ID order
      for (const rating of [0, 10]) anchors.push({ profileId: uuid(927301 + anchors.length),
        itemType, concept, itemId: anchor.itemId, rating,
        conceptAbsentFromLegacyProjection: !anchor.tags.B.includes(feature),
        eligibleAnchors: eligible.length, preferredAnchors: preferred.length });
    }
  }
  assert.ok(anchors.length <= 24, 'profile-budget-exceeded');
  return { contract: 'catalog-feature-baseline-plan-v1', protocolSha256: hash(protocol),
    snapshotSha256: artifact.snapshotSha256, mappingSha256: MAPPING_SHA256,
    asOf: protocol.asOf, items, anchors, missingBuckets };
}

export function createBaselineFreeze(plan, protocol, source, inputFileSha256) {
  assert.equal(inputFileSha256, protocol.inputFileSha256, 'changed-input-file');
  assert.deepEqual(source.functionSha256, protocol.functionSha256, 'changed-canonical-sql');
  assert.equal(source.clockSha256, protocol.clockSha256, 'changed-fixture-clock');
  return { contract: 'catalog-feature-baseline-freeze-v1', protocolSha256: hash(protocol),
    inputFileSha256, planSha256: hash(plan), anchorSha256: hash(plan.anchors),
    implementation: source.implementation, runtime: source.runtime,
    functionSha256: source.functionSha256, clockSha256: source.clockSha256,
    anchors: plan.anchors, missingBuckets: plan.missingBuckets };
}

export async function runBaselinePlan(plan, source) {
  const db = new PGlite();
  const results = [];
  try {
    await db.exec(source.fixture);
    await db.exec(CLOCK_SQL);
    await db.query("select set_config('kajo.fixture_as_of',$1,false)", [plan.asOf]);
    // Canonical function bytes are loaded as-is. Only the disposable database's
    // clock dependency is injected; no migration or app function is rewritten.
    for (const row of source.definitions) await db.exec(row.sql);
    assert.equal((await db.query('select now()=$1::timestamptz as fixed', [plan.asOf])).rows[0].fixed, true);
    await db.query(`insert into public.items(id,item_type,title,tags,discoverable)
      select id,item_type,'Synthetic diagnostic metadata',tags,true
      from jsonb_to_recordset($1::jsonb) as x(id uuid,item_type text,tags text[])`,
    [JSON.stringify(plan.items.map(item => ({ id: item.itemId, item_type: item.itemType, tags: item.tags.A })))]);
    for (const anchor of plan.anchors) {
      await db.query('insert into public.profiles values($1,\'PERSONAL\')', [anchor.profileId]);
      await db.query('insert into public.profile_members values($1,$2)', [anchor.profileId, ACTOR]);
      await db.query(`insert into private.profile_bootstrap_evidence
        (id,profile_id,item_id,source_provider,evidence_kind,rating,source_occurred_at,imported_at)
        values($1,$2,$3,'KAJO_CALIBRATION','RATED',$4,$5,$5)`,
      [anchor.profileId, anchor.profileId, anchor.itemId, anchor.rating, plan.asOf]);
    }
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ACTOR]);
    // Definition snapshots let a reviewer verify the fixture did not swap in a
    // parallel scorer. pg_get_functiondef normalizes formatting, so hash both.
    const installed = (await db.query(`select n.nspname||'.'||p.proname as name, pg_get_functiondef(p.oid) as sql
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname=any($1::text[]) order by name`,
    [source.definitions.map(row => row.name.split('.')[1])])).rows;
    const installedFunctionSha256 = Object.fromEntries(installed.map(row => [row.name, sha256(row.sql)]));
    for (const arm of ARMS) {
      await db.query(`update public.items i set tags=x.tags from jsonb_to_recordset($1::jsonb)
        as x(id uuid,tags text[]) where i.id=x.id`,
      [JSON.stringify(plan.items.map(item => ({ id: item.itemId, tags: item.tags[arm] })))]);
      for (const anchor of plan.anchors) {
        // Hide exactly this already-rated anchor in every arm. No other item
        // suppression or sampled candidate selection is introduced.
        await db.query('update public.items set discoverable=(id<>$1::uuid)', [anchor.itemId]);
        const memory = (await db.query('select private.build_profile_memory_state_v1($1,$2) as state',
          [anchor.profileId, plan.asOf])).rows[0].state;
        assert.equal(memory.nativeEvidenceCount, 0);
        assert.equal(memory.bootstrapEvidenceCount, 1);
        assert.deepEqual(memory.shortTermPositiveTags, []);
        assert.deepEqual(memory.shortTermNegativeTags, []);
        for (const targetType of ['BOOK', 'MOVIE']) {
          const rows = (await db.query(`select item_id,item_type,score,confidence,rank,explanation
            from private.rank_items_v0($1,'FOR_YOU',$2,50,'{}')`, [anchor.profileId, targetType])).rows;
          for (const row of rows) {
            assert.equal(row.confidence, 0, 'invented-native-confidence');
            assert.equal(row.explanation.evidenceCount, 0, 'invented-native-support');
            assert.equal(row.explanation.shortTerm, 0, 'bootstrap-short-term-leak');
            if (arm !== 'A' && targetType !== anchor.itemType) {
              assert.equal(row.explanation.bootstrapLongTerm, 0, 'cross-kind-bootstrap-leak');
            }
          }
          const eligible = plan.items.filter(item => item.itemType === targetType && item.itemId !== anchor.itemId).length;
          assert.equal(rows.length, Math.min(50, eligible), 'unexpected-returned-coverage');
          results.push({ arm, profileId: anchor.profileId, targetType, eligible, excludedAnchors: anchor.itemType === targetType ? 1 : 0,
            returned: rows.length, outsideReturnedTop50: eligible - rows.length, memory, rows });
        }
      }
    }
    assert.equal((await db.query('select count(*)::int as n from public.events')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int as n from public.item_interactions')).rows[0].n, 0);
    return { contract: 'catalog-feature-baseline-results-v1', planSha256: hash(plan),
      installedFunctionSha256, syntheticProfiles: plan.anchors.length,
      observedOutcomes: 0, events: 0, currentInteractions: 0, results };
  } finally { await db.close(); }
}

function total() {
  return { queries: 0, returnedBefore: 0, returnedAfter: 0, unionItems: 0, commonItems: 0,
    entered: 0, exited: 0, commonRankChanged: 0, commonScoreChanged: 0,
    commonContributionChanged: 0, commonAbsoluteRankChange: 0,
    commonScoreDelta: 0, commonContributionDelta: 0, queriesWithTop50MembershipChange: 0,
    queriesWithCommonScoreChange: 0, maxAbsoluteCommonScoreDelta: 0 };
}

export function compareBaselineRows(before, after) {
  const a = new Map(before.map(row => [row.item_id, row]));
  const b = new Map(after.map(row => [row.item_id, row]));
  const result = total();
  result.queries = 1;
  result.returnedBefore = before.length; result.returnedAfter = after.length;
  result.unionItems = new Set([...a.keys(), ...b.keys()]).size;
  for (const [id, row] of b) {
    if (!a.has(id)) { result.entered++; continue; }
    const prior = a.get(id);
    const delta = row.score - prior.score;
    const contribution = row.explanation.bootstrapLongTerm - prior.explanation.bootstrapLongTerm;
    result.commonItems++;
    result.commonRankChanged += Number(row.rank !== prior.rank);
    result.commonScoreChanged += Number(Math.abs(delta) > 1e-12);
    result.commonContributionChanged += Number(Math.abs(contribution) > 1e-12);
    result.commonAbsoluteRankChange += Math.abs(row.rank - prior.rank);
    result.commonScoreDelta += delta;
    result.commonContributionDelta += contribution;
    result.maxAbsoluteCommonScoreDelta = Math.max(result.maxAbsoluteCommonScoreDelta, Math.abs(delta));
  }
  result.exited = before.filter(row => !b.has(row.item_id)).length;
  result.queriesWithTop50MembershipChange = Number(result.entered > 0 || result.exited > 0);
  result.queriesWithCommonScoreChange = Number(result.commonScoreChanged > 0);
  return result;
}

export function summarizeBaseline(plan, output) {
  const pairings = [['C', 'B'], ['B', 'A']];
  const comparisons = {};
  const anchors = new Map(plan.anchors.map(anchor => [anchor.profileId, anchor]));
  for (const [after, before] of pairings) {
    const groups = {};
    for (const row of output.results.filter(row => row.arm === after)) {
      const prior = output.results.find(candidate => candidate.arm === before
        && candidate.profileId === row.profileId && candidate.targetType === row.targetType);
      assert.ok(prior, 'missing-comparison-arm');
      assert.equal(prior.eligible, row.eligible, 'changed-candidate-roster');
      const anchor = anchors.get(row.profileId);
      const key = `${anchor.itemType}:${anchor.rating === 10 ? 'positive' : 'negative'}->${row.targetType}`;
      const comparison = compareBaselineRows(prior.rows, row.rows);
      const group = groups[key] ??= total();
      for (const [field, value] of Object.entries(comparison)) {
        group[field] = field.startsWith('max') ? Math.max(group[field], value) : group[field] + value;
      }
    }
    comparisons[`${after}-${before}`] = groups;
  }
  const armCoverage = Object.fromEntries(ARMS.map(arm => [arm, Object.fromEntries(['BOOK', 'MOVIE'].map(itemType => {
    const rows = output.results.filter(row => row.arm === arm && row.targetType === itemType);
    return [itemType, { queries: rows.length, returned: rows.reduce((n, row) => n + row.returned, 0),
      eligibleItemQueries: rows.reduce((n, row) => n + row.eligible, 0),
      outsideReturnedTop50: rows.reduce((n, row) => n + row.outsideReturnedTop50, 0),
      excludedAnchors: rows.reduce((n, row) => n + row.excludedAnchors, 0),
      nonzeroBootstrapReturned: rows.reduce((n, row) => n + row.rows.filter(item => item.explanation.bootstrapLongTerm !== 0).length, 0) }];
  }))]));
  return { contract: 'catalog-feature-baseline-report-v1', issue: 273,
    interpretation: 'Synthetic whole-Item representation sensitivity; no observed outcomes, quality estimate, training or serving admission.',
    comparisonsMeaning: { 'C-B': 'Additional audited source-concept representation under the same six-concept/source-kind policy.',
      'B-A': 'Representation sensitivity; removes other legacy tags and separates source kinds. Not an isolated missing-feature repair.' },
    aggregateUnits: 'Returned/eligible/union/common/entry/exit and changed-Item counts are Item-query occurrences, not distinct catalog Items. Membership-change queries exclude order-only changes, which commonRankChanged records.',
    counts: { items: plan.items.length, anchors: new Set(plan.anchors.map(row => row.itemId)).size,
      syntheticProfiles: plan.anchors.length, positive: plan.anchors.filter(row => row.rating === 10).length,
      negative: plan.anchors.filter(row => row.rating === 0).length, missingBuckets: plan.missingBuckets.length,
      absentConceptAnchorProfiles: plan.anchors.filter(row => row.conceptAbsentFromLegacyProjection).length,
      observedOutcomes: 0, events: output.events, currentInteractions: output.currentInteractions },
    asOf: plan.asOf, armCoverage, comparisons,
    limits: [
      'Anchors deliberately favor missing BOOK concepts; repeated anchors/multiple concepts are not independent people or isolated concept effects.',
      'Only returned top-50 scores are observed; entry/exit is reported without imputing scores outside the returned sets.',
      'Rank/score/contribution deltas are conditional on both arms returning an Item; unions and entry/exit are reported separately.',
      'Unknown concepts are omitted from sparse diagnostic tags, not encoded as dislike; native confidence remains zero.',
      'Zero cross-kind concept/bootstrap contribution does not establish whole-V1 isolation: Scenario, Shared and serving-shadow are outside this fixture.',
      'Canonical SQL function bodies are unchanged; disposable pg_catalog.now is replaced by a hashed fixed test clock. This is not historical or hosted replay.',
      'Synthetic profiles exist only in disposable PGlite; the supplied catalog metadata contains no personal history.',
    ] };
}

async function boundedRead(path) {
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    assert.ok(stat.isFile() && stat.size <= MAX_SNAPSHOT_BYTES, 'invalid-input-size');
    const buffer = Buffer.alloc(MAX_SNAPSHOT_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const chunk = await handle.read(buffer, size, buffer.length - size, null);
      if (!chunk.bytesRead) break;
      size += chunk.bytesRead;
    }
    assert.ok(size <= MAX_SNAPSHOT_BYTES, 'invalid-input-size');
    const bytes = buffer.subarray(0, size);
    return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), sha256: sha256(bytes) };
  } finally { await handle.close(); }
}

async function newDirectory(path) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await mkdir(path, { mode: 0o700 });
}

export async function runBaselineCli(args = process.argv.slice(2)) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(`Offline #273 canonical SQL sensitivity fixture. No network or hosted writes.
Prepare BEFORE scoring: --snapshot FILE --prepare --out NEW_PRIVATE_DIRECTORY
Run frozen plan:        --snapshot FILE --freeze FREEZE.json --out NEW_PRIVATE_DIRECTORY
Uses research/manifests/catalog-feature-baseline-273.json; snapshot/code/runtime
must match the freeze. Each directory must be new. Private results contain Item
IDs and synthetic scenarios; only report.json is intended for public review.`);
    return;
  }
  const { values } = parseArgs({ args, options: { snapshot: { type: 'string' }, out: { type: 'string' },
    prepare: { type: 'boolean' }, freeze: { type: 'string' } } });
  assert.ok(values.snapshot && values.out && Boolean(values.prepare) !== Boolean(values.freeze), 'invalid-command');
  const protocol = JSON.parse(await readFile(PROTOCOL, 'utf8'));
  const input = await boundedRead(values.snapshot);
  const source = await loadBaselineSource();
  const plan = buildBaselinePlan(input.value, protocol);
  const freeze = createBaselineFreeze(plan, protocol, source, input.sha256);
  const output = resolve(values.out);
  if (values.prepare) {
    await newDirectory(output);
    await writeFile(resolve(output, 'freeze.json'), json(freeze), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ status: 'frozen', profiles: plan.anchors.length, freezeSha256: hash(freeze),
      protocolSha256: hash(protocol), anchorSha256: freeze.anchorSha256 }));
    return freeze;
  }
  assert.deepEqual((await boundedRead(values.freeze)).value, freeze, 'freeze-mismatch');
  // Claim a new output directory before any SQL execution; no implicit rerun or overwrite.
  await newDirectory(output);
  await writeFile(resolve(output, 'freeze.json'), json(freeze), { flag: 'wx', mode: 0o600 });
  const results = await runBaselinePlan(plan, source);
  const report = { ...summarizeBaseline(plan, results), inputFileSha256: input.sha256,
    snapshotSha256: plan.snapshotSha256, mappingSha256: MAPPING_SHA256,
    protocolSha256: hash(protocol), freezeSha256: hash(freeze), planSha256: hash(plan),
    anchorSha256: freeze.anchorSha256, resultsSha256: hash(results),
    implementation: source.implementation, functionSha256: source.functionSha256,
    installedFunctionSha256: results.installedFunctionSha256, clockSha256: source.clockSha256,
    runtime: source.runtime };
  await writeFile(resolve(output, 'results.json'), json(results), { flag: 'wx', mode: 0o600 });
  await writeFile(resolve(output, 'report.json'), json(report), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: 'evaluated', profiles: plan.anchors.length,
    resultsSha256: report.resultsSha256, reportFileSha256: sha256(json(report)) }));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBaselineCli().catch(() => {
    console.error(JSON.stringify({ status: 'error', code: 'feature-baseline-failed' }));
    process.exitCode = 1;
  });
}
