import type { GuidedFlow } from '../../domain/flow-engine/types';
import {
  addOptionEdges,
  createEdge,
  getOrderedNodes,
  makeScoreRange,
  registerExternalDestination,
  registerMissingNodeDestination,
  resultLabel,
} from './flowTopologyEdges';
import {
  buildIncomingEdges,
  buildLocalTargets,
  calculateComponentDepths,
  calculateTerminalDestinationIds,
  findLinearSequences,
  stronglyConnectedComponents,
} from './flowTopologyGraph';
import { buildFlowTopologyView } from './flowTopologyFlowView';
import type { FlowTopology, FlowTopologyCycle, FlowTopologyDestination, FlowTopologyEdge } from './flowTopologyTypes';

type MutableDestination = FlowTopologyDestination;
type LocalEdge = FlowTopologyEdge;

/**
 * Builds the complete local topology for one flow. This function never mutates
 * the source flow and does not require a valid flow; malformed references are
 * represented as explicit destinations instead of being dropped.
 */
export function buildFlowTopology(flow: GuidedFlow, flows: GuidedFlow[]): FlowTopology {
  const orderedNodes = getOrderedNodes(flow);
  const nodeMap = new Map(orderedNodes.map((node) => [node.id, node]));
  const stepById = new Map(orderedNodes.map((node, index) => [node.id, index + 1]));
  const destinations = new Map<string, MutableDestination>();

  const registerDestination = (
    destination: Omit<MutableDestination, 'key' | 'reachableFromEntry' | 'sourceNodeIds'>,
  ) => {
    const existing = destinations.get(destination.id);
    if (existing) return existing;
    const created: MutableDestination = {
      ...destination,
      key: destination.id,
      reachableFromEntry: false,
      sourceNodeIds: [],
    };
    destinations.set(created.id, created);
    return created;
  };

  for (const node of orderedNodes) {
    if (node.kind !== 'result') continue;
    registerDestination({
      id: node.id,
      kind: 'result',
      label: resultLabel(node, stepById.get(node.id) ?? 0),
      target: node.id,
      nodeId: node.id,
      targetNodeId: node.id,
    });
  }

  const edges: LocalEdge[] = [];
  const addEdge = (edge: LocalEdge) => {
    if (edge.destinationId) {
      const destination = destinations.get(edge.destinationId);
      if (destination && !destination.sourceNodeIds.includes(edge.sourceNodeId)) {
        destination.sourceNodeIds.push(edge.sourceNodeId);
      }
    }
    if (edge.secondaryDestinationId) {
      const destination = destinations.get(edge.secondaryDestinationId);
      if (destination && !destination.sourceNodeIds.includes(edge.sourceNodeId)) {
        destination.sourceNodeIds.push(edge.sourceNodeId);
      }
    }
    edges.push(edge);
  };

  for (const node of orderedNodes) {
    if (node.kind === 'choice') {
      for (const option of node.options) {
        addOptionEdges(flow, flows, node, option, nodeMap, registerDestination, addEdge);
      }

      if (node.freeText) {
        const target = node.freeText.next;
        const targetNode = nodeMap.get(target);
        const destination = targetNode ? undefined : registerMissingNodeDestination(target, registerDestination);
        addEdge(
          createEdge({
            id: `${node.id}__free-text__${target}`,
            sourceNodeId: node.id,
            sourceHandle: 'free-text',
            optionLabel: 'Resposta livre',
            label: 'Resposta livre',
            kind: 'free_text',
            target: targetNode?.id ?? destination!.id,
            targetNodeId: targetNode?.id,
            targetExists: Boolean(targetNode),
            terminal: !targetNode,
            destinationId: targetNode?.kind === 'result' ? targetNode.id : destination?.id,
            effects: [],
            freeText: true,
          }),
        );
      }
    } else if (node.kind === 'score_branch') {
      for (const branch of node.branches) {
        const targetNode = nodeMap.get(branch.next);
        const missingDestination = targetNode
          ? undefined
          : registerMissingNodeDestination(branch.next, registerDestination);
        const range = makeScoreRange(branch);
        const navigationDestination = branch.navigation
          ? registerExternalDestination('navigate', branch.navigation, undefined, registerDestination)
          : undefined;
        addEdge(
          createEdge({
            id: `${node.id}__branch__${branch.id}__${branch.next}`,
            sourceNodeId: node.id,
            sourceHandle: branch.id,
            optionLabel: range.label,
            label: range.label,
            kind: 'score_branch',
            target: targetNode?.id ?? missingDestination!.id,
            targetNodeId: targetNode?.id,
            targetExists: Boolean(targetNode),
            terminal: !targetNode,
            destinationId: targetNode?.kind === 'result' ? targetNode.id : missingDestination?.id,
            secondaryDestinationId: navigationDestination?.id,
            scoreRange: range,
            branchId: branch.id,
            effects: [],
          }),
        );
      }
    }
  }

  // Resolve references after all destinations have been registered. This also
  // makes malformed-target and branch-navigation edges inspectable by UIs.
  for (const edge of edges) {
    if (edge.destinationId) edge.destination = destinations.get(edge.destinationId);
    if (edge.secondaryDestinationId) edge.secondaryDestination = destinations.get(edge.secondaryDestinationId);
  }

  const nodeIds = orderedNodes.map((node) => node.id);
  const localEdges = edges.filter(
    (edge) =>
      edge.kind !== 'flow_start' &&
      edge.targetFlowId === undefined &&
      edge.targetNodeId !== undefined &&
      nodeMap.has(edge.targetNodeId),
  );
  const localTargetsByNodeId = buildLocalTargets(nodeIds, localEdges);
  const localIncomingEdgesByNodeId = buildIncomingEdges(nodeIds, localEdges);
  const components = stronglyConnectedComponents(nodeIds, localTargetsByNodeId, stepById);
  const componentByNodeId = new Map<string, number>();
  components.forEach((component, index) => component.forEach((nodeId) => componentByNodeId.set(nodeId, index)));
  const stronglyConnectedComponentRecords = components.map((nodeIdsInComponent, index) => {
    const selfLoop =
      nodeIdsInComponent.length === 1 && localTargetsByNodeId.get(nodeIdsInComponent[0])?.has(nodeIdsInComponent[0]);
    return {
      id: `cycle-${index + 1}`,
      nodeIds: nodeIdsInComponent,
      cyclic: nodeIdsInComponent.length > 1 || Boolean(selfLoop),
    } satisfies FlowTopologyCycle;
  });
  const cycles = stronglyConnectedComponentRecords.filter((component) => component.cyclic);
  const cycleByNodeId = new Map<string, FlowTopologyCycle>();
  cycles
    .filter((cycle) => cycle.cyclic)
    .forEach((cycle) => cycle.nodeIds.forEach((nodeId) => cycleByNodeId.set(nodeId, cycle)));

  const depthByNodeId = calculateComponentDepths(
    flow.entry.nodeId,
    components,
    componentByNodeId,
    localTargetsByNodeId,
    nodeMap,
  );
  const reachableNodeIds = orderedNodes.filter((node) => depthByNodeId[node.id] !== undefined).map((node) => node.id);
  const reachableSet = new Set(reachableNodeIds);
  const unreachableNodeIds = orderedNodes.filter((node) => !reachableSet.has(node.id)).map((node) => node.id);

  const terminalDestinationIdsByNodeId = calculateTerminalDestinationIds(orderedNodes, edges, nodeMap, destinations);
  const destinationIdsByNodeId = terminalDestinationIdsByNodeId;
  const destinationOrder = new Map([...destinations.keys()].map((id, index) => [id, index]));
  const sortDestinationIds = (ids: Iterable<string>) =>
    [...new Set(ids)].sort(
      (left, right) =>
        (destinationOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (destinationOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right),
    );

  const reverseReachableDestinationIds: Record<string, string[]> = {};
  for (const destinationId of destinations.keys()) reverseReachableDestinationIds[destinationId] = [];
  for (const node of orderedNodes) {
    const ids = sortDestinationIds(terminalDestinationIdsByNodeId[node.id] ?? []);
    terminalDestinationIdsByNodeId[node.id] = ids;
    for (const destinationId of ids) reverseReachableDestinationIds[destinationId]?.push(node.id);
  }
  for (const destination of destinations.values()) {
    destination.sourceNodeIds = reverseReachableDestinationIds[destination.id] ?? [];
    destination.reachableFromEntry = destination.sourceNodeIds.some((nodeId) => reachableSet.has(nodeId));
  }

  const destinationList = [...destinations.values()];
  const reachableDestinationIds = destinationList
    .filter((destination) => destination.reachableFromEntry)
    .map((destination) => destination.id);
  const destinationById = Object.fromEntries(destinationList.map((destination) => [destination.id, destination]));

  const incomingCountByNodeId: Record<string, number> = Object.fromEntries(
    nodeIds.map((id) => [id, localIncomingEdgesByNodeId.get(id)?.length ?? 0]),
  );
  const outgoingCountByNodeId: Record<string, number> = Object.fromEntries(
    nodeIds.map((id) => [id, edges.filter((edge) => edge.sourceNodeId === id).length]),
  );
  const localOutgoingCountByNodeId: Record<string, number> = Object.fromEntries(
    nodeIds.map((id) => [id, localEdges.filter((edge) => edge.sourceNodeId === id).length]),
  );

  const linearSequences = findLinearSequences(
    orderedNodes,
    edges,
    localTargetsByNodeId,
    localIncomingEdgesByNodeId,
    cycleByNodeId,
    stepById,
  );
  const sequenceByNodeId = new Map<string, string>();
  linearSequences.forEach((sequence) =>
    sequence.nodeIds.forEach((nodeId) => sequenceByNodeId.set(nodeId, sequence.id)),
  );

  const view = buildFlowTopologyView({
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
  });

  return {
    flow,
    flowId: flow.id,
    entryNodeId: flow.entry.nodeId,
    entryNode: view.nodeById[flow.entry.nodeId],
    nodes: view.nodes,
    nodeById: view.nodeById,
    edges,
    edgeById: view.edgeById,
    destinations: destinationList,
    terminalDestinations: view.terminalDestinations,
    reachableDestinations: view.reachableDestinations,
    destinationById,
    destinationIds: destinationList.map((destination) => destination.id),
    terminalDestinationIds: destinationList.map((destination) => destination.id),
    reachableTerminalDestinationIds: reachableDestinationIds,
    reachableNodeIds,
    unreachableNodeIds,
    depthByNodeId,
    incomingCountByNodeId,
    outgoingCountByNodeId,
    terminalDestinationIdsByNodeId,
    destinationIdsByNodeId,
    reverseReachableDestinationIds,
    reverseReachableNodeIdsByDestinationId: reverseReachableDestinationIds,
    reverseReachableDestinationIdsByNodeId: destinationIdsByNodeId,
    stronglyConnectedComponents: components,
    cycles,
    cycleNodeIds: [...cycleByNodeId.keys()].sort(
      (left, right) => (stepById.get(left) ?? 0) - (stepById.get(right) ?? 0),
    ),
    linearSequences,
    sequences: linearSequences,
    metrics: view.metrics,
  };
}
