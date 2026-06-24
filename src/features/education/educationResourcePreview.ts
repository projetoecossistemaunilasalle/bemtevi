import type { EducationResource } from '../../domain/resources/types';
import { getShippedDashboardContent } from '../../dev-dashboard/content/shippedContent';
import {
  createEmptyDashboardDraftState,
  loadDashboardDrafts,
  mergeDashboardDrafts,
} from '../../dev-dashboard/draft-storage/dashboardStorage';
import type { EducationResourceGroup } from '../../content/resources/groups';

export interface EducationResourcePreviewState {
  resources: EducationResource[];
  groups: EducationResourceGroup[];
  defaultGroupOrder: number;
  changedResourceIds: string[];
  isPreviewingDrafts: boolean;
}

export function resolveEducationResourcesForPreview(): EducationResourcePreviewState {
  const shipped = getShippedDashboardContent();
  const drafts = safeLoadDrafts();
  const hasEducationDrafts =
    drafts.educationMaterialPatches.length > 0 ||
    drafts.addedEducationMaterials.length > 0 ||
    drafts.groupPatches.length > 0 ||
    drafts.addedGroups.length > 0 ||
    (drafts.defaultGroupOrder !== undefined && drafts.defaultGroupOrder !== 0);

  if (!hasEducationDrafts) {
    return {
      resources: shipped.educationMaterials,
      groups: shipped.educationGroups,
      defaultGroupOrder: 0,
      changedResourceIds: [],
      isPreviewingDrafts: false,
    };
  }

  const merged = mergeDashboardDrafts(shipped, drafts);
  const resources = merged.educationMaterials;
  const groups = merged.educationGroups;
  const defaultGroupOrder = merged.defaultGroupOrder;
  const changedResourceIds = resolveChangedEducationResourceIds(shipped.educationMaterials, resources);
  const shippedGroupIds = shipped.educationGroups.map((g) => g.id);
  const hasGroupChanges = groups.some((g) => !shippedGroupIds.includes(g.id)) || merged.defaultGroupOrder !== 0;

  return {
    resources,
    groups,
    defaultGroupOrder,
    changedResourceIds,
    isPreviewingDrafts: changedResourceIds.length > 0 || hasGroupChanges,
  };
}

function safeLoadDrafts() {
  try {
    return loadDashboardDrafts();
  } catch {
    return createEmptyDashboardDraftState();
  }
}

function resolveChangedEducationResourceIds(shipped: EducationResource[], preview: EducationResource[]) {
  return preview.flatMap((resource, index) => {
    if (index >= shipped.length) return [resource.id];
    return areValuesEqual(shipped[index], resource) ? [] : [resource.id];
  });
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right) return false;
  if (left == null || right == null) return left === right;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => areValuesEqual(item, right[index]));
  }

  if (typeof left !== 'object' || typeof right !== 'object') return false;

  const leftObject = left as Record<string, unknown>;
  const rightObject = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftObject);
  const rightKeys = Object.keys(rightObject);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => key in rightObject && areValuesEqual(leftObject[key], rightObject[key]));
}
