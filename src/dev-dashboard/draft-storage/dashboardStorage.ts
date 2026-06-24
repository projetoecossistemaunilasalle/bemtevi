import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import type { DashboardShippedContent } from '../content/shippedContent';

const STORAGE_KEY = 'secuida:dev-dashboard:drafts:v1';
export const DASHBOARD_DRAFT_SCHEMA_VERSION = '2.0.0' as const;

export interface DashboardRecordPatch<T extends { id: string }> {
  id: string;
  sourceIndex?: number;
  patch: Partial<T>;
}

export interface DashboardDraftState {
  schemaVersion: typeof DASHBOARD_DRAFT_SCHEMA_VERSION;
  flowPatches: Array<DashboardRecordPatch<GuidedFlow>>;
  educationMaterialPatches: Array<DashboardRecordPatch<EducationResource>>;
  groupPatches: Array<DashboardRecordPatch<EducationResourceGroup>>;
  addedFlows: GuidedFlow[];
  addedEducationMaterials: EducationResource[];
  addedGroups: EducationResourceGroup[];
  updatedAt: string | null;
}

export function createEmptyDashboardDraftState(): DashboardDraftState {
  return {
    schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
    flowPatches: [],
    educationMaterialPatches: [],
    groupPatches: [],
    addedFlows: [],
    addedEducationMaterials: [],
    addedGroups: [],
    updatedAt: null,
  };
}

export function loadDashboardDrafts(storage: Storage = localStorage): DashboardDraftState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyDashboardDraftState();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return createEmptyDashboardDraftState();

    const record = parsed as Record<string, unknown>;
    const version = record.schemaVersion;
    if (version === '1.0.0') {
      return {
        ...(record as Record<string, unknown>),
        schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
        groupPatches: (record.groupPatches ?? []) as DashboardRecordPatch<EducationResourceGroup>[],
        addedGroups: (record.addedGroups ?? []) as EducationResourceGroup[],
      } as DashboardDraftState;
    }
    if (version !== DASHBOARD_DRAFT_SCHEMA_VERSION) return createEmptyDashboardDraftState();
    return parsed as DashboardDraftState;
  } catch {
    return createEmptyDashboardDraftState();
  }
}

export function saveDashboardDrafts(state: DashboardDraftState, storage: Storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearDashboardDrafts(storage: Storage = localStorage) {
  storage.removeItem(STORAGE_KEY);
}

export function mergeDashboardDrafts(shipped: DashboardShippedContent, drafts: DashboardDraftState) {
  return {
    flows: mergeRecords(shipped.flows, drafts.flowPatches, drafts.addedFlows),
    educationMaterials: mergeRecords(
      shipped.educationMaterials,
      drafts.educationMaterialPatches,
      drafts.addedEducationMaterials,
    ),
    educationGroups: mergeRecords(
      shipped.educationGroups,
      drafts.groupPatches,
      drafts.addedGroups,
    ),
  };
}

function mergeRecords<T extends { id: string }>(shipped: T[], patches: Array<DashboardRecordPatch<T>>, additions: T[]) {
  const patchesBySource = new Map(
    patches
      .filter((record) => typeof record.sourceIndex === 'number')
      .map((record) => [`${record.id}:${record.sourceIndex}`, record.patch]),
  );
  const legacyPatchesById = new Map(
    patches.filter((record) => typeof record.sourceIndex !== 'number').map((record) => [record.id, record.patch]),
  );
  const usedLegacyPatchIds = new Set<string>();

  return [
    ...shipped.map((record, sourceIndex) => {
      const sourcePatch = patchesBySource.get(`${record.id}:${sourceIndex}`);
      const legacyPatch =
        sourcePatch || usedLegacyPatchIds.has(record.id) ? undefined : legacyPatchesById.get(record.id);

      if (legacyPatch) usedLegacyPatchIds.add(record.id);

      return {
        ...record,
        ...(sourcePatch ?? legacyPatch),
      };
    }),
    ...additions,
  ];
}
