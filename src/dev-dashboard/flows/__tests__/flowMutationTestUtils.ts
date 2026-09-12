import type { GuidedFlow } from '../../../domain/flow-engine/types';

export function baseFlow(nodes: GuidedFlow['nodes']): GuidedFlow {
  return {
    id: 'f',
    version: '1.0',
    locale: 'pt-BR',
    title: 'F',
    type: 'guided_conversation',
    status: 'draft',
    entry: { nodeId: Object.keys(nodes)[0], enteringPhrases: ['oi'], transitionMessage: '' },
    nodes,
  };
}
