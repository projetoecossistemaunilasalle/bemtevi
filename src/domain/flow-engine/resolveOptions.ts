import type { FlowRuntimeState, GuidedFlow, RuntimeGlobalAction, RuntimeOption } from './types';
import { getActiveFlow } from './loadFlows';

export const globalFlowActions: RuntimeGlobalAction[] = [
  { kind: 'global_action', id: 'support-now', label: 'Quero apoio agora', target: '/apoio' },
  { kind: 'global_action', id: 'view-contacts', label: 'Ver contatos', target: '/contatos' },
  { kind: 'global_action', id: 'view-education', label: 'Ver materiais educativos', target: '/educacao' },
  { kind: 'global_action', id: 'end-now', label: 'Encerrar por enquanto', target: 'end' },
];

export function resolveOptions(state: FlowRuntimeState, flows: GuidedFlow[]): RuntimeOption[] {
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

  return [...currentNodeOptions, ...entryPhraseOptions, ...globalFlowActions];
}
