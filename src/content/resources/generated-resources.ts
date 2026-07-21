import type { EducationResource } from '../../domain/resources/types';

export const generatedResources = [
  {
    id: 'teacher-emotional-regulation-classroom',
    title: 'Guia de Regulação Emocional',
    source: 'FEEVALE',
    description: 'Estratégias de suporte para apoiar o professor no cuidado pessoal com a sua saúde mental.',
    imageUrl: '/bemtevi/hands_holding_plant.png',
    tags: ['regulação-emocional', 'respiração', 'professores'],
    audience: 'teachers',
    featuredImage: { kind: 'catalog', imageId: 'respiracao-1' },
    body: [
      {
        id: 'overview',
        kind: 'paragraph',
        title: 'Sobre este material',
        text: 'Este conteúdo reúne orientações breves para reconhecer sinais de desconforto emocional, organizar pequenas pausas e retomar a rotina com mais presença. É um material informativo e sem finalidade diagnóstica, portanto, não substitui o atendimento especializado com profissional.',
      },
      {
        id: 'breathing-video',
        kind: 'video',
        title: 'Vídeo: Técnica de respiração',
        url: 'https://www.youtube.com/watch?v=kiEmbhvv7Fo',
      },
      {
        id: 'respiracao-image-1',
        kind: 'image',
        imageUrl: '/bemtevi/respiracao1.jpg',
        alt: 'Exercício de respiração passo 1.',
      },
      {
        id: 'respiracao-image-2',
        kind: 'image',
        imageUrl: '/bemtevi/respiracao2.jpg',
        alt: 'Exercício de respiração passo 2.',
      },
      {
        id: 'practice',
        kind: 'paragraph',
        title: 'Aplicação prática',
        text: 'Recomendamos reservar um tempo adequado da sua rotina para esta prática. Você pode adaptar o tempo da prática de acordo com o contexto em que está inserido no momento.',
      },
      {
        id: 'source',
        kind: 'sourceLink',
        label: 'FEEVALE',
        url: 'https://www.feevale.br/',
      },
    ],
    review: {
      status: 'pending_review',
      reviewedBy: null,
      reviewedAt: null,
      notes: '',
    },
  },
] satisfies EducationResource[];
