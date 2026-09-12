import { useState } from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { NodeEditorPanel } from '../NodeEditorPanel';
import type {
  ChoiceFlowNode,
  FlowNode,
  GuidedFlow,
  ResultFlowNode,
  ScoreBranchFlowNode,
} from '../../../domain/flow-engine/types';

export const choiceNode: ChoiceFlowNode = {
  id: 'q1',
  kind: 'choice',
  text: 'Como você está?',
  options: [{ id: 'q1-option-1', label: 'Ok', next: 'fim' }],
};

export const resultNode: ResultFlowNode = { id: 'fim', kind: 'result', text: 'Fim.' };

export function createFlow(overrides: Partial<GuidedFlow> = {}): GuidedFlow {
  return {
    id: 'flow-1',
    version: '1',
    locale: 'pt-BR',
    title: 'Fluxo de teste',
    type: 'guided_conversation',
    status: 'draft',
    entry: { nodeId: 'q1', enteringPhrases: ['oi'], transitionMessage: 'Vamos começar.' },
    nodes: { q1: choiceNode, fim: resultNode },
    nodeOrder: ['q1', 'fim'],
    ...overrides,
  };
}

export function makePanelProps(
  flow: GuidedFlow = createFlow(),
  nodeId = 'q1',
  overrides: Partial<{ flows: GuidedFlow[]; onFlowChange: (patch: Partial<GuidedFlow>) => void }> = {},
) {
  return {
    flow,
    flows: [flow],
    nodeId,
    onFlowChange: vi.fn(),
    onClose: vi.fn(),
    onEditLegacy: vi.fn(),
    ...overrides,
  };
}

export type PanelProps = ReturnType<typeof makePanelProps>;

export function renderPanel(flow: GuidedFlow = createFlow(), nodeId = 'q1') {
  const props = makePanelProps(flow, nodeId);
  render(<NodeEditorPanel {...props} />);
  return props;
}

export function lastPatch(mock: PanelProps['onFlowChange']): Partial<GuidedFlow> {
  const calls = (mock as ReturnType<typeof vi.fn>).mock.calls as Array<[Partial<GuidedFlow>]>;
  return calls.at(-1)?.[0] as Partial<GuidedFlow>;
}

export type PatchHistory = Array<{ patch: Partial<GuidedFlow>; applied: GuidedFlow }>;

/** Stateful host shared by tests that verify successive commits compose. */
export function renderStatefulPanel(
  initialFlow: GuidedFlow,
  nodeId = 'q1',
  opts: { flows?: GuidedFlow[] } = {},
): PatchHistory {
  const history: PatchHistory = [];
  function Host() {
    const [flow, setFlow] = useState(initialFlow);
    return (
      <NodeEditorPanel
        {...makePanelProps(flow, nodeId, {
          flows: opts.flows ?? [flow],
          onFlowChange: (patch) => {
            const applied = { ...flow, ...patch };
            history.push({ patch, applied });
            setFlow(applied);
          },
        })}
      />
    );
  }
  render(<Host />);
  return history;
}

export const isChoiceNode = (node: FlowNode): node is ChoiceFlowNode => node.kind === 'choice';
export const isScoreBranchNode = (node: FlowNode): node is ScoreBranchFlowNode => node.kind === 'score_branch';
export const isResultNode = (node: FlowNode): node is ResultFlowNode => node.kind === 'result';

/** Extracts the patched node from a commit and optionally narrows its kind. */
export function patchedNodeOf<T extends FlowNode>(
  patch: Partial<GuidedFlow>,
  nodeId: string,
  predicate?: (node: FlowNode) => node is T,
): T {
  const node = patch.nodes?.[nodeId];
  if (!node) throw new Error(`expected a node patch for ${nodeId}`);
  if (predicate) {
    if (!predicate(node)) throw new Error(`expected a matching node patch for ${nodeId}`);
    return node;
  }
  return node as T;
}

/** Flow where "alvo" receives inbound option(s) from "origem". */
export function createBranchyFlow(inboundOptionCount = 1): GuidedFlow {
  return createFlow({
    entry: { nodeId: 'origem', enteringPhrases: [], transitionMessage: '' },
    nodes: {
      origem: {
        id: 'origem',
        kind: 'choice',
        text: 'Origem',
        options: Array.from({ length: inboundOptionCount }, (_, index) => ({
          id: `origem-option-${index + 1}`,
          label: `Ir ${index + 1}`,
          next: 'alvo',
        })),
      },
      alvo: {
        id: 'alvo',
        kind: 'choice',
        text: 'Alvo',
        options: [{ id: 'alvo-option-1', label: 'Seguir', next: 'fim' }],
      },
      fim: resultNode,
    },
    nodeOrder: ['origem', 'alvo', 'fim'],
  });
}

const lostChoiceNode: ChoiceFlowNode = {
  id: 'perdido',
  kind: 'choice',
  text: 'Uma etapa muito distante que ninguém alcança jamais',
  options: [],
};

const midwayChoiceNode: ChoiceFlowNode = {
  id: 'meio',
  kind: 'choice',
  text: 'Próxima pergunta',
  options: [{ id: 'meio-option-1', label: 'Seguir', next: 'fim' }],
};

export function createChoiceFlow(
  { next = ['fim', 'meio'], optionIds = ['q1-option-1', 'q1-option-2'], freeText } = {} as {
    next?: [string, string];
    optionIds?: [string, string];
    freeText?: boolean;
  },
): GuidedFlow {
  const q1: ChoiceFlowNode = {
    id: 'q1',
    kind: 'choice',
    text: 'Como você está?',
    options: [
      { id: optionIds[0], label: 'Ok', next: next[0] },
      { id: optionIds[1], label: 'Mais ou menos', next: next[1] },
    ],
    ...(freeText ? { freeText: { next: 'fim' } } : {}),
  };
  return createFlow({
    nodes: { q1, meio: midwayChoiceNode, fim: resultNode, perdido: lostChoiceNode },
    nodeOrder: ['q1', 'meio', 'fim', 'perdido'],
  });
}

export function createScoreBranchFlow(
  { branchIds = ['r1-faixa-1', 'r1-faixa-2'] } = {} as { branchIds?: [string, string] },
): GuidedFlow {
  const r1: ScoreBranchFlowNode = {
    id: 'r1',
    kind: 'score_branch',
    text: 'Ramificação por pontuação',
    scoreKey: 'pontuacao',
    branches: [
      { id: branchIds[0], min: 0, max: 5, next: 'fim' },
      { id: branchIds[1], min: 6, max: 10, next: 'q1' },
    ],
  };
  return createFlow({
    entry: { nodeId: 'r1', enteringPhrases: [], transitionMessage: '' },
    nodes: {
      r1,
      alvo: {
        id: 'alvo',
        kind: 'choice',
        text: 'Alvo',
        options: [{ id: 'alvo-option-1', label: 'Seguir', next: 'fim' }],
      },
      q1: choiceNode,
      fim: resultNode,
    },
    nodeOrder: ['r1', 'alvo', 'q1', 'fim'],
  });
}

export function createMediaFlow(nodeOverrides: Partial<ResultFlowNode> = {}): GuidedFlow {
  const fim: ResultFlowNode = { ...resultNode, ...nodeOverrides };
  return createFlow({ nodes: { q1: choiceNode, fim }, nodeOrder: ['q1', 'fim'] });
}

export function createVisualFlow(nodeOverrides: Partial<ChoiceFlowNode> = {}): GuidedFlow {
  const q1: ChoiceFlowNode = { ...choiceNode, ...nodeOverrides };
  return createFlow({ nodes: { q1, fim: resultNode }, nodeOrder: ['q1', 'fim'] });
}
