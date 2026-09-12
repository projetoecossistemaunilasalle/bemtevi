import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { flowVisuals } from '../visuals';
import { ending } from './documentFlowBuilders';

export const organizeExperienceFlow = {
  id: 'orientation-organize-experience',
  version: '2.0.0',
  locale: 'pt-BR',
  title: 'Organizar o que estou vivendo',
  type: 'guided_conversation',
  purpose: 'orientation_entry',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero organizar o que estou vivendo', 'Organizar o que estou vivendo'],
    transitionMessage:
      'Às vezes, sabemos como estamos nos sentindo, mas ainda precisamos encontrar uma forma de lidar com aquilo que está acontecendo.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que mais se aproxima do que você está vivendo?',
      options: [
        {
          id: 'priorities',
          label: 'Preciso decidir o que fazer primeiro diante de várias situações.',
          next: 'a-prioridades',
        },
        {
          id: 'relationships',
          label: 'Preciso lidar com uma conversa ou situação difícil com alguém.',
          next: 'b-relacoes',
        },
        {
          id: 'change',
          label: 'Estou diante de uma mudança ou situação que não depende apenas de mim.',
          next: 'c-influencia',
        },
        {
          id: 'act-now',
          label: 'Existe uma situação que continua voltando aos meus pensamentos.',
          next: 'd-agir-ou-esperar',
        },
        { id: 'unsure', label: 'Não sei qual dessas opções se encaixa melhor.', next: 'e-escolher' },
      ],
    },
    'a-prioridades': {
      id: 'a-prioridades',
      kind: 'choice',
      text: 'Qual é o próximo problema a resolver?',
      visuals: [
        {
          id: 'next-problem',
          src: flowVisuals.nextProblem,
          alt: 'Recurso visual para decidir se algo precisa ser resolvido hoje, pode ser planejado, precisa aguardar ou pode ficar em espera.',
        },
      ],
      options: [
        {
          id: 'today',
          label: 'Existe algo que precisa ser resolvido hoje.',
          next: 'a-prioridades',
          effects: [{ kind: 'flow_start', flowId: 'orientation-next-care-step' }],
        },
        {
          id: 'plan',
          label: 'Existe algo importante, mas posso escolher quando lidar com isso.',
          next: 'a-encerramento',
        },
        {
          id: 'wait-info',
          label: 'Essa situação depende de outra pessoa ou de alguma informação.',
          next: 'a-encerramento',
        },
        { id: 'no-action', label: 'Neste momento, não existe nenhuma ação possível.', next: 'a-encerramento' },
      ],
    },
    'a-encerramento': ending(
      'a-encerramento',
      'Escolher o próximo passo já pode ajudar. Você não precisa resolver tudo de uma vez.',
    ),
    'b-relacoes': {
      id: 'b-relacoes',
      kind: 'choice',
      text: 'Preparar o que precisa ser dito pode tornar a conversa mais clara.',
      visuals: [
        {
          id: 'difficult-conversation',
          src: flowVisuals.difficultConversation,
          alt: 'Recurso visual para preparar uma conversa difícil.',
        },
      ],
      options: [
        { id: 'talk', label: 'Quero conversar sobre essa situação.', next: 'b-encerramento' },
        { id: 'wait', label: 'Prefiro esperar antes de conversar.', next: 'b-encerramento' },
        {
          id: 'support',
          label: 'Percebi que preciso de apoio para lidar com essa situação.',
          next: 'b-relacoes',
          effects: [{ kind: 'flow_start', flowId: 'orientation-next-care-step' }],
        },
      ],
    },
    'b-encerramento': ending('b-encerramento', 'Você não precisa resolver tudo em uma única conversa.'),
    'c-influencia': {
      id: 'c-influencia',
      kind: 'choice',
      text: 'Separar o que está sob seu controle, o que você pode influenciar e o que não depende de você pode ajudar a direcionar sua energia.',
      visuals: [
        {
          id: 'circle-of-influence',
          src: flowVisuals.circleOfInfluence,
          alt: 'Recurso visual sobre o círculo de influência e o que está ou não sob seu controle.',
        },
      ],
      options: [
        {
          id: 'control',
          label: 'Existe algo que depende diretamente de mim.',
          next: 'c-influencia',
          effects: [{ kind: 'flow_start', flowId: 'orientation-next-care-step' }],
        },
        {
          id: 'influence',
          label: 'Posso tentar influenciar a situação, mas ela não depende apenas de mim.',
          next: 'c-influencia',
          effects: [{ kind: 'flow_start', flowId: 'orientation-next-care-step' }],
        },
        { id: 'outside', label: 'Neste momento, a situação não está ao meu alcance.', next: 'c-encerramento' },
      ],
    },
    'c-encerramento': ending(
      'c-encerramento',
      'Direcione sua atenção primeiro para aquilo em que existe alguma possibilidade de ação.',
    ),
    'd-agir-ou-esperar': {
      id: 'd-agir-ou-esperar',
      kind: 'choice',
      text: 'Há algo que posso fazer sobre isso agora?',
      visuals: [
        {
          id: 'act-now',
          src: flowVisuals.actNow,
          alt: 'Recurso visual para decidir se é possível agir agora ou deixar uma situação em espera.',
        },
      ],
      options: [
        {
          id: 'can-act',
          label: 'Existe alguma ação concreta que posso realizar agora.',
          next: 'd-agir-ou-esperar',
          effects: [{ kind: 'flow_start', flowId: 'orientation-next-care-step' }],
        },
        { id: 'depends', label: 'A situação depende de algo que ainda não aconteceu.', next: 'd-encerramento' },
        { id: 'no-action', label: 'Neste momento, não existe nenhuma ação possível.', next: 'd-encerramento' },
      ],
    },
    'd-encerramento': ending(
      'd-encerramento',
      'Decidir entre agir agora ou deixar em espera já é um cuidado com você.',
    ),
    'e-escolher': {
      id: 'e-escolher',
      kind: 'choice',
      text: 'Qual tipo de ajuda parece mais útil agora?',
      options: [
        { id: 'priorities', label: 'Quero decidir o que fazer primeiro.', next: 'a-prioridades' },
        { id: 'relationships', label: 'Quero pensar em como lidar com outra pessoa.', next: 'b-relacoes' },
        { id: 'influence', label: 'Quero entender melhor o que depende de mim.', next: 'c-influencia' },
        { id: 'act', label: 'Quero saber se existe algo que posso fazer agora.', next: 'd-agir-ou-esperar' },
        {
          id: 'feelings',
          label: 'Quero entender melhor como estou me sentindo.',
          next: 'e-escolher',
          effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
        },
      ],
    },
  },
} satisfies GuidedFlow;
