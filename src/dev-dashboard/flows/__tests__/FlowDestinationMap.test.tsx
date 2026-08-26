import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowDestinationMap } from '../FlowDestinationMap';
import type { ChoiceFlowNode, GuidedFlow, ScoreBranchFlowNode } from '../../../domain/flow-engine/types';
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
    onOpenFlow: vi.fn(),
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
        onOpenFlow={vi.fn()}
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

  it('renders the reachable destination index and structural counts', () => {
    renderMap();

    expect(screen.getByRole('heading', { name: 'Mapa por destino' })).toBeInTheDocument();
    expect(screen.getByText('3', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /segurança imediata/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /segurança ao concluir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /encerramento|result/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/etapas fora do caminho de entrada/i)).toBeInTheDocument();
  });

  it('gives converging relations separate destination ports', () => {
    const { container } = renderMap();
    const resultNode = container.querySelector('.react-flow__node[data-id="destination:result:result"]');
    const targetHandles = [...(resultNode?.querySelectorAll('.flow-destination-map__target') ?? [])];

    expect(targetHandles).toHaveLength(2);
    expect(new Set(targetHandles.map((handle) => handle.getAttribute('data-handleid')).filter(Boolean)).size).toBe(2);
  });

  it('selects a destination and reports its reverse reachability', async () => {
    const user = userEvent.setup();
    renderMap();

    await user.click(screen.getByRole('button', { name: /segurança imediata/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Segurança imediata');
    expect(screen.getByRole('button', { name: /limpar destino selecionado/i })).toBeInTheDocument();
  });

  it('opens a connected flow directly from its destination', async () => {
    const user = userEvent.setup();
    const onOpenFlow = vi.fn();
    const targetFlow: GuidedFlow = {
      ...flow,
      id: 'acolhimento',
      title: 'Acolhimento',
      nodes: { result: { id: 'result', kind: 'result', text: 'Acolhimento.' } },
      entry: { ...flow.entry, nodeId: 'result' },
    };
    const sourceFlow: GuidedFlow = {
      ...flow,
      nodes: {
        q1: {
          id: 'q1',
          kind: 'choice',
          text: 'Como você quer seguir?',
          options: [
            {
              id: 'handoff',
              label: 'Quero acolhimento',
              next: 'result',
              effects: [{ kind: 'flow_start', flowId: 'acolhimento' }],
            },
          ],
        },
        result: { id: 'result', kind: 'result', text: 'Fallback não alcançável.' },
      },
    };
    renderMap({ flow: sourceFlow, flows: [sourceFlow, targetFlow], onOpenFlow });

    expect(screen.getByText('Abre Acolhimento')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /abrir fluxo · acolhimento/i }));

    expect(onOpenFlow).toHaveBeenCalledWith('acolhimento');
  });

  it('keeps unreachable stages out of the live graph and exposes them in a separate strip', async () => {
    const user = userEvent.setup();
    renderMap();

    const unreachable = screen.getByLabelText('Etapas fora do caminho de entrada');
    expect(unreachable).toHaveTextContent('Etapa não alcançada.');
    await user.click(screen.getByRole('button', { name: /etapa não alcançada/i }));

    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Etapa não alcançada.');
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

    fireEvent.click(screen.getAllByText('Pergunta')[0]);
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /abrir no editor legado/i }));
    expect(props.onEditNode).toHaveBeenCalledWith('check-in', 'q1');
  });

  it('adds a question stage from the toolbar and opens the panel on it', async () => {
    const user = userEvent.setup();
    const { patches } = renderStatefulMap(flow);
    const stats = screen.getByLabelText('Resumo estrutural');

    const addStage = screen.getByRole('button', { name: 'Criar sem conectar' });
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
    expect(screen.getByRole('button', { name: 'Criar sem conectar' })).toHaveFocus();
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('');
    expect(stats).toHaveTextContent('4 etapas');
  });

  it('adds a final stage from the toolbar forwarding nodes and nodeOrder', async () => {
    const user = userEvent.setup();
    const ordered = { ...flow, nodeOrder: ['q1', 'result', 'orphan'] };
    const { patches } = renderStatefulMap(ordered);

    await user.click(screen.getByRole('button', { name: 'Criar sem conectar' }));
    await user.click(screen.getByRole('button', { name: 'Final' }));

    // Narrow structural patch carries exactly the keys addNode touched.
    expect(Object.keys(patches.at(-1) ?? {})).toEqual(['nodes', 'nodeOrder']);
    expect(screen.getByRole('button', { name: 'Criar sem conectar' })).toHaveFocus();
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    const stats = screen.getByLabelText('Resumo estrutural');
    expect(stats).toHaveTextContent('4 etapas');
    expect(stats).toHaveTextContent('3 finais');
  });

  it('closes the add-stage popover on Escape', async () => {
    const user = userEvent.setup();
    renderMap();

    await user.click(screen.getByRole('button', { name: 'Criar sem conectar' }));
    expect(screen.getByRole('button', { name: 'Ramificação' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Ramificação' })).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Criar sem conectar' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('adds a connected stage via contextual (+) button on an option', async () => {
    const user = userEvent.setup();
    const { patches } = renderStatefulMap(flow);

    const plusBtn = screen.getByLabelText('Continuar a partir de Preciso de apoio');
    fireEvent.click(plusBtn);

    expect(screen.getByText('Continuar com')).toBeInTheDocument();
    expect(screen.getByText('Direcionar ou encerrar')).toBeInTheDocument();

    await user.click(screen.getByText('💬 Pergunta'));

    expect(patches).toHaveLength(1);
    const updatedFlowNodes = patches[0].nodes!;
    const newStep = updatedFlowNodes['step-4'];
    expect(newStep).toMatchObject({ id: 'step-4', kind: 'choice' });
    // Option 'support' now points to 'step-4'
    const q1 = updatedFlowNodes['q1'] as ChoiceFlowNode;
    expect(q1.options.find((o) => o.id === 'support')?.next).toBe('step-4');
  });

  it('applies a navigation effect via contextual (+) menu', async () => {
    const user = userEvent.setup();
    const { patches } = renderStatefulMap(flow);

    const plusBtn = screen.getByLabelText('Continuar a partir de Continuar');
    fireEvent.click(plusBtn);

    await user.click(screen.getByText('🏥 Abrir /contatos'));

    expect(patches).toHaveLength(1);
    const q1 = patches[0].nodes!['q1'] as ChoiceFlowNode;
    const contOption = q1.options.find((o) => o.id === 'continue');
    expect(contOption?.effects).toEqual(expect.arrayContaining([{ kind: 'navigate', destination: '/contatos' }]));
  });

  it('adds an option directly from the question card on the canvas', async () => {
    const user = userEvent.setup();
    const { patches } = renderStatefulMap(flow);

    const addOptionBtn = screen.getByText('Adicionar opção');
    await user.click(addOptionBtn);

    expect(patches).toHaveLength(1);
    const q1 = patches[0].nodes!['q1'] as ChoiceFlowNode;
    expect(q1.options).toHaveLength(3);
    expect(q1.options[2]).toMatchObject({ id: 'q1-option-3', label: '', next: '' });
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
  });

  it('adds a branch directly from a score branch card on the canvas', async () => {
    const user = userEvent.setup();
    const branchFlow: GuidedFlow = {
      ...flow,
      entry: { ...flow.entry, nodeId: 'calc' },
      nodes: {
        calc: {
          id: 'calc',
          kind: 'score_branch',
          text: 'Pontuação',
          scoreKey: 'pontuacao',
          branches: [{ id: 'calc-faixa-1', min: 0, max: 5, next: 'result' }],
        },
        result: { id: 'result', kind: 'result', text: 'Fim' },
      },
    };
    const { patches } = renderStatefulMap(branchFlow);

    const addBranchBtn = screen.getByText('Adicionar faixa');
    await user.click(addBranchBtn);

    expect(patches).toHaveLength(1);
    const calc = patches[0].nodes!['calc'] as ScoreBranchFlowNode;
    expect(calc.branches).toHaveLength(2);
    expect(calc.branches[1]).toMatchObject({ id: 'calc-faixa-2', min: 6, max: 11, next: '' });
  });

  it('renders unreachable nodes with disconnected badge', () => {
    renderMap();
    expect(screen.getByText('Não conectada')).toBeInTheDocument();
    expect(screen.getAllByText('Etapa não alcançada.')).toHaveLength(2);
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

    fireEvent.click(screen.getAllByText('Pergunta')[0]);
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
        focusRequest: { nodeId: 'q2', section: 'opcoes', requestId: 1 },
      });
      expect(scrollIntoViewStub).toHaveBeenCalledTimes(1);

      view.rerender(
        <FlowDestinationMap {...view.props} focusRequest={{ nodeId: 'q2', section: 'opcoes', requestId: 2 }} />,
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
      fireEvent.click(screen.getAllByText('Pergunta')[0]);
      expect(scrollIntoViewStub).toHaveBeenCalledTimes(1);

      // Re-picking q2 remounts the panel again — still no stale scroll.
      fireEvent.click(screen.getAllByText('Pergunta')[1]);
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

  it('opens focused mode on an option when clicked on canvas and highlights it', async () => {
    const user = userEvent.setup();
    renderStatefulMap(flow);

    // Click on option "Preciso de apoio" on canvas
    const optionSupport = screen.getByText('Preciso de apoio');
    await user.click(optionSupport);

    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    expect(screen.getByText('Editando Opção 1')).toBeInTheDocument();

    // In focused mode for option 1, only option 1's input is rendered
    expect(screen.getByRole('textbox', { name: 'Rótulo da opção 1' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Rótulo da opção 2' })).not.toBeInTheDocument();

    // Toggle to full view
    await user.click(screen.getByRole('button', { name: /ver etapa inteira/i }));
    expect(screen.getByRole('textbox', { name: 'Rótulo da opção 2' })).toBeInTheDocument();
  });

  it('opens focused mode on stage text when clicked on canvas', async () => {
    const user = userEvent.setup();
    renderStatefulMap(flow);

    // Click on stage text
    await user.click(screen.getByText('Como você está hoje?'));

    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    expect(screen.getByText('Editando Texto da etapa')).toBeInTheDocument();

    // Textarea is present, but options are hidden in focused text mode
    expect(screen.getByRole('textbox', { name: 'Texto da etapa' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Rótulo da opção 1' })).not.toBeInTheDocument();

    // Expand all sections
    await user.click(screen.getByRole('button', { name: /ver todas as seções da etapa/i }));
    expect(screen.getByRole('textbox', { name: 'Rótulo da opção 1' })).toBeInTheDocument();
  });
});
