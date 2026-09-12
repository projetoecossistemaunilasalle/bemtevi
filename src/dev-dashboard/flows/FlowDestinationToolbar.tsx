import type { KeyboardEvent, RefObject } from 'react';
import { Check, Expand, ListTree, Maximize2, Plus, Search } from 'lucide-react';
import type { FlowNode } from '../../domain/flow-engine/types';

export interface FlowDestinationToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  onExpandAllSequences: () => void;
  onCollapseAllSequences: () => void;
  onFitView: () => void;
  addStageOpen: boolean;
  onToggleAddStage: () => void;
  addStageTriggerRef: RefObject<HTMLButtonElement | null>;
  onAddStage: (kind: FlowNode['kind']) => void;
  onAddStageKeyDown: (event: KeyboardEvent) => void;
  hasMatches: boolean;
}

export function FlowDestinationToolbar({
  search,
  onSearchChange,
  showLabels,
  onToggleLabels,
  onExpandAllSequences,
  onCollapseAllSequences,
  onFitView,
  addStageOpen,
  onToggleAddStage,
  addStageTriggerRef,
  onAddStage,
  onAddStageKeyDown,
  hasMatches,
}: FlowDestinationToolbarProps) {
  return (
    <>
      <div className="flow-destination-map__toolbar">
        <label className="flow-destination-map__search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar etapa, identificador ou texto"
            aria-label="Buscar etapa"
          />
        </label>
        <button
          type="button"
          className="flow-destination-map__tool-button"
          aria-pressed={showLabels}
          onClick={onToggleLabels}
        >
          <span className="flow-destination-map__toggle-mark">{showLabels && <Check aria-hidden="true" />}</span>{' '}
          Mostrar destinos nas opções
        </button>
        <button type="button" className="flow-destination-map__tool-button" onClick={onExpandAllSequences}>
          <Expand aria-hidden="true" /> Expandir sequências
        </button>
        <button type="button" className="flow-destination-map__tool-button" onClick={onCollapseAllSequences}>
          <ListTree aria-hidden="true" /> Compactar sequências
        </button>
        <button type="button" className="flow-destination-map__tool-button" onClick={onFitView}>
          <Maximize2 aria-hidden="true" /> Ajustar tudo
        </button>
        <div role="group" aria-label="Adicionar etapa" className="relative">
          <button
            ref={addStageTriggerRef}
            type="button"
            className="flow-destination-map__tool-button"
            aria-haspopup="true"
            aria-expanded={addStageOpen}
            onKeyDown={onAddStageKeyDown}
            onClick={onToggleAddStage}
          >
            <Plus aria-hidden="true" /> Criar sem conectar
          </button>
          {addStageOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 flex w-40 flex-col gap-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 shadow-lg">
              <button
                type="button"
                className="flow-destination-map__tool-button justify-start"
                onKeyDown={onAddStageKeyDown}
                onClick={() => onAddStage('choice')}
              >
                Pergunta
              </button>
              <button
                type="button"
                className="flow-destination-map__tool-button justify-start"
                onKeyDown={onAddStageKeyDown}
                onClick={() => onAddStage('result')}
              >
                Final
              </button>
              <button
                type="button"
                className="flow-destination-map__tool-button justify-start"
                onKeyDown={onAddStageKeyDown}
                onClick={() => onAddStage('score_branch')}
              >
                Ramificação
              </button>
            </div>
          )}
        </div>
      </div>
      {search.trim() && !hasMatches && (
        <p className="flow-destination-map__search-note" role="status">
          Nenhuma etapa corresponde à busca.
        </p>
      )}
    </>
  );
}
