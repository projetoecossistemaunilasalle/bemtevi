import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EducationDashboard } from '../EducationDashboard';
import type { EducationResource } from '../../../domain/resources/types';
import type { EducationResourceGroup } from '../../../content/resources/groups';

const mockResources: EducationResource[] = [
  {
    id: 'mat-1',
    title: 'Material de Teste',
    description: 'Descrição do material',
    audience: 'general',
    source: 'IBGE. Censo 2022. https://ibge.gov.br / SILVA, A. 2023. doi.org/10.1234/test',
    tags: ['saúde', 'testes'],
    review: {
      status: 'approved',
      reviewedBy: 'Test',
      reviewedAt: '2026-07-21T00:00:00.000Z',
      notes: 'OK',
    },
    body: [
      { id: 'b-1', kind: 'paragraph', title: 'Introdução', text: 'Texto de intro' },
      { id: 'b-2', kind: 'heading', text: 'Seção Principal' },
    ],
  },
];

const mockGroups: EducationResourceGroup[] = [
  { id: 'geral', title: 'Geral', description: 'Grupo geral', order: 0 },
];

describe('EducationDashboard - Source Preview & Accordion Layout', () => {
  it('renders live preview of card badges and parsed links under Fonte do material', () => {
    render(
      <EducationDashboard
        resources={mockResources}
        groups={mockGroups}
        onResourceChange={vi.fn()}
        onResourceAdd={vi.fn(() => 'new-id')}
        onGroupChange={vi.fn()}
        onGroupAdd={vi.fn()}
        onGroupRemove={vi.fn()}
        onGroupMove={vi.fn()}
      />
    );

    // Header of source preview
    expect(screen.getByText('Pré-visualização da fonte no cartão')).toBeInTheDocument();
    expect(screen.getByText('2 fontes')).toBeInTheDocument();

    // Badges parsed: IBGE and SILVA
    expect(screen.getByText('IBGE')).toBeInTheDocument();
    expect(screen.getByText('SILVA')).toBeInTheDocument();

    // Recognized link preview
    expect(screen.getByText('🔗 https://ibge.gov.br')).toBeInTheDocument();
    expect(screen.getByText('🔗 https://doi.org/10.1234/test')).toBeInTheDocument();
  });

  it('allows collapsing all blocks, expanding all blocks, and toggling individual block expansion', () => {
    render(
      <EducationDashboard
        resources={mockResources}
        groups={mockGroups}
        onResourceChange={vi.fn()}
        onResourceAdd={vi.fn(() => 'new-id')}
        onGroupChange={vi.fn()}
        onGroupAdd={vi.fn()}
        onGroupRemove={vi.fn()}
        onGroupMove={vi.fn()}
      />
    );

    // By default, blocks are expanded
    expect(screen.getByLabelText('Título do bloco 1')).toBeInTheDocument();

    // Click "Recolher todos"
    fireEvent.click(screen.getByRole('button', { name: 'Recolher todos' }));
    expect(screen.queryByLabelText('Título do bloco 1')).not.toBeInTheDocument();

    // Click on individual block header to toggle it expand
    fireEvent.click(screen.getByRole('button', { name: 'Bloco 1: Parágrafo' }));
    expect(screen.getByLabelText('Título do bloco 1')).toBeInTheDocument();

    // Click "Expandir todos"
    fireEvent.click(screen.getByRole('button', { name: 'Expandir todos' }));
    expect(screen.getByLabelText('Título do bloco 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Título do bloco 2')).toBeInTheDocument();
  });

  it('supports creating and editing a Link block', () => {
    function StatefulDashboard() {
      const [resources, setResources] = useState(mockResources);
      return (
        <EducationDashboard
          resources={resources}
          groups={mockGroups}
          onResourceChange={(index, id, patch) => {
            setResources((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
          }}
          onResourceAdd={vi.fn(() => 'new-id')}
          onGroupChange={vi.fn()}
          onGroupAdd={vi.fn()}
          onGroupRemove={vi.fn()}
          onGroupMove={vi.fn()}
        />
      );
    }

    render(<StatefulDashboard />);

    // Select "Link" as new block type and click "Adicionar bloco"
    fireEvent.change(screen.getByLabelText('Tipo do novo bloco'), { target: { value: 'link' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar bloco' }));

    // Verify fields for the new Link block exist
    expect(screen.getByLabelText('Texto do link do bloco 3', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('URL do link do bloco 3', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText('Formulário').length).toBeGreaterThan(0);
  });
});
