import { useCallback, useMemo, useRef, useState } from 'react';
import { Unplug } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './FlowDestinationMap.css';

import type { GuidedFlow } from '../../domain/flow-engine/types';
import { topologyFor } from './flowDestinationAnalysis';
import { createDestinationPresentation } from './flowDestinationPresentation';
import type { MapFocusRequest } from './flowDisplay';
import { FlowDestinationCanvas } from './FlowDestinationCanvas';
import { FlowDestinationIndex } from './FlowDestinationIndex';
import { FlowDestinationSelection } from './FlowDestinationSelection';
import { FlowDestinationToolbar } from './FlowDestinationToolbar';
import { NodeEditorPanel } from './NodeEditorPanel';
import { useFlowDestinationCanvas } from './useFlowDestinationCanvas';
import { useFlowDestinationEditing } from './useFlowDestinationEditing';

export type { MapFocusRequest } from './flowDisplay';

/**
 * Selection semantics for a focusRequest, applied once per requestId:
 * - with `nodeId`: selects that stage (unknown ids are ignored — the flow may
 *   have changed under the summary); the panel remounts and its own requestId
 *   effect scrolls to `section`.
 * - without `nodeId` (flow-level 'configuracoes'): clears any node selection so
 *   the settings overlay stands alone and notifies `onRequestSettingsOpen`.
 * Calls `onFocusRequestApplied` afterwards so the owner can retire the request
 * and mode toggles won't resurrect it.
 */
export function FlowDestinationMap({
  flow,
  flows,
  onFlowChange,
  onEditNode,
  onOpenFlow,
  focusRequest,
  onRequestSettingsOpen,
  onFocusRequestApplied,
}: {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onEditNode: (flowId: string, nodeId: string) => void;
  onOpenFlow: (flowId: string) => void;
  focusRequest?: MapFocusRequest | null;
  /** Wired by FlowMap to its settings toggle; safe to call repeatedly. */
  onRequestSettingsOpen?: () => void;
  /** Retires the applied request upstream, keyed by its requestId. */
  onFocusRequestApplied?: (requestId: number) => void;
}) {
  const analysis = useMemo(() => topologyFor(flow, flows), [flow, flows]);
  const [expandedSequences, setExpandedSequences] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const addStageTriggerRef = useRef<HTMLButtonElement>(null);

  const toggleSequence = useCallback((id: string) => {
    setExpandedSequences((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const {
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    panelFocusRequest,
    setPanelFocusRequest,
    addStageOpen,
    setAddStageOpen,
    handleAddConnectedStage,
    handleApplyTerminalEffect,
    handleFocusSection,
    handleAddOption,
    handleAddBranch,
    onConnect,
    handleNodeClick,
    handleCloseNodePanel,
    handleAddStage,
    handleAddStageKeyDown,
  } = useFlowDestinationEditing({
    flow,
    onFlowChange,
    focusRequest,
    onRequestSettingsOpen,
    onFocusRequestApplied,
    addStageTriggerRef,
  });

  const presentation = useMemo(
    () =>
      createDestinationPresentation(
        analysis,
        flows,
        expandedSequences,
        search,
        selectedDestination,
        showLabels,
        toggleSequence,
        onOpenFlow,
        handleAddConnectedStage,
        handleApplyTerminalEffect,
        handleAddOption,
        handleAddBranch,
        selectedNodeId,
        panelFocusRequest,
        handleFocusSection,
      ),
    [
      analysis,
      expandedSequences,
      flows,
      handleAddBranch,
      handleAddConnectedStage,
      handleAddOption,
      handleApplyTerminalEffect,
      handleFocusSection,
      onOpenFlow,
      panelFocusRequest,
      search,
      selectedDestination,
      selectedNodeId,
      showLabels,
      toggleSequence,
    ],
  );

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setRfInstance,
    handleEdgeClick,
    compactViewport,
    onMoveStart,
    onMoveEnd,
  } = useFlowDestinationCanvas({ presentation });

  const selectedDestinationData = analysis.destinations.find((destination) => destination.id === selectedDestination);
  const unreachableNodes = analysis.nodes.filter((node) => !node.reachable && node.node);

  if (Object.keys(flow.nodes).length === 0) {
    return (
      <section className="flow-destination-map" data-testid="flow-destination-map">
        <div className="flow-destination-map__empty">
          <Unplug aria-hidden="true" />
          <h3>Este fluxo ainda não possui etapas.</h3>
          <p>Use o botão + Criar sem conectar acima para organizar seus destinos.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flow-destination-map" data-testid="flow-destination-map">
      <h2 className="sr-only">Mapa por destino</h2>
      <FlowDestinationIndex
        analysis={analysis}
        selectedDestination={selectedDestination}
        onSelectDestination={setSelectedDestination}
        onOpenFlow={onOpenFlow}
      />

      <FlowDestinationToolbar
        search={search}
        onSearchChange={setSearch}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((current) => !current)}
        onExpandAllSequences={() => setExpandedSequences(new Set(analysis.sequences.map((sequence) => sequence.id)))}
        onCollapseAllSequences={() => setExpandedSequences(new Set())}
        onFitView={() => canvasRef.current?.querySelector<HTMLElement>('.react-flow__controls-fitview')?.click()}
        addStageOpen={addStageOpen}
        onToggleAddStage={() => setAddStageOpen((current) => !current)}
        addStageTriggerRef={addStageTriggerRef}
        onAddStage={handleAddStage}
        onAddStageKeyDown={handleAddStageKeyDown}
        hasMatches={presentation.hasMatches}
      />

      <FlowDestinationCanvas
        canvasRef={canvasRef}
        flowTitle={flow.title}
        hasSelectedNode={Boolean(selectedNode)}
        unreachableNodes={unreachableNodes}
        onSelectNode={(nodeId) => {
          setSelectedNodeId(nodeId);
          setPanelFocusRequest(null);
        }}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onConnect={onConnect}
        onInit={setRfInstance}
        onEdgeClick={handleEdgeClick}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        compactViewport={compactViewport}
      />

      <FlowDestinationSelection
        selectedDestinationData={selectedDestinationData}
        hasSelectedNode={Boolean(selectedNode)}
        onClearSelection={() => setSelectedDestination(null)}
      />

      {selectedNode && (
        <NodeEditorPanel
          key={selectedNode.id}
          flow={flow}
          flows={flows}
          nodeId={selectedNode.id}
          onFlowChange={onFlowChange}
          onClose={handleCloseNodePanel}
          onEditLegacy={() => onEditNode(flow.id, selectedNode.id)}
          focusRequest={panelFocusRequest ?? undefined}
        />
      )}
    </section>
  );
}
