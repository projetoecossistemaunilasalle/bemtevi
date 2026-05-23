import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardRoute } from '../DashboardRoute';

vi.mock('../content/shippedContent', () => ({
  getShippedDashboardContent: () => ({
    flows: [
      {
        id: 'mock-flow',
        version: '1.0.0',
        locale: 'pt-BR',
        title: 'Fluxo de teste',
        type: 'guided_conversation',
        status: 'draft',
        entry: { nodeId: 'start', enteringPhrases: ['Começar'], transitionMessage: 'Olá.' },
        nodes: {
          start: {
            id: 'start',
            kind: 'choice',
            text: 'Como você quer continuar?',
            options: [
              { id: 'next', label: 'Continuar', next: 'done' },
              {
                id: 'handoff',
                label: 'Ir para outro fluxo',
                effects: [{ kind: 'flow_start', flowId: 'mock-flow-two' }],
              },
            ],
          },
          done: { id: 'done', kind: 'result', text: 'Finalizado.' },
        },
      },
      {
        id: 'mock-flow-two',
        version: '1.0.0',
        locale: 'pt-BR',
        title: 'Segundo fluxo',
        type: 'guided_conversation',
        status: 'draft',
        entry: { nodeId: 'start', enteringPhrases: ['Segundo'], transitionMessage: 'Entrando no segundo fluxo.' },
        nodes: {
          start: { id: 'start', kind: 'result', text: 'Este é outro fluxo.' },
        },
      },
    ],
    educationMaterials: [
      {
        id: 'mock-material',
        title: 'Material de teste',
        source: 'Equipe SeCuida',
        description: 'Descrição do material.',
        tags: ['teste'],
        audience: 'teachers',
        contentType: 'external_link',
        externalUrl: 'https://example.com',
        review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
      },
    ],
  }),
}));

describe('DashboardRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders pt-BR flow editor helper text', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fluxos' })).toBeInTheDocument();
    expect(screen.getByText('São frases que uma pessoa pode escolher para começar este fluxo.')).toBeInTheDocument();
    expect(screen.getByText('Mapa visual')).toBeInTheDocument();
    expect(screen.getByText('Testar conversa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir para outro fluxo' }));
    expect(screen.getByText('Este é outro fluxo.')).toBeInTheDocument();
  });
});
