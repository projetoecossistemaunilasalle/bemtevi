import { createInitialFlowState, createMessage, getActiveFlow, getFlowById } from './loadFlows';
import { resolveOptions } from './resolveOptions';
import { suspendFlow } from './suspendFlow';
import type { FlowRuntimeState, GuidedFlow, RuntimeOption } from './types';

export function advanceFlow(state: FlowRuntimeState, flows: GuidedFlow[], selectedLabel: string): FlowRuntimeState {
  const selectedOption = resolveOptions(state, flows).find((option) => option.label === selectedLabel);
  const activeNodeId = state.activeNodeId ?? 'none';

  if (!selectedOption) {
    throw new Error(`Selection ${selectedLabel} is not available for node ${activeNodeId}.`);
  }

  if (selectedOption.kind === 'global_action') {
    return appendUserMessage(state, selectedOption, state.activeFlowId ?? 'global');
  }

  if (selectedOption.kind === 'entry_phrase') {
    const suspended = suspendFlow(state);
    const nextFlow = getFlowById(flows, selectedOption.flowId);
    const nextState = createInitialFlowState(nextFlow, flows);

    return {
      ...nextState,
      suspendedFlows: suspended.suspendedFlows,
    };
  }

  const activeFlow = getActiveFlow(state, flows);
  const nextNode = activeFlow.nodes[selectedOption.next];
  const userMessage = createMessage('user', selectedOption.label, activeFlow.id, state.activeNodeId);
  const botMessage = createMessage('bot', nextNode.text, activeFlow.id, nextNode.id);

  return {
    ...state,
    activeNodeId: nextNode.id,
    transcript: [...state.transcript, userMessage, botMessage],
    answers: {
      ...state.answers,
      [state.activeNodeId ?? activeFlow.entry.nodeId]: selectedOption.id,
    },
  };
}

function appendUserMessage(state: FlowRuntimeState, selectedOption: RuntimeOption, flowId: string): FlowRuntimeState {
  return {
    ...state,
    transcript: [...state.transcript, createMessage('user', selectedOption.label, flowId, state.activeNodeId)],
  };
}
