import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { normalizeForComparison } from '../content/normalize';

export interface RecordChangeCount {
  added: number;
  edited: number;
  removed: number;
}

export interface RecordChangeDetail {
  id: string;
  label: string;
  draftIndex?: number;
  baselineIndex?: number;
  changedFields?: string[];
}

export interface DetailedRecordChanges {
  counts: RecordChangeCount;
  added: RecordChangeDetail[];
  edited: RecordChangeDetail[];
  removed: RecordChangeDetail[];
}

export interface DashboardChangeSummary {
  flows: RecordChangeCount;
  materials: RecordChangeCount;
  groups: RecordChangeCount;
  contacts: RecordChangeCount;
  locations: RecordChangeCount;
  defaultGroupOrderChanged: boolean;
  total: number;
}

export interface DetailedChangeSummary extends DashboardChangeSummary {
  details: {
    flows: DetailedRecordChanges;
    materials: DetailedRecordChanges;
    groups: DetailedRecordChanges;
    contacts: DetailedRecordChanges;
    locations: DetailedRecordChanges;
  };
}

export function computeChangeSummary(
  baseline: PublishedContentPayload,
  draft: PublishedContentPayload,
): DashboardChangeSummary {
  const flows = countRecordChanges(baseline.flows, draft.flows);
  const materials = countRecordChanges(baseline.educationMaterials, draft.educationMaterials);
  const groups = countRecordChanges(baseline.educationGroups, draft.educationGroups);
  const contacts = countRecordChanges(baseline.contacts, draft.contacts);
  const locations = countRecordChanges(baseline.locations, draft.locations);
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
    locations.added +
    locations.edited +
    locations.removed +
    (defaultGroupOrderChanged ? 1 : 0);

  return { flows, materials, groups, contacts, locations, defaultGroupOrderChanged, total };
}

export function computeDetailedChangeSummary(
  baseline: PublishedContentPayload,
  draft: PublishedContentPayload,
): DetailedChangeSummary {
  const summary = computeChangeSummary(baseline, draft);
  const flows = collectDetailedChanges(baseline.flows, draft.flows, (r: (typeof baseline.flows)[number]) =>
    r.title?.trim() ? r.title : r.id,
  );
  const materials = collectDetailedChanges(
    baseline.educationMaterials,
    draft.educationMaterials,
    (r: (typeof baseline.educationMaterials)[number]) => (r.title?.trim() ? r.title : r.id),
  );
  const groups = collectDetailedChanges(
    baseline.educationGroups,
    draft.educationGroups,
    (r: (typeof baseline.educationGroups)[number]) => (r.title?.trim() ? r.title : r.id),
  );
  const contacts = collectDetailedChanges(baseline.contacts, draft.contacts, (r: (typeof baseline.contacts)[number]) =>
    r.name?.trim() ? r.name : r.id,
  );
  const locations = collectDetailedChanges(
    baseline.locations,
    draft.locations,
    (r: (typeof baseline.locations)[number]) => {
      const label = `${r.city ?? ''} - ${r.state ?? ''}`.trim();
      return label && label !== '-' ? label : r.id;
    },
  );

  return {
    ...summary,
    details: { flows, materials, groups, contacts, locations },
  };
}

function diffRecordFields(baseline: Record<string, unknown>, draft: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(draft)]);
  const changed: string[] = [];
  keys.forEach((key) => {
    if (key === 'id') return;
    const a = normalizeForComparison(baseline[key]);
    const b = normalizeForComparison(draft[key]);
    if (a !== b) changed.push(key);
  });
  return changed;
}

function collectDetailedChanges<T extends { id: string }>(
  baseline: T[],
  draft: T[],
  getLabel: (record: T) => string,
): DetailedRecordChanges {
  const baselineById = new Map<string, Array<{ record: T; normalized: string; index: number }>>();
  baseline.forEach((record, index) => {
    const list = baselineById.get(record.id) ?? [];
    list.push({ record, normalized: normalizeForComparison(record), index });
    baselineById.set(record.id, list);
  });

  const draftCountById = new Map<string, number>();
  const added: RecordChangeDetail[] = [];
  const edited: RecordChangeDetail[] = [];

  draft.forEach((record, draftIndex) => {
    const occurrence = draftCountById.get(record.id) ?? 0;
    draftCountById.set(record.id, occurrence + 1);
    const baselineOcc = baselineById.get(record.id)?.[occurrence];
    if (!baselineOcc) {
      added.push({ id: record.id, label: getLabel(record), draftIndex });
    } else if (baselineOcc.normalized !== normalizeForComparison(record)) {
      const changedFields = diffRecordFields(
        baselineOcc.record as unknown as Record<string, unknown>,
        record as unknown as Record<string, unknown>,
      );
      edited.push({
        id: record.id,
        label: getLabel(record),
        draftIndex,
        baselineIndex: baselineOcc.index,
        changedFields,
      });
    }
  });

  const removed: RecordChangeDetail[] = [];
  baselineById.forEach((occurrences, id) => {
    const draftCount = draftCountById.get(id) ?? 0;
    if (draftCount < occurrences.length) {
      for (let i = draftCount; i < occurrences.length; i++) {
        const occ = occurrences[i];
        removed.push({ id, label: getLabel(occ.record), baselineIndex: occ.index });
      }
    }
  });

  const counts: RecordChangeCount = {
    added: added.length,
    edited: edited.length,
    removed: removed.length,
  };

  return { counts, added, edited, removed };
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
