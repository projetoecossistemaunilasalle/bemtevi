import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardRoute } from '../DashboardRoute';
import { EducationDashboard } from '../education/EducationDashboard';

vi.mock('../content/shippedContent', () => ({
  getShippedDashboardContent: () => ({
    flows: [
      {
        id: 'mock-flow',
        version: '1.0.0',
        locale: 'pt-BR',
        title: 'Fluxo de teste',
        type: 'guided_conversation',
        status: 'draft',
        entry: { nodeId: 'start', enteringPhrases: ['Começar'], transitionMessage: 'Olá.' },
        nodes: {
          start: {
            id: 'start',
            kind: 'choice',
            text: 'Como você quer continuar?',
            options: [
              { id: 'next', label: 'Continuar', next: 'done' },
              {
                id: 'handoff',
                label: 'Ir para outro fluxo',
                next: 'q18',
                effects: [
                  { kind: 'flow_start', flowId: 'mock-flow-two' },
                  {
                    kind: 'deferred_safety',
                    flagKey: 'precisa_apoio',
                    message: 'Vamos apoiar você.',
                    destination: '/apoio',
                  },
                ],
              },
            ],
          },
          done: { id: 'done', kind: 'result', text: 'Finalizado.' },
          q18: { id: 'q18', kind: 'result', text: 'Resultado com apoio.' },
        },
      },
      {
        id: 'mock-flow-two',
        version: '1.0.0',
        locale: 'pt-BR',
        title: 'Segundo fluxo',
        type: 'guided_conversation',
        status: 'draft',
        entry: { nodeId: 'start', enteringPhrases: ['Segundo'], transitionMessage: 'Entrando no segundo fluxo.' },
        nodes: {
          start: { id: 'start', kind: 'result', text: 'Este é outro fluxo.' },
        },
      },
      {
        id: 'srq20',
        version: '1.0.0',
        locale: 'pt-BR',
        title: 'SRQ-20',
        type: 'guided_conversation',
        status: 'draft',
        entry: {
          nodeId: 'consent',
          enteringPhrases: ['Quero responder o SRQ-20'],
          transitionMessage:
            'Este é o SRQ-20, um questionário de rastreio. Ele ajuda a identificar sinais de sofrimento, mas não faz diagnóstico.',
        },
        nodes: {
          consent: {
            id: 'consent',
            kind: 'choice',
            text: 'Antes de começar: suas respostas ficam apenas nesta conversa. O SRQ-20 não substitui uma avaliação profissional. Você quer responder agora?',
            options: [
              { id: 'accept', label: 'Quero responder', next: 'instructions' },
              { id: 'decline', label: 'Agora não', next: 'declined-result' },
            ],
          },
          instructions: {
            id: 'instructions',
            kind: 'choice',
            text: 'Estas questões são relacionadas a certas dores e problemas que podem ter incomodado você nos últimos 30 dias. Se você acha que a questão se aplica a você e teve o problema descrito nos últimos 30 dias, responda SIM. Se a questão não se aplica a você ou você não teve o problema nos últimos 30 dias, responda NÃO. Observação: o diagnóstico definitivo só pode ser fornecido por um profissional.',
            options: [{ id: 'continue', label: 'Continuar', next: 'q1' }],
          },
          ...Object.fromEntries(
            Array.from({ length: 20 }, (_, index) => {
              const nodeId = `q${index + 1}`;
              const nextId = index === 19 ? 'srq20-score' : `q${index + 2}`;
              const isQ17 = nodeId === 'q17';
              const texts = {
                q1: 'Você tem dores de cabeça frequentes?',
                q2: 'Tem falta de apetite?',
                q3: 'Dorme mal?',
                q4: 'Assusta-se com facilidade?',
                q5: 'Tem tremores nas mãos?',
                q6: 'Sente-se nervoso(a), tenso(a) ou preocupado(a)?',
                q7: 'Tem má digestão?',
                q8: 'Tem dificuldades de pensar com clareza?',
                q9: 'Tem se sentido triste ultimamente?',
                q10: 'Tem chorado mais do que de costume?',
                q11: 'Encontra dificuldades para realizar com satisfação suas atividades diárias?',
                q12: 'Tem dificuldades para tomar decisões?',
                q13: 'Tem dificuldades no serviço? Seu trabalho é penoso, causa-lhe sofrimento?',
                q14: 'É incapaz de desempenhar um papel útil em sua vida?',
                q15: 'Tem perdido o interesse pelas coisas?',
                q16: 'Você se sente uma pessoa inútil, sem prestímo?',
                q17: 'Tem tido ideia de acabar com a vida?',
                q18: 'Sente-se cansado(a) o tempo todo?',
                q19: 'Você se cansa com facilidade?',
                q20: 'Tem sensações desagradáveis no estômago?',
              };
              return [
                nodeId,
                {
                  id: nodeId,
                  kind: 'choice',
                  text: texts[nodeId] ?? `Questão ${index + 1}`,
                  options: [
                    {
                      id: 'yes',
                      label: 'Sim',
                      next: nextId,
                      effects: isQ17
                        ? [
                            {
                              kind: 'deferred_safety',
                              flagKey: 'self_harm_ideation',
                              message:
                                'Obrigado por responder com sinceridade. Como você marcou um sinal que merece cuidado imediato, vamos abrir a página de apoio agora. Você não está sozinho(a).',
                              destination: '/apoio',
                            },
                          ]
                        : [{ kind: 'score', scoreKey: 'srq20', value: 1 }],
                    },
                    { id: 'no', label: 'Não', next: nextId },
                  ],
                },
              ];
            }),
          ),
          'srq20-score': {
            id: 'srq20-score',
            kind: 'score_branch',
            text: 'Vou organizar suas respostas de forma cuidadosa.',
            scoreKey: 'srq20',
            branches: [
              { id: 'low-distress', min: 0, max: 6, next: 'low-distress-result' },
              { id: 'possible-distress', min: 7, max: 20, next: 'possible-distress-result' },
            ],
          },
          'declined-result': {
            id: 'declined-result',
            kind: 'result',
            text: 'Tudo bem. Você pode responder o SRQ-20 em outro momento ou seguir com uma orientação mais breve.',
          },
          'low-distress-result': {
            id: 'low-distress-result',
            kind: 'result',
            text: 'Com base nas suas respostas, você parece estar lidando bem com as demandas do dia a dia.',
          },
          'possible-distress-result': {
            id: 'possible-distress-result',
            kind: 'result',
            text: 'Com base nas suas respostas, você pode estar passando por um momento de maior sofrimento.',
          },
        },
      },
    ],
    educationMaterials: [
      {
        id: 'mock-material',
        title: 'Material de teste',
        source: 'Equipe SeCuida',
        description: 'Descrição do material.',
        tags: ['teste'],
        audience: 'teachers',
        review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
      },
    ],
    educationGroups: [
      {
        id: 'mock-group',
        title: 'Grupo de teste',
        order: 1,
      },
      {
        id: 'mock-group-two',
        title: 'Segundo grupo de teste',
        order: 2,
      },
    ],
  }),
}));

describe('DashboardRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders pt-BR flow editor helper text', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fluxos' })).toBeInTheDocument();
    expect(screen.getByText('São frases que uma pessoa pode escolher para começar este fluxo.')).toBeInTheDocument();
    expect(screen.getByText('Mapa visual')).toBeInTheDocument();
    expect(screen.getByText('Testar conversa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Testar conversa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir para outro fluxo' }));
    expect(screen.getByText('Este é outro fluxo.')).toBeInTheDocument();
  });

  it('explains flow usage, transition message, and first step in pt-BR', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Conversa principal: começa quando a pessoa digita ou escolhe uma frase'),
    ).toBeInTheDocument();
    expect(screen.getByText('Define onde este fluxo aparece no app e como ele pode ser iniciado.')).toBeInTheDocument();
    expect(
      screen.getByText('Aparece no chat logo antes da primeira etapa, quando o app está abrindo este fluxo.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Escolha qual etapa aparece primeiro para a pessoa. Os códigos técnicos ficam escondidos aqui.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Etapa 1 - Como você quer continuar?' }).length).toBeGreaterThan(0);
  });

  it('shows full entry phrases in multiline fields', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Frase de entrada 1').tagName).toBe('TEXTAREA');
  });

  it('renders stages in Master-Detail view and highlights the active stage', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Selecionar fluxo' }), 'srq20');
    await user.click(screen.getByRole('button', { name: 'Editor' }));

    // The Master checklist list on the left sidebar
    expect(screen.getByRole('heading', { name: /Etapas /i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /consent/i })).toBeInTheDocument();
    
    // Renders ONLY the selected stage (consent) in detail area, others (like instructions) are not visible
    expect(screen.getAllByText('Antes de começar: suas respostas ficam apenas nesta conversa. O SRQ-20 não substitui uma avaliação profissional. Você quer responder agora?').length).toBeGreaterThan(0);
    expect(screen.queryByText('Estas questões são relacionadas a certas dores e problemas que podem ter incomodado você nos últimos 30 dias.'))
      .not.toBeInTheDocument();
  });


  it('renders pt-BR education helper text', async () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    expect(await screen.findByRole('heading', { name: 'Materiais' })).toBeInTheDocument();
    expect(screen.getByText('Use palavras curtas para ajudar professores a encontrar o material.')).toBeInTheDocument();
  });

  it('renders export handoff copy', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Exportar' }));

    expect(screen.getByRole('heading', { name: 'Arquivo para revisão' })).toBeInTheDocument();
    expect(screen.getByText('Ele contém o JSON de dados e as imagens enviadas.')).toBeInTheDocument();
  });

  it('updates a local flow title draft', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    const titleInput = screen.getByLabelText('Título do fluxo');
    fireEvent.change(titleInput, { target: { value: 'Fluxo editado localmente' } });

    expect(screen.getByRole('textbox', { name: 'Título do fluxo' })).toHaveValue('Fluxo editado localmente');
  });

  it('edits and expands a flow locally', () => {
    render(
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
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar opção na etapa 1' }));

    expect(screen.getByDisplayValue('Texto editado da etapa inicial')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Continuar editado')).toBeInTheDocument();
    expect(screen.getAllByText(/Etapa 3/).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Nova opção')).toBeInTheDocument();
  });

  it('edits later etapas directly and keeps the final-step button after the etapa list', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    // Click on the second stage (done) in the master outline list
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    
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

  it('starts with only the first etapa active and displays details for selected stage', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    // First stage (start) is open by default
    expect(screen.getByLabelText('Texto da etapa 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Texto da etapa 2')).not.toBeInTheDocument();

    // Click on the second stage (done) in the outline list
    fireEvent.click(screen.getByRole('button', { name: /done/i }));

    // Now the second stage (done) is open, and first stage (start) is hidden
    expect(screen.getByLabelText('Texto da etapa 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Texto da etapa 1')).not.toBeInTheDocument();
  });

  it('renders a visual flow map with readable step names and connections', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mapa visual' }));
    expect(screen.getAllByText('Etapa 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Se escolher "Continuar"')).toBeInTheDocument();
    expect(screen.getByText('vai para Etapa 2')).toBeInTheDocument();
    expect(screen.getByText('começa o fluxo "Segundo fluxo"')).toBeInTheDocument();
  });

  it('shows deferred safety routing in the flow redirections tab', async () => {
    const user = userEvent.setup();
    render(<DashboardRoute />);

    await user.click(screen.getByRole('button', { name: 'Redirecionamentos' }));

    expect(screen.getAllByText('Encaminhamento de segurança ao final').length).toBeGreaterThan(0);
    expect(screen.getByText(/continua para q18/i)).toBeInTheDocument();
    expect(screen.getByText(/depois abre \/apoio/i)).toBeInTheDocument();
  });

  it('round-trips from a redirections row to the focused node in the editor tab', async () => {
    const user = userEvent.setup();
    render(<DashboardRoute />);

    await user.click(screen.getByRole('button', { name: 'Redirecionamentos' }));
    await user.click(screen.getAllByRole('button', { name: 'Editar etapa' })[0]);

    expect(screen.getByRole('button', { name: 'Editor' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Texto da etapa 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Texto da opção 1 da etapa 1')).toBeInTheDocument();
  });

  it('filters large flow editor nodes by deferred safety marker', async () => {
    const user = userEvent.setup();
    render(<DashboardRoute />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Selecionar fluxo' }), 'srq20');
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getByRole('button', { name: /Apoio ao final/i }));

    expect(screen.getByText(/Etapa 19 — q17/i)).toBeInTheDocument();
    expect(screen.queryByText(/Etapa 20 — q18/i)).not.toBeInTheDocument();
  });

  it('shows deferred safety editor separately from score editor on SRQ-20 Q17', async () => {
    const user = userEvent.setup();
    render(<DashboardRoute />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Selecionar fluxo' }), 'srq20');
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getByRole('button', { name: /Etapa 19 — q17/i }));

    expect(screen.getAllByText('Encaminhamento de segurança').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('self_harm_ideation')).toBeInTheDocument();
    expect(screen.getByText(/Q17 não soma pontos/i)).toBeInTheDocument();
  });

  it('clears the mock chat so a different path can be tested', () => {
    render(
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
    render(<DashboardRoute />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Selecionar fluxo' }), 'srq20');
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

  it('updates a local education title draft', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    const titleInput = screen.getByLabelText('Título do material');
    fireEvent.change(titleInput, { target: { value: 'Material editado localmente' } });

    expect(screen.getByDisplayValue('Material editado localmente')).toBeInTheDocument();
  });

  it('adds a new local education material', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo material' }));

    expect(screen.getByDisplayValue('Novo material')).toBeInTheDocument();
    expect(screen.getByText('Material editável apenas neste navegador.')).toBeInTheDocument();
  });

  it('updates required education metadata drafts', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    fireEvent.change(screen.getByLabelText('Descrição do material'), {
      target: { value: 'Descrição editada localmente' },
    });
    fireEvent.change(screen.getByLabelText('Fonte do material'), {
      target: { value: 'Fonte editada localmente' },
    });

    expect(screen.getByDisplayValue('Descrição editada localmente')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fonte editada localmente')).toBeInTheDocument();
  });

  it('removes the per-material group order input', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    expect(screen.queryByLabelText('Ordem no grupo')).not.toBeInTheDocument();
  });

  it('moves an education group order draft', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover grupo Grupo de teste para baixo' }));

    const draft = JSON.parse(localStorage.getItem('secuida:dev-dashboard:drafts:v1') ?? '{}');

    expect(draft.groupPatches).toEqual([
      { id: 'mock-group', sourceIndex: 0, patch: { order: 2 } },
      { id: 'mock-group-two', sourceIndex: 1, patch: { order: 1 } },
    ]);
  });

  it('reorders education groups in the dashboard list after moving', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));

    const groupTitles = () =>
      screen.getAllByLabelText(/Título do grupo/).map((input) => (input as HTMLInputElement).value);

    expect(groupTitles()).toEqual(['Geral', 'Grupo de teste', 'Segundo grupo de teste']);

    fireEvent.click(screen.getByRole('button', { name: 'Mover grupo Grupo de teste para baixo' }));

    expect(groupTitles()).toEqual(['Geral', 'Segundo grupo de teste', 'Grupo de teste']);
  });

  it('shows Geral as the non-removable default group with an explanation', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));

    const geralTitle = screen.getByLabelText('Título do grupo Geral') as HTMLInputElement;

    expect(geralTitle).toHaveValue('Geral');
    expect(geralTitle).toBeDisabled();
    expect(
      screen.getByText(
        'Geral é o grupo padrão para materiais sem categoria específica. Ele não pode ser removido porque garante que todo material tenha uma seção padrão.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mover grupo Geral para baixo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover grupo Geral' })).not.toBeInTheDocument();
  });

  it('moves Geral down in the group management list', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));

    const groupTitles = () =>
      screen.getAllByLabelText(/Título do grupo/).map((input) => (input as HTMLInputElement).value);

    fireEvent.click(screen.getByRole('button', { name: 'Mover grupo Geral para baixo' }));

    expect(groupTitles()).toEqual(['Grupo de teste', 'Geral', 'Segundo grupo de teste']);

    const draft = JSON.parse(localStorage.getItem('secuida:dev-dashboard:drafts:v1') ?? '{}');

    expect(draft.defaultGroupOrder).toBe(1);
    expect(draft.groupPatches).toEqual([{ id: 'mock-group', sourceIndex: 0, patch: { order: 0 } }]);
  });

  it('moves the first named group above Geral', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover grupo Grupo de teste para cima' }));

    const groupTitles = screen.getAllByLabelText(/Título do grupo/).map((input) => (input as HTMLInputElement).value);
    const draft = JSON.parse(localStorage.getItem('secuida:dev-dashboard:drafts:v1') ?? '{}');

    expect(groupTitles).toEqual(['Grupo de teste', 'Geral', 'Segundo grupo de teste']);
    expect(draft.defaultGroupOrder).toBe(1);
    expect(draft.groupPatches).toEqual([{ id: 'mock-group', sourceIndex: 0, patch: { order: 0 } }]);
  });

  it('removes a shipped education group and moves its materials to Geral', async () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.change(screen.getByLabelText('Grupo do material'), { target: { value: 'mock-group' } });
    await waitFor(() => expect(screen.getByLabelText('Grupo do material')).toHaveValue('mock-group'));
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover grupo Grupo de teste' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: Remover grupo Grupo de teste' }));

    const draft = JSON.parse(localStorage.getItem('secuida:dev-dashboard:drafts:v1') ?? '{}');
    const materialGroupSelect = screen.getByLabelText('Grupo do material') as HTMLSelectElement;

    expect(draft.removedGroupIds).toEqual(['mock-group']);
    expect(draft.groupPatches).toEqual([]);
    expect(draft.educationMaterialPatches).toEqual([
      { id: 'mock-material', sourceIndex: 0, patch: { group: 'geral' } },
    ]);
    expect(materialGroupSelect).toHaveValue('geral');
    expect(screen.queryByLabelText('Título do grupo Grupo de teste')).not.toBeInTheDocument();
  });

  it('moves an added education group relative to shipped groups', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover grupo Novo grupo para cima' }));

    const groupTitles = screen.getAllByLabelText(/Título do grupo/).map((input) => (input as HTMLInputElement).value);
    const draft = JSON.parse(localStorage.getItem('secuida:dev-dashboard:drafts:v1') ?? '{}');

    expect(groupTitles).toEqual(['Geral', 'Grupo de teste', 'Novo grupo', 'Segundo grupo de teste']);
    expect(draft.addedGroups).toEqual([{ id: 'group-local-1', title: 'Novo grupo', description: '', order: 2 }]);
    expect(draft.groupPatches).toEqual([{ id: 'mock-group-two', sourceIndex: 1, patch: { order: 3 } }]);
  });

  it('adds, edits, and removes education tags', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    const tagInput = screen.getByLabelText('Tags do material');
    fireEvent.change(tagInput, { target: { value: 'acolhimento' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Remover teste' }));

    expect(screen.getByText('acolhimento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover teste' })).not.toBeInTheDocument();
  });

  it('keeps focus while editing an education tag', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    const tagInput = screen.getByLabelText('Tags do material');
    await user.click(tagInput);
    await user.keyboard('s');

    expect(screen.getByLabelText('Tags do material')).toHaveFocus();
  });

  it('edits the featured image with catalog and external URL modes', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    expect(screen.getByRole('group', { name: 'Imagem principal do material' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mãos segurando uma planta pequena/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Usar URL externa' }));
    fireEvent.change(screen.getByLabelText('URL da imagem principal'), {
      target: { value: 'https://example.com/main.jpg' },
    });

    expect(screen.getByDisplayValue('https://example.com/main.jpg')).toBeInTheDocument();
  });

  it('adds, edits, and reorders material body blocks', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.change(screen.getByLabelText('Tipo do novo bloco'), { target: { value: 'video' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar bloco' }));
    fireEvent.change(screen.getByLabelText('Título do bloco 2'), { target: { value: 'Vídeo de teste' } });
    fireEvent.change(screen.getByLabelText('URL do vídeo do bloco 2'), {
      target: { value: 'https://www.youtube.com/watch?v=abcdef12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mover bloco 2 para cima' }));

    expect(screen.getByDisplayValue('Vídeo de teste')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://www.youtube.com/watch?v=abcdef12345')).toBeInTheDocument();
  });

  it('adds body image blocks without placeholder URLs and previews URL images', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.change(screen.getByLabelText('Tipo do novo bloco'), { target: { value: 'image' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar bloco' }));

    expect(screen.getByLabelText('URL da imagem do bloco 2')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('URL da imagem do bloco 2'), {
      target: { value: 'https://example.com/body.jpg' },
    });
    fireEvent.change(screen.getByLabelText('Descrição da imagem do bloco 2'), {
      target: { value: 'Imagem do bloco' },
    });

    expect(screen.getByRole('img', { name: 'Imagem do bloco' })).toHaveAttribute('src', 'https://example.com/body.jpg');
  });

  it('shows previews and file names for material image fields', () => {
    render(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe SeCuida',
            description: 'Descrição do material.',
            imageUrl: 'data:image/png;base64,AAAA',
            imageFileName: 'thumb.png',
            featuredImage: {
              kind: 'uploaded',
              dataUrl: 'data:image/png;base64,BBBB',
              fileName: 'featured.png',
              alt: 'Imagem principal',
            },
            body: [
              {
                id: 'body-image',
                kind: 'image',
                imageUrl: 'data:image/png;base64,CCCC',
                imageFileName: 'body.png',
                alt: 'Imagem interna',
              },
            ],
            tags: ['teste'],
            audience: 'teachers',
            review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
          },
        ]}
        groups={[]}
        onResourceChange={vi.fn()}
        onResourceAdd={vi.fn()}
        onGroupChange={vi.fn()}
        onGroupAdd={vi.fn()}
        onGroupRemove={vi.fn()}
        onGroupMove={vi.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'Miniatura da biblioteca' })).toHaveAttribute(
      'src',
      'data:image/png;base64,AAAA',
    );
    expect(screen.getByText('Arquivo enviado: thumb.png')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Imagem principal' })).toHaveAttribute('src', 'data:image/png;base64,BBBB');
    expect(screen.getByText('Arquivo enviado: featured.png')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Imagem interna' })).toHaveAttribute('src', 'data:image/png;base64,CCCC');
    expect(screen.getByText('Arquivo enviado: body.png')).toBeInTheDocument();
  });

  it('keeps focus while editing a material body block', async () => {
    const user = userEvent.setup();

    render(
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

  it('renders an empty state with an action to create the first material', () => {
    const onResourceAdd = vi.fn();

    render(
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

  it('adds a new group that appears in the group management list', () => {
    const onGroupAdd = vi.fn();

    render(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe SeCuida',
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

  it('starts group management collapsed and toggles the editor open', () => {
    render(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe SeCuida',
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

  it('editing a group title calls onGroupChange with correct arguments', () => {
    const onGroupChange = vi.fn();

    render(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe SeCuida',
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

  it('editing a group description calls onGroupChange with correct arguments', () => {
    const onGroupChange = vi.fn();

    render(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe SeCuida',
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

  it('moving a group calls onGroupMove with the selected index and direction', () => {
    const onGroupMove = vi.fn();

    render(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe SeCuida',
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

  it('removing an added group removes it from the list', () => {
    const onGroupRemove = vi.fn();

    render(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe SeCuida',
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
