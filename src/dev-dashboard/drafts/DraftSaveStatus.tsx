import { saveStatusLabel } from '../drafts/saveTransitions';
import type { SaveState } from '../drafts/saveTransitions';

/**
 * Exact PT-BR save-state label surface (doc 16, task INTEGRATION-02).
 *
 * The labels come verbatim from `saveTransitions.saveStatusLabel` — the same
 * transition table the coordinator and its tests use — so the UI can never
 * drift from the frozen copy:
 *
 * - dirty `Alterações pendentes`; saving `Salvando...`;
 * - clean `Salvo no BemTeVi`; offline with cache `Sem conexão. Salvo neste dispositivo`;
 * - conflict `Conflito: revise as alterações`; error `Não foi possível salvar`;
 * - cache failure NEVER claims a local save:
 *   `Alterações apenas nesta aba. Baixe uma cópia antes de sair.`
 */

export interface DraftSaveStatusProps {
  state: SaveState;
}

export function DraftSaveStatus({ state }: DraftSaveStatusProps) {
  const label = saveStatusLabel(state);
  const alerting = state.phase === 'conflict' || state.phase === 'error';
  return (
    <p
      role={alerting ? 'alert' : 'status'}
      aria-live={alerting ? 'assertive' : 'polite'}
      className="font-body-md text-on-surface-variant"
    >
      {label}
    </p>
  );
}
