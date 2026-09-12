import type { PublishedContentPayload } from '../app/content/publishedContent';
import { DEFAULT_EDUCATION_GROUP_ID } from '../content/resources/groups';
import type { EducationResourceGroup } from '../content/resources/groups';
import type { EducationResource } from '../domain/resources/types';
import { mergeDashboardDrafts, type DashboardDraftState } from './draft-storage/dashboardStorage';
import {
  createLocalEducationMaterial,
  createLocalGroup,
  findGroupIndex,
  resolveRecordOrigin,
  updateRecordAtIndex,
  upsertPatchById,
} from './dashboardModel';
import type { DashboardDraftUpdater } from './dashboardMutationTypes';

export interface DashboardEducationMutationController {
  onResourceChange: (resourceIndex: number, resourceId: string, patch: Partial<EducationResource>) => void;
  onResourceAdd: () => string;
  onResourceRemove: (resourceIndex: number, resourceId: string) => void;
  onGroupChange: (groupIndex: number, groupId: string, patch: Partial<EducationResourceGroup>) => void;
  onGroupAdd: () => void;
  onGroupRemove: (groupIndex: number, groupId: string) => void;
  onGroupMove: (groupIndex: number, direction: -1 | 1) => void;
}

export function createDashboardEducationMutationController({
  shipped,
  draftState,
  updateDraftState,
}: {
  shipped: PublishedContentPayload;
  draftState: DashboardDraftState;
  updateDraftState: DashboardDraftUpdater;
}): DashboardEducationMutationController {
  return {
    onResourceChange: (resourceIndex, resourceId, patch) =>
      updateDraftState((current) => {
        const origin = resolveRecordOrigin(
          shipped.educationMaterials,
          current.addedEducationMaterials,
          current.removedEducationMaterialIds ?? [],
          resourceIndex,
          resourceId,
        );
        if (!origin || origin.id !== resourceId) return current;

        if (origin.kind === 'added') {
          return {
            ...current,
            addedEducationMaterials: updateRecordAtIndex(current.addedEducationMaterials, origin.addedIndex, patch),
          };
        }

        return {
          ...current,
          educationMaterialPatches: upsertPatchById(
            current.educationMaterialPatches,
            resourceId,
            origin.sourceIndex,
            patch,
          ),
        };
      }),
    onResourceAdd: () => {
      const newMaterial = createLocalEducationMaterial(
        shipped.educationMaterials.length + draftState.addedEducationMaterials.length,
      );
      updateDraftState((current) => ({
        ...current,
        addedEducationMaterials: [...current.addedEducationMaterials, newMaterial],
      }));
      return newMaterial.id;
    },
    onResourceRemove: (resourceIndex, resourceId) =>
      updateDraftState((current) => {
        const origin = resolveRecordOrigin(
          shipped.educationMaterials,
          current.addedEducationMaterials,
          current.removedEducationMaterialIds ?? [],
          resourceIndex,
          resourceId,
        );
        if (!origin || origin.id !== resourceId) return current;

        if (origin.kind === 'added') {
          return {
            ...current,
            addedEducationMaterials: current.addedEducationMaterials.filter((_, index) => index !== origin.addedIndex),
          };
        }

        return {
          ...current,
          educationMaterialPatches: current.educationMaterialPatches.filter((patch) => patch.id !== origin.id),
          removedEducationMaterialIds: [...new Set([...(current.removedEducationMaterialIds ?? []), origin.id])],
        };
      }),
    onGroupChange: (_groupIndex, groupId, patch) =>
      updateDraftState((current) => {
        const addedIndex = findGroupIndex(current.addedGroups, groupId);
        if (addedIndex >= 0) {
          return { ...current, addedGroups: updateRecordAtIndex(current.addedGroups, addedIndex, patch) };
        }

        const shippedIndex = findGroupIndex(shipped.educationGroups, groupId);
        if (shippedIndex < 0) return current;

        return {
          ...current,
          groupPatches: upsertPatchById(current.groupPatches, groupId, shippedIndex, patch),
        };
      }),
    onGroupAdd: () =>
      updateDraftState((current) => ({
        ...current,
        addedGroups: [...current.addedGroups, createLocalGroup(current.addedGroups, shipped.educationGroups)],
      })),
    onGroupRemove: (_groupIndex, groupId) =>
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
            shippedIndex >= 0 ? [...new Set([...(current.removedGroupIds ?? []), groupId])] : current.removedGroupIds,
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
            educationMaterialPatches: upsertPatchById(next.educationMaterialPatches, resource.id, resourceIndex, {
              group: DEFAULT_EDUCATION_GROUP_ID,
            }),
          };
        });

        return next;
      }),
    onGroupMove: (groupIndex, direction) =>
      updateDraftState((current) => moveEducationGroup(shipped, current, groupIndex, direction)),
  };
}

function moveEducationGroup(
  mergedDrafts: PublishedContentPayload,
  current: DashboardDraftState,
  groupIndex: number,
  direction: -1 | 1,
) {
  const currentMergedDrafts = mergeDashboardDrafts(mergedDrafts, current);

  if (groupIndex === 0 && direction === -1) {
    const groups = currentMergedDrafts.educationGroups;
    if (groups.length === 0) return current;

    const firstGroup = groups[0];
    const defaultGroupOrder = currentMergedDrafts.defaultGroupOrder;
    if (!firstGroup || firstGroup.order <= defaultGroupOrder) return current;

    const firstAddedIndex = findGroupIndex(current.addedGroups, firstGroup.id);
    if (firstAddedIndex >= 0) {
      return {
        ...current,
        defaultGroupOrder: firstGroup.order,
        addedGroups: updateRecordAtIndex(current.addedGroups, firstAddedIndex, { order: defaultGroupOrder }),
      };
    }

    const firstShippedIndex = findGroupIndex(mergedDrafts.educationGroups, firstGroup.id);
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
    const currentGroups = currentMergedDrafts.educationGroups;
    if (currentGroups.length === 0) return current;

    const defaultGroupOrder = currentMergedDrafts.defaultGroupOrder;
    const adjacentGroup = direction === -1 ? currentGroups[currentGroups.length - 1] : currentGroups[0];
    if (!adjacentGroup) return current;
    if (direction === -1 && defaultGroupOrder <= adjacentGroup.order) return current;
    if (direction === 1 && defaultGroupOrder >= adjacentGroup.order) return current;

    const adjacentAddedIndex = findGroupIndex(current.addedGroups, adjacentGroup.id);
    if (adjacentAddedIndex >= 0) {
      return {
        ...current,
        defaultGroupOrder: adjacentGroup.order,
        addedGroups: updateRecordAtIndex(current.addedGroups, adjacentAddedIndex, { order: defaultGroupOrder }),
      };
    }

    const adjacentShippedIndex = findGroupIndex(mergedDrafts.educationGroups, adjacentGroup.id);
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
  const orderedGroups = mergedDrafts.educationGroups;
  if (nextIndex < 0 || nextIndex >= orderedGroups.length) return current;
  const currentGroup = orderedGroups[groupIndex];
  const adjacentGroup = orderedGroups[nextIndex];
  if (!currentGroup || !adjacentGroup) return current;

  const currentAddedIndex = findGroupIndex(current.addedGroups, currentGroup.id);
  const adjacentAddedIndex = findGroupIndex(current.addedGroups, adjacentGroup.id);
  let next = current;

  function applyShippedPatch(groupId: string, patch: Partial<EducationResourceGroup>) {
    const shippedIndex = findGroupIndex(mergedDrafts.educationGroups, groupId);
    if (shippedIndex < 0) return;
    next = {
      ...next,
      groupPatches: upsertPatchById(next.groupPatches, groupId, shippedIndex, patch),
    };
  }

  function applyLocalGroup(index: number, patch: Partial<EducationResourceGroup>) {
    if (index < 0) return;
    next = { ...next, addedGroups: updateRecordAtIndex(next.addedGroups, index, patch) };
  }

  if (currentAddedIndex >= 0) applyLocalGroup(currentAddedIndex, { order: adjacentGroup.order });
  else applyShippedPatch(currentGroup.id, { order: adjacentGroup.order });

  if (adjacentAddedIndex >= 0) applyLocalGroup(adjacentAddedIndex, { order: currentGroup.order });
  else applyShippedPatch(adjacentGroup.id, { order: currentGroup.order });

  return next;
}
