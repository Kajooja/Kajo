import { notifyBootstrapEvidenceChanged } from '../discovery/predictionRefresh';
import { createUuidV7 } from '../events/eventTracking';
import type { ItemActionStorage } from '../events/itemActionOutbox';
import { isTasteCommand, sendTasteCommand, uuid, type TasteAnswer, type TasteChallenge,
  type TasteCommand, type TasteRpc, type TasteSession } from './personalTasteOperations';

type StoredFlow = { version: 1; sessionId: string | null; challengeId: string | null; pending: TasteCommand | null; dismissed: boolean };
export type PersonalTasteSnapshot = {
  session: TasteSession | null; challenge: TasteChallenge | null; busy: boolean; pending: boolean;
  legacy: boolean; dismissed: boolean; message: string | null; conflict: boolean; blocked: boolean;
  needsStart: boolean;
};
const owners = new Map<string, object>();
const fresh = (): StoredFlow => ({ version: 1, sessionId: null, challengeId: null, pending: null, dismissed: false });

// One persisted, immutable command at a time. Full answer/forecast state belongs
// to the server; SQLite retains only IDs, dismissal and the unacknowledged command.
export function createPersonalTasteFlow(options: {
  namespace: string; actorUserId: string; profileId: string; storage: ItemActionStorage;
  rpc: TasteRpc; onChange: (snapshot: PersonalTasteSnapshot) => void;
  createId?: () => string; timeoutMs?: number; autoStart?: boolean;
}) {
  const key = `kajo:personal-taste:v1:${encodeURIComponent(options.namespace)}:${options.actorUserId}:${options.profileId}`;
  const owner = {};
  let active = false; let generation = 0; let flight: Promise<void> | null = null; let abort: AbortController | null = null;
  let stored = fresh(); let loaded = false;
  let state: PersonalTasteSnapshot = { session: null, challenge: null, busy: false, pending: false,
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
      if (Object.keys(r).sort().join() !== 'challengeId,dismissed,pending,sessionId,version' || r.version !== 1 ||
        (r.sessionId !== null && !uuid(r.sessionId)) || (r.challengeId !== null && !uuid(r.challengeId)) ||
        (r.challengeId !== null && r.sessionId === null) || typeof r.dismissed !== 'boolean' ||
        (r.pending !== null && !isTasteCommand(r.pending, options.profileId))) throw new Error('Invalid storage');
      const next = r as unknown as StoredFlow;
      if (next.pending?.request.sessionId && next.pending.request.sessionId !== next.sessionId) throw new Error('Wrong session');
      if (next.pending?.request.challengeId && next.pending.request.challengeId !== next.challengeId) throw new Error('Wrong challenge');
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
      : { functionName: 'taste_session_v1', request: { operation: 'RESUME', profileId: options.profileId, sessionId: stored.sessionId } };
    const result = await invoke(command);
    if (!current() || !result) return;
    if (result.status === 'error') { state = { ...state, message: result.message, blocked: true }; return; }
    accept(result);
    // Source erasure wins over any previously rendered state and draft.
    if (result.response.kind === 'session' && result.response.value.status === 'REMOVED') {
      save({ ...stored, challengeId: null, pending: null });
    }
    if (state.session?.decision?.kind === 'STOP' && state.session.decision.reason === 'EXISTING_COMPLETION') {
      if (save({ ...stored, dismissed: true })) state = { ...state, dismissed: true };
    }
  }
  async function transmit() {
    const command = stored.pending;
    if (!command || !current()) return;
    const result = await invoke(command);
    if (!current() || !result) return;
    if (result.status === 'error') {
      // Only a confirmed missing first-session RPC permits the legacy writer.
      // Once a retained session exists, outages never switch evidence protocols.
      if (result.kind === 'unavailable' && command.functionName === 'taste_session_v1' &&
        command.request.operation === 'START' && stored.sessionId === null) {
        if (save({ ...stored, pending: null })) state = { ...state, legacy: true, message: null };
      } else state = { ...state, message: result.message, conflict: result.kind === 'conflict' || result.kind === 'invalid',
        blocked: result.kind === 'invalid' };
      return;
    }
    const response = result.response;
    const next: StoredFlow = { ...stored, sessionId: response.value.sessionId, pending: null,
      challengeId: response.kind === 'challenge' ? response.value.challengeId :
        response.value.status === 'REMOVED' ? null : stored.challengeId };
    if (!save(next)) return; // A lost local acknowledgement retries this exact ID.
    accept(result);
    if (command.functionName === 'taste_session_v1' && ['ANSWER', 'REMOVE'].includes(command.request.operation)) notifyBootstrapEvidenceChanged();
    if (response.value.status !== 'REMOVED') await readCurrent();
    state = { ...state, dismissed: stored.dismissed };
    if (state.session?.decision?.kind === 'STOP' && state.session.decision.reason === 'EXISTING_COMPLETION') {
      if (save({ ...stored, dismissed: true })) state = { ...state, dismissed: true };
    }
  }
  function enqueue(command: TasteCommand): boolean {
    if (!current() || flight || state.busy || stored.pending || state.blocked || !isTasteCommand(command, options.profileId)) return false;
    if (!save({ ...stored, pending: command, dismissed: false })) return false;
    state = { ...state, needsStart: false };
    launch(transmit); return true;
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
      if (stored.pending) launch(transmit);
      else if (stored.sessionId) launch(readCurrent);
      else if (options.autoStart === false) { state = { ...state, needsStart: true }; publish(); }
      else enqueue({ functionName: 'taste_session_v1', request: { operation: 'START', profileId: options.profileId, requestId: id() } });
    },
    begin() {
      if (stored.sessionId) return false;
      return enqueue({ functionName: 'taste_session_v1', request: { operation: 'START', profileId: options.profileId, requestId: id() } });
    },
    stop() { active = false; generation++; abort?.abort(); flight = null;
      state = { ...state, busy: false }; if (owners.get(key) === owner) owners.delete(key); },
    retry() {
      if (!current() || flight || state.conflict) return;
      if (!load()) return;
      if (stored.pending) launch(transmit); else if (stored.sessionId) launch(readCurrent);
      else { state = { ...state, blocked: false }; enqueue({ functionName: 'taste_session_v1', request: { operation: 'START', profileId: options.profileId, requestId: id() } }); }
    },
    recoverConflict() {
      // A domain rejection / SQLSTATE 40001 confirms this attempt rolled back. Re-read before a new
      // user decision; never silently rebase/resubmit the old answer.
      if (!current() || flight || !state.conflict || !save({ ...stored, pending: null })) return;
      if (stored.sessionId) launch(readCurrent);
      else {
        // A rejected first START has no session ID to resume. START also looks
        // up the one existing server session; this is an explicit lookup, not
        // a replacement answer or reset of a retained session.
        state = { ...state, blocked: false };
        enqueue({ functionName: 'taste_session_v1', request: { operation: 'START', profileId: options.profileId, requestId: id() } });
      }
    },
    answerTraining(answer: TasteAnswer, itemId: string, revision: number) { return sessionCommand('ANSWER', answer, itemId, revision); },
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
      const c = state.challenge;
      if (c) return c.challengeId && c.revision === revision ? enqueue({ functionName: 'taste_challenge_v1', request: {
        operation: 'REMOVE', profileId: options.profileId, sessionId: c.sessionId, challengeId: c.challengeId,
        requestId: id(), expectedRevision: c.revision } }) : false;
      return sessionCommand('REMOVE', undefined, undefined, revision);
    },
    dismiss() {
      if (!current() || flight || !loaded || !save({ ...stored, dismissed: true })) return false;
      state = { ...state, dismissed: true }; publish(); return true;
    },
    async waitForIdle() { while (flight) await flight; },
  };
}
export type PersonalTasteFlow = ReturnType<typeof createPersonalTasteFlow>;
