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
});
