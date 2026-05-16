import type { FlowRuntimeState } from './types';

export function canResumeFlow(state: FlowRuntimeState, flowId: string) {
  return !state.safetyFlags[`block-resume:${flowId}`];
}
