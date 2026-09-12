import type { GuidedFlow } from '../../../domain/flow-engine/types';

export const talkThroughExperienceFlow = {
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
      freeText: { next: 'free-reflection-response' },
    },
    'free-reflection-response': {
      id: 'free-reflection-response',
      kind: 'choice',
      text: 'Obrigado por compartilhar. Podemos seguir sem analisar esse texto.',
      options: [
        {
          id: 'understand',
          label: 'Quero entender melhor esse momento',
          next: 'handoff-understand',
          effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
        },
        {
          id: 'care-step',
          label: 'Quero escolher um próximo passo',
          next: 'handoff-care-step',
          effects: [{ kind: 'flow_start', flowId: 'orientation-next-care-step' }],
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
    'handoff-care-step': {
      id: 'handoff-care-step',
      kind: 'result',
      text: 'Vou abrir um caminho para escolher um próximo passo.',
    },
  },
} satisfies GuidedFlow;
