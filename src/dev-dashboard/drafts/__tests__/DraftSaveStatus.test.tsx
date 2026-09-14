import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SaveState } from '../../drafts/saveTransitions';
import { DraftSaveStatus } from '../DraftSaveStatus';

/**
 * Exact doc-16 save-label proof: every phase maps to its frozen PT-BR copy and
 * a failed recovery cache never claims a local save.
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

describe('DraftSaveStatus (exact doc-16 labels)', () => {
  it('shows the dirty label', () => {
    render(<DraftSaveStatus state={stateOf({ phase: 'dirty', local: {} as SaveState['local'] })} />);
    expect(screen.getByText('Alterações pendentes')).toBeInTheDocument();
  });

  it('shows the saving label', () => {
    render(<DraftSaveStatus state={stateOf({ phase: 'saving' })} />);
    expect(screen.getByText('Salvando...')).toBeInTheDocument();
  });

  it('shows the clean label', () => {
    render(<DraftSaveStatus state={stateOf({ phase: 'clean' })} />);
    expect(screen.getByText('Salvo no BemTeVi')).toBeInTheDocument();
  });

  it('shows the offline-with-cache label', () => {
    render(
      <DraftSaveStatus state={stateOf({ phase: 'offline', local: {} as SaveState['local'], cacheAvailable: true })} />,
    );
    expect(screen.getByText('Sem conexão. Salvo neste dispositivo')).toBeInTheDocument();
  });

  it('shows the conflict label', () => {
    render(
      <DraftSaveStatus
        state={stateOf({
          phase: 'conflict',
          conflicts: [{ id: 'c1' } as SaveState['conflicts'][number]],
        })}
      />,
    );
    expect(screen.getByText('Conflito: revise as alterações')).toBeInTheDocument();
  });

  it('shows the error label', () => {
    render(<DraftSaveStatus state={stateOf({ phase: 'error', error: { code: 'unavailable' } })} />);
    expect(screen.getByText('Não foi possível salvar')).toBeInTheDocument();
  });

  it('never claims a local save when the recovery cache failed', () => {
    render(
      <DraftSaveStatus state={stateOf({ phase: 'dirty', cacheAvailable: false, local: {} as SaveState['local'] })} />,
    );
    expect(screen.getByText('Alterações apenas nesta aba. Baixe uma cópia antes de sair.')).toBeInTheDocument();
  });

  it('never claims a local save on cache failure while offline', () => {
    render(
      <DraftSaveStatus state={stateOf({ phase: 'offline', cacheAvailable: false, local: {} as SaveState['local'] })} />,
    );
    expect(screen.getByText('Alterações apenas nesta aba. Baixe uma cópia antes de sair.')).toBeInTheDocument();
  });
});
