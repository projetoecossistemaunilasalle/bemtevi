import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { ServiceDirectoryEntry } from '../../domain/services/types';
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
  source: 'Equipe BemTeVi',
  description: 'Descrição.',
  tags: ['descanso'],
  audience: 'teachers',
  review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
  featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
};

const contact: ServiceDirectoryEntry = {
  id: 'canoas-caps-praca-brasil',
  name: 'CAPS II Praca Brasil',
  type: 'CAPS',
  badgeTone: 'primary',
  city: 'Canoas',
  state: 'RS',
  address: 'Av. Getulio Vargas, 7071 - Centro, Canoas - RS',
  phoneDisplay: '(51) 3236-1500',
  phoneHref: 'tel:5132361500',
  hours: 'Segunda a sexta, 08:00 - 18:00',
  notes: 'Atendimento por acolhimento.',
  review: {
    status: 'approved',
    reviewedBy: 'Equipe BemTeVi',
    reviewedAt: '2026-07-01T12:00:00.000Z',
    notes: 'Contato conferido com a rede municipal.',
  },
};

describe('buildExportBundle', () => {
  it('excludes unchanged shipped records', () => {
    const bundle = buildExportBundle({
      shipped: { flows: [flow], educationMaterials: [material], educationGroups: [], contacts: [contact] },
      drafts: { flows: [flow], educationMaterials: [material], educationGroups: [], contacts: [contact] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-05-22T00:00:00.000Z',
    });

    expect(bundle.changes.flows).toEqual([]);
    expect(bundle.changes.educationMaterials).toEqual([]);
    expect(bundle.changes.educationGroups).toEqual([]);
    expect(bundle.changes.contacts).toEqual([]);
    expect(bundle.changes.defaultGroupOrder).toBe(0);
    expect(bundle.changes.removedEducationGroupIds).toEqual([]);
    expect(bundle.changes.removedContactIds).toEqual([]);
  });

  it('exports complete changed records', () => {
    const changedFlow = { ...flow, title: 'Fluxo atualizado' };

    const bundle = buildExportBundle({
      shipped: { flows: [flow], educationMaterials: [material], educationGroups: [], contacts: [] },
      drafts: { flows: [changedFlow], educationMaterials: [], educationGroups: [], contacts: [] },
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
      shipped: { flows: [], educationMaterials: [material], educationGroups: [], contacts: [] },
      drafts: { flows: [], educationMaterials: [changedMaterial], educationGroups: [], contacts: [] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-06-05T00:00:00.000Z',
    });

    expect(bundle.changes.educationMaterials).toEqual([changedMaterial]);
  });

  it('excludes unchanged education groups from changes', () => {
    const group: EducationResourceGroup = { id: 'auto-cuidado', title: 'Autocuidado', order: 1 };

    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [group], contacts: [] },
      drafts: { flows: [], educationMaterials: [], educationGroups: [group], contacts: [] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-06-15T00:00:00.000Z',
    });

    expect(bundle.changes.educationGroups).toEqual([]);
  });

  it('exports education groups when they changed', () => {
    const shippedGroup: EducationResourceGroup = { id: 'auto-cuidado', title: 'Autocuidado', order: 1 };
    const changedGroup: EducationResourceGroup = { id: 'auto-cuidado', title: 'Autocuidado Alterado', order: 1 };

    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [shippedGroup], contacts: [] },
      drafts: { flows: [], educationMaterials: [], educationGroups: [changedGroup], contacts: [] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-06-15T00:00:00.000Z',
    });

    expect(bundle.changes.educationGroups).toEqual([changedGroup]);
  });

  it('exports removed education group IDs', () => {
    const shippedGroup: EducationResourceGroup = { id: 'auto-cuidado', title: 'Autocuidado', order: 1 };

    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [shippedGroup], contacts: [] },
      drafts: {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        contacts: [],
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

  it('exports removed education material IDs', () => {
    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [material], educationGroups: [], contacts: [] },
      drafts: {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        contacts: [],
        removedEducationMaterialIds: [material.id],
      },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-07-21T00:00:00.000Z',
    });

    expect(bundle.changes.educationMaterials).toEqual([]);
    expect(bundle.changes.removedEducationMaterialIds).toEqual([material.id]);
  });

  it('exports edited contacts as complete records', () => {
    const changedContact = { ...contact, name: 'CAPS II Centro' };

    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [], contacts: [contact] },
      drafts: { flows: [], educationMaterials: [], educationGroups: [], contacts: [changedContact] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-07-12T00:00:00.000Z',
    });

    expect(bundle.changes.contacts).toEqual([changedContact]);
  });

  it('compares duplicate contact IDs by occurrence', () => {
    const firstContact = { ...contact, name: 'CAPS primeiro' };
    const secondContact = { ...contact, name: 'CAPS segundo', address: 'Rua Dois, 200 - Canoas - RS' };
    const changedSecondContact = { ...secondContact, name: 'CAPS segundo editado' };

    const bundle = buildExportBundle({
      shipped: {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        contacts: [firstContact, secondContact],
      },
      drafts: {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        contacts: [firstContact, changedSecondContact],
      },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-07-12T00:00:00.000Z',
    });

    expect(bundle.changes.contacts).toEqual([changedSecondContact]);
  });

  it('exports extra same-ID occurrences as additions', () => {
    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [], contacts: [contact] },
      drafts: { flows: [], educationMaterials: [], educationGroups: [], contacts: [contact, contact] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-07-12T00:00:00.000Z',
    });

    expect(bundle.changes.contacts).toEqual([contact]);
  });

  it('exports added contacts as complete records', () => {
    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [], contacts: [] },
      drafts: { flows: [], educationMaterials: [], educationGroups: [], contacts: [contact] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-07-12T00:00:00.000Z',
    });

    expect(bundle.changes.contacts).toEqual([contact]);
  });

  it('exports removed contact IDs', () => {
    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [], contacts: [contact] },
      drafts: {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        contacts: [],
        removedContactIds: [contact.id],
      },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-07-12T00:00:00.000Z',
    });

    expect(bundle.changes.contacts).toEqual([]);
    expect(bundle.changes.removedContactIds).toEqual([contact.id]);
  });

  it('exports with schema version 3.0.0', () => {
    const bundle = buildExportBundle({
      shipped: { flows: [], educationMaterials: [], educationGroups: [], contacts: [] },
      drafts: { flows: [], educationMaterials: [], educationGroups: [], contacts: [] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-06-15T00:00:00.000Z',
    });

    expect(bundle.schemaVersion).toBe('3.0.0');
    expect(DASHBOARD_EXPORT_SCHEMA_VERSION).toBe('3.0.0');
  });
});
