import type { ChoiceFlowNode, FlowOption, GuidedFlow } from '../../domain/flow-engine/types';
import { flowVisuals } from './visuals';

const close = (nodeId: string): FlowOption[] => [
  {
    id: 'back-home',
    label: 'Por enquanto, isso foi suficiente.',
    next: nodeId,
    effects: [{ kind: 'end_flow', message: 'Tudo bem. Você pode retomar uma orientação quando quiser.' }],
  },
  {
    id: 'another-path',
    label: 'Quero escolher outro caminho.',
    next: nodeId,
    effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
  },
];

const ending = (id: string, text: string): ChoiceFlowNode => ({ id, kind: 'choice', text, options: close(id) });

export const documentFlows = [
  {
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
        videos: [
          {
            id: 'video-pausa-curta',
            title: 'Técnica de respiração seguindo figuras geométricas',
            url: 'https://www.youtube.com/watch?v=DgsLVZYN8Xg',
          },
        ],
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
        videos: [
          { id: 'video-irritacao', title: 'Respiração geométrica', url: 'https://www.youtube.com/watch?v=DgsLVZYN8Xg' },
        ],
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
  },
  {
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
  },
  {
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
        videos: [
          { id: 'mental-health', title: 'Vamos falar sobre saúde mental?', url: 'https://youtu.be/kuA2l7tXtE4' },
        ],
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
  },
  {
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
  },
  {
    id: 'post-flow-next-step',
    version: '2.0.0',
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
        text: 'O que você gostaria de fazer agora?',
        options: [
          {
            id: 'understand',
            label: 'Quero entender como estou me sentindo.',
            next: 'start',
            effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
          },
          {
            id: 'organize',
            label: 'Quero organizar o que estou vivendo.',
            next: 'start',
            effects: [{ kind: 'flow_start', flowId: 'orientation-organize-experience' }],
          },
          {
            id: 'care',
            label: 'Quero encontrar um próximo passo de cuidado.',
            next: 'start',
            effects: [{ kind: 'flow_start', flowId: 'orientation-next-care-step' }],
          },
          {
            id: 'calm',
            label: 'Preciso de um momento mais leve.',
            next: 'start',
            effects: [{ kind: 'flow_start', flowId: 'orientation-calm-moment' }],
          },
        ],
      },
    },
  },
] satisfies GuidedFlow[];
