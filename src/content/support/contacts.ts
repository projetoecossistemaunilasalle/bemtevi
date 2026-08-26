import type { SupportContactsContent } from '../../domain/support/types';

const pendingReview = {
  status: 'pending_review',
  reviewedBy: null,
  reviewedAt: null,
  notes: '',
} as const;

export const healthcareServiceGuidance = [
  {
    id: 'guidance-ubs',
    title: 'UBS — Unidade Básica de Saúde',
    badge: 'Acompanhamento',
    description:
      'Para acompanhamento de rotina e situações de sofrimento psíquico leve ou moderado, como ansiedade, tristeza persistente, insônia ou dificuldades que estejam afetando seu dia a dia.',
  },
  {
    id: 'guidance-caps',
    title: 'CAPS — Centro de Atenção Psicossocial',
    badge: 'Especializado',
    description:
      'Para situações de sofrimento psíquico intenso e persistente ou transtornos mentais graves. O acesso pode ocorrer por demanda espontânea ou encaminhamento, conforme a organização da rede local.',
  },
  {
    id: 'guidance-upa',
    title: 'Pronto-socorro / UPA',
    badge: 'Urgência 24h',
    description: 'Para situações de urgência ou crise que necessitem de atendimento imediato.',
  },
];

export const supportContacts = {
  id: 'support-contacts',
  version: '0.1.0',
  status: 'draft',
  locale: 'pt-BR',
  title: 'Você pode buscar apoio',
  description:
    'Se você está passando por um momento difícil, existem diferentes formas de buscar ajuda. Escolha a opção que mais faz sentido para você.',
  contacts: [
    {
      id: 'support-cvv',
      name: 'CVV (Centro de Valorização da Vida)',
      phoneDisplay: '188',
      phoneHref: 'tel:188',
      description: 'Atendimento gratuito, 24 horas e sigiloso para apoio emocional e prevenção do suicídio.',
      review: pendingReview,
    },
    {
      id: 'support-samu',
      name: 'SAMU',
      phoneDisplay: '192',
      phoneHref: 'tel:192',
      description: 'Para emergências que necessitem de atendimento médico imediato.',
      review: pendingReview,
    },
    {
      id: 'support-disque-saude',
      name: 'Disque Saúde',
      phoneDisplay: '136',
      phoneHref: 'tel:136',
      description: 'Para informações e orientações sobre serviços e cuidados de saúde.',
      review: pendingReview,
    },
  ],
} satisfies SupportContactsContent;
