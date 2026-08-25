import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Expand,
  ExternalLink,
  Flag,
  GitBranch,
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
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './FlowDestinationMap.css';

import type { FlowEffect, FlowNode, FlowOption, GuidedFlow } from '../../domain/flow-engine/types';
import { addNode } from './flowMutations';
import { NodeEditorPanel } from './NodeEditorPanel';
import { buildFlowTopology } from './flowTopology';

type DestinationKind =
  | 'result'
  | 'navigate'
  | 'safety_interrupt'
  | 'deferred_safety'
  | 'flow_start'
  | 'end_flow'
  | 'missing';

type Destination = {
  id: string;
  kind: DestinationKind;
  label: string;
  detail?: string;
  nodeId?: string;
  sources: Set<string>;
};

type Transition = {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  label: string;
  kind:
    | 'normal'
    | 'flow_start'
    | 'navigate'
    | 'safety_interrupt'
    | 'deferred_safety'
    | 'end_flow'
    | 'missing'
    | 'score_branch';
  badge?: string;
};

type AnalysisNode = {
  id: string;
  node?: FlowNode;
  depth: number | null;
  reachable: boolean;
  order: number;
  destinations: Set<string>;
  cycle?: boolean;
};

type SequenceGroup = {
  id: string;
  nodeIds: string[];
};

type Analysis = {
  nodes: AnalysisNode[];
  transitions: Transition[];
  destinations: Destination[];
  sequences: SequenceGroup[];
  stats: { nodes: number; results: number; external: number; handoffs: number; safety: number };
  maxDepth: number;
};

type DestinationNodeData = {
  kind: 'choice' | 'score_branch' | 'result' | 'destination' | 'sequence' | 'missing';
  node?: FlowNode;
  stepLabel?: string;
  nodeIds?: string[];
  destination?: Destination;
  matched?: boolean;
  highlighted?: boolean;
  expanded?: boolean;
  cycle?: boolean;
  onToggleSequence?: () => void;
};

type DestinationRFNode = Node<DestinationNodeData>;
type DestinationRFEdge = Edge<{ kind: Transition['kind']; optionLabel: string; badge?: string }>;

const NODE_WIDTH = 286;
const COLUMN_GAP = 188;
const ROW_GAP = 42;

function textPreview(value: string, max = 76) {
  const compact = value.trim().replace(/\s+/g, ' ');
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function stableNodes(flow: GuidedFlow) {
  const order = flow.nodeOrder ?? [];
  const rank = new Map(order.map((id, index) => [id, index]));
  return Object.values(flow.nodes).sort((a, b) => {
    const byOrder = (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    return byOrder || a.id.localeCompare(b.id);
  });
}

function optionEffect(option: FlowOption, kind: FlowEffect['kind']) {
  return option.effects?.find((effect) => effect.kind === kind);
}

function optionTerminal(option: FlowOption) {
  const effects = option.effects ?? [];
  return (
    effects.find((effect) => effect.kind === 'safety_interrupt') ??
    effects.find((effect) => effect.kind === 'navigate') ??
    effects.find((effect) => effect.kind === 'end_flow')
  );
}

function destinationId(kind: DestinationKind, value: string) {
  return `destination:${kind}:${value}`;
}

function buildLocalAnalysis(flow: GuidedFlow, flows: GuidedFlow[]): Analysis {
  const flowNodes = stableNodes(flow);
  const byId = new Map(flowNodes.map((node) => [node.id, node]));
  const transitions: Transition[] = [];
  const destinations = new Map<string, Destination>();
  const addDestination = (id: string, kind: DestinationKind, label: string, detail?: string) => {
    const existing = destinations.get(id);
    if (existing) return existing;
    const created: Destination = { id, kind, label, detail, sources: new Set() };
    destinations.set(id, created);
    return created;
  };
  const addTransition = (
    source: string,
    sourceHandle: string,
    target: string,
    label: string,
    kind: Transition['kind'],
    badge?: string,
  ) => {
    const transition: Transition = {
      id: `${source}:${sourceHandle}:${target}:${transitions.length}`,
      source,
      sourceHandle,
      target,
      label,
      kind,
      badge,
    };
    transitions.push(transition);
    return transition;
  };

  for (const node of flowNodes) {
    if (node.kind === 'result') {
      const id = destinationId('result', node.id);
      const result = addDestination(id, 'result', `${node.id} · ${textPreview(node.text, 48)}`);
      result.nodeId = node.id;
      continue;
    }
    if (node.kind === 'choice') {
      for (const option of node.options) {
        const terminal = optionTerminal(option);
        const score = optionEffect(option, 'score');
        const badge = score && score.kind === 'score' ? `+${score.value} · ${score.scoreKey}` : undefined;
        if (terminal?.kind === 'safety_interrupt' || terminal?.kind === 'navigate') {
          const id = destinationId(terminal.kind, terminal.destination);
          addDestination(
            id,
            terminal.kind,
            terminal.kind === 'safety_interrupt'
              ? `Segurança imediata · ${terminal.destination}`
              : terminal.destination,
            terminal.destination,
          ).sources.add(node.id);
          addTransition(node.id, option.id, id, option.label, terminal.kind, badge);
        } else if (terminal?.kind === 'end_flow') {
          const id = destinationId('end_flow', 'end');
          addDestination(id, 'end_flow', 'Encerramento', terminal.message).sources.add(node.id);
          addTransition(node.id, option.id, id, option.label, 'end_flow', badge);
        } else if (optionEffect(option, 'flow_start')?.kind === 'flow_start') {
          const effect = optionEffect(option, 'flow_start');
          if (effect?.kind !== 'flow_start') continue;
          const targetFlow = flows.find((candidate) => candidate.id === effect.flowId);
          const id = targetFlow
            ? destinationId('flow_start', targetFlow.id)
            : destinationId('missing', `flow:${effect.flowId}`);
          addDestination(
            id,
            targetFlow ? 'flow_start' : 'missing',
            targetFlow ? `Fluxo · ${targetFlow.title}` : `Fluxo ausente · ${effect.flowId}`,
            targetFlow ? `Entrada: ${targetFlow.entry.nodeId}` : effect.flowId,
          ).sources.add(node.id);
          addTransition(node.id, option.id, id, option.label, targetFlow ? 'flow_start' : 'missing', badge);
        } else {
          const target = byId.get(option.next);
          const targetId = target ? target.id : destinationId('missing', option.next);
          if (!target)
            addDestination(targetId, 'missing', `Destino ausente · ${option.next}`, option.next).sources.add(node.id);
          addTransition(node.id, option.id, targetId, option.label, target ? 'normal' : 'missing', badge);
        }
        const deferred = optionEffect(option, 'deferred_safety');
        if (deferred?.kind === 'deferred_safety') {
          const id = destinationId('deferred_safety', deferred.destination);
          addDestination(
            id,
            'deferred_safety',
            `Segurança ao concluir · ${deferred.destination}`,
            deferred.destination,
          ).sources.add(node.id);
          addTransition(node.id, `${option.id}:deferred`, id, 'ao concluir', 'deferred_safety');
        }
      }
      if (node.freeText) {
        const target = byId.get(node.freeText.next);
        const targetId = target ? target.id : destinationId('missing', node.freeText.next);
        if (!target)
          addDestination(
            targetId,
            'missing',
            `Destino ausente · ${node.freeText.next}`,
            node.freeText.next,
          ).sources.add(node.id);
        addTransition(node.id, 'free-text', targetId, 'Resposta livre', target ? 'normal' : 'missing');
      }
    } else {
      for (const branch of node.branches) {
        if (branch.navigation) {
          const id = destinationId('navigate', branch.navigation);
          addDestination(id, 'navigate', branch.navigation, branch.navigation).sources.add(node.id);
          addTransition(node.id, branch.id, id, `${branch.min}–${branch.max}`, 'navigate');
          continue;
        }
        const target = byId.get(branch.next);
        const targetId = target ? target.id : destinationId('missing', branch.next);
        if (!target)
          addDestination(targetId, 'missing', `Destino ausente · ${branch.next}`, branch.next).sources.add(node.id);
        const badge = branch.navigation ? `→ ${branch.navigation}` : undefined;
        addTransition(
          node.id,
          branch.id,
          targetId,
          `${branch.min}–${branch.max}`,
          target ? 'score_branch' : 'missing',
          badge,
        );
      }
    }
  }

  for (const node of flowNodes) {
    const resultDestination = destinations.get(destinationId('result', node.id));
    if (resultDestination) resultDestination.sources.add(node.id);
  }

  const adjacency = new Map<string, string[]>();
  for (const node of flowNodes) adjacency.set(node.id, []);
  for (const transition of transitions) {
    const resultDestination =
      byId.get(transition.target)?.kind === 'result'
        ? destinations.get(destinationId('result', transition.target))
        : undefined;
    if (resultDestination) resultDestination.sources.add(transition.source);
    if (byId.has(transition.target)) adjacency.get(transition.source)?.push(transition.target);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  if (byId.has(flow.entry.nodeId)) {
    depth.set(flow.entry.nodeId, 0);
    queue.push(flow.entry.nodeId);
  }
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, (depth.get(current) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  const maxDepth = Math.max(0, ...depth.values());
  const analysisNodes: AnalysisNode[] = flowNodes.map((node, order) => ({
    id: node.id,
    node,
    depth: depth.get(node.id) ?? null,
    reachable: depth.has(node.id),
    order,
    destinations: new Set(),
  }));
  const cycleNodes = new Set<string>();
  const colors = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const visitCycle = (id: string) => {
    colors.set(id, 1);
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      if (colors.get(next) === 1) {
        const start = stack.indexOf(next);
        stack.slice(start < 0 ? 0 : start).forEach((cycleId) => cycleNodes.add(cycleId));
      } else if (!colors.has(next)) visitCycle(next);
    }
    stack.pop();
    colors.set(id, 2);
  };
  for (const node of flowNodes) if (!colors.has(node.id)) visitCycle(node.id);
  analysisNodes.forEach((node) => {
    node.cycle = cycleNodes.has(node.id);
  });
  const nodeById = new Map(analysisNodes.map((node) => [node.id, node]));
  for (const destination of destinations.values()) {
    const pending = [...destination.sources];
    const seen = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      nodeById.get(current)?.destinations.add(destination.id);
      for (const transition of transitions) {
        if (transition.target === current) pending.push(transition.source);
      }
    }
  }

  const sequences: SequenceGroup[] = [];
  const included = new Set<string>();
  const localOutgoing = (id: string) => [...new Set((adjacency.get(id) ?? []).filter((target) => byId.has(target)))];
  const localIncoming = (id: string) =>
    transitions.filter((transition) => transition.target === id).map((transition) => transition.source);
  for (const node of analysisNodes) {
    if (!node.reachable || !node.node || node.node.kind === 'result' || node.cycle || included.has(node.id)) continue;
    const outgoing = localOutgoing(node.id);
    const incoming = localIncoming(node.id);
    const isStart = node.id === flow.entry.nodeId || incoming.some((source) => localOutgoing(source).length !== 1);
    if (!isStart || outgoing.length !== 1) continue;
    const ids = [node.id];
    let current = outgoing[0];
    while (ids.length < 50) {
      const candidate = nodeById.get(current);
      if (!candidate?.reachable || !candidate.node || candidate.node.kind === 'result') break;
      const next = localOutgoing(current);
      const prev = localIncoming(current);
      if (next.length !== 1 || prev.length === 0 || prev.some((source) => source !== ids[ids.length - 1])) break;
      if (ids.includes(current)) break;
      ids.push(current);
      current = next[0];
    }
    if (ids.length >= 4) {
      ids.forEach((id) => included.add(id));
      sequences.push({ id: `sequence:${ids[0]}:${ids[ids.length - 1]}`, nodeIds: ids });
    }
  }

  const resultDestinations = [...destinations.values()].filter((destination) => destination.kind === 'result');
  const externalDestinations = [...destinations.values()].filter((destination) => destination.kind !== 'result');
  return {
    nodes: analysisNodes,
    transitions,
    destinations: [...resultDestinations, ...externalDestinations],
    sequences,
    stats: {
      nodes: flowNodes.length,
      results: resultDestinations.length,
      external: externalDestinations.filter(
        (destination) =>
          destination.kind === 'navigate' ||
          destination.kind === 'safety_interrupt' ||
          destination.kind === 'deferred_safety',
      ).length,
      handoffs: externalDestinations.filter((destination) => destination.kind === 'flow_start').length,
      safety: transitions.filter(
        (transition) => transition.kind === 'safety_interrupt' || transition.kind === 'deferred_safety',
      ).length,
    },
    maxDepth,
  };
}

function callTopologyBuilder(flow: GuidedFlow, flows: GuidedFlow[]) {
  try {
    const builder = buildFlowTopology as unknown as (...args: unknown[]) => unknown;
    return builder(flow, flows);
  } catch {
    return undefined;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function normalizeTopology(value: unknown): Analysis | undefined {
  const topology = record(value);
  const rawNodes = topology?.nodes;
  const rawEdges = topology?.edges;
  const rawDestinations = topology?.destinations;
  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges) || !Array.isArray(rawDestinations)) return undefined;

  const destinations: Destination[] = rawDestinations.map((value, index) => {
    const item = record(value) ?? {};
    const rawKind = stringValue(item.kind);
    const kind: DestinationKind =
      rawKind === 'missing_node' || rawKind === 'missing_flow'
        ? 'missing'
        : ((rawKind as DestinationKind) ?? 'missing');
    return {
      id: stringValue(item.id) ?? `destination:missing:${index}`,
      kind,
      label: stringValue(item.label) ?? 'Destino ausente',
      detail: stringValue(item.value) ?? stringValue(item.target),
      nodeId: stringValue(item.nodeId) ?? stringValue(item.targetNodeId),
      sources: new Set(
        Array.isArray(item.sourceNodeIds)
          ? item.sourceNodeIds.filter((id): id is string => typeof id === 'string')
          : [],
      ),
    };
  });
  const destinationIds = new Set(destinations.map((destination) => destination.id));
  const analysisNodes: AnalysisNode[] = rawNodes.map((value, order) => {
    const item = record(value) ?? {};
    const node = record(item.node) as unknown as FlowNode | undefined;
    const rawDestinationsForNode = Array.isArray(item.reverseReachableDestinationIds)
      ? item.reverseReachableDestinationIds
      : Array.isArray(item.destinationIds)
        ? item.destinationIds
        : [];
    return {
      id: stringValue(item.id) ?? node?.id ?? `node-${order}`,
      node,
      depth: typeof item.depth === 'number' ? item.depth : null,
      reachable: item.reachable === true,
      order: typeof item.order === 'number' ? item.order : order,
      destinations: new Set(
        rawDestinationsForNode.filter((id): id is string => typeof id === 'string' && destinationIds.has(id)),
      ),
      cycle: item.inCycle === true,
    };
  });
  const transitions: Transition[] = rawEdges.flatMap((value, index) => {
    const item = record(value) ?? {};
    const rawKind = stringValue(item.kind) ?? stringValue(item.type) ?? 'normal';
    const kind: Transition['kind'] =
      rawKind === 'free_text' || rawKind === 'score'
        ? 'normal'
        : rawKind === 'missing_node' || rawKind === 'missing_flow'
          ? 'missing'
          : (rawKind as Transition['kind']);
    const score = record(item.score);
    const scoreLabel =
      score && typeof score.value === 'number'
        ? `+${score.value} · ${stringValue(score.scoreKey) ?? ''}`.replace(/ · $/, '')
        : undefined;
    const primary: Transition = {
      id: stringValue(item.id) ?? `edge-${index}`,
      source: stringValue(item.sourceNodeId) ?? stringValue(item.source) ?? '',
      sourceHandle: stringValue(item.sourceHandle) ?? `source-${index}`,
      target: stringValue(item.target) ?? stringValue(item.targetNodeId) ?? '',
      label: stringValue(item.label) ?? stringValue(item.optionLabel) ?? '',
      kind,
      badge: scoreLabel ?? (record(item.scoreRange)?.label as string | undefined),
    };
    const secondaryDestinationId = stringValue(item.secondaryDestinationId);
    if (!secondaryDestinationId) return [primary];
    return [
      primary,
      {
        id: `${primary.id}__secondary`,
        source: primary.source,
        sourceHandle: `${primary.sourceHandle}__secondary`,
        target: secondaryDestinationId,
        label: 'ao concluir',
        kind: 'navigate',
      },
    ];
  });
  const sequences: SequenceGroup[] = (
    Array.isArray(topology.sequences)
      ? topology.sequences
      : Array.isArray(topology.linearSequences)
        ? topology.linearSequences
        : []
  ).flatMap((value) => {
    const item = record(value);
    if (!item || !Array.isArray(item.nodeIds)) return [];
    return [
      {
        id: stringValue(item.id) ?? `sequence:${item.nodeIds.join(':')}`,
        nodeIds: item.nodeIds.filter((id): id is string => typeof id === 'string'),
      },
    ];
  });
  const rawMetrics = record(topology.metrics) ?? {};
  const maxDepth = Math.max(0, ...analysisNodes.map((node) => node.depth ?? 0));
  const resultCount =
    typeof rawMetrics.resultCount === 'number'
      ? rawMetrics.resultCount
      : destinations.filter((destination) => destination.kind === 'result').length;
  return {
    nodes: analysisNodes,
    transitions,
    destinations,
    sequences,
    stats: {
      nodes: typeof rawMetrics.nodeCount === 'number' ? rawMetrics.nodeCount : analysisNodes.length,
      results: resultCount,
      external:
        typeof rawMetrics.externalDestinationCount === 'number'
          ? rawMetrics.externalDestinationCount
          : destinations.filter((destination) => destination.kind !== 'result').length,
      handoffs:
        typeof rawMetrics.flowStartCount === 'number'
          ? rawMetrics.flowStartCount
          : transitions.filter((transition) => transition.kind === 'flow_start').length,
      safety:
        typeof rawMetrics.safetyRouteCount === 'number'
          ? rawMetrics.safetyRouteCount
          : transitions.filter(
              (transition) => transition.kind === 'safety_interrupt' || transition.kind === 'deferred_safety',
            ).length,
    },
    maxDepth,
  };
}

function topologyFor(flow: GuidedFlow, flows: GuidedFlow[]) {
  // The local projection remains a fallback for malformed drafts or an in-flight topology API.
  return normalizeTopology(callTopologyBuilder(flow, flows)) ?? buildLocalAnalysis(flow, flows);
}

function kindLabel(kind: DestinationNodeData['kind']) {
  if (kind === 'choice') return 'Pergunta';
  if (kind === 'score_branch') return 'Ramificação';
  if (kind === 'result') return 'Final';
  if (kind === 'sequence') return 'Sequência linear';
  if (kind === 'missing') return 'Destino ausente';
  return 'Destino';
}

function destinationTypeLabel(kind: DestinationKind) {
  if (kind === 'result') return 'Final';
  if (kind === 'flow_start') return 'Outro fluxo';
  if (kind === 'navigate') return 'Área externa';
  if (kind === 'safety_interrupt') return 'Segurança imediata';
  if (kind === 'deferred_safety') return 'Segurança ao concluir';
  if (kind === 'end_flow') return 'Encerramento';
  return 'Destino ausente';
}

function NodeCard({ data }: { data: DestinationNodeData }) {
  if (data.kind === 'destination' || data.kind === 'missing') {
    const destination = data.destination;
    return (
      <div className={`flow-destination-node flow-destination-node--${destination?.kind ?? 'missing'}`}>
        <Handle type="target" position={Position.Left} className="flow-destination-map__target" />
        <div className="flow-destination-node__eyebrow">
          {destination?.kind === 'missing' ? <AlertTriangle aria-hidden="true" /> : <Flag aria-hidden="true" />}
          {destination ? destinationTypeLabel(destination.kind) : kindLabel(data.kind)}
        </div>
        <strong>{destination?.label}</strong>
        {destination?.detail && <small>{destination.detail}</small>}
      </div>
    );
  }
  if (data.kind === 'sequence') {
    return (
      <div className="flow-destination-sequence">
        <Handle type="target" position={Position.Left} className="flow-destination-map__target" />
        <div className="flow-destination-sequence__header">
          <span>
            <ListTree aria-hidden="true" /> Sequência linear
          </span>
          <button type="button" onClick={data.onToggleSequence} aria-label="Expandir sequência">
            <Expand aria-hidden="true" />
          </button>
        </div>
        <strong>{data.stepLabel ?? `Etapas ${data.nodeIds?.[0]}–${data.nodeIds?.[data.nodeIds.length - 1]}`}</strong>
        <small>{data.nodeIds?.length} etapas · estrutura linear</small>
        <div className="flow-destination-sequence__rail" aria-label="Etapas agrupadas">
          {data.nodeIds?.map((id) => (
            <i key={id} title={id} />
          ))}
        </div>
        <Handle type="source" position={Position.Right} id="sequence-out" className="flow-destination-map__source" />
      </div>
    );
  }
  const node = data.node;
  if (!node) return null;
  const options =
    node.kind === 'choice'
      ? [
          ...node.options.map((option) => ({ id: option.id, label: option.label })),
          ...(node.freeText ? [{ id: 'free-text', label: 'Resposta livre' }] : []),
        ]
      : node.kind === 'score_branch'
        ? node.branches.map((branch) => ({ id: branch.id, label: `${branch.min}–${branch.max}` }))
        : [];
  const hasSafety =
    node.kind === 'choice' &&
    node.options.some((option) =>
      option.effects?.some((effect) => effect.kind === 'safety_interrupt' || effect.kind === 'deferred_safety'),
    );
  return (
    <div
      className={`flow-destination-card flow-destination-card--${node.kind} ${data.highlighted ? 'is-highlighted' : ''} ${data.matched ? 'is-match' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="flow-destination-map__target" />
      <div className="flow-destination-card__meta">
        <span>
          {node.kind === 'choice' ? (
            'Pergunta'
          ) : node.kind === 'score_branch' ? (
            <>
              <GitBranch aria-hidden="true" /> Ramificação
            </>
          ) : (
            <>
              <Flag aria-hidden="true" /> Final
            </>
          )}
        </span>
        {data.cycle && <em className="flow-destination-card__cycle">Ciclo</em>}
        <code>{node.id}</code>
      </div>
      <strong>{data.stepLabel ?? 'Etapa ?'}</strong>
      <p title={node.text}>{textPreview(node.text)}</p>
      {options.length > 0 && (
        <div className="flow-destination-card__options" aria-label="Saídas da etapa">
          {options.map((option) => (
            <div key={option.id} className="flow-destination-card__option">
              <span>{option.label}</span>
              <Handle type="source" position={Position.Right} id={option.id} className="flow-destination-map__source" />
            </div>
          ))}
        </div>
      )}
      {hasSafety && (
        <div className="flow-destination-card__signal">
          <ShieldAlert aria-hidden="true" /> Segurança tipada
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  choice: NodeCard,
  score_branch: NodeCard,
  result: NodeCard,
  destination: NodeCard,
  sequence: NodeCard,
  missing: NodeCard,
};

function edgeStyle(kind: Transition['kind']) {
  if (kind === 'flow_start') return { stroke: 'var(--color-secondary)', strokeDasharray: '7 5' };
  if (kind === 'navigate') return { stroke: 'var(--color-secondary)' };
  if (kind === 'safety_interrupt') return { stroke: 'var(--color-error)', strokeDasharray: '5 3' };
  if (kind === 'deferred_safety') return { stroke: 'var(--color-warning)', strokeDasharray: '4 4' };
  if (kind === 'missing') return { stroke: 'var(--color-error)', strokeDasharray: '3 3' };
  if (kind === 'score_branch') return { stroke: 'var(--color-warning)' };
  return { stroke: 'var(--color-outline-variant)' };
}

function createPresentation(
  analysis: Analysis,
  flow: GuidedFlow,
  expandedSequences: Set<string>,
  search: string,
  selectedDestination: string | null,
  showLabels: boolean,
  toggleSequence: (id: string) => void,
) {
  const nodeById = new Map(analysis.nodes.map((node) => [node.id, node]));
  const sequenceByNode = new Map<string, SequenceGroup>();
  const collapsedSequences: Array<{ start: number; length: number }> = [];
  for (const sequence of analysis.sequences) {
    if (!expandedSequences.has(sequence.id)) {
      sequence.nodeIds.forEach((id) => sequenceByNode.set(id, sequence));
      const sequenceDepths = sequence.nodeIds
        .map((id) => nodeById.get(id)?.depth)
        .filter((depth): depth is number => depth !== null && depth !== undefined);
      if (sequenceDepths.length > 0) {
        collapsedSequences.push({ start: Math.min(...sequenceDepths), length: new Set(sequenceDepths).size });
      }
    }
  }
  const displayDepth = (depth: number) =>
    depth -
    collapsedSequences.reduce((shift, sequence) => shift + (sequence.start < depth ? sequence.length - 1 : 0), 0);
  const visibleNodeIds = new Set(analysis.nodes.filter((node) => !sequenceByNode.has(node.id)).map((node) => node.id));
  const query = search.trim().toLocaleLowerCase('pt-BR');
  const matches = (node: AnalysisNode) =>
    !query ||
    node.id.toLocaleLowerCase('pt-BR').includes(query) ||
    node.node?.text.toLocaleLowerCase('pt-BR').includes(query) ||
    String(node.order + 1).includes(query);
  const resultDepth = Math.max(displayDepth(analysis.maxDepth) + 1, 1);
  const nodes: DestinationRFNode[] = [];
  const occupied = new Map<number, number>();
  const addNode = (
    id: string,
    kind: DestinationNodeData['kind'],
    data: DestinationNodeData,
    depth: number,
    order: number,
    unreachable = false,
  ) => {
    const row = occupied.get(depth) ?? 0;
    occupied.set(depth, row + 1);
    nodes.push({
      id,
      type: kind,
      position: { x: depth * (NODE_WIDTH + COLUMN_GAP), y: (unreachable ? 900 : 0) + row * (172 + ROW_GAP) },
      data,
      draggable: false,
      selectable: kind !== 'destination' && kind !== 'missing',
      ariaLabel:
        kind === 'destination' || kind === 'missing'
          ? data.destination?.label
          : `${kindLabel(kind)} ${data.node?.id ?? id}`,
    } as DestinationRFNode);
  };
  for (const sequence of analysis.sequences) {
    if (expandedSequences.has(sequence.id)) continue;
    const first = nodeById.get(sequence.nodeIds[0]);
    if (!first) continue;
    const last = nodeById.get(sequence.nodeIds[sequence.nodeIds.length - 1]);
    addNode(
      sequence.id,
      'sequence',
      {
        kind: 'sequence',
        nodeIds: sequence.nodeIds,
        stepLabel: `Etapas ${first.order + 1}–${(last?.order ?? first.order) + 1}`,
        highlighted: Boolean(
          selectedDestination && sequence.nodeIds.some((id) => nodeById.get(id)?.destinations.has(selectedDestination)),
        ),
        onToggleSequence: () => toggleSequence(sequence.id),
      },
      displayDepth(first.depth ?? 0),
      first.order,
    );
  }
  for (const node of analysis.nodes) {
    if (!visibleNodeIds.has(node.id) || !node.node || node.node.kind === 'result') continue;
    const highlighted = Boolean(selectedDestination && node.destinations.has(selectedDestination));
    addNode(
      node.id,
      node.node.kind,
      {
        kind: node.node.kind,
        node: node.node,
        stepLabel: `Etapa ${node.order + 1}`,
        matched: matches(node),
        highlighted,
        cycle: node.cycle,
      },
      node.reachable ? displayDepth(node.depth ?? 0) : 0,
      node.order,
      !node.reachable,
    );
  }
  for (const destination of analysis.destinations) {
    const isTerminal =
      destination.kind === 'result' ||
      destination.kind === 'navigate' ||
      destination.kind === 'safety_interrupt' ||
      destination.kind === 'deferred_safety' ||
      destination.kind === 'flow_start' ||
      destination.kind === 'end_flow' ||
      destination.kind === 'missing';
    if (!isTerminal) continue;
    const destinationNode: DestinationRFNode = {
      id: destination.id,
      type: destination.kind === 'missing' ? 'missing' : 'destination',
      position: { x: resultDepth * (NODE_WIDTH + COLUMN_GAP), y: (occupied.get(resultDepth) ?? 0) * (172 + ROW_GAP) },
      data: {
        kind: destination.kind === 'missing' ? 'missing' : 'destination',
        destination,
        highlighted: selectedDestination === destination.id,
      },
      draggable: false,
      selectable: false,
    };
    occupied.set(resultDepth, (occupied.get(resultDepth) ?? 0) + 1);
    nodes.push(destinationNode);
  }
  const resultDestinationByNodeId = new Map(
    analysis.destinations
      .filter((destination) => destination.kind === 'result' && destination.nodeId)
      .map((destination) => [destination.nodeId!, destination.id]),
  );
  const groupedTarget = (id: string) => {
    if (nodeById.get(id)?.node?.kind === 'result')
      return resultDestinationByNodeId.get(id) ?? destinationId('result', id);
    return sequenceByNode.get(id)?.id ?? id;
  };
  const edges: DestinationRFEdge[] = [];
  for (const transition of analysis.transitions) {
    const source = groupedTarget(transition.source);
    const target = groupedTarget(transition.target);
    if (source === target) continue;
    if (!nodes.some((node) => node.id === source) || !nodes.some((node) => node.id === target)) continue;
    const highlighted = Boolean(
      selectedDestination && nodeById.get(transition.source)?.destinations.has(selectedDestination),
    );
    const style = edgeStyle(transition.kind);
    edges.push({
      id: transition.id,
      source,
      target,
      sourceHandle: sequenceByNode.has(transition.source)
        ? 'sequence-out'
        : transition.sourceHandle.replace(/(:deferred|__deferred-safety)$/, ''),
      type: 'smoothstep',
      label: showLabels ? transition.label : undefined,
      data: { kind: transition.kind, optionLabel: transition.label, badge: transition.badge },
      style: { ...style, opacity: selectedDestination && !highlighted ? 0.2 : 1, strokeWidth: highlighted ? 3 : 1.6 },
      animated: transition.kind === 'flow_start' || transition.kind === 'safety_interrupt',
      labelStyle: { fill: 'var(--color-on-surface)', fontSize: 11, fontWeight: 700 },
      labelBgStyle: { fill: 'var(--color-surface-container-lowest)', fillOpacity: 0.96 },
      labelBgPadding: [6, 3],
    });
  }
  return { nodes, edges, hasMatches: analysis.nodes.some(matches), maxDisplayDepth: Math.max(0, resultDepth - 1) };
}

export function FlowDestinationMap({
  flow,
  flows,
  onFlowChange,
  onEditNode,
}: {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onEditNode: (flowId: string, nodeId: string) => void;
}) {
  const analysis = useMemo(() => topologyFor(flow, flows), [flow, flows]);
  const [expandedSequences, setExpandedSequences] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<DestinationRFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DestinationRFEdge>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  const toggleSequence = useCallback((id: string) => {
    setExpandedSequences((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const presentation = useMemo(
    () =>
      createPresentation(analysis, flow, expandedSequences, search, selectedDestination, showLabels, toggleSequence),
    [analysis, expandedSequences, flow, search, selectedDestination, showLabels, toggleSequence],
  );
  useEffect(() => {
    setNodes(presentation.nodes);
    setEdges(presentation.edges);
  }, [presentation.edges, presentation.nodes, setEdges, setNodes]);

  const selectedNode = selectedNodeId ? (flow.nodes[selectedNodeId] ?? null) : null;
  const selectedDestinationData = analysis.destinations.find((destination) => destination.id === selectedDestination);
  const handleNodeClick: NodeMouseHandler<DestinationRFNode> = useCallback(
    (_event, node) => {
      if (flow.nodes[node.id]) setSelectedNodeId(node.id);
    },
    [flow.nodes],
  );

  /** Clears the selection and best-effort restores focus to the canvas node. */
  const handleCloseNodePanel = useCallback(() => {
    const nodeId = selectedNodeId;
    setSelectedNodeId(null);
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
    },
    [flow, onFlowChange],
  );

  /** Escape dismisses the add-stage popover from wherever the focus sits inside it. */
  const handleAddStageKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (addStageOpen && event.key === 'Escape') setAddStageOpen(false);
    },
    [addStageOpen],
  );

  if (Object.keys(flow.nodes).length === 0) {
    return (
      <section className="flow-destination-map" data-testid="flow-destination-map">
        <div className="flow-destination-map__empty">
          <Unplug aria-hidden="true" />
          <h3>Este fluxo ainda não possui etapas.</h3>
          <p>Adicione a primeira etapa no editor para organizar seus destinos.</p>
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
          <small>{analysis.destinations.length} encontrados</small>
        </div>
        <div className="flow-destination-map__destination-list">
          {analysis.destinations.map((destination) => (
            <button
              key={destination.id}
              type="button"
              className={`flow-destination-chip flow-destination-chip--${destination.kind} ${selectedDestination === destination.id ? 'is-selected' : ''}`}
              onClick={() => setSelectedDestination(selectedDestination === destination.id ? null : destination.id)}
              aria-pressed={selectedDestination === destination.id}
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
          {analysis.destinations.length === 0 && (
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
            placeholder="Buscar etapa, ID ou texto"
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
          Mostrar rótulos das opções
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
            type="button"
            className="flow-destination-map__tool-button"
            aria-haspopup="true"
            aria-expanded={addStageOpen}
            onKeyDown={handleAddStageKeyDown}
            onClick={() => setAddStageOpen((current) => !current)}
          >
            <Plus aria-hidden="true" /> Etapa
          </button>
          {addStageOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 flex w-40 flex-col gap-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 shadow-lg">
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

      <div
        ref={canvasRef}
        className="flow-destination-map__canvas"
        aria-label={`Mapa por destino do fluxo ${flow.title}`}
      >
        <div className="flow-destination-map__depth-labels" aria-hidden="true">
          <span>Entrada</span>
          {Array.from({ length: presentation.maxDisplayDepth }, (_, index) => (
            <span key={index}>Prof. {index + 1}</span>
          ))}
          <span>Finais e saídas</span>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 0.84 }}
          minZoom={0.18}
          maxZoom={1.5}
          proOptions={{ hideAttribution: false }}
        >
          <Background color="var(--color-outline-variant)" gap={28} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable ariaLabel="Minimapa do fluxo" />
        </ReactFlow>
        {analysis.nodes.some((node) => !node.reachable) && (
          <div className="flow-destination-map__unreachable">
            <AlertTriangle aria-hidden="true" />
            <strong>Fora do caminho de entrada</strong>
            <span>{analysis.nodes.filter((node) => !node.reachable).length} etapas inalcançáveis</span>
          </div>
        )}
      </div>

      {selectedDestinationData && (
        <div className="flow-destination-map__selection" role="status">
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
        />
      )}
    </section>
  );
}
