import { describe, expect, it, vi } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { buildOverviewGraph } from '../FlowOverviewMap';

const makeFlow = (overrides: Partial<GuidedFlow> = {}): GuidedFlow => ({
  id: 'entrada',
  version: '1.0',
  locale: 'pt-BR',
  title: 'Entrada',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'question', enteringPhrases: [], transitionMessage: '' },
  nodes: {
    question: {
      id: 'question',
      kind: 'choice',
      text: 'O que você precisa?',
      options: [
        { id: 'stress', label: 'Quero falar sobre estresse', next: 'result' },
        {
          id: 'support',
          label: 'Preciso de apoio',
          next: 'result',
          effects: [{ kind: 'flow_start', flowId: 'apoio' }],
        },
        {
          id: 'care',
          label: 'Estou em risco',
          next: 'result',
          effects: [{ kind: 'safety_interrupt', message: 'Procure apoio', destination: '/apoio', blockResume: true }],
        },
      ],
    },
    result: { id: 'result', kind: 'result', text: 'Até logo.' },
  },
  ...overrides,
});

const apoio = makeFlow({
  id: 'apoio',
  title: 'Apoio',
  entry: { nodeId: 'result', enteringPhrases: [], transitionMessage: '' },
  nodes: { result: { id: 'result', kind: 'result', text: 'Apoio.' } },
});
const disconnected = makeFlow({
  id: 'isolado',
  title: 'Isolado',
  entry: { nodeId: 'result', enteringPhrases: [], transitionMessage: '' },
  nodes: { result: { id: 'result', kind: 'result', text: 'Isolado.' } },
});

describe('FlowOverviewMap', () => {
  it('shows one flow node per flow and keeps external typed destinations explicit', () => {
    const graph = buildOverviewGraph([makeFlow(), apoio, disconnected], 'entrada', '', vi.fn());
    const flowNodes = graph.nodes.filter((node) => node.data.kind === 'flow');
    const externalNodes = graph.nodes.filter((node) => node.data.kind === 'external');

    expect(flowNodes).toHaveLength(3);
    expect(flowNodes.map((node) => node.id)).toEqual(['entrada', 'apoio', 'isolado']);
    expect(graph.edges.map((edge) => edge.label)).toEqual(['Preciso de apoio', 'Estou em risco']);
    expect(externalNodes.map((node) => node.data.kind === 'external' && node.data.label)).toContain(
      'Segurança imediata · /apoio',
    );
  });

  it('derives status, final, incoming and outgoing counts without internal nodes', () => {
    const graph = buildOverviewGraph([makeFlow(), apoio], 'entrada', '', vi.fn());
    const entrada = graph.nodes.find((node) => node.id === 'entrada');
    expect(entrada?.data.kind).toBe('flow');
    if (entrada?.data.kind === 'flow') {
      expect(entrada.data.steps).toBe(2);
      expect(entrada.data.finals).toBe(1);
      expect(entrada.data.incoming).toBe(0);
      expect(entrada.data.outgoing).toBe(2);
      expect(entrada.data.flow.status).toBe('draft');
    }
    expect(
      graph.nodes
        .filter((node) => node.data.kind === 'flow')
        .every((node) => node.id !== 'question' && node.id !== 'result'),
    ).toBe(true);
  });

  it('marks search matches without hiding the rest of the system', () => {
    const graph = buildOverviewGraph([makeFlow(), apoio], 'entrada', 'apoio', vi.fn());
    const apoioNode = graph.nodes.find((node) => node.id === 'apoio');
    const entradaNode = graph.nodes.find((node) => node.id === 'entrada');
    expect(apoioNode?.data.kind === 'flow' && apoioNode.data.searchMatch).toBe(true);
    expect(entradaNode?.data.kind === 'flow' && entradaNode.data.searchMatch).toBe(false);
    expect(graph.nodes.filter((node) => node.data.kind === 'flow')).toHaveLength(2);
  });
});
