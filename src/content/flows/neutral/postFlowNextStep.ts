import type { GuidedFlow } from '../../../domain/flow-engine/types';

export const postFlowNextStepFlow = {
  id: 'post-flow-next-step',
  version: '1.0.0',
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
      text: 'Qual próximo passo você prefere?',
      options: [
        {
          id: 'another-topic',
          label: 'Conversar sobre outro tema',
          next: 'handoff-orientation',
          effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
        },
        {
          id: 'rest',
          label: 'Tentar uma pausa de descanso',
          next: 'handoff-rest',
          effects: [{ kind: 'flow_start', flowId: 'rest-recovery' }],
        },
        {
          id: 'app-destinations',
          label: 'Materiais, contatos ou apoio',
          next: 'app-destinations',
        },
        {
          id: 'end',
          label: 'Finalizar por hoje',
          next: 'end-result',
          effects: [{ kind: 'end_flow', message: 'Tudo bem. Você pode voltar quando quiser.' }],
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
    'handoff-orientation': {
      id: 'handoff-orientation',
      kind: 'result',
      text: 'Vou abrir outro caminho de orientação.',
    },
    'handoff-rest': { id: 'handoff-rest', kind: 'result', text: 'Vou abrir uma pausa de descanso.' },
    'navigation-fallback': {
      id: 'navigation-fallback',
      kind: 'result',
      text: 'Abrindo o caminho escolhido.',
    },
    'end-result': {
      id: 'end-result',
      kind: 'result',
      text: 'Tudo bem. Você pode voltar quando quiser.',
    },
  },
} satisfies GuidedFlow;
