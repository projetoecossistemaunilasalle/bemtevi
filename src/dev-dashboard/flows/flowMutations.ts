import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';

export interface AddNodeInput {
  kind: FlowNode['kind'];
  /** When provided, the option is repointed to the created node. */
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
      scoreKey: 'pontuacao',
      branches: [{ id: `${id}-faixa-1`, min: 0, max: 10, next: '' }],
    };
  }
  return { id, kind: 'result', text: '' };
}

/** Returns a new flow plus the generated node id. Pure: never mutates inputs. */
export function addNode(flow: GuidedFlow, input: AddNodeInput): { flow: GuidedFlow; nodeId: string } {
  const nodeId = uniqueNodeId(flow);
  let nodes: Record<string, FlowNode> = { ...flow.nodes, [nodeId]: createDefaultNode(nodeId, input.kind) };

  if (input.connectFrom) {
    const origin = nodes[input.connectFrom.nodeId];
    // Only choice nodes own options; unknown origins are left untouched.
    if (origin && origin.kind === 'choice') {
      const index = input.connectFrom.optionId
        ? origin.options.findIndex((option) => option.id === input.connectFrom?.optionId)
        : 0;
      if (index >= 0) {
        const linkedOrigin: FlowNode = {
          ...origin,
          options: origin.options.map((option, i) => (i === index ? { ...option, next: nodeId } : option)),
        };
        nodes = { ...nodes, [origin.id]: linkedOrigin };
      }
    }
  }

  const next: GuidedFlow = { ...flow, nodes };
  return {
    flow: next.nodeOrder ? { ...next, nodeOrder: [...next.nodeOrder, nodeId] } : next,
    nodeId,
  };
}
