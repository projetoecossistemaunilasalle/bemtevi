import { renderDashboard, setupDashboardRouteTest } from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EducationDashboard } from '../education/EducationDashboard';

describe('DashboardRoute education groups', () => {
  beforeEach(setupDashboardRouteTest);

  it('keeps focus while editing a material body block', async () => {
    const user = userEvent.setup();

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    const bodyInput = screen.getByLabelText('Texto do bloco 1');
    await user.click(bodyInput);
    await user.keyboard('s');

    expect(screen.getByLabelText('Texto do bloco 1')).toHaveFocus();
  });

  it('renders an empty state with an action to create the first material', async () => {
    const onResourceAdd = vi.fn();

    await renderDashboard(
      <EducationDashboard
        resources={[]}
        groups={[]}
        onResourceChange={vi.fn()}
        onResourceAdd={onResourceAdd}
        onGroupChange={vi.fn()}
        onGroupAdd={vi.fn()}
        onGroupRemove={vi.fn()}
        onGroupMove={vi.fn()}
      />,
    );

    expect(screen.getByText('Nenhum material disponível.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Novo material' }));

    expect(onResourceAdd).toHaveBeenCalledOnce();
  });

  it('adds a new group that appears in the group management list', async () => {
    const onGroupAdd = vi.fn();

    await renderDashboard(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe BemTeVi',
            description: 'Descrição do material.',
            tags: ['teste'],
            audience: 'teachers',
            review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
          },
        ]}
        groups={[{ id: 'mock-group', title: 'Grupo de teste', order: 1 }]}
        onResourceChange={vi.fn()}
        onResourceAdd={vi.fn()}
        onGroupChange={vi.fn()}
        onGroupAdd={onGroupAdd}
        onGroupRemove={vi.fn()}
        onGroupMove={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));

    expect(onGroupAdd).toHaveBeenCalledOnce();
  });

  it('starts group management collapsed and toggles the editor open', async () => {
    await renderDashboard(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe BemTeVi',
            description: 'Descrição do material.',
            tags: ['teste'],
            audience: 'teachers',
            review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
          },
        ]}
        groups={[{ id: 'mock-group', title: 'Grupo de teste', order: 1 }]}
        onResourceChange={vi.fn()}
        onResourceAdd={vi.fn()}
        onGroupChange={vi.fn()}
        onGroupAdd={vi.fn()}
        onGroupRemove={vi.fn()}
        onGroupMove={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Título do grupo Grupo de teste')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    expect(screen.getByLabelText('Título do grupo Grupo de teste')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(ocultar\)/i }));
    expect(screen.queryByLabelText('Título do grupo Grupo de teste')).not.toBeInTheDocument();
  });

  it('editing a group title calls onGroupChange with correct arguments', async () => {
    const onGroupChange = vi.fn();

    await renderDashboard(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe BemTeVi',
            description: 'Descrição do material.',
            tags: ['teste'],
            audience: 'teachers',
            review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
          },
        ]}
        groups={[
          { id: 'mock-group', title: 'Grupo de teste', order: 1 },
          { id: 'added-group', title: 'Grupo editável', order: 2 },
        ]}
        onResourceChange={vi.fn()}
        onResourceAdd={vi.fn()}
        onGroupChange={onGroupChange}
        onGroupAdd={vi.fn()}
        onGroupRemove={vi.fn()}
        onGroupMove={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    const groupTitleInput = screen.getByDisplayValue('Grupo editável');
    fireEvent.change(groupTitleInput, { target: { value: 'Título do grupo editado' } });

    expect(onGroupChange).toHaveBeenCalledWith(2, 'added-group', { title: 'Título do grupo editado' });
  });

  it('editing a group description calls onGroupChange with correct arguments', async () => {
    const onGroupChange = vi.fn();

    await renderDashboard(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe BemTeVi',
            description: 'Descrição do material.',
            tags: ['teste'],
            audience: 'teachers',
            review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
          },
        ]}
        groups={[
          { id: 'mock-group', title: 'Grupo de teste', order: 1 },
          { id: 'added-group', title: 'Grupo editável', order: 2, description: 'Descrição atual' },
        ]}
        onResourceChange={vi.fn()}
        onResourceAdd={vi.fn()}
        onGroupChange={onGroupChange}
        onGroupAdd={vi.fn()}
        onGroupRemove={vi.fn()}
        onGroupMove={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    const groupDescriptionInput = screen.getByLabelText('Descrição do grupo Grupo editável');
    fireEvent.change(groupDescriptionInput, { target: { value: 'Descrição editada do grupo' } });

    expect(onGroupChange).toHaveBeenCalledWith(2, 'added-group', { description: 'Descrição editada do grupo' });
  });

  it('moving a group calls onGroupMove with the selected index and direction', async () => {
    const onGroupMove = vi.fn();

    await renderDashboard(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe BemTeVi',
            description: 'Descrição do material.',
            tags: ['teste'],
            audience: 'teachers',
            review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
          },
        ]}
        groups={[
          { id: 'mock-group', title: 'Grupo de teste', order: 1 },
          { id: 'added-group', title: 'Grupo editável', order: 2 },
        ]}
        onResourceChange={vi.fn()}
        onResourceAdd={vi.fn()}
        onGroupChange={vi.fn()}
        onGroupAdd={vi.fn()}
        onGroupRemove={vi.fn()}
        onGroupMove={onGroupMove}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover grupo Grupo de teste para baixo' }));

    expect(onGroupMove).toHaveBeenCalledWith(0, 1);
  });

  it('removing an added group removes it from the list', async () => {
    const onGroupRemove = vi.fn();

    await renderDashboard(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe BemTeVi',
            description: 'Descrição do material.',
            tags: ['teste'],
            audience: 'teachers',
            review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
          },
        ]}
        groups={[
          { id: 'mock-group', title: 'Grupo de teste', order: 1 },
          { id: 'added-group', title: 'Grupo adicionado', order: 2 },
        ]}
        onResourceChange={vi.fn()}
        onResourceAdd={vi.fn()}
        onGroupChange={vi.fn()}
        onGroupAdd={vi.fn()}
        onGroupRemove={onGroupRemove}
        onGroupMove={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    expect(screen.getByDisplayValue('Grupo adicionado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remover grupo Grupo adicionado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: Remover grupo Grupo adicionado' }));

    expect(onGroupRemove).toHaveBeenCalledWith(2, 'added-group');
  });
});
