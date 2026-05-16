import type { FlowRuntimeState } from './types';

export function suspendFlow(state: FlowRuntimeState): FlowRuntimeState {
  if (!state.activeFlowId || !state.activeNodeId) {
    return state;
  }

  return {
    ...state,
    suspendedFlows: {
      ...state.suspendedFlows,
      [state.activeFlowId]: {
        flowId: state.activeFlowId,
        nodeId: state.activeNodeId,
        answers: state.answers,
        transcript: state.transcript,
      },
    },
  };
}
