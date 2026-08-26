import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
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
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './FlowDestinationMap.css';

import type { FlowEffect, FlowNode, FlowOption, GuidedFlow } from '../../domain/flow-engine/types';
import type { MapFocusSection } from './flowDisplay';
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
  flowId?: string;
  reachable: boolean;
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
  isDisconnected?: boolean;
  optionTargets?: Record<string, string>;
  targetHandles?: Array<{ id: string; top: number }>;
  flows?: GuidedFlow[];
  onOpenFlow?: (flowId: string) => void;
  onToggleSequence?: () => void;
  onAddConnectedStage?: (source: ConnectionSource, kind: FlowNode['kind']) => void;
  onApplyTerminalEffect?: (source: ConnectionSource, destination: TerminalDestination) => void;
  onAddOption?: (nodeId: string) => void;
  onAddBranch?: (nodeId: string) => void;
  activeFocusSection?: MapFocusSection;
  activeFocusTargetId?: string;
  onFocusSection?: (nodeId: string, section: MapFocusSection, targetId?: string) => void;
};

type DestinationRFNode = Node<DestinationNodeData>;
type DestinationRFEdge = Edge<{ kind: Transition['kind']; optionLabel: string; badge?: string }, 'smoothstep'> & {
  pathOptions?: { borderRadius?: number; offset?: number; stepPosition?: number };
};

const NODE_WIDTH = 284;
const COLUMN_GAP = 190;
const ROW_GAP = 64;

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
    const created: Destination = { id, kind, label, detail, reachable: false, sources: new Set() };
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
          const destination = destinations.get(id);
          if (destination && targetFlow) destination.flowId = targetFlow.id;
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
    destination.reachable = [...destination.sources].some((sourceId) => depth.has(sourceId));
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
      flowId: stringValue(item.flowId),
      reachable: item.reachableFromEntry !== false,
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

function TargetHandles({ handles }: { handles?: DestinationNodeData['targetHandles'] }) {
  const visibleHandles = handles?.length ? handles : [{ id: 'target-default', top: 50 }];
  return visibleHandles.map((handle) => (
    <Handle
      key={handle.id}
      id={handle.id}
      type="target"
      position={Position.Left}
      className="flow-destination-map__target"
      style={{ top: `${handle.top}%` }}
    />
  ));
}

function QuickActionMenu({
  source,
  flows,
  onAddStage,
  onApplyEffect,
  onClose,
}: {
  source: ConnectionSource;
  flows?: GuidedFlow[];
  onAddStage?: (kind: FlowNode['kind']) => void;
  onApplyEffect?: (destination: TerminalDestination) => void;
  onClose: () => void;
}) {
  const [selectingFlow, setSelectingFlow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const otherFlows = (flows ?? []).filter((f) => f.id !== source.nodeId);

  return (
    <div
      ref={containerRef}
      role="menu"
      tabIndex={-1}
      aria-label="Ações de continuação"
      className="flow-destination-quick-menu nodrag nopan"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flow-destination-quick-menu__header">Continuar com</div>
      <button type="button" className="flow-destination-quick-menu__item" onClick={() => onAddStage?.('choice')}>
        💬 Pergunta
      </button>
      <button type="button" className="flow-destination-quick-menu__item" onClick={() => onAddStage?.('result')}>
        🏁 Resultado final
      </button>
      <button type="button" className="flow-destination-quick-menu__item" onClick={() => onAddStage?.('score_branch')}>
        🔀 Ramificação por pontuação
      </button>

      {(source.kind === 'option' || source.kind === 'branch') && (
        <>
          <div className="flow-destination-quick-menu__divider" />
          <div className="flow-destination-quick-menu__header">
            {source.kind === 'branch' ? 'Direcionar para área' : 'Direcionar ou encerrar'}
          </div>
          <button
            type="button"
            className="flow-destination-quick-menu__item"
            onClick={() => onApplyEffect?.({ kind: 'navigate', destination: '/apoio' })}
          >
            🏥 Abrir /apoio
          </button>
          <button
            type="button"
            className="flow-destination-quick-menu__item"
            onClick={() => onApplyEffect?.({ kind: 'navigate', destination: '/contatos' })}
          >
            🏥 Abrir /contatos
          </button>
          <button
            type="button"
            className="flow-destination-quick-menu__item"
            onClick={() => onApplyEffect?.({ kind: 'navigate', destination: '/educacao' })}
          >
            🏥 Abrir /educacao
          </button>

          {source.kind === 'option' && (
            <>
              {otherFlows.length > 0 && !selectingFlow && (
                <button
                  type="button"
                  className="flow-destination-quick-menu__item"
                  onClick={() => setSelectingFlow(true)}
                >
                  🔄 Iniciar outro fluxo…
                </button>
              )}
              {selectingFlow && (
                <div className="flow-destination-quick-menu__sub">
                  <div className="text-[10px] text-on-surface-variant font-bold px-2 py-1">Escolha o fluxo:</div>
                  {otherFlows.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="flow-destination-quick-menu__item text-left truncate"
                      onClick={() => onApplyEffect?.({ kind: 'flow_start', flowId: f.id })}
                    >
                      {f.title || f.id}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="flow-destination-quick-menu__item text-xs text-primary"
                    onClick={() => setSelectingFlow(false)}
                  >
                    ← Voltar
                  </button>
                </div>
              )}
              <button
                type="button"
                className="flow-destination-quick-menu__item"
                onClick={() => onApplyEffect?.({ kind: 'end_flow', message: '' })}
              >
                ⏹️ Encerrar conversa
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function OptionOutputRow({
  id,
  label,
  index,
  targetLabel,
  source,
  data,
}: {
  id: string;
  label: string;
  index: number;
  targetLabel?: string;
  source: ConnectionSource;
  data: DestinationNodeData;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel = label.trim() || (source.kind === 'branch' ? label : `Opção ${index + 1}`);
  const isPlaceholder = !label.trim();
  const isRowFocused =
    data.activeFocusSection === (source.kind === 'branch' ? 'faixa' : 'opcao') && data.activeFocusTargetId === id;

  return (
    <div
      className={`flow-destination-card__option nodrag nopan ${isRowFocused ? 'is-focused' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (source.kind === 'branch') {
          data.onFocusSection?.(source.nodeId, 'faixa', source.branchId);
        } else if (source.kind === 'free_text') {
          data.onFocusSection?.(source.nodeId, 'opcoes');
        } else {
          data.onFocusSection?.(source.nodeId, 'opcao', source.optionId);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (source.kind === 'branch') {
            data.onFocusSection?.(source.nodeId, 'faixa', source.branchId);
          } else if (source.kind === 'free_text') {
            data.onFocusSection?.(source.nodeId, 'opcoes');
          } else {
            data.onFocusSection?.(source.nodeId, 'opcao', source.optionId);
          }
        }
      }}
      role="button"
      tabIndex={0}
      title={`Clique para editar ${displayLabel}`}
      aria-label={`Editar ${displayLabel}`}
    >
      <span>
        <strong className={isPlaceholder ? 'flow-destination-card__option-empty' : ''}>{displayLabel}</strong>
        {targetLabel ? (
          <small>{targetLabel}</small>
        ) : (
          <small className="flow-destination-card__option-no-target">Sem destino</small>
        )}
      </span>
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <button
          type="button"
          className="flow-destination-card__add-btn nodrag nopan"
          aria-label={`Continuar a partir de ${displayLabel}`}
          title={targetLabel ? `Conectar ou alterar: ${displayLabel}` : `Conectar a partir de ${displayLabel}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((curr) => !curr);
          }}
        >
          <Plus aria-hidden="true" size={12} />
        </button>
        <Handle type="source" position={Position.Right} id={id} className="flow-destination-map__source" />
      </div>
      {open && (
        <QuickActionMenu
          source={source}
          flows={data.flows}
          onAddStage={(kind) => {
            data.onAddConnectedStage?.(source, kind);
            setOpen(false);
          }}
          onApplyEffect={(dest) => {
            data.onApplyTerminalEffect?.(source, dest);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function NodeCard({ data }: { data: DestinationNodeData }) {
  if (data.kind === 'destination' || data.kind === 'missing') {
    const destination = data.destination;
    return (
      <div className={`flow-destination-node flow-destination-node--${destination?.kind ?? 'missing'}`}>
        <TargetHandles handles={data.targetHandles} />
        <div className="flow-destination-node__eyebrow">
          {destination?.kind === 'missing' ? <AlertTriangle aria-hidden="true" /> : <Flag aria-hidden="true" />}
          {destination ? destinationTypeLabel(destination.kind) : kindLabel(data.kind)}
        </div>
        <strong>{destination?.label}</strong>
        {destination?.detail && <small>{destination.detail}</small>}
        {destination?.kind === 'flow_start' && destination.flowId && data.onOpenFlow && (
          <button
            type="button"
            className="flow-destination-node__open nodrag nopan"
            aria-label={`Abrir ${destination.label}`}
            onClick={(event) => {
              event.stopPropagation();
              data.onOpenFlow?.(destination.flowId!);
            }}
          >
            Abrir fluxo <ArrowRight aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
  if (data.kind === 'sequence') {
    return (
      <div className="flow-destination-sequence">
        <TargetHandles handles={data.targetHandles} />
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
      className={`flow-destination-card flow-destination-card--${node.kind} ${data.highlighted ? 'is-highlighted' : ''} ${data.matched ? 'is-match' : ''} ${data.isDisconnected ? 'is-disconnected' : ''}`}
    >
      <TargetHandles handles={data.targetHandles} />
      <div
        className="flow-destination-card__meta"
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          data.onFocusSection?.(node.id, 'geral');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            data.onFocusSection?.(node.id, 'geral');
          }
        }}
        title={`Clique para editar detalhes de ${data.stepLabel ?? node.id}`}
        aria-label={`Editar detalhes de ${data.stepLabel ?? node.id}`}
      >
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
        {data.isDisconnected && (
          <span className="text-warning text-[9px] font-bold" title="Esta etapa não está conectada ao início do fluxo">
            Não conectada
          </span>
        )}
        {data.cycle && <em className="flow-destination-card__cycle">Ciclo</em>}
        <code>{node.id}</code>
      </div>
      <div
        className={`flow-destination-card__content nodrag nopan ${
          data.activeFocusSection === 'texto' ? 'is-focused' : ''
        }`}
        onClick={(e) => {
          e.stopPropagation();
          data.onFocusSection?.(node.id, 'texto');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            data.onFocusSection?.(node.id, 'texto');
          }
        }}
        role="button"
        tabIndex={0}
        title="Clique para editar o texto da etapa"
        aria-label={`Editar texto de ${data.stepLabel ?? node.id}`}
      >
        <strong>{data.stepLabel ?? 'Etapa ?'}</strong>
        <p title={node.text}>{textPreview(node.text) || <span className="italic opacity-60">Sem texto</span>}</p>
      </div>
      {options.length > 0 && (
        <div className="flow-destination-card__options" aria-label="Saídas da etapa">
          {options.map((option, index) => {
            let source: ConnectionSource;
            if (node.kind === 'score_branch') {
              source = { kind: 'branch', nodeId: node.id, branchId: option.id };
            } else if (option.id === 'free-text') {
              source = { kind: 'free_text', nodeId: node.id };
            } else {
              source = { kind: 'option', nodeId: node.id, optionId: option.id };
            }
            return (
              <OptionOutputRow
                key={option.id}
                id={option.id}
                label={option.label}
                index={index}
                targetLabel={data.optionTargets?.[option.id]}
                source={source}
                data={data}
              />
            );
          })}
        </div>
      )}
      {node.kind === 'choice' && (
        <button
          type="button"
          className="flow-destination-card__add-option-btn nodrag nopan"
          onClick={(e) => {
            e.stopPropagation();
            data.onAddOption?.(node.id);
          }}
          aria-label={`Adicionar opção à ${data.stepLabel ?? node.id}`}
        >
          <Plus aria-hidden="true" size={13} />
          <span>Adicionar opção</span>
        </button>
      )}
      {node.kind === 'score_branch' && (
        <button
          type="button"
          className="flow-destination-card__add-option-btn nodrag nopan"
          onClick={(e) => {
            e.stopPropagation();
            data.onAddBranch?.(node.id);
          }}
          aria-label={`Adicionar faixa à ${data.stepLabel ?? node.id}`}
        >
          <Plus aria-hidden="true" size={13} />
          <span>Adicionar faixa</span>
        </button>
      )}
      {hasSafety && (
        <div className="flow-destination-card__signal">
          <ShieldAlert aria-hidden="true" /> Segurança tipada
        </div>
      )}
    </div>
  );
}

const MemoizedNodeCard = memo(NodeCard);

const nodeTypes = {
  choice: MemoizedNodeCard,
  score_branch: MemoizedNodeCard,
  result: MemoizedNodeCard,
  destination: MemoizedNodeCard,
  sequence: MemoizedNodeCard,
  missing: MemoizedNodeCard,
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
  flows: GuidedFlow[],
  expandedSequences: Set<string>,
  search: string,
  selectedDestination: string | null,
  showLabels: boolean,
  toggleSequence: (id: string) => void,
  onOpenFlow: (flowId: string) => void,
  onAddConnectedStage?: (source: ConnectionSource, kind: FlowNode['kind']) => void,
  onApplyTerminalEffect?: (source: ConnectionSource, destination: TerminalDestination) => void,
  onAddOption?: (nodeId: string) => void,
  onAddBranch?: (nodeId: string) => void,
  selectedNodeId?: string | null,
  panelFocusRequest?: MapFocusRequest | null,
  onFocusSection?: (nodeId: string, section: MapFocusSection, targetId?: string) => void,
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
  const visibleReachableNodeIds = new Set(
    analysis.nodes.filter((node) => node.reachable && !sequenceByNode.has(node.id)).map((node) => node.id),
  );
  const query = search.trim().toLocaleLowerCase('pt-BR');
  const matches = (node: AnalysisNode) =>
    !query ||
    node.id.toLocaleLowerCase('pt-BR').includes(query) ||
    node.node?.text.toLocaleLowerCase('pt-BR').includes(query) ||
    String(node.order + 1).includes(query);
  const resultDepth = Math.max(displayDepth(analysis.maxDepth) + 1, 1);
  const nodes: DestinationRFNode[] = [];
  const layout = new Map<string, { depth: number; order: number; height: number; isUnreachable?: boolean }>();
  const estimatedHeight = (kind: DestinationNodeData['kind'], data: DestinationNodeData) => {
    if (kind === 'destination' || kind === 'missing') return data.destination?.kind === 'flow_start' ? 130 : 96;
    if (kind === 'sequence') return 140;
    if (!data.node || data.node.kind === 'result') return 110;
    const outputs =
      data.node.kind === 'choice' ? data.node.options.length + (data.node.freeText ? 1 : 0) : data.node.branches.length;
    const safety =
      data.node.kind === 'choice' &&
      data.node.options.some((option) =>
        option.effects?.some((effect) => effect.kind === 'safety_interrupt' || effect.kind === 'deferred_safety'),
      );
    const addBtnHeight = data.node.kind === 'choice' || data.node.kind === 'score_branch' ? 38 : 0;
    const textLines = data.node.text ? Math.min(3, Math.ceil(data.node.text.length / 32)) : 1;
    const textHeight = 22 + textLines * 17;
    return 56 + textHeight + outputs * 52 + addBtnHeight + (safety ? 36 : 0);
  };
  const addNode = (
    id: string,
    kind: DestinationNodeData['kind'],
    data: DestinationNodeData,
    depth: number,
    order: number,
    isUnreachable = false,
  ) => {
    nodes.push({
      id,
      type: kind,
      position: { x: depth * (NODE_WIDTH + COLUMN_GAP), y: 0 },
      data,
      draggable: false,
      selectable: kind !== 'destination' && kind !== 'missing',
      ariaLabel:
        kind === 'destination' || kind === 'missing'
          ? data.destination?.label
          : `${kindLabel(kind)} ${data.node?.id ?? id}`,
    } as DestinationRFNode);
    layout.set(id, { depth, order, height: estimatedHeight(kind, data), isUnreachable });
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
        flows,
        onOpenFlow,
        onToggleSequence: () => toggleSequence(sequence.id),
      },
      displayDepth(first.depth ?? 0),
      first.order,
    );
  }
  for (const node of analysis.nodes) {
    if (!visibleReachableNodeIds.has(node.id) || !node.node || node.node.kind === 'result') continue;
    const highlighted = Boolean(selectedDestination && node.destinations.has(selectedDestination));
    const optionTargets: Record<string, string> = {};
    if (showLabels) {
      for (const transition of analysis.transitions) {
        if (transition.source !== node.id || transition.kind === 'deferred_safety') continue;
        const targetNode = nodeById.get(transition.target);
        const targetDestination = analysis.destinations.find((destination) => destination.id === transition.target);
        const targetSequence = sequenceByNode.get(transition.target);
        optionTargets[transition.sourceHandle.replace(/(:deferred|__deferred-safety)$/, '')] = targetSequence
          ? `Vai para etapas ${targetSequence.nodeIds
              .map((id) => (nodeById.get(id)?.order ?? 0) + 1)
              .filter((step, index, steps) => index === 0 || index === steps.length - 1)
              .join('–')}`
          : targetNode
            ? `Vai para etapa ${targetNode.order + 1}`
            : targetDestination
              ? targetDestination.kind === 'flow_start'
                ? `Abre ${targetDestination.label.replace(/^Fluxo · /, '')}`
                : `Vai para ${targetDestination.label}`
              : 'Destino não encontrado';
      }
    }
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
        optionTargets,
        flows,
        onOpenFlow,
        onAddConnectedStage,
        onApplyTerminalEffect,
        onAddOption,
        onAddBranch,
        activeFocusSection: selectedNodeId === node.id ? panelFocusRequest?.section : undefined,
        activeFocusTargetId: selectedNodeId === node.id ? panelFocusRequest?.targetId : undefined,
        onFocusSection,
      },
      node.reachable ? displayDepth(node.depth ?? 0) : 0,
      node.order,
    );
  }
  const transitionOrderByTarget = new Map<string, number>();
  analysis.transitions.forEach((transition, index) => {
    if (!transitionOrderByTarget.has(transition.target)) transitionOrderByTarget.set(transition.target, index);
  });
  for (const destination of analysis.destinations) {
    const isTerminal =
      destination.kind === 'result' ||
      destination.kind === 'navigate' ||
      destination.kind === 'safety_interrupt' ||
      destination.kind === 'deferred_safety' ||
      destination.kind === 'flow_start' ||
      destination.kind === 'end_flow' ||
      destination.kind === 'missing';
    if (!isTerminal || !destination.reachable) continue;
    addNode(
      destination.id,
      destination.kind === 'missing' ? 'missing' : 'destination',
      {
        kind: destination.kind === 'missing' ? 'missing' : 'destination',
        destination,
        highlighted: selectedDestination === destination.id,
        onOpenFlow,
      },
      resultDepth,
      transitionOrderByTarget.get(destination.id) ?? Number.MAX_SAFE_INTEGER,
    );
  }

  // Disconnected / Unreachable nodes layout in canvas
  const unreachableNodes = analysis.nodes.filter((node) => !node.reachable && node.node);
  if (unreachableNodes.length > 0) {
    const unreachableSet = new Set(unreachableNodes.map((n) => n.id));
    const unreachableAdjacency = new Map<string, string[]>();
    const unreachableInDegree = new Map<string, number>();

    unreachableNodes.forEach((n) => {
      unreachableAdjacency.set(n.id, []);
      unreachableInDegree.set(n.id, 0);
    });

    analysis.transitions.forEach((t) => {
      if (unreachableSet.has(t.source) && unreachableSet.has(t.target)) {
        unreachableAdjacency.get(t.source)?.push(t.target);
        unreachableInDegree.set(t.target, (unreachableInDegree.get(t.target) ?? 0) + 1);
      }
    });

    const unreachableDepth = new Map<string, number>();
    const queue: string[] = [];
    unreachableNodes.forEach((n) => {
      if ((unreachableInDegree.get(n.id) ?? 0) === 0) {
        unreachableDepth.set(n.id, 0);
        queue.push(n.id);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const curDepth = unreachableDepth.get(current) ?? 0;
      for (const next of unreachableAdjacency.get(current) ?? []) {
        if (!unreachableDepth.has(next)) {
          unreachableDepth.set(next, curDepth + 1);
          queue.push(next);
        }
      }
    }

    unreachableNodes.forEach((n) => {
      if (!unreachableDepth.has(n.id)) unreachableDepth.set(n.id, 0);
    });

    for (const node of unreachableNodes) {
      if (!node.node) continue;
      const depth = unreachableDepth.get(node.id) ?? 0;
      const optionTargets: Record<string, string> = {};
      if (showLabels) {
        for (const transition of analysis.transitions) {
          if (transition.source !== node.id || transition.kind === 'deferred_safety') continue;
          const targetNode = nodeById.get(transition.target);
          const targetDestination = analysis.destinations.find((destination) => destination.id === transition.target);
          optionTargets[transition.sourceHandle.replace(/(:deferred|__deferred-safety)$/, '')] = targetNode
            ? `Vai para etapa ${targetNode.order + 1}`
            : targetDestination
              ? `Vai para ${targetDestination.label}`
              : 'Destino não encontrado';
        }
      }

      addNode(
        node.id,
        node.node.kind,
        {
          kind: node.node.kind,
          node: node.node,
          stepLabel: `Etapa ${node.order + 1}`,
          matched: matches(node),
          highlighted: false,
          cycle: node.cycle,
          isDisconnected: true,
          optionTargets,
          flows,
          onOpenFlow,
          onAddConnectedStage,
          onApplyTerminalEffect,
          onAddOption,
          onAddBranch,
          activeFocusSection: selectedNodeId === node.id ? panelFocusRequest?.section : undefined,
          activeFocusTargetId: selectedNodeId === node.id ? panelFocusRequest?.targetId : undefined,
          onFocusSection,
        },
        depth,
        node.order,
        true,
      );
    }
  }

  const reachableRFNodes = nodes.filter((n) => !layout.get(n.id)?.isUnreachable);
  const unreachableRFNodes = nodes.filter((n) => layout.get(n.id)?.isUnreachable);

  const reachableColumns = new Map<number, DestinationRFNode[]>();
  for (const node of reachableRFNodes) {
    const depth = layout.get(node.id)?.depth ?? 0;
    const column = reachableColumns.get(depth) ?? [];
    column.push(node);
    reachableColumns.set(depth, column);
  }
  const reachableColumnHeights = [...reachableColumns.values()].map((column) =>
    column.reduce((height, node, index) => height + (layout.get(node.id)?.height ?? 100) + (index ? ROW_GAP : 0), 0),
  );
  const tallestReachableColumn = Math.max(0, ...reachableColumnHeights);

  for (const [depth, column] of reachableColumns) {
    column.sort((left, right) => (layout.get(left.id)?.order ?? 0) - (layout.get(right.id)?.order ?? 0));
    const columnHeight = column.reduce(
      (height, node, index) => height + (layout.get(node.id)?.height ?? 100) + (index ? ROW_GAP : 0),
      0,
    );
    let y = Math.max(0, (tallestReachableColumn - columnHeight) / 2);
    column.forEach((node) => {
      node.position = { x: depth * (NODE_WIDTH + COLUMN_GAP), y };
      y += (layout.get(node.id)?.height ?? 100) + ROW_GAP;
    });
  }

  if (unreachableRFNodes.length > 0) {
    const unreachableColumns = new Map<number, DestinationRFNode[]>();
    for (const node of unreachableRFNodes) {
      const depth = layout.get(node.id)?.depth ?? 0;
      const column = unreachableColumns.get(depth) ?? [];
      column.push(node);
      unreachableColumns.set(depth, column);
    }
    const unreachableStartY = Math.max(tallestReachableColumn + 120, 260);

    for (const [depth, column] of unreachableColumns) {
      column.sort((left, right) => (layout.get(left.id)?.order ?? 0) - (layout.get(right.id)?.order ?? 0));
      let y = unreachableStartY;
      column.forEach((node) => {
        node.position = { x: depth * (NODE_WIDTH + COLUMN_GAP), y };
        y += (layout.get(node.id)?.height ?? 100) + ROW_GAP;
      });
    }
  }

  const resultDestinationByNodeId = new Map(
    analysis.destinations
      .filter((destination) => destination.kind === 'result' && destination.nodeId)
      .map((destination) => [destination.nodeId!, destination.id]),
  );
  const groupedTarget = (id: string) => {
    if (nodeById.get(id)?.node?.kind === 'result') {
      const isReachable = nodeById.get(id)?.reachable;
      if (isReachable) {
        return resultDestinationByNodeId.get(id) ?? destinationId('result', id);
      }
      return id;
    }
    return sequenceByNode.get(id)?.id ?? id;
  };
  const visibleTransitions = analysis.transitions.flatMap((transition, transitionIndex) => {
    const source = groupedTarget(transition.source);
    const target = groupedTarget(transition.target);
    if (source === target) return [];
    const sourceNode = nodes.find((node) => node.id === source);
    const targetNode = nodes.find((node) => node.id === target);
    if (!sourceNode || !targetNode) return [];
    return [{ transition, transitionIndex, source, target, sourceNode, targetNode }];
  });
  const routingGroups = new Map<string, typeof visibleTransitions>();
  visibleTransitions.forEach((item) => {
    const key = `${item.sourceNode.position.x}:${item.targetNode.position.x}`;
    const group = routingGroups.get(key) ?? [];
    group.push(item);
    routingGroups.set(key, group);
  });
  routingGroups.forEach((group) => {
    group.sort((left, right) => {
      const leftMidpoint = left.sourceNode.position.y + left.targetNode.position.y;
      const rightMidpoint = right.sourceNode.position.y + right.targetNode.position.y;
      return leftMidpoint - rightMidpoint || left.transition.id.localeCompare(right.transition.id);
    });
  });
  const incomingByTarget = new Map<string, typeof visibleTransitions>();
  visibleTransitions.forEach((item) => {
    const incoming = incomingByTarget.get(item.target) ?? [];
    incoming.push(item);
    incomingByTarget.set(item.target, incoming);
  });
  incomingByTarget.forEach((incoming) => {
    incoming.sort(
      (left, right) =>
        left.sourceNode.position.y - right.sourceNode.position.y || left.transitionIndex - right.transitionIndex,
    );
  });
  const routedNodes = nodes.map((node) => {
    const incoming = incomingByTarget.get(node.id);
    if (!incoming?.length) return node;
    const span = Math.min(72, Math.max(0, incoming.length - 1) * 22);
    return {
      ...node,
      data: {
        ...node.data,
        targetHandles: incoming.map((item, index) => ({
          id: `target:${item.transition.id}`,
          top: incoming.length === 1 ? 50 : 50 - span / 2 + (span * index) / (incoming.length - 1),
        })),
      },
    };
  });

  const edges: DestinationRFEdge[] = [];
  for (const item of visibleTransitions) {
    const { transition, source, target, sourceNode, targetNode } = item;
    const highlighted = Boolean(
      selectedDestination && nodeById.get(transition.source)?.destinations.has(selectedDestination),
    );
    const style = edgeStyle(transition.kind);
    const routingGroup = routingGroups.get(`${sourceNode.position.x}:${targetNode.position.x}`) ?? [item];
    const routeIndex = routingGroup.indexOf(item);
    const routeSpan = Math.min(0.68, Math.max(0, routingGroup.length - 1) * 0.11);
    const stepPosition =
      routingGroup.length === 1 ? 0.5 : 0.5 - routeSpan / 2 + (routeSpan * routeIndex) / (routingGroup.length - 1);
    edges.push({
      id: transition.id,
      source,
      target,
      sourceHandle: sequenceByNode.has(transition.source)
        ? 'sequence-out'
        : transition.sourceHandle.replace(/(:deferred|__deferred-safety)$/, ''),
      targetHandle: `target:${transition.id}`,
      type: 'smoothstep',
      pathOptions: { borderRadius: 10, offset: 22, stepPosition },
      data: { kind: transition.kind, optionLabel: transition.label, badge: transition.badge },
      style: { ...style, opacity: selectedDestination && !highlighted ? 0.2 : 1, strokeWidth: highlighted ? 3 : 1.6 },
      className: 'flow-destination-map__edge',
      focusable: true,
      interactionWidth: 24,
      ariaLabel: `${transition.label}: ${source} para ${target}`,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: style.stroke,
        width: 16,
        height: 16,
      },
    });
  }
  return { nodes: routedNodes, edges, hasMatches: analysis.nodes.some(matches) };
}

/**
 * Validation deep-link payload handed from the dashboard's validation summary
 * down through FlowMap to this map. Bump `requestId` to re-fire an identical
 * request; `nodeId` absent means a flow-level target ('configuracoes').
 */
export type MapFocusRequest = {
  /** Stage to select on the destination canvas; absent means a flow-level target. */
  nodeId?: string;
  /** Node panel section to reveal ('configuracoes' targets carry no nodeId and no section). */
  section?: MapFocusSection;
  /** Specific sub-item to focus within the section (e.g. optionId, branchId). */
  targetId?: string;
  requestId: number;
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
      createPresentation(
        analysis,
        flow,
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
      flow,
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
                Etapa {item.order + 1} <small>{textPreview(item.node?.text ?? item.id, 34)}</small>
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
          nodeTypes={nodeTypes}
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
