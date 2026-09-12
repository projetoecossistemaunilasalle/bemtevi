import { MarkerType } from '@xyflow/react';

import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import type { MapFocusRequest, MapFocusSection } from './flowDisplay';
import {
  destinationId,
  destinationNodeKindLabel,
  type DestinationAnalysis,
  type DestinationAnalysisNode,
  type DestinationNodeData,
  type DestinationRFEdge,
  type DestinationRFNode,
  type DestinationSequenceGroup,
  type DestinationTransition,
} from './flowDestinationModels';
import {
  buildOptionTargetLabels,
  calculateUnreachableDepths,
  DESTINATION_COLUMN_STEP,
  estimateDestinationNodeHeight,
  positionDestinationNodes,
  routeDestinationNodes,
  type DestinationNodeLayout,
} from './flowDestinationLayout';
import type { ConnectionSource, TerminalDestination } from './flowMutations';

function edgeStyle(kind: DestinationTransition['kind']) {
  if (kind === 'flow_start') return { stroke: 'var(--color-secondary)', strokeDasharray: '7 5' };
  if (kind === 'navigate') return { stroke: 'var(--color-secondary)' };
  if (kind === 'safety_interrupt') return { stroke: 'var(--color-error)', strokeDasharray: '5 3' };
  if (kind === 'deferred_safety') return { stroke: 'var(--color-warning)', strokeDasharray: '4 4' };
  if (kind === 'missing') return { stroke: 'var(--color-error)', strokeDasharray: '3 3' };
  if (kind === 'score_branch') return { stroke: 'var(--color-warning)' };
  return { stroke: 'var(--color-outline-variant)' };
}

export function createDestinationPresentation(
  analysis: DestinationAnalysis,
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
  const sequenceByNode = new Map<string, DestinationSequenceGroup>();
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
  const matches = (node: DestinationAnalysisNode) =>
    !query ||
    node.id.toLocaleLowerCase('pt-BR').includes(query) ||
    node.node?.text.toLocaleLowerCase('pt-BR').includes(query) ||
    String(node.order + 1).includes(query);
  const resultDepth = Math.max(displayDepth(analysis.maxDepth) + 1, 1);
  const nodes: DestinationRFNode[] = [];
  const layout = new Map<string, DestinationNodeLayout>();
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
      position: { x: depth * DESTINATION_COLUMN_STEP, y: 0 },
      data,
      draggable: false,
      selectable: kind !== 'destination' && kind !== 'missing',
      ariaLabel:
        kind === 'destination' || kind === 'missing'
          ? data.destination?.label
          : `${destinationNodeKindLabel(kind)} ${data.node?.id ?? id}`,
    } as DestinationRFNode);
    layout.set(id, { depth, order, height: estimateDestinationNodeHeight(kind, data), isUnreachable });
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
    const optionTargets = buildOptionTargetLabels(analysis, node.id, nodeById, sequenceByNode, showLabels);
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
    const unreachableDepth = calculateUnreachableDepths(unreachableNodes, analysis.transitions);
    for (const node of unreachableNodes) {
      if (!node.node) continue;
      const depth = unreachableDepth.get(node.id) ?? 0;
      const optionTargets = buildOptionTargetLabels(analysis, node.id, nodeById, sequenceByNode, showLabels, false);
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

  positionDestinationNodes(nodes, layout);

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
  const { routedNodes, visibleTransitions, routingGroups } = routeDestinationNodes(
    nodes,
    analysis.transitions,
    groupedTarget,
  );
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
