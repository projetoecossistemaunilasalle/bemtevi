import type { GuidedFlow } from '../../../domain/flow-engine/types';

export const calmMomentFlow = {
  id: 'orientation-calm-moment',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Momento mais leve',
  type: 'guided_conversation',
  purpose: 'orientation_entry',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Preciso de um momento mais leve'],
    transitionMessage: 'Tudo bem escolher algo mais leve agora.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que parece mais acolhedor neste momento?',
      options: [
        {
          id: 'rest',
          label: 'Uma pausa curta',
          next: 'handoff-rest',
          effects: [{ kind: 'flow_start', flowId: 'rest-recovery' }],
        },
        {
          id: 'education',
          label: 'Abrir algo educativo',
          next: 'navigation-fallback',
          effects: [{ kind: 'navigate', destination: '/educacao' }],
        },
        {
          id: 'end',
          label: 'Finalizar por hoje',
          next: 'end-result',
          effects: [{ kind: 'end_flow', message: 'Tudo bem. Você pode voltar quando quiser.' }],
        },
      ],
    },
    'handoff-rest': { id: 'handoff-rest', kind: 'result', text: 'Vou abrir uma pausa curta.' },
    'navigation-fallback': {
      id: 'navigation-fallback',
      kind: 'result',
      text: 'Abrindo materiais educativos.',
    },
    'end-result': {
      id: 'end-result',
      kind: 'result',
      text: 'Tudo bem. Você pode voltar quando quiser.',
    },
  },
} satisfies GuidedFlow;
