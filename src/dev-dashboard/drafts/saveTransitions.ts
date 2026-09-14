import { sameContent } from '@bemtevi/content-core';

import type { DraftInitialization } from './draftInitialization';
import type { DraftRepository } from './draftRepository';
import type { SaveTimers } from './draftPolling';
import type { LocalDraftCache } from '../draft-storage/localDraftCache';
import type {
  ConflictDecisions,
  DraftHead,
  EditorialError,
  PublishedContentPayload,
  SemanticConflict,
} from '@bemtevi/content-core';
import { reconcileContent } from '@bemtevi/content-core';

import type { DraftBaseSnapshot } from './draftTypes';

/**
 * Pure save-state-machine transitions and constants (dossier doc 16,
 * "State Transitions" and exact save labels). React-free and deterministic:
 * every helper is a pure function of its inputs so the coordinator and the
 * tests exercise the exact same transition table.
 */

/** Frozen dashboard timings (doc 16 / task DASHBOARD-02): 250/750/5000/15000 ms. */
export const TIMINGS = {
  /** Trailing recovery-cache write debounce after an edit. */
  cacheDebounceMs: 250,
  /** Trailing autosave debounce after an edit. */
  saveDebounceMs: 750,
  /** Maximum wait from the first dirty edit before an autosave is forced. */
  maxWaitMs: 5000,
  /** Head polling interval while the dashboard is visible. */
  pollIntervalMs: 15000,
} as const;

export type SavePhase = 'loading' | 'clean' | 'dirty' | 'saving' | 'offline' | 'conflict' | 'error';

/** Immutable dashboard save state (doc 16, exact shape). */
export interface SaveState {
  phase: SavePhase;
  base: DraftBaseSnapshot | null;
  local: PublishedContentPayload | null;
  conflicts: SemanticConflict[];
  error: EditorialError | null;
  cacheAvailable: boolean;
}

export const CACHE_FAILED_LABEL = 'Alterações apenas nesta aba. Baixe uma cópia antes de sair.';

const PHASE_LABELS: Record<SavePhase, string> = {
  loading: 'Carregando rascunho...',
  dirty: 'Alterações pendentes',
  saving: 'Salvando...',
  clean: 'Salvo no BemTeVi',
  offline: 'Sem conexão. Salvo neste dispositivo',
  conflict: 'Conflito: revise as alterações',
  error: 'Não foi possível salvar',
};

/** Exact PT-BR save labels (doc 16). Cache failure never claims a local save. */
export function saveStatusLabel(state: SaveState): string {
  if (!state.cacheAvailable && (state.phase === 'dirty' || state.phase === 'offline' || state.phase === 'error')) {
    return CACHE_FAILED_LABEL;
  }
  return PHASE_LABELS[state.phase];
}

export function initialSaveState(cacheAvailable: boolean = true): SaveState {
  return { phase: 'loading', base: null, local: null, conflicts: [], error: null, cacheAvailable };
}

export function toBaseSnapshot(head: DraftHead, payload: PublishedContentPayload): DraftBaseSnapshot {
  return { ...head, payload };
}

export function toDirty(state: SaveState, local: PublishedContentPayload): SaveState {
  return { ...state, phase: 'dirty', local, conflicts: [], error: null };
}

export function toSaving(state: SaveState): SaveState {
  return { ...state, phase: 'saving', conflicts: [], error: null };
}

/** Clean means fully synced: the local candidate is null. */
export function toClean(state: SaveState, base: DraftBaseSnapshot): SaveState {
  return { ...state, phase: 'clean', base, local: null, conflicts: [], error: null };
}

export function toConflict(state: SaveState, conflicts: SemanticConflict[], error: EditorialError | null): SaveState {
  return { ...state, phase: 'conflict', conflicts, error };
}

export function toError(state: SaveState, error: EditorialError, offline: boolean): SaveState {
  return { ...state, phase: offline ? 'offline' : 'error', error, conflicts: [] };
}

/** Compact reconcile verdict shared by every save/poll transition. */
export type MergeOutcome =
  | { kind: 'invalid' }
  | { kind: 'incomplete'; conflicts: SemanticConflict[]; candidate: PublishedContentPayload }
  | { kind: 'complete'; candidate: PublishedContentPayload };

export function mergeOutcome(
  base: PublishedContentPayload,
  local: PublishedContentPayload,
  remote: PublishedContentPayload,
  decisions: ConflictDecisions = {},
): MergeOutcome {
  const outcome = reconcileContent(base, local, remote, decisions);
  if (outcome.ok === false) return { kind: 'invalid' };
  const merge = outcome.value;
  return merge.kind === 'incomplete'
    ? { kind: 'incomplete', conflicts: merge.conflicts, candidate: merge.candidate }
    : { kind: 'complete', candidate: merge.candidate };
}

/** Doc-16 ambiguity test: did the remote content already become the candidate? */
export function remoteMatchesCandidate(remote: PublishedContentPayload, candidate: PublishedContentPayload): boolean {
  return sameContent(remote, candidate);
}

/**
 * Coordinator contract (doc 16 `createSaveCoordinator`): non-React service
 * with injected repositories/cache/clock/timers and an `onChange` callback.
 */
export interface SaveCoordinatorOptions {
  repository: DraftRepository;
  cache: LocalDraftCache;
  now: () => number;
  timers: SaveTimers;
  onChange(state: SaveState): void;
  isOnline?: () => boolean;
  tabId?: () => string;
}

export interface SaveCoordinator {
  load(principalId: string): Promise<void>;
  edit(candidate: PublishedContentPayload): void;
  flush(): Promise<boolean>;
  refresh(): Promise<void>;
  resolve(decisions: ConflictDecisions): Promise<void>;
  retry(): Promise<void>;
  discardLocal(): Promise<void>;
  dispose(): void;
}

/** Full remote draft snapshot (head plus payload) used by reconciliation. */
export interface RemoteDraft {
  head: DraftHead;
  payload: PublishedContentPayload;
}

export interface SaveCycle {
  base: DraftBaseSnapshot;
  candidate: PublishedContentPayload;
  sentPayload: PublishedContentPayload;
  /** state.local reference captured at send time; edits during save move it. */
  capturedLocal: PublishedContentPayload;
  retryUsed: boolean;
}

/** Decision after a newer verified remote was read (refresh/online/poll/retry). */
export type RemoteApplication =
  | { kind: 'clean'; base: DraftBaseSnapshot }
  | { kind: 'conflict'; conflicts: SemanticConflict[] }
  | { kind: 'dirty'; base: DraftBaseSnapshot; local: PublishedContentPayload }
  | { kind: 'invalid' };

/** Reconciles local against a newer remote; null local adopts the remote. */
export function applyRemote(
  base: DraftBaseSnapshot,
  local: PublishedContentPayload | null,
  remote: RemoteDraft,
  decisions: ConflictDecisions = {},
): RemoteApplication {
  if (local === null) return { kind: 'clean', base: toBaseSnapshot(remote.head, remote.payload) };
  const outcome = mergeOutcome(base.payload, local, remote.payload, decisions);
  if (outcome.kind === 'invalid') return { kind: 'invalid' };
  if (outcome.kind === 'incomplete') return { kind: 'conflict', conflicts: outcome.conflicts };
  const newBase = toBaseSnapshot(remote.head, remote.payload);
  if (remoteMatchesCandidate(outcome.candidate, remote.payload)) return { kind: 'clean', base: newBase };
  return { kind: 'dirty', base: newBase, local: outcome.candidate };
}

/** Decision after an acknowledged mutation result (doc 16 success row). */
export type Acknowledgement =
  | { kind: 'acknowledged'; base: DraftBaseSnapshot }
  | { kind: 'invalid' }
  | { kind: 'conflict'; conflicts: SemanticConflict[]; remote: RemoteDraft }
  | { kind: 'rebase'; base: DraftBaseSnapshot; local: PublishedContentPayload };

export function acknowledgeMutation(
  current: SaveCycle,
  head: DraftHead,
  /** Latest local reference at settle time (may have moved during the request). */
  latestLocal: PublishedContentPayload | null,
): Acknowledgement {
  const newBase = toBaseSnapshot(head, current.sentPayload);
  if (latestLocal === current.capturedLocal) return { kind: 'acknowledged', base: newBase };
  const local = latestLocal ?? current.candidate;
  const outcome = mergeOutcome(current.candidate, local, current.sentPayload);
  if (outcome.kind === 'invalid') return { kind: 'invalid' };
  if (outcome.kind === 'incomplete') {
    return { kind: 'conflict', conflicts: outcome.conflicts, remote: { head, payload: current.sentPayload } };
  }
  if (remoteMatchesCandidate(outcome.candidate, current.sentPayload)) return { kind: 'acknowledged', base: newBase };
  return { kind: 'rebase', base: newBase, local: outcome.candidate };
}

/** Decision for one automatic stale/ambiguous merge-and-CAS retry. */
export type StaleRetry =
  | { kind: 'conflict'; conflicts: SemanticConflict[] }
  | { kind: 'retry'; base: DraftBaseSnapshot; candidate: PublishedContentPayload }
  | { kind: 'invalid' };

export function staleRebase(current: SaveCycle, remote: RemoteDraft): StaleRetry {
  const outcome = mergeOutcome(current.base.payload, current.candidate, remote.payload);
  if (outcome.kind === 'invalid') return { kind: 'invalid' };
  if (outcome.kind === 'incomplete') return { kind: 'conflict', conflicts: outcome.conflicts };
  // A merged candidate equal to the remote re-sends zero operations and is
  // acknowledged cleanly by `beginSend` without any RPC.
  return { kind: 'retry', base: toBaseSnapshot(remote.head, remote.payload), candidate: outcome.candidate };
}

/** Maps a draft initialization outcome onto the next save state (doc 16 load). */
type NonUnavailableInit = Exclude<DraftInitialization, { status: 'unavailable' }>;

export function initializedState(state: SaveState, init: NonUnavailableInit): { state: SaveState; resumed: boolean } {
  if (init.status === 'cache_conflict') {
    return {
      resumed: false,
      state: {
        ...state,
        phase: 'conflict',
        base: init.base,
        local: null,
        conflicts: [],
        error: { code: 'retry_required' },
        cacheAvailable: true,
      },
    };
  }
  if (init.status === 'ready' && init.local !== null) {
    return {
      resumed: true,
      state: { ...toDirty(state, init.local), base: init.base, cacheAvailable: init.cacheAvailable },
    };
  }
  return { resumed: false, state: { ...toClean(state, init.base), cacheAvailable: init.cacheAvailable } };
}

/** Decision after a stale/ambiguous mutation failure (doc 16; one bounded retry). */
export type FailureDecision =
  | { kind: 'acknowledge' }
  | { kind: 'retry'; base: DraftBaseSnapshot; candidate: PublishedContentPayload }
  | { kind: 'conflict'; conflicts: SemanticConflict[]; remote: RemoteDraft; next: SaveState }
  | { kind: 'error'; next: SaveState };

export function failureDecision(
  current: SaveCycle,
  remote: RemoteDraft,
  stale: boolean,
  state: SaveState,
  error: EditorialError,
  offline: boolean,
): FailureDecision {
  if (remoteMatchesCandidate(remote.payload, current.sentPayload)) return { kind: 'acknowledge' };
  if (current.retryUsed) {
    // Second stale in the same cycle / exhausted ambiguous budget: no loop.
    return stale
      ? {
          kind: 'conflict',
          conflicts: [],
          remote,
          next: toConflict(state, [], { code: 'retry_required', currentHead: remote.head }),
        }
      : { kind: 'error', next: toError(state, { code: 'unavailable' }, offline) };
  }
  const outcome = staleRebase(current, remote);
  if (outcome.kind === 'invalid') return { kind: 'error', next: toError(state, { code: 'validation_failed' }, false) };
  if (outcome.kind === 'conflict') {
    return {
      kind: 'conflict',
      conflicts: outcome.conflicts,
      remote,
      next: toConflict(state, outcome.conflicts, { code: 'retry_required', currentHead: remote.head }),
    };
  }
  // merged == remote re-sends zero operations and adopts the remote cleanly.
  return { kind: 'retry', base: outcome.base, candidate: outcome.candidate };
}

/** Server-head identity: same generation and digest means unchanged content. */
export function sameHead(a: DraftHead, b: DraftHead): boolean {
  return a.generation === b.generation && a.digest === b.digest;
}
