import { renderDashboard, setupDashboardRouteTest, readDraft } from './dashboardRouteTestHarness';
import { DashboardRoute } from '../DashboardRoute';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EducationDashboard } from '../education/EducationDashboard';
import { MAX_IMAGE_SOURCE_BYTES } from '../components/fileUpload';

describe('DashboardRoute education materials', () => {
  beforeEach(setupDashboardRouteTest);

  it('updates a local education title draft', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    const titleInput = screen.getByLabelText('Título do material');
    fireEvent.change(titleInput, { target: { value: 'Material editado localmente' } });

    expect(screen.getByDisplayValue('Material editado localmente')).toBeInTheDocument();
  });

  it('adds a new local education material', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo material' }));

    expect(screen.getByDisplayValue('Novo material')).toBeInTheDocument();
    expect(screen.getByText('Material editável apenas neste navegador.')).toBeInTheDocument();
  });

  it('removes a shipped education material after confirmation', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover material Material de teste' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: Remover material Material de teste' }));

    expect(screen.getByText('Nenhum material disponível.')).toBeInTheDocument();
    expect(await readDraft()).toMatchObject({
      removedEducationMaterialIds: ['mock-material'],
    });
  });

  it('updates required education metadata drafts', async () => {
    await renderDashboard(
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

  it('rejects an image above the source-size guard without replacing the current value', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    const currentUrl = screen.getByLabelText('URL da miniatura da biblioteca');
    const originalValue = currentUrl.getAttribute('value') ?? (currentUrl as HTMLInputElement).value;
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();

    const oversized = new File([new Uint8Array(MAX_IMAGE_SOURCE_BYTES + 1)], 'large.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput!, { target: { files: [oversized] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('A imagem selecionada é muito grande.');
    expect(currentUrl).toHaveValue(originalValue);
  });

  it('moves an education group order draft', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover grupo Grupo de teste para baixo' }));

    const draft = await readDraft();

    expect(draft.groupPatches).toMatchObject([
      { id: 'mock-group', sourceIndex: 0, patch: { order: 2 } },
      { id: 'mock-group-two', sourceIndex: 1, patch: { order: 1 } },
    ]);
  });

  it('reorders education groups in the dashboard list after moving', async () => {
    await renderDashboard(
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

  it('shows Geral as the non-removable default group with an explanation', async () => {
    await renderDashboard(
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

  it('moves Geral down in the group management list', async () => {
    await renderDashboard(
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

    const draft = await readDraft();

    expect(draft.defaultGroupOrder).toBe(1);
    expect(draft.groupPatches).toMatchObject([{ id: 'mock-group', sourceIndex: 0, patch: { order: 0 } }]);
  });

  it('moves the first named group above Geral', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover grupo Grupo de teste para cima' }));

    const groupTitles = screen.getAllByLabelText(/Título do grupo/).map((input) => (input as HTMLInputElement).value);
    const draft = await readDraft();

    expect(groupTitles).toEqual(['Grupo de teste', 'Geral', 'Segundo grupo de teste']);
    expect(draft.defaultGroupOrder).toBe(1);
    expect(draft.groupPatches).toMatchObject([{ id: 'mock-group', sourceIndex: 0, patch: { order: 0 } }]);
  });

  it('removes a shipped education group and moves its materials to Geral', async () => {
    await renderDashboard(
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

    const draft = await readDraft();
    const materialGroupSelect = screen.getByLabelText('Grupo do material') as HTMLSelectElement;

    expect(draft.removedGroupIds).toEqual(['mock-group']);
    expect(draft.groupPatches).toMatchObject([]);
    expect(draft.educationMaterialPatches).toMatchObject([
      { id: 'mock-material', sourceIndex: 0, patch: { group: 'geral' } },
    ]);
    expect(materialGroupSelect).toHaveValue('geral');
    expect(screen.queryByLabelText('Título do grupo Grupo de teste')).not.toBeInTheDocument();
  });

  it('moves an added education group relative to shipped groups', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar grupos de materiais \(mostrar\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover grupo Novo grupo para cima' }));

    const groupTitles = screen.getAllByLabelText(/Título do grupo/).map((input) => (input as HTMLInputElement).value);
    const draft = await readDraft();

    expect(groupTitles).toEqual(['Geral', 'Grupo de teste', 'Novo grupo', 'Segundo grupo de teste']);
    expect(draft.addedGroups).toEqual([
      { id: expect.stringMatching(/^group-local-/), title: 'Novo grupo', description: '', order: 2 },
    ]);
    expect(draft.groupPatches).toMatchObject([{ id: 'mock-group-two', sourceIndex: 1, patch: { order: 3 } }]);
  });

  it('adds, edits, and removes education tags', async () => {
    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
    const tagInput = screen.getByLabelText('Marcadores do material');
    fireEvent.change(tagInput, { target: { value: 'acolhimento' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Remover teste' }));

    expect(screen.getByText('acolhimento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover teste' })).not.toBeInTheDocument();
  });

  it('keeps focus while editing an education tag', async () => {
    const user = userEvent.setup();

    await renderDashboard(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

    const tagInput = screen.getByLabelText('Marcadores do material');
    await user.click(tagInput);
    await user.keyboard('s');

    expect(screen.getByLabelText('Marcadores do material')).toHaveFocus();
  });

  it('edits the featured image with catalog and external URL modes', async () => {
    await renderDashboard(
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

  it('adds, edits, and reorders material body blocks', async () => {
    await renderDashboard(
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

  it('adds body image blocks without placeholder URLs and previews URL images', async () => {
    await renderDashboard(
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

  it('shows placeholders and delete actions for uploaded material image fields', async () => {
    const onResourceChange = vi.fn();

    await renderDashboard(
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
});
