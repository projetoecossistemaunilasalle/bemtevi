import { useEffect } from 'react';
import { Button } from '../../design-system/components/Button';
import type { ConflictDecisions, ValueSlot } from '@bemtevi/content-core';
import type { CanonicalDraftWorkspace } from '../draft-storage/useDraftWorkspace';
import { DraftSaveStatus } from './DraftSaveStatus';
import { DraftConflictDialog } from './DraftConflictDialog';

/**
 * V2 draft workspace section (doc 16, task INTEGRATION-02).
 *
 * Presentation-only composition over the promoted `useDraftWorkspace` state:
 * exact save labels (`DraftSaveStatus`), the conflict review dialog while
 * unresolved conflicts suspend autosave (decisions go to the coordinator's
 * `resolve`, which re-fetches the head and recomputes conflicts before any
 * conditional save), local undo (in-memory, at most 20 candidates — the
 * server generation never moves backwards), discard-local with confirmation,
 * recovery download while unsynced, and a beforeunload warning while
 * dirty/offline/error/conflict/saving.
 */

export interface DraftWorkspaceSectionProps {
  workspace: CanonicalDraftWorkspace;
  /** Recovery download while local edits are not safely stored. */
  onDownloadRecovery(): void;
  readOnly?: boolean;
  /** Fingerprinted decisions currently reflected by the caller. */
  decisions?: ConflictDecisions;
  onDecide(conflictId: string, choice: ValueSlot): void;
  onClearDecision(conflictId: string): void;
}

export function DraftWorkspaceSection({
  workspace,
  onDownloadRecovery,
  readOnly = false,
  decisions = {},
  onDecide,
  onClearDecision,
}: DraftWorkspaceSectionProps) {
  const { state } = workspace;
  const unsynced =
    state.phase === 'dirty' ||
    state.phase === 'saving' ||
    state.phase === 'offline' ||
    state.phase === 'error' ||
    state.phase === 'conflict';

  // beforeunload warning while unsynced (doc 16).
  useEffect(() => {
    if (!unsynced) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsynced]);

  if (state.phase === 'loading') {
    return (
      <p role="status" className="font-body-md text-on-surface-variant">
        Carregando rascunho...
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Estado do rascunho">
      <DraftSaveStatus state={state} />
      {readOnly && (
        <p role="status" className="max-w-[75ch] font-body-md text-on-surface-variant">
          A edição está temporariamente desativada neste painel. Você ainda pode consultar o conteúdo, comparar
          alterações e baixar uma cópia para recuperação.
        </p>
      )}
      {unsynced && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onDownloadRecovery}>
            Baixar cópia do rascunho
          </Button>
        </div>
      )}
      {state.phase === 'error' && !readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void workspace.retry()}>
            Tentar salvar novamente
          </Button>
        </div>
      )}
      {state.local !== null && !readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => workspace.undo()}>
            Desfazer última alteração
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (window.confirm('Descartar suas alterações locais e adotar o rascunho atual do BemTeVi?')) {
                void workspace.discardLocal();
              }
            }}
          >
            Descartar alterações locais
          </Button>
        </div>
      )}
      {state.phase === 'conflict' && state.conflicts.length > 0 && (
        <DraftConflictDialog
          conflicts={state.conflicts}
          decisions={decisions}
          readOnly={readOnly}
          onDecide={onDecide}
          onClearDecision={onClearDecision}
          onRetry={() => void workspace.retry()}
          onDiscardLocal={() => void workspace.discardLocal()}
        />
      )}
    </section>
  );
}
