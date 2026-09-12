import { renderDashboard, setupDashboardRouteTest } from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

describe('DashboardRoute flow editing', () => {
  beforeEach(setupDashboardRouteTest);

  it('displays flow list in sidebar, allows adding and deleting a flow with confirmation', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Editor' }));

    // Verify "+ Criar Novo Fluxo" button is in the sidebar
    expect(screen.getByRole('button', { name: /\+ Criar Novo Fluxo/i })).toBeInTheDocument();

    // Verify list displays flows
    expect(screen.getByRole('button', { name: /^SRQ-20$/i })).toBeInTheDocument();

    // Select 'mock-flow' (second option in flows)
    await user.click(screen.getByRole('button', { name: /^Fluxo de teste$/i }));

    // Click delete flow button next to mock-flow
    await user.click(screen.getByRole('button', { name: /^Remover fluxo Fluxo de teste$/i }));

    // Confirmation button is shown
    const confirmBtn = screen.getByRole('button', { name: /^Confirmar exclusão de Fluxo de teste$/i });
    expect(confirmBtn).toBeInTheDocument();

    // Click confirm
    await user.click(confirmBtn);

    // Flow is gone
    expect(screen.queryByRole('button', { name: /^Fluxo de teste$/i })).not.toBeInTheDocument();
  });

  it('edits score branch ranges and page redirects directly', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getByRole('button', { name: 'Ramificação' }));
    await user.click(screen.getAllByRole('button', { name: /Vou organizar suas respostas/i })[0]);

    expect(screen.getByLabelText('Pontuação usada')).toHaveValue('srq20');

    fireEvent.change(screen.getByLabelText('Mínimo da faixa possible-distress'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Destino de página da faixa possible-distress'), {
      target: { value: '/apoio' },
    });

    expect(screen.getByLabelText('Mínimo da faixa possible-distress')).toHaveValue(8);
    expect(screen.getByLabelText('Destino de página da faixa possible-distress')).toHaveValue('/apoio');
  });
  it('renders visual effect badges in outline list and supports stage addition in sidebar', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));

    // Stage q1 (Etapa 3 — q1) should show +pts badge
    expect(screen.getAllByText('+pts')[0]).toBeInTheDocument();

    // Stage q17 (Etapa 19 — q17) should show a safety badge (AlertTriangle icon)
    const q17OutlineButton = screen.getAllByRole('button', {
      name: /Etapa 19 — Tem tido ideia de acabar com a vida/i,
    })[0];
    expect(q17OutlineButton.querySelector('.lucide-triangle-alert')).not.toBeNull();

    // Verify "+ Adicionar etapa" is visible in the sidebar stages area
    const addStageBtn = screen.getByRole('button', { name: /Adicionar etapa/i });
    expect(addStageBtn).toBeInTheDocument();

    // Click it and verify a new node is created (will be named 'nova_etapa' or 'nova_etapa_x')
    await user.click(addStageBtn);
    expect(screen.getAllByRole('button', { name: /Nova etapa final/i }).length).toBeGreaterThan(0);
  });

  it('renders all stages as collapsible cards, expands active, swaps text/type position, and supports deletion with confirmation', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));

    // Click Etapa 3 (q1)
    await user.click(screen.getByRole('button', { name: 'Etapa 3 — Você tem dores de cabeça frequentes?' }));

    // Active stage card header shows Etapa 3 — Você tem dores de cabeça frequentes? (ID q1 is hidden/demoted)
    expect(
      screen.getByRole('heading', { name: /Etapa 3 — Você tem dores de cabeça frequentes\?/i }),
    ).toBeInTheDocument();

    // Verify "Texto da etapa" textarea is positioned above "Tipo da etapa" select in DOM order
    const textLabel = screen.getByText('Texto da etapa');
    const typeLabel = screen.getByText('Tipo da etapa');
    expect(textLabel.compareDocumentPosition(typeLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // Verify stage q2 card is collapsed (its text content is not editable/visible initially)
    expect(screen.queryByLabelText(/Texto da Etapa 4/i)).not.toBeInTheDocument();

    // Click delete stage button
    await user.click(screen.getByRole('button', { name: /Excluir etapa/i }));

    // Confirm delete
    const confirmBtn = screen.getByRole('button', { name: /Confirmar exclusão da etapa/i });
    expect(confirmBtn).toBeInTheDocument();
    await user.click(confirmBtn);

    // Etapa 3 (q1) is deleted, now Etapa 3 becomes Q2
    expect(
      screen.queryByRole('heading', { name: /Etapa 3 — Você tem dores de cabeça frequentes\?/i }),
    ).not.toBeInTheDocument();
  });

  it('dismisses drawer on backdrop click, auto-activates score, and displays score key description', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getByRole('button', { name: 'Etapa 4 — Tem falta de apetite?' })); // Q2 stage in the outline list

    // Click option 1 actions to open the details drawer.
    await user.click(screen.getAllByRole('button', { name: /Ações e pontuação/i })[0]);

    // Verify helper hint explaining what "Chave da pontuação" means
    expect(screen.getByText(/A chave agrupa pontos do questionário/i)).toBeInTheDocument();

    // Since flow SRQ-20 has active scoring, the score inputs should ALREADY be active/visible (no "Ativar pontuação" button)
    expect(screen.getByLabelText('Chave da pontuação')).toBeInTheDocument();

    // Click backdrop (the outer overlay with testid "drawer-backdrop") to close drawer
    const backdrop = screen.getByTestId('drawer-backdrop');
    await user.click(backdrop);

    // Verify drawer is closed (Chave da pontuação is not in document anymore)
    expect(screen.queryByLabelText('Chave da pontuação')).not.toBeInTheDocument();
  });
});
