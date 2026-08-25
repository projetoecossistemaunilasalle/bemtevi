import type {
  FlowEffect,
  FlowNode,
  FlowOption,
  GuidedFlow,
  ScoreBranch,
  ScoreFlowEffect,
} from '../../domain/flow-engine/types';

/** A transition kind is deliberately structural, not a semantic route category. */
export type FlowTopologyTransitionKind =
  | 'normal'
  | 'free_text'
  | 'score'
  | 'score_branch'
  | 'flow_start'
  | 'navigate'
  | 'safety_interrupt'
  | 'deferred_safety'
  | 'end_flow';

export type FlowTopologyDestinationKind =
  | 'result'
  | 'navigate'
  | 'safety_interrupt'
  | 'deferred_safety'
  | 'flow_start'
  | 'end_flow'
  | 'missing_node'
  | 'missing_flow';

export interface FlowTopologyScoreAnnotation {
  scoreKey: string;
  value: number;
}

export interface FlowTopologyScoreRange {
  id: string;
  min: number;
  max: number;
  label: string;
}

export interface FlowTopologyDestination {
  /** Stable within the topology. Result IDs are the original node IDs. */
  id: string;
  key: string;
  kind: FlowTopologyDestinationKind;
  label: string;
  value?: string;
  target?: string;
  flowId?: string;
  nodeId?: string;
  targetNodeId?: string;
  reachableFromEntry: boolean;
  sourceNodeIds: string[];
}

export interface FlowTopologyEdge {
  id: string;
  source: string;
  sourceNodeId: string;
  /** Local target, a destination ID, or a flow-start destination ID. */
  target: string;
  targetNodeId?: string;
  targetFlowId?: string;
  targetExists: boolean;
  sourceHandle: string;
  optionId?: string;
  optionLabel?: string;
  label?: string;
  kind: FlowTopologyTransitionKind;
  /** Aliases keep the data convenient for graph renderers. */
  type: FlowTopologyTransitionKind;
  transitionKind: FlowTopologyTransitionKind;
  terminal: boolean;
  isTerminal: boolean;
  secondary: boolean;
  isSecondary: boolean;
  deferred: boolean;
  isDeferred: boolean;
  freeText: boolean;
  isFreeText: boolean;
  destinationId?: string;
  destination?: FlowTopologyDestination;
  secondaryDestinationId?: string;
  secondaryDestination?: FlowTopologyDestination;
  score?: FlowTopologyScoreAnnotation;
  scores: FlowTopologyScoreAnnotation[];
  scoreRange?: FlowTopologyScoreRange;
  branchId?: string;
  effects: FlowEffect[];
}

export interface FlowTopologyCycle {
  id: string;
  nodeIds: string[];
  /** True for an SCC with a self-loop or more than one node. */
  cyclic: boolean;
}

export interface FlowTopologySequenceMarker {
  nodeId: string;
  stepNumber: number;
  kind: 'score' | 'deferred_safety' | 'video';
}

export interface FlowTopologySequence {
  id: string;
  nodeIds: string[];
  startNodeId: string;
  endNodeId: string;
  startStep: number;
  endStep: number;
  length: number;
  markers: FlowTopologySequenceMarker[];
  hasScore: boolean;
  hasDeferredSafety: boolean;
  expandedByDefault: boolean;
}

export interface FlowTopologyNode {
  id: string;
  node: FlowNode;
  kind: FlowNode['kind'];
  /** One-based editorial number, never a graph depth. */
  stepNumber: number;
  step: number;
  order: number;
  reachable: boolean;
  depth?: number;
  incomingCount: number;
  outgoingCount: number;
  localIncomingCount: number;
  localOutgoingCount: number;
  terminalDestinationIds: string[];
  destinationIds: string[];
  reverseReachableDestinationIds: string[];
  cycleId?: string;
  inCycle: boolean;
  linearSequenceId?: string;
}

export interface FlowTopologyMetrics {
  nodeCount: number;
  reachableNodeCount: number;
  unreachableNodeCount: number;
  resultCount: number;
  terminalDestinationCount: number;
  reachableTerminalDestinationCount: number;
  externalDestinationCount: number;
  flowStartCount: number;
  safetyRouteCount: number;
  deferredSafetyCount: number;
  branchCount: number;
  linearSequenceCount: number;
}

export interface FlowTopology {
  flow: GuidedFlow;
  flowId: string;
  entryNodeId: string;
  entryNode?: FlowTopologyNode;
  nodes: FlowTopologyNode[];
  nodeById: Record<string, FlowTopologyNode>;
  edges: FlowTopologyEdge[];
  edgeById: Record<string, FlowTopologyEdge>;
  destinations: FlowTopologyDestination[];
  terminalDestinations: FlowTopologyDestination[];
  reachableDestinations: FlowTopologyDestination[];
  destinationById: Record<string, FlowTopologyDestination>;
  destinationIds: string[];
  terminalDestinationIds: string[];
  reachableTerminalDestinationIds: string[];
  reachableNodeIds: string[];
  unreachableNodeIds: string[];
  depthByNodeId: Record<string, number | undefined>;
  incomingCountByNodeId: Record<string, number>;
  outgoingCountByNodeId: Record<string, number>;
  terminalDestinationIdsByNodeId: Record<string, string[]>;
  destinationIdsByNodeId: Record<string, string[]>;
  /** Destination ID -> every local node that can eventually reach it. */
  reverseReachableDestinationIds: Record<string, string[]>;
  reverseReachableNodeIdsByDestinationId: Record<string, string[]>;
  /** Node ID -> destinations reachable from that node. */
  reverseReachableDestinationIdsByNodeId: Record<string, string[]>;
  stronglyConnectedComponents: string[][];
  cycles: FlowTopologyCycle[];
  cycleNodeIds: string[];
  linearSequences: FlowTopologySequence[];
  /** Alias used by compacting renderers. */
  sequences: FlowTopologySequence[];
  metrics: FlowTopologyMetrics;
}

export type SystemFlowConnectionKind = 'flow_start' | 'navigate' | 'safety_interrupt' | 'deferred_safety' | 'end_flow';

export interface SystemFlowDestination {
  id: string;
  key: string;
  kind: FlowTopologyDestinationKind;
  label: string;
  value?: string;
  flowId?: string;
  target?: string;
  sourceFlowIds: string[];
}

export interface SystemFlowNode {
  kind: 'flow';
  id: string;
  flowId: string;
  flow: GuidedFlow;
  title: string;
  status: GuidedFlow['status'];
  stepCount: number;
  finalCount: number;
  reachableNodeCount: number;
  incomingCount: number;
  outgoingCount: number;
  connected: boolean;
}

export interface SystemDestinationNode extends Omit<SystemFlowDestination, 'kind'> {
  kind: 'navigate' | 'safety_interrupt' | 'deferred_safety' | 'end_flow' | 'missing_flow';
  nodeKind: 'destination';
}

export type SystemTopologyNode = SystemFlowNode | SystemDestinationNode;

export interface SystemFlowConnection {
  id: string;
  source: string;
  sourceFlowId: string;
  sourceNodeId: string;
  sourceHandle: string;
  optionId?: string;
  optionLabel?: string;
  label?: string;
  kind: SystemFlowConnectionKind;
  target: string;
  targetFlowId?: string;
  targetDestinationId?: string;
  targetNodeId?: string;
  destination?: SystemFlowDestination;
  secondary: boolean;
}

export interface SystemFlowTopology {
  flows: GuidedFlow[];
  flowNodes: SystemFlowNode[];
  destinations: SystemFlowDestination[];
  externalDestinations: SystemFlowDestination[];
  nodes: SystemTopologyNode[];
  connections: SystemFlowConnection[];
  edges: SystemFlowConnection[];
  flowTopologiesById: Record<string, FlowTopology>;
  incomingCountByFlowId: Record<string, number>;
  outgoingCountByFlowId: Record<string, number>;
  connectedFlowIds: string[];
  disconnectedFlowIds: string[];
}

type MutableDestination = FlowTopologyDestination;
type LocalEdge = FlowTopologyEdge;

const TERMINAL_EFFECT_ORDER: FlowEffect['kind'][] = ['safety_interrupt', 'navigate', 'end_flow'];

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
  const terminalDestinations = destinationList;
  const reachableDestinations = destinationList.filter((destination) => destination.reachableFromEntry);
  const metrics: FlowTopologyMetrics = {
    nodeCount: topologyNodes.length,
    reachableNodeCount: reachableNodeIds.length,
    unreachableNodeCount: unreachableNodeIds.length,
    resultCount: orderedNodes.filter((node) => node.kind === 'result').length,
    terminalDestinationCount: terminalDestinations.length,
    reachableTerminalDestinationCount: reachableDestinations.length,
    externalDestinationCount: terminalDestinations.filter((destination) => destination.kind !== 'result').length,
    flowStartCount: edges.filter((edge) => edge.kind === 'flow_start').length,
    safetyRouteCount: edges.filter((edge) => edge.kind === 'safety_interrupt' || edge.kind === 'deferred_safety')
      .length,
    deferredSafetyCount: edges.filter((edge) => edge.kind === 'deferred_safety').length,
    branchCount: orderedNodes.filter((node) => node.kind === 'score_branch').length,
    linearSequenceCount: linearSequences.length,
  };

  return {
    flow,
    flowId: flow.id,
    entryNodeId: flow.entry.nodeId,
    entryNode: nodeById[flow.entry.nodeId],
    nodes: topologyNodes,
    nodeById,
    edges,
    edgeById,
    destinations: destinationList,
    terminalDestinations,
    reachableDestinations,
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
    metrics,
  };
}

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

function getOrderedNodes(flow: GuidedFlow): FlowNode[] {
  const nodeMap = flow.nodes;
  const ordered: FlowNode[] = [];
  const seen = new Set<string>();
  if (flow.nodeOrder) {
    for (const id of flow.nodeOrder) {
      const node = nodeMap[id];
      if (node && !seen.has(node.id)) {
        ordered.push(node);
        seen.add(node.id);
      }
    }
  }
  for (const node of Object.values(nodeMap)) {
    if (!seen.has(node.id)) {
      ordered.push(node);
      seen.add(node.id);
    }
  }
  return ordered;
}

function resultLabel(node: FlowNode, step: number) {
  return `Etapa ${step} · ${excerpt(node.text)}`;
}

function excerpt(text: string, length = 72) {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return normalized.length <= length ? normalized : `${normalized.slice(0, length - 1).trimEnd()}…`;
}

function makeScoreRange(branch: ScoreBranch): FlowTopologyScoreRange {
  return { id: branch.id, min: branch.min, max: branch.max, label: `${branch.min}–${branch.max}` };
}

function createEdge(
  input: Partial<FlowTopologyEdge> & Pick<FlowTopologyEdge, 'id' | 'sourceNodeId' | 'sourceHandle' | 'target' | 'kind'>,
): FlowTopologyEdge {
  const kind = input.kind;
  const effects = input.effects ?? [];
  const scores = input.scores ?? [];
  return {
    id: input.id,
    source: input.sourceNodeId,
    sourceNodeId: input.sourceNodeId,
    target: input.target,
    targetNodeId: input.targetNodeId,
    targetFlowId: input.targetFlowId,
    targetExists: input.targetExists ?? Boolean(input.targetNodeId),
    sourceHandle: input.sourceHandle,
    optionId: input.optionId,
    optionLabel: input.optionLabel,
    label: input.label,
    kind,
    type: kind,
    transitionKind: kind,
    terminal: input.terminal ?? false,
    isTerminal: input.terminal ?? false,
    secondary: input.secondary ?? false,
    isSecondary: input.secondary ?? false,
    deferred: input.deferred ?? kind === 'deferred_safety',
    isDeferred: input.deferred ?? kind === 'deferred_safety',
    freeText: input.freeText ?? kind === 'free_text',
    isFreeText: input.freeText ?? kind === 'free_text',
    destinationId: input.destinationId,
    destination: input.destination,
    secondaryDestinationId: input.secondaryDestinationId,
    secondaryDestination: input.secondaryDestination,
    score: input.score ?? scores[0],
    scores,
    scoreRange: input.scoreRange,
    branchId: input.branchId,
    effects,
  };
}

function addOptionEdges(
  flow: GuidedFlow,
  flows: GuidedFlow[],
  node: Extract<FlowNode, { kind: 'choice' }>,
  option: FlowOption,
  nodeMap: Map<string, FlowNode>,
  registerDestination: (
    destination: Omit<MutableDestination, 'key' | 'reachableFromEntry' | 'sourceNodeIds'>,
  ) => MutableDestination,
  addEdge: (edge: FlowTopologyEdge) => void,
) {
  const effects = option.effects ?? [];
  const scores = effects
    .filter((effect): effect is ScoreFlowEffect => effect.kind === 'score')
    .map(({ scoreKey, value }) => ({ scoreKey, value }));
  const terminalEffect = findTerminalEffect(effects);
  const flowStart = effects.find((effect) => effect.kind === 'flow_start');
  const deferred = findLastEffect(effects, 'deferred_safety');
  const targetNode = nodeMap.get(option.next);
  let primary: FlowTopologyEdge;

  if (terminalEffect) {
    const destination = registerEffectDestination(terminalEffect, registerDestination);
    primary = createEdge({
      id: `${node.id}__${option.id}__${terminalEffect.kind}`,
      sourceNodeId: node.id,
      sourceHandle: option.id,
      optionId: option.id,
      optionLabel: option.label,
      label: option.label,
      kind: terminalEffect.kind,
      target: destination.id,
      targetExists: true,
      terminal: true,
      destinationId: destination.id,
      destination,
      scores,
      score: scores[0],
      effects,
    });
  } else if (flowStart?.kind === 'flow_start') {
    const targetFlow = flows.find((candidate) => candidate.id === flowStart.flowId);
    const destination = targetFlow
      ? registerDestination({
          id: `flow_start:${targetFlow.id}`,
          kind: 'flow_start',
          label: `Fluxo · ${targetFlow.title}`,
          value: targetFlow.id,
          target: targetFlow.entry.nodeId,
          flowId: targetFlow.id,
          targetNodeId: targetFlow.entry.nodeId,
        })
      : registerDestination({
          id: `missing_flow:${flowStart.flowId}`,
          kind: 'missing_flow',
          label: `Fluxo ausente · ${flowStart.flowId}`,
          value: flowStart.flowId,
          target: flowStart.flowId,
          flowId: flowStart.flowId,
        });
    primary = createEdge({
      id: `${node.id}__${option.id}__flow-start__${flowStart.flowId}`,
      sourceNodeId: node.id,
      sourceHandle: option.id,
      optionId: option.id,
      optionLabel: option.label,
      label: option.label,
      kind: 'flow_start',
      target: destination.id,
      targetFlowId: targetFlow?.id,
      targetNodeId: targetFlow?.entry.nodeId,
      targetExists: Boolean(targetFlow),
      terminal: true,
      destinationId: destination.id,
      destination,
      scores,
      score: scores[0],
      effects,
    });
  } else {
    const missingDestination = targetNode
      ? undefined
      : registerMissingNodeDestination(option.next, registerDestination);
    const kind: FlowTopologyTransitionKind = scores.length > 0 ? 'score' : 'normal';
    primary = createEdge({
      id: `${node.id}__${option.id}__${option.next}`,
      sourceNodeId: node.id,
      sourceHandle: option.id,
      optionId: option.id,
      optionLabel: option.label,
      label: option.label,
      kind,
      target: targetNode?.id ?? missingDestination!.id,
      targetNodeId: targetNode?.id,
      targetExists: Boolean(targetNode),
      terminal: !targetNode,
      destinationId: targetNode?.kind === 'result' ? targetNode.id : missingDestination?.id,
      scores,
      score: scores[0],
      effects,
    });
  }

  addEdge(primary);

  // deferred_safety is intentionally a second edge. It never replaces the normal
  // route, and is suppressed only when a higher-priority terminal effect exists.
  if (deferred && !terminalEffect) {
    const deferredDestination = registerEffectDestination(deferred, registerDestination);
    addEdge(
      createEdge({
        id: `${node.id}__${option.id}__deferred-safety`,
        sourceNodeId: node.id,
        sourceHandle: `${option.id}__deferred-safety`,
        optionId: option.id,
        optionLabel: option.label,
        label: 'ao concluir',
        kind: 'deferred_safety',
        target: deferredDestination.id,
        targetExists: true,
        terminal: true,
        secondary: true,
        deferred: true,
        destinationId: deferredDestination.id,
        destination: deferredDestination,
        effects: [deferred],
      }),
    );
  }
}

function findTerminalEffect(
  effects: FlowEffect[],
): Extract<FlowEffect, { kind: 'safety_interrupt' | 'navigate' | 'end_flow' }> | undefined {
  for (const kind of TERMINAL_EFFECT_ORDER) {
    const effect = effects.find((candidate) => candidate.kind === kind);
    if (effect && (effect.kind === 'safety_interrupt' || effect.kind === 'navigate' || effect.kind === 'end_flow'))
      return effect;
  }
  return undefined;
}

function findLastEffect<TKind extends FlowEffect['kind']>(
  effects: FlowEffect[],
  kind: TKind,
): Extract<FlowEffect, { kind: TKind }> | undefined {
  const effect = [...effects].reverse().find((candidate) => candidate.kind === kind);
  return effect as Extract<FlowEffect, { kind: TKind }> | undefined;
}

function registerEffectDestination(
  effect: Extract<FlowEffect, { kind: 'safety_interrupt' | 'navigate' | 'end_flow' | 'deferred_safety' }>,
  registerDestination: (
    destination: Omit<MutableDestination, 'key' | 'reachableFromEntry' | 'sourceNodeIds'>,
  ) => MutableDestination,
) {
  if (effect.kind === 'end_flow') {
    return registerDestination({ id: 'end_flow', kind: 'end_flow', label: 'Encerramento' });
  }
  const value = effect.destination;
  return registerDestination({
    id: `${effect.kind}:${value}`,
    kind: effect.kind,
    label:
      effect.kind === 'safety_interrupt'
        ? `Segurança imediata · ${value}`
        : effect.kind === 'deferred_safety'
          ? `Segurança ao concluir · ${value}`
          : value,
    value,
    target: value,
  });
}

function registerExternalDestination(
  kind: 'navigate',
  value: string,
  _unused: undefined,
  registerDestination: (
    destination: Omit<MutableDestination, 'key' | 'reachableFromEntry' | 'sourceNodeIds'>,
  ) => MutableDestination,
) {
  return registerDestination({ id: `${kind}:${value}`, kind, label: value, value, target: value });
}

function registerMissingNodeDestination(
  target: string,
  registerDestination: (
    destination: Omit<MutableDestination, 'key' | 'reachableFromEntry' | 'sourceNodeIds'>,
  ) => MutableDestination,
) {
  return registerDestination({
    id: `missing_node:${target}`,
    kind: 'missing_node',
    label: `Destino ausente · ${target}`,
    value: target,
    target,
  });
}

function buildLocalTargets(nodeIds: string[], edges: FlowTopologyEdge[]) {
  const targets = new Map<string, Set<string>>(nodeIds.map((id) => [id, new Set<string>()]));
  for (const edge of edges) {
    if (edge.targetNodeId && targets.has(edge.sourceNodeId)) targets.get(edge.sourceNodeId)!.add(edge.targetNodeId);
  }
  return targets;
}

function buildIncomingEdges(nodeIds: string[], edges: FlowTopologyEdge[]) {
  const incoming = new Map<string, FlowTopologyEdge[]>(nodeIds.map((id) => [id, []]));
  for (const edge of edges) {
    if (edge.targetNodeId && incoming.has(edge.targetNodeId)) incoming.get(edge.targetNodeId)!.push(edge);
  }
  return incoming;
}

function stronglyConnectedComponents(
  nodeIds: string[],
  targets: Map<string, Set<string>>,
  stepById: Map<string, number>,
): string[][] {
  let nextIndex = 0;
  const indexById = new Map<string, number>();
  const lowLinkById = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const visit = (nodeId: string) => {
    indexById.set(nodeId, nextIndex);
    lowLinkById.set(nodeId, nextIndex);
    nextIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);
    for (const target of targets.get(nodeId) ?? []) {
      if (!indexById.has(target)) {
        visit(target);
        lowLinkById.set(nodeId, Math.min(lowLinkById.get(nodeId)!, lowLinkById.get(target)!));
      } else if (onStack.has(target)) {
        lowLinkById.set(nodeId, Math.min(lowLinkById.get(nodeId)!, indexById.get(target)!));
      }
    }
    if (lowLinkById.get(nodeId) !== indexById.get(nodeId)) return;
    const component: string[] = [];
    let popped: string;
    do {
      popped = stack.pop()!;
      onStack.delete(popped);
      component.push(popped);
    } while (popped !== nodeId);
    component.sort(
      (left, right) => (stepById.get(left) ?? 0) - (stepById.get(right) ?? 0) || left.localeCompare(right),
    );
    components.push(component);
  };

  nodeIds.forEach((nodeId) => {
    if (!indexById.has(nodeId)) visit(nodeId);
  });
  components.sort(
    (left, right) => (stepById.get(left[0]) ?? 0) - (stepById.get(right[0]) ?? 0) || left[0].localeCompare(right[0]),
  );
  return components;
}

function calculateComponentDepths(
  entryNodeId: string,
  components: string[][],
  componentByNodeId: Map<string, number>,
  targets: Map<string, Set<string>>,
  nodeMap: Map<string, FlowNode>,
): Record<string, number | undefined> {
  const depths: Record<string, number | undefined> = {};
  const entryComponent = componentByNodeId.get(entryNodeId);
  if (entryComponent === undefined || !nodeMap.has(entryNodeId)) return depths;
  const componentTargets = new Map<number, Set<number>>(
    components.map((_component, index) => [index, new Set<number>()]),
  );
  for (const [source, sourceTargets] of targets) {
    const sourceComponent = componentByNodeId.get(source);
    if (sourceComponent === undefined) continue;
    for (const target of sourceTargets) {
      const targetComponent = componentByNodeId.get(target);
      if (targetComponent !== undefined && targetComponent !== sourceComponent)
        componentTargets.get(sourceComponent)!.add(targetComponent);
    }
  }
  const componentDepth = new Map<number, number>([[entryComponent, 0]]);
  const queue = [entryComponent];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const currentDepth = componentDepth.get(current)!;
    for (const target of componentTargets.get(current) ?? []) {
      const nextDepth = currentDepth + 1;
      if (componentDepth.get(target) === undefined || nextDepth < componentDepth.get(target)!) {
        componentDepth.set(target, nextDepth);
        queue.push(target);
      }
    }
  }
  for (const [componentIndex, depth] of componentDepth) {
    for (const nodeId of components[componentIndex]) depths[nodeId] = depth;
  }
  return depths;
}

function calculateTerminalDestinationIds(
  nodes: FlowNode[],
  edges: FlowTopologyEdge[],
  nodeMap: Map<string, FlowNode>,
  destinations: Map<string, MutableDestination>,
): Record<string, string[]> {
  const terminals = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set<string>()]));
  for (const node of nodes) {
    if (node.kind === 'result' && destinations.has(node.id)) terminals.get(node.id)!.add(node.id);
  }
  for (const edge of edges) {
    const set = terminals.get(edge.sourceNodeId);
    if (!set) continue;
    if (
      edge.destinationId &&
      destinations.has(edge.destinationId) &&
      (edge.kind === 'flow_start' || !edge.targetNodeId)
    )
      set.add(edge.destinationId);
    if (edge.secondaryDestinationId && destinations.has(edge.secondaryDestinationId))
      set.add(edge.secondaryDestinationId);
    if (
      edge.kind !== 'flow_start' &&
      edge.targetNodeId &&
      nodeMap.has(edge.targetNodeId) &&
      nodeMap.get(edge.targetNodeId)?.kind === 'result'
    )
      set.add(edge.targetNodeId);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (edge.kind === 'flow_start' || !edge.targetNodeId) continue;
      const source = terminals.get(edge.sourceNodeId);
      const target = terminals.get(edge.targetNodeId);
      if (!source || !target) continue;
      for (const destinationId of target) {
        if (!source.has(destinationId)) {
          source.add(destinationId);
          changed = true;
        }
      }
    }
  }
  return Object.fromEntries(nodes.map((node) => [node.id, [...(terminals.get(node.id) ?? new Set<string>())]]));
}

function findLinearSequences(
  nodes: FlowNode[],
  edges: FlowTopologyEdge[],
  targets: Map<string, Set<string>>,
  incoming: Map<string, FlowTopologyEdge[]>,
  cycles: Map<string, FlowTopologyCycle>,
  stepById: Map<string, number>,
): FlowTopologySequence[] {
  const immediateTerminalKinds = new Set<FlowTopologyTransitionKind>([
    'safety_interrupt',
    'navigate',
    'end_flow',
    'flow_start',
  ]);
  const candidate = new Map<string, boolean>();
  for (const node of nodes) {
    const nodeEdges = edges.filter((edge) => edge.sourceNodeId === node.id);
    const targetIds = targets.get(node.id) ?? new Set<string>();
    const hasImmediateTerminal = nodeEdges.some((edge) => edge.terminal && immediateTerminalKinds.has(edge.kind));
    const valid =
      node.kind !== 'result' &&
      node.kind !== 'score_branch' &&
      targetIds.size === 1 &&
      !cycles.has(node.id) &&
      !hasImmediateTerminal;
    candidate.set(node.id, valid);
  }

  const sequences: FlowTopologySequence[] = [];
  const assigned = new Set<string>();
  for (const node of nodes) {
    if (!candidate.get(node.id) || assigned.has(node.id)) continue;
    const predecessorIds = uniquePredecessors(node.id, incoming);
    if (
      predecessorIds.length === 1 &&
      candidate.get(predecessorIds[0]) &&
      (targets.get(predecessorIds[0])?.size ?? 0) === 1
    )
      continue;

    const nodeIds: string[] = [];
    let current = node.id;
    while (candidate.get(current) && !assigned.has(current)) {
      nodeIds.push(current);
      const next = [...(targets.get(current) ?? [])][0];
      if (!next || !candidate.get(next)) break;
      const nextPredecessors = uniquePredecessors(next, incoming);
      if (nextPredecessors.length !== 1 || nextPredecessors[0] !== current) break;
      current = next;
    }
    if (nodeIds.length < 4) continue;
    const sequence: FlowTopologySequence = {
      id: `linear:${nodeIds[0]}:${nodeIds[nodeIds.length - 1]}`,
      nodeIds,
      startNodeId: nodeIds[0],
      endNodeId: nodeIds[nodeIds.length - 1],
      startStep: stepById.get(nodeIds[0]) ?? 0,
      endStep: stepById.get(nodeIds[nodeIds.length - 1]) ?? 0,
      length: nodeIds.length,
      markers: sequenceMarkers(nodeIds, nodes, edges, stepById),
      hasScore: nodeIds.some((nodeId) => edges.some((edge) => edge.sourceNodeId === nodeId && edge.scores.length > 0)),
      hasDeferredSafety: nodeIds.some((nodeId) =>
        edges.some((edge) => edge.sourceNodeId === nodeId && edge.kind === 'deferred_safety'),
      ),
      expandedByDefault: false,
    };
    sequences.push(sequence);
    nodeIds.forEach((nodeId) => assigned.add(nodeId));
  }
  return sequences;
}

function uniquePredecessors(nodeId: string, incoming: Map<string, FlowTopologyEdge[]>) {
  return [...new Set((incoming.get(nodeId) ?? []).map((edge) => edge.sourceNodeId))];
}

function sequenceMarkers(
  nodeIds: string[],
  nodes: FlowNode[],
  edges: FlowTopologyEdge[],
  stepById: Map<string, number>,
) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const markers: FlowTopologySequenceMarker[] = [];
  for (const nodeId of nodeIds) {
    const node = nodeMap.get(nodeId)!;
    const nodeEdges = edges.filter((edge) => edge.sourceNodeId === nodeId);
    if (nodeEdges.some((edge) => edge.scores.length > 0))
      markers.push({ nodeId, stepNumber: stepById.get(nodeId) ?? 0, kind: 'score' });
    if (nodeEdges.some((edge) => edge.kind === 'deferred_safety'))
      markers.push({ nodeId, stepNumber: stepById.get(nodeId) ?? 0, kind: 'deferred_safety' });
    if (node.videos && node.videos.length > 0)
      markers.push({ nodeId, stepNumber: stepById.get(nodeId) ?? 0, kind: 'video' });
  }
  return markers;
}
