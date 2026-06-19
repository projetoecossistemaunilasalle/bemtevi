import { createInitialFlowState, createMessage, getActiveFlow, getFlowById } from './loadFlows';
import { resolveOptions } from './resolveOptions';
import { resumeFlow } from './resumeFlow';
import { suspendFlow } from './suspendFlow';
import type { FlowEffect, FlowNode, FlowRuntimeState, FlowStartFlowEffect, GuidedFlow, RuntimeOption } from './types';

export function advanceFlow(state: FlowRuntimeState, flows: GuidedFlow[], selectedLabel: string): FlowRuntimeState {
  const selectedOption = resolveOptions(state, flows).find((option) => option.label === selectedLabel);
  const activeNodeId = state.activeNodeId ?? 'none';

  if (!selectedOption) {
    const freeTextState = advanceFreeTextIfAvailable(state, flows, selectedLabel);

    if (freeTextState) {
      return freeTextState;
    }

    throw new Error(`Selection ${selectedLabel} is not available for node ${activeNodeId}.`);
  }

  if (selectedOption.kind === 'global_action' && selectedOption.target === 'end') {
    return endFlow(state, selectedOption.label);
  }

  if (selectedOption.kind === 'global_action') {
    return appendUserMessage(state, selectedOption, state.activeFlowId ?? 'global');
  }

  if (selectedOption.kind === 'resume_flow') {
    return resumeFlow(appendUserMessage(state, selectedOption, state.activeFlowId ?? 'global'), selectedOption.flowId);
  }

  if (selectedOption.kind === 'flow_start') {
    return startFlowWithoutSuspending(
      appendUserMessage(state, selectedOption, state.activeFlowId ?? 'global'),
      flows,
      selectedOption.flowId,
    );
  }

  if (selectedOption.kind === 'entry_phrase') {
    const suspended = suspendFlow(state);
    const nextFlow = getFlowById(flows, selectedOption.flowId);
    const nextState = createInitialFlowState(nextFlow, flows);

    return {
      ...nextState,
      transcript: [
        ...state.transcript,
        createMessage('user', selectedOption.label, state.activeFlowId ?? 'global', state.activeNodeId),
        ...nextState.transcript,
      ],
      suspendedFlows: suspended.suspendedFlows,
      safetyFlags: state.safetyFlags,
    };
  }

  const activeFlow = getActiveFlow(state, flows);
  const currentNodeId = state.activeNodeId ?? activeFlow.entry.nodeId;
  const currentNode = activeFlow.nodes[currentNodeId];
  const matchingOption =
    currentNode.kind === 'choice' ? currentNode.options.find((option) => option.id === selectedOption.id) : undefined;

  if (!matchingOption) {
    throw new Error(`Selection ${selectedLabel} is not available for node ${currentNodeId}.`);
  }

  const userMessage = createMessage('user', selectedOption.label, activeFlow.id, currentNodeId);
  const flowStartEffect = findFlowStartEffect(matchingOption.effects ?? []);
  const nonStartEffects = (matchingOption.effects ?? []).filter((effect) => effect.kind !== 'flow_start');
  const effectedState = applyOptionEffects(
    {
      ...state,
      transcript: [...state.transcript, userMessage],
      answers: {
        ...state.answers,
        [currentNodeId]: selectedOption.id,
      },
      pendingNavigation: undefined,
    },
    activeFlow.id,
    nonStartEffects,
  );

  if (effectedState.pendingNavigation) {
    return effectedState;
  }

  if (effectedState.activeFlowId === undefined) {
    return effectedState;
  }

  if (flowStartEffect) {
    return startFlowWithoutSuspending(effectedState, flows, flowStartEffect.flowId);
  }

  return advanceToNode(effectedState, activeFlow, matchingOption.next);
}

function endFlow(state: FlowRuntimeState, selectedLabel: string): FlowRuntimeState {
  const flowId = state.activeFlowId ?? 'global';

  return {
    ...state,
    activeFlowId: undefined,
    activeNodeId: undefined,
    transcript: [
      ...state.transcript,
      createMessage('user', selectedLabel, flowId, state.activeNodeId),
      createMessage('bot', 'Tudo bem. Você pode retomar uma orientação quando quiser.', flowId),
    ],
  };
}

function appendUserMessage(state: FlowRuntimeState, selectedOption: RuntimeOption, flowId: string): FlowRuntimeState {
  return {
    ...state,
    transcript: [...state.transcript, createMessage('user', selectedOption.label, flowId, state.activeNodeId)],
  };
}

function applyOptionEffects(state: FlowRuntimeState, flowId: string, effects: FlowEffect[]): FlowRuntimeState {
  return effects.reduce((nextState, effect) => {
    if (effect.kind === 'score') {
      return {
        ...nextState,
        scores: {
          ...nextState.scores,
          [effect.scoreKey]: (nextState.scores[effect.scoreKey] ?? 0) + effect.value,
        },
      };
    }

    if (effect.kind === 'safety_interrupt') {
      return {
        ...nextState,
        activeFlowId: undefined,
        activeNodeId: undefined,
        pendingNavigation: effect.destination,
        safetyFlags: {
          ...nextState.safetyFlags,
          ...(effect.blockResume ? { [`block-resume:${flowId}`]: true } : {}),
        },
        transcript: [...nextState.transcript, createMessage('bot', effect.message, flowId, nextState.activeNodeId)],
      };
    }

    if (effect.kind === 'navigate') {
      return {
        ...nextState,
        activeFlowId: undefined,
        activeNodeId: undefined,
        pendingNavigation: effect.destination,
      };
    }

    if (effect.kind === 'end_flow') {
      return {
        ...nextState,
        activeFlowId: undefined,
        activeNodeId: undefined,
        transcript: [...nextState.transcript, createMessage('bot', effect.message, flowId, nextState.activeNodeId)],
      };
    }

    return nextState;
  }, state);
}

function findFlowStartEffect(effects: FlowEffect[]): FlowStartFlowEffect | undefined {
  return effects.find((effect): effect is FlowStartFlowEffect => effect.kind === 'flow_start');
}

function startFlowWithoutSuspending(state: FlowRuntimeState, flows: GuidedFlow[], flowId: string): FlowRuntimeState {
  const nextFlow = getFlowById(flows, flowId);
  const nextState = createInitialFlowState(nextFlow, flows);

  return {
    ...nextState,
    transcript: [...state.transcript, ...nextState.transcript],
    suspendedFlows: state.suspendedFlows,
    safetyFlags: state.safetyFlags,
  };
}

function advanceToNode(state: FlowRuntimeState, flow: GuidedFlow, nodeId: string): FlowRuntimeState {
  const node = flow.nodes[nodeId];

  if (node.kind === 'score_branch') {
    return advanceToNode(state, flow, resolveScoreBranchNextNode(state, node));
  }

  return {
    ...state,
    activeNodeId: node.id,
    transcript: [...state.transcript, createMessage('bot', node.text, flow.id, node.id)],
  };
}

function resolveScoreBranchNextNode(state: FlowRuntimeState, node: Extract<FlowNode, { kind: 'score_branch' }>) {
  const score = state.scores[node.scoreKey] ?? 0;
  const branch = node.branches.find((candidate) => score >= candidate.min && score <= candidate.max);

  if (!branch) {
    throw new Error(`No score branch found for ${node.scoreKey} score ${score}.`);
  }

  return branch.next;
}

function advanceFreeTextIfAvailable(
  state: FlowRuntimeState,
  flows: GuidedFlow[],
  submittedText: string,
): FlowRuntimeState | undefined {
  if (!submittedText.trim()) return undefined;

  const activeFlow = getActiveFlow(state, flows);
  const currentNodeId = state.activeNodeId ?? activeFlow.entry.nodeId;
  const currentNode = activeFlow.nodes[currentNodeId];

  if (currentNode.kind !== 'choice' || currentNode.freeText === undefined) {
    return undefined;
  }

  const nextState = {
    ...state,
    transcript: [...state.transcript, createMessage('user', submittedText, activeFlow.id, currentNodeId)],
    answers: {
      ...state.answers,
      [currentNodeId]: 'free_text_submitted',
    },
    pendingNavigation: undefined,
  };

  return advanceToNode(nextState, activeFlow, currentNode.freeText.next);
}
