import type { HomeCopy } from '../../domain/copy/types';

export const homeCopy = {
  id: 'home-copy',
  version: '0.1.0',
  status: 'draft',
  locale: 'pt-BR',
  title: 'Como você está hoje?',
  subtitle: 'Um espaço de orientação emocional para educadores, feito para acolher, informar e conectar sem identificar você.',
  privacyReassurance: 'Este é um espaço seguro. O SeCuida não pede login, CPF, e-mail ou escola. O que você fizer aqui não é salvo entre sessões.',
  actions: [
    {
      id: 'immediate-support',
      label: 'Preciso de acolhimento agora',
      description: 'Acesse contatos imediatos e um primeiro cuidado de regulação.',
    },
    {
      id: 'guided-orientation',
      label: 'Preciso de orientação',
      description: 'Converse por um fluxo guiado para organizar o que você sente.',
    },
    {
      id: 'professional-support',
      label: 'Ver rede de apoio local',
      description: 'Encontre serviços de apoio profissional e comunitário.',
    },
  ],
} satisfies HomeCopy;
