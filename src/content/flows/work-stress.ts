import type { GuidedFlow } from '../../domain/flow-engine/types';

export const workStressFlow = {
  id: 'work-stress',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Sobrecarga na escola',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: [
      'Estou sobrecarregado no trabalho',
      'Tenho muito estresse na escola',
      'Não estou dando conta das demandas',
    ],
    transitionMessage: 'Vamos olhar para essa sobrecarga com calma. Escolha a opção que mais se aproxima do seu momento.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que mais tem pesado para você no trabalho?',
      options: [
        {
          id: 'too-many-tasks',
          label: 'Muitas tarefas ao mesmo tempo',
          next: 'tasks-response',
        },
        {
          id: 'hard-to-rest',
          label: 'Dificuldade para descansar',
          next: 'rest-response',
        },
        {
          id: 'conflict-pressure',
          label: 'Pressão ou conflitos na escola',
          next: 'pressure-response',
        },
      ],
    },
    'tasks-response': {
      id: 'tasks-response',
      kind: 'choice',
      text: 'Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.',
      options: [
        {
          id: 'try-priority-pause',
          label: 'Quero pensar em uma pausa curta',
          next: 'small-pause',
        },
        {
          id: 'see-resource',
          label: 'Ver um material sobre regulação emocional',
          next: 'resource-result',
        },
      ],
    },
    'rest-response': {
      id: 'rest-response',
      kind: 'choice',
      text: 'Descansar também é parte do cuidado. Mesmo poucos minutos podem ajudar o corpo a sair do modo de alerta.',
      options: [
        {
          id: 'try-breathing',
          label: 'Quero uma pausa guiada',
          next: 'small-pause',
        },
        {
          id: 'see-resource',
          label: 'Ver um material sobre regulação emocional',
          next: 'resource-result',
        },
      ],
    },
    'pressure-response': {
      id: 'pressure-response',
      kind: 'choice',
      text: 'Pressões e conflitos podem pesar muito. Você não precisa organizar tudo sozinho neste instante.',
      options: [
        {
          id: 'seek-support',
          label: 'Quero ver caminhos de apoio',
          next: 'support-result',
        },
        {
          id: 'small-step',
          label: 'Quero escolher um próximo passo simples',
          next: 'small-pause',
        },
      ],
    },
    'small-pause': {
      id: 'small-pause',
      kind: 'result',
      text: 'Experimente pausar por um minuto, soltar os ombros e escolher apenas uma ação pequena para agora.',
      recommendations: ['teacher-emotional-regulation-classroom'],
    },
    'resource-result': {
      id: 'resource-result',
      kind: 'result',
      text: 'Separei um material educativo que pode ajudar a reconhecer sinais de sobrecarga e organizar estratégias de cuidado.',
      recommendations: ['teacher-emotional-regulation-classroom'],
    },
    'support-result': {
      id: 'support-result',
      kind: 'result',
      text: 'Você pode procurar apoio com calma. Se precisar de ajuda imediata, use a opção de apoio agora.',
    },
  },
} satisfies GuidedFlow;
