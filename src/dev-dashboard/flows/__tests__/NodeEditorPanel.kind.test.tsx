import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createFlow, lastPatch, renderPanel, renderStatefulPanel } from './nodeEditorPanelTestSupport';

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
