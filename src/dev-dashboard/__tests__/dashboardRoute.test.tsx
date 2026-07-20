import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceDirectoryEntry } from '../../domain/services/types';
import { DashboardRoute } from '../DashboardRoute';
import { createEmptyDashboardDraftState } from '../draft-storage/dashboardStorage';
import { EducationDashboard } from '../education/EducationDashboard';
import { MAX_IMAGE_UPLOAD_BYTES } from '../components/fileUpload';
import { getShippedDashboardContent } from '../content/shippedContent';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../../app/content/publishedContent';
import type { DashboardShippedContent } from '../content/shippedContent';

function asPayload(shipped: DashboardShippedContent): PublishedContentPayload {
  return {
    flows: shipped.flows,
    educationMaterials: shipped.educationMaterials,
    educationGroups: shipped.educationGroups,
    contacts: shipped.contacts,
    defaultGroupOrder: shipped.defaultGroupOrder ?? 0,
  };
}

const shippedContacts = vi.hoisted(() => [] as ServiceDirectoryEntry[]);

const dashboardMocks = vi.hoisted(() => ({
  publishMode: 'export' as 'export' | 'database',
  content: null as PublishedContentPayload | null,
  snapshot: null as PublishedContentSnapshot | null,
  publish: vi.fn(),
  account: { id: 'admin-id', email: 'admin@bemtevi.test' } as { id: string; email: string } | null,
}));

vi.mock('../publishing/publishMode', () => ({
  getDashboardPublishMode: () => dashboardMocks.publishMode,
}));

vi.mock('../../app/content/PublishedContentContext', () => ({
  usePublishedContent: () => ({
    content: dashboardMocks.content,
    snapshot: dashboardMocks.snapshot,
    source: 'database',
    status: 'ready',
    loadError: null,
    refresh: vi.fn(),
    publish: dashboardMocks.publish,
  }),
}));

vi.mock('../../app/auth/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    status: dashboardMocks.account ? 'authenticated' : 'unauthenticated',
    account: dashboardMocks.account,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

function createDefaultShippedContact(): ServiceDirectoryEntry {
  return {
    id: 'canoas-caps-praca-brasil',
    name: 'CAPS II Praça Brasil',
    type: 'CAPS',
    badgeTone: 'primary',
    city: 'Canoas',
    state: 'RS',
    address: 'Av. Getúlio Vargas, 7071 - Centro, Canoas - RS',
    phoneDisplay: '(51) 3236-1500',
    phoneHref: 'tel:5132361500',
    hours: 'Segunda a sexta, 08:00 - 18:00',
    notes: 'Atendimento por acolhimento.',
    review: {
      status: 'approved',
      reviewedBy: 'Equipe BemTeVi',
      reviewedAt: '2026-07-01T12:00:00.000Z',
      notes: 'Contato conferido com a rede municipal.',
    },
  };
}

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
        source: 'Equipe BemTeVi',
        description: 'Descrição do material.',
        tags: ['teste'],
        audience: 'teachers',
        featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
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
    contacts: shippedContacts,
  }),
}));

describe('DashboardRoute', () => {
  beforeEach(() => {
    localStorage.clear();
    shippedContacts.splice(0, shippedContacts.length, createDefaultShippedContact());
    vi.clearAllMocks();
    dashboardMocks.publishMode = 'export';
    dashboardMocks.content = asPayload(getShippedDashboardContent());
    dashboardMocks.snapshot = null;
    dashboardMocks.account = { id: 'admin-id', email: 'admin@bemtevi.test' };
    dashboardMocks.publish.mockResolvedValue({
      flows: 0,
      materials: 0,
      groups: 0,
      contacts: 0,
      publishedAt: '2024-02-01T00:00:00.000Z',
      revision: 4,
    });
  });

  it('renders pt-BR flow editor helper text', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Configurações Iniciais e Entrada do Fluxo'));

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

    fireEvent.click(screen.getByText('Configurações Iniciais e Entrada do Fluxo'));

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

    fireEvent.click(screen.getByText('Configurações Iniciais e Entrada do Fluxo'));

    expect(screen.getByLabelText('Frase de entrada 1').tagName).toBe('TEXTAREA');
  });

  it('renders stages in Master-Detail view and highlights the active stage', async () => {
    const user = userEvent.setup();
    render(
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

  it('renders the contacts tab in order and opens the shipped contact editor', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Fluxos',
      'Materiais',
      'Contatos',
      'Exportar',
    ]);
    expect(screen.getByText('Rascunhos locais para fluxos, materiais e contatos.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));

    expect(screen.getByRole('tab', { name: 'Contatos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Contatos' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS II Praça Brasil');
  });

  it('supports roving keyboard navigation and links each tab to its panel', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    const flowsTab = screen.getByRole('tab', { name: 'Fluxos' });
    const materialsTab = screen.getByRole('tab', { name: 'Materiais' });
    const contactsTab = screen.getByRole('tab', { name: 'Contatos' });
    const exportTab = screen.getByRole('tab', { name: 'Exportar' });
    const flowsPanel = screen.getByRole('tabpanel', { name: 'Fluxos' });

    expect(flowsTab).toHaveAttribute('tabindex', '0');
    expect(materialsTab).toHaveAttribute('tabindex', '-1');
    expect(flowsTab).toHaveAttribute('id', 'dashboard-tab-flows');
    expect(flowsPanel).toHaveAttribute('id', 'dashboard-tabpanel');
    expect(flowsPanel).toHaveAttribute('aria-labelledby', 'dashboard-tab-flows');
    [flowsTab, materialsTab, contactsTab, exportTab].forEach((tab) => {
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
    expect(contactsTab).toHaveFocus();
    expect(contactsTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(contactsTab, { key: 'Home' });
    expect(flowsTab).toHaveFocus();
    expect(flowsTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(flowsTab, { key: 'ArrowLeft' });
    expect(exportTab).toHaveFocus();
    expect(exportTab).toHaveAttribute('aria-selected', 'true');
  });

  it('scrolls to a flow stage only after the stage is clicked', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    localStorage.setItem('bemtevi:dev-dashboard:active-tab', 'education');

    render(
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
  });

  it('persists shipped contact edits by source index and derives the phone href', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'CAPS II Centro' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefone' }), {
      target: { value: '(51) 99999-8888' },
    });

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS II Centro');
    expect(screen.getByRole('textbox', { name: 'Telefone' })).toHaveValue('(51) 99999-8888');

    const draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(draft.contactPatches).toEqual([
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
  });

  it('rebases a recovered unique contact patch when the reordered contact is edited again', () => {
    const originalContact = createDefaultShippedContact();
    const insertedContact = {
      ...createDefaultShippedContact(),
      id: 'canoas-contact-inserted',
      name: 'Contato inserido',
    };
    shippedContacts.splice(0, shippedContacts.length, insertedContact, originalContact);

    const initialDraft = createEmptyDashboardDraftState();
    initialDraft.contactPatches = [
      {
        id: originalContact.id,
        sourceIndex: 0,
        sourceIdUnique: true,
        patch: { name: 'Contato único recuperado' },
      },
    ];
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(initialDraft));

    const view = render(
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

    const storedDraft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(storedDraft.contactPatches).toEqual([
      {
        id: originalContact.id,
        sourceIndex: 1,
        sourceIdUnique: true,
        patch: { name: 'Contato único recuperado', address: 'Rua Reordenada, 123' },
      },
    ]);

    view.unmount();
    render(
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

  it('summarizes edited contacts and enables contact-only exports', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'CAPS II Centro' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Exportar' }));

    const contactsStat = screen.getByText('Contatos', { selector: 'p' }).parentElement;
    expect(contactsStat).not.toBeNull();
    expect(within(contactsStat!).getByText('1 editado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar arquivo ZIP' })).toBeEnabled();
  });

  it('routes duplicate shipped contact edits and removal through the selected original source index', () => {
    const duplicateContact = {
      ...createDefaultShippedContact(),
      name: 'CAPS duplicado selecionado',
      address: 'Rua Dois, 200 - Centro, Canoas - RS',
      phoneDisplay: '(51) 3333-2222',
      phoneHref: 'tel:5133332222',
    };
    shippedContacts.splice(0, shippedContacts.length, createDefaultShippedContact(), duplicateContact);
    const initialDraft = createEmptyDashboardDraftState();
    initialDraft.addedContacts = [
      {
        ...createDefaultShippedContact(),
        name: 'Contato local ocultado pelo mesmo tombstone',
        review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
      },
    ];
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(initialDraft));

    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
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
    let draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(draft.contactPatches).toEqual([
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

    draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(draft.contactPatches).toEqual([]);
    expect(draft.addedContacts).toEqual([]);
    expect(draft.removedContactIds).toEqual(['canoas-caps-praca-brasil']);
  });

  it('routes a shared contact id by the selected shipped or added origin', () => {
    const draftState = createEmptyDashboardDraftState();
    draftState.addedContacts = [
      {
        ...createDefaultShippedContact(),
        name: 'Contato local com ID repetido',
        review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
      },
    ];
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(draftState));

    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Contato publicado editado' },
    });

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Contato publicado editado');
    let storedDraft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(storedDraft.contactPatches).toEqual([
      {
        id: 'canoas-caps-praca-brasil',
        sourceIndex: 0,
        sourceIdUnique: true,
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
    storedDraft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(storedDraft.addedContacts[0].name).toBe('Contato local selecionado');

    fireEvent.click(screen.getByRole('button', { name: 'Remover contato Contato local selecionado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: Remover contato Contato local selecionado' }));

    storedDraft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(storedDraft.addedContacts).toEqual([]);
    expect(storedDraft.contactPatches).toEqual([
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

  it('adds, selects, edits, and removes a local contact through two-stage confirmation', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo contato' }));

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Novo contato');
    let draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(draft.addedContacts).toHaveLength(1);
    expect(draft.addedContacts[0]).toMatchObject({
      id: 'service-local-1',
      name: 'Novo contato',
      review: { status: 'pending_review' },
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Contato local editado' },
    });

    draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(draft.addedContacts).toHaveLength(1);
    expect(draft.addedContacts[0]).toMatchObject({
      id: 'service-local-1',
      name: 'Contato local editado',
      review: { status: 'pending_review' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remover contato Contato local editado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: Remover contato Contato local editado' }));

    draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(draft.addedContacts).toEqual([]);
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS II Praça Brasil');
  });

  it('removes a shipped contact once and clears its stale patch', () => {
    render(
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

    const draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
    expect(draft.removedContactIds).toEqual(['canoas-caps-praca-brasil']);
    expect(draft.contactPatches).toEqual([]);
    expect(screen.queryByRole('textbox', { name: 'Nome' })).not.toBeInTheDocument();
  });

  it('persists the contacts tab and restores it after remounting', () => {
    const view = render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    expect(localStorage.getItem('bemtevi:dev-dashboard:active-tab')).toBe('contacts');

    view.unmount();
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Contatos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contatos' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows contact errors locally and includes them in global export validation', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Configurações Iniciais e Entrada do Fluxo'));
    fireEvent.change(screen.getByLabelText('Título do fluxo'), {
      target: { value: 'Fluxo com alteração válida' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Exportar' }));
    expect(screen.getByRole('button', { name: 'Gerar arquivo ZIP' })).toBeEnabled();

    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo contato' }));

    expect(screen.getByText('2 erros impeditivos')).toBeInTheDocument();
    expect(screen.getAllByText('O endereço é obrigatório.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('O telefone precisa ter pelo menos 8 dígitos.').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Exportar' }));
    expect(screen.getByText('1 editado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar arquivo ZIP' })).toBeDisabled();
  });

  it('keeps the contacts validation summary scoped to contacts', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.change(screen.getByLabelText('Título do material'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Contatos' }));

    expect(screen.getByText('Nenhum problema encontrado neste rascunho.')).toBeInTheDocument();
    expect(screen.queryByText('O título é obrigatório.')).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByText('Configurações Iniciais e Entrada do Fluxo'));

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
    // Since adding a stage auto-selects it, we select start (Etapa 1) again to edit options
    fireEvent.click(screen.getAllByRole('button', { name: /Texto editado da etapa inicial/i })[0]);
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
    fireEvent.click(screen.getAllByRole('button', { name: /Finalizado/i })[0]);

    // Now the second stage (done) is open, and first stage (start) is hidden
    expect(screen.getByLabelText('Texto da etapa 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Texto da etapa 1')).not.toBeInTheDocument();
  });

  it('renders the React Flow canvas when Mapa visual tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Mapa visual' }));
    expect(screen.getByTestId('flow-map-canvas')).toBeInTheDocument();
  });

  it('does not render a Redirecionamentos tab', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Redirecionamentos' })).not.toBeInTheDocument();
  });

  it('opens the inspector panel when a node is clicked in the flow map', async () => {
    const user = userEvent.setup();
    render(
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
    render(<DashboardRoute />);

    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getByRole('button', { name: /Apoio ao final/i }));

    expect(screen.getByText(/Etapa 19 — Tem tido ideia de acabar com a vida/i)).toBeInTheDocument();
    expect(screen.queryByText(/Etapa 20 — Sente-se cansado/i)).not.toBeInTheDocument();
  });

  it('shows deferred safety editor separately from score editor on SRQ-20 Q17', async () => {
    const user = userEvent.setup();
    render(<DashboardRoute />);

    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getAllByRole('button', { name: /Etapa 19 — Tem tido ideia de acabar com a vida/i })[0]);

    // Open drawer
    await user.click(screen.getAllByRole('button', { name: /Ações\/Score/i })[0]);

    expect(screen.getAllByText('Encaminhamento de segurança').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('self_harm_ideation')).toBeInTheDocument();
    expect(screen.getByText(/Q17 não soma pontos/i)).toBeInTheDocument();
  });

  it('shows destination target inline and opens drawer for advanced configuration', async () => {
    const user = userEvent.setup();
    render(
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
    await user.click(screen.getAllByRole('button', { name: /Ações\/Score/i })[0]);

    // Now drawer fields are visible
    expect(screen.getByLabelText(/Flag key/i)).toBeInTheDocument();
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
    render(
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
    await user.click(screen.getAllByRole('button', { name: /Etapa 4 — Tem falta de apetite/i })[0]); // select q2

    // Open drawer
    await user.click(screen.getAllByRole('button', { name: /Ações\/Score/i })[0]);

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
    render(
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

  it('rejects an oversized education thumbnail without replacing the current value', async () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    const currentUrl = screen.getByLabelText('URL da miniatura da biblioteca');
    const originalValue = currentUrl.getAttribute('value') ?? (currentUrl as HTMLInputElement).value;
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();

    const oversized = new File([new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)], 'large.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput!, { target: { files: [oversized] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('A imagem não pode exceder 1 MiB.');
    expect(currentUrl).toHaveValue(originalValue);
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

    const draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');

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

    const draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');

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
    const draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');

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

    const draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');
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
    const draft = JSON.parse(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1') ?? '{}');

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

  it('shows placeholders and delete actions for uploaded material image fields', () => {
    const onResourceChange = vi.fn();

    render(
      <EducationDashboard
        resources={[
          {
            id: 'mock-material',
            title: 'Material de teste',
            source: 'Equipe BemTeVi',
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
        onResourceChange={onResourceChange}
        onResourceAdd={vi.fn()}
        onGroupChange={vi.fn()}
        onGroupAdd={vi.fn()}
        onGroupRemove={vi.fn()}
        onGroupMove={vi.fn()}
      />,
    );

    const thumbnailInput = screen.getByLabelText('URL da miniatura da biblioteca');
    expect(thumbnailInput).toHaveValue('Imagem enviada (thumb.png)');
    expect(thumbnailInput).toBeDisabled();
    expect(screen.getByRole('img', { name: 'Miniatura da biblioteca' })).toHaveAttribute(
      'src',
      'data:image/png;base64,AAAA',
    );
    expect(screen.getByText('Arquivo enviado: thumb.png')).toBeInTheDocument();

    expect(screen.getByRole('img', { name: 'Imagem principal' })).toHaveAttribute('src', 'data:image/png;base64,BBBB');
    expect(screen.getByText('Arquivo enviado: featured.png')).toBeInTheDocument();

    const bodyImageInput = screen.getByLabelText('URL da imagem do bloco 1');
    expect(bodyImageInput).toHaveValue('Imagem enviada (body.png)');
    expect(bodyImageInput).toBeDisabled();
    expect(screen.getByRole('img', { name: 'Imagem interna' })).toHaveAttribute('src', 'data:image/png;base64,CCCC');
    expect(screen.getByText('Arquivo enviado: body.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deletar miniatura da biblioteca' }));
    expect(onResourceChange).toHaveBeenCalledWith(0, 'mock-material', { imageUrl: '', imageFileName: '' });

    fireEvent.click(screen.getByRole('button', { name: 'Deletar imagem principal' }));
    expect(onResourceChange).toHaveBeenCalledWith(0, 'mock-material', {
      featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Deletar imagem do bloco 1' }));
    expect(onResourceChange).toHaveBeenCalledWith(0, 'mock-material', {
      body: [
        {
          id: 'body-image',
          kind: 'image',
          imageUrl: '',
          imageFileName: '',
          alt: 'Imagem interna',
        },
      ],
    });
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
            source: 'Equipe BemTeVi',
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
            source: 'Equipe BemTeVi',
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
            source: 'Equipe BemTeVi',
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
            source: 'Equipe BemTeVi',
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
            source: 'Equipe BemTeVi',
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
            source: 'Equipe BemTeVi',
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

  it('displays flow list in sidebar, allows adding and deleting a flow with confirmation', async () => {
    const user = userEvent.setup();
    render(
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
    render(
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
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));

    // Stage q1 (Etapa 3 — q1) should show +pts badge
    expect(screen.getAllByText('+pts')[0]).toBeInTheDocument();

    // Stage q17 (Etapa 19 — q17) should show ⚠ badge
    expect(screen.getByText('⚠')).toBeInTheDocument();

    // Verify "+ Adicionar etapa" is visible in the sidebar stages area
    const addStageBtn = screen.getByRole('button', { name: /Adicionar etapa/i });
    expect(addStageBtn).toBeInTheDocument();

    // Click it and verify a new node is created (will be named 'nova_etapa' or 'nova_etapa_x')
    await user.click(addStageBtn);
    expect(screen.getAllByRole('button', { name: /Nova etapa final/i }).length).toBeGreaterThan(0);
  });

  it('renders all stages as collapsible cards, expands active, swaps text/type position, and supports deletion with confirmation', async () => {
    const user = userEvent.setup();
    render(
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
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getByRole('button', { name: 'Etapa 4 — Tem falta de apetite?' })); // Q2 stage in the outline list

    // Click option 1 actions to open drawer (Ações/Score button)
    await user.click(screen.getAllByRole('button', { name: /Ações\/Score/i })[0]);

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

  it('shows Exportar tab and export UI in export mode', () => {
    dashboardMocks.publishMode = 'export';
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: 'Exportar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Exportar' }));
    expect(screen.getByRole('button', { name: 'Gerar arquivo ZIP' })).toBeInTheDocument();
  });

  it('shows Publicar tab and publish UI in database mode', async () => {
    const user = userEvent.setup();
    dashboardMocks.publishMode = 'database';
    render(
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
    dashboardMocks.publishMode = 'database';
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '4.0.0',
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
    dashboardMocks.publish.mockResolvedValueOnce({
      flows: 0,
      materials: 0,
      groups: 0,
      contacts: 1,
      publishedAt: '2024-02-01T00:00:00.000Z',
      revision: 4,
    });

    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));
    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    await waitFor(() => expect(screen.getByText('Publicado na revisão 4.')).toBeInTheDocument());
    expect(dashboardMocks.publish).toHaveBeenCalledTimes(1);
    const [payload, publisherId, expectedRevision] = dashboardMocks.publish.mock.calls[0] as [
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
    expect(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1')).toBeNull();
  });

  it('keeps local drafts when publication fails', async () => {
    const user = userEvent.setup();
    dashboardMocks.publishMode = 'database';
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '4.0.0',
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
    dashboardMocks.publish.mockRejectedValueOnce(new Error('boom'));

    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));
    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    expect(await screen.findByText('Não foi possível publicar agora. Tente novamente.')).toBeInTheDocument();
    expect(localStorage.getItem('bemtevi:dev-dashboard:drafts:v1')).not.toBeNull();
  });

  it('compares edits against the database content baseline', async () => {
    const user = userEvent.setup();
    dashboardMocks.publishMode = 'database';
    dashboardMocks.content = {
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
      defaultGroupOrder: 0,
    };
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '4.0.0',
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

    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: 'Publicar' }));

    const contactsStat = screen.getByText('Contatos', { selector: 'p' }).closest('div');
    expect(contactsStat).toHaveTextContent('1 editado');
  });
});
