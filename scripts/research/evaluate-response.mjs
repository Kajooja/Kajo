import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fitRatingResponse, predictRatingResponse } from '@kajo/prediction-engine/research-response';
import { records, partitionBooks, partitionSummary, verifyBookExclusion } from './evaluate-books.mjs';
import { compareRatingSubjects, checkRatingComparison } from './rating-macro-comparison.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = x => createHash('sha256').update(x).digest('hex');
const stable = x => JSON.stringify(x, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const save = (p, v) => writeFile(p, JSON.stringify(v, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const grouped = rows => {
  const groups = new Map();
  for (const r of rows) { if (!groups.has(r.user)) groups.set(r.user, []); groups.get(r.user).push(r); }
  return groups;
};
async function bounded(path, max = 134217728) {
  assert.ok((await stat(path)).size <= max, 'Input byte budget');
  const bytes = await readFile(path); assert.ok(bytes.length <= max, 'Changed input budget'); return bytes;
}
async function configuration(domain) {
  assert.ok(['book', 'movie'].includes(domain));
  const protocolBytes = await bounded(join(root, 'research/manifests/rating-response-spread-v1.json'), 65536);
  const sourceBytes = await bounded(join(root, `research/manifests/${domain === 'book' ? 'book-genome-2021' : 'movielens-32m'}.json`), 65536);
  const protocol = JSON.parse(protocolBytes), source = JSON.parse(sourceBytes);
  source.cohort = protocol[domain].cohort;
  const code = {};
  for (const path of ['scripts/research/book_genome.py', 'scripts/research/movielens.py',
    'scripts/research/evaluate-books.mjs', 'scripts/research/evaluate-response.mjs',
    'scripts/research/rating-macro-comparison.mjs', 'packages/prediction-engine/dist/research-response.js',
    'packages/prediction-engine/dist/rating-location.js', 'packages/prediction-engine/dist/adapters/book-genome.js']) {
    code[path] = hash(await bounded(join(root, path), 1048576));
  }
  return { domain, source, protocol, lineage: { sourceSha256: hash(sourceBytes), protocolSha256: hash(protocolBytes), code, node: process.version } };
}

export function movieRecords(bytes, receipt, source) {
  assert.equal(hash(bytes), receipt.outputFiles['ratings.jsonl'].sha256, 'Movie cohort hash');
  assert.equal(bytes.length, receipt.outputFiles['ratings.jsonl'].bytes);
  assert.equal(bytes.at(-1), 10);
  const result = [], seen = new Set();
  let previous = [-1, -1, -1];
  for (const line of bytes.toString('utf8').trimEnd().split('\n')) {
    assert.ok(line.length <= 4096);
    const r = JSON.parse(line);
    assert.deepEqual(Object.keys(r).sort(), ['movieId', 'rating', 'timestamp', 'userId']);
    assert.ok([r.userId, r.movieId].every(x => typeof x === 'string' && /^[1-9][0-9]*$/.test(x)));
    const user = Number(r.userId), item = Number(r.movieId), at = r.timestamp;
    assert.ok([user, item, at].every(Number.isSafeInteger) && at >= 0 && at <= receipt.sourceTimestampRange.max);
    assert.ok(Number.isFinite(r.rating) && r.rating >= .5 && r.rating <= 5 && Number.isInteger(r.rating * 2));
    assert.ok(at > previous[0] || at === previous[0] && (user > previous[1] || user === previous[1] && item > previous[2]), 'Movie ordering');
    previous = [at, user, item];
    const key = `${user}:${item}`; assert.ok(!seen.has(key), 'Duplicate movie pair'); seen.add(key);
    result.push({ user, item, value: r.rating * 2, original: r.rating, at });
    assert.ok(result.length <= source.budgets.maxCohortRatings);
  }
  assert.equal(result.length, receipt.cohort.ratings);
  const groups = grouped(result), rule = source.cohort.temporalSupport;
  assert.equal(groups.size, source.cohort.size);
  for (const rs of groups.values()) {
    assert.ok(rs.length <= rule.maximumHistoryRatings && rs.filter(r => r.at < rule.trainBefore).length >= rule.minimumTrainRatings
      && rs.filter(r => r.at >= rule.trainBefore && r.at < rule.testFrom).length >= rule.minimumValidationRatings
      && rs.filter(r => r.at >= rule.testFrom).length >= rule.minimumTestRatings, 'Movie temporal support');
  }
  return result;
}

export function partitionMovies(rows, protocol) {
  const groups = grouped(rows);
  assert.equal(groups.size, protocol.cohortSubjects);
  const rank = u => hash(`${protocol.seed}:subject:${u}`);
  const cold = new Set([...groups.keys()].sort((a, b) => rank(a).localeCompare(rank(b)) || a - b).slice(0, protocol.heldOutSubjects));
  const parts = { train: [], validation: [], test: [], coldVisible: [], coldTargets: [] };
  const { trainBefore, testFrom } = protocol.movie.cohort.temporalSupport;
  for (const r of rows) {
    assert.ok(Number.isSafeInteger(r.at) && r.at >= 0, 'Missing movie time');
    const name = cold.has(r.user) ? (r.at < testFrom ? 'coldVisible' : 'coldTargets')
      : r.at < trainBefore ? 'train' : r.at < testFrom ? 'validation' : 'test';
    parts[name].push(r);
  }
  for (const rs of Object.values(parts)) assert.ok(rs.length <= protocol.budgets.maxPartitionRows, 'Partition row budget');
  return parts;
}

/** Most recent complete groups, never splitting or skipping an oversized group. */
export function coldMoviePrefix(rows, budget, cutoff) {
  assert.ok(Number.isInteger(budget) && budget >= 0);
  const groups = new Map();
  for (const r of rows) {
    assert.ok(Number.isSafeInteger(r.at) && r.at < cutoff, 'Future cold evidence');
    if (!groups.has(r.at)) groups.set(r.at, []); groups.get(r.at).push(r);
  }
  const selected = [];
  for (const [, rs] of [...groups].sort((a, b) => b[0] - a[0])) {
    if (selected.length + rs.length > budget) break;
    selected.push(...rs.sort((a, b) => a.item - b.item));
  }
  return selected.sort((a, b) => a.at - b.at || a.item - b.item);
}

async function input(directory, config) {
  const { domain, source, protocol, lineage } = config;
  const receiptBytes = await bounded(join(directory, 'manifest.json'), 1048576), receipt = JSON.parse(receiptBytes);
  const cohort = await bounded(join(directory, 'ratings.jsonl'), protocol.budgets.maxFreezeBytes);
  const witnesses = [], exclusions = [];
  let rows;
  if (domain === 'book') {
    assert.equal(receipt.schema, 'book-genome-normalized-v1');
    assert.deepEqual(receipt.source, source);
    assert.equal(receipt.lineage.codeSha256, lineage.code['scripts/research/book_genome.py']);
    assert.equal(receipt.lineage.planSha256, hash(stable(source)));
    assert.equal(receipt.lineage.compressedSha256, source.member.compressedSha256);
    rows = records(cohort, receipt, source).map(r => ({ user: r.user, item: r.item, value: r.value.value, original: r.value.original.value, at: null }));
    const allExcluded = new Set();
    for (const [i, expected] of source.cohort.excludedCohorts.entries()) {
      const bytes = await bounded(join(directory, `excluded-${i}.jsonl`), 33554432);
      exclusions.push(verifyBookExclusion(bytes, expected, rows)); witnesses.push(bytes);
      const users = new Set(bytes.toString().trimEnd().split('\n').map(x => JSON.parse(x).record.user_id));
      for (const u of users) { assert.ok(!allExcluded.has(u), 'Exclusion witness overlap'); allExcluded.add(u); }
    }
    assert.deepEqual(receipt.exclusions, exclusions);
  } else {
    assert.equal(receipt.schemaVersion, source.schemaVersion);
    assert.equal(source.rights.research, 'approved-for-noncommercial-research');
    assert.equal(source.sourceVerification.status, 'verified');
    assert.equal(receipt.planSha256, hash(stable(source)));
    assert.equal(receipt.normalizerCodeSha256, lineage.code['scripts/research/movielens.py']);
    assert.equal(receipt.archive.sha256, source.sourceVerification.archiveSha256);
    assert.equal(receipt.archive.md5, source.sourceVerification.publisherMd5);
    assert.equal(receipt.archive.bytes, source.sourceVerification.archiveBytes);
    assert.equal(receipt.source.releaseId, source.releaseId);
    assert.deepEqual(receipt.sourceFiles, source.sourceVerification.files);
    rows = movieRecords(cohort, receipt, source);
  }
  assert.deepEqual(receipt.sourceCounts, source.expectedCounts);
  assert.ok(rows.length <= protocol.budgets.maxCohortRows);
  const parts = domain === 'book' ? partitionBooks(rows, protocol) : partitionMovies(rows, protocol);
  return { receiptBytes, receipt, cohort, witnesses, exclusions, rows, parts };
}
export async function freezeResponse(domain, inputDir, outputDir) {
  const config = await configuration(domain), data = await input(inputDir, config);
  const freeze = { schema: 'rating-response-freeze-v1', domain, lineage: config.lineage, protocol: config.protocol,
    receiptSha256: hash(data.receiptBytes), cohortSha256: hash(data.cohort), exclusions: data.exclusions,
    partitions: partitionSummary(data.parts), qualityAdmission: 'NONE', servingActivation: 'NONE' };
  await mkdir(dirname(outputDir), { recursive: true });
  const tmp = await mkdtemp(join(dirname(outputDir), '.response-freeze-'));
  try {
    await writeFile(join(tmp, 'manifest.json'), data.receiptBytes, { flag: 'wx', mode: 0o600 });
    await writeFile(join(tmp, 'ratings.jsonl'), data.cohort, { flag: 'wx', mode: 0o600 });
    for (const [i, bytes] of data.witnesses.entries()) await writeFile(join(tmp, `excluded-${i}.jsonl`), bytes, { flag: 'wx', mode: 0o600 });
    await save(join(tmp, 'freeze.json'), freeze);
    await mkdir(outputDir, { mode: 0o700 }); await rename(tmp, outputDir);
  } finally { await rm(tmp, { recursive: true, force: true }); }
  return freeze;
}

export function fitResponseBase(rows, protocol, domain) {
  assert.ok(rows.length > 0 && rows.length <= protocol.budgets.maxPartitionRows);
  const sums = new Map(), pairs = Object.create(null), [min, max] = protocol[domain].scale;
  let total = 0;
  for (const r of rows) {
    assert.ok(Number.isFinite(r.value) && r.value >= min && r.value <= max);
    assert.ok(domain === 'book' ? r.at === null : Number.isSafeInteger(r.at) && r.at < protocol.movie.cohort.temporalSupport.trainBefore, 'Training time cutoff');
    const key = `${r.user}:${r.item}`; assert.ok(!Object.hasOwn(pairs, key), 'Duplicate training pair'); pairs[key] = true;
    const v = sums.get(r.item) ?? [0, 0]; v[0] += r.value; v[1]++; sums.set(r.item, v); total += r.value;
  }
  const global = total / rows.length, items = Object.create(null);
  for (const [item, [sum, count]] of sums) items[item] = Object.freeze({ mean: (sum + protocol.itemShrinkage * global) / (count + protocol.itemShrinkage), count });
  return Object.freeze({ global, items: Object.freeze(items), pairs: Object.freeze(pairs), trainingRows: rows.length });
}

export function scoreResponse(model, targets, evidence, protocol, domain) {
  const visible = grouped(evidence), journal = [], subjects = [];
  const [min, max] = protocol[domain].scale, base = i => model.items[i]?.mean ?? model.global;
  for (const [u, rs] of grouped(targets)) {
    const history = visible.get(u) ?? [], seen = new Set(history.map(r => r.item));
    assert.equal(seen.size, history.length, 'Duplicate visible pair');
    if (domain === 'movie') {
      const cutoff = Math.min(...rs.map(r => r.at));
      assert.ok(history.every(r => Number.isSafeInteger(r.at) && r.at < cutoff), 'Future/equal-time visible evidence');
    } else assert.ok([...history, ...rs].every(r => r.at === null), 'Invented book time');
    const fit = fitRatingResponse(history.map(r => base(r.item)), history.map(r => r.value), protocol.profileShrinkage, protocol.response);
    subjects.push({ user: u, ...fit });
    const targetsSeen = new Set();
    for (const r of rs) {
      assert.ok(!seen.has(r.item) && !targetsSeen.has(r.item) && !Object.hasOwn(model.pairs, `${u}:${r.item}`), 'Target leakage');
      targetsSeen.add(r.item);
      const values = predictRatingResponse(fit, base(r.item), min, max);
      journal.push({ user: u, item: r.item, at: r.at, actual: r.value, prediction: { values,
        itemSupport: model.items[r.item]?.count ?? 0, visibleSupport: history.length, responseSupport: fit.support } });
    }
  }
  assert.ok(journal.length && journal.length <= protocol.budgets.maxPartitionRows);
  return { journal, subjects, supported: subjects.filter(s => s.support === 'SUPPORTED').length };
}

export function decideResponse(selection, holdout, cold, support, protocol) {
  const rule = protocol.decision, holdoutChecks = checkRatingComparison(holdout, rule);
  assert.deepEqual(Object.keys(cold).map(Number), protocol.coldEvidenceBudgets);
  const coldChecks = Object.fromEntries(Object.entries(cold).map(([k, c]) => [k, {
    passed: c.predictionCoverage === 1 && (Number(k) === 0 ? c.equalControlEveryTarget
      : c.macroRmseDelta10 <= rule.maxColdMacroRmseIncrease10 && c.macroMaeDelta10 <= rule.maxColdMacroMaeIncrease10),
    macroRmseDelta10: c.macroRmseDelta10, macroMaeDelta10: c.macroMaeDelta10,
  }]));
  const enough = support.regular >= rule.minimumSupportedRegularSubjects && support.cold20 >= rule.minimumSupportedCold20Subjects;
  const retain = enough && selection.selected === protocol.challenger && selection.eligibility.passed
    && holdoutChecks.passed && Object.values(coldChecks).every(x => x.passed);
  return { disposition: !enough ? 'INSUFFICIENT_SUPPORT_RETAIN_LOCATION' : retain ? 'RETAIN_RESPONSE_SPREAD_FOR_RESEARCH' : 'RETAIN_LOCATION_ONLY_CONTROL',
    support, validationEligible: selection.eligibility.passed, holdout: holdoutChecks, cold: coldChecks,
    qualityAdmission: 'NONE', servingActivation: 'NONE' };
}

export async function runResponse(domain, inputDir, outputDir) {
  const started = performance.now(), config = await configuration(domain), { protocol } = config;
  const budget = () => assert.ok((performance.now() - started) / 1000 <= protocol.budgets.maxRunSeconds
    && process.resourceUsage().maxRSS / 1024 <= protocol.budgets.maxRssMiB, 'Run resource budget');
  const bytes = await bounded(join(inputDir, 'freeze.json'), 1048576), freeze = JSON.parse(bytes);
  assert.equal(freeze.schema, 'rating-response-freeze-v1'); assert.equal(freeze.domain, domain);
  assert.deepEqual(freeze.lineage, config.lineage, 'Source/code/protocol/runtime changed');
  assert.deepEqual(freeze.protocol, protocol);
  const data = await input(inputDir, config), { parts } = data;
  assert.equal(freeze.receiptSha256, hash(data.receiptBytes)); assert.equal(freeze.cohortSha256, hash(data.cohort));
  assert.deepEqual(freeze.exclusions, data.exclusions); assert.deepEqual(freeze.partitions, partitionSummary(parts));
  await mkdir(outputDir, { mode: 0o700 });
  await save(join(outputDir, 'run.json'), { freezeSha256: hash(bytes), domain });
  const model = fitResponseBase(parts.train, protocol, domain), modelSha256 = hash(JSON.stringify(model));
  await save(join(outputDir, 'model.json'), model);
  const compare = (scored, name) => compareRatingSubjects(scored.journal, { ...protocol, seed: `${protocol.seed}:${domain}:${name}` });
  const retain = async (scored, name) => {
    await writeFile(join(outputDir, `${name}-predictions.jsonl`), scored.journal.map(r => JSON.stringify(r)).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    await save(join(outputDir, `${name}-responses.json`), scored.subjects); budget();
  };
  const validation = scoreResponse(model, parts.validation, parts.train, protocol, domain);
  const comparison = compare(validation, 'validation'), eligibility = checkRatingComparison(comparison, protocol.decision);
  eligibility.checks.support = validation.supported >= protocol.decision.minimumSupportedRegularSubjects;
  eligibility.passed = Object.values(eligibility.checks).every(Boolean);
  const selection = { selected: eligibility.passed ? protocol.challenger : protocol.control,
    comparison, eligibility, supportedSubjects: validation.supported, modelSha256, testLabelsUsedForFitOrSelection: false };
  await retain(validation, 'validation'); await save(join(outputDir, 'selection-before-test.json'), selection);
  const test = scoreResponse(model, parts.test, parts.train, protocol, domain);
  const holdout = compare(test, 'test'); await retain(test, 'test');
  const cold = {}, coldSupport = {};
  for (const n of protocol.coldEvidenceBudgets) {
    const masks = [...grouped(parts.coldVisible).values()].map(rs => domain === 'book' ? rs.slice(0, n)
      : coldMoviePrefix(rs, n, protocol.movie.cohort.temporalSupport.testFrom));
    const scored = scoreResponse(model, parts.coldTargets, masks.flat(), protocol, domain);
    cold[n] = { ...compare(scored, `cold-${n}`), supportedSubjects: scored.supported,
      actualVisibleRatings: { minimum: Math.min(...masks.map(r => r.length)), maximum: Math.max(...masks.map(r => r.length)) },
      targetMembershipSha256: freeze.partitions.coldTargets.membershipSha256,
      equalControlEveryTarget: scored.journal.every(r => r.prediction.values[protocol.control] === r.prediction.values[protocol.challenger]) };
    coldSupport[n] = scored.supported; await retain(scored, `cold-${n}`);
  }
  assert.equal(hash(JSON.stringify(model)), modelSha256, 'Fitted base changed'); budget();
  const report = { schema: 'rating-response-development-v1', domain, freezeSha256: hash(bytes), lineage: config.lineage,
    sourceCounts: data.receipt.sourceCounts, cohort: data.receipt.cohort, cohortSha256: freeze.cohortSha256,
    exclusions: freeze.exclusions, partitions: freeze.partitions, selection, holdout, cold,
    decision: decideResponse(selection, holdout, cold, { regular: test.supported, cold20: coldSupport[20] }, protocol),
    nativeRowsWritten: 0, qualityAdmission: 'NONE', servingActivation: 'NONE',
    limitations: ['External observed-rating development task; not native FINAL or recommendation benefit.',
      domain === 'book' ? 'Third disjoint reader cohort; no dates or temporal claim.' : 'Conditional longitudinal-support population; no claim of disjoint people across MovieLens releases. Test outcomes postdate 2018 snapshot.',
      'One centered predictive interaction cannot identify psychological response scale separately from taste.',
      'Original grades preserved; source mappings do not supply native zeros or platform equivalence.',
      'No book/movie people linkage, missing-rating negatives, calibrated personal confidence or serving permission.'],
    attribution: domain === 'book' ? config.source.rights.attribution : config.source.attribution };
  await save(join(outputDir, 'report.json'), report);
  // Resource receipts are intentionally separate from deterministic model/replay bytes.
  await save(join(outputDir, 'resources.json'), { seconds: (performance.now() - started) / 1000, maxRssMiB: process.resourceUsage().maxRSS / 1024 });
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, domain, inputDir, outputDir, ...extra] = process.argv.slice(2);
    assert.ok(inputDir && outputDir && !extra.length, 'Usage: freeze|run book|movie INPUT OUTPUT');
    const result = command === 'freeze' ? await freezeResponse(domain, resolve(inputDir), resolve(outputDir))
      : command === 'run' ? await runResponse(domain, resolve(inputDir), resolve(outputDir)) : assert.fail('Unknown command');
    console.log(JSON.stringify({ status: 'PASS', domain, partitions: result.partitions, decision: result.decision }, null, 2));
  } catch (error) { console.error(`Response research stopped: ${error.message}`); process.exitCode = 1; }
}
