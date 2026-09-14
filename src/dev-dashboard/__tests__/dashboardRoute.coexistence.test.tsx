import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// The harness MUST be imported before the route so its module mocks register
// before `DashboardRoute` evaluates its imports.
import { renderDashboard, setupDashboardRouteTest, dashboardTestState } from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';
import * as editorFlagsModule from '../editorFlags';

/**
 * Coexistence selection proof (doc 16, task INTEGRATION-02): the build-time
 * `VITE_EDITOR_V2_ENABLED` flag selects exactly ONE dashboard experience.
 * `v2Enabled=false` renders only the legacy editor; `v2Enabled=true` renders
 * only V2; both persistence systems are never instantiated in one render;
 * `readOnly=true` disables mutation/publication in the selected branch.
 */

vi.mock('../editorFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editorFlags')>();
  return { ...actual, getEditorFlags: vi.fn(actual.getEditorFlags) };
});

const flagState = vi.hoisted(() => ({ v2Enabled: false, readOnly: false }));

vi.mocked(editorFlagsModule.getEditorFlags).mockImplementation(() => ({
  v2Enabled: flagState.v2Enabled,
  readOnly: flagState.readOnly,
}));

describe('DashboardRoute coexistence selection (editor flags)', () => {
  beforeEach(() => {
    setupDashboardRouteTest();
    flagState.v2Enabled = false;
    flagState.readOnly = false;
  });

  it('renders ONLY the legacy editor when v2Enabled is false', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    // Legacy markers: the pre-V2 local workspace save status copy.
    expect(
      await screen.findByText(/Salvo neste navegador|Nenhum rascunho aberto|Carregando rascunhos…/),
    ).toBeInTheDocument();
    // V2 markers must be absent.
    expect(screen.queryByText('Salvo no BemTeVi')).not.toBeInTheDocument();
  });

  it('renders ONLY the V2 editor when v2Enabled is true', async () => {
    flagState.v2Enabled = true;
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    // V2 marker: the canonical save status surface appears once the hook
    // loads (it stays inert/loading without a configured repository, which
    // is the honest unconfigured state — never both systems at once).
    expect(await screen.findByText('Carregando rascunho...')).toBeInTheDocument();
    // Legacy markers must be absent.
    expect(screen.queryByText('Salvando…')).not.toBeInTheDocument();
    expect(screen.queryByText('Rascunhos preservados')).not.toBeInTheDocument();
  });

  it('never instantiates the legacy persistence while V2 is selected', async () => {
    flagState.v2Enabled = true;
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Carregando rascunho...')).toBeInTheDocument();
    // The legacy local storage draft key is never read by the V2 branch.
    expect(dashboardTestState.persisted.workspaces).toEqual([]);
    expect(screen.queryByText('Recuperação assistida')).not.toBeInTheDocument();
  });

  it('blocks legacy publication under the read-only kill flag while keeping reads', async () => {
    const user = userEvent.setup();
    flagState.v2Enabled = false;
    flagState.readOnly = true;
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));
    // The publish surface stays visible for review but its action refuses.
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeInTheDocument();
    if (!screen.getByRole('button', { name: 'Publicar alterações' }).hasAttribute('disabled')) {
      await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
      await waitFor(() => {
        expect(dashboardTestState.dashboardMocks.publish).not.toHaveBeenCalled();
      });
    }
  });

  it('blocks connection creation/revocation surfaces in the V2 branch under the read-only kill flag', async () => {
    const user = userEvent.setup();
    flagState.v2Enabled = true;
    flagState.readOnly = true;
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Carregando rascunho...')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Assistente IA' }));
    // The V2 assistant surfaces (create/revoke connections, file apply) are
    // replaced by the read-only standby notice; no connection action renders.
    expect(screen.getByText('A edição está desativada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conectar um assistente' })).not.toBeInTheDocument();
  });
});
