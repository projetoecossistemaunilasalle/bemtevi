import type { ChoiceFlowNode, FlowOption } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { FieldHint } from '../components/FieldHint';
import { inputClassSm } from '../components/fieldStyles';
import type { OptionEffectsUpdate } from './flowEditorUtils';

export interface FlowEditorScoreEffectProps {
  editNode: ChoiceFlowNode;
  editOption: FlowOption;
  existingScoreKeys: string[];
  onUpdateOptionEffects: OptionEffectsUpdate;
}

export function FlowEditorScoreEffect({
  editNode,
  editOption,
  existingScoreKeys,
  onUpdateOptionEffects,
}: FlowEditorScoreEffectProps) {
  const scoreEffect = editOption.effects?.find((effect) => effect.kind === 'score');

  return (
    <div className="flex flex-col gap-2 border-t border-outline-variant/40 pt-4">
      <p className="font-label-md text-on-surface font-semibold">Pontuação</p>
      {scoreEffect ? (
        <div className="grid gap-2 grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-on-surface">Chave da pontuação</span>
            <input
              aria-label="Chave da pontuação"
              placeholder="Chave (ex: srq20)"
              className={inputClassSm}
              value={scoreEffect.scoreKey}
              onChange={(event) =>
                onUpdateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                  effects?.map((effect) =>
                    effect.kind === 'score' ? { ...effect, scoreKey: event.target.value } : effect,
                  ),
                )
              }
            />
            <FieldHint>
              A chave agrupa pontos do questionário (ex: 'srq20' para somar todas as respostas Sim).
            </FieldHint>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-on-surface">Valor</span>
            <input
              type="number"
              aria-label="Valor da pontuação"
              className={inputClassSm}
              value={scoreEffect.value}
              onChange={(event) =>
                onUpdateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                  effects?.map((effect) =>
                    effect.kind === 'score' ? { ...effect, value: Number(event.target.value) } : effect,
                  ),
                )
              }
            />
          </label>
          {existingScoreKeys.length > 0 && (
            <div className="col-span-2 flex flex-wrap gap-1.5 items-center mt-1">
              <span className="text-xs text-on-surface-variant font-medium">Sugestões:</span>
              {existingScoreKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="px-2.5 py-1 text-xs font-label-sm bg-secondary-container text-on-secondary-container hover:bg-secondary-container/85 active:bg-secondary-container/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md transition-colors cursor-pointer"
                  onClick={() =>
                    onUpdateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                      effects?.map((effect) => (effect.kind === 'score' ? { ...effect, scoreKey: key } : effect)),
                    )
                  }
                >
                  {key}
                </button>
              ))}
            </div>
          )}
          <div className="col-span-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                onUpdateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                  effects?.filter((effect) => effect.kind !== 'score'),
                )
              }
            >
              Remover pontuação
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              onUpdateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) => [
                ...(effects ?? []),
                { kind: 'score', scoreKey: '', value: 1 },
              ])
            }
          >
            Ativar pontuação
          </Button>
        </div>
      )}
    </div>
  );
}
