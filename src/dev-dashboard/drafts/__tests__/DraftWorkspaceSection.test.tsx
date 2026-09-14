import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ConflictDecisions, PublishedContentPayload } from '@bemtevi/content-core';
import type { CanonicalDraftWorkspace } from '../../draft-storage/useDraftWorkspace';
import type { SaveState } from '../../drafts/saveTransitions';
import { DraftWorkspaceSection } from '../DraftWorkspaceSection';

/**
 * V2 workspace section behavior (doc 16): loading gate, save labels through
 * the shared component, undo/discard actions, recovery download while
 * unsynced, conflict dialog wiring, and the read-only kill flag.
 */

function stateOf(overrides: Partial<SaveState>): SaveState {
  return {
    phase: 'clean',
    base: null,
    local: null,
    conflicts: [],
    error: null,
    cacheAvailable: true,
    ...overrides,
  };
}

function workspaceOf(state: SaveState, methods: Partial<CanonicalDraftWorkspace> = {}): CanonicalDraftWorkspace {
  return {
    state,
    edit: vi.fn(),
    flush: vi.fn().mockResolvedValue(true),
    refresh: vi.fn().mockResolvedValue(undefined),
    resolve: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn().mockResolvedValue(undefined),
    discardLocal: vi.fn().mockResolvedValue(undefined),
    undo: vi.fn(),
    ...methods,
  } as CanonicalDraftWorkspace;
}

const localPayload = { flows: [] } as unknown as PublishedContentPayload;

function renderSection(
  workspace: CanonicalDraftWorkspace,
  overrides: {
    readOnly?: boolean;
    decisions?: ConflictDecisions;
    onDecide?: (id: string, choice: import('@bemtevi/content-core').ValueSlot) => void;
    onClearDecision?: (id: string) => void;
    onDownloadRecovery?: () => void;
  } = {},
) {
  const props = {
    workspace,
    onDownloadRecovery: overrides.onDownloadRecovery ?? vi.fn(),
    readOnly: overrides.readOnly ?? false,
    decisions: overrides.decisions ?? {},
    onDecide: overrides.onDecide ?? vi.fn(),
    onClearDecision: overrides.onClearDecision ?? vi.fn(),
  };
  return { ...render(<DraftWorkspaceSection {...props} />), props };
}

describe('DraftWorkspaceSection (V2 draft surface)', () => {
  it('shows the loading gate until the draft is ready', () => {
    renderSection(workspaceOf(stateOf({ phase: 'loading' })));
    expect(screen.getByText('Carregando rascunho...')).toBeInTheDocument();
  });

  it('renders the exact clean label through the shared status component', () => {
    renderSection(workspaceOf(stateOf({ phase: 'clean' })));
    expect(screen.getByText('Salvo no BemTeVi')).toBeInTheDocument();
  });

  it('offers recovery download while unsynced but not when clean', () => {
    const clean = renderSection(workspaceOf(stateOf({ phase: 'clean' })));
    expect(clean.queryByRole('button', { name: 'Baixar cópia do rascunho' })).not.toBeInTheDocument();
    const dirty = renderSection(workspaceOf(stateOf({ phase: 'dirty', local: localPayload })));
    expect(dirty.getByRole('button', { name: 'Baixar cópia do rascunho' })).toBeInTheDocument();
  });

  it('exposes undo and confirm-gated discard for a local candidate', async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    const discardLocal = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      renderSection(workspaceOf(stateOf({ phase: 'dirty', local: localPayload }), { undo, discardLocal }));
      await user.click(screen.getByRole('button', { name: 'Desfazer última alteração' }));
      expect(undo).toHaveBeenCalledTimes(1);
      await user.click(screen.getByRole('button', { name: 'Descartar alterações locais' }));
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(discardLocal).toHaveBeenCalledTimes(1);
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('does not discard without admin confirmation', async () => {
    const user = userEvent.setup();
    const discardLocal = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      renderSection(workspaceOf(stateOf({ phase: 'dirty', local: localPayload }), { discardLocal }));
      await user.click(screen.getByRole('button', { name: 'Descartar alterações locais' }));
      expect(discardLocal).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('offers retry after an error', () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    renderSection(workspaceOf(stateOf({ phase: 'error', error: { code: 'unavailable' } }), { retry }));
    expect(screen.getByRole('button', { name: 'Tentar salvar novamente' })).toBeInTheDocument();
  });

  it('renders the conflict dialog with decisions wired to the route callbacks', async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    const state = stateOf({
      phase: 'conflict',
      local: localPayload,
      conflicts: [
        {
          id: 'c1',
          path: [
            { kind: 'field', key: 'contacts' },
            { kind: 'record', id: 'contact-one' },
            { kind: 'field', key: 'name' },
          ],
          base: { present: true, value: 'Original' },
          local: { present: true, value: 'Local' },
          remote: { present: true, value: 'Remoto' },
        },
      ],
    });
    renderSection(workspaceOf(state), { onDecide });
    await user.click(screen.getByRole('button', { name: 'Usar minha alteração' }));
    expect(onDecide).toHaveBeenCalledWith('c1', { present: true, value: 'Local' });
  });

  it('blocks every mutation action and states the kill flag in read-only mode', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      const state = stateOf({
        phase: 'conflict',
        local: localPayload,
        conflicts: [
          {
            id: 'c1',
            path: [
              { kind: 'field', key: 'contacts' },
              { kind: 'record', id: 'contact-one' },
              { kind: 'field', key: 'name' },
            ],
            base: { present: true, value: 'Original' },
            local: { present: true, value: 'Local' },
            remote: { present: true, value: 'Remoto' },
          },
        ],
      });
      renderSection(workspaceOf(state), { readOnly: true });
      expect(screen.getByText(/A edição está temporariamente desativada neste painel/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Usar minha alteração' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Descartar minhas alterações locais' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Desfazer última alteração' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Baixar cópia do rascunho' })).toBeEnabled();
    } finally {
      confirmSpy.mockRestore();
    }
  });
});
