import { renderDashboard, setupDashboardRouteTest } from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { installScrollStub } from '../flows/__tests__/scrollStubs';

describe('DashboardRoute navigation', () => {
  beforeEach(setupDashboardRouteTest);

  it('switches to conversation testing from initial flow settings', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Configurações Iniciais e Entrada do Fluxo'));

    expect(screen.getByRole('heading', { name: 'Painel administrativo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fluxos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Testar conversa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir para outro fluxo' }));
    expect(screen.getByText('Este é outro fluxo.')).toBeInTheDocument();
  });

  it('shows full entry phrases in multiline fields', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Configurações Iniciais e Entrada do Fluxo'));

    expect(screen.getByLabelText('Frase de entrada 1').tagName).toBe('TEXTAREA');
  });

  it('renders stages in Master-Detail view and highlights the active stage', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));

    // The Master checklist list on the left sidebar
    expect(screen.getByRole('heading', { name: /Etapas /i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Antes de começar/i })[0]).toBeInTheDocument();

    // Renders ONLY the selected stage (consent) in detail area, others (like instructions) are not visible
    expect(
      screen.getAllByText(
        'Antes de começar: suas respostas ficam apenas nesta conversa. O SRQ-20 não substitui uma avaliação profissional. Você quer responder agora?',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        'Estas questões são relacionadas a certas dores e problemas que podem ter incomodado você nos últimos 30 dias.',
      ),
    ).not.toBeInTheDocument();
  });

  it('renders the contacts tab in order and opens the shipped contact editor', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Fluxos',
      'Materiais',
      'Contatos',
      'Assistente IA',
      'Estatísticas',
      'Publicar',
    ]);
    expect(
      screen.getByText('Gerencie o conteúdo publicado e consulte estatísticas agregadas de acesso.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /^Contatos/ }));

    expect(screen.getByRole('tab', { name: 'Contatos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Contatos' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS II Praça Brasil');
  });

  it('supports roving keyboard navigation and links each tab to its panel', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    const flowsTab = screen.getByRole('tab', { name: 'Fluxos' });
    const materialsTab = screen.getByRole('tab', { name: 'Materiais' });
    const contactsTab = screen.getByRole('tab', { name: 'Contatos' });
    const aiTab = screen.getByRole('tab', { name: 'Assistente IA' });
    const analyticsTab = screen.getByRole('tab', { name: 'Estatísticas' });
    const exportTab = screen.getByRole('tab', { name: 'Publicar' });
    const flowsPanel = screen.getByRole('tabpanel', { name: 'Fluxos' });

    expect(flowsTab).toHaveAttribute('tabindex', '0');
    expect(materialsTab).toHaveAttribute('tabindex', '-1');
    expect(flowsTab).toHaveAttribute('id', 'dashboard-tab-flows');
    expect(flowsPanel).toHaveAttribute('id', 'dashboard-tabpanel');
    expect(flowsPanel).toHaveAttribute('aria-labelledby', 'dashboard-tab-flows');
    [flowsTab, materialsTab, contactsTab, aiTab, analyticsTab, exportTab].forEach((tab) => {
      expect(tab).toHaveAttribute('aria-controls', 'dashboard-tabpanel');
      expect(document.getElementById(tab.getAttribute('aria-controls') ?? '')).toBe(flowsPanel);
    });

    flowsTab.focus();
    fireEvent.keyDown(flowsTab, { key: 'ArrowRight' });
    expect(materialsTab).toHaveFocus();
    expect(materialsTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(materialsTab, { key: 'End' });
    expect(exportTab).toHaveFocus();
    expect(exportTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(exportTab, { key: 'ArrowLeft' });
    expect(analyticsTab).toHaveFocus();
    expect(analyticsTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(analyticsTab, { key: 'Home' });
    expect(flowsTab).toHaveFocus();
    expect(flowsTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(flowsTab, { key: 'ArrowLeft' });
    expect(exportTab).toHaveFocus();
    expect(exportTab).toHaveAttribute('aria-selected', 'true');
  });

  it('scrolls to a flow stage only after the stage is clicked', async () => {
    const { stub: scrollIntoView, restore } = installScrollStub();
    try {
      localStorage.setItem('bemtevi:dev-dashboard:active-tab', 'education');

      await renderDashboard(
        <MemoryRouter>
          <DashboardRoute />
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Fluxos' }));
      expect(scrollIntoView).not.toHaveBeenCalled();

      const flowList = screen.getByRole('heading', { name: 'Fluxos' }).closest('aside');
      expect(flowList).not.toBeNull();
      fireEvent.click(within(flowList!).getByRole('button', { name: 'Etapa 2 — Finalizado.' }));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });
});
