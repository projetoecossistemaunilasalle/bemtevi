import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { FlowMap } from '../FlowMap';

const firstFlow: GuidedFlow = {
  id: 'first',
  version: '1.0',
  locale: 'pt-BR',
  title: 'Primeiro fluxo',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'question', enteringPhrases: [], transitionMessage: '' },
  nodes: {
    question: {
      id: 'question',
      kind: 'choice',
      text: 'Para onde seguir?',
      options: [
        { id: 'next', label: 'Ir ao segundo', next: 'result', effects: [{ kind: 'flow_start', flowId: 'second' }] },
      ],
    },
    result: { id: 'result', kind: 'result', text: 'Fim.' },
  },
};

const secondFlow: GuidedFlow = {
  ...firstFlow,
  id: 'second',
  title: 'Segundo fluxo',
  entry: { ...firstFlow.entry, nodeId: 'result' },
  nodes: { result: { id: 'result', kind: 'result', text: 'Segundo fim.' } },
};

/** Reuses firstFlow's 'question' id on purpose: canvas state must not leak across flows. */
const collisionFlow: GuidedFlow = {
  ...firstFlow,
  id: 'collision',
  title: 'Fluxo com ids repetidos',
  entry: { ...firstFlow.entry, nodeId: 'question' },
  nodes: { question: { id: 'question', kind: 'result', text: 'Outra etapa.' } },
};

describe('FlowMap', () => {
  it('opens by destination and switches to the complete system overview', async () => {
    const user = userEvent.setup();
    render(
      <FlowMap
        flow={firstFlow}
        flows={[firstFlow, secondFlow]}
        onFlowChange={vi.fn()}
        onEditNode={vi.fn()}
        onSelectFlow={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /por destino/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('flow-destination-map')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /visão geral/i }));

    expect(screen.getByRole('button', { name: /visão geral/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('flow-overview-canvas')).toBeInTheDocument();
    expect(screen.getByText('2', { selector: '.flow-overview__summary strong' })).toBeInTheDocument();
  });

  function renderFlowMap(focusRequest?: Parameters<typeof FlowMap>[0]['focusRequest']) {
    const props: React.ComponentProps<typeof FlowMap> = {
      flow: firstFlow,
      flows: [firstFlow, secondFlow],
      onFlowChange: vi.fn(),
      onEditNode: vi.fn(),
      onSelectFlow: vi.fn(),
      focusRequest,
    };
    const view = render(<FlowMap {...props} />);
    return { view, props };
  }

  it('opens the settings panel for a flow-level validation focusRequest', () => {
    const { view, props } = renderFlowMap();
    expect(screen.queryByTestId('flow-settings-panel')).not.toBeInTheDocument();

    view.rerender(<FlowMap {...props} focusRequest={{ requestId: 1 }} />);

    // 'configuracoes' target: the settings overlay surfaces without any node.
    expect(screen.getByTestId('flow-settings-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('node-editor-panel')).not.toBeInTheDocument();
  });

  it('applies a settings deep-link over the overview without replaying it on the destination', async () => {
    const user = userEvent.setup();
    const { view, props } = renderFlowMap();

    await user.click(screen.getByRole('button', { name: /visão geral/i }));
    view.rerender(<FlowMap {...props} focusRequest={{ requestId: 1 }} />);

    // Applied right where it landed: the settings overlay opens over the
    // overview (no destination map exists there to apply anything).
    expect(screen.getByTestId('flow-settings-panel')).toBeInTheDocument();

    // The user closes it again...
    await user.click(screen.getByRole('button', { name: 'Configurações do fluxo' }));
    expect(screen.queryByTestId('flow-settings-panel')).not.toBeInTheDocument();

    // ...and mounting the destination canvas afterwards must NOT resurrect
    // the retired request by spontaneously reopening settings.
    await user.click(screen.getByRole('button', { name: /por destino/i }));
    expect(screen.queryByTestId('flow-settings-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('flow-destination-map')).toBeInTheDocument();
  });

  it('still routes a settings deep-link through the destination map when it is showing', async () => {
    const user = userEvent.setup();
    const { view, props } = renderFlowMap();

    // Destination mode: the map applies the node-less request itself —
    // clearing any selection — and retires it via onFocusRequestApplied.
    view.rerender(<FlowMap {...props} focusRequest={{ requestId: 1 }} />);
    expect(screen.getByTestId('flow-settings-panel')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Configurações do fluxo' }));
    expect(screen.queryByTestId('flow-settings-panel')).not.toBeInTheDocument();

    // Retired means retired: mode toggles must not bring it back.
    await user.click(screen.getByRole('button', { name: /visão geral/i }));
    await user.click(screen.getByRole('button', { name: /por destino/i }));
    expect(screen.queryByTestId('flow-settings-panel')).not.toBeInTheDocument();
  });

  it('resets the destination map when switching to a flow that reuses node ids', async () => {
    const user = userEvent.setup();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
    try {
      const props: React.ComponentProps<typeof FlowMap> = {
        flow: firstFlow,
        flows: [firstFlow, secondFlow, collisionFlow],
        onFlowChange: vi.fn(),
        onEditNode: vi.fn(),
        onSelectFlow: vi.fn(),
      };
      const view = render(<FlowMap {...props} focusRequest={{ nodeId: 'question', section: 'texto', requestId: 1 }} />);

      // Deep-link applied on the first flow: panel open on its 'question'.
      expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
      await user.type(screen.getByRole('searchbox', { name: /buscar etapa/i }), 'nada');

      // Switching flows remounts the canvas (key={flow.id}): selection and
      // search reset instead of showing collisionFlow's own 'question' with
      // the previous flow's panel context.
      view.rerender(<FlowMap {...props} flow={collisionFlow} />);

      expect(screen.queryByTestId('node-editor-panel')).not.toBeInTheDocument();
      expect(screen.getByRole('searchbox', { name: /buscar etapa/i })).toHaveValue('');
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('lands a node-level validation focusRequest with settings closed, once', async () => {
    const user = userEvent.setup();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoViewStub = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewStub;

    try {
      const { view, props } = renderFlowMap();

      // Start from the worst case: overview mode with the settings overlay open.
      await user.click(screen.getByRole('button', { name: /visão geral/i }));
      await user.click(screen.getByRole('button', { name: 'Configurações do fluxo' }));
      expect(screen.getByTestId('flow-settings-panel')).toBeInTheDocument();

      view.rerender(<FlowMap {...props} focusRequest={{ nodeId: 'question', section: 'texto', requestId: 1 }} />);

      expect(screen.getByRole('button', { name: /por destino/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByTestId('flow-settings-panel')).not.toBeInTheDocument();
      expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Para onde seguir?');
      // The panel mounted one commit after selection, but must still scroll.
      expect(scrollIntoViewStub).toHaveBeenCalledWith({ block: 'nearest' });

      // The request is retired after being applied: toggling views must not
      // resurrect the deep-link panel.
      await user.click(screen.getByRole('button', { name: /visão geral/i }));
      await user.click(screen.getByRole('button', { name: /por destino/i }));
      expect(screen.queryByTestId('node-editor-panel')).not.toBeInTheDocument();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});
