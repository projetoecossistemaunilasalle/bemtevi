import { Button } from '../../design-system/components/Button';
import {
  describePath,
  type ConflictDecisions,
  type SemanticConflict,
  type ValueSlot,
} from '../publishing/semanticDiff';

/**
 * Conflict review dialog (doc 16 state machine, task INTEGRATION-02).
 *
 * While conflicts remain unresolved, autosave stays suspended and the dialog
 * shows each `Sua alteração` versus `Rascunho atual do BemTeVi`. Manual
 * choices never persist an incomplete candidate: the caller applies decisions
 * through the coordinator's `resolve`, which re-fetches the head and
 * recomputes conflicts before any conditional save.
 */

export interface DraftConflictDialogProps {
  conflicts: SemanticConflict[];
  /** Fingerprinted decisions retained for still-identical conflict IDs. */
  decisions: ConflictDecisions;
  /** Read-only mode keeps the review readable but blocks every action. */
  readOnly?: boolean;
  onDecide(conflictId: string, choice: ValueSlot): void;
  onClearDecision(conflictId: string): void;
  onRetry(): void;
  onDiscardLocal(): void;
}

function describeSlot(slot: ValueSlot): string {
  if (!slot.present) return 'Ausente (removido)';
  const value = slot.value;
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function DraftConflictDialog({
  conflicts,
  decisions,
  readOnly = false,
  onDecide,
  onClearDecision,
  onRetry,
  onDiscardLocal,
}: DraftConflictDialogProps) {
  const pending = conflicts.filter((conflict) => !decisions[conflict.id]);
  const resolved = conflicts.length - pending.length;
  return (
    <section
      role="dialog"
      aria-label="Resolver conflitos de edição"
      className="flex flex-col gap-4 rounded-lg border border-error/35 bg-error-container/40 p-5 text-on-surface"
    >
      <h2 className="font-headline-sm">Conflito: revise as alterações</h2>
      <p className="max-w-[75ch] font-body-md text-on-surface-variant">
        Outra pessoa editou o rascunho ao mesmo tempo que você. O salvamento automático fica pausado enquanto houver
        escolhas pendentes. Suas alterações continuam salvas neste dispositivo e nada é publicado sem sua decisão.
      </p>
      <p role="status">
        {resolved} resolvido(s) · {pending.length} pendente(s)
      </p>
      {conflicts.map((conflict) => {
        const decision = decisions[conflict.id];
        return (
          <section
            key={conflict.id}
            data-conflict-pending={!decision}
            className="flex min-w-0 flex-col gap-3 border-b border-outline-variant py-4"
          >
            <h3 className="break-words font-label-md [overflow-wrap:anywhere]">
              {describePath(conflict.path)} · {decision ? 'Resolvido' : 'Pendente'}
            </h3>
            <div className="grid min-w-0 gap-4 lg:grid-cols-3">
              <div className="min-w-0">
                <h4 className="font-label-md">Sua alteração</h4>
                <pre className="mt-1 whitespace-pre-wrap break-words font-body-sm [overflow-wrap:anywhere]">
                  {describeSlot(conflict.local)}
                </pre>
              </div>
              <div className="min-w-0">
                <h4 className="font-label-md">Rascunho atual do BemTeVi</h4>
                <pre className="mt-1 whitespace-pre-wrap break-words font-body-sm [overflow-wrap:anywhere]">
                  {describeSlot(conflict.remote)}
                </pre>
              </div>
              <div className="min-w-0">
                <h4 className="font-label-md">Resultado</h4>
                <pre className="mt-1 whitespace-pre-wrap break-words font-body-sm [overflow-wrap:anywhere]">
                  {describeSlot(decision ?? conflict.local)}
                </pre>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" disabled={readOnly} onClick={() => onDecide(conflict.id, conflict.local)}>
                Usar minha alteração
              </Button>
              <Button variant="secondary" disabled={readOnly} onClick={() => onDecide(conflict.id, conflict.remote)}>
                Usar rascunho atual do BemTeVi
              </Button>
              {decision && (
                <Button variant="secondary" disabled={readOnly} onClick={() => onClearDecision(conflict.id)}>
                  Desfazer escolha
                </Button>
              )}
            </div>
          </section>
        );
      })}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={readOnly || pending.length > 0} onClick={onRetry}>
          Tentar salvar novamente
        </Button>
        <Button variant="secondary" disabled={readOnly} onClick={onDiscardLocal}>
          Descartar minhas alterações locais
        </Button>
      </div>
    </section>
  );
}
