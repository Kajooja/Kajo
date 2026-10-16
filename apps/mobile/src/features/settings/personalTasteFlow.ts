import { notifyBootstrapEvidenceChanged, notifyContextualSkipChanged } from '../discovery/predictionRefresh';
import { createUuidV7 } from '../events/eventTracking';
import type { ItemActionStorage } from '../events/itemActionOutbox';
import { CONTEXTUAL_SKIP_VERSION, isNativeContextualSkipCommand, sendContextualSkip,
  type ContextualSkipRpc, type KajoSkipCommand } from '../events/contextualSkipOperations';
import { isTasteCommand, sendTasteCommand, uuid, type TasteAnswer, type TasteChallenge,
  type TasteCommand, type TasteRpc, type TasteSession, type SequentialTasteSession } from './personalTasteOperations';

type StoredSkipCommand = { functionName: 'commit_taste_contextual_skip_v1'; command: KajoSkipCommand };
type PendingTasteCommand = TasteCommand | StoredSkipCommand;
type StoredFlow = { version: 2; protocol: 'v1' | 'v2'; sessionId: string | null; challengeId: string | null; pending: PendingTasteCommand | null; dismissed: boolean };
function isStoredSkip(value: unknown): value is StoredSkipCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).sort().join() === 'command,functionName' && v.functionName === 'commit_taste_contextual_skip_v1' &&
    isNativeContextualSkipCommand(v.command) && v.command.origin.surface === 'TASTE';
}
export type PersonalTasteSnapshot = {
  sequential: SequentialTasteSession | null; session: TasteSession | null; challenge: TasteChallenge | null; busy: boolean; pending: boolean;
  legacy: boolean; dismissed: boolean; message: string | null; conflict: boolean; blocked: boolean;
  needsStart: boolean;
};
const owners = new Map<string, object>();
const fresh = (): StoredFlow => ({ version: 2, protocol: 'v2', sessionId: null, challengeId: null, pending: null, dismissed: false });

// One persisted, immutable command at a time. Full answer/forecast state belongs
// to the server; SQLite retains only IDs, dismissal and the unacknowledged command.
export function createPersonalTasteFlow(options: {
  namespace: string; actorUserId: string; profileId: string; storage: ItemActionStorage;
  rpc: TasteRpc; onChange: (snapshot: PersonalTasteSnapshot) => void;
  contextualSkipRpc?: ContextualSkipRpc;
  createId?: () => string; timeoutMs?: number; autoStart?: boolean;
  nowMicros?: () => string;
}) {
  const key = `kajo:personal-taste:v1:${encodeURIComponent(options.namespace)}:${options.actorUserId}:${options.profileId}`;
  const owner = {};
  let active = false; let generation = 0; let flight: Promise<void> | null = null; let abort: AbortController | null = null;
  let stored = fresh(); let loaded = false;
  let state: PersonalTasteSnapshot = { sequential: null, session: null, challenge: null, busy: false, pending: false,
    legacy: false, dismissed: false, message: null, conflict: false, blocked: false, needsStart: false };
  const current = () => active && owners.get(key) === owner;
  const snapshot = () => ({ ...state, pending: stored.pending !== null });
  const publish = () => { if (current()) options.onChange(snapshot()); };
  const id = options.createId ?? createUuidV7;

  function save(next: StoredFlow): boolean {
    if (!current()) return false;
    try {
      options.storage.setItemSync(key, JSON.stringify(next)); stored = next; return true;
    } catch {
      state = { ...state, busy: false, blocked: true, message: 'Paikallinen tallennus epäonnistui. Vastausta ei kuitattu; yritä uudelleen.' };
      publish(); return false;
    }
  }
  function load(): boolean {
    try {
      const raw = options.storage.getItemSync(key);
      const v: unknown = raw === null ? fresh() : raw.length <= 8192 ? JSON.parse(raw) : null;
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid storage');
      const r = v as Record<string, unknown>;
      const legacy = r.version === 1;
      if (Object.keys(r).sort().join() !== (legacy ? 'challengeId,dismissed,pending,sessionId,version'
        : 'challengeId,dismissed,pending,protocol,sessionId,version') ||
        (!legacy && (r.version !== 2 || !['v1', 'v2'].includes(String(r.protocol)))) ||
        (r.sessionId !== null && !uuid(r.sessionId)) || (r.challengeId !== null && !uuid(r.challengeId)) ||
        (r.challengeId !== null && r.sessionId === null) || typeof r.dismissed !== 'boolean' ||
        (r.pending !== null && !isTasteCommand(r.pending, options.profileId) && !isStoredSkip(r.pending))) throw new Error('Invalid storage');
      const next = { ...r, version: 2, protocol: legacy ? 'v1' : r.protocol } as StoredFlow;
      if (next.protocol === 'v2' && next.challengeId !== null) throw new Error('Wrong protocol');
      if (isStoredSkip(next.pending)) {
        if (next.protocol !== 'v2' || next.pending.command.actorUserId !== options.actorUserId || next.pending.command.profileId !== options.profileId ||
          next.pending.command.origin.sessionId !== next.sessionId) throw new Error('Wrong skip scope');
      } else {
        if (next.pending && (next.pending.functionName === 'taste_session_v2') !== (next.protocol === 'v2')) throw new Error('Wrong protocol');
        if (next.pending?.request.sessionId && next.pending.request.sessionId !== next.sessionId) throw new Error('Wrong session');
        if (next.pending?.request.challengeId && next.pending.request.challengeId !== next.challengeId) throw new Error('Wrong challenge');
      }
      stored = next; loaded = true; return true;
    } catch {
      state = { ...state, busy: false, blocked: true, message: 'Makutestin paikallista jatkotietoa ei voitu avata. Mitään vastausta ei lähetetty.' };
      publish(); return false;
    }
  }
  function launch(work: () => Promise<void>) {
    if (!current() || flight) return;
    state = { ...state, busy: true, message: null, conflict: false, blocked: false }; publish();
    const startedGeneration = generation;
    const job = Promise.resolve().then(() => { if (current() && generation === startedGeneration) return work(); }).catch(() => {
      if (current() && generation === startedGeneration) state = { ...state, message: 'Makutesti ei voinut jatkua. Yritä uudelleen.' };
    }).finally(() => {
      if (flight === job) flight = null;
      if (current() && generation === startedGeneration) { state = { ...state, busy: false }; publish(); }
    });
    flight = job;
  }
  function accept(response: Awaited<ReturnType<typeof sendTasteCommand>> & { status: 'success' }) {
    if (response.response.kind === 'preserved') return;
    if (response.response.kind === 'sequential') { state = { ...state, sequential: response.response.value, session: null, challenge: null }; return; }
    if (response.response.kind === 'session') state = { ...state, session: response.response.value,
      challenge: response.response.value.status === 'REMOVED' ? null : state.challenge };
    else state = { ...state, challenge: response.response.value };
  }
  async function invoke(command: TasteCommand) {
    if (!current()) return null;
    const startedGeneration = generation;
    const controller = new AbortController(); abort = controller;
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try { const result = await sendTasteCommand(options.rpc, command, controller.signal);
      return current() && generation === startedGeneration ? result : null; }
    finally { clearTimeout(timer); if (abort === controller) abort = null; }
  }
  async function readCurrent() {
    if (!stored.sessionId || !current()) return;
    const command: TasteCommand = stored.challengeId ? { functionName: 'taste_challenge_v1', request: {
      operation: 'RESUME', profileId: options.profileId, sessionId: stored.sessionId, challengeId: stored.challengeId } }
      : { functionName: stored.protocol === 'v2' ? 'taste_session_v2' : 'taste_session_v1', request: { operation: 'RESUME', profileId: options.profileId, sessionId: stored.sessionId } };
    const result = await invoke(command);
    if (!current() || !result) return;
    if (result.status === 'error') { state = { ...state, message: result.message, blocked: true }; return; }
    accept(result);
    // Source erasure wins over any previously rendered state and draft.
    if ((result.response.kind === 'session' || result.response.kind === 'sequential') && result.response.value.status === 'REMOVED') {
      save({ ...stored, challengeId: null, pending: null });
    }
    if (state.session?.decision?.kind === 'STOP' && state.session.decision.reason === 'EXISTING_COMPLETION') {
      if (save({ ...stored, dismissed: true })) state = { ...state, dismissed: true };
    }
  }
  async function transmit() {
    const startedGeneration = generation;
    const command = stored.pending;
    if (!command || !current()) return;
    if (isStoredSkip(command)) {
      if (!options.contextualSkipRpc) {
        state = { ...state, blocked: true, message: 'Ohituksen tallennuspalvelu ei ole käytettävissä. Sama komento säilyy odottamassa.' }; return;
      }
      const controller = new AbortController(); abort = controller;
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
      let result: Awaited<ReturnType<typeof sendContextualSkip>>;
      try { result = await sendContextualSkip(options.contextualSkipRpc, command.command, controller.signal); }
      finally { clearTimeout(timer); if (abort === controller) abort = null; }
      if (!current() || generation !== startedGeneration) return;
      if (result.status === 'error') {
        state = { ...state, message: result.message, conflict: result.rejectedAction === true, blocked: !result.retryable }; return;
      }
      if (!save({ ...stored, pending: null })) return;
      notifyContextualSkipChanged();
      await readCurrent();
      return;
    }
    const result = await invoke(command);
    if (!current() || !result) return;
    if (result.status === 'error') {
      // Only a confirmed missing first-session RPC permits the legacy writer.
      // Once a retained session exists, outages never switch evidence protocols.
      if (result.kind === 'unavailable' && command.functionName !== 'taste_challenge_v1' &&
        command.request.operation === 'START' && stored.sessionId === null) {
        if (command.functionName === 'taste_session_v2') {
          if (save({ ...stored, protocol: 'v1', pending: { functionName: 'taste_session_v1',
            request: { operation: 'START', profileId: options.profileId, requestId: id() } } })) await transmit();
        } else if (save({ ...stored, pending: null })) state = { ...state, legacy: true, message: null };
      } else state = { ...state, message: result.message, conflict: result.kind === 'conflict' || result.kind === 'invalid',
        blocked: result.kind === 'invalid' };
      return;
    }
    const response = result.response;
    if (response.kind === 'preserved') {
      if (save({ ...stored, protocol: 'v1', sessionId: response.legacySessionId, pending: null,
        dismissed: response.legacySessionId === null })) {
        state = { ...state, dismissed: stored.dismissed };
        if (stored.sessionId) await readCurrent();
      }
      return;
    }
    const next: StoredFlow = { ...stored, sessionId: response.value.sessionId, pending: null,
      dismissed: stored.dismissed || command.request.operation === 'PAUSE',
      challengeId: response.kind === 'challenge' ? response.value.challengeId :
        response.value.status === 'REMOVED' ? null : stored.challengeId };
    if (!save(next)) return; // A lost local acknowledgement retries this exact ID.
    accept(result);
    if (command.functionName !== 'taste_challenge_v1' && (['ANSWER', 'REMOVE'].includes(command.request.operation) || response.value.status === 'SOURCE_WITHDRAWN')) notifyBootstrapEvidenceChanged();
    if (response.value.status !== 'REMOVED') await readCurrent();
    if (!current() || generation !== startedGeneration) return;
    state = { ...state, dismissed: stored.dismissed };
    if (state.session?.decision?.kind === 'STOP' && state.session.decision.reason === 'EXISTING_COMPLETION') {
      if (save({ ...stored, dismissed: true })) state = { ...state, dismissed: true };
    }
  }
  function startCommand(): TasteCommand {
    return { functionName: stored.protocol === 'v2' ? 'taste_session_v2' : 'taste_session_v1',
      request: { operation: 'START', profileId: options.profileId, requestId: id() } };
  }
  async function run() {
    const startedGeneration = generation;
    if (stored.pending) await transmit(); else await readCurrent();
    // Acknowledgement AND a fresh RESUME precede NEXT. A cached retry must never
    // resurrect a question already answered on another device. Never rebase an answer.
    const s = state.sequential;
    if (!current() || generation !== startedGeneration || stored.pending || stored.dismissed || state.message || state.blocked ||
      s?.status !== 'NEEDS_NEXT' || s.revision === null) return;
    const command: TasteCommand = { functionName: 'taste_session_v2', request: { operation: 'NEXT',
      profileId: options.profileId, sessionId: s.sessionId, requestId: id(), expectedRevision: s.revision } };
    if (save({ ...stored, pending: command })) await transmit();
  }
  function sequentialCommand(operation: 'ANSWER' | 'PAUSE' | 'CONTINUE' | 'REMOVE', revision: number,
    answer?: TasteAnswer, itemId?: string): boolean {
    const s = state.sequential;
    if (!s || s.revision !== revision || (operation === 'ANSWER' &&
      (s.status !== 'QUESTION' || s.item?.id !== itemId || !s.questionId || !answer))) return false;
    return enqueue({ functionName: 'taste_session_v2', request: { operation, profileId: options.profileId,
      sessionId: s.sessionId, requestId: id(), expectedRevision: revision,
      ...(operation === 'ANSWER' ? { questionId: s.questionId!, answer: answer! } : {}) } });
  }
  function enqueue(command: PendingTasteCommand): boolean {
    if (!current() || flight || state.busy || stored.pending || state.blocked ||
      !(isStoredSkip(command) ? command.command.actorUserId === options.actorUserId && command.command.profileId === options.profileId &&
        command.command.origin.sessionId === stored.sessionId && stored.protocol === 'v2' : isTasteCommand(command, options.profileId))) return false;
    if (!save({ ...stored, pending: command, dismissed: false })) return false;
    state = { ...state, needsStart: false };
    launch(run); return true;
  }
  function sessionCommand(operation: 'ANSWER' | 'ACK_TRANSITION' | 'REMOVE', answer?: TasteAnswer, expectedItemId?: string, expectedRevision?: number): boolean {
    const s = state.session;
    if (!s || s.revision === null || state.challenge || (operation !== 'REMOVE' && s.status !== 'ACTIVE') ||
      (expectedRevision !== undefined && expectedRevision !== s.revision)) return false;
    const request: TasteCommand['request'] = { operation, profileId: options.profileId, sessionId: s.sessionId,
      requestId: id(), expectedRevision: s.revision };
    if (operation === 'ANSWER') {
      if (s.decision?.kind !== 'QUESTION' || !answer || s.decision.itemId !== expectedItemId) return false;
      // Bind to the server's current presentation, never a new question guessed
      // after a conflict or an old screen callback.
      const question = s.presentations.at(-1);
      if (!question || question.objectId !== s.decision.itemId) return false;
      request.questionIndex = question.index; request.answer = answer;
    }
    if (operation === 'ACK_TRANSITION' && s.decision?.kind !== 'TRANSITION') return false;
    return enqueue({ functionName: 'taste_session_v1', request });
  }
  return {
    snapshot,
    start() {
      if (current()) return;
      generation++;
      active = true; owners.set(key, owner);
      if (!load()) return;
      state = { ...state, dismissed: stored.dismissed && stored.pending === null }; publish();
      if (stored.dismissed && !stored.pending) return;
      if (stored.pending || stored.sessionId) launch(run);
      else if (options.autoStart === false) { state = { ...state, needsStart: true }; publish(); }
      else enqueue(startCommand());
    },
    begin() {
      if (state.sequential?.status === 'PAUSED' && state.sequential.revision !== null)
        return sequentialCommand('CONTINUE', state.sequential.revision);
      if (stored.sessionId) return false;
      return enqueue(startCommand());
    },
    stop() { active = false; generation++; abort?.abort(); flight = null;
      state = { ...state, busy: false }; if (owners.get(key) === owner) owners.delete(key); },
    retry() {
      if (!current() || flight || state.conflict) return;
      if (!load()) return;
      if (stored.pending || stored.sessionId) launch(run);
      else { state = { ...state, blocked: false }; enqueue(startCommand()); }
    },
    recoverConflict() {
      // A domain rejection / SQLSTATE 40001 confirms this attempt rolled back. Re-read before a new
      // user decision; never silently rebase/resubmit the old answer.
      if (!current() || flight || !state.conflict || !save({ ...stored, pending: null })) return;
      if (stored.sessionId) launch(run);
      else {
        // A rejected first START has no session ID to resume. START also looks
        // up the one existing server session; this is an explicit lookup, not
        // a replacement answer or reset of a retained session.
        state = { ...state, blocked: false };
        enqueue(startCommand());
      }
    },
    answerTraining(answer: TasteAnswer, itemId: string, revision: number) {
      return state.sequential ? sequentialCommand('ANSWER', revision, answer, itemId) : sessionCommand('ANSWER', answer, itemId, revision);
    },
    // Controller capability only. Presentation does not call this until the
    // shared feed's separate gesture/accessibility acceptance packet.
    skipCurrent(itemId: string, revision: number) {
      const s = state.sequential;
      if (!options.contextualSkipRpc || !s || s.status !== 'QUESTION' || s.revision !== revision || s.item?.id !== itemId || !s.contextualSkip) return false;
      return enqueue({ functionName: 'commit_taste_contextual_skip_v1', command: {
        version: CONTEXTUAL_SKIP_VERSION, kind: 'CONTEXTUAL_SKIP', actionId: id(), actorUserId: options.actorUserId,
        profileId: options.profileId, itemId, occurredAt: options.nowMicros?.() ?? (BigInt(Date.now()) * 1000n).toString(),
        origin: { ...s.contextualSkip.origin }, contextRef: null, reversesActionId: null } });
    },
    withdrawContextualSkip(original: KajoSkipCommand) {
      if (!options.contextualSkipRpc || !isNativeContextualSkipCommand(original) || original.kind !== 'CONTEXTUAL_SKIP' || original.origin.surface !== 'TASTE') return false;
      return enqueue({ functionName: 'commit_taste_contextual_skip_v1', command: { ...original,
        kind: 'WITHDRAW_CONTEXTUAL_SKIP', actionId: id(), reversesActionId: original.actionId,
        occurredAt: options.nowMicros?.() ?? (BigInt(Date.now()) * 1000n).toString(), origin: { ...original.origin } } });
    },
    acknowledgeBooks(revision: number) { return sessionCommand('ACK_TRANSITION', undefined, undefined, revision); },
    startChallenge() {
      const s = state.session;
      if (!s || s.status !== 'STOPPED' || s.decision?.kind !== 'STOP' || s.decision.reason === 'EXISTING_COMPLETION' || state.challenge) return false;
      return enqueue({ functionName: 'taste_challenge_v1', request: { operation: 'START', profileId: options.profileId, sessionId: s.sessionId, requestId: id() } });
    },
    answerChallenge(itemId: string, answer: TasteAnswer, revision: number) {
      const c = state.challenge;
      if (!c || c.status !== 'ACTIVE' || !c.challengeId || c.revision === null || c.revision !== revision || !c.items.some(i => i.id === itemId) ||
        c.answers.some(a => a.itemId === itemId) || answer.kind === 'WITHDRAWN') return false;
      return enqueue({ functionName: 'taste_challenge_v1', request: { operation: 'ANSWER', profileId: options.profileId,
        sessionId: c.sessionId, challengeId: c.challengeId, requestId: id(), expectedRevision: c.revision, itemId, answer } });
    },
    remove(revision: number) {
      if (state.sequential) return sequentialCommand('REMOVE', revision);
      const c = state.challenge;
      if (c) return c.challengeId && c.revision === revision ? enqueue({ functionName: 'taste_challenge_v1', request: {
        operation: 'REMOVE', profileId: options.profileId, sessionId: c.sessionId, challengeId: c.challengeId,
        requestId: id(), expectedRevision: c.revision } }) : false;
      return sessionCommand('REMOVE', undefined, undefined, revision);
    },
    dismiss() {
      if (!current() || flight || !loaded || stored.pending || state.blocked) return false;
      const s = state.sequential;
      if (s && ['QUESTION', 'NEEDS_NEXT'].includes(s.status) && s.revision !== null) {
        sequentialCommand('PAUSE', s.revision); return false;
      }
      if (!save({ ...stored, dismissed: true })) return false;
      state = { ...state, dismissed: true }; publish(); return true;
    },
    async waitForIdle() { while (flight) await flight; },
  };
}
export type PersonalTasteFlow = ReturnType<typeof createPersonalTasteFlow>;
