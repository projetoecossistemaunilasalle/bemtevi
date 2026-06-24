import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { FlowEffect, GuidedFlow, FlowNode } from '../../domain/flow-engine/types';

export type FlowNodeData = {
  node: FlowNode;
  kind: FlowNode['kind'];
  label: string;
};

export type FlowEdgeData = {
  effectKind: 'normal' | 'score' | 'deferred_safety' | 'safety_interrupt' | 'flow_start' | 'score_branch';
  optionLabel?: string;
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

export function buildFlowGraph(flow: GuidedFlow): {
  nodes: Node<FlowNodeData>[];
  edges: Edge<FlowEdgeData>[];
} {
  const flowNodes = Object.values(flow.nodes);
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });

  for (const node of flowNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const rawEdges: Array<{ source: string; target: string; data: FlowEdgeData; id: string }> = [];

  for (const node of flowNodes) {
    if (node.kind === 'choice') {
      for (const option of node.options) {
        const effectKind = getOptionEdgeKind(option.effects);
        const edgeId = `${node.id}__${option.id}__${option.next}`;
        g.setEdge(node.id, option.next);
        rawEdges.push({
          id: edgeId,
          source: node.id,
          target: option.next,
          data: { effectKind, optionLabel: option.label },
        });
      }
    } else if (node.kind === 'score_branch') {
      for (const branch of node.branches) {
        const edgeId = `${node.id}__branch__${branch.id}__${branch.next}`;
        g.setEdge(node.id, branch.next);
        rawEdges.push({
          id: edgeId,
          source: node.id,
          target: branch.next,
          data: { effectKind: 'score_branch', optionLabel: `${branch.min}–${branch.max}` },
        });
      }
    }
  }

  dagre.layout(g);

  const rfNodes: Node<FlowNodeData>[] = flowNodes.map((node) => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      type: node.kind === 'choice' ? 'choiceNode' : node.kind === 'score_branch' ? 'scoreBranchNode' : 'resultNode',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: { node, kind: node.kind, label: node.text },
    };
  });

  const rfEdges: Edge<FlowEdgeData>[] = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    data: e.data,
    style: edgeStyle(e.data.effectKind),
    animated: e.data.effectKind !== 'normal' && e.data.effectKind !== 'score',
    label: e.data.effectKind === 'score_branch' ? e.data.optionLabel : undefined,
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

function getOptionEdgeKind(effects: FlowEffect[] | undefined): FlowEdgeData['effectKind'] {
  if (!effects || effects.length === 0) return 'normal';
  if (effects.some((e) => e.kind === 'safety_interrupt')) return 'safety_interrupt';
  if (effects.some((e) => e.kind === 'deferred_safety')) return 'deferred_safety';
  if (effects.some((e) => e.kind === 'flow_start')) return 'flow_start';
  if (effects.some((e) => e.kind === 'score')) return 'score';
  return 'normal';
}

function edgeStyle(kind: FlowEdgeData['effectKind']): { stroke: string; strokeDasharray?: string } {
  switch (kind) {
    case 'safety_interrupt':
      return { stroke: '#ba1a1a', strokeDasharray: '5 3' };
    case 'deferred_safety':
      return { stroke: '#7a5900', strokeDasharray: '5 3' };
    case 'flow_start':
      return { stroke: '#425e91', strokeDasharray: '5 3' };
    case 'score_branch':
      return { stroke: '#7a5900' };
    default:
      return { stroke: '#bdcabf' };
  }
}
