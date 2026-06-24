import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import { buildExportBundle, DASHBOARD_EXPORT_SCHEMA_VERSION } from '../export/exportBundle';

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
      drafts: { flows: [flow], educationMaterials: [material], educationGroups: [] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-05-22T00:00:00.000Z',
    });

    expect(bundle.changes.flows).toEqual([]);
    expect(bundle.changes.educationMaterials).toEqual([]);
    expect(bundle.changes.educationGroups).toEqual([]);
    expect(bundle.changes.defaultGroupOrder).toBe(0);
    expect(bundle.changes.removedEducationGroupIds).toEqual([]);
  });

  it('exports complete changed records', () => {
    const changedFlow = { ...flow, title: 'Fluxo atualizado' };

    const bundle = buildExportBundle({
      shipped: { flows: [flow], educationMaterials: [material], educationGroups: [] },
      drafts: { flows: [changedFlow], educationMaterials: [], educationGroups: [] },
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
      drafts: { flows: [], educationMaterials: [changedMaterial], educationGroups: [] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-06-05T00:00:00.000Z',
    });

    expect(bundle.changes.educationMaterials).toEqual([changedMaterial]);
  });

  it('excludes unchanged education groups from changes', () => {
    const group: EducationResourceGroup = { id: 'auto-cuidado', title: 'Autocuidado', order: 1 };

    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [group] },
      drafts: { flows: [], educationMaterials: [], educationGroups: [group] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-06-15T00:00:00.000Z',
    });

    expect(bundle.changes.educationGroups).toEqual([]);
  });

  it('exports education groups when they changed', () => {
    const shippedGroup: EducationResourceGroup = { id: 'auto-cuidado', title: 'Autocuidado', order: 1 };
    const changedGroup: EducationResourceGroup = { id: 'auto-cuidado', title: 'Autocuidado Alterado', order: 1 };

    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [shippedGroup] },
      drafts: { flows: [], educationMaterials: [], educationGroups: [changedGroup] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-06-15T00:00:00.000Z',
    });

    expect(bundle.changes.educationGroups).toEqual([changedGroup]);
  });

  it('exports removed education group IDs', () => {
    const shippedGroup: EducationResourceGroup = { id: 'auto-cuidado', title: 'Autocuidado', order: 1 };

    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [shippedGroup] },
      drafts: {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        defaultGroupOrder: 2,
        removedEducationGroupIds: ['auto-cuidado'],
      },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-06-15T00:00:00.000Z',
    });

    expect(bundle.changes.educationGroups).toEqual([]);
    expect(bundle.changes.defaultGroupOrder).toBe(2);
    expect(bundle.changes.removedEducationGroupIds).toEqual(['auto-cuidado']);
  });

  it('exports with schema version 2.0.0', () => {
    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [] },
      drafts: { flows: [], educationMaterials: [], educationGroups: [] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-06-15T00:00:00.000Z',
    });

    expect(bundle.schemaVersion).toBe('2.0.0');
    expect(DASHBOARD_EXPORT_SCHEMA_VERSION).toBe('2.0.0');
  });
});
