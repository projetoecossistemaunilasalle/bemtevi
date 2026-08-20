import type { HomeCopy } from '../../domain/copy/types';

export const homeCopy = {
  id: 'home-copy',
  version: '0.1.0',
  status: 'draft',
  locale: 'pt-BR',
  greeting: 'Que bom ter você aqui!',
  subtitle: 'Uma ferramenta de educação em saúde mental para professores.',
  educationalDisclaimer:
    'As informações têm caráter educativo e preventivo e não substituem acompanhamento profissional.',
  privacyReassurance:
    'Este é um espaço seguro. O BemTeVi não pede login, CPF, e-mail, nome ou escola. Suas conversas e respostas não ficam guardadas entre sessões. O navegador lembra apenas que você já viu a apresentação.',
  actions: [
    {
      id: 'immediate-support',
      label: 'Qual serviço de saúde posso acessar?',
      description: 'Consulte canais de apoio e escolha onde buscar atendimento.',
    },
    {
      id: 'guided-orientation',
      label: 'Quero entender como estou',
      description: 'Responda a algumas perguntas e receba uma orientação inicial.',
    },
    {
      id: 'professional-support',
      label: 'Buscar um serviço de saúde',
      description: 'Veja contatos para buscar atendimento profissional e comunitário.',
    },
  ],
} satisfies HomeCopy;
