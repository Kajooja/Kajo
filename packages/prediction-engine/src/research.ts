import type { ArtifactVersion, Observation, PredictionScope, TargetDefinition } from './contracts.js';

/** Bounded offline estimators. This separate export is never imported by serving. */
export const ratingVariants = ['global-mean', 'item-mean', 'state-static', 'state-recent',
  'item-neighbor', 'factorization', 'retrieval-static', 'trajectory'] as const;
export type RatingVariant = typeof ratingVariants[number];
export interface RatingConfig {
  seed: number; itemShrinkage: number; subjectShrinkage: number; recentGroups: number; recentWeight: number;
  neighbors: { maxItems: number; minSupport: number; minOverlap: number; shrinkage: number; topK: number };
  factorization: { dimensions: number; epochs: number; learningRate: number; regularization: number; foldInRidge: number };
  retrieval: { maxMemories: number; perItem: number; topK: number; maxDistance: number; weight: number; minPrefixGroups: number };
}
export interface RatingFitSpec {
  id: string; sourceId: string; manifestId: string; subjectIds: readonly string[];
  trainBefore: number; target: TargetDefinition; config: RatingConfig;
}
interface Item { mean: number; count: number; vector: number[]; neighbors: [string, number][] }
interface Memory { subjectId: string; availableAt: number; mean: number; recent: number[]; value: number; key: number }
export interface RatingArtifact {
  schema: 'numeric-research-v1'; status: 'research' | 'withdrawn'; version: ArtifactVersion;
  sourceId: string; manifestId: string; target: TargetDefinition; config: RatingConfig;
  globalMean: number; trainCount: number; subjectSupport: Record<string, number>;
  items: Record<string, Item>; memories: Record<string, Memory[]>;
  fitCostMs?: { means: number; neighbors: number; factorization: number; memories: number };
}
export interface RatingForecast {
  value: number; kind: 'numeric-estimate'; calibration: 'uncalibrated';
  componentSupport: number; itemSupport: number; prefixSupport: number;
  eligibleMemories: number; fallback: boolean;
}
export interface RatingQuery {
  scope: PredictionScope; asOf: number; prefix: readonly Observation[]; objectIds: readonly string[];
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
function stableKey(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (const c of value) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
function validateConfig(c: RatingConfig): void {
  const ints = [c.seed, c.recentGroups, c.neighbors.maxItems, c.neighbors.minSupport,
    c.neighbors.minOverlap, c.neighbors.topK, c.factorization.dimensions,
    c.factorization.epochs, c.retrieval.maxMemories, c.retrieval.perItem,
    c.retrieval.topK, c.retrieval.minPrefixGroups];
  check(ints.every(x => Number.isSafeInteger(x) && x > 0), 'Invalid integer model budget');
  check(c.neighbors.maxItems <= 1000 && c.neighbors.topK <= 100 && c.factorization.dimensions <= 16
    && c.factorization.epochs <= 30 && c.retrieval.maxMemories <= 10000
    && c.retrieval.perItem <= 100 && c.retrieval.topK <= 100 && c.recentGroups <= 10
    && c.retrieval.minPrefixGroups >= c.recentGroups,
  'Model budget exceeded');
  check([c.itemShrinkage, c.subjectShrinkage, c.neighbors.shrinkage, c.factorization.learningRate,
    c.factorization.regularization, c.factorization.foldInRidge].every(x => Number.isFinite(x) && x > 0),
  'Invalid regularization');
  check([c.recentWeight, c.retrieval.weight, c.retrieval.maxDistance].every(x => Number.isFinite(x) && x >= 0 && x <= 1),
    'Invalid model weight');
}
function valueOf(o: Observation, spec: Pick<RatingFitSpec, 'sourceId' | 'manifestId' | 'target'>): number {
  check(o.provenance.origin === 'observed' && o.provenance.source.kind === 'external'
    && o.provenance.source.id === spec.sourceId && o.provenance.source.manifestId === spec.manifestId,
  'Unadmitted or synthetic research evidence');
  check(o.targetId === spec.target.id && o.targetVersion === spec.target.version
    && o.measurement.status === 'observed', 'Unsupported or missing target');
  const value = o.measurement.value;
  check(Number.isFinite(value) && value >= spec.target.scale.min && value <= spec.target.scale.max
    && o.raw.value === value && o.raw.scale.min === spec.target.scale.min && o.raw.scale.max === spec.target.scale.max,
  'Invalid original rating scale');
  check(Number.isSafeInteger(o.occurredAt) && o.occurredAt >= 0 && Number.isSafeInteger(o.availableAt)
    && o.availableAt >= o.occurredAt, 'Invalid evidence time');
  check(o.provenance.source.availability === 'assumed-at-occurrence' && o.availableAt === o.occurredAt,
    'This research protocol requires its declared occurrence-time availability assumption');
  check(o.access.kind === 'subject' && o.access.subjectId === o.subjectId && o.provenance.revision === 1,
    'Unsupported research scope or revision');
  return value;
}
function groupHistory(rows: readonly Observation[]): Observation[][] {
  const groups: Observation[][] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last?.[0]?.occurredAt === row.occurredAt) last.push(row);
    else groups.push([row]);
  }
  return groups;
}
function mean(values: readonly number[]): number { return values.reduce((a, b) => a + b, 0) / values.length; }
function observed(o: Observation): number {
  check(o.measurement.status === 'observed', 'Missing rating');
  return o.measurement.value;
}

export function fitRatingArtifact(rows: readonly Observation[], spec: RatingFitSpec): RatingArtifact {
  validateConfig(spec.config);
  check(rows.length > 0 && rows.length <= 100000 && spec.subjectIds.length <= 500,
    'Training budget exceeded or empty');
  check(Number.isSafeInteger(spec.trainBefore) && spec.trainBefore > 0 && spec.id
    && spec.target.conditioning === 'object-observation' && spec.target.exposure === 'not-required'
    && spec.target.scale.max > spec.target.scale.min, 'Unsupported training specification');
  const start = performance.now();
  const permitted = new Set(spec.subjectIds), seen = new Set<string>();
  const bySubject = new Map<string, Observation[]>(), sums = new Map<string, [number, number]>();
  let total = 0, previous = -1;
  for (const row of rows) {
    const value = valueOf(row, spec);
    check(row.occurredAt >= previous && row.availableAt < spec.trainBefore && permitted.has(row.subjectId),
      'Future, unordered or held-out training evidence');
    previous = row.occurredAt;
    const key = `${row.subjectId}\n${row.objectId}`;
    check(!seen.has(key), 'Duplicate training evidence'); seen.add(key);
    total += value;
    const sum = sums.get(row.objectId) ?? [0, 0]; sum[0] += value; sum[1]++; sums.set(row.objectId, sum);
    const history = bySubject.get(row.subjectId) ?? []; history.push(row); bySubject.set(row.subjectId, history);
  }
  check(sums.size <= 10000, 'Item budget exceeded');
  const c = spec.config, globalMean = total / rows.length, items: Record<string, Item> = Object.create(null);
  for (const id of [...sums.keys()].sort(lexical)) {
    const [sum, count] = sums.get(id)!;
    items[id] = { mean: (sum + c.itemShrinkage * globalMean) / (count + c.itemShrinkage), count, vector: [], neighbors: [] };
  }
  const afterMeans = performance.now();
  // Bounded exact positive cosine graph. Only training-selected objects and ratings enter it.
  const indexed = Object.keys(items).filter(id => items[id]!.count >= c.neighbors.minSupport)
    .sort((a, b) => items[b]!.count - items[a]!.count || lexical(a, b)).slice(0, c.neighbors.maxItems);
  const indices = new Map(indexed.map((id, i) => [id, i])), n = indexed.length;
  const dots = new Float64Array(n * n), overlaps = new Uint16Array(n * n), norms = new Float64Array(n);
  for (const history of bySubject.values()) {
    const entries = history.filter(r => indices.has(r.objectId)).map(r => [indices.get(r.objectId)!, observed(r) - items[r.objectId]!.mean]);
    for (let a = 0; a < entries.length; a++) {
      const [i, x] = entries[a]! as [number, number]; norms[i] = norms[i]! + x * x;
      for (let b = a + 1; b < entries.length; b++) {
        const [j, y] = entries[b]! as [number, number], pos = Math.min(i, j) * n + Math.max(i, j);
        dots[pos] = dots[pos]! + x * y; overlaps[pos] = overlaps[pos]! + 1;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const neighbors: [string, number][] = [];
    for (let j = 0; j < n; j++) {
      const pos = Math.min(i, j) * n + Math.max(i, j), overlap = overlaps[pos]!;
      if (i === j || overlap < c.neighbors.minOverlap || !norms[i] || !norms[j]) continue;
      const similarity = dots[pos]! / Math.sqrt(norms[i]! * norms[j]!) * overlap / (overlap + c.neighbors.shrinkage);
      if (similarity > 0) neighbors.push([indexed[j]!, similarity]);
    }
    items[indexed[i]!]!.neighbors = neighbors.sort((a, b) => b[1] - a[1] || lexical(a[0], b[0])).slice(0, c.neighbors.topK);
  }
  const afterNeighbors = performance.now();
  const random = seededRandom(c.seed), k = c.factorization.dimensions;
  const users = new Map<string, { bias: number; vector: number[] }>();
  for (const id of [...bySubject.keys()].sort(lexical)) users.set(id, { bias: 0, vector: Array.from({ length: k }, () => (random() - 0.5) * 0.1) });
  for (const item of Object.values(items)) item.vector = Array.from({ length: k }, () => (random() - 0.5) * 0.1);
  const order = rows.map((_, i) => i), { learningRate: lr, regularization: reg } = c.factorization;
  for (let epoch = 0; epoch < c.factorization.epochs; epoch++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
    for (const index of order) {
      const row = rows[index]!, item = items[row.objectId]!, user = users.get(row.subjectId)!;
      const prediction = item.mean + user.bias + item.vector.reduce((sum, v, d) => sum + v * user.vector[d]!, 0);
      const error = observed(row) - prediction;
      user.bias += lr * (error - reg * user.bias);
      for (let d = 0; d < k; d++) {
        const p = user.vector[d]!, q = item.vector[d]!;
        user.vector[d] = p + lr * (error * q - reg * p); item.vector[d] = q + lr * (error * p - reg * q);
      }
    }
  }
  const afterFactors = performance.now();
  // Encoder reads strictly earlier raw groups only, never train-final means or continuation labels.
  const bank: { objectId: string; memory: Memory; recordId: string }[] = [];
  for (const [subjectId, history] of bySubject) {
    let sum = 0, count = 0; const recent: number[] = [];
    for (const group of groupHistory(history)) {
      if (recent.length >= c.retrieval.minPrefixGroups) for (const row of group) {
        bank.push({ objectId: row.objectId, recordId: row.provenance.recordId, memory: { subjectId,
          availableAt: row.availableAt, mean: sum / count, recent: recent.slice(-c.recentGroups), value: observed(row),
          key: stableKey(row.provenance.recordId, c.seed) } });
      }
      const values = group.map(observed); sum += values.reduce((a, b) => a + b, 0); count += values.length;
      recent.push(mean(values));
    }
  }
  bank.sort((a, b) => a.memory.key - b.memory.key || lexical(a.recordId, b.recordId));
  const memories: Record<string, Memory[]> = Object.create(null); let kept = 0;
  for (const entry of bank) {
    if (kept >= c.retrieval.maxMemories) break;
    const bucket = memories[entry.objectId] ??= [];
    if (bucket.length < c.retrieval.perItem) { bucket.push(entry.memory); kept++; }
  }
  const artifact: RatingArtifact = { schema: 'numeric-research-v1', status: 'research',
    version: { id: spec.id, version: '1', representationVersion: 'rating-prefix-groups-v1',
      availableAt: spec.trainBefore, trainedThrough: rows.reduce((latest, r) => Math.max(latest, r.availableAt), 0),
      sourceRefs: [spec.manifestId], use: 'research-only' },
    sourceId: spec.sourceId, manifestId: spec.manifestId, target: structuredClone(spec.target), config: structuredClone(c),
    globalMean, trainCount: rows.length, subjectSupport: Object.fromEntries([...bySubject].map(([id, r]) => [id, r.length])),
    items, memories, fitCostMs: { means: afterMeans - start, neighbors: afterNeighbors - afterMeans,
      factorization: afterFactors - afterNeighbors, memories: performance.now() - afterFactors } };
  check(Object.values(items).every(item => item.vector.every(Number.isFinite)), 'Nonfinite fitted factors');
  return artifact;
}

/** Full model/schema/time validation at the artifact boundary, before reuse. Hash verification belongs to the file port. */
export function validateRatingArtifact(input: unknown): input is RatingArtifact {
  try {
    const a = input as RatingArtifact;
    check(a.schema === 'numeric-research-v1' && a.status === 'research' && a.version.use === 'research-only'
      && a.version.version === '1' && a.version.representationVersion === 'rating-prefix-groups-v1'
      && a.version.id && a.sourceId && a.manifestId && a.version.sourceRefs.length === 1
      && a.version.sourceRefs[0] === a.manifestId && Number.isSafeInteger(a.version.availableAt)
      && a.version.trainedThrough !== null && Number.isSafeInteger(a.version.trainedThrough)
      && a.version.trainedThrough >= 0 && a.version.trainedThrough < a.version.availableAt,
    'Invalid artifact lineage');
    validateConfig(a.config);
    const { min, max } = a.target.scale, rating = (x: number) => Number.isFinite(x) && x >= min && x <= max;
    check(Number.isFinite(min) && Number.isFinite(max) && max > min && rating(a.globalMean)
      && a.target.conditioning === 'object-observation' && a.target.exposure === 'not-required'
      && Number.isSafeInteger(a.trainCount) && a.trainCount > 0 && a.trainCount <= 100000, 'Invalid target or support');
    check(Object.keys(a.items).length <= 10000 && Object.keys(a.subjectSupport).length <= 500,
      'Invalid artifact dimensions');
    check(Object.values(a.subjectSupport).every(n => Number.isSafeInteger(n) && n > 0)
      && Object.values(a.subjectSupport).reduce((x, y) => x + y, 0) === a.trainCount,
    'Invalid subject support');
    for (const item of Object.values(a.items)) check(rating(item.mean) && Number.isSafeInteger(item.count)
      && item.count > 0 && item.vector.length === a.config.factorization.dimensions
      && item.vector.every(Number.isFinite) && item.neighbors.length <= a.config.neighbors.topK
      && item.neighbors.every(([id, sim]) => Object.hasOwn(a.items, id) && Number.isFinite(sim) && sim > 0 && sim <= 1),
    'Invalid fitted item');
    let memories = 0;
    for (const [id, bucket] of Object.entries(a.memories)) {
      check(Object.hasOwn(a.items, id) && bucket.length <= a.config.retrieval.perItem, 'Invalid memory bucket');
      for (const m of bucket) check(Object.hasOwn(a.subjectSupport, m.subjectId) && rating(m.mean) && rating(m.value)
        && m.recent.length === a.config.recentGroups && m.recent.every(rating)
        && Number.isSafeInteger(m.availableAt) && m.availableAt <= a.version.trainedThrough,
      'Invalid or future memory');
      memories += bucket.length;
    }
    check(memories <= a.config.retrieval.maxMemories, 'Memory budget exceeded');
    return true;
  } catch { return false; }
}

// Positive-definite ridge system, with an intercept. No test labels enter its sufficient statistics.
function foldIn(a: RatingArtifact, prefix: readonly Observation[]): number[] {
  const size = a.config.factorization.dimensions + 1;
  const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size + 1 }, (_, j) => i === j ? a.config.factorization.foldInRidge : 0));
  for (const row of prefix) {
    const item = a.items[row.objectId]; if (!item) continue;
    const x = [1, ...item.vector], y = observed(row) - item.mean;
    for (let i = 0; i < size; i++) {
      matrix[i]![size] = matrix[i]![size]! + x[i]! * y;
      for (let j = 0; j < size; j++) matrix[i]![j] = matrix[i]![j]! + x[i]! * x[j]!;
    }
  }
  for (let i = 0; i < size; i++) {
    const pivot = matrix[i]![i]!;
    check(Number.isFinite(pivot) && pivot > 0, 'Invalid fold-in system');
    for (let j = i; j <= size; j++) matrix[i]![j] = matrix[i]![j]! / pivot;
    for (let r = 0; r < size; r++) if (r !== i) {
      const factor = matrix[r]![i]!;
      for (let j = i; j <= size; j++) matrix[r]![j] = matrix[r]![j]! - factor * matrix[i]![j]!;
    }
  }
  return matrix.map(row => row[size]!);
}

/** Callers pass only a visible prefix and object identities, not current target labels. */
export function forecastRatingBatch(a: RatingArtifact, query: RatingQuery): Record<RatingVariant, RatingForecast>[] {
  check(a.status === 'research' && a.version.use === 'research-only' && a.version.availableAt <= query.asOf
    && a.version.trainedThrough !== null && a.version.trainedThrough < query.asOf,
  'Artifact unavailable or withdrawn');
  check(query.scope.evidence.synthetic === 'exclude' && query.scope.evidence.sourceIds.includes(a.sourceId)
    && query.prefix.length <= 10000 && query.objectIds.length <= 3000 && Number.isSafeInteger(query.asOf),
  'Query policy or budget violated');
  const seen = new Set<string>(); let previous = -1;
  for (const row of query.prefix) {
    valueOf(row, a);
    check(row.subjectId === query.scope.subject.id && row.availableAt < query.asOf && row.occurredAt >= previous
      && !seen.has(row.objectId), 'Foreign, future, equal-time, duplicate or unordered prefix');
    seen.add(row.objectId); previous = row.occurredAt;
  }
  const c = a.config, prefix = query.prefix, residuals = new Map(prefix.map(row => [row.objectId, observed(row) - (a.items[row.objectId]?.mean ?? a.globalMean)]));
  const durable = [...residuals.values()].reduce((x, y) => x + y, 0) / (prefix.length + c.subjectShrinkage);
  const groups = groupHistory(prefix), lastGroups = groups.slice(-c.recentGroups);
  const recentResidual = lastGroups.length ? mean(lastGroups.map(g => mean(g.map(row => residuals.get(row.objectId)!)))) : 0;
  const recentCorrection = lastGroups.length / (lastGroups.length + 1) * recentResidual;
  const rawMean = prefix.length ? mean(prefix.map(observed)) : null;
  const rawRecent = lastGroups.map(g => mean(g.map(observed))), factors = foldIn(a, prefix);
  const width = a.target.scale.max - a.target.scale.min;
  const clip = (x: number) => Math.max(a.target.scale.min, Math.min(a.target.scale.max, x));
  return query.objectIds.map(objectId => {
    const item = a.items[objectId], base = item?.mean ?? a.globalMean;
    const state = base + durable, recent = base + (1 - c.recentWeight) * durable + c.recentWeight * recentCorrection;
    const make = (value: number, support: number, eligibleMemories = 0): RatingForecast => {
      check(Number.isFinite(value), 'Nonfinite forecast');
      return { value: clip(value), kind: 'numeric-estimate', calibration: 'uncalibrated', componentSupport: support,
        itemSupport: item?.count ?? 0, prefixSupport: prefix.length, eligibleMemories, fallback: support === 0 };
    };
    const neighbors = (item?.neighbors ?? []).filter(([id]) => residuals.has(id));
    const weight = neighbors.reduce((sum, [, sim]) => sum + sim, 0);
    const neighbor = weight ? base + neighbors.reduce((sum, [id, sim]) => sum + sim * residuals.get(id)!, 0) / weight : state;
    const latent = item && prefix.length ? base + factors[0]! + item.vector.reduce((sum, v, i) => sum + v * factors[i + 1]!, 0) : state;
    const retrieve = (ordered: boolean): RatingForecast => {
      const fallback = ordered ? recent : state;
      if (rawMean === null || groups.length < c.retrieval.minPrefixGroups) return make(fallback, 0);
      const candidates = (a.memories[objectId] ?? []).filter(m => m.subjectId !== query.scope.subject.id && m.availableAt < query.asOf);
      const matches = candidates.map(memory => {
        const differences = [(rawMean - memory.mean) / width];
        if (ordered) for (let i = 0; i < c.recentGroups; i++) differences.push((rawRecent[i]! - memory.recent[i]!) / width);
        return { memory, distance: Math.sqrt(mean(differences.map(x => x * x))) };
      }).filter(m => m.distance <= c.retrieval.maxDistance).sort((x, y) => x.distance - y.distance || x.memory.key - y.memory.key)
        .slice(0, c.retrieval.topK);
      return make(matches.length ? (1 - c.retrieval.weight) * fallback + c.retrieval.weight * mean(matches.map(m => m.memory.value)) : fallback,
        matches.length, candidates.length);
    };
    return { 'global-mean': make(a.globalMean, a.trainCount), 'item-mean': make(base, item?.count ?? 0),
      'state-static': make(state, prefix.length), 'state-recent': make(recent, prefix.length),
      'item-neighbor': make(neighbor, neighbors.length), 'factorization': make(latent, item && prefix.length ? prefix.filter(r => Object.hasOwn(a.items, r.objectId)).length : 0),
      'retrieval-static': retrieve(false), trajectory: retrieve(true) };
  });
}

/** Actual research fallback boundary. No dependent external parameter survives withdrawal. */
export function useOptionalRatingArtifact(input: unknown, query: RatingQuery, target: TargetDefinition):
  { mode: 'research'; forecasts: Record<RatingVariant, RatingForecast>[] } |
  { mode: 'native-only-fallback'; reason: 'absent' | 'withdrawn' | 'invalid-or-disallowed'; value: number | null; nativeSupport: number } {
  if (!Number.isSafeInteger(query.asOf) || query.asOf < 0) {
    return { mode: 'native-only-fallback', reason: 'invalid-or-disallowed', value: null, nativeSupport: 0 };
  }
  const reason = input == null ? 'absent' : (input as { status?: unknown }).status === 'withdrawn' ? 'withdrawn' : 'invalid-or-disallowed';
  if (validateRatingArtifact(input) && input.target.id === target.id && input.target.version === target.version
    && input.target.scale.min === target.scale.min && input.target.scale.max === target.scale.max
    && query.scope.evidence.sourceIds.includes(input.sourceId) && input.version.availableAt <= query.asOf
    && query.objectIds.every(id => id.startsWith(`${input.sourceId}:`))) {
    return { mode: 'research', forecasts: forecastRatingBatch(input, query) };
  }
  const values: number[] = [], seen = new Set<string>();
  for (const row of query.prefix) {
    if (row.subjectId !== query.scope.subject.id || row.access.kind !== 'subject' || row.access.subjectId !== row.subjectId
      || row.provenance.origin !== 'observed' || row.provenance.source.kind !== 'native'
      || !Number.isSafeInteger(row.occurredAt) || row.occurredAt < 0 || !Number.isSafeInteger(row.availableAt)
      || !query.scope.evidence.sourceIds.includes(row.provenance.source.id) || row.availableAt >= query.asOf
      || row.occurredAt >= query.asOf || row.availableAt < row.occurredAt || row.measurement.status !== 'observed'
      || row.targetId !== target.id || row.targetVersion !== target.version || row.provenance.revision !== 1) continue;
    const key = `${row.provenance.source.id}:${row.provenance.recordId}`;
    if (!seen.has(key) && Number.isFinite(row.measurement.value) && row.measurement.value >= target.scale.min && row.measurement.value <= target.scale.max) {
      seen.add(key); values.push(row.measurement.value);
    }
  }
  return { mode: 'native-only-fallback', reason, value: values.length ? mean(values) : null, nativeSupport: values.length };
}
