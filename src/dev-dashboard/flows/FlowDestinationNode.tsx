import { AlertTriangle, ArrowRight, Expand, Flag, GitBranch, ListTree, Plus, ShieldAlert } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';

import { destinationNodeKindLabel, type DestinationKind, type DestinationNodeData } from './flowDestinationModels';
import { OptionOutputRow } from './FlowDestinationQuickActions';
import type { ConnectionSource } from './flowMutations';
import { previewFlowText } from './flowText';

function destinationTypeLabel(kind: DestinationKind) {
  if (kind === 'result') return 'Final';
  if (kind === 'flow_start') return 'Outro fluxo';
  if (kind === 'navigate') return 'Área externa';
  if (kind === 'safety_interrupt') return 'Segurança imediata';
  if (kind === 'deferred_safety') return 'Segurança ao concluir';
  if (kind === 'end_flow') return 'Encerramento';
  return 'Destino ausente';
}

function TargetHandles({ handles }: { handles?: DestinationNodeData['targetHandles'] }) {
  const visibleHandles = handles?.length ? handles : [{ id: 'target-default', top: 50 }];
  return visibleHandles.map((handle) => (
    <Handle
      key={handle.id}
      id={handle.id}
      type="target"
      position={Position.Left}
      className="flow-destination-map__target"
      style={{ top: `${handle.top}%` }}
    />
  ));
}

export function FlowDestinationNode({ data }: { data: DestinationNodeData }) {
  if (data.kind === 'destination' || data.kind === 'missing') {
    const destination = data.destination;
    return (
      <div className={`flow-destination-node flow-destination-node--${destination?.kind ?? 'missing'}`}>
        <TargetHandles handles={data.targetHandles} />
        <div className="flow-destination-node__eyebrow">
          {destination?.kind === 'missing' ? <AlertTriangle aria-hidden="true" /> : <Flag aria-hidden="true" />}
          {destination ? destinationTypeLabel(destination.kind) : destinationNodeKindLabel(data.kind)}
        </div>
        <strong>{destination?.label}</strong>
        {destination?.detail && <small>{destination.detail}</small>}
        {destination?.kind === 'flow_start' && destination.flowId && data.onOpenFlow && (
          <button
            type="button"
            className="flow-destination-node__open nodrag nopan"
            aria-label={`Abrir ${destination.label}`}
            onClick={(event) => {
              event.stopPropagation();
              data.onOpenFlow?.(destination.flowId!);
            }}
          >
            Abrir fluxo <ArrowRight aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
  if (data.kind === 'sequence') {
    return (
      <div className="flow-destination-sequence">
        <TargetHandles handles={data.targetHandles} />
        <div className="flow-destination-sequence__header">
          <span>
            <ListTree aria-hidden="true" /> Sequência linear
          </span>
          <button type="button" onClick={data.onToggleSequence} aria-label="Expandir sequência">
            <Expand aria-hidden="true" />
          </button>
        </div>
        <strong>{data.stepLabel ?? `Etapas ${data.nodeIds?.[0]}–${data.nodeIds?.[data.nodeIds.length - 1]}`}</strong>
        <small>{data.nodeIds?.length} etapas · estrutura linear</small>
        <div className="flow-destination-sequence__rail" aria-label="Etapas agrupadas">
          {data.nodeIds?.map((id) => (
            <i key={id} title={id} />
          ))}
        </div>
        <Handle type="source" position={Position.Right} id="sequence-out" className="flow-destination-map__source" />
      </div>
    );
  }
  const node = data.node;
  if (!node) return null;
  const options =
    node.kind === 'choice'
      ? [
          ...node.options.map((option) => ({ id: option.id, label: option.label })),
          ...(node.freeText ? [{ id: 'free-text', label: 'Resposta livre' }] : []),
        ]
      : node.kind === 'score_branch'
        ? node.branches.map((branch) => ({ id: branch.id, label: `${branch.min}–${branch.max}` }))
        : [];
  const hasSafety =
    node.kind === 'choice' &&
    node.options.some((option) =>
      option.effects?.some((effect) => effect.kind === 'safety_interrupt' || effect.kind === 'deferred_safety'),
    );
  return (
    <div
      className={`flow-destination-card flow-destination-card--${node.kind} ${data.highlighted ? 'is-highlighted' : ''} ${data.matched ? 'is-match' : ''} ${data.isDisconnected ? 'is-disconnected' : ''}`}
    >
      <TargetHandles handles={data.targetHandles} />
      <div
        className="flow-destination-card__meta"
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          data.onFocusSection?.(node.id, 'geral');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            data.onFocusSection?.(node.id, 'geral');
          }
        }}
        title={`Clique para editar detalhes de ${data.stepLabel ?? node.id}`}
        aria-label={`Editar detalhes de ${data.stepLabel ?? node.id}`}
      >
        <span>
          {node.kind === 'choice' ? (
            'Pergunta'
          ) : node.kind === 'score_branch' ? (
            <>
              <GitBranch aria-hidden="true" /> Ramificação
            </>
          ) : (
            <>
              <Flag aria-hidden="true" /> Final
            </>
          )}
        </span>
        {data.isDisconnected && (
          <span className="text-warning text-[9px] font-bold" title="Esta etapa não está conectada ao início do fluxo">
            Não conectada
          </span>
        )}
        {data.cycle && <em className="flow-destination-card__cycle">Ciclo</em>}
        <code>{node.id}</code>
      </div>
      <div
        className={`flow-destination-card__content nodrag nopan ${
          data.activeFocusSection === 'texto' ? 'is-focused' : ''
        }`}
        onClick={(e) => {
          e.stopPropagation();
          data.onFocusSection?.(node.id, 'texto');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            data.onFocusSection?.(node.id, 'texto');
          }
        }}
        role="button"
        tabIndex={0}
        title="Clique para editar o texto da etapa"
        aria-label={`Editar texto de ${data.stepLabel ?? node.id}`}
      >
        <strong>{data.stepLabel ?? 'Etapa ?'}</strong>
        <p title={node.text}>{previewFlowText(node.text) || <span className="italic opacity-60">Sem texto</span>}</p>
      </div>
      {options.length > 0 && (
        <div className="flow-destination-card__options" aria-label="Saídas da etapa">
          {options.map((option, index) => {
            let source: ConnectionSource;
            if (node.kind === 'score_branch') {
              source = { kind: 'branch', nodeId: node.id, branchId: option.id };
            } else if (option.id === 'free-text') {
              source = { kind: 'free_text', nodeId: node.id };
            } else {
              source = { kind: 'option', nodeId: node.id, optionId: option.id };
            }
            return (
              <OptionOutputRow
                key={option.id}
                id={option.id}
                label={option.label}
                index={index}
                targetLabel={data.optionTargets?.[option.id]}
                source={source}
                data={data}
              />
            );
          })}
        </div>
      )}
      {node.kind === 'choice' && (
        <button
          type="button"
          className="flow-destination-card__add-option-btn nodrag nopan"
          onClick={(e) => {
            e.stopPropagation();
            data.onAddOption?.(node.id);
          }}
          aria-label={`Adicionar opção à ${data.stepLabel ?? node.id}`}
        >
          <Plus aria-hidden="true" size={13} />
          <span>Adicionar opção</span>
        </button>
      )}
      {node.kind === 'score_branch' && (
        <button
          type="button"
          className="flow-destination-card__add-option-btn nodrag nopan"
          onClick={(e) => {
            e.stopPropagation();
            data.onAddBranch?.(node.id);
          }}
          aria-label={`Adicionar faixa à ${data.stepLabel ?? node.id}`}
        >
          <Plus aria-hidden="true" size={13} />
          <span>Adicionar faixa</span>
        </button>
      )}
      {hasSafety && (
        <div className="flow-destination-card__signal">
          <ShieldAlert aria-hidden="true" /> Segurança tipada
        </div>
      )}
    </div>
  );
}
