import { render as renderUi, screen, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import type { ServiceDirectoryEntry } from '../../domain/services/types';
import { normalizeContactLocations } from '../../domain/services/locations';
import { getShippedDashboardContent } from '../content/shippedContent';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../../app/content/publishedContent';
import type { DashboardShippedContent } from '../content/shippedContent';
import { createEmptyDashboardDraftState, type DashboardDraftState } from '../dashboardDraftState';
import type { SaveState } from '../drafts/saveTransitions';

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

interface TestWorkspace {
  workspaceId: string;
  base: { revision: number | null; payload: PublishedContentPayload };
  local: PublishedContentPayload;
  archived?: boolean;
}

const persisted = vi.hoisted(() => ({ workspaces: [] as TestWorkspace[] }));
const dashboardMocks = vi.hoisted(() => ({
  content: null as PublishedContentPayload | null,
  snapshot: null as PublishedContentSnapshot | null,
  publish: vi.fn(),
  account: { id: 'admin-id', email: 'admin@bemtevi.test' } as { id: string; email: string } | null,
}));

function emptyPayload(): PublishedContentPayload {
  return { flows: [], educationMaterials: [], educationGroups: [], contacts: [], locations: [], defaultGroupOrder: 0 };
}

function rememberWorkspace(base: PublishedContentPayload, local: PublishedContentPayload, archived = false): void {
  const current = persisted.workspaces.at(-1);
  if (current) {
    current.local = structuredClone(local);
    current.archived = archived;
    return;
  }
  persisted.workspaces.push({
    workspaceId: 'test-workspace',
    base: { revision: dashboardMocks.snapshot?.revision ?? null, payload: structuredClone(base) },
    local: structuredClone(local),
    archived,
  });
}

function diffRecords<T extends { id: string }>(source: T[], next: T[]) {
  const sourceById = new Map<string, Array<{ item: T; index: number }>>();
  source.forEach((item, index) => sourceById.set(item.id, [...(sourceById.get(item.id) ?? []), { item, index }]));
  const sourceCounts = new Map<string, number>();
  source.forEach((item) => sourceCounts.set(item.id, (sourceCounts.get(item.id) ?? 0) + 1));
  const nextCounts = new Map<string, number>();
  next.forEach((item) => nextCounts.set(item.id, (nextCounts.get(item.id) ?? 0) + 1));
  const used = new Map<string, number>();
  const patches: Array<{ id: string; sourceIndex: number; sourceIdUnique: boolean; patch: Partial<T> }> = [];
  const added: T[] = [];
  next.forEach((item) => {
    const occurrence = used.get(item.id) ?? 0;
    const match = sourceById.get(item.id)?.[occurrence];
    used.set(item.id, occurrence + 1);
    if (!match) {
      added.push(item);
      return;
    }
    if (JSON.stringify(match.item) !== JSON.stringify(item)) {
      const { id: _id, ...patch } = item;
      patches.push({
        id: item.id,
        sourceIndex: match.index,
        sourceIdUnique: sourceCounts.get(item.id) === 1 && nextCounts.get(item.id) === 1,
        patch: patch as Partial<T>,
      });
    }
  });
  const removedIds = source
    .filter((item) => (nextCounts.get(item.id) ?? 0) < (sourceCounts.get(item.id) ?? 0))
    .map((item) => item.id)
    .filter((id, index, ids) => ids.indexOf(id) === index);
  return { patches, added, removedIds };
}

function deriveDraftState(base: PublishedContentPayload, local: PublishedContentPayload): DashboardDraftState {
  const draft = createEmptyDashboardDraftState();
  const flows = diffRecords(base.flows, local.flows);
  draft.flowPatches = flows.patches;
  draft.addedFlows = flows.added;
  draft.removedFlowIds = flows.removedIds;
  const materials = diffRecords(base.educationMaterials, local.educationMaterials);
  draft.educationMaterialPatches = materials.patches;
  draft.addedEducationMaterials = materials.added;
  draft.removedEducationMaterialIds = materials.removedIds;
  const groups = diffRecords(base.educationGroups, local.educationGroups);
  draft.groupPatches = groups.patches;
  draft.addedGroups = groups.added;
  draft.removedGroupIds = groups.removedIds;
  const contacts = diffRecords(base.contacts, local.contacts);
  draft.contactPatches = contacts.patches;
  draft.addedContacts = contacts.added;
  draft.removedContactIds = contacts.removedIds;
  const locations = diffRecords(base.locations ?? [], local.locations ?? []);
  draft.locationPatches = locations.patches;
  draft.addedLocations = locations.added;
  draft.removedLocationIds = locations.removedIds;
  if ((base.defaultGroupOrder ?? 0) !== (local.defaultGroupOrder ?? 0))
    draft.defaultGroupOrder = local.defaultGroupOrder;
  return draft;
}

vi.mock('../draft-storage/useDraftWorkspace', async () => {
  const React = await import('react');
  return {
    configureCanonicalWorkspaceServices: vi.fn(),
    useDraftWorkspace: () => {
      const [state, setState] = React.useState<SaveState>({
        phase: 'clean',
        base: null,
        local: null,
        conflicts: [],
        error: null,
        cacheAvailable: true,
      });
      const edit = (candidate: PublishedContentPayload) => {
        setState((current) => {
          rememberWorkspace(current.base?.payload ?? dashboardMocks.content ?? emptyPayload(), candidate);
          return { ...current, phase: 'clean', local: candidate };
        });
      };
      const flush = async () => true;
      const refresh = async () => undefined;
      const resolve = async () => undefined;
      const retry = async () => undefined;
      const discardLocal = async () => {
        setState((current) => {
          const base = current.base?.payload ?? dashboardMocks.content ?? emptyPayload();
          rememberWorkspace(base, base, true);
          return { ...current, phase: 'clean', local: null, conflicts: [], error: null };
        });
      };
      const undo = () => undefined;
      return { state, edit, flush, refresh, resolve, retry, discardLocal, undo };
    },
  };
});

export async function renderDashboard(ui: Parameters<typeof renderUi>[0]) {
  if (dashboardMocks.content === initialContent) dashboardMocks.content = asPayload(getShippedDashboardContent());
  const result = renderUi(ui);
  await waitFor(() => expect(screen.queryByText('Carregando rascunho...')).not.toBeInTheDocument());
  return result;
}
export async function readDraft() {
  await waitFor(() => expect(screen.queryByText('Salvando...')).not.toBeInTheDocument());
  const workspace = persisted.workspaces.at(-1)!;
  const draft = deriveDraftState(workspace.base.payload, workspace.local);
  draft.groupPatches.sort((a, b) => (a.sourceIndex ?? 0) - (b.sourceIndex ?? 0));
  return { ...draft, basePayload: workspace.base.payload, baseRevision: workspace.base.revision };
}

const shippedContacts = vi.hoisted(() => [] as ServiceDirectoryEntry[]);
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
    refreshLatest: async () => dashboardMocks.snapshot,
  }),
}));

vi.mock('../../app/neon/client', () => ({
  getNeonConfig: () => ({ authUrl: 'https://auth.bemtevi.test', dataApiUrl: 'https://data.bemtevi.test' }),
  defaultNeonClient: null,
  createConfiguredNeonClient: vi.fn(() => null),
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
