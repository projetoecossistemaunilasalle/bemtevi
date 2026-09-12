import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { flowVisuals } from '../visuals';
import { close, ending } from './documentFlowBuilders';

export const calmMomentFlow = {
  id: 'orientation-calm-moment',
  version: '2.0.0',
  locale: 'pt-BR',
  title: 'Momento mais leve',
  type: 'guided_conversation',
  purpose: 'orientation_entry',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Preciso de um momento mais leve'],
    transitionMessage:
      'Nem todo momento precisa ser usado para entender, organizar ou resolver alguma coisa. Se quiser, escolha uma forma simples de fazer uma pequena pausa agora.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que parece mais acolhedor neste momento?',
      options: [
        { id: 'practice', label: 'Quero fazer uma prática rápida.', next: 'a-praticas' },
        { id: 'focus', label: 'Quero apenas mudar um pouco o foco.', next: 'b-foco' },
        { id: 'pause', label: 'Quero um pequeno momento de pausa.', next: 'c-pausa' },
        {
          id: 'end',
          label: 'Por enquanto, quero encerrar.',
          next: 'start',
          effects: [{ kind: 'end_flow', message: 'Tudo bem. Você pode retomar uma orientação quando quiser.' }],
        },
      ],
    },
    'a-praticas': {
      id: 'a-praticas',
      kind: 'choice',
      text: 'Escolha uma prática breve.',
      options: [
        { id: 'butterfly', label: 'Respiração Borboleta.', next: 'a2-borboleta' },
        { id: 'senses', label: 'Pausa dos sentidos.', next: 'a3-sentidos' },
        { id: 'body', label: 'Soltar a tensão do corpo.', next: 'a4-tensao' },
        { id: 'notice', label: 'Perceber e deixar passar.', next: 'a5-perceber' },
      ],
    },
    'a2-borboleta': {
      id: 'a2-borboleta',
      kind: 'choice',
      text: 'Acompanhe o passo a passo da Respiração Borboleta.',
      visuals: [
        {
          id: 'butterfly-breathing',
          src: flowVisuals.butterflyBreathing,
          alt: 'Passo a passo da Respiração Borboleta.',
        },
      ],
      options: close('a2-borboleta'),
    },
    'a3-sentidos': {
      id: 'a3-sentidos',
      kind: 'choice',
      text: 'Use os sentidos para retornar ao presente.',
      visuals: [{ id: 'senses-pause', src: flowVisuals.sensesPause, alt: 'Passo a passo da Pausa dos sentidos.' }],
      options: close('a3-sentidos'),
    },
    'a4-tensao': {
      id: 'a4-tensao',
      kind: 'choice',
      text: 'Permita-se soltar um pouco a tensão do corpo.',
      visuals: [
        {
          id: 'body-tension-release',
          src: flowVisuals.bodyTensionRelease,
          alt: 'Passo a passo para soltar a tensão do corpo.',
        },
      ],
      options: close('a4-tensao'),
    },
    'a5-perceber': {
      id: 'a5-perceber',
      kind: 'choice',
      text: 'Observe o que está presente e deixe passar sem precisar resolver agora.',
      visuals: [
        {
          id: 'notice-let-pass',
          src: flowVisuals.noticeLetPass,
          alt: 'Passo a passo para perceber e deixar passar.',
        },
      ],
      options: close('a5-perceber'),
    },
    'b-foco': {
      id: 'b-foco',
      kind: 'choice',
      text: 'Mudar um pouco o foco pode ajudar. Escolha algo simples e possível.',
      options: [
        {
          id: 'environment',
          label: 'Quero levantar e mudar de ambiente por alguns minutos.',
          next: 'b-encerramento',
        },
        {
          id: 'window',
          label: 'Quero olhar pela janela ou observar o ambiente ao meu redor.',
          next: 'b-encerramento',
        },
        { id: 'walk', label: 'Quero fazer uma pequena caminhada pelo espaço onde estou.', next: 'b-encerramento' },
        {
          id: 'interrupt',
          label: 'Quero interromper o que estou fazendo por alguns minutos.',
          next: 'b-encerramento',
        },
      ],
    },
    'b-encerramento': ending('b-encerramento', 'Uma pequena mudança de foco também pode ser uma pausa.'),
    'c-pausa': ending(
      'c-pausa',
      'Você não precisa fazer um exercício, pensar sobre o que está sentindo ou tomar nenhuma decisão. Se for possível, permita-se alguns instantes sem organizar, responder ou resolver nada.',
    ),
  },
} satisfies GuidedFlow;
