import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import { buildFlowTopology } from './flowTopology';
import { buildLocalAnalysis } from './flowDestinationFallback';
import type {
  Destination,
  DestinationAnalysis,
  DestinationAnalysisNode,
  DestinationKind,
  DestinationSequenceGroup,
  DestinationTransition,
} from './flowDestinationModels';

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

function normalizeTopology(value: unknown): DestinationAnalysis | undefined {
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
  const analysisNodes: DestinationAnalysisNode[] = rawNodes.map((value, order) => {
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
  const transitions: DestinationTransition[] = rawEdges.flatMap((value, index) => {
    const item = record(value) ?? {};
    const rawKind = stringValue(item.kind) ?? stringValue(item.type) ?? 'normal';
    const kind: DestinationTransition['kind'] =
      rawKind === 'free_text' || rawKind === 'score'
        ? 'normal'
        : rawKind === 'missing_node' || rawKind === 'missing_flow'
          ? 'missing'
          : (rawKind as DestinationTransition['kind']);
    const score = record(item.score);
    const scoreLabel =
      score && typeof score.value === 'number'
        ? `+${score.value} · ${stringValue(score.scoreKey) ?? ''}`.replace(/ · $/, '')
        : undefined;
    const primary: DestinationTransition = {
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
  const sequences: DestinationSequenceGroup[] = (
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

export function topologyFor(flow: GuidedFlow, flows: GuidedFlow[]) {
  // The local projection remains a fallback for malformed drafts or an in-flight topology API.
  return normalizeTopology(callTopologyBuilder(flow, flows)) ?? buildLocalAnalysis(flow, flows);
}
