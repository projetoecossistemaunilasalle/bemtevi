import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import { normalizeForComparison } from '../content/normalize';
import type { DashboardShippedContent } from '../content/shippedContent';
import type { DashboardValidationResult } from '../validation/validationTypes';

export const DASHBOARD_EXPORT_SCHEMA_VERSION = '2.0.0' as const;

export interface DashboardDraftContent {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
  educationGroups: EducationResourceGroup[];
  defaultGroupOrder?: number;
  removedEducationGroupIds?: string[];
}

export interface DashboardExportBundle {
  schemaVersion: typeof DASHBOARD_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  source: 'secuida-dev-dashboard';
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
    source: 'secuida-dev-dashboard',
    changes: {
      flows: changedRecords(shipped.flows, drafts.flows),
      educationMaterials: changedRecords(shipped.educationMaterials, drafts.educationMaterials),
      educationGroups: changedRecords(shipped.educationGroups, drafts.educationGroups),
      defaultGroupOrder: drafts.defaultGroupOrder ?? 0,
      removedEducationGroupIds: drafts.removedEducationGroupIds ?? [],
    },
    validation,
  };
}

function changedRecords<T extends { id: string }>(shipped: T[], drafts: T[]) {
  const shippedById = new Map(shipped.map((record) => [record.id, normalizeForComparison(record)]));

  return drafts.filter((draft) => shippedById.get(draft.id) !== normalizeForComparison(draft));
}
