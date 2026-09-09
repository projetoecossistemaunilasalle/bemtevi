import { useEffect, useRef, useState } from 'react';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { createWorkspace, importWorkspace, listWorkspaces, writeWorkspace, type DraftWorkspace } from './workspace';
import {
  DASHBOARD_STORAGE_KEY,
  hasDashboardChanges,
  importDraftFromJson,
  mergeDashboardDrafts,
} from './dashboardStorage';
import { loadDraftFromIndexedDb } from './draftDb';

const POINTER = 'bemtevi:dashboard:workspace-session';

export function useDraftWorkspace(remote: PublishedContentPayload, revision: number | null) {
  const [workspace, setWorkspace] = useState<DraftWorkspace | null>(null);
  const current = useRef<DraftWorkspace | null>(null);
  const [status, setStatus] = useState<'loading' | 'saving' | 'saved' | 'error' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<DraftWorkspace[]>([]);
  const [recovery, setRecovery] = useState<string | null>(null);
  const confirmed = useRef(new Map<string, number>());
  const queue = useRef(Promise.resolve(true));
  const busy = useRef(false);
  const [locked, setLocked] = useState(false);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function commit(next: DraftWorkspace): Promise<boolean> {
    clearTimeout(pendingSave.current);
    current.current = next;
    setWorkspace(next);
    setStatus('saving');
    const operation = queue.current.then(async () => {
      const result = await writeWorkspace(next, confirmed.current.get(next.workspaceId) ?? null);
      if (result.ok) {
        confirmed.current.set(next.workspaceId, next.generation);
        setAvailable((all) => [...all.filter((item) => item.workspaceId !== next.workspaceId), next]);
        try {
          sessionStorage.setItem(POINTER, next.workspaceId);
        } catch {
          /* The workspace itself is already durable. */
        }
      }
      if (current.current === next) {
        setStatus(result.ok ? 'saved' : 'error');
        const error =
          'code' in result && result.code === 'generation_conflict'
            ? 'Outra sessão alterou esta cópia. Baixe suas alterações e restaure como uma cópia independente.'
            : 'Não foi possível salvar. Suas alterações continuam na memória desta página. Baixe uma cópia antes de sair.';
        setError(result.ok ? null : error);
      }
      return result.ok;
    });
    queue.current = operation;
    return operation;
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const workspaces = await listWorkspaces();
        if (!active) return;
        setAvailable(workspaces);
        const pointer = sessionStorage.getItem(POINTER);
        const resumable = workspaces.find((item) => item.workspaceId === pointer && !item.archived);
        if (resumable) {
          const next = importWorkspace(JSON.stringify(resumable));
          const result = await writeWorkspace(next, null);
          if (!active) return;
          if (result.ok) {
            confirmed.current.set(next.workspaceId, 0);
            sessionStorage.setItem(POINTER, next.workspaceId);
          }
          current.current = next;
          setWorkspace(next);
          setStatus(result.ok ? 'saved' : 'error');
          return;
        }
        let raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
        if (!raw) {
          const backup = await loadDraftFromIndexedDb();
          if (!active) return;
          if (backup && hasDashboardChanges(backup)) raw = JSON.stringify(backup);
        }
        if (raw && workspaces.some((w) => w.legacyOriginal === raw)) raw = null;
        if (raw) {
          try {
            let legacy = importDraftFromJson(raw);
            if (hasDashboardChanges(legacy)) {
              if (!legacy.basePayload) {
                const backup = await loadDraftFromIndexedDb();
                if (backup?.basePayload && backup.updatedAt === legacy.updatedAt) legacy = backup;
              }
              if (!active) return;
              if (legacy.basePayload) {
                const next = createWorkspace(legacy.basePayload, legacy.baseRevision ?? null);
                next.local = mergeDashboardDrafts(legacy.basePayload, legacy);
                next.legacyOriginal = raw;
                // Migration is copy-on-write. The original localStorage bytes remain untouched.
                const result = await writeWorkspace(next, null);
                if (!active) return;
                if (result.ok) {
                  confirmed.current.set(next.workspaceId, 0);
                  sessionStorage.setItem(POINTER, next.workspaceId);
                }
                current.current = next;
                setWorkspace(next);
                setStatus(result.ok ? 'saved' : 'error');
                if (!result.ok) setError('Não foi possível confirmar a migração. O rascunho original foi preservado.');
                return;
              }
              setRecovery(raw);
            }
          } catch {
            setRecovery(raw);
          }
        }
        setStatus('ready');
      } catch {
        if (active) {
          try {
            setRecovery(localStorage.getItem(DASHBOARD_STORAGE_KEY));
          } catch {
            /* Storage may be entirely unavailable. */
          }
          setStatus('error');
          setError('Não foi possível abrir o armazenamento de rascunhos. Tente novamente ou restaure um arquivo.');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function checkpoint() {
    if (current.current) return commit(current.current);
    return commit(createWorkspace(remote, revision));
  }

  function update(updater: (value: DraftWorkspace) => DraftWorkspace) {
    if (busy.current || status === 'loading' || current.current?.publicationAttempt) return;
    const previous = current.current ?? createWorkspace(remote, revision);
    const next = { ...updater(previous), generation: previous.generation + 1, updatedAt: new Date().toISOString() };
    current.current = next;
    setWorkspace(next);
    setStatus('saving');
    clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(() => {
      if (current.current === next) void commit(next);
    }, 200);
  }

  function persist(updater: (value: DraftWorkspace) => DraftWorkspace) {
    const previous = current.current ?? createWorkspace(remote, revision);
    return commit({ ...updater(previous), generation: previous.generation + 1, updatedAt: new Date().toISOString() });
  }

  async function restore(raw: string) {
    if (busy.current) return false;
    setBusy(true);
    try {
      let next: DraftWorkspace;
      const envelope = JSON.parse(raw) as { schemaVersion?: unknown };
      if (envelope?.schemaVersion === 7) next = importWorkspace(raw);
      else {
        const legacy = importDraftFromJson(raw);
        if (!legacy.basePayload) {
          if (current.current && !(await checkpoint())) return false;
          setRecovery(raw);
          return false;
        }
        next = createWorkspace(legacy.basePayload, legacy.baseRevision ?? null);
        next.local = mergeDashboardDrafts(legacy.basePayload, legacy);
        next.legacyOriginal = raw;
      }
      if (current.current && !(await checkpoint())) return false;
      const saved = await writeWorkspace(next, null);
      if (!saved.ok) {
        setError('Não foi possível salvar a cópia importada. O rascunho aberto não foi substituído.');
        return false;
      }
      confirmed.current.set(next.workspaceId, next.generation);
      return await commit(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível restaurar o arquivo.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function archive(expected?: DraftWorkspace) {
    if (expected && current.current !== expected) return false;
    const previous = current.current;
    if (!previous) return false;
    const alreadyBusy = busy.current;
    setBusy(true);
    const archived = { ...previous, archived: true, generation: previous.generation + 1 };
    const saved = await commit(archived);
    if (!alreadyBusy) setBusy(false);
    if (!saved || current.current !== archived) return false;
    setAvailable((all) => [...all.filter((item) => item.workspaceId !== archived.workspaceId), archived]);
    current.current = null;
    setWorkspace(null);
    setStatus('ready');
    try {
      sessionStorage.removeItem(POINTER);
    } catch {
      /* Metadata is optional. */
    }
    return true;
  }

  async function recoverAgainstRemote() {
    if (!recovery || busy.current) return;
    setBusy(true);
    try {
      if (current.current && !(await checkpoint())) return;
      const legacy = importDraftFromJson(recovery);
      const next = createWorkspace(remote, revision);
      next.legacyOriginal = recovery;
      next.local = mergeDashboardDrafts(remote, legacy);
      if (await commit(next)) setRecovery(null);
    } catch {
      setError('O arquivo não pôde ser reconstruído. Baixe o original para recuperação manual.');
    } finally {
      setBusy(false);
    }
  }

  function setBusy(value: boolean) {
    busy.current = value;
    setLocked(value);
  }
  return {
    workspace,
    current,
    status,
    error,
    setError,
    available,
    recovery,
    update,
    persist,
    checkpoint,
    restore,
    archive,
    recoverAgainstRemote,
    setBusy,
    locked,
  };
}
