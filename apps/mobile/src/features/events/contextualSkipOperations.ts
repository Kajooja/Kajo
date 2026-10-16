import type { SupabaseClient } from '@supabase/supabase-js';
import type { KajoSkipCommand, KajoSkipOrigin, KajoSkipReceipt } from '../../../../../packages/prediction-engine/src/adapters/kajo-contextual-skip';
import type { ItemActionScope } from './itemActionCommands';
import type { ItemActionResult } from './itemActionPersistence';

// Wire validation only. Authorization, source resolution and suppression stay
// on the server; the mobile bundle does not import the reference policy/oracle.
export type { KajoSkipCommand, KajoSkipOrigin, KajoSkipReceipt };
export const CONTEXTUAL_SKIP_VERSION = 'kajo-contextual-skip-v1';
export const CONTEXTUAL_SKIP_POLICY = 'contextual-skip-cooldown-v1';
type TasteOrigin = Extract<KajoSkipOrigin, { surface: 'TASTE' }>;
type DiscoveryOrigin = Extract<KajoSkipOrigin, { surface: 'DISCOVERY' }>;
export interface TasteSkipCapability {
  version: typeof CONTEXTUAL_SKIP_VERSION;
  policyVersion: typeof CONTEXTUAL_SKIP_POLICY;
  contextRef: null;
  origin: TasteOrigin;
}
export interface DiscoverySkipSourceRequest extends ItemActionScope {
  itemId: string;
  origin: DiscoveryOrigin;
}
export interface DiscoverySkipSource extends DiscoverySkipSourceRequest {
  version: typeof CONTEXTUAL_SKIP_VERSION;
  policyVersion: typeof CONTEXTUAL_SKIP_POLICY;
  contextChangePolicy: 'NO_TRUSTED_CONTEXT_CHANGE_V1';
  contextRef: null;
  acceptsNewSkip: boolean;
}
export type ContextualSkipRpc = (
  name: 'commit_taste_contextual_skip_v1' | 'commit_discovery_contextual_skip_v1' | 'discovery_contextual_skip_source_v1',
  args: { command: KajoSkipCommand } | { request: DiscoverySkipSourceRequest },
  signal?: AbortSignal,
) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, names: readonly string[]): boolean {
  return Object.keys(value).sort().join() === [...names].sort().join();
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
export function isSkipInstant(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/.test(value) && BigInt(value) <= 253402300799999999n;
}
function origin(value: unknown): value is KajoSkipOrigin {
  if (!record(value) || !uuid(value.sessionId)) return false;
  if (value.surface === 'TASTE') return keys(value, ['surface', 'sessionId', 'questionId', 'panelId', 'prefixRevision']) &&
    uuid(value.questionId) && uuid(value.panelId) && Number.isInteger(value.prefixRevision) &&
    Number(value.prefixRevision) >= 0 && Number(value.prefixRevision) <= 256;
  return value.surface === 'DISCOVERY' && keys(value, ['surface', 'sessionId', 'predictionId', 'deliveryRequestId', 'impressionEventId']) &&
    uuid(value.predictionId) && uuid(value.deliveryRequestId) && uuid(value.impressionEventId);
}
function sameOrigin(left: KajoSkipOrigin, right: KajoSkipOrigin): boolean {
  return Object.entries(left).every(([key, value]) => (right as unknown as Record<string, unknown>)[key] === value);
}
export function isNativeContextualSkipCommand(value: unknown): value is KajoSkipCommand {
  if (!record(value) || !keys(value, ['version', 'kind', 'actionId', 'actorUserId', 'profileId', 'itemId',
    'occurredAt', 'origin', 'contextRef', 'reversesActionId'])) return false;
  return value.version === CONTEXTUAL_SKIP_VERSION && [value.actionId, value.actorUserId, value.profileId, value.itemId].every(uuid) &&
    isSkipInstant(value.occurredAt) && origin(value.origin) && value.contextRef === null &&
    (value.kind === 'CONTEXTUAL_SKIP' ? value.reversesActionId === null :
      value.kind === 'WITHDRAW_CONTEXTUAL_SKIP' && uuid(value.reversesActionId) && value.reversesActionId !== value.actionId);
}
export function decodeTasteSkipCapability(value: unknown, sessionId: string, questionId: string): TasteSkipCapability | null {
  if (!record(value) || !keys(value, ['version', 'policyVersion', 'contextRef', 'origin']) ||
    value.version !== CONTEXTUAL_SKIP_VERSION || value.policyVersion !== CONTEXTUAL_SKIP_POLICY || value.contextRef !== null ||
    !origin(value.origin) || value.origin.surface !== 'TASTE' || value.origin.sessionId !== sessionId || value.origin.questionId !== questionId) return null;
  return { version: CONTEXTUAL_SKIP_VERSION, policyVersion: CONTEXTUAL_SKIP_POLICY, contextRef: null, origin: { ...value.origin } };
}
function isSourceRequest(value: unknown): value is DiscoverySkipSourceRequest {
  return record(value) && keys(value, ['actorUserId', 'profileId', 'itemId', 'origin']) &&
    [value.actorUserId, value.profileId, value.itemId].every(uuid) && origin(value.origin) && value.origin.surface === 'DISCOVERY';
}
export function decodeDiscoverySkipSource(value: unknown, request: DiscoverySkipSourceRequest): DiscoverySkipSource | null {
  if (!isSourceRequest(request) || !record(value) || !keys(value, ['version', 'policyVersion', 'contextChangePolicy',
    'actorUserId', 'profileId', 'itemId', 'origin', 'contextRef', 'acceptsNewSkip']) || value.version !== CONTEXTUAL_SKIP_VERSION ||
    value.policyVersion !== CONTEXTUAL_SKIP_POLICY || value.contextChangePolicy !== 'NO_TRUSTED_CONTEXT_CHANGE_V1' ||
    value.actorUserId !== request.actorUserId || value.profileId !== request.profileId || value.itemId !== request.itemId ||
    !origin(value.origin) || !sameOrigin(value.origin, request.origin) || value.contextRef !== null || typeof value.acceptsNewSkip !== 'boolean') return null;
  return { ...request, origin: { ...request.origin }, version: CONTEXTUAL_SKIP_VERSION, policyVersion: CONTEXTUAL_SKIP_POLICY,
    contextChangePolicy: 'NO_TRUSTED_CONTEXT_CHANGE_V1', contextRef: null, acceptsNewSkip: value.acceptsNewSkip };
}
export function decodeContextualSkipReceipt(value: unknown, command: KajoSkipCommand): KajoSkipReceipt | null {
  if (!isNativeContextualSkipCommand(command) || !record(value) || !keys(value, ['version', 'actionId', 'actorUserId', 'profileId',
    'itemId', 'acceptedAt', 'policyVersion', 'evidence', 'semantic', 'reversesActionId']) || value.version !== CONTEXTUAL_SKIP_VERSION ||
    value.policyVersion !== CONTEXTUAL_SKIP_POLICY || value.actionId !== command.actionId || value.actorUserId !== command.actorUserId ||
    value.profileId !== command.profileId || value.itemId !== command.itemId || value.semantic !== command.kind ||
    value.reversesActionId !== command.reversesActionId || value.evidence !== (command.origin.surface === 'TASTE' ? 'PRIVATE_TASTE_RESPONSE' : 'CANONICAL_DISCOVERY_EVENT') ||
    !isSkipInstant(value.acceptedAt) || BigInt(command.occurredAt) > BigInt(value.acceptedAt) + 300000000n) return null;
  return { version: CONTEXTUAL_SKIP_VERSION, policyVersion: CONTEXTUAL_SKIP_POLICY, actionId: command.actionId,
    actorUserId: command.actorUserId, profileId: command.profileId, itemId: command.itemId,
    acceptedAt: value.acceptedAt, evidence: command.origin.surface === 'TASTE' ? 'PRIVATE_TASTE_RESPONSE' : 'CANONICAL_DISCOVERY_EVENT',
    semantic: command.kind, reversesActionId: command.reversesActionId };
}
export function createContextualSkipRpc(client: SupabaseClient): ContextualSkipRpc {
  return async (name, args, signal) => {
    const query = client.rpc(name, args);
    const { data, error } = await (signal ? query.abortSignal(signal) : query);
    return { data, error: error ? { code: error.code, message: error.message } : null };
  };
}
export async function sendContextualSkip(rpc: ContextualSkipRpc, command: KajoSkipCommand, signal?: AbortSignal): Promise<ItemActionResult<KajoSkipReceipt>> {
  if (!isNativeContextualSkipCommand(command)) return { status: 'error', retryable: false,
    message: 'Ohituksen tallennustieto oli virheellinen. Mitään ei lähetetty.' };
  try {
    const { data, error } = await rpc(command.origin.surface === 'TASTE' ? 'commit_taste_contextual_skip_v1' : 'commit_discovery_contextual_skip_v1', { command }, signal);
    if (error) {
      const rejected = /^(22|23|42|KJ)/.test(error.code ?? '');
      return { status: 'error', retryable: !rejected && error.code !== 'PGRST202', ...(rejected ? { rejectedAction: true } : {}),
        message: rejected ? 'Ohitusta ei vahvistettu. Lataa nykyinen tilanne ennen uutta valintaa.'
          : 'Ohituksen vahvistusta ei saatu. Sama komento säilyy odottamassa.' };
    }
    const receipt = decodeContextualSkipReceipt(data, command);
    return receipt ? { status: 'success', receipt } : { status: 'error', retryable: false,
      message: 'Ohituksen vahvistus oli puutteellinen. Sama komento säilyy odottamassa.' };
  } catch {
    return { status: 'error', retryable: true, message: 'Yhteys katkesi. Sama ohitus säilyy odottamassa.' };
  }
}
export async function loadDiscoverySkipSource(rpc: ContextualSkipRpc, request: DiscoverySkipSourceRequest, signal?: AbortSignal): Promise<DiscoverySkipSource | null> {
  if (!isSourceRequest(request)) return null;
  try {
    const { data, error } = await rpc('discovery_contextual_skip_source_v1', { request }, signal);
    return error ? null : decodeDiscoverySkipSource(data, request);
  } catch { return null; }
}
