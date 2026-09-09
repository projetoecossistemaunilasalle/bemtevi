import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWorkspace,
  createWorkspaceFromContentDraft,
  importWorkspace,
  writeWorkspace,
} from '../draft-storage/workspace';
import type { DraftWorkspace } from '../draft-storage/workspace';
import type { ContentDraft } from '../draft-sync/contentDraft';
const payload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};

function database(previous?: DraftWorkspace) {
  const get = { result: previous, onsuccess: null as null | (() => void) };
  const store = { get: vi.fn(() => get), put: vi.fn() };
  const tx = {
    objectStore: vi.fn(() => store),
    oncomplete: null as null | (() => void),
    onerror: null as null | (() => void),
    onabort: null as null | (() => void),
    abort: vi.fn(() => tx.onabort?.()),
  };
  const db = { transaction: vi.fn(() => tx), close: vi.fn() };
  const request = { result: db, onsuccess: null as null | (() => void) };
  vi.stubGlobal('indexedDB', {
    open: () => {
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  });
  return { get, store, tx, db };
}

afterEach(() => vi.unstubAllGlobals());
describe('workspace repository', () => {
  it('preserva draftId e geração ao abrir um rascunho criado pelo MCP', () => {
    const draft = {
      schemaVersion: 1,
      draftId: 'mcp-draft',
      generation: 7,
      base: { revision: 3, digest: 'base', payload },
      candidate: payload,
      candidateDigest: 'candidate',
      validation: { valid: true, issues: [] },
      createdAt: '2026-09-09T12:00:00.000Z',
      updatedAt: '2026-09-09T12:01:00.000Z',
    } satisfies ContentDraft;

    const workspace = createWorkspaceFromContentDraft(draft);

    expect(workspace.generation).toBe(7);
    expect(workspace.mcpDraft).toEqual({ draftId: 'mcp-draft', generation: 7, candidateDigest: 'candidate' });
    expect(workspace.base.revision).toBe(3);
  });

  it('does not confirm a successful request before transaction completion', async () => {
    const mock = database();
    let finished = false;
    const promise = writeWorkspace(createWorkspace(payload, null), null).then((result) => {
      finished = true;
      return result;
    });
    await vi.waitFor(() => expect(mock.store.get).toHaveBeenCalled());
    mock.get.onsuccess!();
    await Promise.resolve();
    expect(mock.store.put).toHaveBeenCalledTimes(2);
    expect(finished).toBe(false);
    mock.tx.oncomplete!();
    expect(await promise).toEqual({ ok: true });
    expect(mock.db.close).toHaveBeenCalled();
  });
  it('reports abort even after the put request was accepted', async () => {
    const mock = database();
    const promise = writeWorkspace(createWorkspace(payload, null), null);
    await vi.waitFor(() => expect(mock.store.get).toHaveBeenCalled());
    mock.get.onsuccess!();
    mock.tx.onabort!();
    expect(await promise).toEqual({ ok: false, code: 'storage_unavailable' });
    expect(mock.db.close).toHaveBeenCalled();
  });
  it('rejects stale generations within the same transaction without a write', async () => {
    const workspace = createWorkspace(payload, 3);
    const mock = database({ ...workspace, generation: 5 });
    const promise = writeWorkspace({ ...workspace, generation: 4 }, 3);
    await vi.waitFor(() => expect(mock.store.get).toHaveBeenCalled());
    mock.get.onsuccess!();
    expect(await promise).toEqual({ ok: false, code: 'generation_conflict' });
    expect(mock.store.put).not.toHaveBeenCalled();
  });
  it('reports unavailable storage rather than pretending a backup exists', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await writeWorkspace(createWorkspace(payload, null), null)).toEqual({
      ok: false,
      code: 'storage_unavailable',
    });
  });
  it('exports all snapshots and decisions and imports to a separate identity', () => {
    const workspace = createWorkspace(payload, 3);
    workspace.reconciliation = {
      base: payload,
      local: payload,
      remote: { revision: 4, payload },
      localGeneration: 0,
      decisions: { field: { present: false } },
      reviewed: true,
    };
    const restored = importWorkspace(JSON.stringify(workspace));
    expect(restored.workspaceId).not.toBe(workspace.workspaceId);
    expect(restored.base).toEqual(workspace.base);
    expect(restored.reconciliation?.decisions).toEqual({ field: { present: false } });
    expect(restored.reconciliation?.reviewed).toBe(false);
    expect(workspace.reconciliation.reviewed).toBe(true);
  });
  it('rejects corrupt and unknown envelopes without converting them to empty drafts', () => {
    for (const raw of [
      '{',
      '{}',
      JSON.stringify({ ...createWorkspace(payload, null), schemaVersion: 8 }),
      JSON.stringify({ ...createWorkspace(payload, null), local: null }),
    ])
      expect(() => importWorkspace(raw)).toThrow();
  });
});
