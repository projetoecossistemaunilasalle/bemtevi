import { ArrowRight } from 'lucide-react';
import type { ChoiceFlowNode, FlowOption, GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { uniqueOptionId } from './flowMutations';
import { OptionRow } from './flowNodeEditorOptionRow';
import { TargetSelect } from './flowTargetSelect';
import type { FlowTopologyNode } from './flowTopology';

/** Opções body for choice nodes: one row per option plus free-text routing. */
export function ChoiceOptionsSection({
  node,
  targets,
  flows,
  onNodeChange,
  focusedOptionId,
  viewMode = 'all',
  onShowAll,
}: {
  node: ChoiceFlowNode;
  targets: FlowTopologyNode[];
  flows: GuidedFlow[];
  /** Same one-commit-per-event contract as the panel-level handler below. */
  onNodeChange: (update: (current: ChoiceFlowNode) => ChoiceFlowNode) => void;
  focusedOptionId?: string;
  viewMode?: 'focused' | 'all';
  onShowAll?: () => void;
}) {
  /**
   * Routes one option-scoped edit through the node-level updater. The mapping
   * runs against the LATEST options at event time — never against this
   * render's snapshot — and performs exactly one commit.
   */
  const commitOption = (optionId: string, update: (current: FlowOption) => FlowOption) =>
    onNodeChange((current) => ({
      ...current,
      options: current.options.map((candidate) => (candidate.id === optionId ? update(candidate) : candidate)),
    }));

  if (viewMode === 'focused' && focusedOptionId) {
    const focusedOption = node.options.find((o) => o.id === focusedOptionId) ?? node.options[0];
    const index = node.options.findIndex((o) => o.id === (focusedOption?.id ?? focusedOptionId));

    if (focusedOption && index !== -1) {
      return (
        <div className="flex flex-col gap-2">
          <OptionRow
            option={focusedOption}
            index={index}
            targets={targets}
            flows={flows}
            onOptionUpdate={(update) => commitOption(focusedOption.id, update)}
            onRemove={() =>
              onNodeChange((current) => ({
                ...current,
                options: current.options.filter((candidate) => candidate.id !== focusedOption.id),
              }))
            }
            initialFocus={true}
            highlighted={true}
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const newId = uniqueOptionId(node);
                onNodeChange((current) => ({
                  ...current,
                  options: [...current.options, { id: newId, label: '', next: '' }],
                }));
              }}
            >
              + Adicionar outra opção
            </Button>
            {onShowAll && (
              <button type="button" onClick={onShowAll} className="font-label-sm text-xs text-primary hover:underline">
                Ver todas ({node.options.length}) ▾
              </button>
            )}
          </div>
        </div>
      );
    }
  }

  return (
    <>
      {node.options.map((option, index) => (
        <OptionRow
          key={option.id}
          option={option}
          index={index}
          targets={targets}
          flows={flows}
          onOptionUpdate={(update) => commitOption(option.id, update)}
          onRemove={() =>
            onNodeChange((current) => ({
              ...current,
              options: current.options.filter((candidate) => candidate.id !== option.id),
            }))
          }
          highlighted={option.id === focusedOptionId}
        />
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onNodeChange((current) => ({
            ...current,
            options: [...current.options, { id: uniqueOptionId(current), label: '', next: '' }],
          }))
        }
      >
        Adicionar opção
      </Button>
      <label className="flex items-center gap-2 font-label-sm text-sm text-on-surface">
        <input
          type="checkbox"
          checked={Boolean(node.freeText)}
          onChange={(event) =>
            onNodeChange((current) => {
              if (event.target.checked) return { ...current, freeText: { next: current.freeText?.next ?? '' } };
              const { freeText: _dropped, ...nodeWithoutFreeText } = current;
              return nodeWithoutFreeText;
            })
          }
        />
        Aceitar resposta livre
      </label>
      {node.freeText && (
        <div className="flex flex-col gap-1 pl-6">
          <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant flex items-center gap-1.5">
            <ArrowRight aria-hidden="true" size={12} className="text-primary shrink-0" />
            <span>Leva para a etapa:</span>
          </span>
          <TargetSelect
            ariaLabel="Destino da resposta livre"
            value={node.freeText.next}
            onChange={(next) => onNodeChange((current) => ({ ...current, freeText: { next } }))}
            nodes={targets}
            allowEmpty
          />
        </div>
      )}
    </>
  );
}
