import { fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { dashboardTestState, readDraft, renderDashboard, setupDashboardRouteTest } from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';

describe('DashboardRoute contacts', () => {
  beforeEach(setupDashboardRouteTest);

  it('persists shipped contact edits by source index and derives the phone href', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Contatos/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'CAPS II Centro' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefone' }), {
      target: { value: '(51) 99999-8888' },
    });

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS II Centro');
    expect(screen.getByRole('textbox', { name: 'Telefone' })).toHaveValue('(51) 99999-8888');
    expect(await readDraft()).toMatchObject({
      contactPatches: [
        {
          id: 'canoas-caps-praca-brasil',
          sourceIndex: 0,
          sourceIdUnique: true,
          patch: {
            name: 'CAPS II Centro',
            phoneDisplay: '(51) 99999-8888',
            phoneHref: 'tel:51999998888',
          },
        },
      ],
    });
  });

  it('summarizes edited contacts and enables contact-only publication', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'CAPS II Centro' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Publicar' }));

    expect(screen.getByRole('heading', { name: /Alterações do seu rascunho/ })).toBeInTheDocument();
    expect(screen.getByText(/Alterado: Contatos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeEnabled();
  });

  it('adds, edits, and removes a local contact through two-stage confirmation', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo contato' }));
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Novo contato');
    expect(await readDraft()).toMatchObject({
      addedContacts: [{ id: expect.stringMatching(/^service-local-/), name: 'Novo contato' }],
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Contato local editado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remover contato Contato local editado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: Remover contato Contato local editado' }));

    expect(await readDraft()).toMatchObject({ addedContacts: [] });
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS II Praça Brasil');
  });

  it('removes a shipped contact and clears its stale patch', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'CAPS II editado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remover contato CAPS II editado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: Remover contato CAPS II editado' }));

    expect(await readDraft()).toMatchObject({
      removedContactIds: ['canoas-caps-praca-brasil'],
      contactPatches: [],
    });
    expect(screen.queryByRole('textbox', { name: 'Nome' })).not.toBeInTheDocument();
  });

  it('tombstones removed local locations so their IDs are not reused', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar locais' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo local' }));
    const firstId = (await readDraft()).addedLocations[0].id;

    const removeButtons = screen.getAllByRole('button', { name: /Remover local/ });
    fireEvent.click(removeButtons[1]);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar: Remover local/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo local' }));

    const draft = await readDraft();
    expect(draft.addedLocations).toEqual([{ id: expect.stringMatching(/^location-local-/), city: '', state: '' }]);
    expect(draft.addedLocations[0].id).not.toBe(firstId);
  });

  it('keeps the contacts tab after a canonical route remount', async () => {
    const view = await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    expect(localStorage.getItem('bemtevi:dev-dashboard:active-tab')).toBe('contacts');
    view.unmount();

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Contatos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contatos' })).toHaveAttribute('aria-selected', 'true');
  });

  it('includes contact validation in the global publication gate', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo contato' }));
    expect(screen.getByText('2 erros impeditivos')).toBeInTheDocument();
    expect(screen.getAllByText('O endereço é obrigatório.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('O telefone precisa ter pelo menos 8 dígitos.').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Publicar' }));
    expect(screen.getByText(/Adicionado: Contatos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeDisabled();
  });

  it('navigates from the publication validation summary to the failing tab', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.change(screen.getByLabelText('Título do material'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Publicar' }));

    const reviewButton = screen.getByRole('button', { name: 'Revisar 1 erro em Materiais' });
    fireEvent.click(reviewButton);

    expect(screen.getByRole('tab', { name: /Materiais/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('1 erro impeditivo')).toBeInTheDocument();
    expect(screen.getAllByText('O título é obrigatório.').length).toBeGreaterThan(0);
  });

  it('keeps the contact validation summary scoped to contacts', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.change(screen.getByLabelText('Título do material'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));

    expect(screen.getByText('Tudo certo. Nenhum problema encontrado neste rascunho.')).toBeInTheDocument();
    expect(screen.queryByText('O título é obrigatório.')).not.toBeInTheDocument();
    expect(dashboardTestState.persisted.workspaces.at(-1)?.local).toBeDefined();
  });
});
