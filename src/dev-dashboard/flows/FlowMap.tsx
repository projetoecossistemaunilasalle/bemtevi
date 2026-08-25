import { useState } from 'react';
import { GitBranch, Map } from 'lucide-react';

import type { GuidedFlow } from '../../domain/flow-engine/types';
import { FlowDestinationMap } from './FlowDestinationMap';
import { FlowOverviewMap } from './FlowOverviewMap';
import './FlowMap.css';

type FlowMapMode = 'destination' | 'overview';

export function FlowMap({
  flow,
  flows,
  onFlowChange,
  onEditNode,
  onSelectFlow,
}: {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onEditNode: (flowId: string, nodeId: string) => void;
  onSelectFlow: (flowId: string) => void;
}) {
  const [mode, setMode] = useState<FlowMapMode>('destination');
  const isDestination = mode === 'destination';

  return (
    <section className="flow-visualizer" data-testid="flow-map-canvas">
      <header className="flow-visualizer__header">
        <div>
          <h2>{isDestination ? 'Mapa por destino' : 'Visão geral'}</h2>
          <p>
            {isDestination
              ? 'Veja todas as etapas e confirme onde cada escolha termina.'
              : 'Veja como os fluxos se conectam entre si e onde terminam fora do sistema.'}
          </p>
        </div>
        <div className="flow-view-toggle" aria-label="Modo de visualização">
          <button type="button" aria-pressed={isDestination} onClick={() => setMode('destination')}>
            <Map aria-hidden="true" /> Por destino
          </button>
          <button type="button" aria-pressed={!isDestination} onClick={() => setMode('overview')}>
            <GitBranch aria-hidden="true" /> Visão geral
          </button>
        </div>
      </header>

      {isDestination ? (
        <FlowDestinationMap flow={flow} flows={flows} onFlowChange={onFlowChange} onEditNode={onEditNode} />
      ) : (
        <FlowOverviewMap flows={flows} selectedFlowId={flow.id} onOpenFlow={onSelectFlow} />
      )}
    </section>
  );
}
