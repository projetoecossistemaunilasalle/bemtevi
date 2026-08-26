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
          {
            id: 'overload',
            label: 'Tenho me sentido sobrecarregado(a).',
            next: 'a1-sobrecarga',
          },
          {
            id: 'rest',
            label: 'Tenho me sentido cansado(a) e preciso descansar.',
            next: 'b1-cansaco',
          },
          {
            id: 'emotions',
            label: 'Tenho percebido emoções difíceis de lidar.',
            next: 'c1-emocoes',
          },
          {
            id: 'identify',
            label: 'Não sei bem o que estou sentindo.',
            next: 'd1-identificacao',
          },
          {
            id: 'who5',
            label: 'Quero ter uma visão breve de como está meu bem-estar.',
            next: 'handoff-who5',
            effects: [{ kind: 'flow_start', flowId: 'who5' }],
          },
        ],
      },
      'handoff-who5': {
        id: 'handoff-who5',
        kind: 'result',
        text: 'Vou abrir o questionário breve de bem-estar WHO-5.',
      },

      // CAMINHO A — SOBRECARGA
      'a1-sobrecarga': {
        id: 'a1-sobrecarga',
        kind: 'choice',
        text: 'Quando muitas demandas se acumulam, pode parecer que tudo precisa ser resolvido ao mesmo tempo. Em períodos de maior pressão ou mudanças, essa sensação pode ficar ainda mais intensa.\n\nO que mais tem pesado para você neste momento?',
        options: [
          {
            id: 'a1-opt1',
            label: 'Sinto que tenho coisas demais para resolver.',
            next: 'a2-prioridades',
          },
          {
            id: 'a1-opt2',
            label: 'Tenho dificuldade de estabelecer prioridades.',
            next: 'a2-prioridades',
          },
          {
            id: 'a1-opt3',
            label: 'Estou tentando dar conta de tudo ao mesmo tempo.',
            next: 'a2-prioridades',
          },
        ],
      },
      'a2-prioridades': {
        id: 'a2-prioridades',
        kind: 'result',
        text: 'Quando tudo parece urgente, pode ser difícil saber por onde começar. Nem tudo precisa ser resolvido agora. Organizar as demandas pode ajudar a perceber o que precisa da sua atenção neste momento e o que pode esperar.\n\nO vídeo abaixo apresenta uma forma simples de olhar para essas prioridades.',
        videos: [
          {
            id: 'video-prioridades',
            title: 'COMO ESTABELECER PRIORIDADES | Psicóloga Cynthia Manenti',
            url: 'https://www.youtube.com/watch?v=NRAsKCcty9Q',
          },
        ],
      },

      // CAMINHO B — CANSAÇO E DESCANSO
      'b1-cansaco': {
        id: 'b1-cansaco',
        kind: 'choice',
        text: 'O cansaço pode aparecer quando o corpo e a mente estão sendo exigidos por muito tempo. Descansar não significa necessariamente parar tudo. Às vezes, pequenas pausas também podem contribuir para a recuperação.\n\nQue tipo de descanso parece mais possível para você agora?',
        options: [
          {
            id: 'b1-opt1',
            label: 'Fazer uma pausa curta.',
            next: 'b2-pausa-curta',
          },
          {
            id: 'b1-opt2',
            label: 'Afastar-me um pouco das demandas.',
            next: 'b3-espaco-descanso',
          },
          {
            id: 'b1-opt3',
            label: 'Não sei do que preciso agora.',
            next: 'b4-dificil-saber',
          },
        ],
      },
      'b2-pausa-curta': {
        id: 'b2-pausa-curta',
        kind: 'result',
        text: 'Uma pausa curta pode ser suficiente para interromper, por alguns instantes, o ritmo das demandas.\n\nVocê pode experimentar uma prática breve de respiração, grounding ou pausa guiada.',
        videos: [
          {
            id: 'video-respiracao-geometrica-b2',
            title: 'Técnica de respiração seguindo as figuras geométricas (1 minuto e 50 segundos)',
            url: 'https://www.youtube.com/watch?v=DgsLVZYN8Xg',
          },
        ],
      },
      'b3-espaco-descanso': {
        id: 'b3-espaco-descanso',
        kind: 'result',
        text: 'Às vezes, descansar também envolve criar uma pequena distância das demandas. Se for possível, permita-se alguns minutos sem precisar resolver, organizar ou responder nada.',
        videos: [
          {
            id: 'video-relaxamento-respiracao',
            title: 'A técnica mais simples e eficaz de relaxamento respiração - Dr. Paulo Mendes Jr.',
            url: 'https://www.youtube.com/watch?v=kiEmbhvv7Fo',
          },
        ],
      },
      'b4-dificil-saber': {
        id: 'b4-dificil-saber',
        kind: 'result',
        text: 'Nem sempre é fácil perceber do que precisamos quando estamos cansados. Quando o esgotamento é alto, o cérebro tem dificuldade de processar escolhas. Em vez de buscar uma solução agora, experimente a prática STOP de Atenção Plena:\n\n• S (Stop): Pare o que está fazendo por 1 minuto.\n• T (Take a breath): Respire fundo, sentindo o ar entrar e sair.\n• O (Observe): Note como seu corpo está apoiado na cadeira ou no chão, sem julgar.\n• P (Proceed): Volte para sua rotina dando um passo de cada vez.',
        recommendations: ['teacher-caring-selfcare'],
      },

      // CAMINHO C — EMOÇÕES
      'c1-emocoes': {
        id: 'c1-emocoes',
        kind: 'choice',
        text: 'Algumas emoções podem ficar mais presentes em períodos de pressão, mudanças ou situações difíceis. Antes de tentar resolver o que está acontecendo, pode ser útil reconhecer o que está mais presente.\n\nQual destas situações se aproxima mais do que você está vivendo?',
        options: [
          {
            id: 'c1-opt1',
            label: 'Tenho ficado mais ansioso(a) ou preocupado(a).',
            next: 'c2-ansiedade',
          },
          {
            id: 'c1-opt2',
            label: 'Tenho me sentido triste ou desanimado(a).',
            next: 'c3-tristeza',
          },
          {
            id: 'c1-opt3',
            label: 'Tenho ficado irritado(a) ou impaciente.',
            next: 'c4-irritacao',
          },
          {
            id: 'c1-opt4',
            label: 'Ainda tenho dificuldade para entender o que sinto.',
            next: 'd1-identificacao',
          },
        ],
      },
      'c2-ansiedade': {
        id: 'c2-ansiedade',
        kind: 'result',
        text: 'A ansiedade prepara o corpo para reagir a ameaças, acelerando pensamentos e batimentos. Regular o ritmo respiratório envia sinais de segurança ao cérebro.',
        videos: [
          {
            id: 'video-ansiedade-drauzio',
            title: 'Como controlar uma crise de ansiedade - Dr. Drauzio Varella',
            url: 'https://www.youtube.com/watch?v=8YG8HABY25w',
          },
          {
            id: 'video-respiracao-ansiedade-2min',
            title: 'Técnica de Respiração para ansiedade (2 minutos)',
            url: 'https://www.youtube.com/watch?v=2KK_HMEx2BY',
          },
        ],
      },
      'c3-tristeza': {
        id: 'c3-tristeza',
        kind: 'result',
        text: 'A tristeza sinaliza a necessidade de desacelerar para processar perdas ou momentos exigentes. Reduza as cobranças internas e respeite seu ritmo hoje.',
        recommendations: ['manejar-emocoes-crise'],
      },
      'c4-irritacao': {
        id: 'c4-irritacao',
        kind: 'result',
        text: 'A irritabilidade costuma surgir quando nossos limites foram ultrapassados por muito tempo. Faça uma pausa e realize respirações lentas para reduzir a tensão corporal imediata.',
        videos: [
          {
            id: 'video-respiracao-geometrica-c4',
            title: 'Técnica de respiração seguindo as figuras geométricas (1 minuto e 50 segundos)',
            url: 'https://www.youtube.com/watch?v=DgsLVZYN8Xg',
          },
        ],
      },

      // CAMINHO D — NÃO SEI BEM O QUE ESTOU SENTINDO
      'd1-identificacao': {
        id: 'd1-identificacao',
        kind: 'choice',
        text: 'Não saber exatamente o que está sentindo também pode acontecer. Às vezes, começar percebendo o corpo, os pensamentos ou a atenção pode ajudar.\n\nO que você percebe primeiro neste momento?',
        options: [
          {
            id: 'd1-opt1',
            label: 'Meu corpo parece cansado ou tenso.',
            next: 'd2-tensao',
          },
          {
            id: 'd1-opt2',
            label: 'Minha cabeça está cheia de pensamentos.',
            next: 'd3-cabeca-acelerada',
          },
          {
            id: 'd1-opt3',
            label: 'Estou com dificuldade de me concentrar.',
            next: 'd4-concentracao',
          },
          {
            id: 'd1-opt4',
            label: 'Não consigo identificar nada específico.',
            next: 'd5-sem-identificacao',
          },
        ],
      },
      'd2-tensao': {
        id: 'd2-tensao',
        kind: 'result',
        text: 'Direcione a atenção para relaxar os ombros, a mandíbula e a respiração.',
        videos: [
          {
            id: 'video-relaxamento-tensao',
            title: 'A técnica mais simples e eficaz de relaxamento respiração - Dr. Paulo Mendes Jr.',
            url: 'https://www.youtube.com/watch?v=kiEmbhvv7Fo',
          },
        ],
      },
      'd3-cabeca-acelerada': {
        id: 'd3-cabeca-acelerada',
        kind: 'result',
        text: 'Ancorar o foco na respiração ajuda a reduzir o fluxo de pensamentos dispersos.',
        videos: [
          {
            id: 'video-respiracao-cabeca-acelerada',
            title: 'Técnica de Respiração para ansiedade (2 minutos)',
            url: 'https://www.youtube.com/watch?v=2KK_HMEx2BY',
          },
        ],
      },
      'd4-concentracao': {
        id: 'd4-concentracao',
        kind: 'result',
        text: 'Use seus sentidos para retornar ao presente:\n\n• Olhe ao redor e note 5 coisas visíveis.\n• Toque 4 objetos perto de você.\n• Identifique 3 sons no ambiente.\n• Perceba 2 aromas.\n• Note 1 sabor na boca.',
      },
      'd5-sem-identificacao': {
        id: 'd5-sem-identificacao',
        kind: 'result',
        text: 'Está tudo bem não saber nomear o momento. Permita-se apenas alguns minutos de pausa e presença sem cobranças.',
        recommendations: ['cartilha-mindfulness'],
      },
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
            id: 'who5-check',
            label: 'Um questionário de bem-estar',
            next: 'handoff-who5',
            effects: [{ kind: 'flow_start', flowId: 'who5' }],
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
      'handoff-who5': { id: 'handoff-who5', kind: 'result', text: 'Vou abrir o questionário WHO-5.' },
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
