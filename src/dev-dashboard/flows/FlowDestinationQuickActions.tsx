import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';

import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import type { DestinationNodeData } from './flowDestinationModels';
import type { ConnectionSource, TerminalDestination } from './flowMutations';

function QuickActionMenu({
  source,
  flows,
  onAddStage,
  onApplyEffect,
  onClose,
}: {
  source: ConnectionSource;
  flows?: GuidedFlow[];
  onAddStage?: (kind: FlowNode['kind']) => void;
  onApplyEffect?: (destination: TerminalDestination) => void;
  onClose: () => void;
}) {
  const [selectingFlow, setSelectingFlow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const otherFlows = (flows ?? []).filter((f) => f.id !== source.nodeId);

  return (
    <div
      ref={containerRef}
      role="menu"
      tabIndex={-1}
      aria-label="Ações de continuação"
      className="flow-destination-quick-menu nodrag nopan"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flow-destination-quick-menu__header">Continuar com</div>
      <button type="button" className="flow-destination-quick-menu__item" onClick={() => onAddStage?.('choice')}>
        💬 Pergunta
      </button>
      <button type="button" className="flow-destination-quick-menu__item" onClick={() => onAddStage?.('result')}>
        🏁 Resultado final
      </button>
      <button type="button" className="flow-destination-quick-menu__item" onClick={() => onAddStage?.('score_branch')}>
        🔀 Ramificação por pontuação
      </button>

      {(source.kind === 'option' || source.kind === 'branch') && (
        <>
          <div className="flow-destination-quick-menu__divider" />
          <div className="flow-destination-quick-menu__header">
            {source.kind === 'branch' ? 'Direcionar para área' : 'Direcionar ou encerrar'}
          </div>
          <button
            type="button"
            className="flow-destination-quick-menu__item"
            onClick={() => onApplyEffect?.({ kind: 'navigate', destination: '/apoio' })}
          >
            🏥 Abrir /apoio
          </button>
          <button
            type="button"
            className="flow-destination-quick-menu__item"
            onClick={() => onApplyEffect?.({ kind: 'navigate', destination: '/contatos' })}
          >
            🏥 Abrir /contatos
          </button>
          <button
            type="button"
            className="flow-destination-quick-menu__item"
            onClick={() => onApplyEffect?.({ kind: 'navigate', destination: '/educacao' })}
          >
            🏥 Abrir /educacao
          </button>

          {source.kind === 'option' && (
            <>
              {otherFlows.length > 0 && !selectingFlow && (
                <button
                  type="button"
                  className="flow-destination-quick-menu__item"
                  onClick={() => setSelectingFlow(true)}
                >
                  🔄 Iniciar outro fluxo…
                </button>
              )}
              {selectingFlow && (
                <div className="flow-destination-quick-menu__sub">
                  <div className="text-[10px] text-on-surface-variant font-bold px-2 py-1">Escolha o fluxo:</div>
                  {otherFlows.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="flow-destination-quick-menu__item text-left truncate"
                      onClick={() => onApplyEffect?.({ kind: 'flow_start', flowId: f.id })}
                    >
                      {f.title || f.id}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="flow-destination-quick-menu__item text-xs text-primary"
                    onClick={() => setSelectingFlow(false)}
                  >
                    ← Voltar
                  </button>
                </div>
              )}
              <button
                type="button"
                className="flow-destination-quick-menu__item"
                onClick={() => onApplyEffect?.({ kind: 'end_flow', message: '' })}
              >
                ⏹️ Encerrar conversa
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function OptionOutputRow({
  id,
  label,
  index,
  targetLabel,
  source,
  data,
}: {
  id: string;
  label: string;
  index: number;
  targetLabel?: string;
  source: ConnectionSource;
  data: DestinationNodeData;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel = label.trim() || (source.kind === 'branch' ? label : `Opção ${index + 1}`);
  const isPlaceholder = !label.trim();
  const isRowFocused =
    data.activeFocusSection === (source.kind === 'branch' ? 'faixa' : 'opcao') && data.activeFocusTargetId === id;

  return (
    <div
      className={`flow-destination-card__option nodrag nopan ${isRowFocused ? 'is-focused' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (source.kind === 'branch') {
          data.onFocusSection?.(source.nodeId, 'faixa', source.branchId);
        } else if (source.kind === 'free_text') {
          data.onFocusSection?.(source.nodeId, 'opcoes');
        } else {
          data.onFocusSection?.(source.nodeId, 'opcao', source.optionId);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (source.kind === 'branch') {
            data.onFocusSection?.(source.nodeId, 'faixa', source.branchId);
          } else if (source.kind === 'free_text') {
            data.onFocusSection?.(source.nodeId, 'opcoes');
          } else {
            data.onFocusSection?.(source.nodeId, 'opcao', source.optionId);
          }
        }
      }}
      role="button"
      tabIndex={0}
      title={`Clique para editar ${displayLabel}`}
      aria-label={`Editar ${displayLabel}`}
    >
      <span>
        <strong className={isPlaceholder ? 'flow-destination-card__option-empty' : ''}>{displayLabel}</strong>
        {targetLabel ? (
          <small>{targetLabel}</small>
        ) : (
          <small className="flow-destination-card__option-no-target">Sem destino</small>
        )}
      </span>
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <button
          type="button"
          className="flow-destination-card__add-btn nodrag nopan"
          aria-label={`Continuar a partir de ${displayLabel}`}
          title={targetLabel ? `Conectar ou alterar: ${displayLabel}` : `Conectar a partir de ${displayLabel}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((curr) => !curr);
          }}
        >
          <Plus aria-hidden="true" size={12} />
        </button>
        <Handle type="source" position={Position.Right} id={id} className="flow-destination-map__source" />
      </div>
      {open && (
        <QuickActionMenu
          source={source}
          flows={data.flows}
          onAddStage={(kind) => {
            data.onAddConnectedStage?.(source, kind);
            setOpen(false);
          }}
          onApplyEffect={(dest) => {
            data.onApplyTerminalEffect?.(source, dest);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
