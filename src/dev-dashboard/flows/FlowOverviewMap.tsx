import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dagre from '@dagrejs/dagre';
import { AlertTriangle, ExternalLink, Flag, GitBranch, Search, Unplug, Workflow } from 'lucide-react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './FlowOverviewMap.css';

import type { GuidedFlow } from '../../domain/flow-engine/types';
import { STATUS_LABELS } from './flowDisplay';
import { buildSystemFlowTopology, type SystemFlowConnectionKind } from './flowTopology';

type ExternalKind = SystemFlowConnectionKind | 'missing_flow';

type FlowMapNodeData = {
  kind: 'flow';
  flow: GuidedFlow;
  steps: number;
  finals: number;
  incoming: number;
  outgoing: number;
  selected: boolean;
  searchMatch: boolean;
  onOpenFlow: (flowId: string) => void;
};

type ExternalMapNodeData = { kind: 'external'; label: string; externalKind: ExternalKind };
type OverviewNodeData = FlowMapNodeData | ExternalMapNodeData;
type OverviewNode = Node<OverviewNodeData>;
type OverviewEdge = Edge<{ optionLabels: string[]; count: number; effectKind: ExternalKind; related: boolean }>;

const FLOW_NODE_WIDTH = 272;
const FLOW_NODE_HEIGHT = 140;
const DESTINATION_NODE_WIDTH = 220;
const DESTINATION_NODE_HEIGHT = 58;

function FlowOverviewNode({ data }: NodeProps<OverviewNode>) {
  if (data.kind !== 'flow') return null;
  return (
    <div
      className={`flow-overview-node${data.selected ? ' is-selected' : ''}${data.searchMatch ? ' is-search-match' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${data.flow.title}, ${STATUS_LABELS[data.flow.status]}, ${data.steps} etapas, ${data.finals} finais`}
      onClick={() => data.onOpenFlow(data.flow.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          data.onOpenFlow(data.flow.id);
        }
      }}
    >
      <Handle type="target" position={Position.Left} className="flow-overview-node__handle" />
      <div className="flow-overview-node__header">
        <Workflow aria-hidden="true" size={17} />
        <span className={`flow-overview-node__status flow-overview-node__status--${data.flow.status}`}>
          {STATUS_LABELS[data.flow.status]}
        </span>
      </div>
      <strong>{data.flow.title}</strong>
      <code>{data.flow.id}</code>
      <div className="flow-overview-node__facts">
        <span>
          <b>{data.steps}</b> etapas · <b>{data.finals}</b> finais
        </span>
        <span>
          <b>{data.incoming}</b> entradas · <b>{data.outgoing}</b> saídas
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="flow-overview-node__handle" />
    </div>
  );
}

function ExternalOverviewNode({ data }: NodeProps<OverviewNode>) {
  if (data.kind !== 'external') return null;
  const Icon =
    data.externalKind === 'end_flow'
      ? Flag
      : data.externalKind === 'safety_interrupt' || data.externalKind === 'deferred_safety'
        ? AlertTriangle
        : ExternalLink;
  return (
    <div className={`flow-overview-external flow-overview-external--${data.externalKind}`} role="status">
      <Handle type="target" position={Position.Left} className="flow-overview-external__handle" />
      <Icon aria-hidden="true" size={17} />
      <span>{data.label}</span>
    </div>
  );
}

const nodeTypes = { flowOverview: FlowOverviewNode, externalOverview: ExternalOverviewNode };

function edgeColor(kind: ExternalKind) {
  if (kind === 'safety_interrupt') return 'var(--color-error)';
  if (kind === 'deferred_safety') return 'var(--color-warning)';
  if (kind === 'end_flow') return 'var(--color-outline)';
  return 'var(--color-secondary)';
}

function layoutGraph(nodes: OverviewNode[], edges: OverviewEdge[]) {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 58, edgesep: 24, marginx: 26, marginy: 34 });

  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: node.data.kind === 'flow' ? FLOW_NODE_WIDTH : DESTINATION_NODE_WIDTH,
      height: node.data.kind === 'flow' ? FLOW_NODE_HEIGHT : DESTINATION_NODE_HEIGHT,
    });
  });
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);

  return nodes.map((node) => {
    const point = graph.node(node.id);
    const width = node.data.kind === 'flow' ? FLOW_NODE_WIDTH : DESTINATION_NODE_WIDTH;
    const height = node.data.kind === 'flow' ? FLOW_NODE_HEIGHT : DESTINATION_NODE_HEIGHT;
    return { ...node, position: { x: point.x - width / 2, y: point.y - height / 2 } };
  });
}

// Exported for deterministic topology tests; it does not hold React state.
// eslint-disable-next-line react-refresh/only-export-components
export function buildOverviewGraph(
  flows: GuidedFlow[],
  selectedFlowId: string,
  search: string,
  onOpenFlow: (flowId: string) => void,
): { nodes: OverviewNode[]; edges: OverviewEdge[]; disconnectedFlows: GuidedFlow[] } {
  const topology = buildSystemFlowTopology(flows);
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const connectedFlowNodes = topology.flowNodes.filter((node) => node.connected);
  const disconnectedFlows = topology.flowNodes.filter((node) => !node.connected).map((node) => node.flow);

  const flowNodes: OverviewNode[] = connectedFlowNodes.map((item) => ({
    id: item.flowId,
    type: 'flowOverview',
    position: { x: 0, y: 0 },
    data: {
      kind: 'flow',
      flow: item.flow,
      steps: item.stepCount,
      finals: item.finalCount,
      incoming: item.incomingCount,
      outgoing: item.outgoingCount,
      selected: item.flowId === selectedFlowId,
      searchMatch: Boolean(
        normalizedSearch && `${item.title} ${item.flowId}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch),
      ),
      onOpenFlow,
    },
  }));

  const externalNodes: OverviewNode[] = topology.externalDestinations.map((destination) => ({
    id: destination.id,
    type: 'externalOverview',
    position: { x: 0, y: 0 },
    data: {
      kind: 'external',
      label: destination.label,
      externalKind: destination.kind === 'missing_flow' ? 'missing_flow' : (destination.kind as ExternalKind),
    },
  }));

  const aggregated = new Map<
    string,
    { source: string; target: string; kind: ExternalKind; labels: string[]; count: number }
  >();
  topology.connections.forEach((connection) => {
    const target = connection.targetFlowId ?? connection.targetDestinationId ?? connection.target;
    const key = `${connection.sourceFlowId}::${target}::${connection.kind}`;
    const existing = aggregated.get(key);
    const label = connection.optionLabel ?? connection.label ?? 'Transição';
    if (existing) {
      existing.count += 1;
      if (!existing.labels.includes(label)) existing.labels.push(label);
      return;
    }
    aggregated.set(key, {
      source: connection.sourceFlowId,
      target,
      kind: connection.kind,
      labels: [label],
      count: 1,
    });
  });

  const edges: OverviewEdge[] = [...aggregated.entries()].map(([id, connection]) => {
    const related = connection.source === selectedFlowId || connection.target === selectedFlowId;
    const color = edgeColor(connection.kind);
    return {
      id,
      source: connection.source,
      target: connection.target,
      type: 'smoothstep',
      className: 'flow-overview__edge',
      interactionWidth: 24,
      focusable: true,
      data: {
        optionLabels: connection.labels,
        count: connection.count,
        effectKind: connection.kind,
        related,
      },
      ariaLabel: `${connection.count} conexão(ões): ${connection.labels.join(', ')}`,
      style: {
        stroke: color,
        strokeDasharray: connection.kind === 'flow_start' ? '7 5' : undefined,
        strokeWidth: related ? 2.6 : 1.1,
        opacity: related ? 1 : 0.14,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    };
  });

  const nodes = layoutGraph([...flowNodes, ...externalNodes], edges);
  return { nodes, edges, disconnectedFlows };
}

export function FlowOverviewMap({
  flows,
  selectedFlowId,
  onOpenFlow,
}: {
  flows: GuidedFlow[];
  selectedFlowId: string;
  onOpenFlow: (flowId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [instance, setInstance] = useState<ReactFlowInstance<OverviewNode, OverviewEdge> | null>(null);
  const graph = useMemo(
    () => buildOverviewGraph(flows, selectedFlowId, search, onOpenFlow),
    [flows, onOpenFlow, search, selectedFlowId],
  );
  const compactViewport = typeof window !== 'undefined' && window.innerWidth <= 620;
  const connectedFlowCount = graph.nodes.filter((node) => node.data.kind === 'flow').length;
  const edgePointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isPanningRef = useRef(false);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      edgePointerDownRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  const handleEdgeClick = useCallback(
    (event: { clientX: number; clientY: number }, edge: OverviewEdge) => {
      if (isPanningRef.current) return;
      const down = edgePointerDownRef.current;
      if (down) {
        const dx = event.clientX - down.x;
        const dy = event.clientY - down.y;
        const dist = Math.hypot(dx, dy);
        const elapsed = Date.now() - down.time;
        if (dist > 8 || elapsed > 700) return;
      }
      const targetId = edge.target;
      if (!targetId) return;
      const rfNode = instance?.getNode(targetId);
      const fallbackNode = graph.nodes.find((node) => node.id === targetId);
      const position = rfNode?.position ?? fallbackNode?.position;
      if (!position) return;
      const isFlow =
        (rfNode?.data as OverviewNodeData | undefined)?.kind === 'flow' ||
        (fallbackNode?.data as OverviewNodeData | undefined)?.kind === 'flow';
      const width = rfNode?.measured?.width ?? (isFlow ? FLOW_NODE_WIDTH : DESTINATION_NODE_WIDTH);
      const height = rfNode?.measured?.height ?? (isFlow ? FLOW_NODE_HEIGHT : DESTINATION_NODE_HEIGHT);
      const centerX = position.x + width / 2;
      const centerY = position.y + height / 2;
      const zoom = instance?.getZoom() ?? 0.84;
      try {
        instance?.setCenter(centerX, centerY, { zoom, duration: 420 });
      } catch {
        instance?.setCenter(centerX, centerY, { zoom });
      }
    },
    [graph.nodes, instance],
  );

  const handleInit = (flowInstance: ReactFlowInstance<OverviewNode, OverviewEdge>) => {
    setInstance(flowInstance);
    if (!compactViewport) return;

    const selectedNode = graph.nodes.find((node) => node.id === selectedFlowId);
    if (!selectedNode) return;
    const width = selectedNode.data.kind === 'flow' ? FLOW_NODE_WIDTH : DESTINATION_NODE_WIDTH;
    const height = selectedNode.data.kind === 'flow' ? FLOW_NODE_HEIGHT : DESTINATION_NODE_HEIGHT;
    void flowInstance.setCenter(selectedNode.position.x + width / 2, selectedNode.position.y + height / 2, {
      zoom: 0.78,
    });
  };

  return (
    <section className="flow-overview" aria-labelledby="flow-overview-title">
      <h2 id="flow-overview-title" className="sr-only">
        Visão geral
      </h2>
      <div className="flow-overview__summary" aria-label="Resumo do sistema">
        <span>
          <strong>{flows.length}</strong> {flows.length === 1 ? 'fluxo' : 'fluxos'}
        </span>
        <span>
          <strong>{connectedFlowCount}</strong> {connectedFlowCount === 1 ? 'conectado' : 'conectados'}
        </span>
        <span>
          <strong>{graph.edges.length}</strong> {graph.edges.length === 1 ? 'relação' : 'relações'}
        </span>
        {graph.disconnectedFlows.length > 0 && (
          <span>
            <strong>{graph.disconnectedFlows.length}</strong>{' '}
            {graph.disconnectedFlows.length === 1 ? 'sem conexão' : 'sem conexões'}
          </span>
        )}
      </div>
      <div className="flow-overview__toolbar">
        <label className="flow-overview__search">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Buscar fluxo</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por título ou identificador"
          />
        </label>
        <button
          type="button"
          className="flow-overview__fit"
          onClick={() => instance?.fitView({ padding: 0.14, maxZoom: 0.92 })}
          disabled={!instance}
        >
          <GitBranch aria-hidden="true" size={16} /> Ajustar tudo
        </button>
      </div>

      {graph.disconnectedFlows.length > 0 && (
        <div className="flow-overview__disconnected" aria-label="Fluxos sem conexões">
          <span>
            <Unplug aria-hidden="true" size={15} /> Sem conexões
          </span>
          <div>
            {graph.disconnectedFlows.map((flow) => (
              <button
                key={flow.id}
                type="button"
                className={
                  search.trim() &&
                  `${flow.title} ${flow.id}`
                    .toLocaleLowerCase('pt-BR')
                    .includes(search.trim().toLocaleLowerCase('pt-BR'))
                    ? 'is-search-match'
                    : ''
                }
                onClick={() => onOpenFlow(flow.id)}
              >
                {flow.title} <small>{flow.id}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flow-overview__canvas" data-testid="flow-overview-canvas" aria-label="Mapa geral dos fluxos">
        <div className="flow-overview__guide" aria-hidden="true">
          As linhas destacadas pertencem ao fluxo selecionado · clique na linha para ir ao destino · clique no fluxo
          para abrir
        </div>
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          fitView={!compactViewport}
          fitViewOptions={{ padding: 0.14, maxZoom: 0.92 }}
          minZoom={0.22}
          maxZoom={1.4}
          onInit={handleInit}
          onEdgeClick={handleEdgeClick}
          onMoveStart={() => {
            isPanningRef.current = true;
          }}
          onMoveEnd={() => {
            window.setTimeout(() => {
              isPanningRef.current = false;
            }, 120);
          }}
          proOptions={{ hideAttribution: false }}
        >
          <Background color="var(--color-outline-variant)" gap={28} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
