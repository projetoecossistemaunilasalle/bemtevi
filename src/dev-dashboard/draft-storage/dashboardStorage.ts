import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { deriveLocationsFromContacts, normalizeContactLocations } from '../../domain/services/locations';
import type { DashboardShippedContent } from '../content/shippedContent';

const STORAGE_KEY = 'bemtevi:dev-dashboard:drafts:v1';
export const DASHBOARD_DRAFT_SCHEMA_VERSION = '5.0.0' as const;

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

function preserveNonZeroDefaultGroupOrder(value: unknown): number | undefined {
  return typeof value === 'number' && value !== 0 ? value : undefined;
}

export function hasDashboardChanges(state: DashboardDraftState) {
  return (
    [
      state.flowPatches,
      state.educationMaterialPatches,
      state.groupPatches,
      state.contactPatches,
      state.locationPatches,
      state.addedFlows,
      state.addedEducationMaterials,
      state.addedGroups,
      state.addedContacts,
      state.addedLocations,
      state.removedGroupIds,
      state.removedFlowIds,
      state.removedEducationMaterialIds,
      state.removedContactIds,
      state.removedLocationIds,
    ].some((records) => Array.isArray(records) && records.length > 0) || state.defaultGroupOrder !== undefined
  );
}

export function loadDashboardDrafts(storage: Storage = localStorage): DashboardDraftState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyDashboardDraftState();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return createEmptyDashboardDraftState();

    const record = parsed as Record<string, unknown>;
    const version = record.schemaVersion;
    let state: DashboardDraftState;

    if (version === '1.0.0' || version === '2.0.0') {
      state = {
        ...(record as Record<string, unknown>),
        schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
        groupPatches: (record.groupPatches ?? []) as DashboardRecordPatch<EducationResourceGroup>[],
        addedGroups: (record.addedGroups ?? []) as EducationResourceGroup[],
        defaultGroupOrder: preserveNonZeroDefaultGroupOrder(record.defaultGroupOrder),
        removedGroupIds: (record.removedGroupIds ?? []) as string[],
        removedFlowIds: (record.removedFlowIds ?? []) as string[],
        contactPatches: [],
        addedContacts: [],
        removedContactIds: [],
        locationPatches: [],
        addedLocations: [],
        removedLocationIds: [],
      } as DashboardDraftState;
    } else if (version === '3.0.0' || version === '4.0.0' || version === DASHBOARD_DRAFT_SCHEMA_VERSION) {
      const result = parsed as DashboardDraftState;
      state = {
        ...result,
        schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
        defaultGroupOrder:
          version === '3.0.0'
            ? preserveNonZeroDefaultGroupOrder(result.defaultGroupOrder)
            : typeof result.defaultGroupOrder === 'number'
              ? result.defaultGroupOrder
              : undefined,
        contactPatches: Array.isArray(result.contactPatches) ? result.contactPatches : [],
        addedContacts: Array.isArray(result.addedContacts) ? result.addedContacts : [],
        locationPatches: Array.isArray(result.locationPatches) ? result.locationPatches : [],
        addedLocations: Array.isArray(result.addedLocations) ? result.addedLocations : [],
        removedGroupIds: result.removedGroupIds ?? [],
        removedFlowIds: result.removedFlowIds ?? [],
        removedContactIds: Array.isArray(result.removedContactIds) ? result.removedContactIds : [],
        removedLocationIds: Array.isArray(result.removedLocationIds) ? result.removedLocationIds : [],
      };
    } else {
      return createEmptyDashboardDraftState();
    }

    // Sanitize flow drafts to clean up any legacy/accidental empty effects on load
    if (Array.isArray(state.flowPatches)) {
      state.flowPatches = state.flowPatches.map((patchRecord) => {
        if (patchRecord.patch) {
          return {
            ...patchRecord,
            patch: sanitizeFlow(patchRecord.patch as GuidedFlow),
          };
        }
        return patchRecord;
      });
    }
    if (Array.isArray(state.addedFlows)) {
      state.addedFlows = state.addedFlows.map(sanitizeFlow);
    }
    if (state.baseRevision !== null && (!Number.isSafeInteger(state.baseRevision) || Number(state.baseRevision) <= 0)) {
      state.baseRevision = hasDashboardChanges(state) ? null : undefined;
    }

    return state;
  } catch {
    return createEmptyDashboardDraftState();
  }
}

export function saveDashboardDrafts(state: DashboardDraftState, storage: Storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetDashboardDrafts(storage: Storage = localStorage) {
  const empty = createEmptyDashboardDraftState();
  storage.removeItem(STORAGE_KEY);
  return empty;
}

export function clearDashboardDrafts(storage: Storage = localStorage) {
  resetDashboardDrafts(storage);
}

export function mergeDashboardDrafts(shipped: DashboardShippedContent, drafts: DashboardDraftState) {
  const removedGroupIds = new Set(drafts.removedGroupIds ?? []);
  const educationGroups = mergeRecords(shipped.educationGroups, drafts.groupPatches, drafts.addedGroups).filter(
    (group) => !removedGroupIds.has(group.id),
  );

  const removedFlowIds = new Set(drafts.removedFlowIds ?? []);
  const flows = mergeRecords(shipped.flows, drafts.flowPatches, drafts.addedFlows).filter(
    (flow) => !removedFlowIds.has(flow.id),
  );

  const removedContactIds = new Set(drafts.removedContactIds ?? []);
  const contacts = mergeRecords(shipped.contacts, drafts.contactPatches, drafts.addedContacts).filter(
    (contact) => !removedContactIds.has(contact.id),
  );

  const shippedLocations = Array.isArray(shipped.locations)
    ? shipped.locations
    : deriveLocationsFromContacts(shipped.contacts);
  const removedLocationIds = new Set(drafts.removedLocationIds ?? []);
  const mergedLocations = mergeRecords(
    shippedLocations,
    drafts.locationPatches ?? [],
    drafts.addedLocations ?? [],
  ).filter((location) => !removedLocationIds.has(location.id));
  const legacyLocationPatchIds = new Set(
    drafts.contactPatches
      .filter(
        ({ patch }) =>
          !Object.prototype.hasOwnProperty.call(patch, 'locationId') &&
          (Object.prototype.hasOwnProperty.call(patch, 'city') || Object.prototype.hasOwnProperty.call(patch, 'state')),
      )
      .map(({ id }) => id),
  );
  const explicitlyPatchedLocationIds = new Set((drafts.locationPatches ?? []).map(({ id }) => id));
  const preservedContactIndexes = new Set<number>();
  contacts.forEach((contact, index) => {
    if (
      legacyLocationPatchIds.has(contact.id) &&
      !explicitlyPatchedLocationIds.has(typeof contact.locationId === 'string' ? contact.locationId : '')
    ) {
      preservedContactIndexes.add(index);
    }
  });
  const normalized = normalizeContactLocations(contacts, mergedLocations, {
    allowDerivation: !Array.isArray(shipped.locations),
    preserveDenormalizedContactIndexes: preservedContactIndexes,
  });

  const removedEducationMaterialIds = new Set(drafts.removedEducationMaterialIds ?? []);
  const educationMaterials = mergeRecords(
    shipped.educationMaterials,
    drafts.educationMaterialPatches,
    drafts.addedEducationMaterials,
  ).filter((material) => !removedEducationMaterialIds.has(material.id));

  return {
    flows,
    educationMaterials,
    educationGroups: sortGroupsByOrder(educationGroups),
    contacts: normalized.contacts,
    locations: normalized.locations,
    defaultGroupOrder: drafts.defaultGroupOrder ?? shipped.defaultGroupOrder ?? 0,
  };
}

export function sanitizeFlow(flow: GuidedFlow): GuidedFlow {
  if (!flow.nodes) return flow;
  const nextNodes = { ...flow.nodes };

  for (const nodeId in nextNodes) {
    const node = nextNodes[nodeId];
    if (node.kind === 'choice' && Array.isArray(node.options)) {
      const nextOptions = node.options.map((option) => {
        if (!Array.isArray(option.effects)) return option;

        const nextEffects = option.effects.filter((effect) => {
          if (effect.kind === 'score') {
            return (
              typeof effect.scoreKey === 'string' &&
              effect.scoreKey.trim().length > 0 &&
              typeof effect.value === 'number' &&
              !isNaN(effect.value)
            );
          }
          if (effect.kind === 'deferred_safety') {
            return (
              typeof effect.flagKey === 'string' &&
              effect.flagKey.trim().length > 0 &&
              typeof effect.message === 'string' &&
              effect.message.trim().length > 0 &&
              ['/apoio', '/contatos', '/educacao'].includes(effect.destination)
            );
          }
          if (effect.kind === 'safety_interrupt') {
            return (
              typeof effect.message === 'string' &&
              effect.message.trim().length > 0 &&
              typeof effect.destination === 'string' &&
              effect.destination.trim().length > 0
            );
          }
          return true; // Keep other kinds of effects (like flow_start)
        });

        const cleanedOption = { ...option };
        if (nextEffects.length > 0) {
          cleanedOption.effects = nextEffects;
        } else {
          delete cleanedOption.effects;
        }
        return cleanedOption;
      });

      nextNodes[nodeId] = {
        ...node,
        options: nextOptions,
      };
    }
  }

  return {
    ...flow,
    nodes: nextNodes,
  };
}

function sortGroupsByOrder(groups: EducationResourceGroup[]) {
  return [...groups].sort((left, right) => left.order - right.order);
}

function mergeRecords<T extends { id: string }>(shipped: T[], patches: Array<DashboardRecordPatch<T>>, additions: T[]) {
  const indexedPatches = patches.filter((record) => typeof record.sourceIndex === 'number');
  const patchesBySource = new Map(indexedPatches.map((record) => [`${record.id}:${record.sourceIndex}`, record]));
  const shippedIdCounts = countRecordsById(shipped);
  const indexedPatchIdCounts = countRecordsById(indexedPatches);
  const indexedPatchesById = new Map(indexedPatches.map((record) => [record.id, record]));
  const legacyPatchesById = new Map(
    patches.filter((record) => typeof record.sourceIndex !== 'number').map((record) => [record.id, record.patch]),
  );
  const usedIndexedPatches = new Set<DashboardRecordPatch<T>>();
  const usedLegacyPatchIds = new Set<string>();

  return [
    ...shipped.map((record, sourceIndex) => {
      const sourcePatch = patchesBySource.get(`${record.id}:${sourceIndex}`);
      const exactPatch =
        sourcePatch?.sourceIdUnique === false && shippedIdCounts.get(record.id) === 1 ? undefined : sourcePatch;
      const uniqueIdPatch = indexedPatchesById.get(record.id);
      const fallbackPatch =
        exactPatch ||
        shippedIdCounts.get(record.id) !== 1 ||
        indexedPatchIdCounts.get(record.id) !== 1 ||
        uniqueIdPatch?.sourceIdUnique !== true
          ? undefined
          : uniqueIdPatch;
      const candidatePatch = exactPatch ?? fallbackPatch;
      const indexedPatch = candidatePatch && !usedIndexedPatches.has(candidatePatch) ? candidatePatch : undefined;
      const legacyPatch =
        indexedPatch || usedLegacyPatchIds.has(record.id) ? undefined : legacyPatchesById.get(record.id);

      if (indexedPatch) usedIndexedPatches.add(indexedPatch);
      if (legacyPatch) usedLegacyPatchIds.add(record.id);

      return {
        ...record,
        ...(indexedPatch?.patch ?? legacyPatch),
      };
    }),
    ...additions,
  ];
}

function countRecordsById(records: Array<{ id: string }>) {
  const counts = new Map<string, number>();
  records.forEach((record) => counts.set(record.id, (counts.get(record.id) ?? 0) + 1));
  return counts;
}
