import type { GuidedFlow } from '../domain/flow-engine/types';
import type { EducationResourceGroup } from '../content/resources/groups';
import { deriveLocationsFromContacts, normalizeContactLocations } from '../domain/services/locations';
import type { DashboardShippedContent } from './content/shippedContent';
import type { DashboardDraftState, DashboardRecordPatch } from './dashboardDraftState';

/**
 * Pure draft merge/sanitization helpers extracted from
 * `draft-storage/dashboardStorage.ts` (LEGACY-00). No browser storage.
 */

export function mergeDashboardDrafts(shipped: DashboardShippedContent, drafts: DashboardDraftState) {
  // A remote refresh must never change the ancestry or the local editing result.
  shipped = drafts.basePayload ?? shipped;
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
  const hasLegacyLocationPatches = legacyLocationPatchIds.size > 0;
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
    allowDerivation: !Array.isArray(shipped.locations) && !hasLegacyLocationPatches,
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
      const isUniqueInShipped = shippedIdCounts.get(record.id) === 1;
      const isUniqueInPatches = indexedPatchIdCounts.get(record.id) === 1;
      const canFallbackById =
        !exactPatch && isUniqueInShipped && isUniqueInPatches && uniqueIdPatch?.sourceIdUnique === true;
      const fallbackPatch = canFallbackById ? uniqueIdPatch : undefined;
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
