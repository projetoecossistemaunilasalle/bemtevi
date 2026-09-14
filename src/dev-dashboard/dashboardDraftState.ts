import type { GuidedFlow } from '../domain/flow-engine/types';
import type { EducationResource } from '../domain/resources/types';
import type { EducationResourceGroup } from '../content/resources/groups';
import type { ServiceDirectoryEntry, ServiceLocation } from '../domain/services/types';
import type { PublishedContentPayload } from '../app/content/publishedContent';

/**
 * Pure V2 draft-state model extracted from `draft-storage/dashboardStorage.ts`
 * (LEGACY-00). No browser persistence, IndexedDB or localStorage — those stay
 * in the legacy module until LEGACY-01 deletes it.
 */

export const DASHBOARD_DRAFT_SCHEMA_VERSION = '6.0.0' as const;

export interface DashboardRecordPatch<T extends { id: string }> {
  id: string;
  sourceIndex?: number;
  sourceIdUnique?: boolean;
  patch: Partial<T>;
}

export interface DashboardDraftState {
  schemaVersion: typeof DASHBOARD_DRAFT_SCHEMA_VERSION;
  flowPatches: Array<DashboardRecordPatch<GuidedFlow>>;
  educationMaterialPatches: Array<DashboardRecordPatch<EducationResource>>;
  groupPatches: Array<DashboardRecordPatch<EducationResourceGroup>>;
  contactPatches: Array<DashboardRecordPatch<ServiceDirectoryEntry>>;
  locationPatches: Array<DashboardRecordPatch<ServiceLocation>>;
  addedFlows: GuidedFlow[];
  addedEducationMaterials: EducationResource[];
  addedGroups: EducationResourceGroup[];
  addedContacts: ServiceDirectoryEntry[];
  addedLocations: ServiceLocation[];
  baseRevision?: number | null;
  basePayload?: PublishedContentPayload;
  defaultGroupOrder?: number;
  removedGroupIds?: string[];
  removedFlowIds?: string[];
  removedEducationMaterialIds?: string[];
  removedContactIds: string[];
  removedLocationIds: string[];
  updatedAt: string | null;
}

export function createEmptyDashboardDraftState(): DashboardDraftState {
  return {
    schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
    flowPatches: [],
    educationMaterialPatches: [],
    groupPatches: [],
    contactPatches: [],
    locationPatches: [],
    addedFlows: [],
    addedEducationMaterials: [],
    addedGroups: [],
    addedContacts: [],
    addedLocations: [],
    removedGroupIds: [],
    removedFlowIds: [],
    removedContactIds: [],
    removedLocationIds: [],
    updatedAt: null,
  };
}
