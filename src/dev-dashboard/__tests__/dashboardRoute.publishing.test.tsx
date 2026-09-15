import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { asPayload, dashboardTestState, renderDashboard, setupDashboardRouteTest } from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';
import { getShippedDashboardContent } from '../content/shippedContent';

describe('DashboardRoute publishing', () => {
  beforeEach(setupDashboardRouteTest);

  it('shows the V2 guarded-publication surface', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Publicar' }));

    expect(screen.getByRole('heading', { name: 'Publicar conteúdo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerar arquivo ZIP' })).not.toBeInTheDocument();
    expect(screen.queryByText('Arquivar rascunho local')).not.toBeInTheDocument();
  });

  it('keeps the public publication review under controller ownership', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));

    expect(screen.queryByRole('button', { name: 'Confirmar publicação' })).not.toBeInTheDocument();
    expect(dashboardTestState.dashboardMocks.publish).not.toHaveBeenCalled();
  });

  it('shows payload warnings for an oversized V2 candidate', async () => {
    const user = userEvent.setup();
    const shipped = asPayload(getShippedDashboardContent());
    dashboardTestState.dashboardMocks.content = {
      ...shipped,
      educationMaterials: [
        {
          ...shipped.educationMaterials[0],
          body: [{ id: 'heavy-text', kind: 'paragraph', text: 'X'.repeat(5.2 * 1024 * 1024) }],
        },
      ],
    };

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));

    expect(screen.getByText(/Limite de tamanho do conteúdo excedido/i)).toBeInTheDocument();
  });
});
