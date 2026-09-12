import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { FlowEffect, GuidedFlow } from '../../../domain/flow-engine/types';
import {
  createChoiceFlow,
  createFlow,
  isChoiceNode,
  patchedNodeOf,
  renderStatefulPanel,
} from './nodeEditorPanelTestSupport';

describe('NodeEditorPanel opções efeitos', () => {
  /** Second flow so the flow_start select has a real title to list. */
  function createSecondaryFlow(): GuidedFlow {
    return { ...createFlow(), id: 'flow-2', title: 'Fluxo de apoio' };
  }

  const EFFECT_DEFAULTS: Array<{ kind: string; expected: FlowEffect }> = [
    { kind: 'score', expected: { kind: 'score', scoreKey: 'pontuacao', value: 1 } },
    {
      kind: 'safety_interrupt',
      expected: { kind: 'safety_interrupt', message: '', destination: '/apoio', blockResume: false },
    },
    {
      kind: 'deferred_safety',
      expected: { kind: 'deferred_safety', flagKey: '', message: '', destination: '/apoio' },
    },
    { kind: 'navigate', expected: { kind: 'navigate', destination: '/apoio' } },
    { kind: 'flow_start', expected: { kind: 'flow_start', flowId: 'flow-1' } },
    { kind: 'end_flow', expected: { kind: 'end_flow', message: '' } },
  ];

  function optionRow(optionNumber: number) {
    return screen.getByTestId(`option-row-${optionNumber}`);
  }

  async function addEffectFromMenu(user: UserEvent, optionNumber: number, kind: string) {
    await user.selectOptions(screen.getByRole('combobox', { name: `Adicionar efeito à opção ${optionNumber}` }), kind);
  }

  it.each(EFFECT_DEFAULTS)('appends the exact $kind default from the add-effect menu', async ({ kind, expected }) => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow());
    await addEffectFromMenu(user, 1, kind);

    expect(history).toHaveLength(1);
    const node = patchedNodeOf(history[0].patch, 'q1', isChoiceNode);
    expect(node.options[0]?.effects).toEqual([expected]);
    expect(node.options[1]?.effects).toBeUndefined();
  });

  it('lists only kinds missing from the option, always keeping score available', async () => {
    const user = userEvent.setup();
    renderStatefulPanel(createChoiceFlow());

    const menu = () => screen.getByRole('combobox', { name: 'Adicionar efeito à opção 1' });
    // Before anything is added, every kind is offered.
    for (const label of ['Pontuar', 'Interromper por segurança', 'Segurança ao concluir', 'Navegar para área']) {
      expect(within(menu()).getByRole('option', { name: label })).toBeInTheDocument();
    }

    await addEffectFromMenu(user, 1, 'navigate');
    expect(within(menu()).queryByRole('option', { name: 'Navegar para área' })).not.toBeInTheDocument();
    expect(within(menu()).getByRole('option', { name: 'Pontuar' })).toBeInTheDocument();

    await addEffectFromMenu(user, 1, 'safety_interrupt');
    expect(within(menu()).queryByRole('option', { name: 'Interromper por segurança' })).not.toBeInTheDocument();
    // Option 2's menu is unaffected by option 1's effects.
    expect(
      within(screen.getByRole('combobox', { name: 'Adicionar efeito à opção 2' })).getByRole('option', {
        name: 'Navegar para área',
      }),
    ).toBeInTheDocument();
  });

  it('allows several score effects on the same option', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow());
    await addEffectFromMenu(user, 1, 'score');
    await addEffectFromMenu(user, 1, 'score');

    expect(history).toHaveLength(2);
    const node = patchedNodeOf(history[1].patch, 'q1', isChoiceNode);
    expect(node.options[0]?.effects).toEqual([
      { kind: 'score', scoreKey: 'pontuacao', value: 1 },
      { kind: 'score', scoreKey: 'pontuacao', value: 1 },
    ]);
  });
  it('commits score edits as numbers and ignores non-numeric drafts', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow());
    await addEffectFromMenu(user, 1, 'score');

    const row = optionRow(1);
    const valorInput = within(row).getByLabelText('Valor da pontuação');
    await user.clear(valorInput);
    await user.type(valorInput, '3');
    await user.tab();

    expect(history).toHaveLength(2);
    const effect = patchedNodeOf(history[1].patch, 'q1', isChoiceNode).options[0]?.effects?.[0];
    expect(effect).toEqual({ kind: 'score', scoreKey: 'pontuacao', value: 3 });
    expect(effect?.kind === 'score' && typeof effect.value === 'number').toBe(true);

    // Non-numeric drafts never reach the payload.
    await user.clear(valorInput);
    await user.type(valorInput, 'abc');
    await user.tab();
    expect(history).toHaveLength(2); // no new commit
    expect(patchedNodeOf(history[1].patch, 'q1', isChoiceNode).options[0]?.effects?.[0]).toEqual({
      kind: 'score',
      scoreKey: 'pontuacao',
      value: 3,
    });
  });

  it('removes an effect from its chip without touching sibling rows', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow());
    await addEffectFromMenu(user, 1, 'score');
    await addEffectFromMenu(user, 2, 'navigate');

    // Chip summaries use the inspector conventions; remove buttons name the
    // effect's position + kind + row so identical kinds stay distinguishable.
    expect(within(optionRow(1)).getByText('+1 em pontuacao')).toBeInTheDocument();
    expect(within(optionRow(2)).getByText('→ /apoio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover efeito 1 (pontuar) da opção 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover efeito 1 (navegar para área) da opção 2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remover efeito 1 (navegar para área) da opção 2' }));

    expect(history).toHaveLength(3);
    const node = patchedNodeOf(history[2].patch, 'q1', isChoiceNode);
    expect(node.options[0]?.effects).toEqual([{ kind: 'score', scoreKey: 'pontuacao', value: 1 }]);
    expect(node.options[1]).not.toHaveProperty('effects'); // last chip drops the key entirely
  });

  it('removes the targeted chip when identical kinds repeat, keeping later ones', async () => {
    const user = userEvent.setup();
    const flow = createChoiceFlow();
    const q1 = flow.nodes.q1;
    if (q1.kind === 'choice') q1.options[0].effects = [{ kind: 'score', scoreKey: 'foco', value: 1 }];
    const history = renderStatefulPanel(flow);

    await addEffectFromMenu(user, 1, 'score');
    const row = optionRow(1);
    expect(within(row).getAllByRole('button', { name: /Remover efeito/ })).toHaveLength(2);

    // Chip 1 is the seeded 'foco' effect; removing it must not shift the
    // filter onto the wrong survivor.
    await user.click(screen.getByRole('button', { name: 'Remover efeito 1 (pontuar) da opção 1' }));

    expect(history).toHaveLength(2);
    const node = patchedNodeOf(history[1].patch, 'q1', isChoiceNode);
    expect(node.options[0]?.effects).toEqual([{ kind: 'score', scoreKey: 'pontuacao', value: 1 }]);
  });

  it('lists real flow titles in the flow_start destination select and commits the choice', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow(), 'q1', {
      flows: [createChoiceFlow(), createSecondaryFlow()],
    });
    await addEffectFromMenu(user, 1, 'flow_start');

    const select = within(optionRow(1)).getByRole('combobox', { name: 'Fluxo de destino' });
    expect(select).toHaveValue('flow-1');
    expect(within(select).getByRole('option', { name: 'Fluxo de teste (flow-1)' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Fluxo de apoio (flow-2)' })).toBeInTheDocument();

    await user.selectOptions(select, 'flow-2');
    const effect = patchedNodeOf(history[1].patch, 'q1', isChoiceNode).options[0]?.effects?.[0];
    expect(effect).toEqual({ kind: 'flow_start', flowId: 'flow-2' });
  });

  it('limits destination selects to the three supported areas', async () => {
    const user = userEvent.setup();
    renderStatefulPanel(createChoiceFlow());
    await addEffectFromMenu(user, 1, 'safety_interrupt');
    await addEffectFromMenu(user, 2, 'navigate');

    for (const number of [1, 2]) {
      const destinations = within(optionRow(number)).getByLabelText('Destino');
      const values = within(destinations)
        .getAllByRole('option')
        .map((option) => option.getAttribute('value'));
      expect(values).toEqual(['/apoio', '/contatos', '/educacao']);
    }
  });

  it('applies consecutive safety_interrupt field edits one commit per event', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow());
    await addEffectFromMenu(user, 1, 'safety_interrupt');

    const row = optionRow(1);
    await user.type(within(row).getByLabelText('Mensagem da interrupção'), 'Pare');
    await user.tab();
    expect(history).toHaveLength(2);

    await user.click(within(row).getByRole('checkbox', { name: 'Impede retorno' }));
    expect(history).toHaveLength(3);

    await user.selectOptions(within(row).getByLabelText('Destino'), '/educacao');
    expect(history).toHaveLength(4);

    const node = patchedNodeOf(history[3].patch, 'q1', isChoiceNode);
    expect(node.options[0]?.effects).toEqual([
      { kind: 'safety_interrupt', message: 'Pare', destination: '/educacao', blockResume: true },
    ]);
  });

  it('commits deferred_safety flag and message independently of the default destino', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow());
    await addEffectFromMenu(user, 1, 'deferred_safety');

    const row = optionRow(1);
    await user.type(within(row).getByLabelText('Chave da sinalização'), 'risco');
    await user.tab();
    await user.type(within(row).getByLabelText('Mensagem'), 'Cuidado');
    await user.tab();

    expect(history).toHaveLength(3);
    const node = patchedNodeOf(history[2].patch, 'q1', isChoiceNode);
    expect(node.options[0]?.effects).toEqual([
      { kind: 'deferred_safety', flagKey: 'risco', message: 'Cuidado', destination: '/apoio' },
    ]);
  });

  it('commits the end_flow closing message on blur', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow());
    await addEffectFromMenu(user, 1, 'end_flow');

    await user.type(within(optionRow(1)).getByLabelText('Mensagem de encerramento'), 'Até mais');
    await user.tab();

    expect(history).toHaveLength(2);
    const node = patchedNodeOf(history[1].patch, 'q1', isChoiceNode);
    expect(node.options[0]?.effects).toEqual([{ kind: 'end_flow', message: 'Até mais' }]);
  });

  it('composes effect edits across sibling rows without clobbering', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createChoiceFlow());
    await addEffectFromMenu(user, 1, 'score');
    await addEffectFromMenu(user, 2, 'navigate');

    const chaveInput = within(optionRow(1)).getByLabelText('Chave de pontuação');
    await user.clear(chaveInput);
    await user.type(chaveInput, 'foco');
    await user.tab();
    await user.selectOptions(within(optionRow(2)).getByLabelText('Destino'), '/contatos');

    expect(history).toHaveLength(4);
    const applied = patchedNodeOf(history[3].patch, 'q1', isChoiceNode);
    expect(applied.options[0]?.effects).toEqual([{ kind: 'score', scoreKey: 'foco', value: 1 }]);
    expect(applied.options[1]?.effects).toEqual([{ kind: 'navigate', destination: '/contatos' }]);
  });
});
