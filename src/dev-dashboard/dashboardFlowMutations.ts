import type { PublishedContentPayload } from '../app/content/publishedContent';
import type { GuidedFlow } from '../domain/flow-engine/types';
import { createLocalFlow, resolveRecordOrigin, updateRecordAtIndex, upsertPatchById } from './dashboardModel';
import type { DashboardDraftUpdater } from './dashboardMutationTypes';

export interface DashboardFlowMutationController {
  onFlowChange: (flowIndex: number, flowId: string, patch: Partial<GuidedFlow>) => void;
  onFlowAdd: () => void;
  onFlowImport: (flow: GuidedFlow) => void;
  onFlowRemove: (flowId: string) => void;
}

export function createDashboardFlowMutationController({
  shipped,
  updateDraftState,
}: {
  shipped: PublishedContentPayload;
  updateDraftState: DashboardDraftUpdater;
}): DashboardFlowMutationController {
  return {
    onFlowChange: (flowIndex, flowId, patch) =>
      updateDraftState((current) => {
        const origin = resolveRecordOrigin(
          shipped.flows,
          current.addedFlows,
          current.removedFlowIds ?? [],
          flowIndex,
          flowId,
        );
        if (!origin || origin.id !== flowId) return current;

        if (origin.kind === 'added') {
          return { ...current, addedFlows: updateRecordAtIndex(current.addedFlows, origin.addedIndex, patch) };
        }

        return {
          ...current,
          flowPatches: upsertPatchById(current.flowPatches, flowId, origin.sourceIndex, patch),
        };
      }),
    onFlowAdd: () =>
      updateDraftState((current) => ({
        ...current,
        addedFlows: [...current.addedFlows, createLocalFlow(current.addedFlows.length)],
      })),
    onFlowImport: (flow) =>
      updateDraftState((current) => {
        const addedIndex = current.addedFlows.findIndex((candidate) => candidate.id === flow.id);
        if (addedIndex >= 0) {
          return { ...current, addedFlows: updateRecordAtIndex(current.addedFlows, addedIndex, flow) };
        }

        const shippedIndex = shipped.flows.findIndex((candidate) => candidate.id === flow.id);
        if (shippedIndex >= 0) {
          const { id: _id, ...patch } = flow;
          return {
            ...current,
            flowPatches: upsertPatchById(current.flowPatches, flow.id, shippedIndex, patch),
            removedFlowIds: (current.removedFlowIds ?? []).filter((id) => id !== flow.id),
          };
        }

        return { ...current, addedFlows: [...current.addedFlows, flow] };
      }),
    onFlowRemove: (flowId) =>
      updateDraftState((current) => {
        const shippedIndex = shipped.flows.findIndex((flow) => flow.id === flowId);
        return {
          ...current,
          addedFlows: current.addedFlows.filter((flow) => flow.id !== flowId),
          removedFlowIds:
            shippedIndex >= 0 ? [...new Set([...(current.removedFlowIds ?? []), flowId])] : current.removedFlowIds,
        };
      }),
  };
}
