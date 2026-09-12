import { AlertTriangle, ArrowDown, ArrowUp, Copy } from 'lucide-react';
import type {
  ChoiceFlowNode,
  FlowNode,
  GuidedFlow,
  OrientationVideo,
  OrientationVisual,
  ScoreBranchFlowNode,
} from '../../domain/flow-engine/types';
import { FlowEditorChoiceOptions } from './FlowEditorChoiceOptions';
import { FlowEditorMedia } from './FlowEditorMedia';
import { FlowEditorScoreBranches } from './FlowEditorScoreBranches';
import { Button } from '../../design-system/components/Button';
import { inputClassSm, textareaClass } from '../components/fieldStyles';
import { getNodeCountLabel, getNodeKindLabel } from './flowEditorUtils';

type ChoiceOptionPatch = Partial<ChoiceFlowNode['options'][number]>;
type BranchPatch = Partial<ScoreBranchFlowNode['branches'][number]>;

export interface FlowEditorNodeCardProps {
  flow: GuidedFlow;
  node: FlowNode;
  nodes: FlowNode[];
  stepNumber: number;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  confirmDelete: boolean;
  existingScoreKeys: string[];
  imageError: string | null;
  onSelectNodeId: (nodeId: string | null) => void;
  onMoveNode: (nodeId: string, direction: 'up' | 'down') => void;
  onDuplicateNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRequestDeleteNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onUpdateNodeKind: (node: FlowNode, kind: FlowNode['kind']) => void;
  onAddNodeVideo: (node: FlowNode) => void;
  onUpdateNodeVideo: (node: FlowNode, videoId: string, patch: Partial<OrientationVideo>) => void;
  onRemoveNodeVideo: (node: FlowNode, videoId: string) => void;
  onAddNodeVisual: (node: FlowNode) => void;
  onUpdateNodeVisual: (node: FlowNode, visualId: string, patch: Partial<OrientationVisual>) => void;
  onRemoveNodeVisual: (node: FlowNode, visualId: string) => void;
  setImageError: (message: string | null) => void;
  onAddOption: (node: ChoiceFlowNode) => void;
  onOpenOptionEdit: (node: ChoiceFlowNode, optionId: string) => void;
  onUpdateChoiceOption: (node: ChoiceFlowNode, optionId: string, patch: ChoiceOptionPatch) => void;
  onUpdateScoreBranchNode: (node: ScoreBranchFlowNode, patch: Partial<ScoreBranchFlowNode>) => void;
  onAddScoreBranchRange: (node: ScoreBranchFlowNode) => void;
  onUpdateScoreBranchRange: (node: ScoreBranchFlowNode, branchId: string, patch: BranchPatch) => void;
  onRemoveScoreBranchRange: (node: ScoreBranchFlowNode, branchId: string) => void;
}

export function FlowEditorNodeCard({
  flow,
  node,
  nodes,
  stepNumber,
  isFirst,
  isLast,
  selected,
  confirmDelete,
  existingScoreKeys,
  imageError,
  onSelectNodeId,
  onMoveNode,
  onDuplicateNode,
  onDeleteNode,
  onRequestDeleteNode,
  onUpdateNode,
  onUpdateNodeKind,
  onAddNodeVideo,
  onUpdateNodeVideo,
  onRemoveNodeVideo,
  onAddNodeVisual,
  onUpdateNodeVisual,
  onRemoveNodeVisual,
  setImageError,
  onAddOption,
  onOpenOptionEdit,
  onUpdateChoiceOption,
  onUpdateScoreBranchNode,
  onAddScoreBranchRange,
  onUpdateScoreBranchRange,
  onRemoveScoreBranchRange,
}: FlowEditorNodeCardProps) {
  const stepTitle = `Etapa ${stepNumber} — ${node.text ? node.text.trim().replace(/\s+/g, ' ') || 'Texto vazio' : node.id}`;
  const stepLabel = `Etapa ${stepNumber}`.toLowerCase();
  const panelId = `flow-node-${flow.id}-${node.id}`;
  const isSelected = selected;

  return (
    <article
      key={node.id}
      id={`flow-node-${node.id}`}
      className={`overflow-hidden rounded-lg border border-l-4 bg-surface-container-lowest shadow-sm border-outline-variant ${
        isSelected ? 'border-l-primary' : 'border-l-outline-variant/40'
      }`}
    >
      <div className="flex w-full items-start justify-between gap-3 p-4 select-none">
        <div
          role="button"
          tabIndex={0}
          className="flex min-w-0 flex-1 flex-col gap-2 cursor-pointer text-left"
          onClick={() => {
            onSelectNodeId(isSelected ? null : node.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectNodeId(isSelected ? null : node.id);
            }
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-label-lg text-on-surface font-bold">{stepTitle}</h4>
            <span className="rounded-full bg-surface-container-low px-3 py-1 font-label-sm text-on-surface-variant">
              {getNodeKindLabel(node)}
            </span>
            <span className="rounded-full bg-secondary-container px-3 py-1 font-label-sm text-on-secondary-container">
              {getNodeCountLabel(node)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={isFirst}
              onClick={(e) => {
                e.stopPropagation();
                onMoveNode(node.id, 'up');
              }}
              aria-label={`Mover ${stepTitle} para cima`}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={(e) => {
                e.stopPropagation();
                onMoveNode(node.id, 'down');
              }}
              aria-label={`Mover ${stepTitle} para baixo`}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowDown size={16} />
            </button>
          </div>
          {isSelected && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateNode(node.id);
                }}
              >
                <Copy size={16} aria-hidden="true" />
                Duplicar esta etapa
              </Button>
              {confirmDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNode(node.id);
                  }}
                >
                  <AlertTriangle size={16} aria-hidden="true" />
                  Confirmar exclusão da etapa
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDeleteNode(node.id);
                  }}
                >
                  Excluir etapa
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {isSelected && (
        <div id={panelId} className="flex flex-col gap-3 border-t border-outline-variant/60 p-3">
          <label className="flex flex-col gap-2">
            <span className="font-label-sm text-on-surface">Texto da etapa</span>
            <textarea
              aria-label={`Texto da ${stepLabel}`}
              className={textareaClass}
              value={node.text}
              onChange={(event) => onUpdateNode(node.id, { text: event.target.value })}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-label-sm text-on-surface">Tipo da etapa</span>
            <select
              aria-label={`Tipo da ${stepLabel}`}
              className={inputClassSm}
              value={node.kind}
              onChange={(event) => onUpdateNodeKind(node, event.target.value as FlowNode['kind'])}
            >
              <option value="choice">Pergunta com opções</option>
              <option value="result">Resultado final</option>
              <option value="score_branch">Ramificação por pontuação</option>
            </select>
          </label>

          <FlowEditorMedia
            node={node}
            stepLabel={stepLabel}
            imageError={imageError}
            onAddNodeVideo={onAddNodeVideo}
            onUpdateNodeVideo={onUpdateNodeVideo}
            onRemoveNodeVideo={onRemoveNodeVideo}
            onAddNodeVisual={onAddNodeVisual}
            onUpdateNodeVisual={onUpdateNodeVisual}
            onRemoveNodeVisual={onRemoveNodeVisual}
            setImageError={setImageError}
          />
          {node.kind === 'choice' && (
            <FlowEditorChoiceOptions
              node={node}
              nodes={nodes}
              stepLabel={stepLabel}
              onAddOption={onAddOption}
              onOpenOptionEdit={onOpenOptionEdit}
              onUpdateChoiceOption={onUpdateChoiceOption}
            />
          )}
          {node.kind === 'score_branch' && (
            <FlowEditorScoreBranches
              node={node}
              nodes={nodes}
              existingScoreKeys={existingScoreKeys}
              onUpdateScoreBranchNode={onUpdateScoreBranchNode}
              onAddScoreBranchRange={onAddScoreBranchRange}
              onUpdateScoreBranchRange={onUpdateScoreBranchRange}
              onRemoveScoreBranchRange={onRemoveScoreBranchRange}
            />
          )}
        </div>
      )}
    </article>
  );
}
