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
                next: 'done',
                effects: [{ kind: 'flow_start', flowId: 'mock-flow-two' }],
              },
            ],
          },
          done: { id: 'done', kind: 'result', text: 'Finalizado.' },
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
    expect(screen.getByText('Ele não publica nada sozinho.')).toBeInTheDocument();
  });

  it('updates a local flow title draft', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    const titleInput = screen.getByLabelText('Título do fluxo');
    fireEvent.change(titleInput, { target: { value: 'Fluxo editado localmente' } });

    expect(screen.getByDisplayValue('Fluxo editado localmente')).toBeInTheDocument();
  });

  it('edits and expands a flow locally', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir etapa 1' }));
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
    expect(screen.getAllByText('Etapa 3').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Nova opção')).toBeInTheDocument();
  });

  it('edits later etapas directly and keeps the final-step button after the etapa list', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir etapa 2' }));
    fireEvent.change(screen.getByLabelText('Tipo da etapa 2'), {
      target: { value: 'choice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar opção na etapa 2' }));
    fireEvent.change(screen.getByLabelText('Texto da opção 1 da etapa 2'), {
      target: { value: 'Opção editada na segunda etapa' },
    });

    expect(screen.getByDisplayValue('Opção editada na segunda etapa')).toBeInTheDocument();

    const finalStepButton = screen.getByRole('button', { name: 'Adicionar etapa' });
    const etapaToggles = screen.getAllByRole('button', { name: /^Abrir etapa \d+$/ });
    const lastEtapaToggle = etapaToggles[etapaToggles.length - 1];

    expect(lastEtapaToggle.compareDocumentPosition(finalStepButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('starts with every etapa collapsed and shows clear collapsed summaries', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText('Texto da etapa 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Texto da etapa 2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir etapa 1' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Abrir etapa 2' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Pergunta com opções')).toBeInTheDocument();
    expect(screen.getByText('2 opções')).toBeInTheDocument();
    expect(screen.getByText('Resultado final')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir etapa 2' }));

    expect(screen.getByLabelText('Texto da etapa 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar etapa 2' })).toHaveAttribute('aria-expanded', 'true');
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

  it('clears the mock chat so a different path can be tested', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByText('Testar conversa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir para outro fluxo' }));
    expect(screen.getByText('Este é outro fluxo.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar conversa' }));

    expect(screen.queryByText('Este é outro fluxo.')).not.toBeInTheDocument();
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
