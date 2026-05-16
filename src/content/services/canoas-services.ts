import type { ServicesContent } from '../../domain/services/types';

const pendingReview = {
  status: 'pending_review',
  reviewedBy: null,
  reviewedAt: null,
  notes: '',
} as const;

export const canoasServices = {
  id: 'canoas-services',
  version: '0.1.0',
  status: 'draft',
  locale: 'pt-BR',
  title: 'Rede de apoio em Canoas',
  description: 'Encontre centros de atendimento e suporte próximos a você.',
  services: [
    {
      id: 'canoas-caps-praca-brasil',
      name: 'CAPS II Praça Brasil',
      type: 'CAPS',
      badgeTone: 'primary',
      city: 'Canoas',
      state: 'RS',
      address: 'Av. Getúlio Vargas, 7071 - Centro, Canoas - RS',
      phoneDisplay: '(51) 3236-1500',
      phoneHref: 'tel:5132361500',
      hours: 'Segunda a Sexta, 08:00 - 18:00',
      review: pendingReview,
    },
    {
      id: 'canoas-ubs-centro',
      name: 'UBS Centro de Saúde',
      type: 'UBS',
      badgeTone: 'secondary',
      city: 'Canoas',
      state: 'RS',
      address: 'Rua Quinze de Janeiro, 123 - Centro, Canoas - RS',
      phoneDisplay: '(51) 3462-1600',
      phoneHref: 'tel:5134621600',
      hours: 'Segunda a Sexta, 07:30 - 17:00',
      review: pendingReview,
    },
    {
      id: 'canoas-ulbra-clinica-psicologia',
      name: 'Clínica Escola de Psicologia - Ulbra',
      type: 'UNIVERSIDADE',
      badgeTone: 'neutral',
      city: 'Canoas',
      state: 'RS',
      address: 'Av. Farroupilha, 8001 - São José, Canoas - RS',
      phoneDisplay: '(51) 3477-9200',
      phoneHref: 'tel:5134779200',
      notes: 'Mediante agendamento prévio',
      review: pendingReview,
    },
  ],
} satisfies ServicesContent;
