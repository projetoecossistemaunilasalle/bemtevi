import type { ResourcesContent } from '../../domain/resources/types';
import { generatedResources } from './generated-resources';

const pendingReview = {
  status: 'pending_review',
  reviewedBy: null,
  reviewedAt: null,
  notes: '',
} as const;

const baseResources = [
  {
    id: 'teacher-emotional-regulation-classroom',
    title: 'Guia Prático de Regulação Emocional em Sala de Aula',
    source: 'FEEVALE',
    description:
      'Descubra estratégias práticas e acessíveis para lidar com a sobrecarga diária e gerenciar o estresse no ambiente escolar. Este material foi desenvolvido com foco no acolhimento e na preservação da saúde mental do professor.',
    imageUrl: '/bemtevi/hands_holding_plant.png',
    tags: ['regulação-emocional', 'sala-de-aula', 'professores'],
    audience: 'teachers',
    featuredImage: { kind: 'catalog', imageId: 'classroom-1' },
    body: [
      {
        id: 'overview',
        kind: 'paragraph',
        title: 'Sobre este material',
        text: 'Este conteúdo reúne orientações breves para reconhecer sinais de tensão, organizar pequenas pausas e retomar a rotina com mais presença. Ele não substitui atendimento profissional e não tem finalidade diagnóstica.',
      },
      {
        id: 'breathing-video',
        kind: 'video',
        title: 'Vídeo: pausa de respiração para professores',
        url: 'https://www.youtube.com/watch?v=kiEmbhvv7Fo',
      },
      {
        id: 'practice',
        kind: 'paragraph',
        title: 'Aplicação prática',
        text: 'Uma sugestão é reservar um momento curto antes ou depois da aula para uma pausa guiada. O professor pode adaptar a prática ao tempo disponível e ao contexto da turma.',
      },
      {
        id: 'source',
        kind: 'sourceLink',
        label: 'Acessar fonte original',
        url: 'https://www.feevale.br/',
      },
    ],
    review: pendingReview,
  },
  {
    id: 'teacher-caring-selfcare',
    title: 'Cartilha Cuidando do Professor: estratégias para o autocuidado',
    source: 'Fiocruz',
    description:
      'Estratégias práticas e acessíveis de autocuidado e preservação da saúde mental desenvolvidas para apoiar educadores no cotidiano.',
    imageUrl: '/bemtevi/hands_holding_plant.png',
    tags: ['autocuidado', 'professores', 'cartilha'],
    audience: 'teachers',
    featuredImage: { kind: 'catalog', imageId: 'classroom-2' },
    body: [
      {
        id: 'overview',
        kind: 'paragraph',
        title: 'Sobre a cartilha',
        text: 'Desenvolvida pela Fiocruz, esta publicação reúne orientações de autocuidado, pausas restaurativas e preservação da integridade emocional para profissionais da educação.',
      },
      {
        id: 'source',
        kind: 'sourceLink',
        label: 'Acessar Cartilha no Educare Fiocruz',
        url: 'https://educare.fiocruz.br/resource/show?id=XM3WMitO',
      },
    ],
    review: pendingReview,
  },
  {
    id: 'manejar-emocoes-crise',
    title: 'Cartilha: Como manejar as emoções em tempos de pandemia e crise',
    source: 'MDH / FBTC',
    description:
      'Orientações sobre regulação emocional, reconhecimento de sentimentos e enfrentamento saudável em períodos de crise e alta demanda.',
    imageUrl: '/bemtevi/hands_holding_plant.png',
    tags: ['emocoes', 'crise', 'cartilha'],
    audience: 'teachers',
    featuredImage: { kind: 'catalog', imageId: 'green-patch' },
    body: [
      {
        id: 'overview',
        kind: 'paragraph',
        title: 'Sobre a cartilha',
        text: 'Material elaborado pela Federação Brasileira de Terapias Cognitivas (FBTC) em parceria com o Ministério dos Direitos Humanos, com ferramentas práticas para lidar com emoções intensas como medo, ansiedade e tristeza.',
      },
      {
        id: 'source',
        kind: 'sourceLink',
        label: 'Acessar Cartilha (PDF)',
        url: 'https://www.gov.br/mdh/pt-br/assuntos/acolha-a-vida/cartilhas-fbtc-conteudos/9-como-manejar-as-emocoes-em-tempos-de-pandemia-e-crise.pdf/view',
      },
    ],
    review: pendingReview,
  },
  {
    id: 'cartilha-mindfulness',
    title: 'Cartilha sobre Mindfulness',
    source: 'MDH / Dr. Cristiano Nabuco',
    description:
      'Fundamentos e práticas breves de atenção plena para desacelerar o fluxo de pensamentos e restaurar a presença no momento presente.',
    imageUrl: '/bemtevi/hands_holding_plant.png',
    tags: ['mindfulness', 'atencao-plena', 'cartilha'],
    audience: 'teachers',
    featuredImage: { kind: 'catalog', imageId: 'classroom-1' },
    body: [
      {
        id: 'overview',
        kind: 'paragraph',
        title: 'Sobre a cartilha',
        text: 'Apresenta técnicas acessíveis de atenção plena conduzidas pelo Dr. Cristiano Nabuco, ensinando a direcionar a atenção com gentileza e sem julgamentos.',
      },
      {
        id: 'source',
        kind: 'sourceLink',
        label: 'Acessar Cartilha de Mindfulness (PDF)',
        url: 'https://www.gov.br/mdh/pt-br/assuntos/acolha-a-vida/cartilhas-fbtc-conteudos/10-mindfulness-dr-_cristiano_nabuco.pdf/view',
      },
    ],
    review: pendingReview,
  },
  {
    id: 'enfrentando-estresse',
    title: 'Cartilha: Enfrentando o Estresse e Protegendo a Família',
    source: 'MDH / FBTC / Dra. Marilda Lipp',
    description:
      'Identificação de sinais de estresse, fases do esgotamento e estratégias comportamentais para manejo da sobrecarga diária.',
    imageUrl: '/bemtevi/hands_holding_plant.png',
    tags: ['estresse', 'familia', 'cartilha'],
    audience: 'teachers',
    featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
    body: [
      {
        id: 'overview',
        kind: 'paragraph',
        title: 'Sobre a cartilha',
        text: 'Desenvolvida pela especialista Dra. Marilda Lipp, a cartilha ensina a reconhecer os sintomas físicos e emocionais do estresse e como estabelecer rotinas protetivas.',
      },
      {
        id: 'source',
        kind: 'sourceLink',
        label: 'Acessar Cartilha Enfrentando o Estresse (PDF)',
        url: 'https://www.gov.br/mdh/pt-br/assuntos/acolha-a-vida/cartilhas-fbtc-conteudos/2-enfrentando-o-estresse-e-protegendo-a-familia-marilda-lipp-corrigida.pdf/view',
      },
    ],
    review: pendingReview,
  },
  {
    id: 'estigma-preconceito-saude-mental',
    title: 'Cartilha: Preconceito e Estigma com a Doença Mental na Família',
    source: 'MDH / FBTC',
    description:
      'Informações educativas para desmistificar o sofrimento psíquico, combater o estigma e acolher quem passa por momentos difíceis.',
    imageUrl: '/bemtevi/hands_holding_plant.png',
    tags: ['estigma', 'apoio', 'cartilha'],
    audience: 'teachers',
    featuredImage: { kind: 'catalog', imageId: 'green-patch' },
    body: [
      {
        id: 'overview',
        kind: 'paragraph',
        title: 'Sobre a cartilha',
        text: 'Orientações claras para desconstruir preconceitos em torno da saúde mental e apoiar a busca por ajuda profissional sem julgamentos.',
      },
      {
        id: 'source',
        kind: 'sourceLink',
        label: 'Acessar Cartilha sobre Estigma (PDF)',
        url: 'https://www.gov.br/mdh/pt-br/assuntos/acolha-a-vida/cartilhas-fbtc-conteudos/6-preconceito-e-estigma-com-a-doenca-mental-na-familia.pdf/view',
      },
    ],
    review: pendingReview,
  },
  {
    id: 'promovendo-resiliencia',
    title: 'Cartilha: Promovendo a Resiliência em Famílias',
    source: 'MDH / FBTC',
    description:
      'Estratégias para cultivar recursos internos, resiliência emocional e enfrentamento positivo diante de adversidades.',
    imageUrl: '/bemtevi/hands_holding_plant.png',
    tags: ['resiliencia', 'autocuidado', 'cartilha'],
    audience: 'teachers',
    featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
    body: [
      {
        id: 'overview',
        kind: 'paragraph',
        title: 'Sobre a cartilha',
        text: 'Aborda a construção da resiliência como um processo contínuo de adaptação positiva em situações de estresse e adversidade.',
      },
      {
        id: 'source',
        kind: 'sourceLink',
        label: 'Acessar Cartilha de Resiliência (PDF)',
        url: 'https://www.gov.br/mdh/pt-br/assuntos/acolha-a-vida/cartilhas-fbtc-conteudos/8-promovendo-a-resiliencia-em-familias.pdf/view',
      },
    ],
    review: pendingReview,
  },
] satisfies ResourcesContent['resources'];

function mergeGeneratedResources() {
  const generatedById = new Map(generatedResources.map((resource) => [resource.id, resource]));
  const baseIds = new Set(baseResources.map((resource) => resource.id));
  const overriddenBaseResources = baseResources.map((resource) => generatedById.get(resource.id) ?? resource);
  const addedGeneratedResources = generatedResources.filter((resource) => !baseIds.has(resource.id));

  return [...overriddenBaseResources, ...addedGeneratedResources];
}

export const resourcesContent = {
  id: 'education-resources',
  version: '0.1.0',
  status: 'draft',
  locale: 'pt-BR',
  resources: mergeGeneratedResources(),
} satisfies ResourcesContent;

export const featuredOrientationResource = resourcesContent.resources[0];
