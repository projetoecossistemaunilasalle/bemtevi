import type { PublishedContentPayload } from '../app/content/publishedContent';
import { defaultFeaturedImageId } from '../content/resources/featuredImages';
import type { EducationResourceGroup } from '../content/resources/groups';
import type { DashboardRecordPatch } from './draft-storage/dashboardStorage';
import type { DashboardShippedContent } from './content/shippedContent';

export type DashboardRecordOrigin =
  | { kind: 'shipped'; sourceIndex: number; id: string }
  | { kind: 'added'; addedIndex: number; id: string };

export function upsertPatchById<T extends { id: string }>(
  records: Array<DashboardRecordPatch<T>>,
  id: string,
  sourceIndex: number,
  patch: Partial<T>,
  sourceIdUnique?: boolean,
) {
  const existingIndex = records.findIndex((record) => record.id === id && record.sourceIndex === sourceIndex);
  const sameIdIndexes = records.flatMap((record, index) => (record.id === id ? [index] : []));
  const rebaseIndex =
    existingIndex === -1 &&
    sameIdIndexes.length === 1 &&
    (sourceIdUnique === true || (sourceIdUnique === undefined && records[sameIdIndexes[0]]?.sourceIdUnique !== false))
      ? sameIdIndexes[0]
      : -1;
  const targetIndex = existingIndex === -1 ? rebaseIndex : existingIndex;
  const uniquenessMetadata = sourceIdUnique === undefined ? {} : { sourceIdUnique };
  if (targetIndex === -1) return [...records, { id, sourceIndex, ...uniquenessMetadata, patch }];

  return records.map((record, index) =>
    index === targetIndex
      ? { ...record, id, sourceIndex, ...uniquenessMetadata, patch: { ...record.patch, ...patch } }
      : record,
  );
}

export function createLocalEducationMaterial(_existingCount: number) {
  const suffix = crypto.randomUUID();

  return {
    id: `material-local-${suffix}`,
    title: 'Novo material',
    source: 'Equipe BemTeVi',
    description: 'Material editável apenas neste navegador.',
    imageUrl: '',
    tags: ['novo'],
    audience: 'teachers' as const,
    featuredImage: { kind: 'catalog' as const, imageId: defaultFeaturedImageId },
    body: [
      {
        id: `material-local-${suffix}-overview`,
        kind: 'paragraph' as const,
        title: 'Sobre este material',
        text: 'Descreva aqui o conteúdo principal do material.',
      },
    ],
    review: { status: 'pending_review' as const, reviewedBy: null, reviewedAt: null, notes: '' },
  };
}

export function createLocalGroup(
  existingAddedGroups: EducationResourceGroup[],
  shippedGroups: EducationResourceGroup[],
) {
  let suffix = crypto.randomUUID();
  const allGroupIds = new Set([...shippedGroups, ...existingAddedGroups].map((group) => group.id));
  while (allGroupIds.has(`group-local-${suffix}`)) {
    suffix = crypto.randomUUID();
  }

  return {
    id: `group-local-${suffix}`,
    title: 'Novo grupo',
    description: '',
    order: shippedGroups.length + existingAddedGroups.length + 1,
  };
}

export function createLocalFlow(_existingCount: number) {
  const suffix = crypto.randomUUID();
  const id = `flow-local-${suffix}`;

  return {
    id,
    version: '1.0.0' as const,
    locale: 'pt-BR' as const,
    title: 'Novo fluxo',
    type: 'guided_conversation' as const,
    status: 'draft' as const,
    entry: {
      nodeId: 'start',
      enteringPhrases: ['Começar'],
      transitionMessage: 'Olá.',
    },
    nodes: {
      start: {
        id: 'start',
        kind: 'choice' as const,
        text: 'Como você quer continuar?',
        options: [{ id: 'done', label: 'Continuar', next: 'done' }],
      },
      done: {
        id: 'done',
        kind: 'result' as const,
        text: 'Finalizado.',
      },
    },
  };
}

export function updateRecordAtIndex<T>(records: T[], index: number, patch: Partial<T>) {
  return records.map((record, recordIndex) => (recordIndex === index ? { ...record, ...patch } : record));
}

export function findGroupIndex(groups: EducationResourceGroup[], groupId: string) {
  return groups.findIndex((group) => group.id === groupId);
}

export function toPublishedContentPayload(content: DashboardShippedContent): PublishedContentPayload {
  return {
    flows: content.flows,
    educationMaterials: content.educationMaterials,
    educationGroups: content.educationGroups,
    contacts: content.contacts,
    locations: content.locations ?? [],
    defaultGroupOrder: content.defaultGroupOrder ?? 0,
  };
}

export function resolveRecordOrigin(
  shippedRecords: Array<{ id: string }>,
  addedRecords: Array<{ id: string }>,
  removedRecordIds: readonly string[],
  mergedIndex: number,
  id?: string,
): DashboardRecordOrigin | undefined {
  const removedIds = new Set(removedRecordIds);
  const origins: DashboardRecordOrigin[] = [];

  shippedRecords.forEach((record, sourceIndex) => {
    if (!removedIds.has(record.id)) origins.push({ kind: 'shipped', sourceIndex, id: record.id });
  });
  addedRecords.forEach((record, addedIndex) => {
    if (!removedIds.has(record.id)) origins.push({ kind: 'added', addedIndex, id: record.id });
  });

  if (origins[mergedIndex] && (!id || origins[mergedIndex]?.id === id)) {
    return origins[mergedIndex];
  }
  if (id) {
    const addedIndex = addedRecords.findIndex((record) => record.id === id);
    if (addedIndex >= 0) return { kind: 'added', addedIndex, id };
    const sourceIndex = shippedRecords.findIndex((record) => record.id === id);
    if (sourceIndex >= 0) return { kind: 'shipped', sourceIndex, id };
  }
  return origins[mergedIndex];
}
