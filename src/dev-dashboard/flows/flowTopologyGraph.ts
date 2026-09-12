import type { FlowNode } from '../../domain/flow-engine/types';
import type {
  FlowTopologyCycle,
  FlowTopologyDestination,
  FlowTopologyEdge,
  FlowTopologySequence,
  FlowTopologySequenceMarker,
  FlowTopologyTransitionKind,
} from './flowTopologyTypes';

export function buildLocalTargets(nodeIds: string[], edges: FlowTopologyEdge[]) {
  const targets = new Map<string, Set<string>>(nodeIds.map((id) => [id, new Set<string>()]));
  for (const edge of edges) {
    if (edge.targetNodeId && targets.has(edge.sourceNodeId)) targets.get(edge.sourceNodeId)!.add(edge.targetNodeId);
  }
  return targets;
}

export function buildIncomingEdges(nodeIds: string[], edges: FlowTopologyEdge[]) {
  const incoming = new Map<string, FlowTopologyEdge[]>(nodeIds.map((id) => [id, []]));
  for (const edge of edges) {
    if (edge.targetNodeId && incoming.has(edge.targetNodeId)) incoming.get(edge.targetNodeId)!.push(edge);
  }
  return incoming;
}

export function stronglyConnectedComponents(
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

export function calculateComponentDepths(
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

export function calculateTerminalDestinationIds(
  nodes: FlowNode[],
  edges: FlowTopologyEdge[],
  nodeMap: Map<string, FlowNode>,
  destinations: Map<string, FlowTopologyDestination>,
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

export function findLinearSequences(
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
