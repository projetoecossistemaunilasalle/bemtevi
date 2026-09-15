import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// The harness MUST be imported before the route so its module mocks register
// before `DashboardRoute` evaluates its imports.
import { dashboardTestState, renderDashboard, setupDashboardRouteTest } from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';
import * as editorFlagsModule from '../editorFlags';

/** V2-only route proof: the legacy branch no longer exists. */

vi.mock('../editorFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editorFlags')>();
  return { ...actual, getEditorFlags: vi.fn(actual.getEditorFlags) };
});

const flagState = vi.hoisted(() => ({ readOnly: false }));

vi.mocked(editorFlagsModule.getEditorFlags).mockImplementation(() => ({
  v2Enabled: true,
  readOnly: flagState.readOnly,
}));

describe('DashboardRoute V2-only selection', () => {
  beforeEach(() => {
    setupDashboardRouteTest();
    flagState.readOnly = false;
  });

  it('renders the canonical V2 save status without the retired local editor', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByText('Salvo no BemTeVi')).toBeInTheDocument();
    expect(screen.queryByText('Salvo neste navegador')).not.toBeInTheDocument();
    expect(screen.queryByText('Rascunhos preservados')).not.toBeInTheDocument();
    expect(dashboardTestState.persisted.workspaces).toEqual([]);
  });

  it('never instantiates browser-canonical persistence in the V2 route', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Recuperação assistida')).not.toBeInTheDocument();
    expect(screen.queryByText('Salvando…')).not.toBeInTheDocument();
  });

  it('blocks publication under the read-only kill flag while keeping reads', async () => {
    const user = userEvent.setup();
    flagState.readOnly = true;
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));

    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeDisabled();
    expect(dashboardTestState.dashboardMocks.publish).not.toHaveBeenCalled();
  });

  it('blocks assistant mutations under the read-only kill flag', async () => {
    const user = userEvent.setup();
    flagState.readOnly = true;
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Assistente IA' }));

    expect(screen.getByText('A edição está desativada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conectar um assistente' })).not.toBeInTheDocument();
  });
});
