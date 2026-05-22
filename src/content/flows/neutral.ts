import type { GuidedFlow } from '../../domain/flow-engine/types';

export const neutralFlows = [
  {
    id: 'orientation-understand-feelings',
    version: '1.0.0',
    locale: 'pt-BR',
    title: 'Entender como estou me sentindo',
    type: 'guided_conversation',
    purpose: 'orientation_entry',
    status: 'draft',
    entry: {
      nodeId: 'start',
      enteringPhrases: ['Quero entender como estou me sentindo'],
      transitionMessage: 'Vamos começar de um jeito simples, sem precisar fechar uma resposta agora.',
    },
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'Qual destas opções se aproxima mais do seu momento?',
        options: [
          {
            id: 'overload',
            label: 'Parece mais sobre sobrecarga',
            next: 'handoff-work-stress',
            effects: [{ kind: 'flow_start', flowId: 'work-stress' }],
          },
          {
            id: 'rest',
            label: 'Parece mais sobre cansaço ou descanso',
            next: 'handoff-rest',
            effects: [{ kind: 'flow_start', flowId: 'rest-recovery' }],
          },
          {
            id: 'srq20',
            label: 'Quero responder um questionário breve',
            next: 'handoff-srq20',
            effects: [{ kind: 'flow_start', flowId: 'srq20' }],
          },
          {
            id: 'calm',
            label: 'Prefiro algo mais leve agora',
            next: 'handoff-calm',
            effects: [{ kind: 'flow_start', flowId: 'orientation-calm-moment' }],
          },
        ],
      },
      'handoff-work-stress': {
        id: 'handoff-work-stress',
        kind: 'result',
        text: 'Vou abrir um caminho sobre sobrecarga.',
      },
      'handoff-rest': { id: 'handoff-rest', kind: 'result', text: 'Vou abrir um caminho sobre descanso.' },
      'handoff-srq20': { id: 'handoff-srq20', kind: 'result', text: 'Vou abrir o questionário.' },
      'handoff-calm': { id: 'handoff-calm', kind: 'result', text: 'Vou abrir um caminho mais leve.' },
    },
  },
  {
    id: 'orientation-talk-through-experience',
    version: '1.0.0',
    locale: 'pt-BR',
    title: 'Falar sobre o que estou vivendo',
    type: 'guided_conversation',
    purpose: 'orientation_entry',
    status: 'draft',
    entry: {
      nodeId: 'start',
      enteringPhrases: ['Quero falar sobre o que estou vivendo'],
      transitionMessage: 'Podemos organizar isso por partes, sem pressa.',
    },
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'O que mais marcou seu dia ou sua semana?',
        options: [
          {
            id: 'many-demands',
            label: 'Muitas demandas ao mesmo tempo',
            next: 'handoff-work-stress',
            effects: [{ kind: 'flow_start', flowId: 'work-stress' }],
          },
          {
            id: 'body-tired',
            label: 'Meu corpo pede descanso',
            next: 'handoff-rest',
            effects: [{ kind: 'flow_start', flowId: 'rest-recovery' }],
          },
          {
            id: 'pressure-conflict',
            label: 'Teve pressão ou conflito',
            next: 'handoff-work-stress',
            effects: [{ kind: 'flow_start', flowId: 'work-stress' }],
          },
          {
            id: 'uncertain',
            label: 'Ainda não sei nomear',
            next: 'handoff-understand',
            effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
          },
        ],
      },
      'handoff-work-stress': {
        id: 'handoff-work-stress',
        kind: 'result',
        text: 'Vou abrir um caminho sobre sobrecarga.',
      },
      'handoff-rest': { id: 'handoff-rest', kind: 'result', text: 'Vou abrir um caminho sobre descanso.' },
      'handoff-understand': {
        id: 'handoff-understand',
        kind: 'result',
        text: 'Vou abrir um caminho para entender o momento.',
      },
    },
  },
  {
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
            id: 'questionnaire',
            label: 'Um questionário breve',
            next: 'handoff-srq20',
            effects: [{ kind: 'flow_start', flowId: 'srq20' }],
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
      'handoff-srq20': { id: 'handoff-srq20', kind: 'result', text: 'Vou abrir o questionário.' },
      'navigation-fallback': {
        id: 'navigation-fallback',
        kind: 'result',
        text: 'Abrindo o caminho escolhido.',
      },
    },
  },
  {
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
  },
  {
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
  },
] satisfies GuidedFlow[];
