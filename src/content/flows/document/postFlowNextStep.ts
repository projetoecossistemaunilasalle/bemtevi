import type { GuidedFlow } from '../../../domain/flow-engine/types';

export const postFlowNextStepFlow = {
  id: 'post-flow-next-step',
  version: '2.0.0',
  locale: 'pt-BR',
  title: 'Escolher o que fazer agora',
  type: 'guided_conversation',
  purpose: 'post_flow_routing',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Escolher o que fazer agora'],
    transitionMessage: 'Antes de encerrar, você pode escolher com calma o que faz sentido agora.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que você gostaria de fazer agora?',
      options: [
        {
          id: 'understand',
          label: 'Quero entender como estou me sentindo.',
          next: 'start',
          effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
        },
        {
          id: 'organize',
          label: 'Quero organizar o que estou vivendo.',
          next: 'start',
          effects: [{ kind: 'flow_start', flowId: 'orientation-organize-experience' }],
        },
        {
          id: 'care',
          label: 'Quero encontrar um próximo passo de cuidado.',
          next: 'start',
          effects: [{ kind: 'flow_start', flowId: 'orientation-next-care-step' }],
        },
        {
          id: 'calm',
          label: 'Preciso de um momento mais leve.',
          next: 'start',
          effects: [{ kind: 'flow_start', flowId: 'orientation-calm-moment' }],
        },
      ],
    },
  },
} satisfies GuidedFlow;
