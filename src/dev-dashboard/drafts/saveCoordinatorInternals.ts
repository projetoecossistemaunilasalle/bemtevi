import type { ConflictDecisions, EditorialError, PublishedContentPayload } from '@bemtevi/content-core';
import type { RecoveryRecorder } from './recoveryCoordinator';
import type { DraftRepository } from './draftRepository';
import {
  sameHead,
  applyRemote,
  toBaseSnapshot,
  toClean,
  toDirty,
  type RemoteApplication,
  type RemoteDraft,
  type SaveState,
} from './saveTransitions';

export interface SaveCoordinatorInternalsContext {
  repository: DraftRepository;
  getRecorder(): RecoveryRecorder | null;
  waiters: Array<() => void>;
  getEpoch(): number;
  isAlive(epoch: number): boolean;
  isDisposed(): boolean;
  getPrincipalId(): string | null;
  getState(): SaveState;
  setState(next: SaveState): void;
  emit(): void;
  isInFlight(): boolean;
  suspendAutosave(): void;
  armAutosave(fromClean: boolean): void;
  scheduleCacheWrite(): void;
  fireSave(): Promise<void>;
  performLoad(principalId: string): Promise<void>;
  readFullDraft(epoch: number): Promise<RemoteDraft | null>;
  settle(next: SaveState): void;
  errorState(error: EditorialError, offline: boolean): SaveState;
  isOnline(): boolean;
  settleApplied(epoch: number, applied: RemoteApplication, remote: RemoteDraft, dirty: 'save' | 'arm'): Promise<void>;
  getPendingRemote(): RemoteDraft | null;
  setPendingRemote(remote: RemoteDraft | null): void;
  clearCycle(): void;
  setInFlight(value: boolean): void;
  clearQueuedRefresh(): void;
  queueRefresh(): void;
  suspendTimers(): void;
}

export interface SaveCoordinatorInternalsActions {
  resetCycle(): void;
  edit(candidate: PublishedContentPayload): void;
  refresh(saveIfDirty: boolean): Promise<void>;
  flush(): Promise<boolean>;
  resolve(decisions: ConflictDecisions): Promise<void>;
  retry(): Promise<void>;
  discardLocal(): Promise<void>;
}

export function createSaveCoordinatorInternals(
  context: SaveCoordinatorInternalsContext,
): SaveCoordinatorInternalsActions {
  function resetCycle(): void {
    context.suspendTimers();
    context.clearCycle();
    context.setInFlight(false);
    context.clearQueuedRefresh();
    context.setPendingRemote(null);
  }

  function edit(candidate: PublishedContentPayload): void {
    const state = context.getState();
    const editable = state.phase === 'clean' || state.phase === 'dirty' || state.phase === 'saving';
    if (context.isDisposed() || state.base === null || !editable) return;
    if (context.isInFlight()) {
      context.setState({ ...state, local: candidate, conflicts: [], error: null });
      context.emit();
    } else {
      const fromClean = state.phase === 'clean';
      context.setState(toDirty(state, candidate));
      context.emit();
      context.suspendAutosave();
      context.armAutosave(fromClean);
    }
    context.scheduleCacheWrite();
  }

  async function refresh(saveIfDirty: boolean): Promise<void> {
    const epoch = context.getEpoch();
    if (context.isInFlight()) {
      context.queueRefresh();
      return;
    }
    const initial = context.getState();
    if (context.isDisposed() || initial.phase === 'loading' || initial.base === null) return;
    const headResult = await context.repository.head();
    if (!context.isAlive(epoch)) return;
    if (headResult.ok === false) {
      if (context.getState().phase !== 'clean')
        context.settle(context.errorState(headResult.error, !context.isOnline()));
      return;
    }
    const base = context.getState().base;
    if (base === null) return;
    const head = headResult.data;
    if (sameHead(head, base)) {
      if (saveIfDirty && context.getState().phase === 'dirty') await context.fireSave();
      return;
    }
    const remote = await context.readFullDraft(epoch);
    const latest = context.getState();
    if (context.isAlive(epoch) && remote !== null) {
      await context.settleApplied(epoch, applyRemote(base, latest.local, remote), remote, saveIfDirty ? 'save' : 'arm');
    }
  }

  async function flush(): Promise<boolean> {
    const epoch = context.getEpoch();
    if (context.isDisposed()) return false;
    for (;;) {
      if (!context.isAlive(epoch)) return false;
      const state = context.getState();
      if (state.phase === 'dirty' && !context.isInFlight()) await context.fireSave();
      else if (context.isInFlight() || context.getState().phase === 'saving')
        await new Promise<void>((wake) => context.waiters.push(wake));
      else break;
    }
    return context.isAlive(epoch) && context.getState().phase === 'clean';
  }

  async function resolve(decisions: ConflictDecisions): Promise<void> {
    const epoch = context.getEpoch();
    const state = context.getState();
    if (context.isDisposed() || state.phase !== 'conflict' || state.base === null || state.local === null) return;
    const headResult = await context.repository.head();
    if (!context.isAlive(epoch)) return;
    if (headResult.ok === false) return context.settle(context.errorState(headResult.error, !context.isOnline()));
    const pending = context.getPendingRemote();
    const remote =
      pending !== null && sameHead(headResult.data, pending.head) ? pending : await context.readFullDraft(epoch);
    if (!context.isAlive(epoch) || remote === null) return;
    context.setPendingRemote(null);
    const latest = context.getState();
    if (latest.base === null) return;
    await context.settleApplied(epoch, applyRemote(latest.base, latest.local, remote, decisions), remote, 'save');
  }

  async function retry(): Promise<void> {
    const epoch = context.getEpoch();
    const state = context.getState();
    const retriable = state.phase === 'conflict' || state.phase === 'error' || state.phase === 'offline';
    if (context.isDisposed() || context.getPrincipalId() === null || !retriable) return;
    if (state.base === null) return context.performLoad(context.getPrincipalId()!);
    const remote = await context.readFullDraft(epoch);
    if (!context.isAlive(epoch) || remote === null) return;
    context.setPendingRemote(null);
    const latest = context.getState();
    if (latest.base === null) return;
    await context.settleApplied(epoch, applyRemote(latest.base, latest.local, remote), remote, 'save');
  }

  async function discardLocal(): Promise<void> {
    const epoch = context.getEpoch();
    if (context.isDisposed()) return;
    context.suspendTimers();
    const remote = await context.readFullDraft(epoch);
    if (!context.isAlive(epoch) || remote === null) return;
    context.clearCycle();
    context.setPendingRemote(null);
    context.settle(toClean(context.getState(), toBaseSnapshot(remote.head, remote.payload)));
    void context.getRecorder()?.remove(() => undefined);
  }

  return { resetCycle, edit, refresh, flush, resolve, retry, discardLocal };
}
