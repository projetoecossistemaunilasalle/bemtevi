import type { FlowNode, ScoreBranchFlowNode } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { Field } from '../components/Field';
import { inputClassSm } from '../components/fieldStyles';
import { getFlowNodeLabel } from './flowDisplay';
import { parseOptionalNavigation } from './flowEditorUtils';

type BranchPatch = Partial<ScoreBranchFlowNode['branches'][number]>;

export interface FlowEditorScoreBranchesProps {
  node: ScoreBranchFlowNode;
  nodes: FlowNode[];
  existingScoreKeys: string[];
  onUpdateScoreBranchNode: (node: ScoreBranchFlowNode, patch: Partial<ScoreBranchFlowNode>) => void;
  onAddScoreBranchRange: (node: ScoreBranchFlowNode) => void;
  onUpdateScoreBranchRange: (node: ScoreBranchFlowNode, branchId: string, patch: BranchPatch) => void;
  onRemoveScoreBranchRange: (node: ScoreBranchFlowNode, branchId: string) => void;
}

export function FlowEditorScoreBranches({
  node,
  nodes,
  existingScoreKeys,
  onUpdateScoreBranchNode,
  onAddScoreBranchRange,
  onUpdateScoreBranchRange,
  onRemoveScoreBranchRange,
}: FlowEditorScoreBranchesProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
      <Field label="Pontuação usada" hint="Use a mesma chave configurada nas opções que somam pontos.">
        <input
          aria-label="Pontuação usada"
          className={inputClassSm}
          value={node.scoreKey}
          onChange={(event) => onUpdateScoreBranchNode(node, { scoreKey: event.target.value })}
        />
      </Field>

      {existingScoreKeys.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-on-surface-variant font-medium">Chaves existentes:</span>
          {existingScoreKeys.map((key) => (
            <button
              key={key}
              type="button"
              className="px-2.5 py-1 text-xs font-label-sm bg-secondary-container text-on-secondary-container hover:bg-secondary-container/85 rounded-md transition-colors"
              onClick={() => onUpdateScoreBranchNode(node, { scoreKey: key })}
            >
              {key}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-label-md text-on-surface">Faixas de redirecionamento</p>
          <Button variant="secondary" size="sm" onClick={() => onAddScoreBranchRange(node)}>
            Adicionar faixa
          </Button>
        </div>

        {node.branches.map((branch) => (
          <div key={branch.id} className="grid gap-2 rounded-lg bg-surface-container-lowest p-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface">Nome da faixa</span>
              <input
                aria-label={`Nome da faixa ${branch.id}`}
                className={inputClassSm}
                value={branch.id}
                onChange={(event) => onUpdateScoreBranchRange(node, branch.id, { id: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface">Destino do resultado</span>
              <select
                aria-label={`Destino de resultado da faixa ${branch.id}`}
                className={inputClassSm}
                value={branch.next}
                onChange={(event) => onUpdateScoreBranchRange(node, branch.id, { next: event.target.value })}
              >
                {nodes.map((targetNode) => (
                  <option key={targetNode.id} value={targetNode.id}>
                    {getFlowNodeLabel(targetNode, nodes)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface">Mínimo</span>
              <input
                type="number"
                aria-label={`Mínimo da faixa ${branch.id}`}
                className={inputClassSm}
                value={branch.min}
                onChange={(event) => onUpdateScoreBranchRange(node, branch.id, { min: Number(event.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface">Máximo</span>
              <input
                type="number"
                aria-label={`Máximo da faixa ${branch.id}`}
                className={inputClassSm}
                value={branch.max}
                onChange={(event) => onUpdateScoreBranchRange(node, branch.id, { max: Number(event.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="font-label-sm text-on-surface">Destino de página após o resultado</span>
              <select
                aria-label={`Destino de página da faixa ${branch.id}`}
                className={inputClassSm}
                value={branch.navigation ?? ''}
                onChange={(event) =>
                  onUpdateScoreBranchRange(node, branch.id, {
                    navigation: parseOptionalNavigation(event.target.value),
                  })
                }
              >
                <option value="">Não abrir página automaticamente</option>
                <option value="/apoio">/apoio — Apoio imediato</option>
                <option value="/contatos">/contatos — Contatos de apoio</option>
                <option value="/educacao">/educacao — Materiais educativos</option>
              </select>
            </label>
            {node.branches.length > 1 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-fit md:col-span-2"
                onClick={() => onRemoveScoreBranchRange(node, branch.id)}
              >
                Remover faixa
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
