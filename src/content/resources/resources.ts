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
    imageUrl: '/hands_holding_plant.png',
    tags: ['regulação-emocional', 'sala-de-aula', 'professores'],
    audience: 'teachers',
    featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
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
