import type { FlowRuntimeState } from './types';
import { canResumeFlow } from './safetyRules';

export function resumeFlow(state: FlowRuntimeState, flowId: string): FlowRuntimeState {
  const suspendedFlow = state.suspendedFlows[flowId];

  if (!suspendedFlow) {
    throw new Error(`Flow ${flowId} is not suspended.`);
  }

  if (!canResumeFlow(state, flowId)) {
    throw new Error(`Flow ${flowId} cannot be resumed right now.`);
  }

  const { [flowId]: _resumed, ...remainingSuspendedFlows } = state.suspendedFlows;

  return {
    ...state,
    activeFlowId: suspendedFlow.flowId,
    activeNodeId: suspendedFlow.nodeId,
    transcript: suspendedFlow.transcript,
    answers: suspendedFlow.answers,
    suspendedFlows: remainingSuspendedFlows,
  };
}
