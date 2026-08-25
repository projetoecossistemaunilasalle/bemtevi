import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { FlowMap } from '../FlowMap';
import { FlowSettingsPanel } from '../FlowSettingsPanel';

const choiceNode: GuidedFlow['nodes'][string] = {
  id: 'q1',
  kind: 'choice',
  text: 'Como você está?',
  options: [{ id: 'q1-option-1', label: 'Ok', next: 'fim' }],
};

function createFlow(overrides: Partial<GuidedFlow> = {}): GuidedFlow {
  return {
    id: 'flow-1',
    version: '1',
    locale: 'pt-BR',
    title: 'Fluxo de teste',
    type: 'guided_conversation',
    status: 'draft',
    entry: { nodeId: 'q1', enteringPhrases: ['oi'], transitionMessage: 'Vamos começar.' },
    nodes: {
      q1: choiceNode,
      fim: { id: 'fim', kind: 'result', text: 'Fim.' },
    },
    nodeOrder: ['q1', 'fim'],
    ...overrides,
  };
}

/** Single factory for every render site; overrides keep specialized hosts terse. */
function makePanelProps(
  flow: GuidedFlow = createFlow(),
  overrides: Partial<{ onFlowChange: (patch: Partial<GuidedFlow>) => void; onClose: () => void }> = {},
) {
  return {
    flow,
    onFlowChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

type PanelProps = ReturnType<typeof makePanelProps>;

function renderPanel(flow: GuidedFlow = createFlow()) {
  const props = makePanelProps(flow);
  render(<FlowSettingsPanel {...props} />);
  return props;
}

function lastPatch(mock: PanelProps['onFlowChange']): Partial<GuidedFlow> {
  const calls = (mock as ReturnType<typeof vi.fn>).mock.calls as Array<[Partial<GuidedFlow>]>;
  return calls.at(-1)?.[0] as Partial<GuidedFlow>;
}

/**
 * Shared host for multi-commit scenarios: applies patches like the real map
 * does, so later events compose over earlier commits instead of stale props.
 */
function renderStatefulPanel(initialFlow: GuidedFlow): Array<Partial<GuidedFlow>> {
  const patches: Array<Partial<GuidedFlow>> = [];
  function Host() {
    const [flow, setFlow] = useState(initialFlow);
    return (
      <FlowSettingsPanel
        {...makePanelProps(flow, {
          onFlowChange: (patch) => {
            patches.push(patch);
            setFlow((current) => ({ ...current, ...patch }));
          },
        })}
      />
    );
  }
  render(<Host />);
  return patches;
}

describe('FlowSettingsPanel', () => {
  it('renders the overlay with heading, sections and close button', () => {
    renderPanel();

    expect(screen.getByTestId('flow-settings-panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configurações do fluxo', level: 2 })).toBeInTheDocument();
    for (const section of ['Título do fluxo', 'Uso do fluxo', 'Status', 'Etapa de entrada', 'Frases de entrada']) {
      expect(screen.getByRole('heading', { name: section, level: 3 })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Fechar configurações' })).toBeInTheDocument();
  });

  it('commits an edited title as a narrow {title} patch on blur', async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    const title = screen.getByRole('textbox', { name: 'Título do fluxo' });
    await user.clear(title);
    await user.type(title, 'Novo título');
    await user.tab();

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['title']);
    expect(patch.title).toBe('Novo título');
  });

  it('does not commit when the title is unchanged on blur', async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    await user.click(screen.getByRole('textbox', { name: 'Título do fluxo' }));
    await user.tab();

    expect(props.onFlowChange).not.toHaveBeenCalled();
  });

  it('commits a purpose change immediately as a narrow {purpose} patch', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createFlow({ purpose: 'orientation_entry' }));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Uso do fluxo' }), 'post_flow_routing');

    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['purpose']);
    expect(patch.purpose).toBe('post_flow_routing');
  });

  it('keeps an unset purpose representable before committing a real one', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createFlow({ purpose: undefined }));

    const select = screen.getByRole('combobox', { name: 'Uso do fluxo' }) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getByRole('option', { name: '— sem uso definido —' })).toBeInTheDocument();

    await user.selectOptions(select, 'orientation_entry');

    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['purpose']);
    expect(patch.purpose).toBe('orientation_entry');
  });

  it('keeps an unknown purpose representable before switching to a valid one', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createFlow({ purpose: 'valor-estranho' as GuidedFlow['purpose'] }));

    // The out-of-union current renders as its own selected option instead of
    // silently falling back to the first valid choice.
    const select = screen.getByRole('combobox', { name: 'Uso do fluxo' }) as HTMLSelectElement;
    expect(select.value).toBe('valor-estranho');
    expect(screen.getByRole('option', { name: 'Uso desconhecido · valor-estranho' })).toBeInTheDocument();

    await user.selectOptions(select, 'orientation_entry');

    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['purpose']);
    expect(patch.purpose).toBe('orientation_entry');
  });

  it('renders the shared status labels and commits a narrow {status} patch', async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    const statusSelect = screen.getByRole('combobox', { name: 'Status do fluxo' });
    for (const label of ['Rascunho', 'Em revisão', 'Aprovado', 'Arquivado']) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }

    await user.selectOptions(statusSelect, 'approved');

    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['status']);
    expect(patch.status).toBe('approved');
  });

  it('repoints the entry stage through a narrow {entry} patch carrying phrases over', async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Etapa de entrada' }), 'fim');

    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['entry']);
    expect(patch.entry?.nodeId).toBe('fim');
    // setEntryNode carries entering phrases (and transition message) untouched.
    expect(patch.entry?.enteringPhrases).toEqual(['oi']);
    expect(patch.entry?.transitionMessage).toBe('Vamos começar.');
  });

  it('adds a focused empty row and commits edits as merged trimmed lists', async () => {
    const user = userEvent.setup();
    const patches = renderStatefulPanel(createFlow());

    const firstPhrase = screen.getByRole('textbox', { name: 'Frase de entrada 1' });
    await user.clear(firstPhrase);
    await user.type(firstPhrase, '  olá  ');
    await user.tab();

    // Edit commit recomputes the full list, trimming the edited entry.
    expect(patches).toHaveLength(1);
    expect(Object.keys(patches[0] ?? {})).toEqual(['entry']);
    expect(patches[0]?.entry?.enteringPhrases).toEqual(['olá']);

    await user.click(screen.getByRole('button', { name: 'Adicionar frase' }));
    const appended = screen.getByRole('textbox', { name: 'Frase de entrada 2' });
    expect(appended).toHaveFocus();

    // Appended rows stay local until their text commits on blur.
    expect(patches).toHaveLength(1);
    await user.type(appended, 'tchau');
    await user.tab();

    expect(patches).toHaveLength(2);
    expect(patches[1]?.entry?.enteringPhrases).toEqual(['olá', 'tchau']);

    // Removing a row commits immediately through the same merge path.
    await user.click(screen.getByRole('button', { name: 'Remover frase 1' }));

    expect(patches).toHaveLength(3);
    expect(patches[2]?.entry?.enteringPhrases).toEqual(['tchau']);
  });

  it('strips blank drafts across rows down to an allowed empty list', async () => {
    const user = userEvent.setup();
    const patches = renderStatefulPanel(
      createFlow({ entry: { nodeId: 'q1', enteringPhrases: ['primeira', 'segunda'], transitionMessage: '' } }),
    );

    const firstPhrase = screen.getByRole('textbox', { name: 'Frase de entrada 1' });
    await user.clear(firstPhrase);
    await user.type(firstPhrase, '   ');
    await user.tab();

    // The blanked row drops out; the untouched sibling survives.
    expect(patches).toHaveLength(1);
    expect(patches[0]?.entry?.enteringPhrases).toEqual(['segunda']);

    await user.clear(screen.getByRole('textbox', { name: 'Frase de entrada 1' }));
    await user.tab();

    expect(patches).toHaveLength(2);
    expect(patches[1]?.entry?.enteringPhrases).toEqual([]);
  });

  it('removes the last phrase committing an empty list immediately', async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Remover frase 1' }));

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const patch = lastPatch(props.onFlowChange);
    expect(Object.keys(patch)).toEqual(['entry']);
    expect(patch.entry?.enteringPhrases).toEqual([]);
  });

  it('removes a middle row keeping the surrounding ones', async () => {
    const user = userEvent.setup();
    const props = renderPanel(
      createFlow({ entry: { nodeId: 'q1', enteringPhrases: ['uma', 'duas', 'três'], transitionMessage: '' } }),
    );

    await user.click(screen.getByRole('button', { name: 'Remover frase 2' }));

    const patch = lastPatch(props.onFlowChange);
    expect(patch.entry?.enteringPhrases).toEqual(['uma', 'três']);
  });

  it('leaves no stale draft behind when a removal lands next to an unblurred append', async () => {
    const user = userEvent.setup();
    const patches = renderStatefulPanel(createFlow());

    // Append a row and type into it without ever blurring.
    await user.click(screen.getByRole('button', { name: 'Adicionar frase' }));
    const appended = screen.getByRole('textbox', { name: 'Frase de entrada 2' });
    expect(appended).toHaveFocus();
    await user.type(appended, 'lixo');

    // Removing ANOTHER row first blurs the appended row (its draft commits),
    // then drops the removed phrase — the typed text must survive, the
    // removed row's text must not.
    await user.click(screen.getByRole('button', { name: 'Remover frase 1' }));

    expect(patches.map((patch) => patch.entry?.enteringPhrases)).toEqual([
      ['oi', 'lixo'], // blur merged the pending draft
      ['lixo'], // then the removal committed
    ]);

    // A fresh append starts from a clean draft: nothing reattached.
    await user.click(screen.getByRole('button', { name: 'Adicionar frase' }));
    const freshRow = screen.getByRole('textbox', { name: 'Frase de entrada 2' });
    expect(freshRow).toHaveFocus();
    expect(freshRow).toHaveValue('');
  });
});

describe('FlowMap settings integration', () => {
  const mapFlow = createFlow();

  function renderMap() {
    return render(
      <FlowMap flow={mapFlow} flows={[mapFlow]} onFlowChange={vi.fn()} onEditNode={vi.fn()} onSelectFlow={vi.fn()} />,
    );
  }

  it('toggles aria-expanded, stacks over the node panel and restores trigger focus on Escape', async () => {
    const user = userEvent.setup();
    renderMap();

    const trigger = screen.getByRole('button', { name: 'Configurações do fluxo' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

    // An open node panel stays open when settings open (accepted overlap).
    fireEvent.click(screen.getByText('Como você está?'));
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('flow-settings-panel')).toBeInTheDocument();
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();

    // Escape inside the settings panel closes it and refocuses the gear.
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('flow-settings-panel')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
  });
});
