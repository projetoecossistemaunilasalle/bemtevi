import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { PublishedContentContext } from '../../../app/content/PublishedContentContext';
import { getBundledContent } from '../../../app/content/bundledContent';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';

export function shippedEducationMaterials() {
  return getBundledContent().educationMaterials;
}

export function firstShippedMaterial() {
  const resource = shippedEducationMaterials()[0];
  if (!resource) throw new Error('Expected at least one shipped education material.');
  return resource;
}

function buildContentValue(payload: PublishedContentPayload) {
  const snapshot = {
    schemaVersion: '1.0.0',
    revision: 1,
    payload,
    publishedAt: '2026-07-15T00:00:00.000Z',
    publishedBy: 'admin',
  } as const;
  return {
    content: payload,
    snapshot,
    source: 'database' as const,
    status: 'ready' as const,
    loadError: null,
    refresh: async () => {},
    publish: async () => snapshot,
  };
}

export function renderWithContent(ui: ReactElement, payload: PublishedContentPayload = getBundledContent()) {
  return render(
    <PublishedContentContext.Provider value={buildContentValue(payload)}>{ui}</PublishedContentContext.Provider>,
  );
}

export function contentWithoutEducation(): PublishedContentPayload {
  return { ...getBundledContent(), educationMaterials: [], educationGroups: [] };
}

export function buildDatabaseEducationPayload(): PublishedContentPayload {
  const bundled = getBundledContent();
  const dbResource = {
    ...bundled.educationMaterials[0],
    id: 'db-recurso',
    title: 'Recurso do Banco de Dados',
    group: 'db-grupo',
  };
  const dbGroup = { id: 'db-grupo', title: 'Grupo do Banco de Dados', order: 1 };
  return {
    ...bundled,
    educationMaterials: [...bundled.educationMaterials, dbResource],
    educationGroups: [...bundled.educationGroups, dbGroup],
  };
}

/** LEGACY-00: bytes that once drove the public localStorage draft preview. */
export function seedLegacyDashboardDraftBytes(): void {
  localStorage.setItem(
    'bemtevi:dev-dashboard:drafts:v1',
    JSON.stringify({
      schemaVersion: '2.0.0',
      flowPatches: [],
      educationMaterialPatches: [],
      groupPatches: [],
      addedFlows: [],
      addedEducationMaterials: [
        {
          id: 'preview-added-material',
          title: 'Material adicionado em teste',
          source: 'BemTeVi',
          description: 'Não deve aparecer na tela pública.',
          tags: ['preview'],
          audience: 'teachers',
          review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
        },
      ],
      addedGroups: [{ id: 'unused-group', title: 'Grupo sem recursos', order: 10 }],
      updatedAt: '2026-06-05T00:00:00.000Z',
    }),
  );
}
