import type { ChatMessage, FlowRuntimeState, GuidedFlow } from './types';
import { validateFlow } from './validateFlow';

let messageCounter = 0;

export function createMessage(sender: ChatMessage['sender'], text: string, flowId: string, nodeId?: string): ChatMessage {
  messageCounter += 1;

  return {
    id: `${flowId}-${messageCounter}`,
    sender,
    text,
    flowId,
    nodeId,
  };
}

export function getFlowById(flows: GuidedFlow[], flowId: string) {
  const flow = flows.find((candidate) => candidate.id === flowId);

  if (!flow) {
    throw new Error(`Flow ${flowId} was not found.`);
  }

  return flow;
}

export function getActiveFlow(state: FlowRuntimeState, flows: GuidedFlow[]) {
  if (!state.activeFlowId) {
    throw new Error('No active flow is selected.');
  }

  return getFlowById(flows, state.activeFlowId);
}

export function createInitialFlowState(flow: GuidedFlow, flows: GuidedFlow[]): FlowRuntimeState {
  const validation = validateFlow(flow);

  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const node = flow.nodes[flow.entry.nodeId];

  return {
    activeFlowId: flow.id,
    activeNodeId: flow.entry.nodeId,
    transcript: [
      createMessage('bot', flow.entry.transitionMessage, flow.id, flow.entry.nodeId),
      createMessage('bot', node.text, flow.id, node.id),
    ],
    suspendedFlows: {},
    answers: {},
    scores: {},
    safetyFlags: {},
  };
}

export function createInitialFlowStateFromRegistry(flows: GuidedFlow[], preferredFlowId?: string): FlowRuntimeState {
  const flow = preferredFlowId ? getFlowById(flows, preferredFlowId) : flows[0];

  if (!flow) {
    throw new Error('At least one guided flow is required.');
  }

  return createInitialFlowState(flow, flows);
}
