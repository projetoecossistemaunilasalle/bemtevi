import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ChoiceFlowNode, GuidedFlow } from '../../../domain/flow-engine/types';
import { NodeEditorPanel } from '../NodeEditorPanel';
import {
  isChoiceNode,
  createFlow,
  lastPatch,
  makePanelProps,
  patchedNodeOf,
  renderStatefulPanel,
  resultNode,
} from './nodeEditorPanelTestSupport';

describe('NodeEditorPanel opções', () => {
  /** Unreachable non-result node so the "Sem acesso pela entrada" group has a member. */
  const lostNode: ChoiceFlowNode = {
    id: 'perdido',
    kind: 'choice',
    text: 'Uma etapa muito distante que ninguém alcança jamais',
    options: [],
  };

  /** Reachable non-result node deeper than the entry so "Prof. 1" has a member. */
  const midwayNode: ChoiceFlowNode = {
    id: 'meio',
    kind: 'choice',
    text: 'Próxima pergunta',
    options: [{ id: 'meio-option-1', label: 'Seguir', next: 'fim' }],
  };

  function createChoiceFlow(
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
      nodes: { q1, meio: midwayNode, fim: resultNode, perdido: lostNode },
      nodeOrder: ['q1', 'meio', 'fim', 'perdido'],
    });
  }

  function renderChoicePanel(flow: GuidedFlow = createChoiceFlow()) {
    const props = makePanelProps(flow);
    render(<NodeEditorPanel {...props} />);
    return props;
  }

  it('renders one labeled input and one target select per option with grouped targets', () => {
    renderChoicePanel();

    const labels = screen.getAllByRole('textbox', { name: /Rótulo da opção/ });
    expect(labels).toHaveLength(2);
    expect(labels[0]).toHaveValue('Ok');
    expect(labels[1]).toHaveValue('Mais ou menos');

    const select1 = screen.getByRole('combobox', { name: 'Destino da opção 1' });
    expect(select1).toHaveValue('fim');
    expect(screen.getByRole('combobox', { name: 'Destino da opção 2' })).toHaveValue('meio');

    expect(within(select1).getByRole('group', { name: 'Entrada' })).toBeInTheDocument();
    expect(within(select1).getByRole('group', { name: 'Prof. 1' })).toBeInTheDocument();
    expect(within(select1).getByRole('group', { name: 'Sem acesso pela entrada' })).toBeInTheDocument();
    expect(within(select1).getByRole('group', { name: 'Finais' })).toBeInTheDocument();

    expect(within(select1).getByRole('option', { name: '— sem destino —' })).toHaveValue('');
    expect(within(select1).getByRole('option', { name: 'Etapa 1 · Como você está?' })).toHaveValue('q1');
    expect(within(select1).getByRole('option', { name: 'Etapa 2 · Próxima pergunta' })).toHaveValue('meio');
    expect(within(select1).getByRole('option', { name: 'Etapa 3 · Fim.' })).toHaveValue('fim');
    // Long unreachable node text is excerpted at 40 chars with an ellipsis.
    expect(within(select1).getByRole('option', { name: /^Etapa 4 · .*…$/ })).toHaveValue('perdido');
  });

  it('commits a label edit on blur with a whole-node payload', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel();
    const labelInput = screen.getByRole('textbox', { name: 'Rótulo da opção 1' });
    await user.clear(labelInput);
    await user.type(labelInput, 'Tudo certo');
    await user.tab();

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'q1', isChoiceNode);
    expect(node.text).toBe('Como você está?');
    expect(node.options[0]).toMatchObject({ id: 'q1-option-1', label: 'Tudo certo', next: 'fim' });
    expect(node.options[1]?.label).toBe('Mais ou menos');
  });

  it('updates only the chosen option target when a select changes', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino da opção 2' }), 'perdido');

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'q1', isChoiceNode);
    expect(node.options[1]?.next).toBe('perdido');
    expect(node.options[0]?.next).toBe('fim');
  });

  it('shows a missing current target as Destino ausente and keeps it selected until changed', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel(createChoiceFlow({ next: ['fantasma', 'fim'] }));
    const select = screen.getByRole('combobox', { name: 'Destino da opção 1' });

    expect(select).toHaveValue('fantasma');
    expect(within(select).getByRole('option', { name: 'Destino ausente · fantasma' })).toBeInTheDocument();

    await user.selectOptions(select, 'fim');
    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'q1', isChoiceNode);
    expect(node.options[0]?.next).toBe('fim');
  });

  it('adds an empty option using the first free sequential option id', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel();
    await user.click(screen.getByRole('button', { name: 'Adicionar opção' }));

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'q1', isChoiceNode);
    expect(node.options).toHaveLength(3);
    expect(node.options[2]).toEqual({ id: 'q1-option-3', label: '', next: '' });
    expect(node.options[0]).toMatchObject({ id: 'q1-option-1', label: 'Ok', next: 'fim' });
  });

  it('skips taken option ids when appending', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel(createChoiceFlow({ optionIds: ['q1-option-1', 'q1-option-3'] }));
    await user.click(screen.getByRole('button', { name: 'Adicionar opção' }));

    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'q1', isChoiceNode);
    expect(node.options[2]?.id).toBe('q1-option-4');
  });

  it('removes only the clicked option row', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel();
    await user.click(screen.getByRole('button', { name: 'Remover opção 1' }));

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'q1', isChoiceNode);
    expect(node.options).toHaveLength(1);
    expect(node.options[0]?.id).toBe('q1-option-2');
  });

  it('routes successive option edits through the updater so each commit builds on the latest node', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow());

    // Event 1: label edit on option 1 → exactly one commit.
    await user.type(screen.getByRole('textbox', { name: 'Rótulo da opção 1' }), '!');
    await user.tab();
    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'q1', isChoiceNode).options[0]?.label).toBe('Ok!');

    // Event 2: a different field, committed from the state event 1 produced.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino da opção 2' }), 'perdido');
    expect(history).toHaveLength(2);
    const second = patchedNodeOf(history[1].patch, 'q1', isChoiceNode);
    expect(second.options[0]?.label).toBe('Ok!'); // composed over the prior commit
    expect(second.options[1]?.next).toBe('perdido');
  });
  it('adds freeText with an empty next when toggled on', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel();
    await user.click(screen.getByRole('checkbox', { name: 'Aceitar resposta livre' }));

    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'q1', isChoiceNode);
    expect(node.freeText).toEqual({ next: '' });
    expect(node.options).toHaveLength(2);
  });

  it('removes the freeText key entirely when toggled off', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel(createChoiceFlow({ freeText: true }));
    const checkbox = screen.getByRole('checkbox', { name: 'Aceitar resposta livre' });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);

    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'q1', isChoiceNode);
    expect(node).not.toHaveProperty('freeText');
  });

  it('patches freeText.next from its own select', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel(createChoiceFlow({ freeText: true }));
    const select = screen.getByRole('combobox', { name: 'Destino da resposta livre' });
    expect(select).toHaveValue('fim');

    await user.selectOptions(select, 'perdido');

    const node = patchedNodeOf(lastPatch(props.onFlowChange), 'q1', isChoiceNode);
    expect(node.freeText).toEqual({ next: 'perdido' });
  });

  it('renders no opções section for a non-choice node', () => {
    const flow = createChoiceFlow();
    const { container } = render(<NodeEditorPanel {...makePanelProps(flow, 'fim')} />);

    expect(container.querySelector('[data-section="opcoes"]')).toBeNull();
  });

  it('editing an option label then the texto field commits both payloads without clobbering', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow());

    await user.type(screen.getByRole('textbox', { name: 'Rótulo da opção 1' }), '!');
    await user.click(screen.getByRole('textbox', { name: /texto da etapa/i }));
    // The sibling row keeps its draft across the label-commit re-render.
    expect(screen.getByRole('textbox', { name: 'Rótulo da opção 2' })).toHaveValue('Mais ou menos');

    await user.type(screen.getByRole('textbox', { name: /texto da etapa/i }), '?');
    await user.tab();

    expect(history).toHaveLength(2);
    const labelNode = patchedNodeOf(history[0].patch, 'q1', isChoiceNode);
    expect(labelNode.options[0]?.label).toBe('Ok!');
    expect(labelNode.text).toBe('Como você está?'); // label commit carries the untouched text

    const textNode = patchedNodeOf(history[1].patch, 'q1', isChoiceNode);
    expect(textNode.text).toBe('Como você está??'); // textarea was not reset by the label commit
    expect(textNode.options[0]?.label).toBe('Ok!'); // text commit carries the committed label
  });
});
