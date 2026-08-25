import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { NodeEditorPanel } from '../NodeEditorPanel';
import type { ChoiceFlowNode, GuidedFlow, ResultFlowNode } from '../../../domain/flow-engine/types';

const choiceNode: ChoiceFlowNode = {
  id: 'q1',
  kind: 'choice',
  text: 'Como você está?',
  options: [{ id: 'q1-option-1', label: 'Ok', next: 'fim' }],
};

const resultNode: ResultFlowNode = { id: 'fim', kind: 'result', text: 'Fim.' };

function createFlow(overrides: Partial<GuidedFlow> = {}): GuidedFlow {
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

function renderPanel(flow: GuidedFlow = createFlow(), nodeId = 'q1') {
  const props = {
    flow,
    flows: [flow],
    nodeId,
    onFlowChange: vi.fn(),
    onClose: vi.fn(),
    onEditLegacy: vi.fn(),
  };
  render(<NodeEditorPanel {...props} />);
  return props;
}

function lastPatch(mock: ReturnType<typeof vi.fn>): Partial<GuidedFlow> {
  return mock.mock.calls.at(-1)?.[0] as Partial<GuidedFlow>;
}

/** Flow where "alvo" receives inbound option(s) from "origem". */
function createBranchyFlow(inboundOptionCount = 1): GuidedFlow {
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

describe('NodeEditorPanel', () => {
  let confirmSpy: MockInstance<typeof window.confirm>;
  let alertSpy: MockInstance<typeof window.alert>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the kind badge, ordered step number and existing text', () => {
    renderPanel(createFlow(), 'fim');
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Etapa 2', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Texto', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Fim.');
  });

  it('commits the edited text under nodes[nodeId] on blur', async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    const textarea = screen.getByRole('textbox', { name: /texto da etapa/i });
    await user.clear(textarea);
    await user.type(textarea, 'Texto atualizado');
    await user.tab();

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const patch = lastPatch(props.onFlowChange);
    expect(patch.nodes?.q1).toMatchObject({ id: 'q1', kind: 'choice', text: 'Texto atualizado' });
    expect(patch.nodes?.fim).toBeDefined();
  });

  it('does not commit when the text is unchanged on blur', async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    await user.click(screen.getByRole('textbox', { name: /texto da etapa/i }));
    await user.tab();

    expect(props.onFlowChange).not.toHaveBeenCalled();
  });

  it('duplicates the node and forwards a narrow nodes/nodeOrder patch', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createFlow(), 'q1');
    await user.click(screen.getByRole('button', { name: 'Duplicar etapa' }));

    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['nodes', 'nodeOrder']);
    expect(patch.nodes?.['q1-copy-1']).toMatchObject({ id: 'q1-copy-1' });
    expect(patch.nodeOrder).toEqual(['q1', 'q1-copy-1', 'fim']);
  });

  it('omits nodeOrder from duplicate patches for flows without an explicit order', async () => {
    const user = userEvent.setup();
    const unordered = createFlow({ nodeOrder: undefined });
    const props = renderPanel(unordered, 'q1');
    await user.click(screen.getByRole('button', { name: 'Duplicar etapa' }));

    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['nodes']);
    expect(patch.nodes?.['q1-copy-1']).toBeDefined();
  });

  it('confirms deletion with the breakage count and removes the node on accept', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createBranchyFlow(), 'alvo');
    await user.click(screen.getByRole('button', { name: 'Excluir etapa' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(String(confirmSpy.mock.calls[0][0])).toContain('1 conexão');

    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['nodes', 'nodeOrder']);
    expect(patch.nodes?.alvo).toBeUndefined();
    expect(patch.nodes?.origem).toBeDefined();
  });

  it('uses the plural confirm message with two inbound connections', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createBranchyFlow(2), 'alvo');
    await user.click(screen.getByRole('button', { name: 'Excluir etapa' }));

    expect(String(confirmSpy.mock.calls[0][0])).toContain('2 conexões ficarão sem destino');

    const patch = lastPatch(props.onFlowChange);
    expect(patch.nodes?.alvo).toBeUndefined();
  });

  it('applies nothing when deletion is declined', async () => {
    const user = userEvent.setup();
    confirmSpy.mockReturnValue(false);
    const props = renderPanel(createBranchyFlow(), 'alvo');
    await user.click(screen.getByRole('button', { name: 'Excluir etapa' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(props.onFlowChange).not.toHaveBeenCalled();
  });

  it('alerts instead of deleting the last remaining node', async () => {
    const user = userEvent.setup();
    const single = createFlow({
      entry: { nodeId: 'unico', enteringPhrases: [], transitionMessage: '' },
      nodes: { unico: { id: 'unico', kind: 'result', text: 'Único.' } },
      nodeOrder: ['unico'],
    });
    const props = renderPanel(single, 'unico');
    await user.click(screen.getByRole('button', { name: 'Excluir etapa' }));

    expect(alertSpy).toHaveBeenCalledWith('O fluxo precisa ter pelo menos uma etapa.');
    expect(props.onFlowChange).not.toHaveBeenCalled();
  });

  it('disables the entry action while editing the entry node', () => {
    renderPanel(createFlow(), 'q1');
    const button = screen.getByRole('button', { name: 'Definir como entrada' });
    expect(button).toBeDisabled();
  });

  it('patches only the entry when setting another node as entry', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createFlow(), 'fim');
    const button = screen.getByRole('button', { name: 'Definir como entrada' });
    expect(button).toBeEnabled();
    await user.click(button);

    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['entry']);
    expect(patch.entry?.nodeId).toBe('fim');
  });

  it('re-fires section scrolling when requestId bumps for the same section', () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoViewStub = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewStub;
    try {
      const base = {
        flow: createFlow(),
        flows: [createFlow()],
        nodeId: 'q1',
        onFlowChange: vi.fn(),
        onClose: vi.fn(),
        onEditLegacy: vi.fn(),
      };
      const view = render(<NodeEditorPanel {...base} focusRequest={{ section: 'texto', requestId: 1 }} />);
      view.rerender(<NodeEditorPanel {...base} focusRequest={{ section: 'texto', requestId: 2 }} />);

      expect(scrollIntoViewStub).toHaveBeenCalledTimes(2);
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('fires the legacy editor and close callbacks', async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    await user.click(screen.getByRole('button', { name: /abrir no editor legado/i }));
    await user.click(screen.getByRole('button', { name: /fechar painel de edição/i }));

    expect(props.onEditLegacy).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for an unknown nodeId', () => {
    const { container } = render(
      <NodeEditorPanel
        flow={createFlow()}
        flows={[]}
        nodeId="fantasma"
        onFlowChange={vi.fn()}
        onClose={vi.fn()}
        onEditLegacy={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-testid="node-editor-panel"]')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});

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
    const props = {
      flow,
      flows: [flow],
      nodeId: 'q1',
      onFlowChange: vi.fn(),
      onClose: vi.fn(),
      onEditLegacy: vi.fn(),
    };
    render(<NodeEditorPanel {...props} />);
    return props;
  }

  /** Host that applies patches like the real map does, recording every commit. */
  function renderStatefulChoicePanel(initialFlow: GuidedFlow) {
    const history: Array<{ patch: Partial<GuidedFlow>; applied: GuidedFlow }> = [];
    function Host() {
      const [flow, setFlow] = useState(initialFlow);
      return (
        <NodeEditorPanel
          flow={flow}
          flows={[flow]}
          nodeId="q1"
          onFlowChange={(patch) => {
            const applied = { ...flow, ...patch };
            history.push({ patch, applied });
            setFlow(applied);
          }}
          onClose={() => {}}
          onEditLegacy={() => {}}
        />
      );
    }
    render(<Host />);
    return history;
  }

  function patchedChoiceNode(patch: Partial<GuidedFlow>, nodeId = 'q1'): ChoiceFlowNode {
    const node = patch.nodes?.[nodeId];
    if (!node || node.kind !== 'choice') throw new Error(`expected a choice node patch for ${nodeId}`);
    return node;
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
    const node = patchedChoiceNode(lastPatch(props.onFlowChange));
    expect(node.text).toBe('Como você está?');
    expect(node.options[0]).toMatchObject({ id: 'q1-option-1', label: 'Tudo certo', next: 'fim' });
    expect(node.options[1]?.label).toBe('Mais ou menos');
  });

  it('updates only the chosen option target when a select changes', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino da opção 2' }), 'perdido');

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedChoiceNode(lastPatch(props.onFlowChange));
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
    const node = patchedChoiceNode(lastPatch(props.onFlowChange));
    expect(node.options[0]?.next).toBe('fim');
  });

  it('adds an empty option using the first free sequential option id', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel();
    await user.click(screen.getByRole('button', { name: 'Adicionar opção' }));

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedChoiceNode(lastPatch(props.onFlowChange));
    expect(node.options).toHaveLength(3);
    expect(node.options[2]).toEqual({ id: 'q1-option-3', label: '', next: '' });
    expect(node.options[0]).toMatchObject({ id: 'q1-option-1', label: 'Ok', next: 'fim' });
  });

  it('skips taken option ids when appending', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel(createChoiceFlow({ optionIds: ['q1-option-1', 'q1-option-3'] }));
    await user.click(screen.getByRole('button', { name: 'Adicionar opção' }));

    const node = patchedChoiceNode(lastPatch(props.onFlowChange));
    expect(node.options[2]?.id).toBe('q1-option-4');
  });

  it('removes only the clicked option row', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel();
    await user.click(screen.getAllByRole('button', { name: 'Remover opção' })[0]);

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const node = patchedChoiceNode(lastPatch(props.onFlowChange));
    expect(node.options).toHaveLength(1);
    expect(node.options[0]?.id).toBe('q1-option-2');
  });

  it('adds freeText with an empty next when toggled on', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel();
    await user.click(screen.getByRole('checkbox', { name: 'Aceitar resposta livre' }));

    const node = patchedChoiceNode(lastPatch(props.onFlowChange));
    expect(node.freeText).toEqual({ next: '' });
    expect(node.options).toHaveLength(2);
  });

  it('removes the freeText key entirely when toggled off', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel(createChoiceFlow({ freeText: true }));
    const checkbox = screen.getByRole('checkbox', { name: 'Aceitar resposta livre' });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);

    const node = patchedChoiceNode(lastPatch(props.onFlowChange));
    expect(node).not.toHaveProperty('freeText');
  });

  it('patches freeText.next from its own select', async () => {
    const user = userEvent.setup();
    const props = renderChoicePanel(createChoiceFlow({ freeText: true }));
    const select = screen.getByRole('combobox', { name: 'Destino da resposta livre' });
    expect(select).toHaveValue('fim');

    await user.selectOptions(select, 'perdido');

    const node = patchedChoiceNode(lastPatch(props.onFlowChange));
    expect(node.freeText).toEqual({ next: 'perdido' });
  });

  it('renders no opções section for a non-choice node', () => {
    const flow = createChoiceFlow();
    const { container } = render(
      <NodeEditorPanel
        flow={flow}
        flows={[flow]}
        nodeId="fim"
        onFlowChange={vi.fn()}
        onClose={vi.fn()}
        onEditLegacy={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-section="opcoes"]')).toBeNull();
  });

  it('editing an option label then the texto field commits both payloads without clobbering', async () => {
    const user = userEvent.setup();
    const history = renderStatefulChoicePanel(createChoiceFlow());

    await user.type(screen.getByRole('textbox', { name: 'Rótulo da opção 1' }), '!');
    await user.click(screen.getByRole('textbox', { name: /texto da etapa/i }));
    // The sibling row keeps its draft across the label-commit re-render.
    expect(screen.getByRole('textbox', { name: 'Rótulo da opção 2' })).toHaveValue('Mais ou menos');

    await user.type(screen.getByRole('textbox', { name: /texto da etapa/i }), '?');
    await user.tab();

    expect(history).toHaveLength(2);
    const labelNode = patchedChoiceNode(history[0].patch);
    expect(labelNode.options[0]?.label).toBe('Ok!');
    expect(labelNode.text).toBe('Como você está?'); // label commit carries the untouched text

    const textNode = patchedChoiceNode(history[1].patch);
    expect(textNode.text).toBe('Como você está??'); // textarea was not reset by the label commit
    expect(textNode.options[0]?.label).toBe('Ok!'); // text commit carries the committed label
  });
});
