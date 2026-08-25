import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FlowDestinationMap } from '../FlowDestinationMap';
import type { GuidedFlow } from '../../../domain/flow-engine/types';

vi.mock('../flowTopology', () => ({
  buildFlowTopology: vi.fn(() => ({})),
}));

const flow: GuidedFlow = {
  id: 'check-in',
  version: '1.0',
  locale: 'pt-BR',
  title: 'Check-in',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'q1', enteringPhrases: [], transitionMessage: '' },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Como você está hoje?',
      options: [
        {
          id: 'support',
          label: 'Preciso de apoio',
          next: 'result',
          effects: [{ kind: 'safety_interrupt', message: 'Procure apoio', destination: '/apoio', blockResume: false }],
        },
        {
          id: 'continue',
          label: 'Continuar',
          next: 'result',
          effects: [{ kind: 'deferred_safety', flagKey: 'support', message: 'Apoio', destination: '/apoio' }],
        },
      ],
      freeText: { next: 'result' },
    },
    result: { id: 'result', kind: 'result', text: 'Obrigado por responder.' },
    orphan: { id: 'orphan', kind: 'result', text: 'Etapa não alcançada.' },
  },
};

function renderMap(overrides: Partial<React.ComponentProps<typeof FlowDestinationMap>> = {}) {
  const props: React.ComponentProps<typeof FlowDestinationMap> = {
    flow,
    flows: [flow],
    onFlowChange: vi.fn(),
    onEditNode: vi.fn(),
    ...overrides,
  };
  return { ...render(<FlowDestinationMap {...props} />), props };
}

describe('FlowDestinationMap', () => {
  it('renders the complete destination index and structural counts', () => {
    renderMap();

    expect(screen.getByRole('heading', { name: 'Mapa por destino' })).toBeInTheDocument();
    expect(screen.getByText('3', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /segurança imediata/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /segurança ao concluir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /encerramento|result/i })).toBeInTheDocument();
    expect(screen.getByText(/fora do caminho de entrada/i)).toBeInTheDocument();
  });

  it('selects a destination and reports its reverse reachability', async () => {
    const user = userEvent.setup();
    renderMap();

    await user.click(screen.getByRole('button', { name: /segurança imediata/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Segurança imediata');
    expect(screen.getByRole('button', { name: /limpar destino selecionado/i })).toBeInTheDocument();
  });

  it('searches without hiding the topology and reports no matches', async () => {
    const user = userEvent.setup();
    renderMap();
    const search = screen.getByRole('searchbox', { name: /buscar etapa/i });

    await user.type(search, 'does-not-exist');

    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma etapa corresponde à busca.');
    expect(screen.getByRole('heading', { name: 'Mapa por destino' })).toBeInTheDocument();
  });

  it('opens the existing inspector when a stage is selected', async () => {
    const user = userEvent.setup();
    const { props } = renderMap();

    fireEvent.click(screen.getByText('Como você está hoje?'));
    expect(screen.getByTestId('flow-map-inspector')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /editar completamente/i }));
    expect(props.onEditNode).toHaveBeenCalledWith('check-in', 'q1');
  });

  it('compacts a long linear run and allows expanding it', async () => {
    const linearNodes: GuidedFlow['nodes'] = {};
    for (let index = 1; index <= 5; index += 1) {
      const id = `q${index}`;
      linearNodes[id] = {
        id,
        kind: 'choice',
        text: `Pergunta ${index}`,
        options: [{ id: 'next', label: 'Próxima', next: index === 5 ? 'done' : `q${index + 1}` }],
      };
    }
    linearNodes.done = { id: 'done', kind: 'result', text: 'Fim' };
    const linearFlow = { ...flow, id: 'linear', nodes: linearNodes, entry: { ...flow.entry, nodeId: 'q1' } };
    const user = userEvent.setup();
    renderMap({ flow: linearFlow, flows: [linearFlow] });

    expect(screen.getByText(/sequência linear/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /expandir sequência/i }));
    expect(screen.getByText('Pergunta 1')).toBeInTheDocument();
  });
});
