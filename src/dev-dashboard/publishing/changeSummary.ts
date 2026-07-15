import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { normalizeForComparison } from '../content/normalize';

export interface RecordChangeCount {
  added: number;
  edited: number;
  removed: number;
}

export interface DashboardChangeSummary {
  flows: RecordChangeCount;
  materials: RecordChangeCount;
  groups: RecordChangeCount;
  contacts: RecordChangeCount;
  defaultGroupOrderChanged: boolean;
  total: number;
}

export function computeChangeSummary(
  baseline: PublishedContentPayload,
  draft: PublishedContentPayload,
): DashboardChangeSummary {
  const flows = countRecordChanges(baseline.flows, draft.flows);
  const materials = countRecordChanges(baseline.educationMaterials, draft.educationMaterials);
  const groups = countRecordChanges(baseline.educationGroups, draft.educationGroups);
  const contacts = countRecordChanges(baseline.contacts, draft.contacts);
  const defaultGroupOrderChanged = baseline.defaultGroupOrder !== draft.defaultGroupOrder;

  const total =
    flows.added +
    flows.edited +
    flows.removed +
    materials.added +
    materials.edited +
    materials.removed +
    groups.added +
    groups.edited +
    groups.removed +
    contacts.added +
    contacts.edited +
    contacts.removed +
    (defaultGroupOrderChanged ? 1 : 0);

  return { flows, materials, groups, contacts, defaultGroupOrderChanged, total };
}

export function countRecordChanges<T extends { id: string }>(baseline: T[], draft: T[]): RecordChangeCount {
  const baselineOccurrencesById = new Map<string, string[]>();
  baseline.forEach((record) => {
    const occurrences = baselineOccurrencesById.get(record.id) ?? [];
    occurrences.push(normalizeForComparison(record));
    baselineOccurrencesById.set(record.id, occurrences);
  });

  const draftOccurrencesById = new Map<string, number>();
  let added = 0;
  let edited = 0;

  draft.forEach((record) => {
    const occurrence = draftOccurrencesById.get(record.id) ?? 0;
    draftOccurrencesById.set(record.id, occurrence + 1);

    const baselineOccurrence = baselineOccurrencesById.get(record.id)?.[occurrence];
    if (baselineOccurrence === undefined) {
      added += 1;
    } else if (baselineOccurrence !== normalizeForComparison(record)) {
      edited += 1;
    }
  });

  let removed = 0;
  baselineOccurrencesById.forEach((occurrences, id) => {
    const draftCount = draftOccurrencesById.get(id) ?? 0;
    if (draftCount < occurrences.length) {
      removed += occurrences.length - draftCount;
    }
  });

  return { added, edited, removed };
}
