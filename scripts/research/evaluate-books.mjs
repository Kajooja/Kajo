import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { interpretBookGenomeRating, bookGenomeStaticSpec } from '@kajo/prediction-engine/adapters/book-genome';
import { fitStaticRatings, predictStaticRatings, staticRatingVariants } from '@kajo/prediction-engine/research-static';
import { compareRatingSubjects, checkRatingComparison, decideBookDevelopment } from './rating-macro-comparison.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourcePath = join(root, 'research/manifests/book-genome-2021.json');
const codePaths = ['scripts/research/book_genome.py', 'scripts/research/evaluate-books.mjs',
  'scripts/research/rating-macro-comparison.mjs',
  'packages/prediction-engine/dist/research-static.js', 'packages/prediction-engine/dist/rating-location.js',
  'packages/prediction-engine/dist/adapters/book-genome.js'];
const hash = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value, (_, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
async function bounded(path, bytes) {
  assert.ok((await stat(path)).size <= bytes, 'File budget exceeded');
  const data = await readFile(path);
  assert.ok(data.length <= bytes, 'File changed beyond budget');
  return data;
}
async function configuration(experiment) {
  assert.ok(['replay', 'development'].includes(experiment), 'Unknown experiment');
  const protocolPath = join(root, `research/manifests/book-genome-${experiment === 'development' ? 'development-v2' : 'static-v1'}.json`);
  const sourceBytes = await bounded(sourcePath, 65536), protocolBytes = await bounded(protocolPath, 65536);
  const source = JSON.parse(sourceBytes), protocol = JSON.parse(protocolBytes);
  if (experiment === 'development') source.cohort = protocol.cohort;
  const code = {};
  for (const p of codePaths) code[p] = hash(await bounded(join(root, p), 1024 * 1024));
  return { source, protocol, experiment, role: experiment === 'development' ? 'DISJOINT_DEVELOPMENT_COMPARISON' : 'EXPOSED_DEVELOPMENT_REPLAY', lineage: {
    sourceSha256: hash(sourceBytes), protocolSha256: hash(protocolBytes), code, node: process.version } };
}

export function records(bytes, receipt, source) {
  assert.equal(hash(bytes), receipt.cohortSha256, 'Cohort integrity');
  assert.equal(bytes.length, receipt.cohortBytes, 'Cohort size');
  assert.equal(bytes.at(-1), 10, 'Incomplete cohort');
  const result = [], subjects = new Map(), seen = new Set();
  let previousUser = -1, previousItem = -1;
  for (const line of bytes.toString('utf8').trimEnd().split('\n')) {
    assert.ok(line.length <= 4096, 'Cohort line budget');
    const row = JSON.parse(line);
    assert.deepEqual(Object.keys(row).sort(), ['record', 'sourceRecordLine']);
    assert.ok(Number.isSafeInteger(row.sourceRecordLine) && row.sourceRecordLine > 0
      && row.sourceRecordLine <= source.expectedCounts.ratings, 'Source line');
    const value = interpretBookGenomeRating(row.record, source.member.expandedSha256);
    const { user_id: u, item_id: i } = row.record, key = `${u}:${i}`;
    assert.ok(!seen.has(key) && (u > previousUser || u === previousUser && i > previousItem),
      'Duplicate or unordered cohort');
    seen.add(key); previousUser = u; previousItem = i;
    subjects.set(u, (subjects.get(u) ?? 0) + 1);
    result.push({ user: u, item: i, value });
    assert.ok(result.length <= source.budgets.maxCohortRows, 'Cohort budget');
  }
  assert.equal(result.length, receipt.cohort.ratings);
  assert.equal(subjects.size, source.cohort.size);
  assert.equal(subjects.size, receipt.cohort.subjects);
  assert.ok([...subjects.values()].every(n => n >= source.cohort.minUniqueRatings && n <= source.budgets.maxHistoryRows));
  return result;
}

/** Split membership depends only on source IDs, never labels or fabricated time. */
export function partitionBooks(rows, protocol) {
  const histories = new Map();
  for (const r of rows) {
    if (!histories.has(r.user)) histories.set(r.user, []);
    histories.get(r.user).push(r);
  }
  assert.equal(histories.size, protocol.cohortSubjects);
  const rank = id => hash(`${protocol.seed}:subject:${id}`);
  const cold = new Set([...histories.keys()].sort((a, b) => rank(a).localeCompare(rank(b)) || a - b)
    .slice(0, protocol.heldOutSubjects));
  const parts = { train: [], validation: [], test: [], coldVisible: [], coldTargets: [] };
  for (const [u, history] of [...histories].sort((a, b) => a[0] - b[0])) {
    const itemRank = r => hash(`${protocol.seed}:item:${u}:${r.item}`);
    const ordered = [...history].sort((a, b) => itemRank(a).localeCompare(itemRank(b)) || a.item - b.item);
    const n = ordered.length;
    if (cold.has(u)) {
      const cut = Math.floor(.8 * n);
      parts.coldVisible.push(...ordered.slice(0, cut)); parts.coldTargets.push(...ordered.slice(cut));
    } else {
      const a = Math.floor(.7 * n), b = Math.floor(.85 * n);
      parts.train.push(...ordered.slice(0, a)); parts.validation.push(...ordered.slice(a, b));
      parts.test.push(...ordered.slice(b));
    }
  }
  const seen = new Set();
  for (const [name, entries] of Object.entries(parts)) for (const r of entries) {
    const key = `${r.user}:${r.item}`;
    assert.ok(!seen.has(key), 'Partition overlap'); seen.add(key);
    assert.equal(cold.has(r.user), name.startsWith('cold'), 'Held-out subject leakage');
  }
  assert.equal(seen.size, rows.length);
  return parts;
}
export function partitionSummary(parts) {
  return Object.fromEntries(Object.entries(parts).map(([name, rows]) => [name, {
    rows: rows.length, subjects: new Set(rows.map(r => r.user)).size,
    membershipSha256: hash(JSON.stringify(rows.map(r => [r.user, r.item]))),
  }]));
}

export function verifyBookExclusion(bytes, expected, rows) {
  assert.ok(bytes.length <= 32 * 1024 * 1024 && bytes.at(-1) === 10, 'Exclusion size');
  assert.equal(hash(bytes), expected.sha256, 'Exclusion integrity');
  const lines = bytes.toString('utf8').trimEnd().split('\n'), excluded = new Set();
  assert.equal(lines.length, expected.ratings, 'Exclusion row count');
  for (const line of lines) {
    assert.ok(line.length <= 4096, 'Exclusion line budget');
    const user = JSON.parse(line).record.user_id;
    assert.ok(Number.isSafeInteger(user) && user >= 0, 'Exclusion subject'); excluded.add(user);
  }
  assert.equal(excluded.size, expected.subjects, 'Exclusion subject count');
  assert.ok(rows.every(r => !excluded.has(r.user)), 'Prior cohort subject overlap');
  return { ...expected, overlapSubjects: 0 };
}

export async function freezeBooks(inputDirectory, outputDirectory, experiment = 'replay') {
  const config = await configuration(experiment);
  const receiptBytes = await bounded(join(inputDirectory, 'manifest.json'), 1024 * 1024);
  const receipt = JSON.parse(receiptBytes);
  assert.equal(receipt.schema, 'book-genome-normalized-v1');
  assert.deepEqual(receipt.source, config.source, 'Reviewed source changed');
  assert.equal(receipt.lineage.codeSha256, config.lineage.code['scripts/research/book_genome.py']);
  assert.equal(receipt.lineage.planSha256, hash(stable(config.source)));
  assert.equal(receipt.lineage.compressedSha256, config.source.member.compressedSha256);
  assert.deepEqual(receipt.sourceCounts, config.source.expectedCounts);
  const cohort = await bounded(join(inputDirectory, 'ratings.jsonl'), 32 * 1024 * 1024);
  const rows = records(cohort, receipt, config.source), parts = partitionBooks(rows, config.protocol);
  const excluded = experiment === 'development' ? await bounded(join(inputDirectory, 'excluded-ratings.jsonl'), 32 * 1024 * 1024) : null;
  const exclusion = excluded ? verifyBookExclusion(excluded, config.source.cohort.excludedCohort, rows) : null;
  if (excluded) assert.deepEqual(exclusion, receipt.exclusion);
  const freeze = { schema: 'book-genome-static-freeze-v1', role: config.role,
    ...(exclusion ? { exclusion } : {}),
    lineage: config.lineage, protocol: config.protocol, receiptSha256: hash(receiptBytes),
    cohortSha256: hash(cohort), partitions: partitionSummary(parts),
    time: 'UNKNOWN_STATIC_MASKS_ONLY', qualityAdmission: 'NONE', servingActivation: 'NONE' };
  await mkdir(dirname(outputDirectory), { recursive: true });
  const temporary = await mkdtemp(join(dirname(outputDirectory), '.book-freeze-'));
  try {
    await writeFile(join(temporary, 'ratings.jsonl'), cohort, { flag: 'wx', mode: 0o600 });
    await writeFile(join(temporary, 'intake.json'), receiptBytes, { flag: 'wx', mode: 0o600 });
    if (excluded) await writeFile(join(temporary, 'excluded-ratings.jsonl'), excluded, { flag: 'wx', mode: 0o600 });
    await save(join(temporary, 'freeze.json'), freeze);
    // Existing outputs, including empty directories, are never silently reused.
    await mkdir(outputDirectory, { mode: 0o700 });
    await rename(temporary, outputDirectory);
  } finally { await rm(temporary, { recursive: true, force: true }); }
  return freeze;
}

function grouped(rows) {
  const result = new Map();
  for (const r of rows) {
    if (!result.has(r.user)) result.set(r.user, []);
    result.get(r.user).push(r);
  }
  return result;
}
export function scoreBooks(model, targets, visible) {
  const evidence = grouped(visible), journal = [];
  for (const [u, rs] of grouped(targets)) {
    const predictions = predictStaticRatings(model, rs[0].value.subjectId,
      (evidence.get(u) ?? []).map(r => r.value), rs.map(r => r.value.objectId));
    for (let i = 0; i < rs.length; i++) journal.push({ user: u, item: rs[i].item,
      actual: rs[i].value.value, prediction: predictions[i] });
  }
  assert.ok(journal.length > 0, 'Empty scored partition');
  const metrics = {};
  for (const variant of staticRatingVariants) {
    const bySubject = new Map();
    for (const r of journal) {
      const error = r.prediction.values[variant] - r.actual;
      const s = bySubject.get(r.user) ?? [0, 0, 0];
      s[0]++; s[1] += Math.abs(error); s[2] += error * error; bySubject.set(r.user, s);
    }
    const sums = [...bySubject.values()], n = journal.length;
    metrics[variant] = { rows: n, subjects: sums.length, mae10: sums.reduce((s, x) => s + x[1], 0) / n,
      rmse10: Math.sqrt(sums.reduce((s, x) => s + x[2], 0) / n),
      subjectMacroMae10: sums.reduce((s, x) => s + x[1] / x[0], 0) / sums.length,
      predictionCoverage: 1, fittedItemCoverage: journal.filter(r => r.prediction.itemSupport > 0).length / n };
  }
  return { metrics, journal };
}

export async function runBooks(frozenDirectory, outputDirectory, experiment = 'replay') {
  const config = await configuration(experiment), freezeBytes = await bounded(join(frozenDirectory, 'freeze.json'), 1024 * 1024);
  const freeze = JSON.parse(freezeBytes);
  assert.equal(freeze.schema, 'book-genome-static-freeze-v1');
  assert.equal(freeze.role, config.role);
  assert.deepEqual(freeze.lineage, config.lineage, 'Code, protocol, source or runtime changed: freeze again');
  assert.deepEqual(freeze.protocol, config.protocol);
  const receiptBytes = await bounded(join(frozenDirectory, 'intake.json'), 1024 * 1024);
  assert.equal(hash(receiptBytes), freeze.receiptSha256, 'Intake integrity');
  const receipt = JSON.parse(receiptBytes);
  assert.deepEqual(receipt.source, config.source);
  const cohort = await bounded(join(frozenDirectory, 'ratings.jsonl'), 32 * 1024 * 1024);
  assert.equal(hash(cohort), freeze.cohortSha256, 'Frozen cohort integrity');
  const rows = records(cohort, receipt, config.source), parts = partitionBooks(rows, config.protocol);
  if (experiment === 'development') {
    const excluded = await bounded(join(frozenDirectory, 'excluded-ratings.jsonl'), 32 * 1024 * 1024);
    const exclusion = verifyBookExclusion(excluded, config.source.cohort.excludedCohort, rows);
    assert.deepEqual(exclusion, freeze.exclusion); assert.deepEqual(exclusion, receipt.exclusion);
  }
  assert.deepEqual(partitionSummary(parts), freeze.partitions);
  assert.equal(config.protocol.itemShrinkage, bookGenomeStaticSpec.itemShrinkage);
  assert.equal(config.protocol.profileShrinkage, bookGenomeStaticSpec.subjectShrinkage);
  await mkdir(outputDirectory, { mode: 0o700 });
  await save(join(outputDirectory, 'run.json'), { freezeSha256: hash(freezeBytes), role: freeze.role });
  const model = fitStaticRatings(parts.train.map(r => r.value), bookGenomeStaticSpec);
  await save(join(outputDirectory, 'model.json'), model);
  const modelSha256 = hash(JSON.stringify(model));
  const compare = (journal, name) => compareRatingSubjects(journal, { ...config.protocol, seed: `${config.protocol.seed}:${name}` });
  const saveJournal = (name, journal) => writeFile(join(outputDirectory, `${name}-predictions.jsonl`),
    journal.map(r => JSON.stringify(r)).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  const validationScored = scoreBooks(model, parts.validation, parts.train), validation = validationScored.metrics;
  const development = experiment === 'development';
  const validationComparison = development ? compare(validationScored.journal, 'validation') : null;
  const eligibility = development ? checkRatingComparison(validationComparison, config.protocol.decision) : null;
  const selected = development ? (eligibility.passed ? config.protocol.challenger : config.protocol.control)
    : staticRatingVariants.reduce((a, b) => validation[b].rmse10 < validation[a].rmse10 ? b : a);
  const selection = { selected, validation, modelSha256, testLabelsUsedForFitOrSelection: false,
    ...(development ? { comparison: validationComparison, eligibility } : {}),
    role: development ? 'FROZEN_DISJOINT_DEVELOPMENT_SELECTION' : 'REPLAY_OF_EXPOSED_DEVELOPMENT_SELECTION' };
  if (development) await saveJournal('validation', validationScored.journal);
  await save(join(outputDirectory, 'selection-before-test.json'), selection);
  const test = scoreBooks(model, parts.test, parts.train);
  await saveJournal('test', test.journal);
  const coldEvidenceMasks = {};
  const coldComparisons = {};
  for (const budget of config.protocol.coldEvidenceBudgets) {
    const visible = [...grouped(parts.coldVisible).values()].map(rs => rs.slice(0, budget));
    const scored = scoreBooks(model, parts.coldTargets, visible.flat());
    coldEvidenceMasks[budget] = { evidenceBudget: budget,
      actualVisibleRatings: { minimum: Math.min(...visible.map(rs => rs.length)), maximum: Math.max(...visible.map(rs => rs.length)) },
      targetMembershipSha256: freeze.partitions.coldTargets.membershipSha256,
      metrics: scored.metrics };
    if (development) {
      coldComparisons[budget] = { ...compare(scored.journal, `cold-${budget}`),
        equalControlEveryTarget: scored.journal.every(r => r.prediction.values[config.protocol.control] === r.prediction.values[config.protocol.challenger]) };
      await saveJournal(`cold-${budget}`, scored.journal);
    }
  }
  assert.equal(hash(JSON.stringify(model)), modelSha256, 'Frozen model changed');
  const holdoutComparison = development ? compare(test.journal, 'holdout') : null;
  const report = { schema: development ? 'book-genome-disjoint-development-v2' : 'book-genome-engine-static-replay-v1', role: freeze.role,
    freezeSha256: hash(freezeBytes), lineage: freeze.lineage, sourceCounts: receipt.sourceCounts,
    cohort: receipt.cohort, cohortSha256: receipt.cohortSha256, quarantine: receipt.quarantine,
    partitions: freeze.partitions, selection, test: test.metrics, coldEvidenceMasks,
    ...(development ? { exclusion: freeze.exclusion, holdoutComparison, coldComparisons,
      decision: decideBookDevelopment(selection, holdoutComparison, coldComparisons, config.protocol) } : {}),
    qualityAdmission: 'NONE', servingActivation: 'NONE', nativeRowsWritten: 0,
    limitations: [development ? 'Disjoint subjects from the exposed pilot; external development holdout only, never native FINAL or product acceptance.'
      : 'Already exposed development cohort: integration/conformance only, no fresh holdout.',
      'Unknown dates; hash masks do not establish temporal learning or causal recommendation benefit.',
      'Observed 1–5 source grades map to 2/4/6/8/10; platform scale equivalence is unproven. Native 0–10 is unchanged.',
      'Selected readers with at least 20 ratings; missing and not-read are never negative labels.',
      'No cross-dataset user joins, native integration, production admission, or calibrated uncertainty.'],
    attribution: config.source.rights.attribution };
  await save(join(outputDirectory, 'report.json'), report);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, ...args] = process.argv.slice(2), options = {};
    assert.ok([4, 6].includes(args.length), 'Usage: freeze|run --input-dir DIR --out DIR [--experiment replay|development]');
    for (let i = 0; i < args.length; i += 2) {
      assert.ok(['--input-dir', '--out', '--experiment'].includes(args[i]) && !options[args[i]], 'Unknown or duplicate flag');
      options[args[i]] = args[i] === '--experiment' ? args[i + 1] : resolve(args[i + 1]);
    }
    assert.ok(options['--input-dir'] && options['--out']);
    const experiment = options['--experiment'] ?? 'replay';
    const result = command === 'freeze' ? await freezeBooks(options['--input-dir'], options['--out'], experiment)
      : command === 'run' ? await runBooks(options['--input-dir'], options['--out'], experiment) : assert.fail('Unknown command');
    console.log(JSON.stringify({ status: 'PASS', schema: result.schema, partitions: result.partitions,
      selected: result.selection?.selected, test: result.test, decision: result.decision,
      holdoutComparison: result.holdoutComparison, qualityAdmission: 'NONE' }, null, 2));
  } catch (error) { console.error(`Book research stopped: ${error.message}`); process.exitCode = 1; }
}
