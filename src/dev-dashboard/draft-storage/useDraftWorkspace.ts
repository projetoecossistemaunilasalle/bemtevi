import { useEffect, useRef, useState } from 'react';
import type { ConflictDecisions, PublishedContentPayload } from '@bemtevi/content-core';
import type { ContentDraft } from '../draft-sync/contentDraft';
import type { DraftRepository } from '../drafts/draftRepository';
// prettier-ignore
import { createDraftPolling, type SaveTimers } from '../drafts/draftPolling';
import { createSaveCoordinator } from '../drafts/saveCoordinator';
// prettier-ignore
import { initialSaveState, type SaveCoordinator, type SaveState } from '../drafts/saveTransitions';
// prettier-ignore
import { DASHBOARD_STORAGE_KEY, hasDashboardChanges, importDraftFromJson, mergeDashboardDrafts } from './dashboardStorage';
// prettier-ignore
import { createLocalDraftCache, getTabId } from './localDraftCache';
// prettier-ignore
import { createWorkspace, createWorkspaceFromContentDraft, importWorkspace, listWorkspaces, writeWorkspace, type DraftWorkspace } from './workspace';
import { loadDraftFromIndexedDb } from './draftDb';

const POINTER = 'bemtevi:dashboard:workspace-session';

/**
 * Legacy local-persistence hook (pre-V2 workspace; kept compiling until LEGACY-01).
 * The final doc-16 export `useDraftWorkspace(principalId)` is the canonical V2 hook below.
 */
export function useLegacyDraftWorkspace(remote: PublishedContentPayload, revision: number | null) {
  // prettier-ignore
  const [workspace, setWorkspace] = useState<DraftWorkspace | null>(null), current = useRef<DraftWorkspace | null>(null), [status, setStatus] = useState<'loading' | 'saving' | 'saved' | 'error' | 'ready'>('loading'), [error, setError] = useState<string | null>(null), [available, setAvailable] = useState<DraftWorkspace[]>([]), [recovery, setRecovery] = useState<string | null>(null), confirmed = useRef(new Map<string, number>()), queue = useRef(Promise.resolve(true)), busy = useRef(false), [locked, setLocked] = useState(false), pendingSave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // prettier-ignore
  function setBusy(value: boolean) { busy.current = value; setLocked(value); }

  // prettier-ignore
  function commit(next: DraftWorkspace): Promise<boolean> {
    clearTimeout(pendingSave.current); current.current = next; setWorkspace(next); setStatus('saving');
    const operation = queue.current.then(async () => {
      const result = await writeWorkspace(next, confirmed.current.get(next.workspaceId) ?? null);
      if (result.ok) {
        confirmed.current.set(next.workspaceId, next.generation);
        setAvailable((all) => [...all.filter((item) => item.workspaceId !== next.workspaceId), next]);
        try { sessionStorage.setItem(POINTER, next.workspaceId); } catch { /* The workspace itself is already durable. */ }
      }
      if (current.current === next) {
        setStatus(result.ok ? 'saved' : 'error');
        setError(result.ok ? null : 'code' in result && result.code === 'generation_conflict'
          ? 'Outra sessão alterou esta cópia. Baixe suas alterações e restaure como uma cópia independente.'
          : 'Não foi possível salvar. Suas alterações continuam na memória desta página. Baixe uma cópia antes de sair.');
      }
      return result.ok;
    });
    queue.current = operation; return operation;
  }

  useEffect(() => {
    let active = true;
    // Copy-on-write resume of a previous session; original bytes stay intact.
    // prettier-ignore
    async function resume(next: DraftWorkspace): Promise<void> {
      const result = await writeWorkspace(next, null);
      if (!active) return;
      if (result.ok) { confirmed.current.set(next.workspaceId, 0); sessionStorage.setItem(POINTER, next.workspaceId); }
      current.current = next; setWorkspace(next); setStatus(result.ok ? 'saved' : 'error');
    }
    // One-time legacy migration is copy-on-write: without a base payload the raw
    // bytes are only offered for explicit recovery, never overwritten.
    // prettier-ignore
    async function migrateLegacy(raw: string): Promise<void> {
      try {
        let legacy = importDraftFromJson(raw);
        if (!hasDashboardChanges(legacy)) return setStatus('ready');
        if (!legacy.basePayload) {
          const backup = await loadDraftFromIndexedDb();
          if (backup?.basePayload && backup.updatedAt === legacy.updatedAt) legacy = backup;
        }
        if (!active) return;
        if (!legacy.basePayload) return setRecovery(raw);
        const next = createWorkspace(legacy.basePayload, legacy.baseRevision ?? null);
        next.local = mergeDashboardDrafts(legacy.basePayload, legacy);
        next.legacyOriginal = raw;
        const result = await writeWorkspace(next, null);
        if (!active) return;
        if (result.ok) { confirmed.current.set(next.workspaceId, 0); sessionStorage.setItem(POINTER, next.workspaceId); }
        else setError('Não foi possível confirmar a migração. O rascunho original foi preservado.');
        current.current = next; setWorkspace(next); setStatus(result.ok ? 'saved' : 'error');
      } catch { setRecovery(raw); }
    }
    // prettier-ignore
    void (async () => {
      try {
        const workspaces = await listWorkspaces();
        if (!active) return;
        setAvailable(workspaces);
        const pointer = sessionStorage.getItem(POINTER);
        const resumable = workspaces.find((item) => item.workspaceId === pointer && !item.archived);
        if (resumable) return void (await resume(importWorkspace(JSON.stringify(resumable))));
        let raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
        if (!raw) { const backup = await loadDraftFromIndexedDb(); if (!active) return; if (backup && hasDashboardChanges(backup)) raw = JSON.stringify(backup); }
        if (raw && workspaces.some((w) => w.legacyOriginal === raw)) raw = null;
        if (raw) return void (await migrateLegacy(raw));
        setStatus('ready');
      } catch {
        if (active) {
          try { setRecovery(localStorage.getItem(DASHBOARD_STORAGE_KEY)); } catch { /* Storage may be unavailable. */ }
          setStatus('error');
          setError('Não foi possível abrir o armazenamento de rascunhos. Tente novamente ou restaure um arquivo.');
        }
      }
    })();
    // prettier-ignore
    return () => { active = false; };
  }, []);

  /** Checkpoints the open copy, writes `next` as an independent workspace and adopts it. */
  // prettier-ignore
  async function adopt(next: DraftWorkspace, failure: string): Promise<boolean> {
    if (busy.current) return false;
    setBusy(true);
    try {
      if (current.current && !(await checkpoint())) return false;
      const saved = await writeWorkspace(next, null);
      if (!saved.ok) { setError(failure); return false; }
      confirmed.current.set(next.workspaceId, next.generation);
      current.current = next; setWorkspace(next);
      setAvailable((all) => [...all.filter((item) => item.workspaceId !== next.workspaceId), next]);
      try { sessionStorage.setItem(POINTER, next.workspaceId); } catch { /* The workspace itself is already durable. */ }
      setStatus('saved'); setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : failure);
      return false;
    } finally { setBusy(false); }
  }

  // prettier-ignore
  function checkpoint() { return commit(current.current ?? createWorkspace(remote, revision)); }
  // prettier-ignore
  function update(updater: (value: DraftWorkspace) => DraftWorkspace) {
    if (busy.current || status === 'loading' || current.current?.publicationAttempt) return;
    const previous = current.current ?? createWorkspace(remote, revision);
    const next = { ...updater(previous), generation: previous.generation + 1, updatedAt: new Date().toISOString() };
    current.current = next; setWorkspace(next); setStatus('saving');
    clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(() => { if (current.current === next) void commit(next); }, 200);
  }

  // prettier-ignore
  function persist(updater: (value: DraftWorkspace) => DraftWorkspace) {
    const previous = current.current ?? createWorkspace(remote, revision);
    return commit({ ...updater(previous), generation: previous.generation + 1, updatedAt: new Date().toISOString() });
  }

  // prettier-ignore
  function fromLegacy(raw: string): DraftWorkspace | null {
    const legacy = importDraftFromJson(raw);
    if (!legacy.basePayload) return null; // recovery needs an explicit base; no inference
    const next = createWorkspace(legacy.basePayload, legacy.baseRevision ?? null);
    next.local = mergeDashboardDrafts(legacy.basePayload, legacy);
    next.legacyOriginal = raw;
    return next;
  }

  // prettier-ignore
  async function restore(raw: string) {
    let next: DraftWorkspace;
    try {
      const envelope = JSON.parse(raw) as { schemaVersion?: unknown };
      next = envelope?.schemaVersion === 7 ? importWorkspace(raw) : fromLegacy(raw);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível restaurar o arquivo.'); return false; }
    if (next === null) {
      // Original bytes stay untouched, offered for explicit recovery.
      if (current.current && !(await checkpoint())) return false;
      setRecovery(raw); return false;
    }
    return adopt(next, 'Não foi possível salvar a cópia importada. O rascunho aberto não foi substituído.');
  }

  /** Opens a DraftStore envelope preserving its remote draftId and generation. */
  // prettier-ignore
  async function restoreContentDraft(draft: ContentDraft) {
    return adopt(createWorkspaceFromContentDraft(draft), 'Não foi possível abrir o rascunho do assistente. A cópia atual foi preservada.');
  }

  /** Stores the latest remote generation after an update through DraftStore. */
  // prettier-ignore
  async function markMcpDraftSynced(draft: ContentDraft) {
    const previous = current.current;
    if (!previous || previous.mcpDraft?.draftId !== draft.draftId) return false;
    return commit({ ...previous, updatedAt: draft.updatedAt, mcpDraft: { draftId: draft.draftId, generation: draft.generation, candidateDigest: draft.candidateDigest } });
  }

  // prettier-ignore
  async function archive(expected?: DraftWorkspace) {
    if (expected && current.current !== expected) return false;
    const previous = current.current;
    if (!previous) return false;
    const alreadyBusy = busy.current; setBusy(true);
    const archived = { ...previous, archived: true, generation: previous.generation + 1 }, saved = await commit(archived);
    if (!alreadyBusy) setBusy(false);
    if (!saved || current.current !== archived) return false;
    setAvailable((all) => [...all.filter((item) => item.workspaceId !== archived.workspaceId), archived]);
    current.current = null; setWorkspace(null); setStatus('ready');
    try { sessionStorage.removeItem(POINTER); } catch { /* Metadata is optional. */ }
    return true;
  }

  // prettier-ignore
  async function recoverAgainstRemote() {
    if (!recovery || busy.current) return;
    setBusy(true);
    try {
      if (current.current && !(await checkpoint())) return;
      const next = createWorkspace(remote, revision);
      next.legacyOriginal = recovery;
      next.local = mergeDashboardDrafts(remote, importDraftFromJson(recovery));
      if (await commit(next)) setRecovery(null);
    } catch { setError('O arquivo não pôde ser reconstruído. Baixe o original para recuperação manual.'); }
    finally { setBusy(false); }
  }

  // prettier-ignore
  return {
    workspace, current, status, error, setError, available, recovery, update, persist, checkpoint, restore,
    restoreContentDraft, markMcpDraftSynced, archive, recoverAgainstRemote, setBusy, locked,
  };
}

/**
 * Canonical V2 workspace hook (doc 16, promoted final export in INTEGRATION-02). Owns ONE
 * save coordinator per authenticated principal and disposes it on unmount/logout/principal
 * change (late callbacks ignored); keeps an in-memory undo history of at most 20 candidates
 * (undo never decrements the server generation). The repository transport is registered via
 * `configureCanonicalWorkspaceServices` (editorialNeonServices); without it the hook stays
 * inert in `loading`. Services override: deterministic tests.
 */
// prettier-ignore
export interface CanonicalWorkspaceServices {
  repository: DraftRepository; cache?: ReturnType<typeof createLocalDraftCache>;
  now?: () => number; timers?: SaveTimers; isOnline?: () => boolean; tabId?: () => string;
}

let configuredServices: CanonicalWorkspaceServices | null = null;

/** Composition point used by INTEGRATION-01 (editorialNeonServices). */
export function configureCanonicalWorkspaceServices(services: CanonicalWorkspaceServices | null): void {
  configuredServices = services;
}

// prettier-ignore
export interface CanonicalDraftWorkspace {
  state: SaveState; edit(candidate: PublishedContentPayload): void; flush(): Promise<boolean>; refresh(): Promise<void>;
  resolve(decisions: ConflictDecisions): Promise<void>; retry(): Promise<void>; discardLocal(): Promise<void>;
  /** Restores the previous in-memory candidate; the base generation never moves backwards. */
  undo(): void;
}

// Legacy temporary alias (DASHBOARD-03); prefer the final export below.
export const useCanonicalDraftWorkspace = useDraftWorkspace;

export function useDraftWorkspace(principalId: string, override?: CanonicalWorkspaceServices): CanonicalDraftWorkspace {
  const [state, setState] = useState<SaveState>(initialSaveState);
  const servicesRef = useRef<CanonicalWorkspaceServices | null>(null);
  const stateRef = useRef(state);
  // prettier-ignore
  const session = useRef<{ coordinator: SaveCoordinator; editWithHistory(candidate: PublishedContentPayload): void; undo(): void } | null>(null);
  // prettier-ignore
  useEffect(() => { servicesRef.current = override ?? configuredServices; });
  useEffect(() => {
    const services = servicesRef.current;
    if (!services) return; // unconfigured: stays inert in `loading`
    const timers = services.timers ?? window;
    // prettier-ignore
    const coordinator = createSaveCoordinator({
      repository: services.repository, cache: services.cache ?? createLocalDraftCache(),
      now: services.now ?? (() => Date.now()), timers,
      onChange: (next) => { stateRef.current = next; setState(next); },
      isOnline: services.isOnline ?? (() => navigator.onLine), tabId: services.tabId ?? getTabId,
    });
    // prettier-ignore
    const polling = createDraftPolling({ timers, isVisible: () => document.visibilityState === 'visible', onPoll: () => coordinator.refresh() });
    const undoStack: PublishedContentPayload[] = [];
    // prettier-ignore
    session.current = {
      coordinator,
      editWithHistory(candidate) {
        const previous = stateRef.current.local;
        if (previous !== null) { undoStack.push(previous); if (undoStack.length > 20) undoStack.shift(); }
        coordinator.edit(candidate);
      },
      undo() { const previous = undoStack.pop(); if (previous !== undefined) coordinator.edit(previous); },
    };
    const onVisibility = () => polling.setVisibility(document.visibilityState === 'visible');
    // Focus/online: immediate head check, then save the reconciled local when safe.
    // prettier-ignore
    const wake = () => { polling.poke(); if (stateRef.current.phase === 'dirty') void coordinator.flush(); };
    // prettier-ignore
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    void coordinator.load(principalId);
    // prettier-ignore
    return () => {
      window.removeEventListener('focus', wake); window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', onVisibility);
      polling.dispose(); coordinator.dispose(); session.current = null;
    };
  }, [principalId]);
  // prettier-ignore
  return { state, edit: (candidate) => session.current?.editWithHistory(candidate),
    flush: () => session.current?.coordinator.flush() ?? Promise.resolve(false),
    refresh: () => session.current?.coordinator.refresh() ?? Promise.resolve(),
    resolve: (decisions) => session.current?.coordinator.resolve(decisions) ?? Promise.resolve(),
    retry: () => session.current?.coordinator.retry() ?? Promise.resolve(),
    discardLocal: () => session.current?.coordinator.discardLocal() ?? Promise.resolve(), undo: () => session.current?.undo() };
}
