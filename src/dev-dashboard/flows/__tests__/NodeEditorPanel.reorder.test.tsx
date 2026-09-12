import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { NodeEditorPanel } from '../NodeEditorPanel';
import { createFlow, lastPatch, makePanelProps, renderPanel } from './nodeEditorPanelTestSupport';

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
