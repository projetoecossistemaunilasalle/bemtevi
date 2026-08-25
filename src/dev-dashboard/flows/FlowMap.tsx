import { useRef, useState } from 'react';
import { GitBranch, Map, Settings } from 'lucide-react';

import type { GuidedFlow } from '../../domain/flow-engine/types';
import { FlowDestinationMap } from './FlowDestinationMap';
import { FlowOverviewMap } from './FlowOverviewMap';
import { FlowSettingsPanel } from './FlowSettingsPanel';
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
  // Flow-level settings overlay, toggled from the header gear. Opening it
  // intentionally does NOT close an already-open node panel: the destination
  // map owns that panel's state, and the two overlays stacking on the right
  // edge (settings on top) is accepted overlap for now — each closes on its
  // own trigger/Escape.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);

  /** Single close path so Escape and ✕ both hand focus back to the trigger. */
  const handleCloseSettings = () => {
    setSettingsOpen(false);
    settingsTriggerRef.current?.focus();
  };

  const isDestination = mode === 'destination';

  return (
    <section className="flow-visualizer relative" data-testid="flow-map-canvas">
      <header className="flow-visualizer__header">
        <div>
          <h2>{isDestination ? 'Mapa por destino' : 'Visão geral'}</h2>
          <p>
            {isDestination
              ? 'Veja todas as etapas e confirme onde cada escolha termina.'
              : 'Veja como os fluxos se conectam entre si e onde terminam fora do sistema.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flow-view-toggle" aria-label="Modo de visualização">
            <button type="button" aria-pressed={isDestination} onClick={() => setMode('destination')}>
              <Map aria-hidden="true" /> Por destino
            </button>
            <button type="button" aria-pressed={!isDestination} onClick={() => setMode('overview')}>
              <GitBranch aria-hidden="true" /> Visão geral
            </button>
          </div>
          <button
            type="button"
            ref={settingsTriggerRef}
            aria-label="Configurações do fluxo"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Settings aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      {isDestination ? (
        <FlowDestinationMap flow={flow} flows={flows} onFlowChange={onFlowChange} onEditNode={onEditNode} />
      ) : (
        <FlowOverviewMap flows={flows} selectedFlowId={flow.id} onOpenFlow={onSelectFlow} />
      )}

      {settingsOpen && <FlowSettingsPanel flow={flow} onFlowChange={onFlowChange} onClose={handleCloseSettings} />}
    </section>
  );
}
