import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowDestinationMap } from '../FlowDestinationMap';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { installScrollStub } from './scrollStubs';

vi.mock('../flowTopology', () => ({
  // Minimal shape: the map falls back to its local analysis, and the editor
  // panel only needs stable `nodes`/`nodeById` containers.
  buildFlowTopology: vi.fn(() => ({ nodes: [], nodeById: {} })),
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

/** Two chained stages so validation deep-links can land on a second stage. */
const focusFlow: GuidedFlow = {
  ...flow,
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Como você está hoje?',
      options: [{ id: 'next', label: 'Próxima', next: 'q2' }],
    },
    q2: {
      id: 'q2',
      kind: 'choice',
      text: 'Quer deixar um recado?',
      options: [{ id: 'enviar', label: 'Enviar', next: 'result' }],
    },
    result: { id: 'result', kind: 'result', text: 'Obrigado por responder.' },
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

/** Host that applies patches like FlowDashboard does, so stats re-render from mutations. */
function renderStatefulMap(initialFlow: GuidedFlow) {
  const patches: Array<Partial<GuidedFlow>> = [];
  function Host() {
    const [flow, setFlow] = useState(initialFlow);
    return (
      <FlowDestinationMap
        flow={flow}
        flows={[flow]}
        onFlowChange={(patch) => {
          patches.push(patch);
          setFlow((current) => ({ ...current, ...patch }));
        }}
        onEditNode={vi.fn()}
      />
    );
  }
  render(<Host />);
  return { patches };
}

describe('FlowDestinationMap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('opens the node editor panel when a stage is selected', async () => {
    const user = userEvent.setup();
    const { props } = renderMap();

    fireEvent.click(screen.getByText('Como você está hoje?'));
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /abrir no editor legado/i }));
    expect(props.onEditNode).toHaveBeenCalledWith('check-in', 'q1');
  });

  it('adds a question stage from the toolbar and opens the panel on it', async () => {
    const user = userEvent.setup();
    const { patches } = renderStatefulMap(flow);
    const stats = screen.getByLabelText('Resumo estrutural');

    const addStage = screen.getByRole('button', { name: 'Etapa' });
    expect(addStage).toHaveAttribute('aria-expanded', 'false');
    await user.click(addStage);
    expect(addStage).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Pergunta' }));

    // Narrow structural patch ({nodes} only — this fixture has no nodeOrder).
    expect(patches).toHaveLength(1);
    expect(Object.keys(patches[0])).toEqual(['nodes']);
    expect(patches[0].nodes?.['step-4']).toMatchObject({ id: 'step-4', kind: 'choice' });

    // The popover closed (focus back on the trigger) and the panel opened on
    // the fresh empty node.
    expect(screen.queryByRole('button', { name: 'Pergunta' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Etapa' })).toHaveFocus();
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('');
    expect(stats).toHaveTextContent('4 etapas');
  });

  it('adds a final stage from the toolbar forwarding nodes and nodeOrder', async () => {
    const user = userEvent.setup();
    const ordered = { ...flow, nodeOrder: ['q1', 'result', 'orphan'] };
    const { patches } = renderStatefulMap(ordered);

    await user.click(screen.getByRole('button', { name: 'Etapa' }));
    await user.click(screen.getByRole('button', { name: 'Final' }));

    // Narrow structural patch carries exactly the keys addNode touched.
    expect(Object.keys(patches.at(-1) ?? {})).toEqual(['nodes', 'nodeOrder']);
    expect(screen.getByRole('button', { name: 'Etapa' })).toHaveFocus();
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    const stats = screen.getByLabelText('Resumo estrutural');
    expect(stats).toHaveTextContent('4 etapas');
    expect(stats).toHaveTextContent('3 finais');
  });

  it('closes the add-stage popover on Escape', async () => {
    const user = userEvent.setup();
    renderMap();

    await user.click(screen.getByRole('button', { name: 'Etapa' }));
    expect(screen.getByRole('button', { name: 'Ramificação' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Ramificação' })).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Etapa' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('shifts map overlays clear of the editor panel only while it is open', async () => {
    const user = userEvent.setup();
    renderMap();
    const canvas = screen.getByLabelText('Mapa por destino do fluxo Check-in');
    expect(canvas).not.toHaveClass('flow-destination-map__canvas--with-panel');

    fireEvent.click(screen.getByText('Como você está hoje?'));
    expect(canvas).toHaveClass('flow-destination-map__canvas--with-panel');

    await user.click(screen.getByRole('button', { name: /segurança imediata/i }));
    expect(screen.getByRole('status')).toHaveClass('flow-destination-map__selection--clear-of-panel');

    await user.click(screen.getByRole('button', { name: /fechar painel de edição/i }));
    expect(canvas).not.toHaveClass('flow-destination-map__canvas--with-panel');
    expect(screen.getByRole('status')).not.toHaveClass('flow-destination-map__selection--clear-of-panel');
  });

  it('deletes the selected stage through the panel and closes it', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderStatefulMap(flow);

    fireEvent.click(screen.getByText('Como você está hoje?'));
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir etapa' }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('node-editor-panel')).not.toBeInTheDocument();
    const stats = screen.getByLabelText('Resumo estrutural');
    expect(stats).toHaveTextContent('2 etapas');
    expect(stats).not.toHaveTextContent('3 etapas');
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

  it('selects the requested stage and scrolls its panel section on focusRequest', () => {
    const { stub: scrollIntoViewStub, restore } = installScrollStub();
    try {
      renderMap({
        flow: focusFlow,
        flows: [focusFlow],
        focusRequest: { nodeId: 'q2', section: 'opcoes', requestId: 1 },
      });

      expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Quer deixar um recado?');
      expect(scrollIntoViewStub).toHaveBeenCalledWith({ block: 'nearest' });
    } finally {
      restore();
    }
  });

  it('re-fires the section scroll when the same stage is requested again', () => {
    const { stub: scrollIntoViewStub, restore } = installScrollStub();
    try {
      const view = renderMap({
        flow: focusFlow,
        flows: [focusFlow],
        focusRequest: { nodeId: 'q2', section: 'texto', requestId: 1 },
      });
      expect(scrollIntoViewStub).toHaveBeenCalledTimes(1);

      view.rerender(
        <FlowDestinationMap {...view.props} focusRequest={{ nodeId: 'q2', section: 'texto', requestId: 2 }} />,
      );

      expect(scrollIntoViewStub).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('clears the held section focus when a stage is clicked manually', () => {
    // Regression pin: a deep-link parks its section on the map until the panel
    // mounts (one commit later). A manual canvas click must clear that hold —
    // otherwise a later panel remount would replay the stale scroll onto an
    // unrelated stage.
    const { stub: scrollIntoViewStub, restore } = installScrollStub();
    try {
      renderMap({
        flow: focusFlow,
        flows: [focusFlow],
        focusRequest: { nodeId: 'q2', section: 'texto', requestId: 1 },
      });
      expect(scrollIntoViewStub).toHaveBeenCalledTimes(1);

      // Manual pick of q1 clears the held request; the freshly mounted panel
      // must NOT scroll to q2's section.
      fireEvent.click(screen.getByText('Como você está hoje?'));
      expect(scrollIntoViewStub).toHaveBeenCalledTimes(1);

      // Re-picking q2 remounts the panel again — still no stale scroll.
      fireEvent.click(screen.getByText('Quer deixar um recado?'));
      expect(scrollIntoViewStub).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Quer deixar um recado?');
    } finally {
      restore();
    }
  });

  it('clears the node selection and requests settings for a node-less focusRequest', () => {
    const onRequestSettingsOpen = vi.fn();
    const view = renderMap({ onRequestSettingsOpen });

    fireEvent.click(screen.getByText('Como você está hoje?'));
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();

    view.rerender(<FlowDestinationMap {...view.props} focusRequest={{ requestId: 1 }} />);

    // Flow-level ('configuracoes') target: the panel steps aside so the
    // settings overlay can stand alone.
    expect(screen.queryByTestId('node-editor-panel')).not.toBeInTheDocument();
    expect(onRequestSettingsOpen).toHaveBeenCalledTimes(1);
  });

  it('ignores a focusRequest pointing at an unknown stage', () => {
    renderMap({
      flow: focusFlow,
      flows: [focusFlow],
      focusRequest: { nodeId: 'fantasma', section: 'texto', requestId: 1 },
    });

    expect(screen.queryByTestId('node-editor-panel')).not.toBeInTheDocument();
  });
});
