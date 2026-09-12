import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { FlowEffect, FlowOption, GuidedFlow } from '../../domain/flow-engine/types';
import {
  EffectFields,
  EFFECT_KIND_OPTIONS,
  buildDefaultEffect,
  effectColors,
  effectSummaries,
  selectClassName,
} from './flowEffectFields';
import { TargetSelect } from './flowTargetSelect';
import { effectKindLabel } from './nodeEditorUtils';
import type { FlowTopologyNode } from './flowTopology';

interface OptionRowProps {
  option: FlowOption;
  index: number;
  targets: FlowTopologyNode[];
  flows: GuidedFlow[];
  /**
   * Updater-style edit channel for this row's option. Callers must invoke it
   * AT MOST ONCE per user event (single synchronous commit per event); the
   * `update` function is resolved against the latest committed option when the
   * panel handles the event, so it must never capture a render-time snapshot.
   */
  onOptionUpdate: (update: (current: FlowOption) => FlowOption) => void;
  onRemove: () => void;
  initialFocus?: boolean;
  highlighted?: boolean;
}

/**
 * One editable option row: label, target, typed effect builder and remove
 * action. The label keeps a per-row draft (null = no pending edit, so external
 * values flow straight through). Commit happens onBlur by comparing the draft
 * to the last committed label — scoped per row on purpose, never via the
 * shared document.activeElement guard, so editing a label can't clobber
 * sibling rows or the texto textarea.
 */
export function OptionRow({
  option,
  index,
  targets,
  flows,
  onOptionUpdate,
  onRemove,
  initialFocus = false,
  highlighted = false,
}: OptionRowProps) {
  const [draftLabel, setDraftLabel] = useState<string | null>(null);
  const displayedLabel = draftLabel ?? option.label;
  const effects = option.effects ?? [];
  const presentKinds = new Set(effects.map((effect) => effect.kind));
  const inputId = `option-label-input-${option.id}`;
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialFocus) {
      inputRef.current?.focus();
    }
  }, [initialFocus]);

  return (
    <div
      data-testid={`option-row-${index + 1}`}
      className={`flex flex-col gap-2.5 rounded-lg border p-2.5 transition-all ${
        highlighted
          ? 'border-primary/60 bg-primary/5 ring-2 ring-primary/30'
          : 'border-outline-variant/40 bg-surface-container-low'
      }`}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="font-label-sm text-[11px] font-semibold text-on-surface-variant">
          Texto da opção
        </label>
        <input
          id={inputId}
          ref={inputRef}
          aria-label={`Rótulo da opção ${index + 1}`}
          placeholder="Ex: Sim, Não, Quero saber mais..."
          className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary"
          value={displayedLabel}
          onChange={(event) => setDraftLabel(event.target.value)}
          onBlur={() => {
            setDraftLabel(null);
            if (draftLabel !== null && draftLabel !== option.label) {
              onOptionUpdate((current) => ({ ...current, label: draftLabel }));
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant flex items-center gap-1.5">
          <ArrowRight aria-hidden="true" size={12} className="text-primary shrink-0" />
          <span>Leva para a etapa:</span>
        </span>
        {/* Selects don't blur reliably; commit the target immediately on change. */}
        <TargetSelect
          ariaLabel={`Destino da opção ${index + 1}`}
          value={option.next}
          onChange={(next) => onOptionUpdate((current) => ({ ...current, next }))}
          nodes={targets}
          allowEmpty
        />
      </div>

      <div className="flex flex-col gap-1 pt-0.5">
        {effects.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {effects.map((effect, effectIndex) => (
              <span
                key={effectIndex}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${effectColors[effect.kind]}`}
              >
                {
                  // One cast mirrors patchEffect's narrowing limit: writers are
                  // keyed exhaustively by kind, so the runtime kind guarantees
                  // the matching writer's parameter.
                  (effectSummaries[effect.kind] as (effect: FlowEffect) => string)(effect)
                }
                <button
                  type="button"
                  aria-label={`Remover efeito ${effectIndex + 1} (${effectKindLabel(effect.kind)}) da opção ${index + 1}`}
                  onClick={() =>
                    onOptionUpdate((current) => {
                      const remaining =
                        current.effects?.filter((_, candidateIndex) => candidateIndex !== effectIndex) ?? [];
                      if (remaining.length === 0) {
                        // Dropping the last chip removes the key entirely.
                        const { effects: _dropped, ...optionWithoutEffects } = current;
                        return optionWithoutEffects;
                      }
                      return { ...current, effects: remaining };
                    })
                  }
                  className="ml-0.5 rounded-full hover:opacity-70"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Controlled "menu" select: always resets to the placeholder after appending. */}
        <select
          aria-label={`Adicionar efeito à opção ${index + 1}`}
          className={selectClassName}
          value=""
          onChange={(event) => {
            const { value } = event.target;
            if (value === '') return;
            const kind = value as FlowEffect['kind'];
            onOptionUpdate((current) => ({
              ...current,
              effects: [...(current.effects ?? []), buildDefaultEffect(kind, flows)],
            }));
          }}
        >
          <option value="">+ Adicionar ação especial (apoio, encerrar, pontuar)…</option>
          {EFFECT_KIND_OPTIONS.filter(
            (candidate) => candidate.kind === 'score' || !presentKinds.has(candidate.kind),
          ).map((candidate) => (
            <option key={candidate.kind} value={candidate.kind}>
              {candidate.label}
            </option>
          ))}
        </select>
        {effects.map((effect, effectIndex) => (
          <div
            key={`${effect.kind}-${effectIndex}`}
            className="mt-1 flex flex-col gap-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-2"
          >
            <EffectFields
              effect={effect}
              effectIndex={effectIndex}
              optionId={option.id}
              flows={flows}
              onEffectUpdate={(update) =>
                onOptionUpdate((current) => ({
                  ...current,
                  effects: (current.effects ?? []).map((candidate, candidateIndex) =>
                    candidateIndex === effectIndex ? update(candidate) : candidate,
                  ),
                }))
              }
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label={`Remover opção ${index + 1}`}
        onClick={onRemove}
        className="self-start rounded-full px-2 py-1 font-label-sm text-xs text-on-surface-variant transition-colors hover:bg-error-container/60 hover:text-on-error-container"
      >
        Remover opção
      </button>
    </div>
  );
}
