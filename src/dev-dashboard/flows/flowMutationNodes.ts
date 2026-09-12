import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import { connectSource, type AddNodeConnectFrom } from './flowMutationConnections';

const DEFAULT_SCORE_KEY = 'pontuacao';
const DEFAULT_BRANCH_RANGE = { min: 0, max: 10 };

export interface AddNodeInput {
  kind: FlowNode['kind'];
  /** When provided, the origin option/branch/freeText is repointed to the created node. */
  connectFrom?: AddNodeConnectFrom;
}

/** First free id following the `step-N` convention, counting up from the node total. */
function uniqueNodeId(flow: GuidedFlow): string {
  let index = Object.keys(flow.nodes).length + 1;
  let candidate = `step-${index}`;
  while (flow.nodes[candidate]) {
    index += 1;
    candidate = `step-${index}`;
  }
  return candidate;
}

function copySuffixIndex(nodes: GuidedFlow['nodes'], base: string): number {
  let index = 1;
  while (nodes[`${base}-copy-${index}`]) {
    index += 1;
  }
  return index;
}

function requireNode(flow: GuidedFlow, nodeId: string): FlowNode {
  const node = flow.nodes[nodeId];
  if (!node) throw new Error(`No such node: ${nodeId}`);
  return node;
}

function createDefaultNode(id: string, kind: FlowNode['kind']): FlowNode {
  if (kind === 'choice') {
    return {
      id,
      kind: 'choice',
      text: '',
      options: [{ id: `${id}-option-1`, label: '', next: '' }],
    };
  }
  if (kind === 'score_branch') {
    return {
      id,
      kind: 'score_branch',
      text: '',
      scoreKey: DEFAULT_SCORE_KEY,
      branches: [{ id: `${id}-faixa-1`, ...DEFAULT_BRANCH_RANGE, next: '' }],
    };
  }
  return { id, kind: 'result', text: '' };
}

/** Adds a default node and optionally links an existing source to it. */
export function addNode(flow: GuidedFlow, input: AddNodeInput): { flow: GuidedFlow; nodeId: string; linked: boolean } {
  const nodeId = uniqueNodeId(flow);
  let nextFlow: GuidedFlow = {
    ...flow,
    nodes: { ...flow.nodes, [nodeId]: createDefaultNode(nodeId, input.kind) },
    ...(flow.nodeOrder ? { nodeOrder: [...flow.nodeOrder, nodeId] } : {}),
  };
  let linked = false;

  if (input.connectFrom) {
    if ('kind' in input.connectFrom) {
      const result = connectSource(nextFlow, input.connectFrom, nodeId);
      nextFlow = result.flow;
      linked = result.connected;
    } else if (input.connectFrom.optionId) {
      const result = connectSource(
        nextFlow,
        { kind: 'option', nodeId: input.connectFrom.nodeId, optionId: input.connectFrom.optionId },
        nodeId,
      );
      nextFlow = result.flow;
      linked = result.connected;
    }
  }

  return { flow: nextFlow, nodeId, linked };
}

/** Deep-copies a node's content, renaming option/branch ids with the same `-copy-N` suffix. */
function deepCopyNode(source: FlowNode, newId: string, suffix: number): FlowNode {
  const videos = source.videos?.map((video) => ({ ...video }));
  const visuals = source.visuals?.map((visual) => ({ ...visual }));
  if (source.kind === 'choice') {
    return {
      ...source,
      id: newId,
      ...(videos ? { videos } : {}),
      ...(visuals ? { visuals } : {}),
      options: source.options.map((option) => ({
        ...option,
        id: `${option.id}-copy-${suffix}`,
        ...(option.effects ? { effects: option.effects.map((effect) => ({ ...effect })) } : {}),
      })),
      ...(source.freeText ? { freeText: { ...source.freeText } } : {}),
    };
  }
  if (source.kind === 'score_branch') {
    return {
      ...source,
      id: newId,
      ...(videos ? { videos } : {}),
      ...(visuals ? { visuals } : {}),
      branches: source.branches.map((branch) => ({ ...branch, id: `${branch.id}-copy-${suffix}` })),
    };
  }
  return {
    ...source,
    id: newId,
    ...(videos ? { videos } : {}),
    ...(visuals ? { visuals } : {}),
    ...(source.recommendations ? { recommendations: [...source.recommendations] } : {}),
  };
}

/** Duplicates a node with fresh child ids and inserts it after the original. */
export function duplicateNode(flow: GuidedFlow, nodeId: string): { flow: GuidedFlow; newNodeId: string } {
  const source = requireNode(flow, nodeId);
  const suffix = copySuffixIndex(flow.nodes, nodeId);
  const newNodeId = `${nodeId}-copy-${suffix}`;
  const nodes: GuidedFlow['nodes'] = { ...flow.nodes, [newNodeId]: deepCopyNode(source, newNodeId, suffix) };

  let updatedOrder = flow.nodeOrder;
  if (updatedOrder) {
    const order = [...updatedOrder];
    const index = order.indexOf(nodeId);
    order.splice(index < 0 ? order.length : index + 1, 0, newNodeId);
    updatedOrder = order;
  }

  return {
    flow: updatedOrder ? { ...flow, nodes, nodeOrder: updatedOrder } : { ...flow, nodes },
    newNodeId,
  };
}

export interface BrokenLink {
  sourceNodeId: string;
  /** Set when the break is an option target. */
  optionId?: string;
  /** Set when the break is a score-branch target. */
  branchId?: string;
  via: 'option' | 'free-text' | 'branch';
}

/** Removes a node while reporting surviving inbound links that now point at a missing node. */
export function deleteNode(
  flow: GuidedFlow,
  nodeId: string,
): { flow: GuidedFlow; broken: BrokenLink[]; error?: 'last-node' } {
  requireNode(flow, nodeId);
  if (Object.keys(flow.nodes).length === 1) return { flow, broken: [], error: 'last-node' };

  const broken: BrokenLink[] = [];
  for (const node of Object.values(flow.nodes)) {
    if (node.id === nodeId) continue;
    if (node.kind === 'choice') {
      for (const option of node.options) {
        if (option.next === nodeId) broken.push({ sourceNodeId: node.id, optionId: option.id, via: 'option' });
      }
      if (node.freeText?.next === nodeId) broken.push({ sourceNodeId: node.id, via: 'free-text' });
    }
    if (node.kind === 'score_branch') {
      for (const branch of node.branches) {
        if (branch.next === nodeId) broken.push({ sourceNodeId: node.id, branchId: branch.id, via: 'branch' });
      }
    }
  }

  const nodes: GuidedFlow['nodes'] = { ...flow.nodes };
  delete nodes[nodeId];
  let next: GuidedFlow = { ...flow, nodes };
  if (next.nodeOrder) next = { ...next, nodeOrder: next.nodeOrder.filter((id) => id !== nodeId) };
  return { flow: next, broken };
}

export interface SwitchKindInput {
  kind: FlowNode['kind'];
}

/** Rebuilds a node as another kind while preserving its id, text, exercise, and media. */
export function switchNodeKind(
  flow: GuidedFlow,
  nodeId: string,
  input: SwitchKindInput,
): { flow: GuidedFlow; node: FlowNode } {
  const current = requireNode(flow, nodeId);
  if (current.kind === input.kind) return { flow, node: current };

  let node: FlowNode;
  if (input.kind === 'choice') {
    node = {
      id: nodeId,
      kind: 'choice',
      text: current.text,
      ...(current.exercise ? { exercise: current.exercise } : {}),
      ...(current.videos ? { videos: current.videos.map((video) => ({ ...video })) } : {}),
      ...(current.visuals ? { visuals: current.visuals.map((visual) => ({ ...visual })) } : {}),
      options: [{ id: `${nodeId}-option-1`, label: '', next: '' }],
    };
  } else if (input.kind === 'score_branch') {
    node = {
      id: nodeId,
      kind: 'score_branch',
      text: current.text,
      ...(current.exercise ? { exercise: current.exercise } : {}),
      ...(current.videos ? { videos: current.videos.map((video) => ({ ...video })) } : {}),
      ...(current.visuals ? { visuals: current.visuals.map((visual) => ({ ...visual })) } : {}),
      scoreKey: DEFAULT_SCORE_KEY,
      branches: [{ id: `${nodeId}-faixa-1`, ...DEFAULT_BRANCH_RANGE, next: '' }],
    };
  } else {
    node = {
      id: nodeId,
      kind: 'result',
      text: current.text,
      ...(current.exercise ? { exercise: current.exercise } : {}),
      ...(current.videos ? { videos: current.videos.map((video) => ({ ...video })) } : {}),
      ...(current.visuals ? { visuals: current.visuals.map((visual) => ({ ...visual })) } : {}),
    };
  }

  return { flow: { ...flow, nodes: { ...flow.nodes, [nodeId]: node } }, node };
}
