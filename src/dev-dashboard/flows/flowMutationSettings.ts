import type { GuidedFlow } from '../../domain/flow-engine/types';

/** Repoints the flow entry while preserving the rest of the entry configuration. */
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
  /** Empty string clears the transition message; undefined preserves it. */
  transitionMessage?: string;
}

/** Applies a partial presentation-settings patch without mutating the source flow. */
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
 * Swaps a node with its neighbor in effective step order. A first move without
 * explicit order materializes `nodeOrder`; boundary moves preserve references.
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

function requireNode(flow: GuidedFlow, nodeId: string) {
  const node = flow.nodes[nodeId];
  if (!node) throw new Error(`No such node: ${nodeId}`);
  return node;
}
