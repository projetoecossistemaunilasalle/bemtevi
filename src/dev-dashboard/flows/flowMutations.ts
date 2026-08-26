import type { FlowEffect, FlowNode, GuidedFlow } from '../../domain/flow-engine/types';

const DEFAULT_SCORE_KEY = 'pontuacao';
const DEFAULT_BRANCH_RANGE = { min: 0, max: 10 };

export type ConnectionSource =
  | { kind: 'option'; nodeId: string; optionId: string }
  | { kind: 'free_text'; nodeId: string }
  | { kind: 'branch'; nodeId: string; branchId: string };

export type AddNodeConnectFrom = ConnectionSource | { nodeId: string; optionId?: string };

export interface AddNodeInput {
  kind: FlowNode['kind'];
  /** When provided, the origin option/branch/freeText is repointed to the created node. */
  connectFrom?: AddNodeConnectFrom;
}

export type TerminalDestination =
  | { kind: 'navigate'; destination: '/apoio' | '/contatos' | '/educacao' }
  | { kind: 'flow_start'; flowId: string }
  | { kind: 'end_flow'; message: string };

/**
 * Connects an origin source (option, free_text, or branch) to a local target node.
 * Pure: never mutates inputs. Removes conflicting terminal effects / navigation.
 */
export function connectSource(
  flow: GuidedFlow,
  source: ConnectionSource,
  targetNodeId: string,
): { flow: GuidedFlow; connected: boolean } {
  const origin = flow.nodes[source.nodeId];
  if (!origin) return { flow, connected: false };

  if (source.kind === 'option') {
    if (origin.kind !== 'choice') return { flow, connected: false };
    const optionIndex = origin.options.findIndex((opt) => opt.id === source.optionId);
    if (optionIndex === -1) return { flow, connected: false };

    const currentOpt = origin.options[optionIndex];
    const filteredEffects = currentOpt.effects?.filter(
      (eff) =>
        eff.kind !== 'navigate' &&
        eff.kind !== 'safety_interrupt' &&
        eff.kind !== 'end_flow' &&
        eff.kind !== 'flow_start',
    );

    const updatedOptions = origin.options.map((opt, idx) =>
      idx === optionIndex
        ? {
            ...opt,
            next: targetNodeId,
            ...(filteredEffects && filteredEffects.length > 0 ? { effects: filteredEffects } : { effects: undefined }),
          }
        : opt,
    );

    return {
      flow: {
        ...flow,
        nodes: {
          ...flow.nodes,
          [origin.id]: {
            ...origin,
            options: updatedOptions,
          },
        },
      },
      connected: true,
    };
  }

  if (source.kind === 'free_text') {
    if (origin.kind !== 'choice') return { flow, connected: false };
    return {
      flow: {
        ...flow,
        nodes: {
          ...flow.nodes,
          [origin.id]: {
            ...origin,
            freeText: { ...origin.freeText, next: targetNodeId },
          },
        },
      },
      connected: true,
    };
  }

  if (source.kind === 'branch') {
    if (origin.kind !== 'score_branch') return { flow, connected: false };
    const branchIndex = origin.branches.findIndex((b) => b.id === source.branchId);
    if (branchIndex === -1) return { flow, connected: false };

    const updatedBranches = origin.branches.map((b, idx) => {
      if (idx !== branchIndex) return b;
      const { navigation: _dropped, ...branchWithoutNav } = b;
      return { ...branchWithoutNav, next: targetNodeId };
    });

    return {
      flow: {
        ...flow,
        nodes: {
          ...flow.nodes,
          [origin.id]: {
            ...origin,
            branches: updatedBranches,
          },
        },
      },
      connected: true,
    };
  }

  return { flow, connected: false };
}

/**
 * Applies a terminal effect or navigation to a connection source.
 * Pure: never mutates inputs. Branches support 'navigate'; options support all terminal kinds.
 */
export function applyTerminalEffect(
  flow: GuidedFlow,
  source: ConnectionSource,
  destination: TerminalDestination,
): { flow: GuidedFlow; applied: boolean } {
  const origin = flow.nodes[source.nodeId];
  if (!origin) return { flow, applied: false };

  if (source.kind === 'option') {
    if (origin.kind !== 'choice') return { flow, applied: false };
    const optionIndex = origin.options.findIndex((opt) => opt.id === source.optionId);
    if (optionIndex === -1) return { flow, applied: false };

    const currentOpt = origin.options[optionIndex];
    const retainedEffects =
      currentOpt.effects?.filter(
        (eff) =>
          eff.kind !== 'navigate' &&
          eff.kind !== 'safety_interrupt' &&
          eff.kind !== 'end_flow' &&
          eff.kind !== 'flow_start',
      ) ?? [];

    let newEffect: FlowEffect;
    if (destination.kind === 'navigate') {
      newEffect = { kind: 'navigate', destination: destination.destination };
    } else if (destination.kind === 'flow_start') {
      newEffect = { kind: 'flow_start', flowId: destination.flowId };
    } else {
      newEffect = { kind: 'end_flow', message: destination.message };
    }

    const updatedOptions = origin.options.map((opt, idx) =>
      idx === optionIndex
        ? {
            ...opt,
            effects: [...retainedEffects, newEffect],
          }
        : opt,
    );

    return {
      flow: {
        ...flow,
        nodes: {
          ...flow.nodes,
          [origin.id]: {
            ...origin,
            options: updatedOptions,
          },
        },
      },
      applied: true,
    };
  }

  if (source.kind === 'branch') {
    if (origin.kind !== 'score_branch') return { flow, applied: false };
    if (destination.kind !== 'navigate') return { flow, applied: false };

    const branchIndex = origin.branches.findIndex((b) => b.id === source.branchId);
    if (branchIndex === -1) return { flow, applied: false };

    const updatedBranches = origin.branches.map((b, idx) =>
      idx === branchIndex ? { ...b, navigation: destination.destination } : b,
    );

    return {
      flow: {
        ...flow,
        nodes: {
          ...flow.nodes,
          [origin.id]: {
            ...origin,
            branches: updatedBranches,
          },
        },
      },
      applied: true,
    };
  }

  return { flow, applied: false };
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

/** First free `${node.id}-option-N`, matching switchNodeKind's naming convention. */
export function uniqueOptionId(node: { id: string; options: Array<{ id: string }> }): string {
  let index = node.options.length + 1;
  let candidate = `${node.id}-option-${index}`;
  while (node.options.some((option) => option.id === candidate)) {
    index += 1;
    candidate = `${node.id}-option-${index}`;
  }
  return candidate;
}

/** First free `${node.id}-faixa-N` within the branch list, same convention as switchNodeKind. */
export function uniqueBranchId(node: { id: string; branches: Array<{ id: string }> }): string {
  let index = node.branches.length + 1;
  let candidate = `${node.id}-faixa-${index}`;
  while (node.branches.some((branch) => branch.id === candidate)) {
    index += 1;
    candidate = `${node.id}-faixa-${index}`;
  }
  return candidate;
}

/**
 * Appends an option to a choice node.
 * Pure: never mutates inputs.
 */
export function addOption(
  flow: GuidedFlow,
  nodeId: string,
  initial?: Partial<{ id: string; label: string; next: string; effects?: FlowEffect[] }>,
): { flow: GuidedFlow; optionId: string } {
  const node = flow.nodes[nodeId];
  if (!node || node.kind !== 'choice') return { flow, optionId: '' };

  const optionId = initial?.id || uniqueOptionId(node);
  const label = initial?.label !== undefined ? initial.label : '';
  const newOption: { id: string; label: string; next: string; effects?: FlowEffect[] } = {
    id: optionId,
    label,
    next: initial?.next ?? '',
    ...(initial?.effects ? { effects: initial.effects } : {}),
  };

  return {
    flow: {
      ...flow,
      nodes: {
        ...flow.nodes,
        [nodeId]: {
          ...node,
          options: [...node.options, newOption],
        },
      },
    },
    optionId,
  };
}

/**
 * Appends a score range branch to a score_branch node.
 * Pure: never mutates inputs.
 */
export function addBranch(
  flow: GuidedFlow,
  nodeId: string,
  initial?: Partial<{
    id: string;
    min: number;
    max: number;
    next: string;
    navigation?: '/apoio' | '/contatos' | '/educacao';
  }>,
): { flow: GuidedFlow; branchId: string } {
  const node = flow.nodes[nodeId];
  if (!node || node.kind !== 'score_branch') return { flow, branchId: '' };

  const branchId = initial?.id || uniqueBranchId(node);
  const lastBranch = node.branches[node.branches.length - 1];
  const min = initial?.min ?? (lastBranch ? lastBranch.max + 1 : 0);
  const max = initial?.max ?? min + 5;
  const newBranch = {
    id: branchId,
    min,
    max,
    next: initial?.next ?? '',
    ...(initial?.navigation ? { navigation: initial.navigation } : {}),
  };

  return {
    flow: {
      ...flow,
      nodes: {
        ...flow.nodes,
        [nodeId]: {
          ...node,
          branches: [...node.branches, newBranch],
        },
      },
    },
    branchId,
  };
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

/**
 * Returns a new flow plus the generated node id.
 * Pure: never mutates inputs. When `connectFrom` is provided, the origin option/branch/freeText
 * is linked to the newly created node.
 */
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
      const res = connectSource(nextFlow, input.connectFrom, nodeId);
      nextFlow = res.flow;
      linked = res.connected;
    } else if (input.connectFrom.optionId) {
      const res = connectSource(
        nextFlow,
        { kind: 'option', nodeId: input.connectFrom.nodeId, optionId: input.connectFrom.optionId },
        nodeId,
      );
      nextFlow = res.flow;
      linked = res.connected;
    }
  }

  return {
    flow: nextFlow,
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
  /**
   * Chat message shown right before the first stage. Empty string is allowed
   * and means "no transition message" — only `undefined` keeps the current one.
   */
  transitionMessage?: string;
}

/**
 * Applies a partial patch to the flow's presentation settings.
 * Pure: never mutates inputs. Keys left out keep their current value; passing
 * `purpose: undefined` also keeps it — purpose cannot be cleared via patch.
 * `enteringPhrases` replaces the whole list and is copied defensively.
 * `transitionMessage` rewrites only that entry field, carrying phrases (and
 * everything else in `entry`) over untouched; both entry keys compose when a
 * single patch carries them together. A no-op patch returns a structurally
 * NEW but equivalent flow — never the same reference (pinned by test).
 */
export function updateFlowSettings(flow: GuidedFlow, patch: FlowSettingsPatch): GuidedFlow {
  const next: GuidedFlow = { ...flow };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.purpose !== undefined) next.purpose = patch.purpose;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.enteringPhrases !== undefined) {
    next.entry = { ...flow.entry, enteringPhrases: [...patch.enteringPhrases] };
  }
  if (patch.transitionMessage !== undefined) {
    next.entry = { ...next.entry, transitionMessage: patch.transitionMessage };
  }
  return next;
}

export type MoveDirection = 'up' | 'down';

/**
 * Swaps `nodeId` with its neighbor in the flow's EFFECTIVE step order:
 * `nodeOrder` when present, otherwise the `nodes` record's insertion order.
 * Moving within an explicit order swaps two entries in place. When no order
 * exists yet, the FIRST move materializes `nodeOrder` from the current
 * insertion order with the swap applied (record key order stays irrelevant —
 * domain consumers read `nodeOrder` once it exists). A node already at the
 * target bound — or missing from an explicit order (defensive; panel flows
 * always keep `nodeOrder` in sync) — is unmovable: `moved: false` returns the
 * ORIGINAL references untouched, so callers emit no patch. Unknown nodes
 * throw via `requireNode`. Pure: never mutates inputs.
 */
export function moveNode(
  flow: GuidedFlow,
  nodeId: string,
  direction: MoveDirection,
): { flow: GuidedFlow; moved: boolean } {
  requireNode(flow, nodeId);
  const effectiveOrder = flow.nodeOrder ?? Object.keys(flow.nodes);
  const index = effectiveOrder.indexOf(nodeId);
  if (index === -1) return { flow, moved: false };
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= effectiveOrder.length) return { flow, moved: false };

  const order = [...effectiveOrder];
  [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
  return { flow: { ...flow, nodeOrder: order }, moved: true };
}
