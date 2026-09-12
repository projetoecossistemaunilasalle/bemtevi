import {
  renderDashboard,
  setupDashboardRouteTest,
  readDraft,
  dashboardTestState,
  asPayload,
  createDefaultShippedContact,
} from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';
import { getShippedDashboardContent } from '../content/shippedContent';
import { screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyDashboardDraftState } from '../draft-storage/dashboardStorage';

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

    const draft = await readDraft();
    expect(draft.contactPatches).toMatchObject([
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
    ]);
    expect(draft.basePayload).toMatchObject({
      contacts: [{ id: 'canoas-caps-praca-brasil', name: 'CAPS II Praça Brasil' }],
      defaultGroupOrder: 0,
    });
  });

  it('rebases a recovered unique contact patch when the reordered contact is edited again', async () => {
    const originalContact = createDefaultShippedContact();
    const insertedContact = {
      ...createDefaultShippedContact(),
      id: 'canoas-contact-inserted',
      name: 'Contato inserido',
    };
    dashboardTestState.shippedContacts.splice(
      0,
      dashboardTestState.shippedContacts.length,
      insertedContact,
      originalContact,
    );

    const initialDraft = createEmptyDashboardDraftState();
    initialDraft.basePayload = asPayload(getShippedDashboardContent());
    initialDraft.contactPatches = [
      {
        id: originalContact.id,
        sourceIndex: 0,
        sourceIdUnique: true,
        patch: { name: 'Contato único recuperado' },
      },
    ];
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(initialDraft));

    const view = await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.click(
      within(screen.getByRole('list', { name: 'Contatos disponíveis' })).getByRole('button', {
        name: /Contato único recuperado/,
      }),
    );
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Contato único recuperado');

    fireEvent.change(screen.getByRole('textbox', { name: 'Endereço' }), {
      target: { value: 'Rua Reordenada, 123' },
    });

    const storedDraft = await readDraft();
    expect(storedDraft.contactPatches).toMatchObject([
      {
        id: originalContact.id,
        sourceIndex: 1,
        sourceIdUnique: true,
        patch: { name: 'Contato único recuperado', address: 'Rua Reordenada, 123' },
      },
    ]);

    view.unmount();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.click(
      within(screen.getByRole('list', { name: 'Contatos disponíveis' })).getByRole('button', {
        name: /Contato único recuperado/,
      }),
    );
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Contato único recuperado');
    expect(screen.getByRole('textbox', { name: 'Endereço' })).toHaveValue('Rua Reordenada, 123');
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

  it('routes duplicate shipped contact edits and removal through the selected original source index', async () => {
    const duplicateContact = {
      ...createDefaultShippedContact(),
      name: 'CAPS duplicado selecionado',
      address: 'Rua Dois, 200 - Centro, Canoas - RS',
      phoneDisplay: '(51) 3333-2222',
      phoneHref: 'tel:5133332222',
    };
    dashboardTestState.shippedContacts.splice(
      0,
      dashboardTestState.shippedContacts.length,
      createDefaultShippedContact(),
      duplicateContact,
    );
    const initialDraft = createEmptyDashboardDraftState();
    initialDraft.basePayload = asPayload(getShippedDashboardContent());
    initialDraft.addedContacts = [
      {
        ...createDefaultShippedContact(),
        name: 'Contato local ocultado pelo mesmo tombstone',
        review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
      },
    ];
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(initialDraft));

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Contatos/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Primeiro contato editado' },
    });
    fireEvent.click(
      within(screen.getByRole('list', { name: 'Contatos disponíveis' })).getByRole('button', {
        name: /CAPS duplicado selecionado/,
      }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Segundo contato editado' },
    });

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Segundo contato editado');
    let draft = await readDraft();
    expect(draft.contactPatches).toMatchObject([
      {
        id: 'canoas-caps-praca-brasil',
        sourceIndex: 0,
        sourceIdUnique: false,
        patch: { name: 'Primeiro contato editado' },
      },
      {
        id: 'canoas-caps-praca-brasil',
        sourceIndex: 1,
        sourceIdUnique: false,
        patch: { name: 'Segundo contato editado' },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Remover contato Segundo contato editado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: Remover contato Segundo contato editado' }));

    draft = await readDraft();
    expect(dashboardTestState.persisted.workspaces.at(-1)?.local.contacts.map((c) => c.name)).toEqual([
      'Primeiro contato editado',
      'Contato local ocultado pelo mesmo tombstone',
    ]);
    expect(draft.contactPatches).toHaveLength(2);
  });

  it('routes a shared contact id by the selected shipped or added origin', async () => {
    const draftState = createEmptyDashboardDraftState();
    draftState.basePayload = asPayload(getShippedDashboardContent());
    draftState.addedContacts = [
      {
        ...createDefaultShippedContact(),
        name: 'Contato local com ID repetido',
        review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
      },
    ];
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(draftState));

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Contatos/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Contato publicado editado' },
    });

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Contato publicado editado');
    let storedDraft = await readDraft();
    expect(storedDraft.contactPatches).toMatchObject([
      {
        id: 'canoas-caps-praca-brasil',
        sourceIndex: 0,
        sourceIdUnique: false,
        patch: { name: 'Contato publicado editado' },
      },
    ]);
    expect(storedDraft.addedContacts[0].name).toBe('Contato local com ID repetido');

    fireEvent.click(
      within(screen.getByRole('list', { name: 'Contatos disponíveis' })).getByRole('button', {
        name: /Contato local com ID repetido/,
      }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Contato local selecionado' },
    });

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Contato local selecionado');
    storedDraft = await readDraft();
    expect(storedDraft.addedContacts[0].name).toBe('Contato local selecionado');

    fireEvent.click(screen.getByRole('button', { name: 'Remover contato Contato local selecionado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: Remover contato Contato local selecionado' }));

    storedDraft = await readDraft();
    expect(storedDraft.addedContacts).toEqual([]);
    expect(storedDraft.contactPatches).toMatchObject([
      {
        id: 'canoas-caps-praca-brasil',
        sourceIndex: 0,
        sourceIdUnique: true,
        patch: { name: 'Contato publicado editado' },
      },
    ]);
    expect(storedDraft.removedContactIds).toEqual([]);
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Contato publicado editado');
  });

  it('adds, selects, edits, and removes a local contact through two-stage confirmation', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo contato' }));

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Novo contato');
    let draft = await readDraft();
    expect(draft.addedContacts).toHaveLength(1);
    expect(draft.addedContacts[0]).toMatchObject({
      id: expect.stringMatching(/^service-local-/),
      name: 'Novo contato',
      review: { status: 'pending_review' },
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Contato local editado' },
    });

    draft = await readDraft();
    expect(draft.addedContacts).toHaveLength(1);
    expect(draft.addedContacts[0]).toMatchObject({
      id: expect.stringMatching(/^service-local-/),
      name: 'Contato local editado',
      review: { status: 'pending_review' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remover contato Contato local editado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: Remover contato Contato local editado' }));

    draft = await readDraft();
    expect(draft.addedContacts).toEqual([]);
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS II Praça Brasil');
  });

  it('removes a shipped contact once and clears its stale patch', async () => {
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

    const draft = await readDraft();
    expect(draft.removedContactIds).toEqual(['canoas-caps-praca-brasil']);
    expect(draft.contactPatches).toMatchObject([]);
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

    let draft = await readDraft();
    expect(draft.addedLocations).toEqual([{ id: expect.stringMatching(/^location-local-/), city: '', state: '' }]);
    const firstId = draft.addedLocations[0].id;

    const removeButtons = screen.getAllByRole('button', { name: /Remover local/ });
    expect(removeButtons[0]).toBeDisabled();
    expect(removeButtons[1]).not.toBeDisabled();
    fireEvent.click(removeButtons[1]);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar: Remover local/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Novo local' }));
    draft = await readDraft();
    expect(draft.addedLocations).toEqual([{ id: expect.stringMatching(/^location-local-/), city: '', state: '' }]);
    expect(draft.addedLocations[0].id).not.toBe(firstId);
  });

  it('persists the contacts tab and restores it after remounting', async () => {
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

  it('shows contact errors locally and includes them in global publication validation', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Configurações Iniciais e Entrada do Fluxo'));
    fireEvent.change(screen.getByLabelText('Título do fluxo'), {
      target: { value: 'Fluxo com alteração válida' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Publicar' }));
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeEnabled();

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo contato' }));

    expect(screen.getByText('2 erros impeditivos')).toBeInTheDocument();
    expect(screen.getAllByText('O endereço é obrigatório.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('O telefone precisa ter pelo menos 8 dígitos.').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Publicar' }));
    expect(screen.getByText(/Adicionado: Contatos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeDisabled();
  });

  it('navigates and scrolls to the validation error summary when clicking Revisar erros from the publish tab', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    // Create an error in materials
    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.change(screen.getByLabelText('Título do material'), { target: { value: '' } });

    // Go to the publish tab.
    fireEvent.click(screen.getByRole('tab', { name: 'Publicar' }));
    expect(screen.getByText('Ainda não é possível publicar')).toBeInTheDocument();

    const reviewButton = screen.getByRole('button', { name: 'Revisar 1 erro em Materiais' });
    expect(reviewButton).toBeInTheDocument();

    // Click "Revisar 1 erro em Materiais"
    fireEvent.click(reviewButton);

    // Tab switches to Materiais
    expect(screen.getByRole('tab', { name: /Materiais/ })).toHaveAttribute('aria-selected', 'true');
    // Validation summary is present in the document
    expect(screen.getByText('1 erro impeditivo')).toBeInTheDocument();
    expect(screen.getAllByText('O título é obrigatório.').length).toBeGreaterThan(0);
  });

  it('keeps the contacts validation summary scoped to contacts', async () => {
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
  });
});
