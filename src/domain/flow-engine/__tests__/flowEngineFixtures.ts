import type { GuidedFlow } from '../types';

export const validFlow: GuidedFlow = {
  id: 'fixture-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo de teste',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero começar o fluxo de teste'],
    transitionMessage: 'Vamos começar com calma.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que você quer testar?',
      options: [{ id: 'continue', label: 'Continuar', next: 'end' }],
    },
    end: {
      id: 'end',
      kind: 'result',
      text: 'Chegamos ao fim.',
      recommendations: ['respiracao-professores'],
    },
  },
};

export const scoringFlow: GuidedFlow = {
  id: 'scoring-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo com pontuação',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'q1',
    enteringPhrases: ['Quero testar pontuação'],
    transitionMessage: 'Vamos testar uma pergunta com pontuação.',
  },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Você quer somar um ponto?',
      options: [
        {
          id: 'yes',
          label: 'Sim',
          next: 'score-branch',
          effects: [{ kind: 'score', scoreKey: 'fixture-score', value: 1 }],
        },
        {
          id: 'no',
          label: 'Não',
          next: 'score-branch',
        },
      ],
    },
    'score-branch': {
      id: 'score-branch',
      kind: 'score_branch',
      text: 'Calculando o melhor retorno.',
      scoreKey: 'fixture-score',
      branches: [
        { id: 'low', min: 0, max: 0, next: 'low-result' },
        { id: 'high', min: 1, max: 20, next: 'high-result' },
      ],
    },
    'low-result': {
      id: 'low-result',
      kind: 'result',
      text: 'Resultado baixo.',
    },
    'high-result': {
      id: 'high-result',
      kind: 'result',
      text: 'Resultado alto.',
    },
  },
};

export const scoringResumeFlow: GuidedFlow = {
  id: 'scoring-resume-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo de pontuação suspenso',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'q1',
    enteringPhrases: ['Quero testar pontuação suspensa'],
    transitionMessage: 'Vamos salvar a pontuação antes de trocar de fluxo.',
  },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Você quer registrar um ponto?',
      options: [
        {
          id: 'yes',
          label: 'Sim',
          next: 'after-score',
          effects: [{ kind: 'score', scoreKey: 'fixture-resume-score', value: 1 }],
        },
        { id: 'no', label: 'Não', next: 'after-score' },
      ],
    },
    'after-score': {
      id: 'after-score',
      kind: 'choice',
      text: 'A pontuação já foi registrada. O que deseja fazer?',
      options: [{ id: 'score-branch', label: 'Ir para pontuação', next: 'score-branch' }],
    },
    'score-branch': {
      id: 'score-branch',
      kind: 'score_branch',
      text: 'Calculando o retorno salvo.',
      scoreKey: 'fixture-resume-score',
      branches: [
        { id: 'low', min: 0, max: 0, next: 'low-result' },
        { id: 'high', min: 1, max: 20, next: 'high-result' },
      ],
    },
    'low-result': {
      id: 'low-result',
      kind: 'result',
      text: 'Resultado baixo.',
    },
    'high-result': {
      id: 'high-result',
      kind: 'result',
      text: 'Resultado alto.',
    },
  },
};

export const secondFlow: GuidedFlow = {
  id: 'second-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Segundo fluxo',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero trocar de assunto'],
    transitionMessage: 'Vamos olhar para outro ponto com calma.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'Por onde você quer começar?',
      options: [{ id: 'finish', label: 'Finalizar este caminho', next: 'end' }],
    },
    end: {
      id: 'end',
      kind: 'result',
      text: 'Este caminho terminou.',
    },
  },
};
