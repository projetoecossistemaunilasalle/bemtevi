import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { flowVisuals } from '../visuals';
import { ending } from './documentFlowBuilders';

export const nextCareStepFlow = {
  id: 'orientation-next-care-step',
  version: '2.0.0',
  locale: 'pt-BR',
  title: 'Encontrar um próximo passo de cuidado',
  type: 'guided_conversation',
  purpose: 'orientation_entry',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero encontrar um próximo passo de cuidado'],
    transitionMessage:
      'Nem sempre o próximo passo precisa ser grande. Às vezes, uma ação pequena e possível já pode ajudar a começar a cuidar do que você precisa agora.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'Que tipo de próximo passo parece mais útil?',
      options: [
        { id: 'action', label: 'Quero fazer uma pequena ação por mim.', next: 'a-acao' },
        { id: 'network', label: 'Quero buscar apoio de alguém.', next: 'b-rede' },
        { id: 'steps', label: 'Quero retomar algo importante que venho deixando para depois.', next: 'c-passos' },
        { id: 'professional', label: 'Acho que pode ser hora de buscar apoio profissional.', next: 'd-profissional' },
        { id: 'unsure', label: 'Ainda não sei qual próximo passo escolher.', next: 'e-escolher' },
      ],
    },
    'a-acao': {
      id: 'a-acao',
      kind: 'choice',
      text: 'Qual ação possível combina mais com você agora?',
      options: [
        { id: 'rest', label: 'Quero reservar alguns minutos para descansar.', next: 'a-encerramento' },
        { id: 'pleasant', label: 'Quero fazer algo que me faça bem ou que eu goste.', next: 'a-encerramento' },
        {
          id: 'practical',
          label: 'Quero cuidar de uma necessidade prática que tenho deixado de lado.',
          next: 'c-passos',
        },
        { id: 'talk', label: 'Percebi que preciso conversar com alguém.', next: 'b-rede' },
      ],
    },
    'a-encerramento': ending('a-encerramento', 'Escolha uma ação pequena e possível. Ela já pode ser um começo.'),
    'b-rede': {
      id: 'b-rede',
      kind: 'choice',
      text: 'Apoio não precisa significar contar tudo. Pode ser pedir companhia, ajuda concreta ou uma conversa.',
      visuals: [
        {
          id: 'support-network',
          src: flowVisuals.supportNetwork,
          alt: 'Recurso visual para identificar pessoas e formas de apoio na rede pessoal.',
        },
      ],
      options: [
        { id: 'trust', label: 'Quero conversar com alguém de confiança.', next: 'b-encerramento' },
        { id: 'concrete', label: 'Preciso pedir ajuda com algo concreto.', next: 'b-encerramento' },
        { id: 'professional', label: 'Quero conhecer formas de apoio profissional.', next: 'd-profissional' },
        { id: 'not-now', label: 'Não quero procurar alguém neste momento.', next: 'b-encerramento' },
      ],
    },
    'b-encerramento': ending('b-encerramento', 'Você pode escolher o ritmo e a forma de buscar apoio.'),
    'c-passos': {
      id: 'c-passos',
      kind: 'choice',
      text: 'Um passo pequeno também conta. Escolha algo que caiba no seu dia.',
      visuals: [
        {
          id: 'small-steps',
          src: flowVisuals.smallSteps,
          alt: 'Recurso visual lembrando que pequenos passos contam.',
        },
      ],
      options: [
        { id: 'today', label: 'Existe uma ação pequena que consigo fazer hoje.', next: 'c-encerramento' },
        { id: 'help', label: 'Preciso primeiro de alguma informação ou ajuda.', next: 'c-encerramento' },
        { id: 'later', label: 'Isso não precisa ser feito hoje.', next: 'c-encerramento' },
      ],
    },
    'c-encerramento': ending('c-encerramento', 'Um passo pequeno e possível já é cuidado.'),
    'd-profissional': {
      id: 'd-profissional',
      kind: 'choice',
      text: 'Buscar ajuda também é uma forma de cuidado. Você pode conhecer os serviços disponíveis ou conversar primeiro com alguém de confiança.',
      visuals: [
        {
          id: 'professional-support',
          src: flowVisuals.professionalSupport,
          alt: 'Recurso visual sobre buscar apoio profissional como cuidado.',
        },
      ],
      videos: [{ id: 'mental-health', title: 'Vamos falar sobre saúde mental?', url: 'https://youtu.be/kuA2l7tXtE4' }],
      options: [
        {
          id: 'services',
          label: 'Quero conhecer os serviços disponíveis.',
          next: 'd-profissional',
          effects: [{ kind: 'navigate', destination: '/contatos' }],
        },
        {
          id: 'feelings',
          label: 'Quero entender melhor como está meu bem-estar.',
          next: 'd-profissional',
          effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
        },
        { id: 'action', label: 'Ainda quero começar por uma pequena ação de cuidado.', next: 'a-acao' },
      ],
    },
    'e-escolher': ending(
      'e-escolher',
      'Você não precisa decidir tudo agora. Escolha apenas um caminho que pareça possível.',
    ),
  },
} satisfies GuidedFlow;
