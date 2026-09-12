import { useEffect, useMemo, useRef, useState } from 'react';
import type { FlowPurpose, GuidedFlow } from '../../domain/flow-engine/types';
import { STATUS_LABELS } from './flowDisplay';
import { DraftTextAreaField, DraftTextField, textFieldClassName } from './flowEditorFields';
import { flowPurposeLabels } from './flowLabels';
import { selectClassName } from './flowEffectFields';
import { setEntryNode, updateFlowSettings } from './flowMutations';
import { TargetSelect } from './flowTargetSelect';
import { buildFlowTopology } from './flowTopology';

const sectionHeadingClassName = 'font-label-sm text-xs text-on-surface-variant';

/** Union members from the domain types, verbatim; typed so a renamed or removed member fails to compile. */
const PURPOSE_OPTIONS: FlowPurpose[] = ['orientation_entry', 'post_flow_routing'];
const KNOWN_PURPOSES = new Set<string>(PURPOSE_OPTIONS);

interface EnteringPhrasesSectionProps {
  flow: GuidedFlow;
  /** Receives the mutated `entry` record for one narrow `{entry}` patch per commit. */
  onEntryChange: (entry: GuidedFlow['entry']) => void;
}

/**
 * One input row per phrase, plus rows appended locally via “Adicionar frase”
 * that only materialize in the flow once they carry committed text.
 *
 * EVERY commit recomputes the FULL list: committed phrases merged with all
 * pending drafts, each entry trimmed and blanks dropped. Partial edits can
 * therefore never interleave or clobber sibling rows, and an empty result is
 * committed as `[]` (validation flags the missing phrases downstream).
 */
function EnteringPhrasesSection({ flow, onEntryChange }: EnteringPhrasesSectionProps) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [addedRows, setAddedRows] = useState(0);
  // Set when “Adicionar frase” appends a row; the new input's ref callback
  // consumes it and focuses the element straight after commit.
  const shouldFocusAppendedRef = useRef(false);

  const committed = flow.entry.enteringPhrases;
  const rowCount = committed.length + addedRows;
  const displayValue = (index: number) => drafts[index] ?? committed[index] ?? '';

  /** Focuses the last row right after it mounts when an append requested it. */
  const attachRowRef = (index: number) => (element: HTMLInputElement | null) => {
    if (!element || index !== rowCount - 1) return;
    if (shouldFocusAppendedRef.current) {
      shouldFocusAppendedRef.current = false;
      element.focus();
    }
  };

  /**
   * Merges every pending draft into the committed list (trimmed, blanks
   * dropped) and commits via updateFlowSettings when anything changed,
   * resetting the local view so it matches the new committed list. Returns
   * whether a commit happened; no-op calls keep unrelated pending drafts and
   * untouched appended rows alive.
   */
  const commitMergedPhrases = (options: { skipIndex?: number } = {}): boolean => {
    const list: string[] = [];
    for (let index = 0; index < rowCount; index += 1) {
      if (index === options.skipIndex) continue;
      const trimmed = displayValue(index).trim();
      if (trimmed !== '') list.push(trimmed);
    }
    const unchanged = list.length === committed.length && list.every((phrase, index) => phrase === committed[index]);
    if (!unchanged) {
      onEntryChange(updateFlowSettings(flow, { enteringPhrases: list }).entry);
      setDrafts({});
      setAddedRows(0);
    }
    return !unchanged;
  };

  return (
    <>
      {Array.from({ length: rowCount }, (_, index) => (
        <div key={index} className="flex items-center gap-1">
          <input
            aria-label={`Frase de entrada ${index + 1}`}
            className={textFieldClassName}
            ref={attachRowRef(index)}
            value={displayValue(index)}
            onChange={(event) => setDrafts((current) => ({ ...current, [index]: event.target.value }))}
            onBlur={() => {
              // Clear this row's draft BEFORE the merge reads the render's
              // snapshot: the merge still sees it, and a no-op falls back to
              // the normalized committed value.
              setDrafts((current) => {
                if (!(index in current)) return current;
                const { [index]: _cleared, ...rest } = current;
                return rest;
              });
              commitMergedPhrases();
            }}
          />
          <button
            type="button"
            aria-label={`Remover frase ${index + 1}`}
            onClick={() => {
              // Removal commits immediately through the same merge path.
              if (commitMergedPhrases({ skipIndex: index })) return;
              // No-op removal: removing a COMMITTED phrase always shrinks the
              // list, so only an untouched appended row can land here. Drop
              // the row from the local view AND any draft parked on it, so a
              // stale draft can't reattach to a later appended row.
              setDrafts((current) => {
                const { [index]: _dropped, ...rest } = current;
                return rest;
              });
              setAddedRows((count) => Math.max(0, count - 1));
            }}
            className="shrink-0 self-stretch rounded-full px-2 font-label-sm text-xs text-on-surface-variant transition-colors hover:bg-error-container/60 hover:text-on-error-container"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          shouldFocusAppendedRef.current = true;
          setAddedRows((count) => count + 1);
        }}
        className="self-start rounded-full px-2 py-1 font-label-sm text-xs text-primary transition-colors hover:bg-surface-container"
      >
        Adicionar frase
      </button>
    </>
  );
}

export interface FlowSettingsPanelProps {
  flow: GuidedFlow;
  /**
   * Same narrow-patch channel as the node editor: emit ONLY the keys each
   * edit actually touched (`{title}`, `{purpose}`, `{status}`, `{entry}`).
   * Handlers resolve against the flow props current at event time.
   */
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onClose: () => void;
}

/**
 * Flow-level settings overlay mounted by FlowMap beside its mode toggle:
 * title, purpose, status, entry stage and entering phrases, forwarded as
 * narrow patches through the map's `onFlowChange`.
 *
 * Escape anywhere inside the panel closes it; focus restoration to the
 * trigger is the opener's job (handled via `onClose` in FlowMap).
 */
export function FlowSettingsPanel({ flow, onFlowChange, onClose }: FlowSettingsPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Topology feeds the entry select. Only this flow's nodes matter here, so a
  // singleton list keeps cross-flow destinations out of the grouping.
  const topology = useMemo(() => buildFlowTopology(flow, [flow]), [flow]);

  // Grab focus so Escape works immediately after opening, before the user
  // tabs into any field (the container itself isn't in the tab order).
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const purposeValue = flow.purpose ?? '';

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- WAI-ARIA dialogs dismiss on Escape from the dialog element itself; the rule can't tell this container is the dialog, not a static wrapper.
    <div
      ref={containerRef}
      data-testid="flow-settings-panel"
      role="dialog"
      aria-label="Configurações do fluxo"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="absolute right-0 top-0 z-10 flex h-full w-80 flex-col gap-3 overflow-y-auto border-l border-outline-variant/50 bg-surface-container-lowest p-4 shadow-lg focus:outline-none"
    >
      <header className="flex items-start justify-between gap-2">
        <h2 className="font-label-md text-on-surface">Configurações do fluxo</h2>
        <button
          type="button"
          aria-label="Fechar configurações"
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
      </header>

      <section className="flex flex-col gap-1">
        <h3 className={sectionHeadingClassName}>Título do fluxo</h3>
        <DraftTextField ariaLabel="Título do fluxo" value={flow.title} onCommit={(title) => onFlowChange({ title })} />
      </section>

      <section className="flex flex-col gap-1">
        <h3 className={sectionHeadingClassName}>Uso do fluxo</h3>
        {/* Selects don't blur reliably; commit the purpose immediately on change. */}
        <select
          aria-label="Uso do fluxo"
          className={selectClassName}
          value={purposeValue}
          onChange={(event) => {
            const { value } = event.target;
            if (value === '') return; // placeholder below is representational only
            onFlowChange({ purpose: value as FlowPurpose });
          }}
        >
          {/*
            Representable-value convention: keep the current value selectable
            even when it sits outside the union (or is unset), instead of
            silently rendering the first option.
          */}
          {purposeValue === '' && <option value="">— sem uso definido —</option>}
          {purposeValue !== '' && !KNOWN_PURPOSES.has(purposeValue) && (
            <option value={purposeValue}>{`Uso desconhecido · ${purposeValue}`}</option>
          )}
          {PURPOSE_OPTIONS.map((purpose) => (
            <option key={purpose} value={purpose}>
              {flowPurposeLabels[purpose]}
            </option>
          ))}
        </select>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className={sectionHeadingClassName}>Status</h3>
        <select
          aria-label="Status do fluxo"
          className={selectClassName}
          value={flow.status}
          onChange={(event) => onFlowChange({ status: event.target.value as GuidedFlow['status'] })}
        >
          {(Object.entries(STATUS_LABELS) as Array<[GuidedFlow['status'], string]>).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className={sectionHeadingClassName}>Etapa de entrada</h3>
        <TargetSelect
          ariaLabel="Etapa de entrada"
          value={flow.entry.nodeId}
          allowEmpty={false}
          nodes={topology.nodes}
          onChange={(nodeId) => onFlowChange({ entry: setEntryNode(flow, nodeId).entry })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={sectionHeadingClassName}>Frases de entrada</h3>
        <EnteringPhrasesSection flow={flow} onEntryChange={(entry) => onFlowChange({ entry })} />
      </section>

      <section className="flex flex-col gap-1">
        <h3 className={sectionHeadingClassName}>Mensagem antes do fluxo</h3>
        <DraftTextAreaField
          ariaLabel="Mensagem antes do fluxo"
          value={flow.entry.transitionMessage}
          onCommit={(transitionMessage) =>
            onFlowChange({ entry: updateFlowSettings(flow, { transitionMessage }).entry })
          }
        />
      </section>
    </div>
  );
}
