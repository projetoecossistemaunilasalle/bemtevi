import { render as renderUi, screen, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import type { ServiceDirectoryEntry } from '../../domain/services/types';
import { createDraftFromAiPayload } from '../ai/aiDraft';
import { normalizeContactLocations } from '../../domain/services/locations';
import type { DraftWorkspace } from '../draft-storage/workspace';
import { getShippedDashboardContent } from '../content/shippedContent';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../../app/content/publishedContent';
import type { DashboardShippedContent } from '../content/shippedContent';

export function asPayload(shipped: DashboardShippedContent): PublishedContentPayload {
  const normalized = normalizeContactLocations(shipped.contacts, shipped.locations ?? []);
  return {
    flows: shipped.flows,
    educationMaterials: shipped.educationMaterials,
    educationGroups: shipped.educationGroups,
    contacts: normalized.contacts,
    locations: normalized.locations,
    defaultGroupOrder: shipped.defaultGroupOrder ?? 0,
  };
}

const persisted = vi.hoisted(() => ({ workspaces: [] as DraftWorkspace[] }));
vi.mock('../draft-storage/workspace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../draft-storage/workspace')>();
  return {
    ...actual,
    listWorkspaces: vi.fn(async () => persisted.workspaces),
    writeWorkspace: vi.fn(async (workspace: DraftWorkspace) => {
      persisted.workspaces = [
        ...persisted.workspaces.filter((item) => item.workspaceId !== workspace.workspaceId),
        structuredClone(workspace),
      ];
      return { ok: true };
    }),
  };
});
export async function renderDashboard(ui: Parameters<typeof renderUi>[0]) {
  if (dashboardMocks.content === initialContent) dashboardMocks.content = asPayload(getShippedDashboardContent());
  const result = renderUi(ui);
  await waitFor(() => expect(screen.queryByText('Carregando rascunhos…')).not.toBeInTheDocument());
  return result;
}
export async function readDraft() {
  await waitFor(() => expect(screen.queryByText('Salvando…')).not.toBeInTheDocument());
  const workspace = persisted.workspaces.at(-1)!;
  const legacy = createDraftFromAiPayload(workspace.base.payload, workspace.local, workspace.local);
  legacy.groupPatches.sort((a, b) => (a.sourceIndex ?? 0) - (b.sourceIndex ?? 0));
  return { ...legacy, basePayload: workspace.base.payload, baseRevision: workspace.base.revision };
}

const shippedContacts = vi.hoisted(() => [] as ServiceDirectoryEntry[]);

const dashboardMocks = vi.hoisted(() => ({
  content: null as PublishedContentPayload | null,
  snapshot: null as PublishedContentSnapshot | null,
  publish: vi.fn(),
  account: { id: 'admin-id', email: 'admin@bemtevi.test' } as { id: string; email: string } | null,
}));
export const dashboardTestState = { dashboardMocks, persisted, shippedContacts };
let initialContent: PublishedContentPayload;

vi.mock('../publishing/publishMode', () => ({
  getDashboardPublishMode: () => 'database',
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

export function createDefaultShippedContact(): ServiceDirectoryEntry {
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
    locations: [{ id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' }],
  }),
}));

export function setupDashboardRouteTest() {
  localStorage.clear();
  sessionStorage.clear();
  persisted.workspaces = [];
  shippedContacts.splice(0, shippedContacts.length, createDefaultShippedContact());
  vi.clearAllMocks();
  dashboardMocks.content = asPayload(getShippedDashboardContent());
  initialContent = dashboardMocks.content;
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
}
