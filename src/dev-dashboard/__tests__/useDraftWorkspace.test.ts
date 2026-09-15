import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { configureCanonicalWorkspaceServices, useDraftWorkspace } from '../draft-storage/useDraftWorkspace';

const payload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};
afterEach(() => {
  configureCanonicalWorkspaceServices(null);
});

describe('canonical draft workspace', () => {
  it('stays inert until canonical services are configured', async () => {
    const { result } = renderHook(() => useDraftWorkspace('admin-1'));

    await waitFor(() => expect(result.current.state.phase).toBe('loading'));
    expect(result.current.state.base).toBeNull();
    expect(result.current.state.local).toBeNull();
    await expect(result.current.flush()).resolves.toBe(false);
    act(() => result.current.edit(payload));
    expect(result.current.state.local).toBeNull();
  });

  it('does not read browser storage as a draft or recovery source', async () => {
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(payload));
    sessionStorage.setItem('bemtevi:dashboard:workspace-session', 'legacy-workspace');

    const { result } = renderHook(() => useDraftWorkspace('admin-1'));

    await waitFor(() => expect(result.current.state.phase).toBe('loading'));
    expect(result.current.state.local).toBeNull();
  });
});
