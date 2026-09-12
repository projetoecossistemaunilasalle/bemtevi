import type { GuidedFlow } from '../../domain/flow-engine/types';
import { buildFlowTopology } from './flowTopologyFlow';
import type {
  FlowTopologyDestination,
  FlowTopologyEdge,
  SystemDestinationNode,
  SystemFlowConnection,
  SystemFlowDestination,
  SystemFlowNode,
  SystemFlowTopology,
} from './flowTopologyTypes';

/** Builds the system graph without expanding any flow's local nodes. */
export function buildSystemFlowTopology(flows: GuidedFlow[]): SystemFlowTopology {
  const flowTopologies = flows.map((flow) => buildFlowTopology(flow, flows));
  const topologyByFlowId = Object.fromEntries(flowTopologies.map((topology) => [topology.flowId, topology]));
  const flowIds = new Set(flows.map((flow) => flow.id));
  const destinations = new Map<string, SystemFlowDestination>();
  const connections: SystemFlowConnection[] = [];

  const addDestination = (sourceFlowId: string, destination: FlowTopologyDestination) => {
    const existing = destinations.get(destination.id);
    if (existing) {
      if (!existing.sourceFlowIds.includes(sourceFlowId)) existing.sourceFlowIds.push(sourceFlowId);
      return existing;
    }
    const created: SystemFlowDestination = {
      id: destination.id,
      key: destination.id,
      kind: destination.kind,
      label: destination.label,
      value: destination.value,
      flowId: destination.flowId,
      target: destination.target,
      sourceFlowIds: [sourceFlowId],
    };
    destinations.set(created.id, created);
    return created;
  };

  const addConnection = (
    sourceFlowId: string,
    edge: FlowTopologyEdge,
    destination: FlowTopologyDestination | undefined,
    secondary: boolean,
    suffix = '',
  ) => {
    if (edge.kind === 'flow_start' && edge.targetFlowId && flowIds.has(edge.targetFlowId)) {
      connections.push({
        id: `${sourceFlowId}:${edge.id}${suffix}`,
        source: sourceFlowId,
        sourceFlowId,
        sourceNodeId: edge.sourceNodeId,
        sourceHandle: edge.sourceHandle,
        optionId: edge.optionId,
        optionLabel: edge.optionLabel,
        label: edge.label ?? edge.optionLabel,
        kind: 'flow_start',
        target: edge.targetFlowId,
        targetFlowId: edge.targetFlowId,
        targetNodeId: edge.targetNodeId,
        secondary,
      });
      return;
    }
    if (!destination) return;
    if (destination.kind === 'missing_node' || destination.kind === 'result') return;
    const systemDestination = addDestination(sourceFlowId, destination);
    const kind = edge.kind === 'flow_start' ? 'flow_start' : destination.kind;
    if (
      kind !== 'navigate' &&
      kind !== 'safety_interrupt' &&
      kind !== 'deferred_safety' &&
      kind !== 'end_flow' &&
      kind !== 'flow_start'
    )
      return;
    connections.push({
      id: `${sourceFlowId}:${edge.id}${suffix}`,
      source: sourceFlowId,
      sourceFlowId,
      sourceNodeId: edge.sourceNodeId,
      sourceHandle: edge.sourceHandle,
      optionId: edge.optionId,
      optionLabel: edge.optionLabel,
      label: edge.label ?? edge.optionLabel,
      kind,
      target: systemDestination.id,
      targetDestinationId: systemDestination.id,
      destination: systemDestination,
      secondary,
    });
  };

  for (const topology of flowTopologies) {
    for (const edge of topology.edges) {
      if (
        edge.kind === 'flow_start' ||
        edge.kind === 'navigate' ||
        edge.kind === 'safety_interrupt' ||
        edge.kind === 'deferred_safety' ||
        edge.kind === 'end_flow'
      ) {
        addConnection(
          topology.flowId,
          edge,
          edge.destinationId ? topology.destinationById[edge.destinationId] : undefined,
          edge.secondary,
        );
      }
      if (edge.secondaryDestinationId && edge.secondaryDestination) {
        addConnection(topology.flowId, edge, edge.secondaryDestination, true, ':secondary');
      }
    }
  }

  const incomingCountByFlowId: Record<string, number> = Object.fromEntries(flows.map((flow) => [flow.id, 0]));
  const outgoingCountByFlowId: Record<string, number> = Object.fromEntries(flows.map((flow) => [flow.id, 0]));
  for (const connection of connections) {
    outgoingCountByFlowId[connection.sourceFlowId] = (outgoingCountByFlowId[connection.sourceFlowId] ?? 0) + 1;
    if (connection.targetFlowId)
      incomingCountByFlowId[connection.targetFlowId] = (incomingCountByFlowId[connection.targetFlowId] ?? 0) + 1;
  }
  const connectedFlowIds = flows
    .filter((flow) => (outgoingCountByFlowId[flow.id] ?? 0) > 0 || (incomingCountByFlowId[flow.id] ?? 0) > 0)
    .map((flow) => flow.id);
  const connectedSet = new Set(connectedFlowIds);
  const disconnectedFlowIds = flows.filter((flow) => !connectedSet.has(flow.id)).map((flow) => flow.id);

  const destinationList = [...destinations.values()];
  const flowNodes: SystemFlowNode[] = flows.map((flow) => {
    const topology = topologyByFlowId[flow.id];
    return {
      kind: 'flow',
      id: flow.id,
      flowId: flow.id,
      flow,
      title: flow.title,
      status: flow.status,
      stepCount: topology?.nodes.length ?? Object.keys(flow.nodes).length,
      finalCount:
        topology?.nodes.filter((node) => node.kind === 'result').length ??
        Object.values(flow.nodes).filter((node) => node.kind === 'result').length,
      reachableNodeCount: topology?.reachableNodeIds.length ?? 0,
      incomingCount: incomingCountByFlowId[flow.id] ?? 0,
      outgoingCount: outgoingCountByFlowId[flow.id] ?? 0,
      connected: connectedSet.has(flow.id),
    };
  });
  const destinationNodes: SystemDestinationNode[] = destinationList.map((destination) => ({
    ...destination,
    kind:
      destination.kind === 'missing_flow'
        ? 'missing_flow'
        : destination.kind === 'navigate'
          ? 'navigate'
          : destination.kind === 'safety_interrupt'
            ? 'safety_interrupt'
            : destination.kind === 'deferred_safety'
              ? 'deferred_safety'
              : 'end_flow',
    nodeKind: 'destination',
  }));

  return {
    flows,
    flowNodes,
    destinations: destinationList,
    externalDestinations: destinationList,
    nodes: [...flowNodes, ...destinationNodes],
    connections,
    edges: connections,
    flowTopologiesById: topologyByFlowId,
    incomingCountByFlowId,
    outgoingCountByFlowId,
    connectedFlowIds,
    disconnectedFlowIds,
  };
}
