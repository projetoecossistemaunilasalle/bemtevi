import { encodeOperations, verifySnapshot } from '@bemtevi/content-core';
import type { ConflictDecisions, DraftHead, EditorialError, PublishedContentPayload } from '@bemtevi/content-core';
import { getTabId } from '../draft-storage/localDraftCache';
import { initializeDraft } from './draftInitialization';
import type { DraftRepository } from './draftRepository';
import type { DraftBaseSnapshot } from './draftTypes';
import { createAutosaveScheduler, createDebounceScheduler } from './draftPolling';
import {
  createRecoveryCoordinator,
  createRecoveryRecorder,
  type RecoveryCoordinator,
  type RecoveryRecorder,
} from './recoveryCoordinator';
import { TIMINGS, acknowledgeMutation, applyRemote, failureDecision } from './saveTransitions';
import { initialSaveState, initializedState, remoteMatchesCandidate } from './saveTransitions';
import { sameHead, toBaseSnapshot, toClean, toConflict, toDirty, toError, toSaving } from './saveTransitions';
import type {
  RemoteApplication,
  RemoteDraft,
  SaveCoordinatorOptions,
  SaveCoordinator,
  SaveCycle,
  SaveState,
} from './saveTransitions';

/**
 * Deterministic, non-React save coordinator (doc 16). One in-flight mutation;
 * 250/750/5000 ms timings; exactly ONE automatic stale merge/CAS retry per
 * cycle; ambiguous outcomes via full read + compare + conditional re-save;
 * never a retry loop. Injected collaborators; decisions in `saveTransitions`.
 */
export function createSaveCoordinator(options: SaveCoordinatorOptions): SaveCoordinator {
  const { repository, cache, now, timers, onChange } = options;
  const isOnline = options.isOnline ?? (() => true);
  const tabIdOf = options.tabId ?? getTabId;
  let epoch = 0,
    disposed = false,
    principalId: string | null = null;
  let recovery: RecoveryCoordinator | null = null,
    recorder: RecoveryRecorder | null = null;
  let state: SaveState = initialSaveState();
  let cycle: SaveCycle | null = null,
    inFlight = false;
  let queuedRefresh = false,
    pendingRemote: RemoteDraft | null = null;
  const waiters: Array<() => void> = [];
  const { saveDebounceMs, maxWaitMs, cacheDebounceMs } = TIMINGS;
  const emit = (): void => onChange({ ...state, conflicts: [...state.conflicts] });
  const alive = (e: number): boolean => e === epoch;
  const errorState = (error: EditorialError, offline: boolean): SaveState => toError(state, error, offline);
  const invalidState = (): SaveState => toError(state, { code: 'validation_failed' }, false);
  const conflictWith = (conflicts: SaveState['conflicts'], head: DraftHead | undefined): SaveState =>
    toConflict(state, conflicts, { code: 'retry_required', ...(head === undefined ? {} : { currentHead: head }) });
  const cacheWrite = createDebounceScheduler(timers, () => recorder?.write(state.base, state.local), cacheDebounceMs);
  const autosave = createAutosaveScheduler(timers, now, () => void fireSave(), saveDebounceMs, maxWaitMs);
  function suspendTimers(): void {
    autosave.reset();
    cacheWrite.cancel();
  }
  const settle = (next: SaveState): void => {
    state = next;
    if (next.phase === 'offline' || next.phase === 'error' || next.phase === 'conflict') suspendTimers();
    emit();
    for (const waiter of waiters.splice(0)) waiter();
    // prettier-ignore
    if (queuedRefresh && alive(epoch)) { queuedRefresh = false; void refresh(false); }
  };
  const onCacheFailure = (): void => {
    // A cache-write failure never claims a locally saved draft.
    // prettier-ignore
    if (state.cacheAvailable) { state = { ...state, cacheAvailable: false }; emit(); }
  };
  function removeRecord(e: number): void {
    recorder?.remove(() => {
      if (alive(e) && state.phase === 'dirty') recorder?.write(state.base, state.local);
    });
  }
  async function readFullDraft(e: number): Promise<RemoteDraft | null> {
    const loaded = await repository.load();
    if (!alive(e)) return null;
    // prettier-ignore
    if (loaded.ok === false) { settle(errorState(loaded.error, !isOnline())); return null; }
    const draft = loaded.data;
    const verified = await verifySnapshot(draft.payload, draft.canonicalPayload, draft.digest);
    if (!alive(e)) return null;
    if (!verified) settle(invalidState());
    return verified ? { head: draft, payload: draft.payload } : null;
  }
  async function fireSave(): Promise<void> {
    const e = epoch;
    if (disposed || inFlight || state.phase !== 'dirty' || state.base === null || state.local === null) return;
    autosave.reset();
    await beginSend(state.base, state.local, false, e);
  }
  async function beginSend(
    base: DraftBaseSnapshot,
    candidate: PublishedContentPayload,
    retryUsed: boolean,
    e: number,
  ): Promise<void> {
    const encoded = encodeOperations(base.payload, candidate);
    if (encoded.ok === false) return settle(toError(state, { code: encoded.error.code }, false));
    // prettier-ignore
    if (encoded.data.length === 0) { cycle = null; removeRecord(e); return settle(toClean(state, base)); }
    cycle = { base, candidate, sentPayload: candidate, capturedLocal: state.local ?? candidate, retryUsed };
    state = toSaving(state);
    emit();
    inFlight = true;
    const result = await repository.mutate({ expectedGeneration: base.generation, operations: encoded.data });
    inFlight = false;
    if (alive(e)) await handleMutateResult(e, result);
  }
  function acknowledge(e: number, head: DraftHead, current: SaveCycle): void {
    cycle = null;
    const outcome = acknowledgeMutation(current, head, state.local);
    if (outcome.kind === 'invalid') return settle(invalidState());
    // prettier-ignore
    if (outcome.kind === 'conflict') { pendingRemote = outcome.remote; return settle(conflictWith(outcome.conflicts, undefined)); }
    // prettier-ignore
    if (outcome.kind === 'acknowledged') { removeRecord(e); return settle(toClean(state, outcome.base)); }
    const { base, local } = outcome;
    if (remoteMatchesCandidate(local, base.payload)) {
      removeRecord(e);
      return settle(toClean(state, base));
    }
    state = { ...toDirty(state, local), base };
    recorder?.write(state.base, state.local);
    settle(state);
    timers.setTimeout(() => void fireSave(), 0);
  }
  async function handleFailedMutation(e: number, error: EditorialError, stale: boolean): Promise<void> {
    const current = cycle;
    // prettier-ignore
    if (current === null) { return settle(stale ? errorState(error, false) : errorState({ code: 'unavailable' }, !isOnline())); }
    const remote = await readFullDraft(e);
    if (!alive(e)) return;
    // prettier-ignore
    if (remote === null) { cycle = null; return settle(state); }
    const decision = failureDecision(current, remote, stale, state, error, !isOnline());
    cycle = null;
    if (decision.kind === 'acknowledge') return acknowledge(e, remote.head, current);
    if (decision.kind === 'retry') return beginSend(decision.base, decision.candidate, true, e);
    // prettier-ignore
    if (decision.kind === 'conflict') { pendingRemote = decision.remote; return settle(decision.next); }
    return settle(decision.next);
  }
  async function handleMutateResult(e: number, result: Awaited<ReturnType<DraftRepository['mutate']>>): Promise<void> {
    if (result.ok === true) {
      const current = cycle;
      if (current !== null) acknowledge(e, result.data.head, current);
    } else {
      const error = result.error;
      if (error.code === 'stale_generation') await handleFailedMutation(e, error, true);
      else if (error.code === 'unavailable') await handleFailedMutation(e, error, false);
      // prettier-ignore
      else { cycle = null; const conflict = error.code === 'retry_required' || error.code === 'merge_conflict'; settle(conflict ? conflictWith([], error.currentHead) : errorState(error, false)); }
    }
  }
  async function settleApplied(
    e: number,
    applied: RemoteApplication,
    remote: RemoteDraft,
    dirty: 'save' | 'arm',
  ): Promise<void> {
    if (applied.kind === 'invalid') return settle(invalidState());
    // prettier-ignore
    if (applied.kind === 'conflict') { pendingRemote = remote; return settle(conflictWith(applied.conflicts, remote.head)); }
    // prettier-ignore
    if (applied.kind === 'clean') { removeRecord(e); return settle(toClean(state, applied.base)); }
    state = { ...toDirty(state, applied.local), base: applied.base };
    emit();
    autosave.suspend();
    if (dirty === 'save') return fireSave();
    if (dirty === 'arm') autosave.arm(true);
  }
  async function refresh(saveIfDirty: boolean): Promise<void> {
    const e = epoch;
    // prettier-ignore
    if (inFlight) { queuedRefresh = true; return; }
    if (disposed || state.phase === 'loading' || state.base === null) return;
    const headResult = await repository.head();
    if (!alive(e)) return;
    // prettier-ignore
    if (headResult.ok === false) { if (state.phase !== 'clean') settle(errorState(headResult.error, !isOnline())); return; }
    const base = state.base;
    const head = headResult.data;
    // prettier-ignore
    if (sameHead(head, base)) { if (saveIfDirty && state.phase === 'dirty') await fireSave(); return; }
    const remote = await readFullDraft(e);
    // prettier-ignore
    if (alive(e) && remote !== null) { await settleApplied(e, applyRemote(base, state.local, remote), remote, saveIfDirty ? 'save' : 'arm'); }
  }
  async function performLoad(pid: string): Promise<void> {
    const init = await initializeDraft({ repository, cache, principalId: pid, tabId: tabIdOf() });
    if (!alive(epoch)) return;
    // Failure preserves cache and any retained base/local, and offers retry.
    // prettier-ignore
    if (init.status === 'unavailable') { settle(errorState(init.error, !isOnline())); return; }
    const next = initializedState(state, init);
    state = next.state;
    if (next.resumed) {
      emit();
      autosave.arm(true);
      return;
    }
    settle(state);
  }
  function edit(candidate: PublishedContentPayload): void {
    const editable = state.phase === 'clean' || state.phase === 'dirty' || state.phase === 'saving';
    if (disposed || state.base === null || !editable) return;
    // prettier-ignore
    if (inFlight) { state = { ...state, local: candidate, conflicts: [], error: null }; emit(); }
    else {
      const fromClean = state.phase === 'clean';
      state = toDirty(state, candidate);
      emit();
      autosave.suspend();
      autosave.arm(fromClean);
    }
    cacheWrite.schedule();
  }
  async function flush(): Promise<boolean> {
    const e = epoch;
    if (disposed) return false;
    for (;;) {
      if (!alive(e)) return false;
      if (state.phase === 'dirty' && !inFlight) await fireSave();
      else if (inFlight || state.phase === 'saving') await new Promise<void>((wake) => waiters.push(wake));
      else break;
    }
    return alive(e) && state.phase === 'clean';
  }
  async function resolve(decisions: ConflictDecisions): Promise<void> {
    const e = epoch;
    if (disposed || state.phase !== 'conflict' || state.base === null || state.local === null) return;
    const headResult = await repository.head();
    if (!alive(e)) return;
    if (headResult.ok === false) return settle(errorState(headResult.error, !isOnline()));
    // prettier-ignore
    const remote = pendingRemote !== null && sameHead(headResult.data, pendingRemote.head) ? pendingRemote : await readFullDraft(e);
    if (!alive(e) || remote === null) return;
    pendingRemote = null;
    await settleApplied(e, applyRemote(state.base, state.local, remote, decisions), remote, 'save');
  }
  async function retry(): Promise<void> {
    const e = epoch;
    const retriable = state.phase === 'conflict' || state.phase === 'error' || state.phase === 'offline';
    if (disposed || principalId === null || !retriable) return;
    if (state.base === null) return performLoad(principalId);
    const remote = await readFullDraft(e);
    if (!alive(e) || remote === null) return;
    pendingRemote = null;
    await settleApplied(e, applyRemote(state.base, state.local, remote), remote, 'save');
  }
  async function discardLocal(): Promise<void> {
    const e = epoch;
    if (disposed) return;
    suspendTimers();
    const remote = await readFullDraft(e);
    if (!alive(e) || remote === null) return;
    cycle = null;
    pendingRemote = null;
    settle(toClean(state, toBaseSnapshot(remote.head, remote.payload)));
    void recorder?.remove(() => undefined);
  }
  function resetCycle(): void {
    suspendTimers();
    cycle = null;
    inFlight = false;
    queuedRefresh = false;
    pendingRemote = null;
  }
  return {
    async load(pid) {
      if (disposed) return;
      epoch += 1;
      resetCycle();
      principalId = pid;
      recovery = createRecoveryCoordinator({ cache, principalId: pid, tabId: tabIdOf(), now });
      recorder = createRecoveryRecorder(recovery, () => alive(epoch), onCacheFailure);
      state = initialSaveState(state.cacheAvailable);
      emit();
      await performLoad(pid);
    },
    edit,
    flush,
    refresh: () => (disposed ? Promise.resolve() : refresh(false)),
    resolve,
    retry,
    discardLocal,
    dispose() {
      disposed = true;
      epoch += 1;
      resetCycle();
      for (const waiter of waiters.splice(0)) waiter();
    },
  };
}
