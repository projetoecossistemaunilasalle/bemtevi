import { useState } from 'react';
import type {
  DeferredSafetyFlowEffect,
  EndFlowEffect,
  FlowEffect,
  FlowStartFlowEffect,
  GuidedFlow,
  NavigateFlowEffect,
  SafetyInterruptFlowEffect,
  ScoreFlowEffect,
} from '../../domain/flow-engine/types';

/*
 * This module intentionally mixes presentation constants/builders with the
 * field components that consume them (single cohesive effect-builder cluster
 * per review). Disabling fast-refresh's only-component preference here; HMR
 * falls back to full reloads for this file.
 */
/* eslint-disable react-refresh/only-export-components */

/**
 * Typed effect-builder building blocks for NodeEditorPanel's option rows:
 * chip presentation, the add-effect menu vocabulary, default payloads and the
 * per-effect field editors. Depends only on domain flow types plus the flows
 * list — no panel imports — so it stays reusable in isolation.
 */

/** Shared styling for every native select across the panel. */
export const selectClassName =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary';

/** Chip color conventions shared by every editor surface so they read identically. */
export const effectColors: Record<FlowEffect['kind'], string> = {
  score: 'bg-primary-container text-on-primary-container',
  deferred_safety: 'bg-warning-container text-on-warning-container',
  safety_interrupt: 'bg-error-container text-on-error-container',
  flow_start: 'bg-secondary-container text-on-secondary-container',
  navigate: 'bg-surface-container text-on-surface',
  end_flow: 'bg-surface-container text-on-surface',
};

/** Exhaustively keyed per-kind chip writers; a missing or misspelled kind is a compile error. */
type EffectSummaryWriters = {
  [K in FlowEffect['kind']]: (effect: Extract<FlowEffect, { kind: K }>) => string;
};

/** Compact PT chip summaries shown on each effect chip. */
export const effectSummaries: EffectSummaryWriters = {
  score: (effect: ScoreFlowEffect) => `+${effect.value} em ${effect.scoreKey}`,
  deferred_safety: (effect: DeferredSafetyFlowEffect) => `⚠ segurança adiada → ${effect.destination}`,
  safety_interrupt: (effect: SafetyInterruptFlowEffect) => `⚠ interrompe → ${effect.destination}`,
  flow_start: (effect: FlowStartFlowEffect) => `→ fluxo ${effect.flowId}`,
  navigate: (effect: NavigateFlowEffect) => `→ ${effect.destination}`,
  end_flow: (_effect: EndFlowEffect) => 'encerrar',
};

/** Add-effect menu entries in canonical order; labels shown in the option list. */
export const EFFECT_KIND_OPTIONS: Array<{ kind: FlowEffect['kind']; label: string }> = [
  { kind: 'score', label: 'Pontuar' },
  { kind: 'safety_interrupt', label: 'Interromper por segurança' },
  { kind: 'deferred_safety', label: 'Segurança ao concluir' },
  { kind: 'navigate', label: 'Navegar para área' },
  { kind: 'flow_start', label: 'Iniciar outro fluxo' },
  { kind: 'end_flow', label: 'Encerrar fluxo' },
];

const SAFETY_DESTINATIONS = ['/apoio', '/contatos', '/educacao'] as const;

type SafetyDestination = (typeof SAFETY_DESTINATIONS)[number];

const fieldLabelClassName = 'font-label-sm text-xs text-on-surface-variant';
const fieldClassName =
  'rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary';

/**
 * Typed default payload appended when a kind is picked from the menu.
 * `score` may repeat on one option, so its default is always freshly built.
 */
export function buildDefaultEffect(kind: FlowEffect['kind'], flows: GuidedFlow[]): FlowEffect {
  switch (kind) {
    case 'score':
      return { kind: 'score', scoreKey: 'pontuacao', value: 1 };
    case 'safety_interrupt':
      return { kind: 'safety_interrupt', message: '', destination: '/apoio', blockResume: false };
    case 'deferred_safety':
      return { kind: 'deferred_safety', flagKey: '', message: '', destination: '/apoio' };
    case 'navigate':
      return { kind: 'navigate', destination: '/apoio' };
    case 'flow_start':
      return { kind: 'flow_start', flowId: flows[0]?.id ?? '' };
    case 'end_flow':
      return { kind: 'end_flow', message: '' };
  }
}

/** Narrowing helper: applies a patch only when the current effect kept its kind. */
function patchEffect<K extends FlowEffect['kind']>(
  kind: K,
  patch: (current: Extract<FlowEffect, { kind: K }>) => FlowEffect,
): (current: FlowEffect) => FlowEffect {
  // The generic kind check can't narrow the union for TS, hence the cast.
  return (current) => (current.kind === kind ? patch(current as Extract<FlowEffect, { kind: K }>) : current);
}

interface DestinationSelectProps {
  id: string;
  value: SafetyDestination;
  onChange: (next: SafetyDestination) => void;
}

/**
 * Closed select over the three supported navigation areas. Out-of-range legacy
 * values stay representable via an explicit `Destino ausente` option instead
 * of silently snapping to the first entry.
 */
function DestinationSelect({ id, value, onChange }: DestinationSelectProps) {
  const known = (SAFETY_DESTINATIONS as readonly string[]).includes(value);
  return (
    <select
      id={id}
      className={selectClassName}
      value={value}
      onChange={(event) => onChange(event.target.value as SafetyDestination)}
    >
      {(SAFETY_DESTINATIONS as readonly string[]).map((destination) => (
        <option key={destination} value={destination}>
          {destination}
        </option>
      ))}
      {/* Defensive for unvalidated legacy data: an empty value is a caller bug, not "missing data". */}
      {!known && (value as string) !== '' && <option value={value}>{`Destino ausente · ${value}`}</option>}
    </select>
  );
}

interface EffectTextFieldProps {
  id: string;
  label: string;
  value: string;
  onCommit: (next: string) => void;
  /** Renders a textarea instead of a single-line input. */
  multiline?: boolean;
}

/** Labeled (optionally multiline) text field with a per-field draft sentinel; commits onBlur like option labels. */
function EffectTextField({ id, label, value, onCommit, multiline = false }: EffectTextFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  if (multiline) {
    return (
      <>
        <label htmlFor={id} className={fieldLabelClassName}>
          {label}
        </label>
        <textarea
          id={id}
          className={`min-h-[60px] ${fieldClassName}`}
          value={draft ?? value}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            setDraft(null);
            if (draft !== null && draft !== value) onCommit(draft);
          }}
        />
      </>
    );
  }
  return (
    <>
      <label htmlFor={id} className={fieldLabelClassName}>
        {label}
      </label>
      <input
        id={id}
        className={fieldClassName}
        value={draft ?? value}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setDraft(null);
          if (draft !== null && draft !== value) onCommit(draft);
        }}
      />
    </>
  );
}

interface EffectNumberFieldProps {
  id: string;
  label: string;
  value: number;
  onCommit: (next: number) => void;
}

/**
 * Number input that never emits NaN: empty or non-numeric drafts are ignored
 * on blur and the committed payload always carries a real number.
 */
function EffectNumberField({ id, label, value, onCommit }: EffectNumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <>
      <label htmlFor={id} className={fieldLabelClassName}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className={fieldClassName}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setDraft(null);
          const trimmed = draft?.trim() ?? '';
          if (trimmed === '') return; // Number('') === 0, so guard before parsing.
          const parsed = Number(trimmed);
          if (!Number.isFinite(parsed) || parsed === value) return;
          onCommit(parsed);
        }}
      />
    </>
  );
}

interface EffectFieldsProps {
  effect: FlowEffect;
  effectIndex: number;
  optionId: string;
  flows: GuidedFlow[];
  /**
   * Updater-style field channel with the panel's one-commit-per-event
   * contract: each blur/change invokes it exactly once.
   */
  onEffectUpdate: (update: (current: FlowEffect) => FlowEffect) => void;
}

/** Expanded editors under the option row — one labeled block per present effect. */
export function EffectFields({ effect, effectIndex, optionId, flows, onEffectUpdate }: EffectFieldsProps) {
  const idPrefix = `${optionId}-effect-${effectIndex}`;
  switch (effect.kind) {
    case 'score':
      return (
        <>
          <EffectTextField
            id={`${idPrefix}-score-key`}
            label="Chave de pontuação"
            value={effect.scoreKey}
            onCommit={(scoreKey) => onEffectUpdate(patchEffect('score', (current) => ({ ...current, scoreKey })))}
          />
          <EffectNumberField
            id={`${idPrefix}-score-value`}
            label="Valor da pontuação"
            value={effect.value}
            onCommit={(value) => onEffectUpdate(patchEffect('score', (current) => ({ ...current, value })))}
          />
        </>
      );
    case 'safety_interrupt':
      return (
        <>
          <EffectTextField
            id={`${idPrefix}-message`}
            label="Mensagem da interrupção"
            value={effect.message}
            onCommit={(message) =>
              onEffectUpdate(patchEffect('safety_interrupt', (current) => ({ ...current, message })))
            }
          />
          <label htmlFor={`${idPrefix}-destination`} className={fieldLabelClassName}>
            Destino
          </label>
          <DestinationSelect
            id={`${idPrefix}-destination`}
            value={effect.destination}
            onChange={(destination) =>
              onEffectUpdate(patchEffect('safety_interrupt', (current) => ({ ...current, destination })))
            }
          />
          <label className="flex items-center gap-2 font-label-sm text-sm text-on-surface">
            <input
              type="checkbox"
              checked={effect.blockResume}
              onChange={(event) =>
                onEffectUpdate(
                  patchEffect('safety_interrupt', (current) => ({ ...current, blockResume: event.target.checked })),
                )
              }
            />
            Impede retorno
          </label>
        </>
      );
    case 'deferred_safety':
      return (
        <>
          <EffectTextField
            id={`${idPrefix}-flag-key`}
            label="Chave da sinalização"
            value={effect.flagKey}
            onCommit={(flagKey) =>
              onEffectUpdate(patchEffect('deferred_safety', (current) => ({ ...current, flagKey })))
            }
          />
          <EffectTextField
            id={`${idPrefix}-message`}
            label="Mensagem"
            value={effect.message}
            onCommit={(message) =>
              onEffectUpdate(patchEffect('deferred_safety', (current) => ({ ...current, message })))
            }
          />
          <label htmlFor={`${idPrefix}-destination`} className={fieldLabelClassName}>
            Destino
          </label>
          <DestinationSelect
            id={`${idPrefix}-destination`}
            value={effect.destination}
            onChange={(destination) =>
              onEffectUpdate(patchEffect('deferred_safety', (current) => ({ ...current, destination })))
            }
          />
        </>
      );
    case 'navigate':
      return (
        <>
          <label htmlFor={`${idPrefix}-destination`} className={fieldLabelClassName}>
            Destino
          </label>
          <DestinationSelect
            id={`${idPrefix}-destination`}
            value={effect.destination}
            onChange={(destination) =>
              onEffectUpdate(patchEffect('navigate', (current) => ({ ...current, destination })))
            }
          />
        </>
      );
    case 'flow_start': {
      const knownFlow = flows.some((candidate) => candidate.id === effect.flowId);
      return (
        <>
          <label htmlFor={`${idPrefix}-flow-id`} className={fieldLabelClassName}>
            Fluxo de destino
          </label>
          <select
            id={`${idPrefix}-flow-id`}
            className={selectClassName}
            value={effect.flowId}
            onChange={(event) =>
              onEffectUpdate(patchEffect('flow_start', (current) => ({ ...current, flowId: event.target.value })))
            }
          >
            {flows.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{`${candidate.title} (${candidate.id})`}</option>
            ))}
            {!knownFlow && effect.flowId !== '' && (
              <option value={effect.flowId}>{`Fluxo ausente · ${effect.flowId}`}</option>
            )}
          </select>
        </>
      );
    }
    case 'end_flow':
      return (
        <EffectTextField
          id={`${idPrefix}-message`}
          label="Mensagem de encerramento"
          value={effect.message}
          multiline
          onCommit={(message) => onEffectUpdate(patchEffect('end_flow', (current) => ({ ...current, message })))}
        />
      );
  }
}
