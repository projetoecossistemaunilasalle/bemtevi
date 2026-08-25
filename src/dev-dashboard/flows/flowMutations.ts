import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';

const DEFAULT_SCORE_KEY = 'pontuacao';
const DEFAULT_BRANCH_RANGE = { min: 0, max: 10 };

export interface AddNodeInput {
  kind: FlowNode['kind'];
  /** When provided WITH optionId, that option is repointed to the created node. */
  connectFrom?: { nodeId: string; optionId?: string };
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

/** Smallest n ≥ 1 such that `${base}-copy-${n}` is free in `nodes`. */
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
    return { id, kind: 'choice', text: '', options: [] };
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

/**
 * Returns a new flow plus the generated node id.
 * Pure: never mutates inputs. An origin option is repointed only when
 * `connectFrom.optionId` is explicitly provided and found (`linked` reports it).
 */
export function addNode(
  flow: GuidedFlow,
  input: AddNodeInput,
): { flow: GuidedFlow; nodeId: string; linked: boolean } {
  const nodeId = uniqueNodeId(flow);
  let nodes: Record<string, FlowNode> = { ...flow.nodes, [nodeId]: createDefaultNode(nodeId, input.kind) };
  let linked = false;

  if (input.connectFrom?.optionId) {
    const { nodeId: originId, optionId } = input.connectFrom;
    const origin = nodes[originId];
    // Only choice nodes own options; unknown origins are left untouched.
    if (origin && origin.kind === 'choice') {
      const index = origin.options.findIndex((option) => option.id === optionId);
      if (index >= 0) {
        const linkedOrigin: FlowNode = {
          ...origin,
          options: origin.options.map((option, i) => (i === index ? { ...option, next: nodeId } : option)),
        };
        nodes = { ...nodes, [origin.id]: linkedOrigin };
        linked = true;
      }
    }
  }

  const next: GuidedFlow = { ...flow, nodes };
  return {
    flow: next.nodeOrder ? { ...next, nodeOrder: [...next.nodeOrder, nodeId] } : next,
    nodeId,
    linked,
  };
}

/** Deep-copies a node's content, renaming option/branch ids with the same `-copy-N` suffix. */
function deepCopyNode(source: FlowNode, newId: string, suffix: number): FlowNode {
  const videos = source.videos?.map((video) => ({ ...video }));
  if (source.kind === 'choice') {
    return {
      ...source,
      id: newId,
      ...(videos ? { videos } : {}),
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
      branches: source.branches.map((branch) => ({ ...branch, id: `${branch.id}-copy-${suffix}` })),
    };
  }
  return {
    ...source,
    id: newId,
    ...(videos ? { videos } : {}),
    ...(source.recommendations ? { recommendations: [...source.recommendations] } : {}),
  };
}

/**
 * Returns a new flow plus the copy's id (`${nodeId}-copy-N`, first free N).
 * Pure: never mutates inputs. Content is deep-copied with fresh option/branch
 * ids sharing the node's N; no existing edge is repointed, so nothing
 * references the copy.
 */
export function duplicateNode(flow: GuidedFlow, nodeId: string): { flow: GuidedFlow; newNodeId: string } {
  const source = requireNode(flow, nodeId);
  const suffix = copySuffixIndex(flow.nodes, nodeId);
  const newNodeId = `${nodeId}-copy-${suffix}`;
  const nodes: GuidedFlow['nodes'] = { ...flow.nodes, [newNodeId]: deepCopyNode(source, newNodeId, suffix) };

  // Insert immediately after the original; append when nodeOrder lacks it.
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

/**
 * Removes a node from the graph WITHOUT cleaning up inbound references: they
 * stay pointing at the removed id (the map renders `Destino ausente` nodes and
 * validation flags them), and every one is reported in `broken` instead.
 * Removing the LAST remaining node is refused with `error: 'last-node'`.
 * Deleting the entry node is permitted; validation handles it.
 */
export function deleteNode(
  flow: GuidedFlow,
  nodeId: string,
): { flow: GuidedFlow; broken: BrokenLink[]; error?: 'last-node' } {
  requireNode(flow, nodeId);
  if (Object.keys(flow.nodes).length === 1) {
    return { flow, broken: [], error: 'last-node' };
  }

  const broken: BrokenLink[] = [];
  for (const node of Object.values(flow.nodes)) {
    if (node.id === nodeId) continue; // self-references vanish with the node; only surviving links are reported
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
  if (next.nodeOrder) {
    next = { ...next, nodeOrder: next.nodeOrder.filter((id) => id !== nodeId) };
  }
  return { flow: next, broken };
}

export interface SwitchKindInput {
  kind: FlowNode['kind'];
}

/**
 * Rebuilds `nodeId` as `input.kind`, keeping its text and media: the node id,
 * record key, text, and a deep copy of `videos` survive while everything else
 * (options, branches, scoreKey…) is replaced by kind defaults — a fresh choice
 * gains one empty `${id}-option-1`; a fresh score_branch gains
 * `DEFAULT_SCORE_KEY` plus a single default range. Inbound references still
 * point at the same id and nodeOrder keeps its position; the changed content
 * shape is expected and validated downstream. A same-kind request is a no-op
 * returning the current references. Pure: never mutates inputs.
 *
 * (`keepText` was dropped from the planned API: text is ALWAYS preserved, so
 * the flag had nothing to toggle.)
 */
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
      ...(current.videos ? { videos: current.videos.map((video) => ({ ...video })) } : {}),
      options: [{ id: `${nodeId}-option-1`, label: '', next: '' }],
    };
  } else if (input.kind === 'score_branch') {
    node = {
      id: nodeId,
      kind: 'score_branch',
      text: current.text,
      ...(current.videos ? { videos: current.videos.map((video) => ({ ...video })) } : {}),
      scoreKey: DEFAULT_SCORE_KEY,
      branches: [{ id: `${nodeId}-faixa-1`, ...DEFAULT_BRANCH_RANGE, next: '' }],
    };
  } else {
    node = {
      id: nodeId,
      kind: 'result',
      text: current.text,
      ...(current.videos ? { videos: current.videos.map((video) => ({ ...video })) } : {}),
    };
  }

  return { flow: { ...flow, nodes: { ...flow.nodes, [nodeId]: node } }, node };
}

/**
 * Repoints the flow's entry to `nodeId`.
 * Pure: never mutates inputs; only `entry.nodeId` changes — entering phrases
 * and transition message are carried over untouched.
 * Throws when the node does not exist (`requireNode`).
 */
export function setEntryNode(flow: GuidedFlow, nodeId: string): GuidedFlow {
  requireNode(flow, nodeId);
  return { ...flow, entry: { ...flow.entry, nodeId } };
}

export interface FlowSettingsPatch {
  title?: string;
  /** Mirrors `GuidedFlow['purpose']`. */
  purpose?: GuidedFlow['purpose'];
  status?: GuidedFlow['status'];
  /** Replaces the whole list; empty is allowed (validation flags it later). */
  enteringPhrases?: string[];
}

/**
 * Applies a partial patch to the flow's presentation settings.
 * Pure: never mutates inputs. Keys left out keep their current value; passing
 * `purpose: undefined` also keeps it — purpose cannot be cleared via patch.
 * `enteringPhrases` replaces the whole list and is copied defensively. A
 * no-op patch returns a structurally NEW but equivalent flow — never the same
 * reference (pinned by test).
 */
export function updateFlowSettings(flow: GuidedFlow, patch: FlowSettingsPatch): GuidedFlow {
  const next: GuidedFlow = { ...flow };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.purpose !== undefined) next.purpose = patch.purpose;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.enteringPhrases !== undefined) {
    next.entry = { ...flow.entry, enteringPhrases: [...patch.enteringPhrases] };
  }
  return next;
}
