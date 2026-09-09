import type { PublishedContentPayload } from '../../app/content/publishedContent';
import type { ConflictDecisions } from '../publishing/semanticDiff';
import type { ContentDraft } from '../draft-sync/contentDraft';

export interface McpDraftLink {
  draftId: string;
  /** Last generation confirmed by the local DraftStore. */
  generation: number;
  candidateDigest: string;
}

export interface ReconciliationSession {
  base: PublishedContentPayload;
  local: PublishedContentPayload;
  remote: { revision: number | null; payload: PublishedContentPayload };
  localGeneration: number;
  decisions: ConflictDecisions;
  candidateOverride?: PublishedContentPayload;
  reviewed?: boolean;
}
export interface PublicationAttempt {
  id: string;
  expectedRevision: number | null;
  candidate: PublishedContentPayload;
  generation: number;
}
export interface DraftWorkspace {
  schemaVersion: 7;
  workspaceId: string;
  generation: number;
  base: { revision: number | null; payload: PublishedContentPayload };
  local: PublishedContentPayload;
  updatedAt: string;
  archived?: boolean;
  reconciliation?: ReconciliationSession;
  publicationAttempt?: PublicationAttempt;
  legacyOriginal?: string;
  /** Present when this workspace is backed by a DraftStore created by MCP. */
  mcpDraft?: McpDraftLink;
}
export type WorkspaceWriteResult = { ok: true } | { ok: false; code: 'storage_unavailable' | 'generation_conflict' };
const DATABASE = 'bemtevi_dashboard_workspaces';

export function createWorkspace(payload: PublishedContentPayload, revision: number | null): DraftWorkspace {
  return {
    schemaVersion: 7,
    workspaceId: crypto.randomUUID(),
    generation: 0,
    base: { revision, payload },
    local: payload,
    updatedAt: new Date().toISOString(),
  };
}

/** Opens an MCP draft without changing its remote identity or generation. */
export function createWorkspaceFromContentDraft(draft: ContentDraft): DraftWorkspace {
  const workspace = createWorkspace(draft.base.payload, draft.base.revision);
  return {
    ...workspace,
    generation: draft.generation,
    local: draft.candidate,
    updatedAt: draft.updatedAt,
    mcpDraft: {
      draftId: draft.draftId,
      generation: draft.generation,
      candidateDigest: draft.candidateDigest,
    },
  };
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('storage_unavailable'));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('workspaces', { keyPath: 'workspaceId' });
      request.result.createObjectStore('checkpoints', { keyPath: ['workspaceId', 'generation'] });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(new Error('storage_unavailable'));
    request.onblocked = () => reject(new Error('storage_unavailable'));
  });
}

export async function writeWorkspace(
  workspace: DraftWorkspace,
  expectedGeneration: number | null,
): Promise<WorkspaceWriteResult> {
  let db: IDBDatabase | undefined;
  try {
    db = await open();
    return await new Promise<WorkspaceWriteResult>((resolve) => {
      const tx = db!.transaction(['workspaces', 'checkpoints'], 'readwrite');
      let conflict = false;
      tx.oncomplete = () => resolve({ ok: true });
      tx.onabort = tx.onerror = () =>
        resolve({ ok: false, code: conflict ? 'generation_conflict' : 'storage_unavailable' });
      const store = tx.objectStore('workspaces');
      const request = store.get(workspace.workspaceId);
      request.onsuccess = () => {
        const previous = request.result as DraftWorkspace | undefined;
        if (
          (previous?.generation ?? null) !== expectedGeneration ||
          (expectedGeneration !== null && workspace.generation < expectedGeneration)
        ) {
          conflict = true;
          tx.abort();
          return;
        }
        // Previous committed generations remain restorable. No quota-driven eviction.
        try {
          store.put(workspace);
          tx.objectStore('checkpoints').put(workspace);
        } catch {
          tx.abort();
        }
      };
    });
  } catch {
    return { ok: false, code: 'storage_unavailable' };
  } finally {
    db?.close();
  }
}

export async function listWorkspaces(): Promise<DraftWorkspace[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readonly');
      const request = tx.objectStore('workspaces').getAll();
      tx.oncomplete = () => resolve(request.result as DraftWorkspace[]);
      tx.onerror = tx.onabort = () => reject(new Error('storage_unavailable'));
    });
  } finally {
    db.close();
  }
}

export async function listWorkspaceCheckpoints(workspaceId: string): Promise<DraftWorkspace[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('checkpoints', 'readonly');
      const request = tx
        .objectStore('checkpoints')
        .getAll(IDBKeyRange.bound([workspaceId, 0], [workspaceId, Number.MAX_SAFE_INTEGER]));
      tx.oncomplete = () => resolve(request.result as DraftWorkspace[]);
      tx.onerror = tx.onabort = () => reject(new Error('storage_unavailable'));
    });
  } finally {
    db.close();
  }
}

export async function deleteArchivedWorkspace(workspaceId: string): Promise<boolean> {
  const db = await open();
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(['workspaces', 'checkpoints'], 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
      const store = tx.objectStore('workspaces');
      const request = store.get(workspaceId);
      request.onsuccess = () => {
        if (!(request.result as DraftWorkspace | undefined)?.archived) {
          tx.abort();
          return;
        }
        store.delete(workspaceId);
        tx.objectStore('checkpoints').delete(
          IDBKeyRange.bound([workspaceId, 0], [workspaceId, Number.MAX_SAFE_INTEGER]),
        );
      };
    });
  } finally {
    db.close();
  }
}

function payloadShape(value: unknown): value is PublishedContentPayload {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    ['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'].every(
      (key) =>
        Array.isArray(record[key]) &&
        (record[key] as unknown[]).every(
          (item) => item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string',
        ),
    ) && typeof record.defaultGroupOrder === 'number'
  );
}

// Structural checks intentionally allow invalid domain content to be recovered and edited.
export function importWorkspace(raw: string): DraftWorkspace {
  const parsed = JSON.parse(raw) as DraftWorkspace;
  if (
    !parsed ||
    parsed.schemaVersion !== 7 ||
    typeof parsed.workspaceId !== 'string' ||
    !Number.isSafeInteger(parsed.generation) ||
    parsed.generation < 0 ||
    !parsed.base ||
    !(parsed.base.revision === null || Number.isSafeInteger(parsed.base.revision)) ||
    !payloadShape(parsed.base.payload) ||
    !payloadShape(parsed.local)
  )
    throw new Error('Arquivo de rascunho inválido ou versão desconhecida. O original foi preservado.');
  if (parsed.reconciliation) {
    const s = parsed.reconciliation;
    if (
      !payloadShape(s.base) ||
      !payloadShape(s.local) ||
      !s.remote ||
      !payloadShape(s.remote.payload) ||
      !(s.remote.revision === null || Number.isSafeInteger(s.remote.revision)) ||
      !s.decisions ||
      typeof s.decisions !== 'object' ||
      !Number.isSafeInteger(s.localGeneration) ||
      (s.candidateOverride !== undefined && !payloadShape(s.candidateOverride))
    )
      throw new Error('Sessão de reconciliação inválida.');
    for (const decision of Object.values(s.decisions))
      if (!decision || typeof decision.present !== 'boolean' || (decision.present && !Object.hasOwn(decision, 'value')))
        throw new Error('Decisão de reconciliação inválida.');
    // An imported file is never proof that its candidate was reviewed here.
    s.reviewed = false;
  }
  if (
    parsed.publicationAttempt &&
    (!payloadShape(parsed.publicationAttempt.candidate) ||
      typeof parsed.publicationAttempt.id !== 'string' ||
      !Number.isSafeInteger(parsed.publicationAttempt.generation))
  )
    throw new Error('Tentativa de publicação inválida.');
  if (
    parsed.mcpDraft &&
    (typeof parsed.mcpDraft.draftId !== 'string' ||
      !parsed.mcpDraft.draftId.trim() ||
      !Number.isSafeInteger(parsed.mcpDraft.generation) ||
      parsed.mcpDraft.generation < 1 ||
      typeof parsed.mcpDraft.candidateDigest !== 'string' ||
      !parsed.mcpDraft.candidateDigest.trim())
  )
    throw new Error('Vínculo com o rascunho do assistente inválido.');
  return {
    ...parsed,
    workspaceId: crypto.randomUUID(),
    generation: 0,
    archived: false,
    updatedAt: new Date().toISOString(),
  };
}
