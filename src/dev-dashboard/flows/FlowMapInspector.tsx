import { useState } from 'react';
import type { FlowNode, GuidedFlow, ChoiceFlowNode, ScoreBranchFlowNode } from '../../domain/flow-engine/types';
import { getFlowNodeTitle, getFlowStartTargetTitle } from './flowDisplay';
import { Button } from '../../design-system/components/Button';

const kindLabels: Record<FlowNode['kind'], string> = {
  choice: 'Escolha',
  result: 'Final',
  score_branch: 'Ramificação',
};

const effectColors: Record<string, string> = {
  score: 'bg-primary-container text-on-primary-container',
  deferred_safety: 'bg-warning-container text-on-warning-container',
  safety_interrupt: 'bg-error-container text-on-error-container',
  flow_start: 'bg-secondary-container text-on-secondary-container',
  navigate: 'bg-surface-container text-on-surface',
  end_flow: 'bg-surface-container text-on-surface',
};

const effectLabels: Record<string, (effect: Record<string, unknown>) => string> = {
  score: (e) => `+${e.value} em ${e.scoreKey}`,
  deferred_safety: (e) => `⚠ segurança adiada → ${e.destination}`,
  safety_interrupt: (e) => `⚠ interrompe → ${e.destination}`,
  flow_start: (e) => `→ fluxo ${e.flowId}`,
  navigate: (e) => `→ ${e.destination}`,
  end_flow: () => 'encerrar',
};

export interface FlowMapInspectorProps {
  node: FlowNode;
  nodes: FlowNode[];
  flows: GuidedFlow[];
  onTextChange: (text: string) => void;
  onRemoveEffect: (optionId: string, effectIndex: number) => void;
  onEditFully: () => void;
  onClose: () => void;
}

export function FlowMapInspector({
  node,
  nodes,
  flows,
  onTextChange,
  onRemoveEffect,
  onEditFully,
  onClose,
}: FlowMapInspectorProps) {
  const [localText, setLocalText] = useState(node.text);

  if (localText !== node.text && document.activeElement?.tagName !== 'TEXTAREA') {
    setLocalText(node.text);
  }

  const nodeTitle = getFlowNodeTitle(node.id, nodes);

  return (
    <div
      className="absolute right-0 top-0 z-10 flex h-full w-80 flex-col gap-3 overflow-y-auto border-l border-outline-variant/50 bg-surface-container-lowest p-4 shadow-lg"
      data-testid="flow-map-inspector"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-label-md text-on-surface">{nodeTitle}</p>
          <span className="mt-1 inline-block rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-xs text-on-surface-variant">
            {kindLabels[node.kind]}
          </span>
        </div>
        <button
          type="button"
          aria-label="Fechar inspetor"
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-label-sm text-xs text-on-surface-variant" htmlFor="inspector-text">
          Texto da etapa
        </label>
        <textarea
          id="inspector-text"
          aria-label="Texto da etapa"
          className="min-h-[80px] rounded-lg border border-outline-variant/60 bg-surface-container-low p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={() => {
            if (localText !== node.text) onTextChange(localText);
          }}
        />
      </div>

      {node.kind === 'choice' && (
        <ChoiceOptionsSection node={node} nodes={nodes} flows={flows} onRemoveEffect={onRemoveEffect} />
      )}

      {node.kind === 'score_branch' && <ScoreBranchSection node={node} nodes={nodes} />}

      <div className="mt-auto pt-2">
        <Button variant="secondary" className="w-full" onClick={onEditFully}>
          Editar completamente →
        </Button>
      </div>
    </div>
  );
}

function ChoiceOptionsSection({
  node,
  nodes,
  flows,
  onRemoveEffect,
}: {
  node: ChoiceFlowNode;
  nodes: FlowNode[];
  flows: GuidedFlow[];
  onRemoveEffect: (optionId: string, effectIndex: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-label-sm text-xs text-on-surface-variant">Opções</p>
      {node.options.map((option) => {
        const destTitle = option.effects?.some((e) => e.kind === 'flow_start')
          ? `→ fluxo "${getFlowStartTargetTitle(
              (option.effects.find((e) => e.kind === 'flow_start') as { flowId: string }).flowId,
              flows,
            )}"`
          : `→ ${getFlowNodeTitle(option.next, nodes)}`;

        return (
          <div key={option.id} className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-2">
            <div className="flex items-center justify-between gap-1">
              <p className="font-label-md text-sm text-on-surface">{option.label}</p>
              <p className="font-body-md text-xs text-on-surface-variant">{destTitle}</p>
            </div>
            {option.effects && option.effects.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {option.effects.map((effect, effectIndex) => {
                  const colorClass = effectColors[effect.kind] ?? 'bg-surface-container text-on-surface';
                  const label =
                    effectLabels[effect.kind]?.(effect as unknown as Record<string, unknown>) ?? effect.kind;
                  return (
                    <span
                      key={effectIndex}
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
                    >
                      {label}
                      <button
                        type="button"
                        aria-label={`Remover efeito ${effect.kind}`}
                        onClick={() => onRemoveEffect(option.id, effectIndex)}
                        className="ml-0.5 rounded-full hover:opacity-70"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreBranchSection({ node, nodes }: { node: ScoreBranchFlowNode; nodes: FlowNode[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-label-sm text-xs text-on-surface-variant">
        Chave: <strong>{node.scoreKey}</strong>
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-on-surface-variant">
            <th className="pb-1 pr-2 font-medium">De</th>
            <th className="pb-1 pr-2 font-medium">Até</th>
            <th className="pb-1 font-medium">Vai para</th>
          </tr>
        </thead>
        <tbody>
          {node.branches.map((branch) => (
            <tr key={branch.id} className="border-t border-outline-variant/30">
              <td className="py-1 pr-2 font-mono">{branch.min}</td>
              <td className="py-1 pr-2 font-mono">{branch.max}</td>
              <td className="py-1 text-on-surface-variant">{getFlowNodeTitle(branch.next, nodes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
