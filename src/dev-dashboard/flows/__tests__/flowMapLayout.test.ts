import { describe, it, expect } from 'vitest';
import { buildFlowGraph } from '../flowMapLayout';
import type { GuidedFlow } from '../../../domain/flow-engine/types';

const simpleFlow: GuidedFlow = {
  id: 'test',
  version: '1.0',
  locale: 'pt-BR',
  title: 'Test',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'q1', enteringPhrases: [], transitionMessage: '' },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Pergunta 1',
      options: [
        { id: 'yes', label: 'Sim', next: 'result', effects: [{ kind: 'score', scoreKey: 'srq20', value: 1 }] },
        { id: 'no', label: 'Não', next: 'result' },
      ],
    },
    result: { id: 'result', kind: 'result', text: 'Fim.' },
  },
};

const safetyFlow: GuidedFlow = {
  id: 'safety',
  version: '1.0',
  locale: 'pt-BR',
  title: 'Safety',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'q1', enteringPhrases: [], transitionMessage: '' },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Tem ideias de se machucar?',
      options: [
        {
          id: 'yes',
          label: 'Sim',
          next: 'result',
          effects: [{ kind: 'safety_interrupt', message: 'Cuidado', destination: '/apoio', blockResume: false }],
        },
        { id: 'no', label: 'Não', next: 'result' },
      ],
    },
    result: { id: 'result', kind: 'result', text: 'Fim.' },
  },
};

describe('buildFlowGraph', () => {
  it('returns one RF node per flow node', () => {
    const { nodes } = buildFlowGraph(simpleFlow);
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['q1', 'result']));
  });

  it('assigns x and y positions (dagre layout)', () => {
    const { nodes } = buildFlowGraph(simpleFlow);
    for (const node of nodes) {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    }
  });

  it('returns one edge per unique next target per option', () => {
    const { edges } = buildFlowGraph(simpleFlow);
    expect(edges).toHaveLength(2);
  });

  it('tags score edges with type "score"', () => {
    const { edges } = buildFlowGraph(simpleFlow);
    const scoreEdge = edges.find((e) => e.data?.effectKind === 'score');
    expect(scoreEdge).toBeDefined();
  });

  it('tags safety_interrupt edges with type "safety_interrupt"', () => {
    const { edges } = buildFlowGraph(safetyFlow);
    const safetyEdge = edges.find((e) => e.data?.effectKind === 'safety_interrupt');
    expect(safetyEdge).toBeDefined();
  });

  it('attaches node kind to RF node data', () => {
    const { nodes } = buildFlowGraph(simpleFlow);
    const choiceNode = nodes.find((n) => n.id === 'q1');
    expect(choiceNode?.data.kind).toBe('choice');
  });

  it('handles score_branch nodes', () => {
    const flow: GuidedFlow = {
      ...simpleFlow,
      nodes: {
        branch: {
          id: 'branch',
          kind: 'score_branch',
          text: 'Calculando',
          scoreKey: 'srq20',
          branches: [
            { id: 'low', min: 0, max: 6, next: 'low-result' },
            { id: 'high', min: 7, max: 20, next: 'high-result' },
          ],
        },
        'low-result': { id: 'low-result', kind: 'result', text: 'Baixo.' },
        'high-result': { id: 'high-result', kind: 'result', text: 'Alto.' },
      },
    };
    const { nodes, edges } = buildFlowGraph(flow);
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.data?.effectKind === 'score_branch')).toBe(true);
  });
});
