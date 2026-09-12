import { Check, X } from 'lucide-react';
import type { Destination } from './flowDestinationModels';

export interface FlowDestinationSelectionProps {
  selectedDestinationData: Destination | null | undefined;
  hasSelectedNode: boolean;
  onClearSelection: () => void;
}

export function FlowDestinationSelection({
  selectedDestinationData,
  hasSelectedNode,
  onClearSelection,
}: FlowDestinationSelectionProps) {
  if (!selectedDestinationData) return null;

  return (
    <div
      className={`flow-destination-map__selection ${hasSelectedNode ? 'flow-destination-map__selection--clear-of-panel' : ''}`}
      role="status"
    >
      <span>
        <Check aria-hidden="true" /> Destino selecionado
      </span>
      <strong>{selectedDestinationData.label}</strong>
      <small>{selectedDestinationData.sources.size} etapa(s) conseguem alcançar este destino.</small>
      <button type="button" aria-label="Limpar destino selecionado" onClick={onClearSelection}>
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
