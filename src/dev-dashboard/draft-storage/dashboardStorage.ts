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
  defaultGroupOrder?: number;
  removedGroupIds?: string[];
  removedFlowIds?: string[];
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
    defaultGroupOrder: 0,
    removedGroupIds: [],
    removedFlowIds: [],
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
    let state: DashboardDraftState;

    if (version === '1.0.0') {
      state = {
        ...(record as Record<string, unknown>),
        schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
        groupPatches: (record.groupPatches ?? []) as DashboardRecordPatch<EducationResourceGroup>[],
        addedGroups: (record.addedGroups ?? []) as EducationResourceGroup[],
        defaultGroupOrder: (record.defaultGroupOrder ?? 0) as number,
        removedGroupIds: (record.removedGroupIds ?? []) as string[],
        removedFlowIds: (record.removedFlowIds ?? []) as string[],
      } as DashboardDraftState;
    } else if (version !== DASHBOARD_DRAFT_SCHEMA_VERSION) {
      return createEmptyDashboardDraftState();
    } else {
      const result = parsed as DashboardDraftState;
      state = {
        ...result,
        removedFlowIds: result.removedFlowIds ?? [],
      };
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

    return state;
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
  const removedGroupIds = new Set(drafts.removedGroupIds ?? []);
  const educationGroups = mergeRecords(shipped.educationGroups, drafts.groupPatches, drafts.addedGroups).filter(
    (group) => !removedGroupIds.has(group.id),
  );

  const removedFlowIds = new Set(drafts.removedFlowIds ?? []);
  const flows = mergeRecords(shipped.flows, drafts.flowPatches, drafts.addedFlows).filter(
    (flow) => !removedFlowIds.has(flow.id),
  );

  return {
    flows,
    educationMaterials: mergeRecords(
      shipped.educationMaterials,
      drafts.educationMaterialPatches,
      drafts.addedEducationMaterials,
    ),
    educationGroups: sortGroupsByOrder(educationGroups),
    defaultGroupOrder: drafts.defaultGroupOrder ?? 0,
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
