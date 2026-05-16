import type { SupportContactsContent } from '../../domain/support/types';

const pendingReview = {
  status: 'pending_review',
  reviewedBy: null,
  reviewedAt: null,
  notes: '',
} as const;

export const supportContacts = {
  id: 'support-contacts',
  version: '0.1.0',
  status: 'draft',
  locale: 'pt-BR',
  title: 'Você não está sozinho(a).',
  description: 'Se você estiver em sofrimento agora, estas pessoas podem te ajudar.',
  contacts: [
    {
      id: 'support-cvv',
      name: 'CVV',
      phoneDisplay: '188',
      phoneHref: 'tel:188',
      description: 'Centro de Valorização da Vida. Atendimento 24h, gratuito e sigiloso para apoio emocional e prevenção ao suicídio.',
      review: pendingReview,
    },
    {
      id: 'support-samu',
      name: 'SAMU',
      phoneDisplay: '192',
      phoneHref: 'tel:192',
      description: 'Serviço de Atendimento Móvel de Urgência. Para emergências médicas que necessitem de intervenção imediata.',
      review: pendingReview,
    },
    {
      id: 'support-bombeiros',
      name: 'Bombeiros',
      phoneDisplay: '193',
      phoneHref: 'tel:193',
      description: 'Corpo de Bombeiros. Para resgates, tentativas de suicídio em andamento ou situações de risco iminente à vida.',
      review: pendingReview,
    },
  ],
} satisfies SupportContactsContent;
