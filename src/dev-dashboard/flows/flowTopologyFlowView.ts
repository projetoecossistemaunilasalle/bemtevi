import type { FlowNode } from '../../domain/flow-engine/types';
import type {
  FlowTopologyCycle,
  FlowTopologyDestination,
  FlowTopologyEdge,
  FlowTopologyMetrics,
  FlowTopologyNode,
  FlowTopologySequence,
} from './flowTopologyTypes';

export interface FlowTopologyView {
  nodes: FlowTopologyNode[];
  nodeById: Record<string, FlowTopologyNode>;
  edgeById: Record<string, FlowTopologyEdge>;
  terminalDestinations: FlowTopologyDestination[];
  reachableDestinations: FlowTopologyDestination[];
  metrics: FlowTopologyMetrics;
}

export function buildFlowTopologyView({
  orderedNodes,
  edges,
  terminalDestinationIdsByNodeId,
  depthByNodeId,
  reachableNodeIds,
  unreachableNodeIds,
  reachableSet,
  incomingCountByNodeId,
  outgoingCountByNodeId,
  localOutgoingCountByNodeId,
  cycleByNodeId,
  sequenceByNodeId,
  destinationList,
  linearSequences,
}: {
  orderedNodes: FlowNode[];
  edges: FlowTopologyEdge[];
  terminalDestinationIdsByNodeId: Record<string, string[]>;
  depthByNodeId: Record<string, number | undefined>;
  reachableNodeIds: string[];
  unreachableNodeIds: string[];
  reachableSet: Set<string>;
  incomingCountByNodeId: Record<string, number>;
  outgoingCountByNodeId: Record<string, number>;
  localOutgoingCountByNodeId: Record<string, number>;
  cycleByNodeId: Map<string, FlowTopologyCycle>;
  sequenceByNodeId: Map<string, string>;
  destinationList: FlowTopologyDestination[];
  linearSequences: FlowTopologySequence[];
}): FlowTopologyView {
  const topologyNodes: FlowTopologyNode[] = orderedNodes.map((node, index) => {
    const terminalIds = terminalDestinationIdsByNodeId[node.id] ?? [];
    return {
      id: node.id,
      node,
      kind: node.kind,
      stepNumber: index + 1,
      step: index + 1,
      order: index,
      reachable: reachableSet.has(node.id),
      depth: depthByNodeId[node.id],
      incomingCount: incomingCountByNodeId[node.id] ?? 0,
      outgoingCount: outgoingCountByNodeId[node.id] ?? 0,
      localIncomingCount: incomingCountByNodeId[node.id] ?? 0,
      localOutgoingCount: localOutgoingCountByNodeId[node.id] ?? 0,
      terminalDestinationIds: terminalIds,
      destinationIds: terminalIds,
      reverseReachableDestinationIds: terminalIds,
      cycleId: cycleByNodeId.get(node.id)?.id,
      inCycle: Boolean(cycleByNodeId.get(node.id)),
      linearSequenceId: sequenceByNodeId.get(node.id),
    };
  });
  const nodeById = Object.fromEntries(topologyNodes.map((node) => [node.id, node]));
  const edgeById = Object.fromEntries(edges.map((edge) => [edge.id, edge]));
  const reachableDestinations = destinationList.filter((destination) => destination.reachableFromEntry);
  const metrics: FlowTopologyMetrics = {
    nodeCount: topologyNodes.length,
    reachableNodeCount: reachableNodeIds.length,
    unreachableNodeCount: unreachableNodeIds.length,
    resultCount: orderedNodes.filter((node) => node.kind === 'result').length,
    terminalDestinationCount: destinationList.length,
    reachableTerminalDestinationCount: reachableDestinations.length,
    externalDestinationCount: destinationList.filter((destination) => destination.kind !== 'result').length,
    flowStartCount: edges.filter((edge) => edge.kind === 'flow_start').length,
    safetyRouteCount: edges.filter((edge) => edge.kind === 'safety_interrupt' || edge.kind === 'deferred_safety')
      .length,
    deferredSafetyCount: edges.filter((edge) => edge.kind === 'deferred_safety').length,
    branchCount: orderedNodes.filter((node) => node.kind === 'score_branch').length,
    linearSequenceCount: linearSequences.length,
  };
  return {
    nodes: topologyNodes,
    nodeById,
    edgeById,
    terminalDestinations: destinationList,
    reachableDestinations,
    metrics,
  };
}
