import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir, stat, rename, chmod } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fitRatingArtifact, forecastRatingBatch, ratingVariants, validateRatingArtifact } from '@kajo/prediction-engine/research';
import { movieLensTarget } from '@kajo/prediction-engine/adapters/movielens';
import { digest, partitionRatings, ratingAccumulator, addRatingError, summarizeRatingErrors } from './evaluate-ratings.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const protocolPath = 'research/manifests/movielens-small-prefix-study.json';
const codePaths = ['scripts/research/evaluate-prefixes.mjs', 'scripts/research/evaluate-ratings.mjs',
  'packages/prediction-engine/src/research.ts', 'packages/prediction-engine/dist/research.js',
  'packages/prediction-engine/src/contracts.ts', 'packages/prediction-engine/src/adapters/movielens.ts',
  'packages/prediction-engine/dist/adapters/movielens.js', 'packages/prediction-engine/package.json',
  'package.json', 'package-lock.json'];
const slices = ['all', 'item-cold', 'item-tail', 'item-supported'];
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
async function fileHash(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function atomicJson(path, value) {
  const temp = `${path}.partial`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temp, path);
}
function monitor(budget, started) {
  ensure((performance.now() - started) / 1000 <= budget.maxSeconds, 'Study wall-time budget exceeded');
  ensure(process.resourceUsage().maxRSS / 1024 <= budget.maxRssMiB, 'Study RSS budget exceeded');
}
async function readRows(path, expected, budget) {
  ensure((await stat(path)).size <= budget.maxInputBytes, 'Study input byte budget exceeded');
  ensure(await fileHash(path) === expected, 'Study source/partition hash mismatch');
  const rows = [], lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of lines) {
    ensure(line.length <= 4096, 'Study observation line budget exceeded');
    rows.push(JSON.parse(line)); ensure(rows.length <= budget.maxRows, 'Study row budget exceeded');
  }
  return rows;
}
async function identity(protocol) {
  const paths = [...codePaths, protocolPath, protocol.sourceReport, protocol.sourceManifest,
    protocol.parentProtocol, protocol.parentReport];
  return { files: Object.fromEntries(await Promise.all(paths.map(async path => [path, await fileHash(join(root, path))]))),
    runtime: { node: process.versions.node, v8: process.versions.v8, platform: process.platform, arch: process.arch } };
}
const serializeRows = rows => rows.map(row => JSON.stringify(row) + '\n').join('');

/** Membership, original cutoffs and all D2 partitions are fixed; labels never choose a new split. */
export function verifyParentSplit(rows, parentProtocol, parentReport) {
  ensure(digest(parentProtocol) === digest(parentReport.manifest.protocol), 'Original D2 protocol/configuration changed');
  const split = partitionRatings(rows, parentProtocol), expected = parentReport.manifest.split;
  ensure(split.trainBefore === expected.trainBefore && split.testFrom === expected.testFrom, 'Original D2 cutoffs changed');
  const membership = { heldOut: split.heldOut, regularSubjects: split.regularSubjects };
  ensure(digest(JSON.stringify(membership, null, 2) + '\n') === expected.membershipSha256, 'Original D2 membership changed');
  for (const [name, records] of Object.entries(split.parts)) {
    ensure(records.length === expected.partitions[name].rows
      && digest(serializeRows(records)) === expected.partitions[name].sha256, `Original D2 ${name} partition changed`);
  }
  return split;
}

/** Contiguous whole-group selection using time/identity only, never rating values. */
export function selectTemporalPrefix(rows, { subjectId, budget, asOf, policy }) {
  ensure(Number.isSafeInteger(budget) && budget >= 0 && budget <= 20
    && Number.isSafeInteger(asOf) && asOf >= 0 && ['earliest', 'recent'].includes(policy), 'Invalid prefix policy/budget/time');
  const groups = []; let previous = -1;
  for (const row of rows) {
    ensure(row.subjectId === subjectId && Number.isSafeInteger(row.occurredAt) && row.occurredAt >= previous
      && row.availableAt === row.occurredAt, 'Foreign, unordered or unsupported prefix history');
    previous = row.occurredAt;
    if (row.availableAt >= asOf) continue;
    if (groups.at(-1)?.[0].occurredAt === row.occurredAt) groups.at(-1).push(row);
    else groups.push([row]);
  }
  const selected = []; let count = 0, blockedGroupSize = 0;
  if (budget > 0) for (const group of policy === 'earliest' ? groups : [...groups].reverse()) {
    if (count + group.length > budget) { blockedGroupSize = group.length; break; }
    selected.push(group); count += group.length;
    if (count === budget) break;
  }
  if (policy === 'recent') selected.reverse();
  return { rows: selected.flat(), eligibleRows: groups.reduce((n, group) => n + group.length, 0),
    groups: selected.length, blockedGroupSize };
}
function groupSubjects(rows) {
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row.subjectId)) result.set(row.subjectId, []);
    result.get(row.subjectId).push(row);
  }
  return result;
}
const quantile = (values, p) => values.length ? values[Math.floor((values.length - 1) * p)] : null;
function distribution(values) {
  const ordered = [...values].sort((a, b) => a - b);
  return { count: values.length, min: ordered[0] ?? null, p50: quantile(ordered, 0.5),
    p95: quantile(ordered, 0.95), max: ordered.at(-1) ?? null,
    mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
}
function prefixAccumulator() {
  return { queries: 0, targets: 0, sizes: [], oldest: [], newest: [], zeroQueries: 0, noHistoryQueries: 0,
    blockedQueries: 0, blockedZeroQueries: 0, selectedSumTargets: 0, supportedTargets: 0,
    oldestSumTargets: 0, newestSumTargets: 0, selectorMs: 0, forecastMs: 0 };
}
function addPrefix(a, selection, asOf, targets) {
  a.queries++; a.targets += targets; a.sizes.push(selection.rows.length);
  a.selectedSumTargets += selection.rows.length * targets;
  if (!selection.rows.length) a.zeroQueries++;
  if (!selection.eligibleRows) a.noHistoryQueries++;
  if (selection.blockedGroupSize) { a.blockedQueries++; if (!selection.rows.length) a.blockedZeroQueries++; }
  if (selection.rows.length) {
    const oldest = (asOf - selection.rows[0].occurredAt) / 86400000;
    const newest = (asOf - selection.rows.at(-1).occurredAt) / 86400000;
    a.oldest.push(oldest); a.newest.push(newest); a.supportedTargets += targets;
    a.oldestSumTargets += oldest * targets; a.newestSumTargets += newest * targets;
  }
}
function prefixSummary(a) {
  return { queries: a.queries, targets: a.targets, zeroSelectedQueries: a.zeroQueries,
    noEligibleHistoryQueries: a.noHistoryQueries, oversizedBoundaryQueries: a.blockedQueries,
    oversizedBoundaryZeroQueries: a.blockedZeroQueries,
    queryWeighted: { selectedRatings: distribution(a.sizes), oldestAgeDays: distribution(a.oldest), newestAgeDays: distribution(a.newest) },
    targetWeighted: { meanSelectedRatings: a.targets ? a.selectedSumTargets / a.targets : null,
      targetsWithSelectedHistory: a.supportedTargets,
      meanOldestAgeDays: a.supportedTargets ? a.oldestSumTargets / a.supportedTargets : null,
      meanNewestAgeDays: a.supportedTargets ? a.newestSumTargets / a.supportedTargets : null },
    ageScope: 'Rating-entry age; conditional on a nonempty selected prefix, not viewing time' };
}

/** All conditions share one query-group walk and exact target/label identity journal. */
export function evaluatePrefixStudy(artifact, initial, targets, protocol, parentProtocol, started = performance.now()) {
  ensure(targets.length > 0, 'No exploratory targets');
  ensure(protocol.primary.budget === 10 && protocol.primary.variant === 'state-static', 'Primary contrast changed');
  const conditions = new Map(), state = groupSubjects(initial), artifactBefore = digest(artifact);
  for (const policy of protocol.prefix.policies) for (const budget of protocol.prefix.budgets) {
    conditions.set(`${policy}-${budget}`, { policy, budget,
      metrics: Object.fromEntries(slices.map(slice => [slice, Object.fromEntries(ratingVariants.map(v => [v, ratingAccumulator()]))])),
      prefix: prefixAccumulator(), journal: [], identities: createHash('sha256') });
  }
  const heldSubjects = new Set(targets.map(row => row.subjectId));
  ensure([...heldSubjects].every(id => !Object.hasOwn(artifact.subjectSupport, id)), 'Held-out subjects entered the global fit');
  ensure(initial.every(row => heldSubjects.has(row.subjectId) && row.availableAt < artifact.version.availableAt),
    'Initial history must be scored-subject history before training cutoff');
  for (const [subjectId, history] of groupSubjects(targets)) {
    const visible = [...(state.get(subjectId) ?? [])];
    let offset = 0, previous = artifact.version.availableAt;
    while (offset < history.length) {
      let end = offset + 1;
      while (end < history.length && history[end].occurredAt === history[offset].occurredAt) end++;
      const group = history.slice(offset, end), asOf = group[0].occurredAt;
      ensure(asOf >= previous && group.every(row => row.availableAt === asOf), 'Unordered or unavailable study targets');
      previous = asOf;
      // Generate every policy's predictions before any current label enters the visible history.
      for (const condition of conditions.values()) {
        const before = performance.now();
        const selected = selectTemporalPrefix(visible, { subjectId, budget: condition.budget, asOf, policy: condition.policy });
        condition.prefix.selectorMs += performance.now() - before;
        addPrefix(condition.prefix, selected, asOf, group.length);
        const query = { scope: { subject: { id: subjectId, kind: 'individual' }, actingIdentityRef: null,
          sessionRef: 'exploratory-prefix-v1', evidence: { sourceIds: [artifact.sourceId], cohortIds: [], synthetic: 'exclude' } },
        asOf, prefix: selected.rows, objectIds: group.map(row => row.objectId) };
        const queryStart = performance.now(), forecasts = forecastRatingBatch(artifact, query);
        condition.prefix.forecastMs += performance.now() - queryStart;
        for (let i = 0; i < group.length; i++) {
          const row = group[i], predictions = forecasts[i], support = artifact.items[row.objectId]?.count ?? 0;
          const identity = JSON.stringify([row.subjectId, row.objectId, row.occurredAt, row.measurement.value]);
          condition.identities.update(identity + '\n');
          condition.journal.push(JSON.stringify([row.subjectId, row.objectId, row.occurredAt, row.measurement.value,
            ...ratingVariants.map(v => predictions[v].value)]) + '\n');
          for (const slice of ['all', support === 0 ? 'item-cold' : support < 10 ? 'item-tail' : 'item-supported']) {
            for (const variant of ratingVariants) addRatingError(condition.metrics[slice][variant], row, predictions[variant]);
          }
        }
      }
      visible.push(...group); offset = end; monitor(protocol.resources, started);
    }
  }
  ensure(digest(artifact) === artifactBefore, 'Global artifact changed during study');
  const identities = [...conditions.values()].map(c => c.identities.digest('hex'));
  ensure(new Set(identities).size === 1, 'Policy target identities or labels changed');
  const results = {}, journals = {};
  for (const [id, condition] of conditions) {
    const reference = conditions.get(`earliest-${condition.budget}`);
    ensure(reference, 'Missing paired earliest condition');
    results[id] = { policy: condition.policy, budget: condition.budget, targetIdentitySha256: identities[0],
      metrics: Object.fromEntries(slices.map(slice => [slice, Object.fromEntries(ratingVariants.map(variant => [variant,
        summarizeRatingErrors(condition.metrics[slice][variant], reference.metrics[slice][variant],
          parentProtocol.metrics.bootstrapReplicates, parentProtocol.models.seed)]))])),
      prefix: prefixSummary(condition.prefix),
      cost: { selectorMs: condition.prefix.selectorMs, forecastMs: condition.prefix.forecastMs,
        scope: 'Selector and all eight built-model forecasts separately; excludes IO, metrics and bootstrap' } };
    journals[id] = condition.journal.join('');
  }
  const before = results['earliest-10'].metrics.all['state-static'], after = results['recent-10'].metrics.all['state-static'];
  return { results, journals, primary: { variant: 'state-static', budget: 10,
    rows: after.rows, subjects: after.subjects, earliestRmse: before.rmse, recentRmse: after.rmse,
    recentMinusEarliestRmse: after.rmse - before.rmse, pairedSubjectBootstrap95: after.ci95SubjectBootstrap.pairedRmseDelta,
    minimumSubjectSupportMet: after.subjects >= protocol.primary.minimumSubjects,
    minimumMaterialGainMet: before.rmse - after.rmse >= protocol.primary.minimumMaterialGain,
    interpretation: 'Exploratory policy contrast only; no selection or admission, no fresh holdout claim' } };
}

export async function freezePrefixStudy(directory, inputOverride) {
  const protocol = await json(join(root, protocolPath)), parentProtocol = await json(join(root, protocol.parentProtocol));
  const parentReport = await json(join(root, protocol.parentReport)), source = await json(join(root, protocol.sourceReport));
  const sourceManifest = await json(join(root, protocol.sourceManifest)), started = performance.now();
  ensure(sourceManifest.sourceVerification.status === 'verified'
    && sourceManifest.rights.research === 'approved-for-noncommercial-research'
    && sourceManifest.sourceVerification.archiveSha256 === source.source.archiveSha256, 'Source rights/identity not approved');
  const input = inputOverride ?? join(root, 'research-artifacts/movielens-small-verified', source.normalizedRunId,
    `engine-${source.engine.conversionId}`, 'observations.jsonl');
  const observations = await readRows(input, source.engine.outputSha256, protocol.resources);
  ensure(observations.length === source.cohort.ratings, 'Source cohort row count changed');
  const split = verifyParentSplit(observations, parentProtocol, parentReport);
  const targets = split.parts.heldout.filter(row => row.occurredAt >= split.trainBefore);
  const scored = new Set(targets.map(row => row.subjectId));
  const parts = { train: split.parts.train,
    initial: split.parts.heldout.filter(row => row.occurredAt < split.trainBefore && scored.has(row.subjectId)), targets };
  await mkdir(directory, { recursive: false });
  const partitions = {};
  for (const [name, rows] of Object.entries(parts)) {
    const path = join(directory, `${name}.jsonl`);
    await writeFile(path, serializeRows(rows), { flag: 'wx', mode: 0o600 }); await chmod(path, 0o400);
    partitions[name] = { sha256: await fileHash(path), rows: rows.length,
      subjects: new Set(rows.map(row => row.subjectId)).size, objects: new Set(rows.map(row => row.objectId)).size };
  }
  const frozen = { schema: 'prefix-study-freeze-v1', identity: await identity(protocol), protocol, parentProtocol,
    source: { ...source.source, observationSha256: source.engine.outputSha256 },
    originalSplit: parentReport.manifest.split, partitions };
  await atomicJson(join(directory, 'manifest.json'), frozen); await chmod(join(directory, 'manifest.json'), 0o400);
  await atomicJson(join(directory, 'freeze-receipt.json'), { frozenAt: new Date().toISOString(), phase: 'before-any-study-fitting',
    manifestSha256: await fileHash(join(directory, 'manifest.json')), interpretation: 'Reused D2 outcomes; fixed exploratory protocol' });
  monitor(protocol.resources, started);
  return { directory, manifestSha256: await fileHash(join(directory, 'manifest.json')), partitions };
}

export async function runPrefixStudy(directory, output) {
  const started = performance.now(), frozen = await json(join(directory, 'manifest.json'));
  const receipt = await json(join(directory, 'freeze-receipt.json')), { protocol, parentProtocol } = frozen;
  ensure(receipt.manifestSha256 === await fileHash(join(directory, 'manifest.json')), 'Study frozen manifest changed');
  ensure(digest(await identity(protocol)) === digest(frozen.identity), 'Study code/source/protocol/runtime changed; freeze a new explicit run');
  const read = name => readRows(join(directory, `${name}.jsonl`), frozen.partitions[name].sha256, protocol.resources);
  const train = await read('train');
  await mkdir(output, { recursive: false });
  const artifact = fitRatingArtifact(train, { id: receipt.manifestSha256, sourceId: `${frozen.source.datasetId}:${frozen.source.releaseId}`,
    manifestId: `${frozen.source.datasetId}:${frozen.source.releaseId}:sha256:${frozen.source.archiveSha256}`,
    subjectIds: [...new Set(train.map(row => row.subjectId))], trainBefore: frozen.originalSplit.trainBefore,
    target: movieLensTarget, config: parentProtocol.models });
  ensure(validateRatingArtifact(artifact), 'Study artifact validation failed');
  const { fitCostMs, ...parameters } = artifact;
  await atomicJson(join(output, 'model.json'), parameters);
  const modelBytes = (await stat(join(output, 'model.json'))).size;
  ensure(modelBytes <= protocol.resources.maxArtifactBytes, 'Study artifact byte budget exceeded');
  const modelSha256 = await fileHash(join(output, 'model.json'));
  const initial = await read('initial'), targets = await read('targets');
  const evaluated = evaluatePrefixStudy(artifact, initial, targets, protocol, parentProtocol, started);
  for (const [id, journal] of Object.entries(evaluated.journals)) {
    await writeFile(join(output, `${id}-predictions.jsonl`), journal, { flag: 'wx', mode: 0o600 });
    evaluated.results[id].predictionsSha256 = digest(journal);
  }
  ensure(await fileHash(join(output, 'model.json')) === modelSha256, 'Saved model changed during evaluation');
  monitor(protocol.resources, started);
  const report = { reportVersion: 'movielens-prefix-exploratory-v1', recordedAt: new Date().toISOString(),
    manifest: frozen, freezeReceipt: receipt,
    model: { sha256: modelSha256, bytes: modelBytes, trainingRows: train.length,
      trainingSubjects: Object.keys(artifact.subjectSupport).length, trainingItems: Object.keys(artifact.items).length,
      fittedParametersPublished: false }, results: evaluated.results, primary: evaluated.primary,
    nativeAdmission: { decision: 'defer', reason: protocol.nativeAdmission },
    runtime: { ...frozen.identity.runtime, fitCostMs, totalSeconds: (performance.now() - started) / 1000,
      maxRssKiB: process.resourceUsage().maxRSS, memoryScope: 'Linux Node process high-water RSS; excludes npm/TypeScript build parent' },
    attribution: { publisher: 'GroupLens Research, MovieLens Latest Small September 2018 / Kaggle v2',
      url: 'https://www.kaggle.com/datasets/grouplens/movielens-latest-small',
      paper: 'F. Maxwell Harper and Joseph A. Konstan (2015), The MovieLens Datasets: History and Context. https://doi.org/10.1145/2827872',
      endorsement: 'No GroupLens endorsement implied' },
    limitations: ['Previously inspected D2 outcomes: exploratory development only, not a fresh final test or a shared benchmark.',
      'Rating-entry chronology is not consumption history, recommendation exposure, native product uplift or causal evidence.',
      'Whole-group policies can retain different actual row counts; the primary contrast is policy effect at a maximum budget, not pure recency at equal information.',
      'Subject bootstrap intervals describe this selected cohort, without correcting dataset selection or diagnostic multiple comparisons.',
      'Only original regular-subject pre-cutoff rows train global artifacts; later held-out answers only update that subject after scoring.',
      'No book ratings, cross-domain transfer, Shared behavior, native serving integration or artifact admission is established.'] };
  report.deterministicResultSha256 = digest({ model: report.model, primary: report.primary,
    results: JSON.parse(JSON.stringify(report.results, (key, value) => key === 'cost' ? undefined : value)) });
  await atomicJson(join(output, 'report.json'), report);
  return { output, report: join(output, 'report.json'), modelSha256, deterministicResultSha256: report.deterministicResultSha256,
    primary: report.primary, totalSeconds: report.runtime.totalSeconds, maxRssKiB: report.runtime.maxRssKiB };
}

async function main() {
  const args = process.argv.slice(2), mode = args.shift() ?? 'all', options = {};
  ensure(['all', 'freeze', 'run'].includes(mode), 'Use all, freeze or run');
  while (args.length) {
    const key = args.shift();
    ensure(['--frozen-dir', '--output-dir', '--input'].includes(key) && args.length && !(key in options), 'Unknown/duplicate/incomplete option');
    options[key] = args.shift();
  }
  const directory = resolve(root, options['--frozen-dir'] ?? 'research-artifacts/movielens-prefix-frozen');
  const output = resolve(root, options['--output-dir'] ?? 'research-artifacts/movielens-prefix-run');
  for (const path of [directory, output]) {
    const within = relative(join(root, 'research-artifacts'), path);
    ensure(within && !within.startsWith('..'), 'Study outputs must stay within ignored research-artifacts');
  }
  if (mode !== 'run') console.log(JSON.stringify(await freezePrefixStudy(directory, options['--input'] ? resolve(options['--input']) : undefined)));
  if (mode !== 'freeze') console.log(JSON.stringify(await runPrefixStudy(directory, output)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
