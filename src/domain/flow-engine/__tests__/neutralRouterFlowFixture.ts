import type { GuidedFlow } from '../types';

export const neutralRouterFlow: GuidedFlow = {
  id: 'neutral-router',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Roteador neutro',
  type: 'guided_conversation',
  purpose: 'orientation_entry',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero escolher um caminho'],
    transitionMessage: 'Vamos escolher com calma.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que parece fazer sentido agora?',
      options: [
        {
          id: 'start-specific',
          label: 'Falar sobre sobrecarga',
          next: 'handoff',
          effects: [{ kind: 'flow_start', flowId: 'fixture-flow' }],
        },
      ],
    },
    handoff: {
      id: 'handoff',
      kind: 'result',
      text: 'Vou abrir outro caminho.',
    },
  },
};
