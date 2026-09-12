import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir, stat, rename, chmod } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fitRatingArtifact, forecastRatingBatch, ratingVariants, seededRandom,
  validateRatingArtifact, useOptionalRatingArtifact } from '@kajo/prediction-engine/research';
import { movieLensTarget } from '@kajo/prediction-engine/adapters/movielens';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const protocolPath = 'research/manifests/movielens-small-d2.json';
const codePaths = ['scripts/research/evaluate-ratings.mjs', 'packages/prediction-engine/src/research.ts',
  'packages/prediction-engine/dist/research.js', 'packages/prediction-engine/src/contracts.ts',
  'packages/prediction-engine/src/adapters/movielens.ts', 'packages/prediction-engine/dist/adapters/movielens.js',
  'packages/prediction-engine/package.json', 'package.json', 'package-lock.json'];
const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
async function fileHash(path) {
  const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function identity() {
  return { protocolSha256: await fileHash(join(root, protocolPath)),
    code: Object.fromEntries(await Promise.all(codePaths.map(async path => [path, await fileHash(join(root, path))]))),
    runtime: { node: process.versions.node, v8: process.versions.v8, platform: process.platform, arch: process.arch },
    dependencies: 'Node standard library and built @kajo/prediction-engine; npm dependencies pinned by package-lock SHA256' };
}
function requireValue(condition, message) { if (!condition) throw new Error(message); }
async function atomicJson(path, value) {
  const temporary = `${path}.partial`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temporary, path);
}
async function readRows(path, expected, budget) {
  const info = await stat(path); requireValue(info.size <= budget.maxInputBytes, 'Input byte budget exceeded');
  requireValue(await fileHash(path) === expected, 'Partition/source integrity mismatch');
  const rows = [], lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of lines) {
    requireValue(line.length <= 4096, 'Observation line budget exceeded'); rows.push(JSON.parse(line));
    requireValue(rows.length <= budget.maxRows, 'Row budget exceeded');
  }
  return rows;
}

/** Uses identities and time only. Label changes cannot change membership or cutoffs. */
export function partitionRatings(rows, protocol) {
  const subjects = [...new Set(rows.map(r => r.subjectId))].sort(lexical);
  const ranked = [...subjects].sort((a, b) => lexical(digest(`${protocol.split.seed}:${a}`), digest(`${protocol.split.seed}:${b}`)) || lexical(a, b));
  const heldOut = ranked.slice(0, Math.floor(subjects.length * protocol.split.heldOutSubjectFraction)).sort(lexical);
  const excluded = new Set(heldOut), regular = rows.filter(r => !excluded.has(r.subjectId));
  requireValue(regular.length > 0, 'No regular subjects');
  const times = regular.map(r => r.occurredAt).sort((a, b) => a - b);
  const trainBefore = times[Math.floor(times.length * protocol.split.trainQuantile)];
  const testFrom = times[Math.floor(times.length * protocol.split.testQuantile)];
  requireValue(trainBefore < testFrom, 'Insufficient distinct global time groups');
  const parts = { train: [], validation: [], test: [], heldout: [] };
  for (const row of rows) {
    requireValue(row.availableAt === row.occurredAt, 'This protocol requires the declared D1 availability assumption');
    const name = excluded.has(row.subjectId) ? 'heldout' : row.occurredAt < trainBefore ? 'train' : row.occurredAt < testFrom ? 'validation' : 'test';
    parts[name].push(row);
  }
  requireValue(parts.train.length && parts.validation.length && parts.test.length, 'Empty temporal partition');
  return { heldOut, regularSubjects: subjects.filter(s => !excluded.has(s)), trainBefore, testFrom, parts };
}
export function boundedPrefix(rows, budget, before) {
  const prefix = []; let i = 0;
  while (i < rows.length && rows[i].occurredAt < before) {
    let end = i + 1;
    while (end < rows.length && rows[end].occurredAt === rows[i].occurredAt) end++;
    if (prefix.length + end - i > budget) break;
    prefix.push(...rows.slice(i, end)); i = end;
  }
  return prefix;
}
function bySubject(rows) {
  const map = new Map(); for (const row of rows) { if (!map.has(row.subjectId)) map.set(row.subjectId, []); map.get(row.subjectId).push(row); }
  return map;
}
function monitor(budget, started) {
  requireValue((performance.now() - started) / 1000 <= budget.maxSeconds, 'Wall-time budget exceeded');
  requireValue(process.resourceUsage().maxRSS / 1024 <= budget.maxRssMiB, 'Process RSS budget exceeded');
}

export async function freezeExperiment(directory, inputOverride) {
  const protocol = await json(join(root, protocolPath)), source = await json(join(root, protocol.sourceReport));
  const codeIdentity = await identity();
  const input = inputOverride ?? join(root, 'research-artifacts/movielens-small-verified', source.normalizedRunId,
    `engine-${source.engine.conversionId}`, 'observations.jsonl');
  const started = performance.now();
  const rows = await readRows(input, source.engine.outputSha256, protocol.resources);
  requireValue(rows.length === source.cohort.ratings, 'Source cohort count changed');
  const split = partitionRatings(rows, protocol);
  requireValue(split.heldOut.length + split.regularSubjects.length === source.cohort.subjects, 'Subject count changed');
  await mkdir(directory, { recursive: false });
  const partitions = {};
  for (const [name, records] of Object.entries(split.parts)) {
    const path = join(directory, `${name}.jsonl`);
    await writeFile(path, records.map(r => JSON.stringify(r) + '\n').join(''), { flag: 'wx', mode: 0o600 });
    await chmod(path, 0o400);
    partitions[name] = { sha256: await fileHash(path), rows: records.length,
      subjects: new Set(records.map(r => r.subjectId)).size, objects: new Set(records.map(r => r.objectId)).size,
      firstAt: records[0]?.occurredAt ?? null, lastAt: records.at(-1)?.occurredAt ?? null };
  }
  const membership = { heldOut: split.heldOut, regularSubjects: split.regularSubjects };
  await atomicJson(join(directory, 'subjects.json'), membership); await chmod(join(directory, 'subjects.json'), 0o400);
  const frozen = { version: 'evaluation-manifest-v1', ...codeIdentity, protocol,
    source: { ...source.source, observationSha256: source.engine.outputSha256, normalizedRunId: source.normalizedRunId,
      cohortSubjectsSha256: source.cohort.subjectsSha256 },
    split: { trainBefore: split.trainBefore, testFrom: split.testFrom,
      trainBeforeUtc: new Date(split.trainBefore).toISOString(), testFromUtc: new Date(split.testFrom).toISOString(),
      heldOutSubjects: split.heldOut.length, regularSubjects: split.regularSubjects.length,
      membershipSha256: await fileHash(join(directory, 'subjects.json')), partitions } };
  monitor(protocol.resources, started);
  await atomicJson(join(directory, 'evaluation-manifest.json'), frozen); await chmod(join(directory, 'evaluation-manifest.json'), 0o400);
  await atomicJson(join(directory, 'freeze-receipt.json'), { frozenAt: new Date().toISOString(),
    manifestSha256: await fileHash(join(directory, 'evaluation-manifest.json')), phase: 'before-any-fitting' });
  return { directory, manifestSha256: await fileHash(join(directory, 'evaluation-manifest.json')), split: frozen.split };
}

function accumulator() { return { n: 0, abs: 0, sq: 0, supported: 0, eligible: 0, matched: 0, memorySum: 0, componentSum: 0,
  errors: [], subjects: new Map(), objects: new Set() }; }
function add(a, row, forecast) {
  requireValue(row.measurement.status === 'observed' && row.provenance.origin === 'observed'
    && row.provenance.source.kind === 'external', 'Evaluation labels must be real external observations');
  const error = forecast.value - row.measurement.value, abs = Math.abs(error), sq = error * error;
  a.n++; a.abs += abs; a.sq += sq; a.errors.push(abs); a.objects.add(row.objectId);
  if (!forecast.fallback) a.supported++;
  if (forecast.eligibleMemories) a.eligible++;
  if (forecast.eligibleMemories && forecast.componentSupport) a.matched++;
  a.memorySum += forecast.eligibleMemories; a.componentSum += forecast.componentSupport;
  const subject = a.subjects.get(row.subjectId) ?? { n: 0, abs: 0, sq: 0 };
  subject.n++; subject.abs += abs; subject.sq += sq; a.subjects.set(row.subjectId, subject);
}
const quantile = (ordered, p) => ordered.length ? ordered[Math.floor((ordered.length - 1) * p)] : null;
function summary(a, reference, replicates, seed) {
  if (!a.n) return { rows: 0, subjects: 0, objects: 0, mae: null, rmse: null, uncertainty: 'unsupported-empty-slice' };
  const subjects = [...a.subjects.keys()].sort(lexical), errors = a.errors.sort((x, y) => x - y);
  const boot = { mae: [], rmse: [], pairedRmseDelta: [] }, random = seededRandom(seed);
  if (subjects.length >= 2) for (let b = 0; b < replicates; b++) {
    let n = 0, abs = 0, sq = 0, refSq = 0;
    for (let j = 0; j < subjects.length; j++) {
      const id = subjects[Math.floor(random() * subjects.length)], value = a.subjects.get(id), ref = reference.subjects.get(id);
      requireValue(ref && value.n === ref.n, 'Paired denominator changed');
      n += value.n; abs += value.abs; sq += value.sq; refSq += ref.sq;
    }
    boot.mae.push(abs / n); boot.rmse.push(Math.sqrt(sq / n)); boot.pairedRmseDelta.push(Math.sqrt(sq / n) - Math.sqrt(refSq / n));
  }
  const intervals = Object.fromEntries(Object.entries(boot).map(([key, values]) => {
    values.sort((x, y) => x - y); return [key, values.length ? [quantile(values, 0.025), quantile(values, 0.975)] : null];
  }));
  return { rows: a.n, subjects: subjects.length, objects: a.objects.size, mae: a.abs / a.n, rmse: Math.sqrt(a.sq / a.n),
    subjectMacroMae: mean([...a.subjects.values()].map(s => s.abs / s.n)),
    subjectMacroRmse: mean([...a.subjects.values()].map(s => Math.sqrt(s.sq / s.n))),
    absoluteError: { p50: quantile(errors, 0.5), p90: quantile(errors, 0.9), p95: quantile(errors, 0.95) },
    predictionCoverage: 1, componentCoverage: a.supported / a.n, fallbackRows: a.n - a.supported,
    eligibleMemoryRows: a.eligible, matchedMemoryRows: a.matched,
    meanEligibleMemories: a.memorySum / a.n, meanComponentSupport: a.componentSum / a.n,
    ci95SubjectBootstrap: intervals, uncertainty: subjects.length >= 2 ? `${replicates} subject-cluster percentile replicates` : 'unsupported-single-subject' };
}
const mean = values => values.reduce((x, y) => x + y, 0) / values.length;

/** Batch predictions are produced before any labels in that complete time group update state. */
export function evaluateWindow(artifact, initial, targets, { prequential = false, protocol, budgetStarted = performance.now() }) {
  const state = bySubject(initial), metrics = {}, latencies = [], journals = [], prefixSizes = new Map();
  const sliceNames = ['all', 'item-cold', 'item-tail', 'item-supported', 'subject-cold', 'subject-seen'];
  for (const slice of sliceNames) metrics[slice] = Object.fromEntries(ratingVariants.map(v => [v, accumulator()]));
  const start = performance.now(); let queryTotalMs = 0;
  for (const [subjectId, history] of bySubject(targets)) {
    const prefix = [...(state.get(subjectId) ?? [])]; prefixSizes.set(subjectId, prefix.length);
    let offset = 0;
    while (offset < history.length) {
      let end = offset + 1;
      while (end < history.length && history[end].occurredAt === history[offset].occurredAt) end++;
      const group = history.slice(offset, end), asOf = group[0].occurredAt;
      const query = { scope: { subject: { id: subjectId, kind: 'individual' }, actingIdentityRef: null, sessionRef: 'offline-d2',
        evidence: { sourceIds: [artifact.sourceId], cohortIds: [], synthetic: 'exclude' } },
      asOf, prefix, objectIds: group.map(r => r.objectId) };
      const before = performance.now(), forecasts = forecastRatingBatch(artifact, query), ms = performance.now() - before;
      queryTotalMs += ms; latencies.push(ms);
      for (let i = 0; i < group.length; i++) {
        const row = group[i], predictions = forecasts[i], support = artifact.items[row.objectId]?.count ?? 0;
        const slices = ['all', support === 0 ? 'item-cold' : support < 10 ? 'item-tail' : 'item-supported',
          artifact.subjectSupport[subjectId] ? 'subject-seen' : 'subject-cold'];
        for (const variant of ratingVariants) for (const slice of slices) add(metrics[slice][variant], row, predictions[variant]);
        journals.push(JSON.stringify([row.subjectId, row.objectId, row.occurredAt, row.measurement.value,
          ...ratingVariants.map(v => predictions[v].value)]) + '\n');
      }
      if (prequential) prefix.push(...group);
      offset = end; monitor(protocol.resources, budgetStarted);
    }
  }
  const evaluationMs = performance.now() - start;
  latencies.sort((x, y) => x - y);
  const output = Object.fromEntries(sliceNames.map(slice => [slice, Object.fromEntries(ratingVariants.map(v =>
    [v, summary(metrics[slice][v], metrics[slice][protocol.selection.reference], protocol.metrics.bootstrapReplicates, protocol.models.seed)]))]));
  const sizes = [...prefixSizes.values()].sort((x, y) => x - y);
  return { metrics: output, journal: journals.join(''),
    visiblePrefix: { subjects: sizes.length, zero: sizes.filter(x => !x).length, min: sizes[0] ?? null,
      median: quantile(sizes, 0.5), max: sizes.at(-1) ?? null, mean: sizes.length ? mean(sizes) : null },
    cost: { evaluationMs, queryTotalMs, queryBatches: latencies.length, batchP50Ms: quantile(latencies, 0.5),
      batchP95Ms: quantile(latencies, 0.95), amortizedQueryMsPerTarget: targets.length ? queryTotalMs / targets.length : null,
      latencyScope: 'All eight model forecasts together, includes prefix validation/encoding/fold-in, excludes IO/error aggregation/bootstrap' } };
}
async function saveWindow(directory, name, evaluation) {
  const path = join(directory, `${name}-predictions.jsonl`);
  await writeFile(path, evaluation.journal, { flag: 'wx', mode: 0o600 });
  const { journal: _journal, ...result } = evaluation;
  return { ...result, predictionsSha256: await fileHash(path) };
}
export function chooseOnValidation(validation, protocol) {
  const candidates = protocol.selection.candidates;
  const selected = [...candidates].sort((a, b) => validation.metrics.all[a].rmse - validation.metrics.all[b].rmse || candidates.indexOf(a) - candidates.indexOf(b))[0];
  return { selected, reference: protocol.selection.reference,
    validationRmse: validation.metrics.all[selected].rmse,
    referenceRmse: validation.metrics.all[protocol.selection.reference].rmse,
    rule: protocol.selection.rule, finalLabelsUsed: false };
}
function developmentDecision(selection, final, protocol) {
  const result = final.metrics.all[selection.selected], ref = final.metrics.all[selection.reference];
  const cold = final.metrics['item-cold'][selection.selected], coldRef = final.metrics['item-cold'][selection.reference];
  if (selection.referenceRmse - selection.validationRmse < protocol.selection.minimumValidationRmseGain)
    return { decision: 'reject', reason: 'Selected challenger did not meet the predeclared validation improvement threshold.' };
  if (result.subjects < 2 || !result.ci95SubjectBootstrap.pairedRmseDelta)
    return { decision: 'defer', reason: 'Insufficient subject support for paired final uncertainty.' };
  if (result.ci95SubjectBootstrap.pairedRmseDelta[1] >= 0)
    return { decision: 'reject', reason: 'Final paired subject uncertainty does not support lower RMSE than the durable-state reference.' };
  if (cold.subjects >= 20 && cold.rmse - coldRef.rmse > 0.1)
    return { decision: 'reject', reason: 'Supported cold-item degradation exceeds the predeclared 0.1 RMSE guardrail.' };
  return { decision: 'admit-development-only', reason: 'Predeclared development criteria passed; no serving authorization.',
    rmseDelta: result.rmse - ref.rmse, coldItemGuardrail: cold.subjects >= 20 ? 'passed' : 'unsupported-fewer-than-20-subjects' };
}

export async function runExperiment(frozenDirectory, outputDirectory) {
  const started = performance.now(), frozen = await json(join(frozenDirectory, 'evaluation-manifest.json'));
  const receipt = await json(join(frozenDirectory, 'freeze-receipt.json')), current = await identity();
  requireValue(receipt.manifestSha256 === await fileHash(join(frozenDirectory, 'evaluation-manifest.json')), 'Frozen manifest changed');
  for (const key of Object.keys(current)) requireValue(digest(current[key]) === digest(frozen[key]), `Frozen ${key} identity changed; do not silently reuse test results`);
  const { protocol, split } = frozen, budget = protocol.resources;
  requireValue(await fileHash(join(frozenDirectory, 'subjects.json')) === split.membershipSha256, 'Subject membership changed');
  const members = await json(join(frozenDirectory, 'subjects.json'));
  const readPartition = name => readRows(join(frozenDirectory, `${name}.jsonl`), split.partitions[name].sha256, budget);
  const train = await readPartition('train'), validation = await readPartition('validation');
  await mkdir(outputDirectory, { recursive: false });
  const artifact = fitRatingArtifact(train, { id: receipt.manifestSha256, sourceId: `${frozen.source.datasetId}:${frozen.source.releaseId}`,
    manifestId: `${frozen.source.datasetId}:${frozen.source.releaseId}:sha256:${frozen.source.archiveSha256}`,
    subjectIds: members.regularSubjects, trainBefore: split.trainBefore, target: movieLensTarget, config: protocol.models });
  requireValue(validateRatingArtifact(artifact), 'Fitted artifact failed validation'); monitor(budget, started);
  const { fitCostMs, ...parameters } = artifact;
  const artifactPath = join(outputDirectory, 'model.json'); await atomicJson(artifactPath, parameters);
  requireValue((await stat(artifactPath)).size <= budget.maxArtifactBytes, 'Fitted artifact size budget exceeded');
  const modelSha256 = await fileHash(artifactPath);
  const validationResult = await saveWindow(outputDirectory, 'validation-frozen', evaluateWindow(artifact, train, validation, { protocol, budgetStarted: started }));
  const selection = { ...chooseOnValidation(validationResult, protocol), modelSha256,
    evaluationManifestSha256: receipt.manifestSha256, selectedAt: new Date().toISOString() };
  await atomicJson(join(outputDirectory, 'selection.json'), selection); await chmod(join(outputDirectory, 'selection.json'), 0o400);
  // This is the first read of final partitions by the fitting/evaluation command.
  const test = await readPartition('test'), heldout = await readPartition('heldout');
  const finalFrozen = await saveWindow(outputDirectory, 'test-frozen', evaluateWindow(artifact, train, test, { protocol, budgetStarted: started }));
  const finalPrequential = await saveWindow(outputDirectory, 'test-prequential', evaluateWindow(artifact, [...train, ...validation], test,
    { prequential: true, protocol, budgetStarted: started }));
  const coldTargets = heldout.filter(r => r.occurredAt >= split.testFrom), cold = {};
  for (const prefixBudget of protocol.split.coldPrefixes) {
    const prefix = [...bySubject(heldout).values()].flatMap(rows => boundedPrefix(rows, prefixBudget, split.testFrom));
    cold[prefixBudget] = await saveWindow(outputDirectory, `heldout-prefix-${prefixBudget}`, evaluateWindow(artifact, prefix, coldTargets,
      { protocol, budgetStarted: started }));
  }
  const probe = test[0], query = { asOf: probe.occurredAt, prefix: train.filter(r => r.subjectId === probe.subjectId),
    scope: { subject: { id: probe.subjectId, kind: 'individual' }, actingIdentityRef: null, sessionRef: 'fallback-probe',
      evidence: { sourceIds: [artifact.sourceId], cohortIds: [], synthetic: 'exclude' } }, objectIds: [probe.objectId] };
  const fallback = Object.fromEntries([['absent', null], ['invalid', { ...artifact, schema: 'invalid' }], ['withdrawn', { ...artifact, status: 'withdrawn' }]]
    .map(([name, value]) => [name, useOptionalRatingArtifact(value, query, movieLensTarget)]));
  requireValue(Object.values(fallback).every(result => result.mode === 'native-only-fallback' && result.value === null && result.nativeSupport === 0),
    'External influence survived fallback');
  requireValue(await fileHash(artifactPath) === modelSha256, 'Artifact changed during final evaluation');
  monitor(budget, started);
  const results = { validationFrozen: validationResult, finalFrozen, finalPrequential, heldOutColdPrefixes: cold };
  const report = { reportVersion: 'movielens-d2-development-v1', evaluationManifestSha256: receipt.manifestSha256,
    manifest: frozen, freezeReceipt: receipt, selection, model: { sha256: modelSha256, bytes: (await stat(artifactPath)).size,
      trainingRows: train.length, trainingSubjects: Object.keys(artifact.subjectSupport).length, trainingItems: Object.keys(artifact.items).length,
      indexedItems: Object.values(artifact.items).filter(i => i.neighbors.length).length,
      memories: Object.values(artifact.memories).reduce((n, list) => n + list.length, 0), fittedParametersPublished: false },
    results, developmentDecision: developmentDecision(selection, finalFrozen, protocol),
    nativeAdmission: { decision: 'defer', reasons: protocol.artifactPolicy.nativeAdmission }, fallback,
    runtime: { ...current.runtime, fitCostMs, totalSeconds: (performance.now() - started) / 1000,
      maxRssKiB: process.resourceUsage().maxRSS, memoryMeasure: 'Node process resourceUsage().maxRSS, Linux KiB; excludes npm/TypeScript build parent' },
    attribution: { publisher: 'GroupLens Research, MovieLens Latest Small September 2018 / Kaggle version 2',
      url: 'https://www.kaggle.com/datasets/grouplens/movielens-latest-small',
      paper: 'F. Maxwell Harper and Joseph A. Konstan. 2015. The MovieLens Datasets: History and Context. ACM TiiS 5(4), Article 19. https://doi.org/10.1145/2827872',
      endorsement: 'No endorsement by GroupLens is implied' },
    limitations: ['Publisher development dataset; this is not a shared benchmark, population estimate or native uplift.',
      'Only observed explicit ratings are scored. Exposure, context, viewing time, action propensities and unlabeled dislikes remain unknown.',
      'Global models never refit on validation/test labels. The separately named prequential run updates only the permitted subject prefix after each scored time group.',
      'Cold prefixes retain whole time groups within a budget; batching can leave fewer visible ratings than nominal 5/10/20.',
      'Item-neighbor coverage is bounded to train-popularity top 1000. Retrieval uses exact object identity and rating-prefix analogues, not complete behavioral Scenarios.',
      'All feature metadata is off because historical availability is unresolved; no metadata-on, cross-domain, Shared, recommendation ranking or native quality result is available.',
      'Subject bootstrap intervals describe this selected development cohort and do not correct source selection bias or test multiple comparisons.',
      'Only the preselected validation winner faces the final admission rule; other final model scores and slices are diagnostic, never a second selection.',
      'No fitted weights or histories are published. Withdrawal requires replacing all dependent parameters/indexes, with a separately evaluated authorized rebuild.'] };
  const stable = { model: report.model, results: JSON.parse(JSON.stringify(results, (key, value) => key === 'cost' ? undefined : value)),
    selected: selection.selected, developmentDecision: report.developmentDecision, fallback };
  report.deterministicResultSha256 = digest(stable);
  await atomicJson(join(outputDirectory, 'report.json'), report);
  return { outputDirectory, report: join(outputDirectory, 'report.json'), modelSha256,
    deterministicResultSha256: report.deterministicResultSha256, selected: selection.selected,
    developmentDecision: report.developmentDecision, totalSeconds: report.runtime.totalSeconds, maxRssKiB: report.runtime.maxRssKiB };
}

async function main() {
  const args = process.argv.slice(2), mode = args.shift() ?? 'all';
  requireValue(['all', 'freeze', 'run'].includes(mode), 'Use all, freeze or run');
  const options = {};
  while (args.length) { const key = args.shift(); requireValue(['--frozen-dir', '--output-dir', '--input'].includes(key) && args.length, 'Unknown or incomplete option'); options[key] = args.shift(); }
  const frozen = resolve(root, options['--frozen-dir'] ?? 'research-artifacts/movielens-d2-frozen');
  const output = resolve(root, options['--output-dir'] ?? 'research-artifacts/movielens-d2-run');
  for (const path of [frozen, output]) requireValue(relative(join(root, 'research-artifacts'), path)
    && !relative(join(root, 'research-artifacts'), path).startsWith('..'), 'D2 output must stay within ignored research-artifacts');
  if (mode !== 'run') console.log(JSON.stringify(await freezeExperiment(frozen, options['--input'] ? resolve(options['--input']) : undefined)));
  if (mode !== 'freeze') console.log(JSON.stringify(await runExperiment(frozen, output)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
