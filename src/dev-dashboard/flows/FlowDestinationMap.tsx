import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Expand,
  ExternalLink,
  Flag,
  ListTree,
  Maximize2,
  Plus,
  Search,
  ShieldAlert,
  Unplug,
  X,
} from 'lucide-react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './FlowDestinationMap.css';

import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import { FlowDestinationNode } from './FlowDestinationNode';
import { topologyFor } from './flowDestinationAnalysis';
import { NODE_WIDTH } from './flowDestinationLayout';
import type { DestinationRFEdge, DestinationRFNode } from './flowDestinationModels';
import { createDestinationPresentation } from './flowDestinationPresentation';
import type { MapFocusRequest, MapFocusSection } from './flowDisplay';
import {
  addBranch,
  addNode,
  addOption,
  applyTerminalEffect,
  connectSource,
  type ConnectionSource,
  type TerminalDestination,
} from './flowMutations';
import { NodeEditorPanel } from './NodeEditorPanel';
import { previewFlowText } from './flowText';

export type { MapFocusRequest } from './flowDisplay';

const MemoizedDestinationNode = memo(FlowDestinationNode);
const destinationNodeTypes = {
  choice: MemoizedDestinationNode,
  score_branch: MemoizedDestinationNode,
  result: MemoizedDestinationNode,
  destination: MemoizedDestinationNode,
  sequence: MemoizedDestinationNode,
  missing: MemoizedDestinationNode,
};

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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  /**
   * Section target held for the node panel. Kept separate from the upstream
   * focusRequest because the owner retires that one the same commit a
   * deep-link selection lands — one commit BEFORE the panel mounts, so the
   * panel would never see it. Manual selections below clear it.
   */
  const [panelFocusRequest, setPanelFocusRequest] = useState<{
    section?: MapFocusSection;
    targetId?: string;
    requestId: number;
  } | null>(null);
  const [addStageOpen, setAddStageOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const addStageTriggerRef = useRef<HTMLButtonElement>(null);
  const compactViewport = typeof window !== 'undefined' && window.innerWidth <= 620;
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<DestinationRFNode, DestinationRFEdge> | null>(null);
  const edgePointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isPanningRef = useRef(false);

  const toggleSequence = useCallback((id: string) => {
    setExpandedSequences((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddConnectedStage = useCallback(
    (source: ConnectionSource, kind: FlowNode['kind']) => {
      const { flow: nextFlow, nodeId: newNodeId } = addNode(flow, { kind, connectFrom: source });
      onFlowChange({ nodes: nextFlow.nodes, ...(nextFlow.nodeOrder ? { nodeOrder: nextFlow.nodeOrder } : {}) });
      setSelectedNodeId(newNodeId);
      setPanelFocusRequest(null);
    },
    [flow, onFlowChange],
  );

  const handleApplyTerminalEffect = useCallback(
    (source: ConnectionSource, destination: TerminalDestination) => {
      const { flow: nextFlow, applied } = applyTerminalEffect(flow, source, destination);
      if (applied) {
        onFlowChange({ nodes: nextFlow.nodes });
      }
    },
    [flow, onFlowChange],
  );

  const handleFocusSection = useCallback((nodeId: string, section: MapFocusSection, targetId?: string) => {
    setSelectedNodeId(nodeId);
    setPanelFocusRequest({ section, targetId, requestId: Date.now() });
  }, []);

  const handleAddOption = useCallback(
    (nodeId: string) => {
      const { flow: nextFlow, optionId } = addOption(flow, nodeId);
      onFlowChange({ nodes: nextFlow.nodes });
      setSelectedNodeId(nodeId);
      setPanelFocusRequest({ section: 'opcao', targetId: optionId, requestId: Date.now() });
    },
    [flow, onFlowChange],
  );

  const handleAddBranch = useCallback(
    (nodeId: string) => {
      const { flow: nextFlow, branchId } = addBranch(flow, nodeId);
      onFlowChange({ nodes: nextFlow.nodes });
      setSelectedNodeId(nodeId);
      setPanelFocusRequest({ section: 'faixa', targetId: branchId, requestId: Date.now() });
    },
    [flow, onFlowChange],
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      edgePointerDownRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const sourceNode = flow.nodes[connection.source];
      if (!sourceNode) return;

      let source: ConnectionSource | undefined;
      if (sourceNode.kind === 'choice') {
        if (connection.sourceHandle === 'free-text') {
          source = { kind: 'free_text', nodeId: sourceNode.id };
        } else if (connection.sourceHandle) {
          source = { kind: 'option', nodeId: sourceNode.id, optionId: connection.sourceHandle };
        }
      } else if (sourceNode.kind === 'score_branch') {
        if (connection.sourceHandle) {
          source = { kind: 'branch', nodeId: sourceNode.id, branchId: connection.sourceHandle };
        }
      }

      if (!source) return;

      if (connection.target.startsWith('destination:navigate:')) {
        const dest = connection.target.replace('destination:navigate:', '') as '/apoio' | '/contatos' | '/educacao';
        const { flow: nextFlow, applied } = applyTerminalEffect(flow, source, { kind: 'navigate', destination: dest });
        if (applied) onFlowChange({ nodes: nextFlow.nodes });
        return;
      }

      if (connection.target.startsWith('destination:flow_start:')) {
        const targetFlowId = connection.target.replace('destination:flow_start:', '');
        const { flow: nextFlow, applied } = applyTerminalEffect(flow, source, {
          kind: 'flow_start',
          flowId: targetFlowId,
        });
        if (applied) onFlowChange({ nodes: nextFlow.nodes });
        return;
      }

      if (connection.target.startsWith('destination:end_flow:')) {
        const { flow: nextFlow, applied } = applyTerminalEffect(flow, source, { kind: 'end_flow', message: '' });
        if (applied) onFlowChange({ nodes: nextFlow.nodes });
        return;
      }

      if (connection.target.startsWith('destination:result:')) {
        const targetNodeId = connection.target.replace('destination:result:', '');
        const { flow: nextFlow, connected } = connectSource(flow, source, targetNodeId);
        if (connected) onFlowChange({ nodes: nextFlow.nodes });
        return;
      }

      if (flow.nodes[connection.target]) {
        const { flow: nextFlow, connected } = connectSource(flow, source, connection.target);
        if (connected) {
          onFlowChange({ nodes: nextFlow.nodes, ...(nextFlow.nodeOrder ? { nodeOrder: nextFlow.nodeOrder } : {}) });
        }
      }
    },
    [flow, onFlowChange],
  );

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
  const [nodes, setNodes, onNodesChange] = useNodesState<DestinationRFNode>(presentation.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DestinationRFEdge>(presentation.edges);
  useEffect(() => {
    setNodes(presentation.nodes);
    setEdges(presentation.edges);
  }, [presentation.edges, presentation.nodes, setEdges, setNodes]);

  const handleEdgeClick = useCallback(
    (_event: { clientX: number; clientY: number }, edge: DestinationRFEdge) => {
      if (isPanningRef.current) return;
      const down = edgePointerDownRef.current;
      if (down) {
        const dx = _event.clientX - down.x;
        const dy = _event.clientY - down.y;
        const dist = Math.hypot(dx, dy);
        const elapsed = Date.now() - down.time;
        if (dist > 8 || elapsed > 700) return;
      }
      const targetId = edge.target;
      if (!targetId) return;
      const rfNode = rfInstance?.getNode(targetId);
      const fallbackNode = nodes.find((node) => node.id === targetId);
      const position = rfNode?.position ?? fallbackNode?.position;
      if (!position) return;
      const width = rfNode?.measured?.width ?? fallbackNode?.measured?.width ?? NODE_WIDTH;
      const height = rfNode?.measured?.height ?? fallbackNode?.measured?.height ?? 110;
      const centerX = position.x + width / 2;
      const centerY = position.y + height / 2;
      const zoom = rfInstance?.getZoom() ?? 0.88;
      try {
        rfInstance?.setCenter(centerX, centerY, { zoom, duration: 420 });
      } catch {
        rfInstance?.setCenter(centerX, centerY, { zoom });
      }
    },
    [rfInstance, nodes],
  );

  const selectedNode = selectedNodeId ? (flow.nodes[selectedNodeId] ?? null) : null;
  const selectedDestinationData = analysis.destinations.find((destination) => destination.id === selectedDestination);
  const unreachableNodes = analysis.nodes.filter((node) => !node.reachable && node.node);
  const handleNodeClick: NodeMouseHandler<DestinationRFNode> = useCallback(
    (event, node) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, [role="menu"], .flow-destination-quick-menu, .nodrag, .nopan')) {
        return;
      }
      if (flow.nodes[node.id]) {
        setSelectedNodeId(node.id);
        setPanelFocusRequest(null);
      }
    },
    [flow.nodes],
  );

  /** Clears the selection and best-effort restores focus to the canvas node. */
  const handleCloseNodePanel = useCallback(() => {
    const nodeId = selectedNodeId;
    setSelectedNodeId(null);
    setPanelFocusRequest(null);
    // React Flow nodes aren't guaranteed focusable — absence is silent.
    document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`)?.focus?.();
  }, [selectedNodeId]);

  /**
   * Appends a stage via the pure mutation and forwards only the keys it
   * touched ({nodes} plus nodeOrder when present), like the editor panel.
   */
  const handleAddStage = useCallback(
    (kind: FlowNode['kind']) => {
      const { flow: nextFlow, nodeId: newNodeId } = addNode(flow, { kind });
      onFlowChange({ nodes: nextFlow.nodes, ...(nextFlow.nodeOrder ? { nodeOrder: nextFlow.nodeOrder } : {}) });
      setAddStageOpen(false);
      setSelectedNodeId(newNodeId);
      setPanelFocusRequest(null);
      // Keep the keyboard origin stable once the popover disappears.
      addStageTriggerRef.current?.focus();
    },
    [flow, onFlowChange],
  );

  /** Escape dismisses the add-stage popover from wherever focus sits inside it. */
  const handleAddStageKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!addStageOpen || event.key !== 'Escape') return;
      setAddStageOpen(false);
      addStageTriggerRef.current?.focus();
    },
    [addStageOpen],
  );

  // Validation deep-links: selection semantics per the MapFocusRequest contract.
  // Applying an externally-pushed request channel IS state mutation by design,
  // so the no-setState-in-effect rule is scoped off for exactly this body.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.nodeId) {
      // Unknown ids are ignored: the flow may have changed under the summary.
      if (flow.nodes[focusRequest.nodeId]) {
        setSelectedNodeId(focusRequest.nodeId);
        setPanelFocusRequest({ section: focusRequest.section, requestId: focusRequest.requestId });
      }
    } else {
      setSelectedNodeId(null);
      setPanelFocusRequest(null);
      onRequestSettingsOpen?.();
    }
    onFocusRequestApplied?.(focusRequest.requestId);
    // Keyed on requestId only so repeated identical requests re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.requestId]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
          <small>{analysis.destinations.filter((destination) => destination.reachable).length} alcançáveis</small>
        </div>
        <div className="flow-destination-map__destination-list">
          {analysis.destinations
            .filter((destination) => destination.reachable)
            .map((destination) => (
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
                  setSelectedDestination(selectedDestination === destination.id ? null : destination.id);
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
          {analysis.destinations.filter((destination) => destination.reachable).length === 0 && (
            <span className="flow-destination-map__no-destinations">Nenhum destino terminal foi calculado.</span>
          )}
        </div>
      </div>

      <div className="flow-destination-map__toolbar">
        <label className="flow-destination-map__search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar etapa, identificador ou texto"
            aria-label="Buscar etapa"
          />
        </label>
        <button
          type="button"
          className="flow-destination-map__tool-button"
          aria-pressed={showLabels}
          onClick={() => setShowLabels((current) => !current)}
        >
          <span className="flow-destination-map__toggle-mark">{showLabels && <Check aria-hidden="true" />}</span>{' '}
          Mostrar destinos nas opções
        </button>
        <button
          type="button"
          className="flow-destination-map__tool-button"
          onClick={() => setExpandedSequences(new Set(analysis.sequences.map((sequence) => sequence.id)))}
        >
          <Expand aria-hidden="true" /> Expandir sequências
        </button>
        <button
          type="button"
          className="flow-destination-map__tool-button"
          onClick={() => setExpandedSequences(new Set())}
        >
          <ListTree aria-hidden="true" /> Compactar sequências
        </button>
        <button
          type="button"
          className="flow-destination-map__tool-button"
          onClick={() => canvasRef.current?.querySelector<HTMLElement>('.react-flow__controls-fitview')?.click()}
        >
          <Maximize2 aria-hidden="true" /> Ajustar tudo
        </button>
        <div role="group" aria-label="Adicionar etapa" className="relative">
          <button
            ref={addStageTriggerRef}
            type="button"
            className="flow-destination-map__tool-button"
            aria-haspopup="true"
            aria-expanded={addStageOpen}
            onKeyDown={handleAddStageKeyDown}
            onClick={() => setAddStageOpen((current) => !current)}
          >
            <Plus aria-hidden="true" /> Criar sem conectar
          </button>
          {addStageOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 flex w-40 flex-col gap-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 shadow-lg">
              <button
                type="button"
                className="flow-destination-map__tool-button justify-start"
                onKeyDown={handleAddStageKeyDown}
                onClick={() => handleAddStage('choice')}
              >
                Pergunta
              </button>
              <button
                type="button"
                className="flow-destination-map__tool-button justify-start"
                onKeyDown={handleAddStageKeyDown}
                onClick={() => handleAddStage('result')}
              >
                Final
              </button>
              <button
                type="button"
                className="flow-destination-map__tool-button justify-start"
                onKeyDown={handleAddStageKeyDown}
                onClick={() => handleAddStage('score_branch')}
              >
                Ramificação
              </button>
            </div>
          )}
        </div>
      </div>
      {search.trim() && !presentation.hasMatches && (
        <p className="flow-destination-map__search-note" role="status">
          Nenhuma etapa corresponde à busca.
        </p>
      )}

      {unreachableNodes.length > 0 && (
        <div className="flow-destination-map__unreachable-strip" aria-label="Etapas fora do caminho de entrada">
          <span>
            <AlertTriangle aria-hidden="true" /> Fora da entrada
          </span>
          <div>
            {unreachableNodes.map((item) => (
              <button
                key={item.id}
                type="button"
                className="nodrag nopan"
                onClick={() => {
                  setSelectedNodeId(item.id);
                  setPanelFocusRequest(null);
                }}
              >
                Etapa {item.order + 1} <small>{previewFlowText(item.node?.text ?? item.id, 34)}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={canvasRef}
        className={`flow-destination-map__canvas ${selectedNode ? 'flow-destination-map__canvas--with-panel' : ''}`}
        aria-label={`Mapa por destino do fluxo ${flow.title}`}
      >
        <div className="flow-destination-map__canvas-guide" aria-hidden="true">
          Arraste para navegar · clique na linha para ir ao destino · clique na etapa para editar
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={destinationNodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onConnect={onConnect}
          onInit={setRfInstance}
          onEdgeClick={handleEdgeClick}
          onMoveStart={() => {
            isPanningRef.current = true;
          }}
          onMoveEnd={() => {
            window.setTimeout(() => {
              isPanningRef.current = false;
            }, 120);
          }}
          fitView={!compactViewport}
          defaultViewport={compactViewport ? { x: 20, y: 24, zoom: 0.72 } : undefined}
          fitViewOptions={{ padding: 0.14, maxZoom: 1.08 }}
          minZoom={0.18}
          maxZoom={1.5}
          proOptions={{ hideAttribution: false }}
        >
          <Background color="var(--color-outline-variant)" gap={28} size={1} />
          <Controls showInteractive={false} />
          {nodes.length > 10 && <MiniMap pannable zoomable ariaLabel="Minimapa do fluxo" />}
        </ReactFlow>
      </div>

      {selectedDestinationData && (
        <div
          className={`flow-destination-map__selection ${selectedNode ? 'flow-destination-map__selection--clear-of-panel' : ''}`}
          role="status"
        >
          <span>
            <Check aria-hidden="true" /> Destino selecionado
          </span>
          <strong>{selectedDestinationData.label}</strong>
          <small>{selectedDestinationData.sources.size} etapa(s) conseguem alcançar este destino.</small>
          <button type="button" aria-label="Limpar destino selecionado" onClick={() => setSelectedDestination(null)}>
            <X aria-hidden="true" />
          </button>
        </div>
      )}

      {selectedNode && (
        <NodeEditorPanel
          // Remount per node: the panel's text guard assumes unmount on switch.
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
