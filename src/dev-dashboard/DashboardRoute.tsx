import { useMemo, useState } from 'react';
import { Page } from '../design-system/components/Page';
import { PageHeader } from '../design-system/components/PageHeader';
import { DashboardShell, type DashboardTab } from './components/DashboardShell';
import { getShippedDashboardContent } from './content/shippedContent';
import {
  type DashboardRecordPatch,
  loadDashboardDrafts,
  mergeDashboardDrafts,
  saveDashboardDrafts,
} from './draft-storage/dashboardStorage';
import { EducationDashboard } from './education/EducationDashboard';
import { validateDashboardEducation } from './education/educationValidation';
import { ExportDashboard } from './export/ExportDashboard';
import { FlowDashboard } from './flows/FlowDashboard';
import { validateDashboardFlows } from './flows/flowValidation';
import { defaultFeaturedImageId } from '../content/resources/featuredImages';
import { DEFAULT_EDUCATION_GROUP_ID } from '../content/resources/groups';
import type { EducationResourceGroup } from '../content/resources/groups';
import { loadActiveTab, saveActiveTab } from './draft-storage/dashboardTabStorage';

function upsertPatchById<T extends { id: string }>(
  records: Array<DashboardRecordPatch<T>>,
  id: string,
  sourceIndex: number,
  patch: Partial<T>,
) {
  const existingIndex = records.findIndex((record) => record.id === id && record.sourceIndex === sourceIndex);
  if (existingIndex === -1) return [...records, { id, sourceIndex, patch }];

  return records.map((record, index) =>
    index === existingIndex ? { id, sourceIndex, patch: { ...record.patch, ...patch } } : record,
  );
}

function createLocalEducationMaterial(existingCount: number) {
  const suffix = existingCount + 1;

  return {
    id: `material-local-${suffix}`,
    title: 'Novo material',
    source: 'Equipe SeCuida',
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

function createLocalGroup(existingAddedGroups: EducationResourceGroup[], shippedGroups: EducationResourceGroup[]) {
  let suffix = 1;
  const allGroupIds = new Set([...shippedGroups, ...existingAddedGroups].map((g) => g.id));
  while (allGroupIds.has(`group-local-${suffix}`)) {
    suffix++;
  }

  return {
    id: `group-local-${suffix}`,
    title: 'Novo grupo',
    description: '',
    order: shippedGroups.length + existingAddedGroups.length + 1,
  };
}

function createLocalFlow(existingCount: number) {
  const suffix = existingCount + 1;
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

function updateRecordAtIndex<T>(records: T[], index: number, patch: Partial<T>) {
  return records.map((record, recordIndex) => (recordIndex === index ? { ...record, ...patch } : record));
}

function findGroupIndex(groups: EducationResourceGroup[], groupId: string) {
  return groups.findIndex((group) => group.id === groupId);
}

export function DashboardRoute() {
  const [activeTab, setActiveTabState] = useState<DashboardTab>(() => loadActiveTab());
  const shipped = useMemo(() => getShippedDashboardContent(), []);
  const [draftState, setDraftState] = useState(() => loadDashboardDrafts());
  const mergedDrafts = useMemo(() => mergeDashboardDrafts(shipped, draftState), [draftState, shipped]);

  function setActiveTab(tab: DashboardTab) {
    setActiveTabState(tab);
    saveActiveTab(tab);
  }

  function updateDraftState(updater: (current: typeof draftState) => typeof draftState) {
    setDraftState((current) => {
      const next = {
        ...updater(current),
        updatedAt: new Date().toISOString(),
      };

      saveDashboardDrafts(next);
      return next;
    });
  }

  const validation = useMemo(() => {
    const flowValidation = validateDashboardFlows(
      mergedDrafts.flows,
      mergedDrafts.educationMaterials.map((resource) => resource.id),
    );
    const educationValidation = validateDashboardEducation(
      mergedDrafts.educationMaterials,
      mergedDrafts.educationGroups,
    );

    return {
      errors: [...flowValidation.errors, ...educationValidation.errors],
      warnings: [...flowValidation.warnings, ...educationValidation.warnings],
    };
  }, [mergedDrafts]);
  const drafts = {
    flows: mergedDrafts.flows,
    educationMaterials: mergedDrafts.educationMaterials,
    educationGroups: mergedDrafts.educationGroups,
    defaultGroupOrder: mergedDrafts.defaultGroupOrder,
    removedEducationGroupIds: draftState.removedGroupIds ?? [],
  };

  return (
    <Page>
      <PageHeader title="Dashboard" description="Rascunhos locais para fluxos e materiais educativos." />
      <DashboardShell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'flows' && (
          <FlowDashboard
            flows={mergedDrafts.flows}
            resources={mergedDrafts.educationMaterials}
            onFlowChange={(flowIndex, flowId, patch) =>
              updateDraftState((current) => ({
                ...current,
                flowPatches: upsertPatchById(current.flowPatches, flowId, flowIndex, patch),
              }))
            }
            onFlowAdd={() =>
              updateDraftState((current) => ({
                ...current,
                addedFlows: [...current.addedFlows, createLocalFlow(current.addedFlows.length)],
              }))
            }
          />
        )}
        {activeTab === 'education' && (
          <EducationDashboard
            resources={mergedDrafts.educationMaterials}
            groups={mergedDrafts.educationGroups}
            defaultGroupOrder={mergedDrafts.defaultGroupOrder}
            onResourceChange={(resourceIndex, resourceId, patch) =>
              updateDraftState((current) => {
                const addedIndex = resourceIndex - shipped.educationMaterials.length;

                if (addedIndex >= 0) {
                  return {
                    ...current,
                    addedEducationMaterials: updateRecordAtIndex(current.addedEducationMaterials, addedIndex, patch),
                  };
                }

                return {
                  ...current,
                  educationMaterialPatches: upsertPatchById(
                    current.educationMaterialPatches,
                    resourceId,
                    resourceIndex,
                    patch,
                  ),
                };
              })
            }
            onResourceAdd={() => {
              const newMaterial = createLocalEducationMaterial(
                shipped.educationMaterials.length + draftState.addedEducationMaterials.length,
              );
              updateDraftState((current) => ({
                ...current,
                addedEducationMaterials: [...current.addedEducationMaterials, newMaterial],
              }));
              return newMaterial.id;
            }}
            onGroupChange={(groupIndex, groupId, patch) =>
              updateDraftState((current) => {
                const addedIndex = findGroupIndex(current.addedGroups, groupId);

                if (addedIndex >= 0) {
                  return {
                    ...current,
                    addedGroups: updateRecordAtIndex(current.addedGroups, addedIndex, patch),
                  };
                }

                const shippedIndex = findGroupIndex(shipped.educationGroups, groupId);
                if (shippedIndex < 0) return current;

                return {
                  ...current,
                  groupPatches: upsertPatchById(current.groupPatches, groupId, shippedIndex, patch),
                };
              })
            }
            onGroupAdd={() =>
              updateDraftState((current) => ({
                ...current,
                addedGroups: [...current.addedGroups, createLocalGroup(current.addedGroups, shipped.educationGroups)],
              }))
            }
            onGroupRemove={(_groupIndex, groupId) =>
              updateDraftState((current) => {
                const addedIndex = findGroupIndex(current.addedGroups, groupId);
                const shippedIndex = findGroupIndex(shipped.educationGroups, groupId);
                if (addedIndex < 0 && shippedIndex < 0) return current;

                const currentMergedDrafts = mergeDashboardDrafts(shipped, current);
                const assignedResources = currentMergedDrafts.educationMaterials.flatMap((resource, resourceIndex) =>
                  resource.group === groupId ? [{ resource, resourceIndex }] : [],
                );
                let next: typeof current = {
                  ...current,
                  addedGroups: current.addedGroups.filter((_, index) => index !== addedIndex),
                  groupPatches: current.groupPatches.filter((patch) => patch.id !== groupId),
                  removedGroupIds:
                    shippedIndex >= 0
                      ? [...new Set([...(current.removedGroupIds ?? []), groupId])]
                      : current.removedGroupIds,
                };

                assignedResources.forEach(({ resource, resourceIndex }) => {
                  const addedMaterialIndex = resourceIndex - shipped.educationMaterials.length;

                  if (addedMaterialIndex >= 0) {
                    next = {
                      ...next,
                      addedEducationMaterials: updateRecordAtIndex(next.addedEducationMaterials, addedMaterialIndex, {
                        group: DEFAULT_EDUCATION_GROUP_ID,
                      }),
                    };
                    return;
                  }

                  next = {
                    ...next,
                    educationMaterialPatches: upsertPatchById(
                      next.educationMaterialPatches,
                      resource.id,
                      resourceIndex,
                      { group: DEFAULT_EDUCATION_GROUP_ID },
                    ),
                  };
                });

                return next;
              })
            }
            onGroupMove={(groupIndex, direction) =>
              updateDraftState((current) => {
                if (groupIndex === 0 && direction === -1) {
                  const currentMergedDrafts = mergeDashboardDrafts(shipped, current);
                  const groups = currentMergedDrafts.educationGroups;
                  if (groups.length === 0) return current;

                  const firstGroup = groups[0];
                  const defaultGroupOrder = current.defaultGroupOrder ?? 0;
                  if (!firstGroup || firstGroup.order <= defaultGroupOrder) return current;

                  const firstAddedIndex = findGroupIndex(current.addedGroups, firstGroup.id);
                  if (firstAddedIndex >= 0) {
                    return {
                      ...current,
                      defaultGroupOrder: firstGroup.order,
                      addedGroups: updateRecordAtIndex(current.addedGroups, firstAddedIndex, {
                        order: defaultGroupOrder,
                      }),
                    };
                  }

                  const firstShippedIndex = findGroupIndex(shipped.educationGroups, firstGroup.id);
                  if (firstShippedIndex < 0) return current;

                  return {
                    ...current,
                    defaultGroupOrder: firstGroup.order,
                    groupPatches: upsertPatchById(current.groupPatches, firstGroup.id, firstShippedIndex, {
                      order: defaultGroupOrder,
                    }),
                  };
                }

                if (groupIndex === -1) {
                  const currentMergedDrafts = mergeDashboardDrafts(shipped, current);
                  const groups = currentMergedDrafts.educationGroups;
                  if (groups.length === 0) return current;

                  const defaultGroupOrder = current.defaultGroupOrder ?? 0;
                  const adjacentGroup = direction === -1 ? groups[groups.length - 1] : groups[0];
                  if (!adjacentGroup) return current;
                  if (direction === -1 && defaultGroupOrder <= adjacentGroup.order) return current;
                  if (direction === 1 && defaultGroupOrder >= adjacentGroup.order) return current;

                  const adjacentAddedIndex = findGroupIndex(current.addedGroups, adjacentGroup.id);
                  if (adjacentAddedIndex >= 0) {
                    return {
                      ...current,
                      defaultGroupOrder: adjacentGroup.order,
                      addedGroups: updateRecordAtIndex(current.addedGroups, adjacentAddedIndex, {
                        order: defaultGroupOrder,
                      }),
                    };
                  }

                  const adjacentShippedIndex = findGroupIndex(shipped.educationGroups, adjacentGroup.id);
                  if (adjacentShippedIndex < 0) return current;

                  return {
                    ...current,
                    defaultGroupOrder: adjacentGroup.order,
                    groupPatches: upsertPatchById(current.groupPatches, adjacentGroup.id, adjacentShippedIndex, {
                      order: defaultGroupOrder,
                    }),
                  };
                }

                const nextIndex = groupIndex + direction;
                if (
                  nextIndex < 0 ||
                  nextIndex >= mergedDrafts.educationGroups.length ||
                  mergedDrafts.educationGroups[groupIndex] === undefined ||
                  mergedDrafts.educationGroups[nextIndex] === undefined
                ) {
                  return current;
                }

                const currentGroup = mergedDrafts.educationGroups[groupIndex];
                const adjacentGroup = mergedDrafts.educationGroups[nextIndex];
                const currentAddedIndex = findGroupIndex(current.addedGroups, currentGroup.id);
                const adjacentAddedIndex = findGroupIndex(current.addedGroups, adjacentGroup.id);
                let next = current;

                function applyShippedPatch(groupId: string, patch: Partial<EducationResourceGroup>) {
                  const shippedIndex = findGroupIndex(shipped.educationGroups, groupId);
                  if (shippedIndex < 0) return;

                  next = {
                    ...next,
                    groupPatches: upsertPatchById(next.groupPatches, groupId, shippedIndex, patch),
                  };
                }

                function applyLocalGroup(index: number, patch: Partial<EducationResourceGroup>) {
                  if (index < 0) return;

                  next = {
                    ...next,
                    addedGroups: updateRecordAtIndex(next.addedGroups, index, patch),
                  };
                }

                if (currentAddedIndex >= 0) {
                  applyLocalGroup(currentAddedIndex, { order: adjacentGroup.order });
                } else {
                  applyShippedPatch(currentGroup.id, { order: adjacentGroup.order });
                }

                if (adjacentAddedIndex >= 0) {
                  applyLocalGroup(adjacentAddedIndex, { order: currentGroup.order });
                } else {
                  applyShippedPatch(adjacentGroup.id, { order: currentGroup.order });
                }

                return next;
              })
            }
          />
        )}
        {activeTab === 'export' && (
          <ExportDashboard
            shipped={shipped}
            drafts={drafts}
            validation={validation}
            draftUpdatedAt={draftState.updatedAt}
          />
        )}
      </DashboardShell>
    </Page>
  );
}
