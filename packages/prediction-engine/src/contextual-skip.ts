/** Executable policy reference. This module does not read storage or authorize callers. */
export const contextualSkipPolicy = Object.freeze({
  version: 'contextual-skip-cooldown-v1' as const,
  cooldownMicros: '86400000000',
  contextChangePolicy: 'NO_TRUSTED_CONTEXT_CHANGE_V1' as const,
});

/** Decimal Unix microseconds, preserving the database receipt clock exactly. */
export type SkipInstant = string;
export interface ContextualSkipRecord {
  readonly id: string;
  readonly subjectId: string;
  readonly objectId: string;
  readonly acceptedAt: SkipInstant;
  readonly withdrawnAt: SkipInstant | null;
}
export interface ContextualSkipInput {
  readonly subjectId: string;
  readonly objectId: string;
  /** Trusted decision clock and complete, already authorized committed source prefix. */
  readonly asOf: SkipInstant;
  readonly records: readonly ContextualSkipRecord[];
  /** Existing authorization, availability, consumption, save/reminder and block policies. */
  readonly otherwiseEligible: boolean;
}
export interface ContextualSkipDecision {
  readonly version: typeof contextualSkipPolicy.version;
  readonly contextChangePolicy: typeof contextualSkipPolicy.contextChangePolicy;
  readonly eligible: boolean;
  readonly reason: 'OTHER_POLICY_SUPPRESSED' | 'NO_ACTIVE_SKIP' | 'SKIP_COOLDOWN' | 'SKIP_COOLDOWN_ELAPSED';
  readonly sourceIds: readonly string[];
  readonly reconsiderAt: SkipInstant | null;
}

export function skipInstant(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,17})$/.test(value)
    || BigInt(value) > 253402300799999999n) throw new Error('Invalid skip microsecond clock');
  return BigInt(value);
}
function ref(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$/.test(value);
}

/**
 * Scope is subject/Object, not actor, surface, app session or navigation mode.
 * V1 has no admitted semantic Context/Scenario-change provider. None of those
 * client changes shortens the 24-hour cooldown. A later policy must opt in.
 * A trusted reader must remove erased sources and supply all surviving records;
 * this function cannot turn a truncated prefix into a valid eligibility claim.
 */
export function decideContextualSkip(input: ContextualSkipInput): ContextualSkipDecision {
  if (!input || !ref(input.subjectId) || !ref(input.objectId) || typeof input.otherwiseEligible !== 'boolean'
    || !Array.isArray(input.records) || input.records.length > 256) throw new Error('Invalid skip decision input');
  const asOf = skipInstant(input.asOf);
  const ids = new Set<string>();
  let reconsiderAt: bigint | null = null;
  let sourceIds: string[] = [];
  for (const record of input.records) {
    if (!record || !ref(record.id) || ids.has(record.id) || !ref(record.subjectId) || !ref(record.objectId)) {
      throw new Error('Invalid or duplicate skip source');
    }
    ids.add(record.id);
    const accepted = skipInstant(record.acceptedAt);
    const withdrawn = record.withdrawnAt === null ? null : skipInstant(record.withdrawnAt);
    if (withdrawn !== null && withdrawn < accepted) throw new Error('Skip withdrawal precedes acceptance');
    if (record.subjectId !== input.subjectId || record.objectId !== input.objectId || accepted > asOf
      || (withdrawn !== null && withdrawn <= asOf)) continue;
    const until = accepted + BigInt(contextualSkipPolicy.cooldownMicros);
    if (reconsiderAt === null || until > reconsiderAt) { reconsiderAt = until; sourceIds = [record.id]; }
    else if (until === reconsiderAt) sourceIds.push(record.id);
  }
  return Object.freeze({ version: contextualSkipPolicy.version, contextChangePolicy: contextualSkipPolicy.contextChangePolicy,
    eligible: input.otherwiseEligible && (reconsiderAt === null || asOf >= reconsiderAt),
    reason: !input.otherwiseEligible ? 'OTHER_POLICY_SUPPRESSED' : reconsiderAt === null ? 'NO_ACTIVE_SKIP'
      : asOf < reconsiderAt ? 'SKIP_COOLDOWN' : 'SKIP_COOLDOWN_ELAPSED',
    sourceIds: Object.freeze(sourceIds.sort()), reconsiderAt: reconsiderAt?.toString() ?? null });
}
