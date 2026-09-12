import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ChoiceFlowNode, GuidedFlow, ScoreBranch, ScoreBranchFlowNode } from '../../../domain/flow-engine/types';
import { NodeEditorPanel } from '../NodeEditorPanel';
import {
  choiceNode,
  createFlow,
  isScoreBranchNode,
  lastPatch,
  makePanelProps,
  patchedNodeOf,
  renderStatefulPanel,
  resultNode,
} from './nodeEditorPanelTestSupport';

describe('NodeEditorPanel ramificação', () => {
  /** Unreachable choice node so faixa targets have a third selectable id. */
  const lostTargetNode: ChoiceFlowNode = {
    id: 'alvo',
    kind: 'choice',
    text: 'Alvo',
    options: [{ id: 'alvo-option-1', label: 'Seguir', next: 'fim' }],
  };

  function createScoreBranchFlow(
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
      nodes: { r1, alvo: lostTargetNode, q1: choiceNode, fim: resultNode },
      nodeOrder: ['r1', 'alvo', 'q1', 'fim'],
    });
  }

  function renderScorePanel(flow: GuidedFlow = createScoreBranchFlow()) {
    const props = makePanelProps(flow, 'r1');
    render(<NodeEditorPanel {...props} />);
    return props;
  }

  it('renders the score key plus De/Até/Destino fields for every faixa', () => {
    renderScorePanel();

    expect(screen.getByLabelText('Pontuação usada')).toHaveValue('pontuacao');
    expect(screen.getByLabelText('De 1')).toHaveValue(0);
    expect(screen.getByLabelText('Até 1')).toHaveValue(5);
    expect(screen.getByRole('combobox', { name: 'Destino da faixa 1' })).toHaveValue('fim');
    expect(screen.getByLabelText('De 2')).toHaveValue(6);
    expect(screen.getByLabelText('Até 2')).toHaveValue(10);
    expect(screen.getByRole('combobox', { name: 'Destino da faixa 2' })).toHaveValue('q1');
    expect(screen.getByRole('button', { name: 'Remover faixa 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover faixa 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar faixa' })).toBeInTheDocument();
  });

  it('commits a Pontuação usada edit on blur with a whole-node payload', async () => {
    const user = userEvent.setup();
    const props = renderScorePanel();
    const input = screen.getByLabelText('Pontuação usada');
    await user.clear(input);
    await user.type(input, 'risco');
    await user.tab();

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'r1', isScoreBranchNode);
    expect(node.text).toBe('Ramificação por pontuação');
    expect(node.scoreKey).toBe('risco');
    expect(node.branches).toHaveLength(2); // untouched by the key edit
  });

  it('commits De/Até as numeric payloads and ignores non-numeric drafts', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createScoreBranchFlow(), 'r1');

    const deInput = screen.getByLabelText('De 2');
    await user.clear(deInput);
    await user.type(deInput, '9');
    await user.tab();

    expect(history).toHaveLength(1);
    const branch = patchedNodeOf(history[0].patch, 'r1', isScoreBranchNode).branches[1];
    expect(branch?.min).toBe(9);
    expect(branch && typeof branch.min === 'number').toBe(true);

    // Non-numeric drafts never reach the payload.
    await user.clear(deInput);
    await user.type(deInput, 'abc');
    await user.tab();
    expect(history).toHaveLength(1); // no new commit
    expect(patchedNodeOf(history[0].patch, 'r1', isScoreBranchNode).branches[1]?.min).toBe(9);
  });

  it('adds a zeroed faixa using the first free sequential id', async () => {
    const user = userEvent.setup();
    const props = renderScorePanel();
    await user.click(screen.getByRole('button', { name: 'Adicionar faixa' }));

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'r1', isScoreBranchNode);
    expect(node.branches).toHaveLength(3);
    expect(node.branches[2]).toEqual({ id: 'r1-faixa-3', min: 0, max: 0, next: '' });
  });

  it('skips taken faixa ids when appending', async () => {
    const user = userEvent.setup();
    const props = renderScorePanel(createScoreBranchFlow({ branchIds: ['r1-faixa-1', 'r1-faixa-3'] }));
    await user.click(screen.getByRole('button', { name: 'Adicionar faixa' }));

    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'r1', isScoreBranchNode);
    expect(node.branches[2]?.id).toBe('r1-faixa-4');
  });

  it('removes only the clicked faixa row', async () => {
    const user = userEvent.setup();
    const props = renderScorePanel();
    await user.click(screen.getByRole('button', { name: 'Remover faixa 1' }));

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'r1', isScoreBranchNode);
    expect(node.branches).toHaveLength(1);
    expect(node.branches[0]?.id).toBe('r1-faixa-2');
  });

  it('patches only the chosen faixa target when a select changes', async () => {
    const user = userEvent.setup();
    const props = renderScorePanel();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino da faixa 1' }), 'alvo');

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'r1', isScoreBranchNode);
    expect(node.branches[0]?.next).toBe('alvo');
    expect(node.branches[1]?.next).toBe('q1'); // sibling untouched
  });

  it('routes successive faixa edits through the updater so each commit builds on the latest node', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createScoreBranchFlow(), 'r1');

    const keyInput = screen.getByLabelText('Pontuação usada');
    await user.clear(keyInput);
    await user.type(keyInput, 'risco');
    await user.tab();
    expect(history).toHaveLength(1);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino da faixa 2' }), 'alvo');
    expect(history).toHaveLength(2);

    const second = patchedNodeOf(history[1].patch, 'r1', isScoreBranchNode);
    expect(second.scoreKey).toBe('risco'); // composed over the prior commit
    expect(second.branches[1]).toMatchObject({ id: 'r1-faixa-2', min: 6, max: 10, next: 'alvo' });
  });

  it('renders no ramificação section for non-score_branch nodes', () => {
    const { container } = render(<NodeEditorPanel {...makePanelProps(createFlow(), 'q1')} />);

    expect(container.querySelector('[data-section="ramificacao"]')).toBeNull();
    expect(screen.queryByLabelText('Pontuação usada')).not.toBeInTheDocument();
  });

  it('renders Nome da faixa and Destino de página controls for every faixa', () => {
    renderScorePanel();

    expect(screen.getByLabelText('Nome da faixa 1')).toHaveValue('r1-faixa-1');
    expect(screen.getByLabelText('Nome da faixa 2')).toHaveValue('r1-faixa-2');
    const pageSelect = screen.getByRole('combobox', { name: 'Destino de página 1' });
    expect(pageSelect).toHaveValue(''); // Nenhuma
    const values = within(pageSelect)
      .getAllByRole('option')
      .map((option) => option.getAttribute('value'));
    expect(values).toEqual(['', '/apoio', '/contatos', '/educacao']);
  });

  it('commits a trimmed faixa rename on blur keeping sibling ids untouched', async () => {
    const user = userEvent.setup();
    const props = renderScorePanel();
    const input = screen.getByLabelText('Nome da faixa 1');
    await user.clear(input);
    await user.type(input, 'baixa ');
    await user.tab();

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'r1', isScoreBranchNode);
    expect(node.branches[0]).toMatchObject({ id: 'baixa', min: 0, max: 5, next: 'fim' });
    expect(node.branches[1]?.id).toBe('r1-faixa-2');
  });

  it('blocks blank faixa names with a hint and silently reverts on blur', async () => {
    const user = userEvent.setup();
    const props = renderScorePanel();
    const input = screen.getByLabelText('Nome da faixa 1');
    await user.clear(input);

    expect(screen.getByText('O nome da faixa não pode ficar vazio.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');

    await user.tab();

    expect(props.onFlowChange).not.toHaveBeenCalled(); // invalid draft never commits
    expect(screen.getByLabelText('Nome da faixa 1')).toHaveValue('r1-faixa-1'); // reverted
    expect(screen.queryByText('O nome da faixa não pode ficar vazio.')).not.toBeInTheDocument();
  });

  it('blocks duplicate faixa names until the draft resolves to something unique', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createScoreBranchFlow(), 'r1');
    const input = screen.getByLabelText('Nome da faixa 1');

    await user.clear(input);
    await user.type(input, 'r1-faixa-2'); // sibling's id
    expect(screen.getByText('Nome já usado nesta etapa.')).toBeInTheDocument();
    await user.tab();
    expect(history).toHaveLength(0); // duplicate never commits
    expect(screen.getByLabelText('Nome da faixa 1')).toHaveValue('r1-faixa-1');

    await user.clear(input);
    await user.type(input, 'unico');
    await user.tab();

    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'r1', isScoreBranchNode).branches[0]?.id).toBe('unico');
  });

  it('writes branch.navigation from Destino de página and drops the key when cleared', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createScoreBranchFlow(), 'r1');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino de página 2' }), '/contatos');
    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'r1', isScoreBranchNode).branches[1]?.navigation).toBe('/contatos');
    // Sibling row untouched.
    expect(patchedNodeOf(history[0].patch, 'r1', isScoreBranchNode).branches[0]).not.toHaveProperty('navigation');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino de página 2' }), '');
    expect(history).toHaveLength(2);
    expect(patchedNodeOf(history[1].patch, 'r1', isScoreBranchNode).branches[1]).not.toHaveProperty('navigation');
  });

  it('keeps an out-of-union stored navigation representable instead of snapping to the first option', () => {
    const flow = createScoreBranchFlow();
    const r1 = flow.nodes.r1;
    if (r1.kind === 'score_branch') r1.branches[0].navigation = '/legado' as ScoreBranch['navigation'];
    renderScorePanel(flow);

    const pageSelect = screen.getByRole('combobox', { name: 'Destino de página 1' });
    expect(pageSelect).toHaveValue('/legado');
    expect(within(pageSelect).getByRole('option', { name: 'Destino ausente · /legado' })).toBeInTheDocument();
  });
});
