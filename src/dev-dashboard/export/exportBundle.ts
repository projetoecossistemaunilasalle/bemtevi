import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { ServiceDirectoryEntry } from '../../domain/services/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import { normalizeForComparison } from '../content/normalize';
import type { DashboardShippedContent } from '../content/shippedContent';
import type { DashboardValidationResult } from '../validation/validationTypes';

export const DASHBOARD_EXPORT_SCHEMA_VERSION = '3.0.0' as const;

export interface DashboardDraftContent {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
  educationGroups: EducationResourceGroup[];
  contacts: ServiceDirectoryEntry[];
  defaultGroupOrder?: number;
  removedEducationGroupIds?: string[];
  removedEducationMaterialIds?: string[];
  removedContactIds?: string[];
}

export interface DashboardExportBundle {
  schemaVersion: typeof DASHBOARD_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  source: 'bemtevi-dev-dashboard';
  changes: DashboardDraftContent;
  validation: DashboardValidationResult;
}

export function buildExportBundle({
  shipped,
  drafts,
  validation,
  exportedAt,
}: {
  shipped: DashboardShippedContent;
  drafts: DashboardDraftContent;
  validation: DashboardValidationResult;
  exportedAt: string;
}): DashboardExportBundle {
  return {
    schemaVersion: DASHBOARD_EXPORT_SCHEMA_VERSION,
    exportedAt,
    source: 'bemtevi-dev-dashboard',
    changes: {
      flows: changedRecords(shipped.flows, drafts.flows),
      educationMaterials: changedRecords(shipped.educationMaterials, drafts.educationMaterials),
      educationGroups: changedRecords(shipped.educationGroups, drafts.educationGroups),
      contacts: changedRecords(shipped.contacts, drafts.contacts),
      defaultGroupOrder: drafts.defaultGroupOrder ?? 0,
      removedEducationGroupIds: drafts.removedEducationGroupIds ?? [],
      removedEducationMaterialIds: drafts.removedEducationMaterialIds ?? [],
      removedContactIds: drafts.removedContactIds ?? [],
    },
    validation,
  };
}

function changedRecords<T extends { id: string }>(shipped: T[], drafts: T[]) {
  const shippedById = new Map<string, string[]>();
  const draftOccurrencesById = new Map<string, number>();

  shipped.forEach((record) => {
    const occurrences = shippedById.get(record.id) ?? [];
    occurrences.push(normalizeForComparison(record));
    shippedById.set(record.id, occurrences);
  });

  return drafts.filter((draft) => {
    const occurrence = draftOccurrencesById.get(draft.id) ?? 0;
    draftOccurrencesById.set(draft.id, occurrence + 1);

    return shippedById.get(draft.id)?.[occurrence] !== normalizeForComparison(draft);
  });
}
