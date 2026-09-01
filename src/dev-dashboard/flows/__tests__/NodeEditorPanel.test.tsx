import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { NodeEditorPanel } from '../NodeEditorPanel';
import { TargetSelect } from '../flowTargetSelect';
import { installScrollStub } from './scrollStubs';
import type {
  ChoiceFlowNode,
  FlowEffect,
  FlowNode,
  GuidedFlow,
  OrientationVideo,
  ResultFlowNode,
  ScoreBranch,
  ScoreBranchFlowNode,
} from '../../../domain/flow-engine/types';

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

/** Single factory for every render site; overrides keep specialized hosts terse. */
function makePanelProps(
  flow: GuidedFlow = createFlow(),
  nodeId = 'q1',
  overrides: Partial<{ flows: GuidedFlow[]; onFlowChange: (patch: Partial<GuidedFlow>) => void }> = {},
) {
  return {
    flow,
    flows: [flow],
    nodeId,
    onFlowChange: vi.fn(),
    onClose: vi.fn(),
    onEditLegacy: vi.fn(),
    ...overrides,
  };
}

type PanelProps = ReturnType<typeof makePanelProps>;

function renderPanel(flow: GuidedFlow = createFlow(), nodeId = 'q1') {
  const props = makePanelProps(flow, nodeId);
  render(<NodeEditorPanel {...props} />);
  return props;
}

function lastPatch(mock: PanelProps['onFlowChange']): Partial<GuidedFlow> {
  const calls = (mock as ReturnType<typeof vi.fn>).mock.calls as Array<[Partial<GuidedFlow>]>;
  return calls.at(-1)?.[0] as Partial<GuidedFlow>;
}

type PatchHistory = Array<{ patch: Partial<GuidedFlow>; applied: GuidedFlow }>;

/**
 * Shared host for multi-commit scenarios: applies patches like the real map
 * does, recording every commit so later events must compose over earlier ones.
 */
function renderStatefulPanel(
  initialFlow: GuidedFlow,
  nodeId = 'q1',
  opts: { flows?: GuidedFlow[] } = {},
): PatchHistory {
  const history: PatchHistory = [];
  function Host() {
    const [flow, setFlow] = useState(initialFlow);
    return (
      <NodeEditorPanel
        {...makePanelProps(flow, nodeId, {
          flows: opts.flows ?? [flow],
          onFlowChange: (patch) => {
            const applied = { ...flow, ...patch };
            history.push({ patch, applied });
            setFlow(applied);
          },
        })}
      />
    );
  }
  render(<Host />);
  return history;
}

const isChoiceNode = (node: FlowNode): node is ChoiceFlowNode => node.kind === 'choice';
const isScoreBranchNode = (node: FlowNode): node is ScoreBranchFlowNode => node.kind === 'score_branch';
const isResultNode = (node: FlowNode): node is ResultFlowNode => node.kind === 'result';

/** Extracts the patched node from a commit; `predicate` narrows the payload by kind. */
function patchedNodeOf<T extends FlowNode>(
  patch: Partial<GuidedFlow>,
  nodeId: string,
  predicate?: (node: FlowNode) => node is T,
): T {
  const node = patch.nodes?.[nodeId];
  if (!node) throw new Error(`expected a node patch for ${nodeId}`);
  if (predicate) {
    if (!predicate(node)) throw new Error(`expected a matching node patch for ${nodeId}`);
    return node;
  }
  // No predicate: callers rely on the default FlowNode instantiation.
  return node as T;
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

  it('explains why the last remaining node cannot be deleted', () => {
    const single = createFlow({
      entry: { nodeId: 'unico', enteringPhrases: [], transitionMessage: '' },
      nodes: { unico: { id: 'unico', kind: 'result', text: 'Único.' } },
      nodeOrder: ['unico'],
    });
    const props = renderPanel(single, 'unico');
    expect(screen.getByRole('button', { name: 'Excluir etapa' })).toBeDisabled();
    expect(screen.getByText('Crie outra etapa antes de excluir a única etapa do fluxo.')).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
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
    const { stub: scrollIntoViewStub, restore } = installScrollStub();
    try {
      const base = makePanelProps();
      const view = render(<NodeEditorPanel {...base} focusRequest={{ section: 'texto', requestId: 1 }} />);
      view.rerender(<NodeEditorPanel {...base} focusRequest={{ section: 'texto', requestId: 2 }} />);

      expect(scrollIntoViewStub).toHaveBeenCalledTimes(2);
    } finally {
      restore();
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
    const { container } = render(<NodeEditorPanel {...makePanelProps(createFlow(), 'fantasma')} />);

    expect(container.querySelector('[data-testid="node-editor-panel"]')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('derives the header step number from topology even without nodeOrder', () => {
    renderPanel(createFlow({ nodeOrder: undefined }), 'fim');
    expect(screen.getByRole('heading', { name: 'Etapa 2', level: 2 })).toBeInTheDocument();
  });

  it('omits the Destino ausente fallback for an empty value on a required select', () => {
    render(<TargetSelect ariaLabel="Destino obrigatório" value="" onChange={() => {}} nodes={[]} />);
    const select = screen.getByRole('combobox', { name: 'Destino obrigatório' });
    // No bogus "Destino ausente · " placeholder for an empty value.
    expect(within(select).queryAllByRole('option')).toHaveLength(0);
  });

  it('keeps the Destino ausente fallback for a non-empty unknown value', () => {
    render(<TargetSelect ariaLabel="Destino" value="fantasma" onChange={() => {}} nodes={[]} />);
    const select = screen.getByRole('combobox', { name: 'Destino' });
    expect(select).toHaveValue('fantasma');
    expect(within(select).getByRole('option', { name: 'Destino ausente · fantasma' })).toBeInTheDocument();
  });
});

describe('NodeEditorPanel reordenação', () => {
  const upButton = () => screen.getByRole('button', { name: 'Mover etapa para cima' });
  const downButton = () => screen.getByRole('button', { name: 'Mover etapa para baixo' });

  it('renders both move buttons, disabling the bound the node sits on', () => {
    renderPanel(createFlow(), 'q1'); // first of ['q1', 'fim']

    expect(upButton()).toBeDisabled();
    expect(downButton()).toBeEnabled();
  });

  it('disables only the down button on the last effective step', () => {
    renderPanel(createFlow(), 'fim');

    expect(upButton()).toBeEnabled();
    expect(downButton()).toBeDisabled();
  });

  it('derives bounds from record insertion order when nodeOrder is absent', () => {
    // Record keys: q1 then fim — fim stays effectively last without nodeOrder.
    renderPanel(createFlow({ nodeOrder: undefined }), 'fim');

    expect(upButton()).toBeEnabled();
    expect(downButton()).toBeDisabled();
  });

  it('moves down emitting exactly a narrow {nodeOrder} patch', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createFlow(), 'q1');
    await user.click(downButton());

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['nodeOrder']);
    expect(patch.nodeOrder).toEqual(['fim', 'q1']);
    expect(patch.nodes).toBeUndefined(); // nodes content never changes on a move
  });

  it('materializes nodeOrder from insertion order on the first move when none exists', async () => {
    const user = userEvent.setup();
    const unordered = createFlow({ nodeOrder: undefined });
    const props = renderPanel(unordered, 'fim');
    await user.click(upButton());

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['nodeOrder']); // materialization still emits ONLY the order
    expect(patch.nodeOrder).toEqual(['fim', 'q1']); // insertion order [q1, fim] with fim moved up
  });

  it('emits no patch when a bounds-blocked move is somehow requested', async () => {
    // Buttons are disabled at bounds; pin that a forced click path stays inert.
    const props = renderPanel(createFlow(), 'q1');
    expect(upButton()).toBeDisabled();

    fireEvent.click(upButton());
    expect(props.onFlowChange).not.toHaveBeenCalled();
  });

  it('composes successive moves across commits through the stateful host', async () => {
    const user = userEvent.setup();
    const history: Array<Partial<GuidedFlow>> = [];
    function Host() {
      const [flow, setFlow] = useState(createFlow());
      return (
        <NodeEditorPanel
          {...makePanelProps(flow, 'fim', {
            onFlowChange: (patch) => {
              history.push(patch);
              setFlow((current) => ({ ...current, ...patch }));
            },
          })}
        />
      );
    }
    render(<Host />);

    await user.click(upButton()); // ['fim', 'q1'] — fim now first
    expect(downButton()).toBeEnabled(); // disabled states track the NEW order
    expect(upButton()).toBeDisabled();
    await user.click(downButton()); // back to ['q1', 'fim']

    expect(history.map((patch) => Object.keys(patch))).toEqual([['nodeOrder'], ['nodeOrder']]);
    expect(history[0]?.nodeOrder).toEqual(['fim', 'q1']);
    expect(history[1]?.nodeOrder).toEqual(['q1', 'fim']);
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

  describe('efeitos', () => {
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
      await user.selectOptions(
        screen.getByRole('combobox', { name: `Adicionar efeito à opção ${optionNumber}` }),
        kind,
      );
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
      expect(
        screen.getByRole('button', { name: 'Remover efeito 1 (navegar para área) da opção 2' }),
      ).toBeInTheDocument();

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
});

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

describe('NodeEditorPanel mídia', () => {
  const videoA: OrientationVideo = {
    id: 'fim-video-1',
    title: 'Respiração',
    url: 'https://www.youtube.com/watch?v=abc',
  };
  const videoB: OrientationVideo = { id: 'fim-video-2', title: 'Sono', url: 'https://youtu.be/xyz' };

  function createMediaFlow(nodeOverrides: Partial<ResultFlowNode> = {}): GuidedFlow {
    const fim: ResultFlowNode = { ...resultNode, ...nodeOverrides };
    return createFlow({ nodes: { q1: choiceNode, fim }, nodeOrder: ['q1', 'fim'] });
  }

  function renderMediaPanel(flow: GuidedFlow = createMediaFlow(), nodeId = 'fim') {
    const props = makePanelProps(flow, nodeId);
    render(<NodeEditorPanel {...props} />);
    return props;
  }

  it('shows only the add button while the node has no videos', () => {
    renderMediaPanel();

    expect(screen.queryByLabelText(/Título do vídeo/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/URL do vídeo/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar vídeo' })).toBeInTheDocument();
  });

  it('renders title/url rows for existing videos without hinting YouTube links', () => {
    renderMediaPanel(createMediaFlow({ videos: [videoA, videoB] }));

    expect(screen.getByLabelText('Título do vídeo 1')).toHaveValue('Respiração');
    expect(screen.getByLabelText('URL do vídeo 1')).toHaveValue(videoA.url);
    expect(screen.getByLabelText('Título do vídeo 2')).toHaveValue('Sono');
    expect(screen.getByLabelText('URL do vídeo 2')).toHaveValue(videoB.url);
    expect(screen.getByRole('button', { name: 'Remover vídeo 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover vídeo 2' })).toBeInTheDocument();
    // youtube.com and youtu.be links never trigger the advisory hint.
    expect(screen.queryByText('Use um link completo do YouTube.')).not.toBeInTheDocument();
  });

  it('round-trips videos through the updater and drops the key when the last one goes', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createMediaFlow(), 'fim');

    await user.click(screen.getByRole('button', { name: 'Adicionar vídeo' }));
    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'fim').videos).toEqual([{ id: 'fim-video-1', title: '', url: '' }]);

    await user.type(screen.getByLabelText('Título do vídeo 1'), 'Vídeo útil');
    await user.tab();
    expect(history).toHaveLength(2);
    expect(patchedNodeOf(history[1].patch, 'fim').videos?.[0]).toEqual({
      id: 'fim-video-1',
      title: 'Vídeo útil',
      url: '',
    });

    await user.type(screen.getByLabelText('URL do vídeo 1'), 'https://example.com/apoio');
    await user.tab();
    expect(history).toHaveLength(3);
    expect(patchedNodeOf(history[2].patch, 'fim').videos?.[0]?.url).toBe('https://example.com/apoio');

    await user.click(screen.getByRole('button', { name: 'Adicionar vídeo' }));
    expect(patchedNodeOf(history[3].patch, 'fim').videos?.[1]?.id).toBe('fim-video-2');

    await user.click(screen.getByRole('button', { name: 'Remover vídeo 1' }));
    expect(history).toHaveLength(5);
    expect(patchedNodeOf(history[4].patch, 'fim').videos).toEqual([{ id: 'fim-video-2', title: '', url: '' }]);

    await user.click(screen.getByRole('button', { name: 'Remover vídeo 1' }));
    expect(history).toHaveLength(6);
    expect(patchedNodeOf(history[5].patch, 'fim')).not.toHaveProperty('videos'); // last removal drops the key entirely
  });

  it('shows the YouTube hint only for non-empty non-YouTube URLs', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(
      createMediaFlow({ videos: [{ id: 'fim-video-1', title: 'Dica', url: 'https://example.com/x' }] }),
      'fim',
    );

    expect(screen.getByText('Use um link completo do YouTube.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('URL do vídeo 1'));
    await user.type(screen.getByLabelText('URL do vídeo 1'), 'https://youtu.be/z9');
    await user.tab();

    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'fim').videos?.[0]?.url).toBe('https://youtu.be/z9');
    expect(screen.queryByText('Use um link completo do YouTube.')).not.toBeInTheDocument();
  });

  it('hides the hint while the URL field is empty', () => {
    renderMediaPanel(createMediaFlow({ videos: [{ id: 'fim-video-1', title: '', url: '' }] }));

    expect(screen.queryByText('Use um link completo do YouTube.')).not.toBeInTheDocument();
  });

  it('splits recommendations one per line and joins them back for display', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createMediaFlow({ recommendations: ['Durma bem', 'Procure apoio'] }), 'fim');
    const textarea = screen.getByLabelText('Recomendações da etapa final');

    expect(textarea).toHaveValue('Durma bem\nProcure apoio'); // joined back for display
    expect(textarea).toHaveAttribute('placeholder', 'Uma recomendação por linha.');

    await user.type(textarea, '\nFale com alguém de confiança');
    await user.tab();

    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'fim', isResultNode).recommendations).toEqual([
      'Durma bem',
      'Procure apoio',
      'Fale com alguém de confiança',
    ]);

    // Blank lines are dropped and neighbors trimmed on the next commit.
    await user.clear(textarea);
    await user.type(textarea, 'a\n\n b ');
    await user.tab();
    expect(history).toHaveLength(2);
    expect(patchedNodeOf(history[1].patch, 'fim', isResultNode).recommendations).toEqual(['a', 'b']);
  });

  it('drops the recommendations key entirely when every line is removed', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createMediaFlow({ recommendations: ['Só uma linha'] }), 'fim');

    await user.clear(screen.getByLabelText('Recomendações da etapa final'));
    await user.tab();

    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'fim', isResultNode)).not.toHaveProperty('recommendations');
  });

  it('omits recommendations for non-result nodes but keeps the video affordance everywhere', async () => {
    const user = userEvent.setup();
    const props = renderMediaPanel(createMediaFlow(), 'q1');

    expect(screen.queryByLabelText('Recomendações da etapa final')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar vídeo' })).toBeInTheDocument(); // mídia works on choices too

    await user.click(screen.getByRole('button', { name: 'Adicionar vídeo' }));
    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    expect(patchedNodeOf(lastPatch(props.onFlowChange), 'q1').videos).toEqual([
      { id: 'q1-video-1', title: '', url: '' },
    ]);
  });
});

describe('NodeEditorPanel imagens', () => {
  const EMPTY_HINT = 'A imagem aparece logo abaixo da mensagem no chat. Envie um arquivo ou cole um link https://…';

  function createVisualFlow(nodeOverrides: Partial<ChoiceFlowNode> = {}): GuidedFlow {
    const q1: ChoiceFlowNode = { ...choiceNode, ...nodeOverrides };
    return createFlow({ nodes: { q1, fim: resultNode }, nodeOrder: ['q1', 'fim'] });
  }

  it('adds an empty visual on "Adicionar imagem" and hides the empty hint', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createVisualFlow(), 'q1');

    expect(screen.getByText(EMPTY_HINT)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Adicionar imagem' }));

    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'q1').visuals).toEqual([{ id: 'q1-visual-1', alt: '', src: '' }]);
    expect(screen.queryByText(EMPTY_HINT)).not.toBeInTheDocument();
  });

  it('commits edited src and alt on blur', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createVisualFlow(), 'q1');

    await user.click(screen.getByRole('button', { name: 'Adicionar imagem' }));

    await user.type(screen.getByLabelText('Origem da imagem 1'), 'https://exemplo.com/foto.png');
    await user.tab();
    expect(history).toHaveLength(2);
    expect(patchedNodeOf(history[1].patch, 'q1').visuals?.[0]?.src).toBe('https://exemplo.com/foto.png');

    await user.type(screen.getByLabelText('Descrição da imagem 1'), 'Pessoa respirando fundo');
    await user.tab();
    expect(history).toHaveLength(3);
    expect(patchedNodeOf(history[2].patch, 'q1').visuals?.[0]?.alt).toBe('Pessoa respirando fundo');
  });

  it('shows uploaded data URLs as a disabled origin field and lets them be deleted', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(
      createVisualFlow({ visuals: [{ id: 'v1', alt: 'x', src: 'data:image/png;base64,AAAA' }] }),
      'q1',
    );

    const srcInput = screen.getByLabelText('Origem da imagem 1');
    expect(srcInput).toBeDisabled();
    expect(srcInput).toHaveValue('Imagem enviada neste navegador');
    expect(screen.getByText('Trocar imagem')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deletar imagem enviada' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deletar imagem enviada' }));
    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'q1').visuals?.[0]?.src).toBe('');
  });

  it('uploads a file and commits the data URL as src', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createVisualFlow(), 'q1');

    await user.click(screen.getByRole('button', { name: 'Adicionar imagem' }));

    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'foto.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Enviar imagem 1'), { target: { files: [file] } });

    await waitFor(() => expect(history).toHaveLength(2));
    const committed = patchedNodeOf(history[1].patch, 'q1').visuals?.[0]?.src ?? '';
    expect(committed.startsWith('data:image/png;base64,')).toBe(true);

    expect(screen.getByText('Trocar imagem')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Deletar imagem enviada' }));
    expect(history).toHaveLength(3);
    expect(patchedNodeOf(history[2].patch, 'q1').visuals?.[0]?.src).toBe('');
  });

  it('alerts and commits nothing when the file is not a compatible image', async () => {
    const history = renderStatefulPanel(createVisualFlow({ visuals: [{ id: 'v1', alt: '', src: '' }] }), 'q1');

    const file = new File(['conteúdo'], 'notas.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Enviar imagem 1'), { target: { files: [file] } });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('não é uma imagem compatível');
    // Nenhum commit aconteceu: o histórico continua vazio.
    expect(history).toHaveLength(0);
  });

  it('removes one visual keeping siblings and drops the visuals key on the last removal', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(
      createVisualFlow({
        visuals: [
          { id: 'v1', alt: 'a', src: 'https://exemplo.com/a.png' },
          { id: 'v2', alt: 'b', src: 'https://exemplo.com/b.png' },
        ],
      }),
      'q1',
    );

    await user.click(screen.getByRole('button', { name: 'Remover imagem 1' }));
    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'q1').visuals).toEqual([
      { id: 'v2', alt: 'b', src: 'https://exemplo.com/b.png' },
    ]);

    await user.click(screen.getByRole('button', { name: 'Remover imagem 1' }));
    expect(history).toHaveLength(2);
    expect(patchedNodeOf(history[1].patch, 'q1')).not.toHaveProperty('visuals'); // last removal drops the key entirely
  });

  it('offers images on score_branch nodes without touching scoreKey/branches', async () => {
    const user = userEvent.setup();
    const flow = createFlow({
      entry: { nodeId: 'r1', enteringPhrases: [], transitionMessage: '' },
      nodes: {
        r1: {
          id: 'r1',
          kind: 'score_branch',
          text: 'Ramificação',
          scoreKey: 'pontuacao',
          branches: [{ id: 'r1-faixa-1', min: 0, max: 5, next: 'fim' }],
        },
        fim: resultNode,
      },
      nodeOrder: ['r1', 'fim'],
    });
    const history = renderStatefulPanel(flow, 'r1');

    expect(screen.getByRole('button', { name: 'Adicionar imagem' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Adicionar imagem' }));

    const node = patchedNodeOf(history[0].patch, 'r1', isScoreBranchNode);
    expect(node.scoreKey).toBe('pontuacao');
    expect(node.branches).toEqual([{ id: 'r1-faixa-1', min: 0, max: 5, next: 'fim' }]);
    expect(node.visuals).toEqual([{ id: 'r1-visual-1', alt: '', src: '' }]);
  });
});

describe('NodeEditorPanel troca de tipo', () => {
  let confirmSpy: MockInstance<typeof window.confirm>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const openChooser = async (user: UserEvent) => {
    await user.click(screen.getByRole('button', { name: 'Trocar tipo' }));
    return screen.getByRole('group', { name: 'Novo tipo da etapa' });
  };

  it('opens an inline chooser marking the current kind disabled', async () => {
    const user = userEvent.setup();
    renderPanel(createFlow(), 'q1'); // choice node

    const chooser = await openChooser(user);
    expect(within(chooser).getByRole('button', { name: '✓ Pergunta (atual)' })).toBeDisabled();
    expect(within(chooser).getByRole('button', { name: 'Final' })).toBeEnabled();
    expect(within(chooser).getByRole('button', { name: 'Ramificação' })).toBeEnabled();
  });

  it('confirms and emits a narrow {nodes} patch preserving the text', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createFlow(), 'q1');
    await openChooser(user);
    await user.click(
      within(screen.getByRole('group', { name: 'Novo tipo da etapa' })).getByRole('button', { name: 'Final' }),
    );

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(String(confirmSpy.mock.calls[0][0])).toContain('texto será preservado');

    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['nodes']); // narrow: nodeOrder/entry untouched
    const node = patch.nodes?.q1;
    expect(node?.kind).toBe('result');
    if (node?.kind === 'result') expect(node.text).toBe('Como você está?');
    expect(screen.queryByRole('group', { name: 'Novo tipo da etapa' })).not.toBeInTheDocument(); // chooser closed
  });

  it('stays mounted on the same stage with the badge updated after switching', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createFlow(), 'q1');
    await openChooser(user);
    await user.click(
      within(screen.getByRole('group', { name: 'Novo tipo da etapa' })).getByRole('button', { name: 'Ramificação' }),
    );

    expect(history).toHaveLength(1);
    // Same panel instance, same nodeId — only the flow changed underneath.
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    // The score_branch body replaced the options one…
    expect(screen.getByRole('heading', { name: 'Ramificação', level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Opções', level: 3 })).not.toBeInTheDocument();
    // …and reopening the chooser marks the NEW kind as current.
    await user.click(screen.getByRole('button', { name: 'Trocar tipo' }));
    expect(
      within(screen.getByRole('group', { name: 'Novo tipo da etapa' })).getByRole('button', {
        name: '✓ Ramificação (atual)',
      }),
    ).toBeDisabled();
  });

  it('applies nothing and closes the chooser when the confirm is declined', async () => {
    confirmSpy.mockReturnValue(false);
    const user = userEvent.setup();
    const props = renderPanel(createFlow(), 'q1');
    await openChooser(user);
    await user.click(
      within(screen.getByRole('group', { name: 'Novo tipo da etapa' })).getByRole('button', { name: 'Final' }),
    );

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(props.onFlowChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Novo tipo da etapa' })).not.toBeInTheDocument();
  });

  it('closes the chooser on Escape without touching the flow', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createFlow(), 'q1');
    await openChooser(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group', { name: 'Novo tipo da etapa' })).not.toBeInTheDocument();
    expect(props.onFlowChange).not.toHaveBeenCalled();
  });
});
