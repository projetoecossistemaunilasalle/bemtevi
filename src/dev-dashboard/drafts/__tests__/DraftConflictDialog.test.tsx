import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ConflictDecisions, SemanticConflict } from '@bemtevi/content-core';
import { DraftConflictDialog } from '../DraftConflictDialog';

/**
 * Conflict review semantics (doc 16 state machine): `Sua alteração` versus
 * `Rascunho atual do BemTeVi`, per-conflict decision/clear, retry disabled
 * while conflicts remain pending, read-only blocks every action.
 */

function conflict(id: string, local: string, remote: string): SemanticConflict {
  return {
    id,
    path: [
      { kind: 'field', key: 'contacts' },
      { kind: 'record', id: 'contact-one' },
      { kind: 'field', key: 'name' },
    ],
    base: { present: true, value: 'Nome original' },
    local: { present: true, value: local },
    remote: { present: true, value: remote },
  };
}

function renderDialog(
  overrides: {
    conflicts?: SemanticConflict[];
    decisions?: ConflictDecisions;
    readOnly?: boolean;
    onDecide?: (id: string, choice: import('@bemtevi/content-core').ValueSlot) => void;
    onClearDecision?: (id: string) => void;
    onRetry?: () => void;
    onDiscardLocal?: () => void;
  } = {},
) {
  const props = {
    conflicts: overrides.conflicts ?? [conflict('c1', 'Minha alteração', 'Alteração do servidor')],
    decisions: overrides.decisions ?? {},
    readOnly: overrides.readOnly ?? false,
    onDecide: overrides.onDecide ?? vi.fn(),
    onClearDecision: overrides.onClearDecision ?? vi.fn(),
    onRetry: overrides.onRetry ?? vi.fn(),
    onDiscardLocal: overrides.onDiscardLocal ?? vi.fn(),
  };
  return { ...render(<DraftConflictDialog {...props} />), props };
}

describe('DraftConflictDialog (doc 16 conflict review)', () => {
  it('shows the local versus current-draft values per conflict', () => {
    renderDialog();
    expect(screen.getByText('Conflito: revise as alterações')).toBeInTheDocument();
    expect(screen.getAllByText('Minha alteração').length).toBeGreaterThan(0);
    expect(screen.getByText('Alteração do servidor')).toBeInTheDocument();
    expect(screen.getByText('Rascunho atual do BemTeVi')).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === '0 resolvido(s) · 1 pendente(s)'),
    ).toBeInTheDocument();
  });

  it('decides a conflict with the local value and can undo the choice', async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    const onClearDecision = vi.fn();
    const decisions: ConflictDecisions = {};
    const { rerender } = renderDialog({ onDecide, onClearDecision, decisions });

    await user.click(screen.getByRole('button', { name: 'Usar minha alteração' }));
    expect(onDecide).toHaveBeenCalledWith('c1', { present: true, value: 'Minha alteração' });

    decisions.c1 = { present: true, value: 'Minha alteração' };
    rerender(
      <DraftConflictDialog
        conflicts={[conflict('c1', 'Minha alteração', 'Alteração do servidor')]}
        decisions={decisions}
        onDecide={onDecide}
        onClearDecision={onClearDecision}
        onRetry={vi.fn()}
        onDiscardLocal={vi.fn()}
      />,
    );
    expect(
      screen.getByText((_, element) => element?.textContent === '1 resolvido(s) · 0 pendente(s)'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desfazer escolha' }));
    expect(onClearDecision).toHaveBeenCalledWith('c1');
  });

  it('blocks retry while conflicts are pending', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Tentar salvar novamente' })).toBeDisabled();
  });

  it('enables retry once every conflict has a decision', () => {
    renderDialog({
      decisions: { c1: { present: true, value: 'Minha alteração' } },
    });
    expect(screen.getByRole('button', { name: 'Tentar salvar novamente' })).toBeEnabled();
  });

  it('blocks every action in read-only mode while keeping the review readable', () => {
    renderDialog({ readOnly: true });
    expect(screen.getByText('Conflito: revise as alterações')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar minha alteração' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Usar rascunho atual do BemTeVi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descartar minhas alterações locais' })).toBeDisabled();
  });

  it('offers explicit discard-local with the coordinator callback', async () => {
    const user = userEvent.setup();
    const onDiscardLocal = vi.fn();
    renderDialog({ onDiscardLocal });
    await user.click(screen.getByRole('button', { name: 'Descartar minhas alterações locais' }));
    expect(onDiscardLocal).toHaveBeenCalledTimes(1);
  });
});
