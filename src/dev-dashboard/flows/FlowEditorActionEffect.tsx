import type { ChoiceFlowNode, FlowOption, GuidedFlow } from '../../domain/flow-engine/types';
import { inputClassSm } from '../components/fieldStyles';

export interface FlowEditorActionEffectProps {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  editNode: ChoiceFlowNode;
  editOption: FlowOption;
  onUpdateChoiceOption: (node: ChoiceFlowNode, optionId: string, patch: Partial<FlowOption>) => void;
}

export function FlowEditorActionEffect({
  flow,
  flows,
  editNode,
  editOption,
  onUpdateChoiceOption,
}: FlowEditorActionEffectProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-outline-variant/40 pt-4">
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-on-surface">Tipo de Ação</span>
        <select
          aria-label="Ação da opção"
          className={inputClassSm}
          value={editOption.effects?.some((effect) => effect.kind === 'flow_start') ? 'flow_start' : 'next'}
          onChange={(event) => {
            const otherEffects = editOption.effects?.filter((effect) => effect.kind !== 'flow_start');

            if (event.target.value === 'flow_start') {
              onUpdateChoiceOption(editNode as ChoiceFlowNode, editOption.id, {
                effects: [
                  ...(otherEffects ?? []),
                  {
                    kind: 'flow_start',
                    flowId: flows.find((item) => item.id !== flow.id)?.id ?? flow.id,
                  },
                ],
              });
              return;
            }

            onUpdateChoiceOption(editNode as ChoiceFlowNode, editOption.id, {
              effects: otherEffects?.length ? otherEffects : undefined,
            });
          }}
        >
          <option value="next">Ir para etapa</option>
          <option value="flow_start">Começar outro fluxo</option>
        </select>
      </label>

      {editOption.effects?.some((effect) => effect.kind === 'flow_start') && (
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-on-surface">Fluxo de destino</span>
          <select
            aria-label="Fluxo de destino"
            className={inputClassSm}
            value={editOption.effects.find((effect) => effect.kind === 'flow_start')?.flowId ?? flow.id}
            onChange={(event) => {
              onUpdateChoiceOption(editNode as ChoiceFlowNode, editOption.id, {
                effects: [
                  ...(editOption.effects?.filter((effect) => effect.kind !== 'flow_start') ?? []),
                  { kind: 'flow_start', flowId: event.target.value },
                ],
              });
            }}
          >
            {flows.map((targetFlow) => (
              <option key={targetFlow.id} value={targetFlow.id}>
                {targetFlow.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
