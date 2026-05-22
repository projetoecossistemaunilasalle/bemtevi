import type { ChatMessage, FlowRuntimeState, FlowStartFlowEffect, GuidedFlow } from './types';
import { validateFlow } from './validateFlow';

let messageCounter = 0;

export function createMessage(
  sender: ChatMessage['sender'],
  text: string,
  flowId: string,
  nodeId?: string,
): ChatMessage {
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

export function createInitialFlowState(flow: GuidedFlow, _flows: GuidedFlow[]): FlowRuntimeState {
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
    pendingNavigation: undefined,
  };
}

export function createInitialFlowStateFromRegistry(flows: GuidedFlow[], preferredFlowId?: string): FlowRuntimeState {
  validateRegisteredFlows(flows);

  const flow = preferredFlowId ? getFlowById(flows, preferredFlowId) : flows[0];

  if (!flow) {
    throw new Error('At least one guided flow is required.');
  }

  return createInitialFlowState(flow, flows);
}

export function validateRegisteredFlows(flows: GuidedFlow[]) {
  const flowIds = new Set(flows.map((flow) => flow.id));
  const errors = [
    ...flows.flatMap((flow) => validateFlow(flow).errors),
    ...flows.flatMap((flow) => validateFlowStartTargets(flow, flowIds)),
  ];

  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}

function validateFlowStartTargets(flow: GuidedFlow, flowIds: Set<string>) {
  return Object.values(flow.nodes).flatMap((node) => {
    if (node.kind !== 'choice') return [];

    return node.options.flatMap((option) =>
      (option.effects ?? [])
        .filter((effect): effect is FlowStartFlowEffect => effect.kind === 'flow_start')
        .filter((effect) => !flowIds.has(effect.flowId))
        .map((effect) => `Flow ${flow.id} option ${option.id} starts missing flow ${effect.flowId}.`),
    );
  });
}
