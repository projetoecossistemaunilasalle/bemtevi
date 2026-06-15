import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import { buildExportBundle } from '../export/exportBundle';

const flow: GuidedFlow = {
  id: 'flow-one',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo um',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'start', enteringPhrases: ['Começar'], transitionMessage: 'Olá.' },
  nodes: { start: { id: 'start', kind: 'result', text: 'Resultado.' } },
};

const material: EducationResource = {
  id: 'material-one',
  title: 'Material um',
  source: 'Equipe SeCuida',
  description: 'Descrição.',
  tags: ['descanso'],
  audience: 'teachers',
  review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
  featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
};

describe('buildExportBundle', () => {
  it('excludes unchanged shipped records', () => {
    const bundle = buildExportBundle({
      shipped: { flows: [flow], educationMaterials: [material], educationGroups: [] },
      drafts: { flows: [flow], educationMaterials: [material] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-05-22T00:00:00.000Z',
    });

    expect(bundle.changes.flows).toEqual([]);
    expect(bundle.changes.educationMaterials).toEqual([]);
  });

  it('exports complete changed records', () => {
    const changedFlow = { ...flow, title: 'Fluxo atualizado' };

    const bundle = buildExportBundle({
      shipped: { flows: [flow], educationMaterials: [material], educationGroups: [] },
      drafts: { flows: [changedFlow], educationMaterials: [] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-05-22T00:00:00.000Z',
    });

    expect(bundle.changes.flows).toEqual([changedFlow]);
  });

  it('exports changed education materials with featured image and body blocks', () => {
    const changedMaterial: EducationResource = {
      ...material,
      featuredImage: { kind: 'external', imageUrl: 'https://example.com/main.jpg' },
      body: [{ id: 'overview', kind: 'paragraph', title: 'Sobre', text: 'Texto revisado.' }],
    };

    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [material], educationGroups: [] },
      drafts: { flows: [], educationMaterials: [changedMaterial] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-06-05T00:00:00.000Z',
    });

    expect(bundle.changes.educationMaterials).toEqual([changedMaterial]);
  });
});
