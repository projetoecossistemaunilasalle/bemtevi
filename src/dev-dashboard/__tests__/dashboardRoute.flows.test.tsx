import { renderDashboard, setupDashboardRouteTest, readDraft } from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

describe('DashboardRoute flows', () => {
  beforeEach(setupDashboardRouteTest);

  it('updates a local flow title draft', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Configurações Iniciais e Entrada do Fluxo'));

    const titleInput = screen.getByLabelText('Título do fluxo');
    fireEvent.change(titleInput, { target: { value: 'Fluxo editado localmente' } });

    expect(screen.getByRole('textbox', { name: 'Título do fluxo' })).toHaveValue('Fluxo editado localmente');
  });

  it('edits and expands a flow locally', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    // In Master-Detail layout, first stage is selected by default, so we can edit it directly
    fireEvent.change(screen.getByLabelText('Texto da etapa 1'), {
      target: { value: 'Texto editado da etapa inicial' },
    });
    fireEvent.change(screen.getByLabelText('Texto da opção 1 da etapa 1'), {
      target: { value: 'Continuar editado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar etapa' }));
    // Since adding a stage auto-selects it, we select start (Etapa 1) again to edit options
    fireEvent.click(screen.getAllByRole('button', { name: /Texto editado da etapa inicial/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar opção na etapa 1' }));

    expect(screen.getByDisplayValue('Texto editado da etapa inicial')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Continuar editado')).toBeInTheDocument();
    expect(screen.getAllByText(/Etapa 3/).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Nova opção')).toBeInTheDocument();
  });

  it('adds, previews, and removes a YouTube video from an orientation step', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar vídeo do YouTube na etapa 1' }));
    fireEvent.change(screen.getByLabelText('Título do vídeo 1 da etapa 1'), {
      target: { value: 'Pausa guiada' },
    });
    fireEvent.change(screen.getByLabelText('Link do YouTube 1 da etapa 1'), {
      target: { value: 'https://youtu.be/abcdef12345' },
    });

    expect(screen.getByTitle('Pausa guiada')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/abcdef12345',
    );

    const stored = (await readDraft()) as {
      flowPatches?: Array<{ patch?: { nodes?: Record<string, { videos?: unknown[] }> } }>;
    };
    expect(stored.flowPatches?.[0]?.patch?.nodes?.start?.videos).toEqual([
      {
        id: 'video',
        title: 'Pausa guiada',
        url: 'https://youtu.be/abcdef12345',
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Testar conversa' }));
    expect(screen.getByRole('heading', { name: 'Testar conversa' })).toBeInTheDocument();
    expect(screen.getByTitle('Pausa guiada')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/abcdef12345',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remover vídeo Pausa guiada' }));
    expect(screen.queryByLabelText('Título do vídeo 1 da etapa 1')).not.toBeInTheDocument();
  });

  it('edits later etapas directly and keeps the final-step button after the etapa list', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    // Click on the second stage (done) in the master outline list
    fireEvent.click(screen.getAllByRole('button', { name: /Finalizado/i })[0]);

    fireEvent.change(screen.getByLabelText('Tipo da etapa 2'), {
      target: { value: 'choice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar opção na etapa 2' }));
    fireEvent.change(screen.getByLabelText('Texto da opção 1 da etapa 2'), {
      target: { value: 'Opção editada na segunda etapa' },
    });

    expect(screen.getByDisplayValue('Opção editada na segunda etapa')).toBeInTheDocument();

    const finalStepButton = screen.getByRole('button', { name: 'Adicionar etapa' });
    expect(finalStepButton).toBeInTheDocument();
  });

  it('starts with only the first etapa active and displays details for selected stage', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    // First stage (start) is open by default
    expect(screen.getByLabelText('Texto da etapa 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Texto da etapa 2')).not.toBeInTheDocument();

    // Click on the second stage (done) in the outline list
    fireEvent.click(screen.getAllByRole('button', { name: /Finalizado/i })[0]);

    // Now the second stage (done) is open, and first stage (start) is hidden
    expect(screen.getByLabelText('Texto da etapa 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Texto da etapa 1')).not.toBeInTheDocument();
  });

  it('renders the React Flow canvas when Mapa visual tab is clicked', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Mapa visual' }));
    expect(screen.getByTestId('flow-map-canvas')).toBeInTheDocument();
  });

  it('renders the flow stages on the destination map when Mapa visual is clicked', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Mapa visual' }));
    const nodeElements = screen.getAllByText(/Como você quer continuar\?/i);
    expect(nodeElements.length).toBeGreaterThan(0);
  });

  it('filters large flow editor nodes by deferred safety marker', async () => {
    const user = userEvent.setup();
    await renderDashboard(<DashboardRoute />);

    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getByRole('button', { name: /Apoio ao final/i }));

    expect(screen.getByText(/Etapa 19 — Tem tido ideia de acabar com a vida/i)).toBeInTheDocument();
    expect(screen.queryByText(/Etapa 20 — Sente-se cansado/i)).not.toBeInTheDocument();
  });

  it('shows deferred safety editor separately from score editor on SRQ-20 Q17', async () => {
    const user = userEvent.setup();
    await renderDashboard(<DashboardRoute />);

    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getAllByRole('button', { name: /Tem tido ideia de acabar com a vida/i })[0]);

    // Open drawer
    await user.click(screen.getAllByRole('button', { name: /Ações e pontuação/i })[0]);

    expect(screen.getAllByText('Encaminhamento de segurança').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('self_harm_ideation')).toBeInTheDocument();
    expect(screen.getByText(/Q17 não soma pontos/i)).toBeInTheDocument();
  });

  it('shows destination target inline and opens drawer for advanced configuration', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    const select = screen.queryByRole('combobox', { name: 'Selecionar fluxo' });
    if (select) {
      await user.selectOptions(select, 'srq20');
    } else {
      await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    }
    await user.click(screen.getByRole('button', { name: 'Editor' }));

    const stageButton = screen.getAllByRole('button', { name: /Tem tido ideia de acabar com a vida/i })[0];
    await user.click(stageButton);

    // Green footer badge with destination select inline
    expect(screen.getByLabelText(/Ação principal da opção/i)).toBeInTheDocument();

    // Score and Safety fields are NOT visible on the main card initially
    expect(screen.queryByLabelText(/Flag key/i)).not.toBeInTheDocument();

    // Click settings button to open the slide-over drawer
    await user.click(screen.getByRole('button', { name: /Ações e pontuação da opção 1/i }));

    // Now drawer fields are visible
    expect(screen.getByLabelText(/Flag key/i)).toBeInTheDocument();
  });

  it('clears the mock chat so a different path can be tested', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByText('Testar conversa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Testar conversa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir para outro fluxo' }));
    expect(screen.getByText('Este é outro fluxo.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar conversa' }));

    expect(screen.queryByText('Este é outro fluxo.')).not.toBeInTheDocument();
  });

  it('previews deferred safety after SRQ-20 final result', async () => {
    const user = userEvent.setup();
    await renderDashboard(<DashboardRoute />);

    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Testar conversa' }));

    await user.click(screen.getByRole('button', { name: 'Quero responder' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    for (let question = 1; question <= 16; question++) {
      await user.click(screen.getByRole('button', { name: 'Não' }));
    }

    await user.click(screen.getByRole('button', { name: 'Sim' }));

    expect(screen.getByText(/Sente-se cansado/i)).toBeInTheDocument();
    expect(screen.queryByText(/vamos abrir a página de apoio agora/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Não' }));
    await user.click(screen.getByRole('button', { name: 'Não' }));
    await user.click(screen.getByRole('button', { name: 'Não' }));

    expect(screen.getByText(/vamos abrir a página de apoio agora/i)).toBeInTheDocument();
  });

  it('displays quick-suggest keys when editing score and sets input on click', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    const select = screen.queryByRole('combobox', { name: 'Selecionar fluxo' });
    if (select) {
      await user.selectOptions(select, 'srq20');
    } else {
      await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    }
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getAllByRole('button', { name: /Tem falta de apetite/i })[0]); // select q2

    // Open drawer
    await user.click(screen.getByRole('button', { name: /Ações e pontuação da opção 1/i }));

    // Quick select tag for 'srq20' exists (since q1 uses it)
    const tag = screen.getByRole('button', { name: 'srq20' });
    expect(tag).toBeInTheDocument();

    // Clear field and click tag
    const scoreKeyInput = screen.getByPlaceholderText('Chave (ex: srq20)');
    await user.clear(scoreKeyInput);
    await user.click(tag);

    expect(scoreKeyInput).toHaveValue('srq20');
  });

  it('duplicates a stage and chains it sequentially', async () => {
    const user = userEvent.setup();
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    const select = screen.queryByRole('combobox', { name: 'Selecionar fluxo' });
    if (select) {
      await user.selectOptions(select, 'srq20');
    } else {
      await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    }
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getAllByRole('button', { name: /Etapa 4 — Tem falta de apetite/i })[0]);

    // Click duplicate button
    await user.click(screen.getByRole('button', { name: /Duplicar esta etapa/i }));

    // Cloned stage is created in the outline list
    expect(screen.getAllByText(/Tem falta de apetite/i).length).toBeGreaterThan(1);

    // The cloned stage should be active/selected, verify it points to original next (q3)
    expect(screen.getByText(/Etapa 27 — Tem falta de apetite/i)).toBeInTheDocument();
    const option1Select = screen.getByRole('combobox', { name: 'Ação principal da opção' });
    expect(option1Select).toHaveValue('q3');

    const option2Select = screen.getByRole('combobox', { name: 'Ação da opção 2' });
    expect(option2Select).toHaveValue('q3');

    // Go back to the original stage (q2) and verify it now points to the clone (q2_copia)
    await user.click(screen.getAllByRole('button', { name: /Etapa 4 — Tem falta de apetite/i })[0]);
    const originalOption1Select = screen.getByRole('combobox', { name: 'Ação principal da opção' });
    expect(originalOption1Select).toHaveValue('q2_copia');

    const originalOption2Select = screen.getByRole('combobox', { name: 'Ação da opção 2' });
    expect(originalOption2Select).toHaveValue('q2_copia');
  });
});
