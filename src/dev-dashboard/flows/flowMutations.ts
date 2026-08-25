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
