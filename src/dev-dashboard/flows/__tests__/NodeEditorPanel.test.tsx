import { render, screen } from '@testing-library/react';
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
