import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChoiceFlowNode, GuidedFlow, ScoreBranchFlowNode } from '../../../domain/flow-engine/types';
import { flow, renderMap, renderStatefulMap } from './FlowDestinationMapTestHarness';

describe('FlowDestinationMap - mutations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

    expect(patches).toHaveLength(1);
    expect(Object.keys(patches[0])).toEqual(['nodes']);
    expect(patches[0].nodes?.['step-4']).toMatchObject({ id: 'step-4', kind: 'choice' });

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
});
