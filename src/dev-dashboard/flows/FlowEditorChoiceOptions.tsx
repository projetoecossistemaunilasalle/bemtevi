import { AlertTriangle, ArrowRight, Settings } from 'lucide-react';
import type { ChoiceFlowNode, FlowNode } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { inputClassSm } from '../components/fieldStyles';
import { getFlowNodeLabel } from './flowDisplay';

type ChoiceOptionPatch = Partial<ChoiceFlowNode['options'][number]>;

export interface FlowEditorChoiceOptionsProps {
  node: ChoiceFlowNode;
  nodes: FlowNode[];
  stepLabel: string;
  onAddOption: (node: ChoiceFlowNode) => void;
  onOpenOptionEdit: (node: ChoiceFlowNode, optionId: string) => void;
  onUpdateChoiceOption: (node: ChoiceFlowNode, optionId: string, patch: ChoiceOptionPatch) => void;
}

export function FlowEditorChoiceOptions({
  node,
  nodes,
  stepLabel,
  onAddOption,
  onOpenOptionEdit,
  onUpdateChoiceOption,
}: FlowEditorChoiceOptionsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-label-md text-on-surface">Opções</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onAddOption(node)}
          aria-label={`Adicionar opção na ${stepLabel}`}
        >
          Adicionar opção nesta etapa
        </Button>
      </div>
      {node.options.map((option, optionIndex) => (
        <div key={option.id} className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-3">
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="font-label-sm text-on-surface">Texto da opção</span>
              <input
                aria-label={`Texto da opção ${optionIndex + 1} da ${stepLabel}`}
                className={inputClassSm}
                value={option.label}
                onChange={(event) => onUpdateChoiceOption(node, option.id, { label: event.target.value })}
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenOptionEdit(node, option.id)}
              aria-label={`Ações e pontuação da opção ${optionIndex + 1} da ${stepLabel}`}
            >
              Ações e pontuação
              <Settings size={16} aria-hidden="true" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {option.effects?.some((effect) => effect.kind === 'deferred_safety') && (
              <span className="rounded bg-error-container px-2 py-0.5 text-xs font-label-sm text-on-error-container">
                [<AlertTriangle size={12} className="inline" aria-hidden="true" /> Segurança]
              </span>
            )}
            {option.effects?.some((effect) => effect.kind === 'score') && (
              <span className="rounded bg-secondary-container px-2 py-0.5 text-xs font-label-sm text-on-secondary-container">
                {`[+${option.effects.find((e) => e.kind === 'score')?.value ?? 1} ponto(s)]`}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded bg-primary px-3 py-2 text-on-primary font-label-sm">
            <span className="flex items-center gap-1.5">
              <ArrowRight size={14} aria-hidden="true" />
              Destino principal:
            </span>
            <select
              aria-label={optionIndex === 0 ? 'Ação principal da opção' : `Ação da opção ${optionIndex + 1}`}
              className={`${inputClassSm} text-on-surface bg-surface border-none rounded`}
              value={option.next}
              onChange={(event) => onUpdateChoiceOption(node, option.id, { next: event.target.value })}
            >
              {nodes.map((targetNode) => (
                <option key={targetNode.id} value={targetNode.id}>
                  {getFlowNodeLabel(targetNode, nodes)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
