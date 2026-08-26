import { useEffect, useRef, useState } from 'react';
import { GitBranch, Map, Settings } from 'lucide-react';

import type { GuidedFlow } from '../../domain/flow-engine/types';
import { FlowDestinationMap, type MapFocusRequest } from './FlowDestinationMap';
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
  focusRequest,
}: {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onEditNode: (flowId: string, nodeId: string) => void;
  onSelectFlow: (flowId: string) => void;
  /**
   * Validation deep-link (see MapFocusRequest). Viewport chrome is applied
   * here exactly once per request: a `nodeId` target forces the destination
   * canvas and closes settings; a node-less ('configuracoes') target opens the
   * settings panel. The destination map owns selection/scrolling and reports
   * back via onFocusRequestApplied so mode toggles can't resurrect the link.
   * Handshake: the map holds a request until it applies or ignores it, then
   * calls onFocusRequestApplied exactly once per requestId — so only a NODE
   * target issued over the overview stays pending until that canvas mounts,
   * while a node-less target is fully applied on the spot (settings open) and
   * never stashed.
   */
  focusRequest?: MapFocusRequest | null;
}) {
  const [mode, setMode] = useState<FlowMapMode>('destination');
  // Flow-level settings overlay, toggled from the header gear. Opening it
  // intentionally does NOT close an already-open node panel: the destination
  // map owns that panel's state, and the two overlays stacking on the right
  // edge (settings on top) is accepted overlap for now — each closes on its
  // own trigger/Escape.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  // Latest deep-link not yet applied by the destination map; retired through
  // onFocusRequestApplied (the map remounts on mode toggles, so guarding here
  // keeps the request alive until it was actually seen).
  const [pendingFocusRequest, setPendingFocusRequest] = useState<MapFocusRequest | null>(null);

  const isDestination = mode === 'destination';

  // Latest mode, readable from the focus-request effect below WITHOUT adding
  // `mode` to its deps: re-running that effect on mode toggles would re-stash
  // an already-retired request and resurrect the deep-link.
  const isDestinationRef = useRef(true);
  useEffect(() => {
    isDestinationRef.current = isDestination;
  }, [isDestination]);

  useEffect(() => {
    // Consuming an externally-pushed request channel (validation summary
    // clicks arrive as props, not events here) — setState is the point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingFocusRequest(focusRequest ?? null);
    if (!focusRequest) return;
    if (focusRequest.nodeId) {
      // Node target: land on the destination canvas, settings out of the way.
      setMode('destination');
      setSettingsOpen(false);
    } else {
      // Flow-level target: surface the settings panel.
      setSettingsOpen(true);
      // Over the overview nothing would ever retire a stashed node-less
      // request (no destination map mounts to call onFocusRequestApplied), so
      // it would replay when that canvas later mounted. Opening settings IS
      // the whole application — drop the payload unless the map can retire it.
      if (!isDestinationRef.current) setPendingFocusRequest(null);
    }
  }, [focusRequest]);

  /** Single close path so Escape and ✕ both hand focus back to the trigger. */
  const handleCloseSettings = () => {
    setSettingsOpen(false);
    settingsTriggerRef.current?.focus();
  };

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
        <FlowDestinationMap
          // Remount per flow: selection, search and sequence expansions are
          // canvas-local state that must never survive a flow switch (also
          // cures panel context leaking across flows that reuse node ids).
          key={flow.id}
          flow={flow}
          flows={flows}
          onFlowChange={onFlowChange}
          onEditNode={onEditNode}
          onOpenFlow={onSelectFlow}
          focusRequest={pendingFocusRequest}
          onRequestSettingsOpen={() => setSettingsOpen(true)}
          onFocusRequestApplied={() => setPendingFocusRequest(null)}
        />
      ) : (
        <FlowOverviewMap flows={flows} selectedFlowId={flow.id} onOpenFlow={onSelectFlow} />
      )}

      {settingsOpen && <FlowSettingsPanel flow={flow} onFlowChange={onFlowChange} onClose={handleCloseSettings} />}
    </section>
  );
}
