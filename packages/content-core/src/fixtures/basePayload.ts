import type { PublishedContentPayload } from '../model/publishedContent';
import type { EducationResource } from '../model/resources';
import type { GuidedFlow } from '../model/flowTypes';

/**
 * Deterministic base payload and constants for the MERGE-02 conformance
 * fixtures (dossier 14): every editable field, every unsettable field and both
 * retained top-level image slots are covered.
 */
const fixtureFlow: GuidedFlow = {
  id: 'fluxo-exemplo',
  version: '1',
  locale: 'pt-BR',
  title: 'Fluxo de exemplo',
  type: 'guided_conversation',
  purpose: 'orientation_entry',
  status: 'approved',
  entry: { nodeId: 'no-um', enteringPhrases: ['estou sobrecarregado'], transitionMessage: 'Vamos respirar juntos.' },
  nodes: {
    'no-um': {
      id: 'no-um',
      kind: 'choice',
      text: 'Como você está hoje?',
      visuals: [
        { id: 'visual-um', alt: 'Pessoa respirando calmamente', src: 'https://exemplo.bemtevi.org/visual.png' },
      ],
      videos: [{ id: 'video-um', title: 'Respiração guiada', url: 'https://www.youtube.com/watch?v=abc12345678' }],
      options: [{ id: 'opcao-um', label: 'Preciso de apoio', next: 'no-dois' }],
    },
    'no-dois': {
      id: 'no-dois',
      kind: 'result',
      text: 'Você não está sozinho.',
      recommendations: ['Respire fundo por um minuto.'],
    },
  },
  nodeOrder: ['no-um', 'no-dois'],
};

const fixtureMaterial: EducationResource = {
  id: 'material-exemplo',
  title: 'Material de exemplo',
  source: 'BemTeVi',
  description: 'Descrição do material de exemplo.',
  imageUrl: 'https://exemplo.bemtevi.org/legado.png',
  imageFileName: 'legado.png',
  featuredImage: { kind: 'catalog', imageId: 'classroom-1' },
  tags: ['saude', 'respiracao'],
  audience: 'teachers',
  body: [
    { id: 'bloco-texto', kind: 'paragraph', text: 'Parágrafo introdutório.' },
    { id: 'bloco-imagem', kind: 'image', imageUrl: 'https://exemplo.bemtevi.org/corpo.png', alt: 'Imagem do corpo' },
  ],
  embed: { provider: 'youtube', url: 'https://www.youtube.com/embed/abc12345678' },
  href: '/educacao/material-exemplo',
  group: 'grupo-um',
  groupOrder: 1,
  review: { status: 'approved', reviewedBy: null, reviewedAt: null, notes: '' },
};

export const conformanceBasePayload: PublishedContentPayload = {
  flows: [JSON.parse(JSON.stringify(fixtureFlow)) as GuidedFlow],
  educationMaterials: [JSON.parse(JSON.stringify(fixtureMaterial)) as EducationResource],
  educationGroups: [
    { id: 'grupo-um', title: 'Grupo um', description: 'Primeiro grupo.', order: 1 },
    { id: 'grupo-dois', title: 'Grupo dois', order: 2 },
  ],
  contacts: [
    {
      id: 'contato-um',
      name: 'CVV',
      type: 'apoio',
      badgeTone: 'primary',
      city: 'Curitiba',
      state: 'PR',
      locationId: 'local-um',
      address: 'Rua de exemplo, 123',
      phoneDisplay: '(41) 3000-0000',
      phoneHref: 'tel:+554130000000',
      hours: '24 horas',
      notes: 'Ligue 188.',
      lat: -25.43,
      lng: -49.27,
      review: { status: 'approved', reviewedBy: null, reviewedAt: null, notes: '' },
    },
  ],
  locations: [{ id: 'local-um', city: 'Curitiba', state: 'PR' }],
  defaultGroupOrder: 1,
};

/** 1x1 transparent PNG used for uploaded image actions. */
export const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export const FIXTURE_EXPORT_ID = '00000000-0000-4000-8000-000000000001';
export const FIXTURE_BASE_GENERATION = 7;
export const FIXTURE_BASE_DIGEST = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
