import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraftWorkspace } from '../draft-storage/useDraftWorkspace';
import { createWorkspace, listWorkspaces, writeWorkspace } from '../draft-storage/workspace';
import { createEmptyDashboardDraftState, DASHBOARD_STORAGE_KEY } from '../draft-storage/dashboardStorage';
const payload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};
vi.mock('../draft-storage/workspace', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../draft-storage/workspace')>()),
  listWorkspaces: vi.fn(),
  writeWorkspace: vi.fn(),
}));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.mocked(listWorkspaces).mockResolvedValue([]);
  vi.mocked(writeWorkspace).mockResolvedValue({ ok: true });
});
describe('workspace lifecycle', () => {
  it('keeps B and L fixed when the remote changes', async () => {
    const { result, rerender } = renderHook(({ remote }) => useDraftWorkspace(remote, 3), {
      initialProps: { remote: payload },
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.update((w) => ({ ...w, local: { ...w.local, defaultGroupOrder: 2 } })));
    await act(async () => {
      await result.current.checkpoint();
    });
    rerender({ remote: { ...payload, defaultGroupOrder: 7 } });
    expect(result.current.workspace?.base.payload).toEqual(payload);
    expect(result.current.workspace?.local.defaultGroupOrder).toBe(2);
  });
  it('preserves unsaved memory and prevents import when its checkpoint fails', async () => {
    const { result } = renderHook(() => useDraftWorkspace(payload, 3));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.update((w) => ({ ...w, local: { ...w.local, defaultGroupOrder: 2 } })));
    vi.mocked(writeWorkspace).mockResolvedValue({ ok: false, code: 'storage_unavailable' });
    let restored: boolean;
    await act(async () => {
      restored = await result.current.restore(JSON.stringify(createWorkspace(payload, 3)));
    });
    expect(restored!).toBe(false);
    expect(result.current.status).toBe('error');
    expect(result.current.workspace?.local.defaultGroupOrder).toBe(2);
    expect(result.current.error).not.toContain('cópia de segurança está');
  });
  it('preserves raw legacy bytes and requires explicit recovery when B is missing', async () => {
    const legacy = { ...createEmptyDashboardDraftState(), defaultGroupOrder: 2 };
    const raw = JSON.stringify(legacy);
    localStorage.setItem(DASHBOARD_STORAGE_KEY, raw);
    const { result } = renderHook(() => useDraftWorkspace(payload, 3));
    await waitFor(() => expect(result.current.recovery).toBe(raw));
    expect(result.current.workspace).toBeNull();
    expect(writeWorkspace).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.recoverAgainstRemote();
    });
    expect(result.current.workspace?.legacyOriginal).toBe(raw);
    expect(result.current.workspace?.local.defaultGroupOrder).toBe(2);
    expect(localStorage.getItem(DASHBOARD_STORAGE_KEY)).toBe(raw);
  });
  it('resumes a persisted reconciliation in an independent workspace', async () => {
    const saved = createWorkspace(payload, 3);
    saved.reconciliation = {
      base: payload,
      local: payload,
      remote: { revision: 4, payload },
      localGeneration: 0,
      decisions: { x: { present: false } },
    };
    vi.mocked(listWorkspaces).mockResolvedValue([saved]);
    sessionStorage.setItem('bemtevi:dashboard:workspace-session', saved.workspaceId);
    const { result } = renderHook(() => useDraftWorkspace(payload, 4));
    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(result.current.workspace?.workspaceId).not.toBe(saved.workspaceId);
    expect(result.current.workspace?.reconciliation?.decisions).toEqual(saved.reconciliation.decisions);
  });
});
