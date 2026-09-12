import type {
  Destination,
  DestinationAnalysis,
  DestinationAnalysisNode,
  DestinationNodeData,
  DestinationRFNode,
  DestinationSequenceGroup,
  DestinationTransition,
} from './flowDestinationModels';

export const NODE_WIDTH = 284;
export const DESTINATION_COLUMN_STEP = NODE_WIDTH + 190;
const ROW_GAP = 64;

export interface DestinationNodeLayout {
  depth: number;
  order: number;
  height: number;
  isUnreachable?: boolean;
}

export interface VisibleDestinationTransition {
  transition: DestinationTransition;
  transitionIndex: number;
  source: string;
  target: string;
  sourceNode: DestinationRFNode;
  targetNode: DestinationRFNode;
}

export function estimateDestinationNodeHeight(kind: DestinationNodeData['kind'], data: DestinationNodeData) {
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
  const addButtonHeight = data.node.kind === 'choice' || data.node.kind === 'score_branch' ? 38 : 0;
  const textLines = data.node.text ? Math.min(3, Math.ceil(data.node.text.length / 32)) : 1;
  return 56 + 22 + textLines * 17 + outputs * 52 + addButtonHeight + (safety ? 36 : 0);
}

export function calculateUnreachableDepths(nodes: DestinationAnalysisNode[], transitions: DestinationTransition[]) {
  const unreachableIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  nodes.forEach((node) => {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  });
  transitions.forEach((transition) => {
    if (unreachableIds.has(transition.source) && unreachableIds.has(transition.target)) {
      adjacency.get(transition.source)?.push(transition.target);
      inDegree.set(transition.target, (inDegree.get(transition.target) ?? 0) + 1);
    }
  });

  const depths = new Map<string, number>();
  const queue: string[] = [];
  nodes.forEach((node) => {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      depths.set(node.id, 0);
      queue.push(node.id);
    }
  });
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depths.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (!depths.has(next)) {
        depths.set(next, currentDepth + 1);
        queue.push(next);
      }
    }
  }
  nodes.forEach((node) => {
    if (!depths.has(node.id)) depths.set(node.id, 0);
  });
  return depths;
}

export function buildOptionTargetLabels(
  analysis: DestinationAnalysis,
  nodeId: string,
  nodeById: Map<string, DestinationAnalysisNode>,
  sequenceByNode: Map<string, DestinationSequenceGroup>,
  showLabels: boolean,
  showSequenceRanges = true,
) {
  const labels: Record<string, string> = {};
  if (!showLabels) return labels;
  for (const transition of analysis.transitions) {
    if (transition.source !== nodeId || transition.kind === 'deferred_safety') continue;
    const targetNode = nodeById.get(transition.target);
    const targetDestination = analysis.destinations.find((destination) => destination.id === transition.target);
    const targetSequence = showSequenceRanges ? sequenceByNode.get(transition.target) : undefined;
    labels[transition.sourceHandle.replace(/(:deferred|__deferred-safety)$/, '')] = targetSequence
      ? sequenceTargetLabel(targetSequence, nodeById)
      : targetNode
        ? `Vai para etapa ${targetNode.order + 1}`
        : destinationTargetLabel(targetDestination, showSequenceRanges);
  }
  return labels;
}

export function positionDestinationNodes(nodes: DestinationRFNode[], layout: Map<string, DestinationNodeLayout>) {
  const reachableNodes = nodes.filter((node) => !layout.get(node.id)?.isUnreachable);
  const unreachableNodes = nodes.filter((node) => layout.get(node.id)?.isUnreachable);
  const reachableColumns = groupByDepth(reachableNodes, layout);
  const reachableColumnHeights = [...reachableColumns.values()].map((column) => columnHeight(column, layout));
  const tallestReachableColumn = Math.max(0, ...reachableColumnHeights);

  for (const [depth, column] of reachableColumns) {
    column.sort((left, right) => (layout.get(left.id)?.order ?? 0) - (layout.get(right.id)?.order ?? 0));
    let y = Math.max(0, (tallestReachableColumn - columnHeight(column, layout)) / 2);
    column.forEach((node) => {
      node.position = { x: depth * DESTINATION_COLUMN_STEP, y };
      y += (layout.get(node.id)?.height ?? 100) + ROW_GAP;
    });
  }

  if (unreachableNodes.length === 0) return;
  const unreachableColumns = groupByDepth(unreachableNodes, layout);
  const unreachableStartY = Math.max(tallestReachableColumn + 120, 260);
  for (const [depth, column] of unreachableColumns) {
    column.sort((left, right) => (layout.get(left.id)?.order ?? 0) - (layout.get(right.id)?.order ?? 0));
    let y = unreachableStartY;
    column.forEach((node) => {
      node.position = { x: depth * DESTINATION_COLUMN_STEP, y };
      y += (layout.get(node.id)?.height ?? 100) + ROW_GAP;
    });
  }
}

export function routeDestinationNodes(
  nodes: DestinationRFNode[],
  transitions: DestinationTransition[],
  resolveTarget: (id: string) => string,
) {
  const visibleTransitions: VisibleDestinationTransition[] = transitions.flatMap((transition, transitionIndex) => {
    const source = resolveTarget(transition.source);
    const target = resolveTarget(transition.target);
    if (source === target) return [];
    const sourceNode = nodes.find((node) => node.id === source);
    const targetNode = nodes.find((node) => node.id === target);
    return sourceNode && targetNode ? [{ transition, transitionIndex, source, target, sourceNode, targetNode }] : [];
  });
  const routingGroups = new Map<string, VisibleDestinationTransition[]>();
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
  const incomingByTarget = new Map<string, VisibleDestinationTransition[]>();
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
  return { routedNodes, visibleTransitions, routingGroups };
}

function groupByDepth(nodes: DestinationRFNode[], layout: Map<string, DestinationNodeLayout>) {
  const columns = new Map<number, DestinationRFNode[]>();
  for (const node of nodes) {
    const depth = layout.get(node.id)?.depth ?? 0;
    const column = columns.get(depth) ?? [];
    column.push(node);
    columns.set(depth, column);
  }
  return columns;
}

function columnHeight(nodes: DestinationRFNode[], layout: Map<string, DestinationNodeLayout>) {
  return nodes.reduce(
    (height, node, index) => height + (layout.get(node.id)?.height ?? 100) + (index ? ROW_GAP : 0),
    0,
  );
}

function sequenceTargetLabel(sequence: DestinationSequenceGroup, nodeById: Map<string, DestinationAnalysisNode>) {
  const steps = sequence.nodeIds
    .map((id) => (nodeById.get(id)?.order ?? 0) + 1)
    .filter((_step, index, allSteps) => index === 0 || index === allSteps.length - 1);
  return `Vai para etapas ${steps.join('–')}`;
}

function destinationTargetLabel(destination: Destination | undefined, useFlowOpenLabel: boolean) {
  if (!destination) return 'Destino não encontrado';
  return useFlowOpenLabel && destination.kind === 'flow_start'
    ? `Abre ${destination.label.replace(/^Fluxo · /, '')}`
    : `Vai para ${destination.label}`;
}
