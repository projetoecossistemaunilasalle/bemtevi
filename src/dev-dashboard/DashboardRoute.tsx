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
import type { EducationResourceGroup } from '../content/resources/groups';

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

function updateRecordAtIndex<T>(records: T[], index: number, patch: Partial<T>) {
  return records.map((record, recordIndex) => (recordIndex === index ? { ...record, ...patch } : record));
}

export function DashboardRoute() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('flows');
  const shipped = useMemo(() => getShippedDashboardContent(), []);
  const [draftState, setDraftState] = useState(() => loadDashboardDrafts());
  const mergedDrafts = useMemo(() => mergeDashboardDrafts(shipped, draftState), [draftState, shipped]);

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
          />
        )}
        {activeTab === 'education' && (
          <EducationDashboard
            resources={mergedDrafts.educationMaterials}
            groups={mergedDrafts.educationGroups}
            shippedGroups={shipped.educationGroups}
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
            onResourceAdd={() =>
              updateDraftState((current) => ({
                ...current,
                addedEducationMaterials: [
                  ...current.addedEducationMaterials,
                  createLocalEducationMaterial(
                    shipped.educationMaterials.length + current.addedEducationMaterials.length,
                  ),
                ],
              }))
            }
            onGroupChange={(groupIndex, groupId, patch) =>
              updateDraftState((current) => {
                const addedIndex = groupIndex - shipped.educationGroups.length;

                if (addedIndex >= 0) {
                  return {
                    ...current,
                    addedGroups: updateRecordAtIndex(current.addedGroups, addedIndex, patch),
                  };
                }

                return {
                  ...current,
                  groupPatches: upsertPatchById(current.groupPatches, groupId, groupIndex, patch),
                };
              })
            }
            onGroupAdd={() =>
              updateDraftState((current) => ({
                ...current,
                addedGroups: [...current.addedGroups, createLocalGroup(current.addedGroups, shipped.educationGroups)],
              }))
            }
            onGroupRemove={(groupIndex, _groupId) =>
              updateDraftState((current) => {
                const addedIndex = groupIndex - shipped.educationGroups.length;
                if (addedIndex < 0) return current;

                return {
                  ...current,
                  addedGroups: current.addedGroups.filter((_, index) => index !== addedIndex),
                };
              })
            }
            onGroupMove={(groupIndex, direction) =>
              updateDraftState((current) => {
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
                const currentAddedIndex = groupIndex - shipped.educationGroups.length;
                const adjacentAddedIndex = nextIndex - shipped.educationGroups.length;
                let next = current;

                function applyShippedPatch(index: number, groupId: string, patch: Partial<EducationResourceGroup>) {
                  next = {
                    ...next,
                    groupPatches: upsertPatchById(next.groupPatches, groupId, index, patch),
                  };
                }

                function applyLocalGroup(index: number, patch: Partial<EducationResourceGroup>) {
                  next = {
                    ...next,
                    addedGroups: updateRecordAtIndex(next.addedGroups, index, patch),
                  };
                }

                if (currentAddedIndex >= 0) {
                  applyLocalGroup(currentAddedIndex, { order: adjacentGroup.order });
                } else {
                  applyShippedPatch(groupIndex, currentGroup.id, { order: adjacentGroup.order });
                }

                if (adjacentAddedIndex >= 0) {
                  applyLocalGroup(adjacentAddedIndex, { order: currentGroup.order });
                } else {
                  applyShippedPatch(nextIndex, adjacentGroup.id, { order: currentGroup.order });
                }

                return next;
              })
            }
          />
        )}
        {activeTab === 'export' && <ExportDashboard shipped={shipped} drafts={drafts} validation={validation} />}
      </DashboardShell>
    </Page>
  );
}
