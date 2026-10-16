import { contextualSkipPolicy, skipInstant } from '../contextual-skip.js';
import type { ContextualSkipRecord, SkipInstant } from '../contextual-skip.js';

/** Reference contract only; no RPC, public Event admission or native writer is installed. */
export const kajoContextualSkipVersion = 'kajo-contextual-skip-v1' as const;
export type KajoSkipOrigin = {
  readonly surface: 'TASTE'; readonly sessionId: string; readonly questionId: string;
  readonly panelId: string; readonly prefixRevision: number;
} | {
  readonly surface: 'DISCOVERY'; readonly sessionId: string; readonly predictionId: string;
  readonly deliveryRequestId: string; readonly impressionEventId: string;
};
export interface KajoSkipCommand {
  readonly version: typeof kajoContextualSkipVersion;
  readonly kind: 'CONTEXTUAL_SKIP' | 'WITHDRAW_CONTEXTUAL_SKIP';
  readonly actionId: string;
  readonly actorUserId: string;
  readonly profileId: string;
  readonly itemId: string;
  /** Client-reported occurrence; never the trusted ordering or cooldown clock. */
  readonly occurredAt: SkipInstant;
  readonly origin: KajoSkipOrigin;
  /** An immutable server-bound Context snapshot reference, or genuinely unavailable. */
  readonly contextRef: string | null;
  readonly reversesActionId: string | null;
}
export interface KajoSkipReceipt {
  readonly version: typeof kajoContextualSkipVersion;
  readonly actionId: string;
  readonly actorUserId: string;
  readonly profileId: string;
  readonly itemId: string;
  readonly acceptedAt: SkipInstant;
  readonly policyVersion: typeof contextualSkipPolicy.version;
  readonly evidence: 'PRIVATE_TASTE_RESPONSE' | 'CANONICAL_DISCOVERY_EVENT';
  readonly semantic: 'CONTEXTUAL_SKIP' | 'WITHDRAW_CONTEXTUAL_SKIP';
  readonly reversesActionId: string | null;
}
export interface KajoSkipEntry {
  readonly command: KajoSkipCommand;
  readonly receipt: KajoSkipReceipt;
}
export interface KajoSkipAuthority {
  /** These are trusted server facts, never client claims or a replacement for RLS. */
  readonly role: 'authenticated' | 'anon' | 'service_role';
  readonly isAnonymous: boolean;
  readonly actorUserId: string | null;
  readonly profile: { readonly id: string; readonly type: 'PERSONAL' | 'SHARED';
    readonly ownerUserId: string | null; readonly acceptedMemberIds: readonly string[] };
  readonly source: { readonly actorUserId: string; readonly profileId: string; readonly itemId: string;
    readonly origin: KajoSkipOrigin; readonly contextRef: string | null;
    readonly committedAt: SkipInstant; readonly available: boolean };
  readonly acceptedAt: SkipInstant;
}

export class ContextualSkipError extends Error {
  constructor(readonly code: 'INVALID_COMMAND' | 'ACCESS_DENIED' | 'SOURCE_WITHDRAWN' | 'IDENTITY_CONFLICT'
    | 'ORIGIN_CONFLICT' | 'WITHDRAWAL_CONFLICT' | 'INCOMPLETE_PREFIX') { super(code); }
}
function requireValue(value: unknown, code: ContextualSkipError['code']): asserts value {
  if (!value) throw new ContextualSkipError(code);
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
function keys(value: Record<string, unknown>, names: string[]): boolean {
  return Object.keys(value).sort().join(',') === names.sort().join(',');
}
function context(value: unknown): value is string | null { return value === null || uuid(value); }
function validOrigin(value: unknown): value is KajoSkipOrigin {
  if (!record(value) || !uuid(value.sessionId)) return false;
  if (value.surface === 'TASTE') return keys(value, ['surface', 'sessionId', 'questionId', 'panelId', 'prefixRevision'])
    && uuid(value.questionId) && uuid(value.panelId) && Number.isSafeInteger(value.prefixRevision)
    && Number(value.prefixRevision) >= 0 && Number(value.prefixRevision) <= 256;
  return value.surface === 'DISCOVERY' && keys(value, ['surface', 'sessionId', 'predictionId', 'deliveryRequestId', 'impressionEventId'])
    && uuid(value.predictionId) && uuid(value.deliveryRequestId) && uuid(value.impressionEventId);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function isKajoSkipCommand(value: unknown): value is KajoSkipCommand {
  if (!record(value) || !keys(value, ['version', 'kind', 'actionId', 'actorUserId', 'profileId', 'itemId', 'occurredAt',
    'origin', 'contextRef', 'reversesActionId']) || value.version !== kajoContextualSkipVersion
    || !['CONTEXTUAL_SKIP', 'WITHDRAW_CONTEXTUAL_SKIP'].includes(String(value.kind))
    || ![value.actionId, value.actorUserId, value.profileId, value.itemId].every(uuid)
    || !validOrigin(value.origin) || !context(value.contextRef)
    || (value.kind === 'CONTEXTUAL_SKIP' ? value.reversesActionId !== null : !uuid(value.reversesActionId))) return false;
  try { skipInstant(value.occurredAt); return true; } catch { return false; }
}

function validatePrefix(entries: readonly KajoSkipEntry[]): void {
  requireValue(Array.isArray(entries) && entries.length <= 256, 'INCOMPLETE_PREFIX');
  const seen = new Map<string, KajoSkipEntry>(), reversed = new Set<string>();
  let previous = -1n;
  for (const entry of entries) {
    requireValue(entry && isKajoSkipCommand(entry.command) && record(entry.receipt), 'INCOMPLETE_PREFIX');
    const c = entry.command, r = entry.receipt;
    requireValue(keys(r as unknown as Record<string, unknown>, ['version', 'actionId', 'actorUserId', 'profileId', 'itemId',
      'acceptedAt', 'policyVersion', 'evidence', 'semantic', 'reversesActionId'])
      && r.version === kajoContextualSkipVersion && r.policyVersion === contextualSkipPolicy.version
      && r.actionId === c.actionId && r.actorUserId === c.actorUserId && r.profileId === c.profileId && r.itemId === c.itemId
      && r.semantic === c.kind && r.reversesActionId === c.reversesActionId
      && r.evidence === (c.origin.surface === 'TASTE' ? 'PRIVATE_TASTE_RESPONSE' : 'CANONICAL_DISCOVERY_EVENT')
      && !seen.has(c.actionId), 'INCOMPLETE_PREFIX');
    const at = skipInstant(r.acceptedAt);
    requireValue(skipInstant(c.occurredAt) <= at + 300000000n && at >= previous, 'INCOMPLETE_PREFIX');
    if (c.reversesActionId !== null) {
      const target = seen.get(c.reversesActionId)?.command;
      requireValue(target && target.kind === 'CONTEXTUAL_SKIP' && sameTarget(c, target)
        && !reversed.has(c.reversesActionId), 'INCOMPLETE_PREFIX');
      reversed.add(c.reversesActionId);
    } else {
      requireValue(![...seen.values()].some(e => e.command.kind === 'CONTEXTUAL_SKIP' && sameOpportunity(c, e.command)), 'INCOMPLETE_PREFIX');
    }
    seen.set(c.actionId, entry); previous = at;
  }
}
function sameTarget(a: KajoSkipCommand, b: KajoSkipCommand): boolean {
  return sameOpportunity(a, b) && a.contextRef === b.contextRef;
}
function sameOpportunity(a: KajoSkipCommand, b: KajoSkipCommand): boolean {
  return a.actorUserId === b.actorUserId && a.profileId === b.profileId && a.itemId === b.itemId
    && canonical(a.origin) === canonical(b.origin);
}

/**
 * Pure serialized command oracle. The native transaction must lock, reauthorize,
 * load an untruncated committed prefix, and atomically persist its result. Running
 * this function in a client is not persistence, authorization or proof of exposure.
 */
export function applyKajoContextualSkip(entries: readonly KajoSkipEntry[], command: KajoSkipCommand,
  authority: KajoSkipAuthority): { readonly entries: readonly KajoSkipEntry[]; readonly receipt: KajoSkipReceipt } {
  requireValue(isKajoSkipCommand(command), 'INVALID_COMMAND');
  const p = authority.profile, s = authority.source;
  requireValue(authority.role === 'authenticated' && authority.isAnonymous === false && authority.actorUserId === command.actorUserId
    && p.id === command.profileId && p.acceptedMemberIds.includes(command.actorUserId)
    && ((p.type === 'PERSONAL' && p.ownerUserId === command.actorUserId)
      || (p.type === 'SHARED' && command.origin.surface === 'DISCOVERY')), 'ACCESS_DENIED');
  validatePrefix(entries);
  requireValue(entries.every(e => e.command.profileId === command.profileId
    && (p.type === 'SHARED' || e.command.actorUserId === command.actorUserId)), 'ACCESS_DENIED');
  const previous = entries.find(e => e.command.actionId === command.actionId);
  if (previous) requireValue(canonical(previous.command) === canonical(command), 'IDENTITY_CONFLICT');
  requireValue(s.actorUserId === command.actorUserId && s.profileId === command.profileId && s.itemId === command.itemId
    && canonical(s.origin) === canonical(command.origin) && s.contextRef === command.contextRef, 'ORIGIN_CONFLICT');
  requireValue(s.available === true, 'SOURCE_WITHDRAWN');
  if (previous) return freeze({ entries: freeze(structuredClone(entries)), receipt: freeze(structuredClone(previous.receipt)) });
  const accepted = skipInstant(authority.acceptedAt), occurred = skipInstant(command.occurredAt);
  requireValue(skipInstant(s.committedAt) < accepted && occurred <= accepted + 300000000n
    && (!entries.length || skipInstant(entries[entries.length - 1]!.receipt.acceptedAt) <= accepted), 'INVALID_COMMAND');
  requireValue(entries.length < 256, 'INCOMPLETE_PREFIX');
  if (command.kind === 'WITHDRAW_CONTEXTUAL_SKIP') {
    const target = entries.find(e => e.command.actionId === command.reversesActionId)?.command;
    requireValue(target && target.kind === 'CONTEXTUAL_SKIP' && sameTarget(command, target)
      && !entries.some(e => e.command.reversesActionId === target.actionId), 'WITHDRAWAL_CONFLICT');
  } else {
    // A fresh request ID cannot count the same shown opportunity twice, even after withdrawal.
    requireValue(!entries.some(e => e.command.kind === 'CONTEXTUAL_SKIP' && sameOpportunity(command, e.command)), 'ORIGIN_CONFLICT');
  }
  const receipt: KajoSkipReceipt = { version: kajoContextualSkipVersion, actionId: command.actionId,
    actorUserId: command.actorUserId, profileId: command.profileId, itemId: command.itemId,
    acceptedAt: authority.acceptedAt, policyVersion: contextualSkipPolicy.version,
    evidence: command.origin.surface === 'TASTE' ? 'PRIVATE_TASTE_RESPONSE' : 'CANONICAL_DISCOVERY_EVENT',
    semantic: command.kind, reversesActionId: command.reversesActionId };
  const result = [...entries, { command, receipt }];
  return freeze(structuredClone({ entries: result, receipt }));
}

/** Normalize confirmed sources only; it never reads pending mobile commands or legacy answers. */
export function kajoContextualSkipRecords(entries: readonly KajoSkipEntry[]): readonly ContextualSkipRecord[] {
  validatePrefix(entries);
  return freeze(entries.filter(e => e.command.kind === 'CONTEXTUAL_SKIP').map(e => ({
    id: e.command.actionId, subjectId: e.command.profileId, objectId: e.command.itemId, acceptedAt: e.receipt.acceptedAt,
    withdrawnAt: entries.find(r => r.command.reversesActionId === e.command.actionId)?.receipt.acceptedAt ?? null,
  })));
}
