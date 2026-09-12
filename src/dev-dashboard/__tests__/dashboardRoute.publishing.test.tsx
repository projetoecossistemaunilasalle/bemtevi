import {
  renderDashboard,
  setupDashboardRouteTest,
  dashboardTestState,
  asPayload,
  createDefaultShippedContact,
} from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';
import { getShippedDashboardContent } from '../content/shippedContent';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyDashboardDraftState, DASHBOARD_STORAGE_KEY } from '../draft-storage/dashboardStorage';
import { createWorkspace } from '../draft-storage/workspace';
import * as draftDbModule from '../draft-storage/draftDb';
import type { PublishedContentPayload } from '../../app/content/publishedContent';

describe('DashboardRoute publishing', () => {
  beforeEach(setupDashboardRouteTest);

  it('shows the database-backed publication UI', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: 'Publicar' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerar arquivo ZIP' })).not.toBeInTheDocument();
  });

  it('publishes merged content and clears local drafts on success', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '4.0.0',
        basePayload: asPayload(getShippedDashboardContent()),
        baseRevision: 3,
        flowPatches: [],
        educationMaterialPatches: [],
        groupPatches: [],
        addedFlows: [],
        addedEducationMaterials: [],
        addedGroups: [],
        contactPatches: [
          { id: 'canoas-caps-praca-brasil', sourceIndex: 0, patch: { name: 'CAPS II Praça Brasil (editado)' } },
        ],
        removedContactIds: [],
        updatedAt: '2026-07-12T00:00:00.000Z',
      }),
    );
    dashboardTestState.dashboardMocks.publish.mockResolvedValueOnce({
      flows: 0,
      materials: 0,
      groups: 0,
      contacts: 1,
      publishedAt: '2024-02-01T00:00:00.000Z',
      revision: 4,
    });

    dashboardTestState.dashboardMocks.snapshot = {
      schemaVersion: '1.0.0',
      revision: 3,
      payload: asPayload(getShippedDashboardContent()),
      publishedAt: '2026-07-12',
      publishedBy: 'admin',
    };
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));
    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar revisão do resultado' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar publicação' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    await waitFor(() => expect(screen.getByText('O conteúdo está publicado.')).toBeInTheDocument());
    expect(dashboardTestState.dashboardMocks.publish).toHaveBeenCalledTimes(1);
    const [payload, publisherId, expectedRevision] = dashboardTestState.dashboardMocks.publish.mock.calls[0] as [
      PublishedContentPayload,
      string,
      number | null,
    ];
    expect(publisherId).toBe('admin-id');
    expect(expectedRevision).toBe(3);
    expect(payload.contacts[0].name).toBe('CAPS II Praça Brasil (editado)');
    expect(payload.flows.length).toBeGreaterThan(0);
    expect(payload.educationMaterials.length).toBeGreaterThan(0);
    expect(payload.educationGroups.length).toBeGreaterThan(0);
    expect(payload.defaultGroupOrder).toBe(0);
    await waitFor(() => expect(dashboardTestState.persisted.workspaces.some((w) => w.archived)).toBe(true));
    expect(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1')).not.toBeNull();
  });

  it('keeps local drafts when publication fails', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '4.0.0',
        basePayload: asPayload(getShippedDashboardContent()),
        flowPatches: [],
        educationMaterialPatches: [],
        groupPatches: [],
        addedFlows: [],
        addedEducationMaterials: [],
        addedGroups: [],
        contactPatches: [
          { id: 'canoas-caps-praca-brasil', sourceIndex: 0, patch: { name: 'CAPS II Praça Brasil (editado)' } },
        ],
        removedContactIds: [],
        updatedAt: '2026-07-12T00:00:00.000Z',
      }),
    );
    dashboardTestState.dashboardMocks.publish.mockRejectedValueOnce(new Error('boom'));

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));
    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar revisão do resultado' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar publicação' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    expect(await screen.findByText(/Não foi possível confirmar o resultado do envio/)).toBeInTheDocument();
    expect(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1')).not.toBeNull();
  });

  it('compares edits against the database content baseline', async () => {
    const user = userEvent.setup();
    dashboardTestState.dashboardMocks.content = {
      flows: [],
      educationMaterials: [],
      educationGroups: [],
      contacts: [
        {
          ...createDefaultShippedContact(),
          id: 'db-contact',
          name: 'Contato do banco',
        },
      ],
      locations: [{ id: 'loc-db-rs', city: 'Canoas', state: 'RS' }],
      defaultGroupOrder: 0,
    };
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '4.0.0',
        basePayload: dashboardTestState.dashboardMocks.content,
        flowPatches: [],
        educationMaterialPatches: [],
        groupPatches: [],
        addedFlows: [],
        addedEducationMaterials: [],
        addedGroups: [],
        contactPatches: [{ id: 'db-contact', sourceIndex: 0, patch: { name: 'Contato do banco (editado)' } }],
        removedContactIds: [],
        updatedAt: '2026-07-12T00:00:00.000Z',
      }),
    );

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));

    expect(screen.getByText(/Alterado: Contatos/)).toBeInTheDocument();
  });

  it('renders "Limpar TODAS as alterações" button disabled when no local draft changes exist', async () => {
    const user = userEvent.setup();
    dashboardTestState.dashboardMocks.content = {
      flows: [],
      educationMaterials: [],
      educationGroups: [],
      contacts: [createDefaultShippedContact()],
      locations: [{ id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' }],
      defaultGroupOrder: 0,
    };
    localStorage.removeItem('bemtevi:dev-dashboard:drafts:v1');

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Publicar' }));

    const clearButton = screen.getByRole('button', { name: 'Arquivar rascunho' });
    expect(clearButton).toBeInTheDocument();
    expect(clearButton).toBeDisabled();
    expect(screen.getByText('Arquivar rascunho local')).toBeInTheDocument();
    expect(screen.getByText(/Não altera a publicação/i)).toBeInTheDocument();
  });

  it('clears all local draft changes when "Limpar TODAS as alterações" is confirmed', async () => {
    const user = userEvent.setup();
    dashboardTestState.dashboardMocks.content = {
      flows: [],
      educationMaterials: [],
      educationGroups: [],
      contacts: [createDefaultShippedContact()],
      locations: [{ id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' }],
      defaultGroupOrder: 0,
    };
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '4.0.0',
        basePayload: asPayload(getShippedDashboardContent()),
        flowPatches: [],
        educationMaterialPatches: [],
        groupPatches: [],
        addedFlows: [],
        addedEducationMaterials: [],
        addedGroups: [],
        contactPatches: [{ id: createDefaultShippedContact().id, sourceIndex: 0, patch: { name: 'Contato Editado' } }],
        removedContactIds: [],
        updatedAt: '2026-07-12T00:00:00.000Z',
      }),
    );

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Publicar' }));

    const clearButton = screen.getByRole('button', { name: 'Arquivar rascunho' });
    expect(clearButton).not.toBeDisabled();

    // Click to arm
    await user.click(clearButton);
    const confirmButton = screen.getByRole('button', { name: 'Confirmar arquivamento' });
    expect(confirmButton).toBeInTheDocument();

    // Click to confirm
    await user.click(confirmButton);

    // Verify drafts local storage was cleared
    await waitFor(() => expect(dashboardTestState.persisted.workspaces.some((w) => w.archived)).toBe(true));
    expect(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Arquivar rascunho' })).toBeDisabled();
  });

  it('displays concurrent publication notice when background revision advances and preserves unsaved draft work', async () => {
    dashboardTestState.dashboardMocks.snapshot = {
      schemaVersion: '1.0.0',
      revision: 8,
      payload: {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        contacts: [createDefaultShippedContact()],
        locations: [{ id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' }],
        defaultGroupOrder: 0,
      },
      publishedAt: '2026-08-26T12:00:00.000Z',
      publishedBy: 'other-admin',
    };

    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '6.0.0',
        basePayload: asPayload(getShippedDashboardContent()),
        baseRevision: 7,
        flowPatches: [],
        educationMaterialPatches: [],
        groupPatches: [],
        addedFlows: [],
        addedEducationMaterials: [],
        addedGroups: [],
        contactPatches: [
          {
            id: createDefaultShippedContact().id,
            sourceIndex: 0,
            sourceIdUnique: true,
            patch: { name: 'Meu Rascunho Seguro' },
          },
        ],
        removedContactIds: [],
        updatedAt: '2026-08-26T12:05:00.000Z',
      }),
    );

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Nova publicação detectada no banco \(Revisão 8\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /^Contatos/ }));
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Meu Rascunho Seguro');
  });

  it('renders backup and restore buttons on publish tab', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Publicar' }));
    expect(screen.getByRole('button', { name: /Baixar cópia de segurança/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restaurar rascunho de arquivo/i })).toBeInTheDocument();
  });

  it('restores draft from IndexedDB fallback on mount when localStorage is empty', async () => {
    const dbDraft = createEmptyDashboardDraftState();
    dbDraft.basePayload = asPayload(getShippedDashboardContent());
    dbDraft.contactPatches = [
      {
        id: createDefaultShippedContact().id,
        sourceIndex: 0,
        sourceIdUnique: true,
        patch: { name: 'Restaurado do IndexedDB' },
      },
    ];
    dbDraft.updatedAt = '2026-08-26T12:00:00.000Z';

    const spy = vi.spyOn(draftDbModule, 'loadDraftFromIndexedDb').mockResolvedValueOnce(dbDraft);

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/1 alteração pendente/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /^Contatos/ }));
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Restaurado do IndexedDB');

    spy.mockRestore();
  });

  it('does not replace local state when another tab writes to localStorage', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^Contatos/ }));
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS II Praça Brasil');

    const updatedDraft = createEmptyDashboardDraftState();
    updatedDraft.contactPatches = [
      {
        id: createDefaultShippedContact().id,
        sourceIndex: 0,
        sourceIdUnique: true,
        patch: { name: 'Editado na Aba 2' },
      },
    ];
    updatedDraft.updatedAt = '2026-08-26T14:30:00.000Z';

    fireEvent(
      window,
      new StorageEvent('storage', {
        key: DASHBOARD_STORAGE_KEY,
        newValue: JSON.stringify(updatedDraft),
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS II Praça Brasil');
    });
  });

  it('shows payload size limit warning and disables publish when draft exceeds 5 MiB', async () => {
    const user = userEvent.setup();
    const baseShipped = asPayload(getShippedDashboardContent());
    dashboardTestState.dashboardMocks.content = {
      ...baseShipped,
      educationMaterials: [
        {
          ...baseShipped.educationMaterials[0],
          body: [
            {
              id: 'heavy-text',
              kind: 'paragraph',
              text: 'X'.repeat(5.2 * 1024 * 1024),
            },
          ],
        },
      ],
    };

    const draft = createWorkspace(dashboardTestState.dashboardMocks.content!, null);
    draft.local = { ...draft.local, contacts: draft.local.contacts.map((c) => ({ ...c, name: 'Contato modificado' })) };
    dashboardTestState.persisted.workspaces.push(draft);
    sessionStorage.setItem('bemtevi:dashboard:workspace-session', draft.workspaceId);

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Publicar' }));
    expect(screen.getByText(/Limite de tamanho do conteúdo excedido/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publicar alterações/i })).toBeDisabled();
  });
});
