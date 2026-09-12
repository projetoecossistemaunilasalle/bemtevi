import { AlertTriangle, Check, ExternalLink, Flag, ShieldAlert } from 'lucide-react';
import type { DestinationAnalysis } from './flowDestinationModels';

export interface FlowDestinationIndexProps {
  analysis: DestinationAnalysis;
  selectedDestination: string | null;
  onSelectDestination: (destinationId: string | null) => void;
  onOpenFlow: (flowId: string) => void;
}

export function FlowDestinationIndex({
  analysis,
  selectedDestination,
  onSelectDestination,
  onOpenFlow,
}: FlowDestinationIndexProps) {
  const reachableDestinations = analysis.destinations.filter((destination) => destination.reachable);

  return (
    <>
      <div className="flow-destination-map__stats" aria-label="Resumo estrutural">
        <span>
          <strong>{analysis.stats.nodes}</strong> etapas
        </span>
        <span>
          <strong>{analysis.stats.results}</strong> finais
        </span>
        <span>
          <strong>{analysis.stats.external}</strong> saídas externas
        </span>
        <span>
          <strong>{analysis.stats.handoffs}</strong> conexões com fluxos
        </span>
        <span>
          <strong>{analysis.stats.safety}</strong> rotas de segurança
        </span>
      </div>

      <div className="flow-destination-map__destinations" aria-label="Índice de destinos">
        <div className="flow-destination-map__destinations-heading">
          <span>Destinos</span>
          <small>{reachableDestinations.length} alcançáveis</small>
        </div>
        <div className="flow-destination-map__destination-list">
          {reachableDestinations.map((destination) => (
            <button
              key={destination.id}
              type="button"
              className={`flow-destination-chip flow-destination-chip--${destination.kind} ${selectedDestination === destination.id ? 'is-selected' : ''}`}
              aria-label={destination.kind === 'flow_start' ? `Abrir ${destination.label}` : undefined}
              onClick={() => {
                if (destination.kind === 'flow_start' && destination.flowId) {
                  onOpenFlow(destination.flowId);
                  return;
                }
                onSelectDestination(selectedDestination === destination.id ? null : destination.id);
              }}
              aria-pressed={destination.kind === 'flow_start' ? undefined : selectedDestination === destination.id}
            >
              {destination.kind === 'safety_interrupt' || destination.kind === 'deferred_safety' ? (
                <ShieldAlert aria-hidden="true" />
              ) : destination.kind === 'navigate' || destination.kind === 'flow_start' ? (
                <ExternalLink aria-hidden="true" />
              ) : destination.kind === 'missing' ? (
                <AlertTriangle aria-hidden="true" />
              ) : (
                <Flag aria-hidden="true" />
              )}
              {destination.label}
              {selectedDestination === destination.id && <Check aria-hidden="true" />}
            </button>
          ))}
          {reachableDestinations.length === 0 && (
            <span className="flow-destination-map__no-destinations">Nenhum destino terminal foi calculado.</span>
          )}
        </div>
      </div>
    </>
  );
}
