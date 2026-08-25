import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Flag, GitBranch, Search, Unplug, Workflow } from 'lucide-react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
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
  connected: boolean;
  selected: boolean;
  searchMatch: boolean;
  onOpenFlow: (flowId: string) => void;
};

type ExternalMapNodeData = { kind: 'external'; label: string; externalKind: ExternalKind };
type OverviewNodeData = FlowMapNodeData | ExternalMapNodeData;
type OverviewNode = Node<OverviewNodeData>;
type OverviewEdge = Edge<{ optionLabel: string; effectKind: ExternalKind }>;

function FlowOverviewNode({ data }: NodeProps<OverviewNode>) {
  if (data.kind !== 'flow') return null;
  return (
    <div
      className={`flow-overview-node${data.selected ? ' is-selected' : ''}${data.searchMatch ? ' is-search-match' : ''}${!data.connected ? ' is-disconnected' : ''}`}
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
        <Workflow aria-hidden="true" size={18} />
        <span className={`flow-overview-node__status flow-overview-node__status--${data.flow.status}`}>
          {STATUS_LABELS[data.flow.status]}
        </span>
      </div>
      <strong>{data.flow.title}</strong>
      <code>{data.flow.id}</code>
      <dl>
        <div>
          <dt>Etapas</dt>
          <dd>{data.steps}</dd>
        </div>
        <div>
          <dt>Finais</dt>
          <dd>{data.finals}</dd>
        </div>
        <div>
          <dt>Entradas</dt>
          <dd>{data.incoming}</dd>
        </div>
        <div>
          <dt>Saídas</dt>
          <dd>{data.outgoing}</dd>
        </div>
      </dl>
      {!data.connected && (
        <span className="flow-overview-node__disconnected">
          <Unplug aria-hidden="true" size={13} /> Sem conexões
        </span>
      )}
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

// Exported for deterministic layout tests; it does not hold React state.
// eslint-disable-next-line react-refresh/only-export-components
export function buildOverviewGraph(
  flows: GuidedFlow[],
  selectedFlowId: string,
  search: string,
  onOpenFlow: (flowId: string) => void,
): { nodes: OverviewNode[]; edges: OverviewEdge[] } {
  const topology = buildSystemFlowTopology(flows);
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const connectedSet = new Set(topology.connectedFlowIds);
  const connected = topology.flowNodes.filter((node) => node.connected);
  const disconnected = topology.flowNodes.filter((node) => !node.connected);
  const ordered = [...connected, ...disconnected];

  const flowNodes: OverviewNode[] = ordered.map((item, index) => {
    const disconnectedIndex = index - connected.length;
    const row = item.connected ? Math.floor(index / 3) : Math.floor(disconnectedIndex / 3);
    const column = item.connected ? index % 3 : disconnectedIndex % 3;
    const searchMatch =
      !normalizedSearch || `${item.title} ${item.flowId}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch);
    return {
      id: item.flowId,
      type: 'flowOverview',
      position: { x: column * 360, y: (item.connected ? 0 : 360) + row * 250 },
      data: {
        kind: 'flow',
        flow: item.flow,
        steps: item.stepCount,
        finals: item.finalCount,
        incoming: item.incomingCount,
        outgoing: item.outgoingCount,
        connected: connectedSet.has(item.flowId),
        selected: item.flowId === selectedFlowId,
        searchMatch,
        onOpenFlow,
      },
    };
  });

  const externalNodes: OverviewNode[] = topology.externalDestinations.map((destination, index) => ({
    id: destination.id,
    type: 'externalOverview',
    position: { x: 1100, y: index * 130 },
    data: {
      kind: 'external',
      label: destination.label,
      externalKind: destination.kind === 'missing_flow' ? 'missing_flow' : (destination.kind as ExternalKind),
    },
  }));

  const edges: OverviewEdge[] = topology.connections.map((connection) => ({
    id: connection.id,
    source: connection.sourceFlowId,
    target: connection.targetFlowId ?? connection.targetDestinationId ?? connection.target,
    type: 'smoothstep',
    label: connection.optionLabel ?? connection.label,
    data: {
      optionLabel: connection.optionLabel ?? connection.label ?? 'Transição',
      effectKind: connection.kind,
    },
    animated: connection.kind !== 'flow_start',
    style:
      connection.kind === 'flow_start'
        ? { stroke: 'var(--color-secondary)', strokeDasharray: '6 4' }
        : connection.kind === 'safety_interrupt'
          ? { stroke: 'var(--color-error)', strokeDasharray: '5 3' }
          : connection.kind === 'deferred_safety'
            ? { stroke: 'var(--color-warning)', strokeDasharray: '5 3' }
            : { stroke: 'var(--color-secondary)' },
    labelStyle: { fill: 'var(--color-on-surface-variant)', fontSize: 12, fontWeight: 600 },
    labelBgStyle: { fill: 'var(--color-surface-container-lowest)', fillOpacity: 0.96 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: connection.kind === 'safety_interrupt' ? 'var(--color-error)' : 'var(--color-secondary)',
    },
  }));

  return { nodes: [...flowNodes, ...externalNodes], edges };
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
  const disconnectedCount = graph.nodes.filter((node) => node.data.kind === 'flow' && !node.data.connected).length;

  return (
    <section className="flow-overview" aria-labelledby="flow-overview-title">
      <h2 id="flow-overview-title" className="sr-only">
        Visão geral
      </h2>
      <div className="flow-overview__summary" aria-label="Resumo do sistema">
        <span>
          <strong>{flows.length}</strong> fluxos
        </span>
        <span>
          <strong>{graph.edges.length}</strong> conexões
        </span>
        {disconnectedCount > 0 && (
          <span>
            <strong>{disconnectedCount}</strong> sem conexões
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
            placeholder="Buscar por título ou ID"
          />
        </label>
        <button
          type="button"
          className="flow-overview__fit"
          onClick={() => instance?.fitView({ padding: 0.18 })}
          disabled={!instance}
        >
          <GitBranch aria-hidden="true" size={16} /> Ajustar tudo
        </button>
      </div>
      <div className="flow-overview__canvas" data-testid="flow-overview-canvas" aria-label="Mapa geral dos fluxos">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.22}
          maxZoom={1.4}
          onInit={setInstance}
          proOptions={{ hideAttribution: false }}
        >
          <Background color="var(--color-outline-variant)" gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable ariaLabel="Minimapa dos fluxos" />
        </ReactFlow>
        {disconnectedCount > 0 && (
          <div className="flow-overview__disconnected-note">
            <Unplug aria-hidden="true" size={16} />{' '}
            {disconnectedCount === 1
              ? '1 fluxo sem conexões com outros fluxos'
              : `${disconnectedCount} fluxos sem conexões com outros fluxos`}
          </div>
        )}
      </div>
    </section>
  );
}
