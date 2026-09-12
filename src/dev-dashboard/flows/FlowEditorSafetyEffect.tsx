import type { ChoiceFlowNode, DeferredSafetyFlowEffect, FlowOption, GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { inputClassSm, textareaClass } from '../components/fieldStyles';
import type { OptionEffectsUpdate } from './flowEditorUtils';

export interface FlowEditorSafetyEffectProps {
  flow: GuidedFlow;
  editNode: ChoiceFlowNode;
  editOption: FlowOption;
  onUpdateOptionEffects: OptionEffectsUpdate;
}

export function FlowEditorSafetyEffect({
  flow,
  editNode,
  editOption,
  onUpdateOptionEffects,
}: FlowEditorSafetyEffectProps) {
  const safetyEffect = editOption.effects?.find(
    (effect): effect is DeferredSafetyFlowEffect => effect.kind === 'deferred_safety',
  );

  return (
    <div className="flex flex-col gap-2 border-t border-outline-variant/40 pt-4">
      <p className="font-label-md text-on-surface font-semibold">Encaminhamento de segurança</p>
      <p className="font-body-sm text-on-surface-variant">
        Marca um sinal sensível e encaminha ao apoio depois do resultado final.
      </p>
      {safetyEffect ? (
        <div className="grid gap-2 grid-cols-1">
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-on-surface">Flag key</span>
            <input
              aria-label="Flag key"
              className={inputClassSm}
              value={safetyEffect.flagKey ?? ''}
              onChange={(event) =>
                onUpdateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                  effects?.map((effect) =>
                    effect.kind === 'deferred_safety' ? { ...effect, flagKey: event.target.value } : effect,
                  ),
                )
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-on-surface">Destino</span>
            <select
              aria-label="Destino de segurança"
              className={inputClassSm}
              value={safetyEffect.destination ?? '/apoio'}
              onChange={(event) =>
                onUpdateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                  effects?.map((effect) =>
                    effect.kind === 'deferred_safety'
                      ? {
                          ...effect,
                          destination: event.target.value as DeferredSafetyFlowEffect['destination'],
                        }
                      : effect,
                  ),
                )
              }
            >
              <option value="/apoio">/apoio — Apoio imediato</option>
              <option value="/contatos">/contatos — Contatos de apoio</option>
              <option value="/educacao">/educacao — Materiais educativos</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-on-surface">Mensagem</span>
            <textarea
              aria-label="Mensagem de segurança"
              className={textareaClass}
              value={safetyEffect.message ?? ''}
              onChange={(event) =>
                onUpdateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                  effects?.map((effect) =>
                    effect.kind === 'deferred_safety' ? { ...effect, message: event.target.value } : effect,
                  ),
                )
              }
            />
          </label>
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                onUpdateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                  effects?.filter((effect) => effect.kind !== 'deferred_safety'),
                )
              }
            >
              Remover encaminhamento
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
                { kind: 'deferred_safety', flagKey: '', message: '', destination: '/apoio' },
              ])
            }
          >
            Ativar encaminhamento
          </Button>
        </div>
      )}

      {flow.id === 'srq20' &&
        editNode.id === 'q17' &&
        !editOption.effects?.some((effect) => effect.kind === 'score') && (
          <p className="font-body-sm text-on-surface-variant mt-2">
            Q17 não soma pontos no SRQ-20. Ela fica separada da pontuação para não esconder uma regra de segurança
            dentro do cálculo.
          </p>
        )}
    </div>
  );
}
