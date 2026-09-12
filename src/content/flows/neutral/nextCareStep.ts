import type { GuidedFlow } from '../../../domain/flow-engine/types';

export const nextCareStepFlow = {
  id: 'orientation-next-care-step',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Encontrar um próximo passo de cuidado',
  type: 'guided_conversation',
  purpose: 'orientation_entry',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero encontrar um próximo passo de cuidado'],
    transitionMessage: 'Vamos escolher um próximo passo possível para agora.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'Que tipo de próximo passo parece mais útil?',
      options: [
        {
          id: 'guided-reflection',
          label: 'Uma orientação guiada',
          next: 'handoff-work-stress',
          effects: [{ kind: 'flow_start', flowId: 'work-stress' }],
        },
        {
          id: 'rest-pause',
          label: 'Uma pausa de recuperação',
          next: 'handoff-rest',
          effects: [{ kind: 'flow_start', flowId: 'rest-recovery' }],
        },
        {
          id: 'who5-check',
          label: 'Um questionário de bem-estar',
          next: 'handoff-who5',
          effects: [{ kind: 'flow_start', flowId: 'who5' }],
        },
        {
          id: 'app-destinations',
          label: 'Materiais, contatos ou apoio',
          next: 'app-destinations',
        },
      ],
    },
    'app-destinations': {
      id: 'app-destinations',
      kind: 'choice',
      text: 'O que você quer abrir agora?',
      options: [
        {
          id: 'education',
          label: 'Abrir materiais educativos',
          next: 'navigation-fallback',
          effects: [{ kind: 'navigate', destination: '/educacao' }],
        },
        {
          id: 'contacts',
          label: 'Abrir contatos de apoio',
          next: 'navigation-fallback',
          effects: [{ kind: 'navigate', destination: '/contatos' }],
        },
        {
          id: 'support-now',
          label: 'Abrir apoio agora',
          next: 'navigation-fallback',
          effects: [{ kind: 'navigate', destination: '/apoio' }],
        },
      ],
    },
    'handoff-work-stress': { id: 'handoff-work-stress', kind: 'result', text: 'Vou abrir uma orientação guiada.' },
    'handoff-rest': { id: 'handoff-rest', kind: 'result', text: 'Vou abrir uma pausa de recuperação.' },
    'handoff-who5': { id: 'handoff-who5', kind: 'result', text: 'Vou abrir o questionário WHO-5.' },
    'navigation-fallback': {
      id: 'navigation-fallback',
      kind: 'result',
      text: 'Abrindo o caminho escolhido.',
    },
  },
} satisfies GuidedFlow;
