import { useState } from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { FlowDestinationMap } from '../FlowDestinationMap';

vi.mock('../flowTopology', () => ({
  // Minimal shape: the map falls back to its local analysis, and the editor
  // panel only needs stable `nodes`/`nodeById` containers.
  buildFlowTopology: vi.fn(() => ({ nodes: [], nodeById: {} })),
}));

export const flow: GuidedFlow = {
  id: 'check-in',
  version: '1.0',
  locale: 'pt-BR',
  title: 'Check-in',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'q1', enteringPhrases: [], transitionMessage: '' },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Como você está hoje?',
      options: [
        {
          id: 'support',
          label: 'Preciso de apoio',
          next: 'result',
          effects: [{ kind: 'safety_interrupt', message: 'Procure apoio', destination: '/apoio', blockResume: false }],
        },
        {
          id: 'continue',
          label: 'Continuar',
          next: 'result',
          effects: [{ kind: 'deferred_safety', flagKey: 'support', message: 'Apoio', destination: '/apoio' }],
        },
      ],
      freeText: { next: 'result' },
    },
    result: { id: 'result', kind: 'result', text: 'Obrigado por responder.' },
    orphan: { id: 'orphan', kind: 'result', text: 'Etapa não alcançada.' },
  },
};

/** Two chained stages so validation deep-links can land on a second stage. */
export const focusFlow: GuidedFlow = {
  ...flow,
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Como você está hoje?',
      options: [{ id: 'next', label: 'Próxima', next: 'q2' }],
    },
    q2: {
      id: 'q2',
      kind: 'choice',
      text: 'Quer deixar um recado?',
      options: [{ id: 'enviar', label: 'Enviar', next: 'result' }],
    },
    result: { id: 'result', kind: 'result', text: 'Obrigado por responder.' },
  },
};

export function renderMap(overrides: Partial<React.ComponentProps<typeof FlowDestinationMap>> = {}) {
  const props: React.ComponentProps<typeof FlowDestinationMap> = {
    flow,
    flows: [flow],
    onFlowChange: vi.fn(),
    onEditNode: vi.fn(),
    onOpenFlow: vi.fn(),
    ...overrides,
  };
  return { ...render(<FlowDestinationMap {...props} />), props };
}

/** Host that applies patches like FlowDashboard does, so stats re-render from mutations. */
export function renderStatefulMap(initialFlow: GuidedFlow) {
  const patches: Array<Partial<GuidedFlow>> = [];
  function Host() {
    const [currentFlow, setFlow] = useState(initialFlow);
    return (
      <FlowDestinationMap
        flow={currentFlow}
        flows={[currentFlow]}
        onFlowChange={(patch) => {
          patches.push(patch);
          setFlow((current) => ({ ...current, ...patch }));
        }}
        onEditNode={vi.fn()}
        onOpenFlow={vi.fn()}
      />
    );
  }
  render(<Host />);
  return { patches };
}
