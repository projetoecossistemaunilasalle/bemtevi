import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { flowVisuals } from '../visuals';
import { close, ending } from './documentFlowBuilders';

export const understandFeelingsFlow = {
  id: 'orientation-understand-feelings',
  version: '2.0.0',
  locale: 'pt-BR',
  title: 'Entender como estou me sentindo',
  type: 'guided_conversation',
  purpose: 'orientation_entry',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero entender como estou me sentindo', 'Entender como estou me sentindo'],
    transitionMessage:
      'Vamos começar de um jeito simples. Você não precisa ter uma resposta pronta. Escolha a opção que mais se aproxima de como você está neste momento.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que mais se aproxima do seu momento agora?',
      options: [
        { id: 'overload', label: 'Tenho me sentido sobrecarregado(a).', next: 'a1-sobrecarga' },
        { id: 'rest', label: 'Tenho me sentido cansado(a) e preciso descansar.', next: 'b1-cansaco' },
        { id: 'emotions', label: 'Tenho percebido emoções difíceis de lidar.', next: 'c1-emocoes' },
        { id: 'identify', label: 'Não sei bem o que estou sentindo.', next: 'd1-identificacao' },
        {
          id: 'who5',
          label: 'Quero ter uma visão breve de como está meu bem-estar.',
          next: 'start',
          effects: [{ kind: 'flow_start', flowId: 'who5' }],
        },
      ],
    },
    'a1-sobrecarga': {
      id: 'a1-sobrecarga',
      kind: 'choice',
      text: 'Quando muitas demandas se acumulam, pode parecer que tudo precisa ser resolvido ao mesmo tempo.\n\nO que mais tem pesado para você neste momento?',
      options: [
        { id: 'too-much', label: 'Sinto que tenho coisas demais para resolver.', next: 'a2-prioridades' },
        { id: 'priorities', label: 'Tenho dificuldade de estabelecer prioridades.', next: 'a2-prioridades' },
        { id: 'everything', label: 'Estou tentando dar conta de tudo ao mesmo tempo.', next: 'a2-prioridades' },
      ],
    },
    'a2-prioridades': {
      id: 'a2-prioridades',
      kind: 'choice',
      text: 'O vídeo abaixo apresenta uma forma simples de olhar para prioridades.',
      videos: [
        {
          id: 'video-prioridades',
          title: 'Como estabelecer prioridades',
          url: 'https://www.youtube.com/watch?v=NRAsKCcty9Q',
        },
      ],
      options: close('a2-prioridades'),
    },
    'b1-cansaco': {
      id: 'b1-cansaco',
      kind: 'choice',
      text: 'O cansaço pode aparecer quando o corpo e a mente estão sendo exigidos por muito tempo.\n\nQue tipo de descanso parece mais possível para você agora?',
      options: [
        { id: 'short-pause', label: 'Fazer uma pausa curta.', next: 'b2-pausa-curta' },
        { id: 'space', label: 'Afastar-me um pouco das demandas.', next: 'b3-espaco-descanso' },
        { id: 'unsure', label: 'Não sei do que preciso agora.', next: 'b4-dificil-saber' },
      ],
    },
    'b2-pausa-curta': {
      id: 'b2-pausa-curta',
      kind: 'choice',
      text: 'Uma pausa curta pode ajudar a interromper, por alguns instantes, o ritmo das demandas.',
      exercise: 'breathing',
      options: close('b2-pausa-curta'),
    },
    'b3-espaco-descanso': {
      id: 'b3-espaco-descanso',
      kind: 'choice',
      text: 'Se for possível, permita-se alguns minutos sem precisar resolver, organizar ou responder nada.',
      videos: [
        {
          id: 'video-espaco-descanso',
          title: 'Prática breve de relaxamento',
          url: 'https://www.youtube.com/watch?v=kiEmbhvv7Fo',
        },
      ],
      options: close('b3-espaco-descanso'),
    },
    'b4-dificil-saber': ending(
      'b4-dificil-saber',
      'Nem sempre é fácil perceber do que precisamos. Você pode experimentar a prática STOP de atenção plena: pare, respire, observe e prossiga um passo de cada vez.',
    ),
    'c1-emocoes': {
      id: 'c1-emocoes',
      kind: 'choice',
      text: 'Algumas emoções podem ficar mais presentes em períodos de pressão, mudanças ou situações difíceis.\n\nQual destas situações se aproxima mais do que você está vivendo?',
      visuals: [
        { id: 'emotions', src: flowVisuals.emotions, alt: 'Guia visual sobre ansiedade, tristeza e irritação.' },
      ],
      options: [
        { id: 'anxiety', label: 'Tenho ficado mais ansioso(a) ou preocupado(a).', next: 'c2-ansiedade' },
        { id: 'sadness', label: 'Tenho me sentido triste ou desanimado(a).', next: 'c3-tristeza' },
        { id: 'irritation', label: 'Tenho ficado irritado(a) ou impaciente.', next: 'c4-irritacao' },
        { id: 'identify', label: 'Ainda tenho dificuldade para entender o que sinto.', next: 'd1-identificacao' },
      ],
    },
    'c2-ansiedade': {
      id: 'c2-ansiedade',
      kind: 'choice',
      text: 'A ansiedade pode acelerar pensamentos e sensações no corpo. Regular a respiração pode ajudar a criar um pouco mais de espaço neste momento.',
      videos: [
        {
          id: 'video-ansiedade',
          title: 'Como controlar uma crise de ansiedade',
          url: 'https://www.youtube.com/watch?v=8YG8HABY25w',
        },
        {
          id: 'video-respiracao-ansiedade',
          title: 'Técnica de respiração para ansiedade',
          url: 'https://www.youtube.com/watch?v=2KK_HMEx2BY',
        },
      ],
      options: close('c2-ansiedade'),
    },
    'c3-tristeza': ending('c3-tristeza', 'A tristeza pode pedir desaceleração e cuidado. Respeite seu ritmo hoje.'),
    'c4-irritacao': {
      id: 'c4-irritacao',
      kind: 'choice',
      text: 'A irritabilidade pode aparecer quando os limites foram ultrapassados por muito tempo. Faça uma pausa e realize respirações lentas.',
      exercise: 'breathing',
      options: close('c4-irritacao'),
    },
    'd1-identificacao': {
      id: 'd1-identificacao',
      kind: 'choice',
      text: 'Não saber exatamente o que está sentindo também pode acontecer.\n\nO que você percebe primeiro neste momento?',
      visuals: [
        {
          id: 'first-signal',
          src: flowVisuals.firstSignal,
          alt: 'Guia visual para perceber sinais no corpo, pensamentos, concentração ou dificuldade de identificar algo específico.',
        },
      ],
      options: [
        { id: 'body', label: 'Meu corpo parece cansado ou tenso.', next: 'd2-tensao' },
        { id: 'thoughts', label: 'Minha cabeça está cheia de pensamentos.', next: 'd3-cabeca-acelerada' },
        { id: 'focus', label: 'Estou com dificuldade de me concentrar.', next: 'd4-concentracao' },
        { id: 'nothing-specific', label: 'Não consigo identificar nada específico.', next: 'd5-sem-identificacao' },
      ],
    },
    'd2-tensao': ending('d2-tensao', 'Direcione a atenção para relaxar os ombros, a mandíbula e a respiração.'),
    'd3-cabeca-acelerada': ending(
      'd3-cabeca-acelerada',
      'Ancorar o foco na respiração pode ajudar a reduzir o fluxo de pensamentos dispersos.',
    ),
    'd4-concentracao': ending(
      'd4-concentracao',
      'Use seus sentidos para retornar ao presente: note o que vê, toca, escuta, cheira e sente.',
    ),
    'd5-sem-identificacao': ending(
      'd5-sem-identificacao',
      'Está tudo bem não saber nomear o momento. Permita-se alguns minutos de pausa e presença sem cobranças.',
    ),
  },
} satisfies GuidedFlow;
