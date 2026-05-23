import type { FlowRuntimeState, GuidedFlow, RuntimeFlowStartOption, RuntimeGlobalAction, RuntimeOption } from './types';
import { getActiveFlow } from './loadFlows';
import { canResumeFlow } from './safetyRules';

export const globalFlowActions: RuntimeGlobalAction[] = [
  { kind: 'global_action', id: 'support-now', label: 'Quero apoio agora', target: '/apoio' },
  { kind: 'global_action', id: 'view-contacts', label: 'Ver contatos', target: '/contatos' },
  { kind: 'global_action', id: 'view-education', label: 'Ver materiais educativos', target: '/educacao' },
  { kind: 'global_action', id: 'end-now', label: 'Encerrar por enquanto', target: 'end' },
];

const postFlowStartOption: RuntimeFlowStartOption = {
  kind: 'flow_start',
  id: 'post-flow-next-step-start',
  label: 'Escolher o que fazer agora',
  flowId: 'post-flow-next-step',
};

export function resolveOptions(state: FlowRuntimeState, flows: GuidedFlow[]): RuntimeOption[] {
  if (!state.activeFlowId || !state.activeNodeId) {
    return globalFlowActions.filter((action) => action.target !== 'end');
  }

  const activeFlow = getActiveFlow(state, flows);
  const activeNode = state.activeNodeId ? activeFlow.nodes[state.activeNodeId] : undefined;
  const currentNodeOptions: RuntimeOption[] =
    activeNode?.kind === 'choice'
      ? activeNode.options.map((option) => ({
          kind: 'node_option',
          id: option.id,
          label: option.label,
          flowId: activeFlow.id,
          next: option.next,
          effects: option.effects,
        }))
      : [];

  const entryPhraseOptions: RuntimeOption[] = flows
    .filter((flow) => flow.id !== activeFlow.id)
    .flatMap((flow) =>
      flow.entry.enteringPhrases.map((phrase, index) => ({
        kind: 'entry_phrase',
        id: `${flow.id}-entry-${index}`,
        label: phrase,
        flowId: flow.id,
      })),
    );

  const resumeOptions: RuntimeOption[] =
    activeNode?.kind === 'result'
      ? Object.values(state.suspendedFlows)
          .filter((suspendedFlow) => canResumeFlow(state, suspendedFlow.flowId))
          .map((suspendedFlow) => {
            const flow = flows.find((candidate) => candidate.id === suspendedFlow.flowId);
            return {
              kind: 'resume_flow',
              id: `resume-${suspendedFlow.flowId}`,
              label: `Retomar ${flow?.title ?? suspendedFlow.flowId}`,
              flowId: suspendedFlow.flowId,
            };
          })
      : [];

  const postFlowOptions: RuntimeOption[] =
    activeNode?.kind === 'result' && activeFlow.purpose === undefined
      ? flows.some((flow) => flow.id === postFlowStartOption.flowId)
        ? [postFlowStartOption]
        : []
      : [];

  return [...currentNodeOptions, ...entryPhraseOptions, ...resumeOptions, ...postFlowOptions, ...globalFlowActions];
}
