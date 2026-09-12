import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { NodeEditorPanel } from '../NodeEditorPanel';
import { TargetSelect } from '../flowTargetSelect';
import { installScrollStub } from './scrollStubs';
import { createBranchyFlow, createFlow, lastPatch, makePanelProps, renderPanel } from './nodeEditorPanelTestSupport';

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
