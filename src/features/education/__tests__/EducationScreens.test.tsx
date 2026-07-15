import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { PublishedContentContext } from '../../../app/content/PublishedContentContext';
import { getBundledContent } from '../../../app/content/bundledContent';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import { resourcesContent } from '../../../content/resources/resources';
import { EducationLibraryScreen } from '../EducationLibraryScreen';
import { ResourceDetailScreen } from '../ResourceDetailScreen';

const baseRender = render;

function buildContentValue(payload: PublishedContentPayload) {
  const snapshot = {
    schemaVersion: '1.0.0',
    revision: 1,
    payload,
    publishedAt: '2026-07-15T00:00:00.000Z',
    publishedBy: 'admin',
  } as const;
  return {
    content: payload,
    snapshot,
    source: 'database' as const,
    status: 'ready' as const,
    loadError: null,
    refresh: async () => {},
    publish: async () => snapshot,
  };
}

function renderWithContent(ui: ReactElement, payload: PublishedContentPayload = getBundledContent()) {
  return baseRender(
    <PublishedContentContext.Provider value={buildContentValue(payload)}>{ui}</PublishedContentContext.Provider>,
  );
}

function buildDatabaseEducationPayload(): PublishedContentPayload {
  const bundled = getBundledContent();
  const dbResource = {
    ...bundled.educationMaterials[0],
    id: 'db-recurso',
    title: 'Recurso do Banco de Dados',
    group: 'db-grupo',
  };
  const dbGroup = { id: 'db-grupo', title: 'Grupo do Banco de Dados', order: 1 };
  return {
    ...bundled,
    educationMaterials: [...bundled.educationMaterials, dbResource],
    educationGroups: [...bundled.educationGroups, dbGroup],
  };
}

beforeEach(() => {
  localStorage.clear();
});

function createDraftState(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: '2.0.0',
    flowPatches: [],
    educationMaterialPatches: [],
    groupPatches: [],
    addedFlows: [],
    addedEducationMaterials: [],
    addedGroups: [],
    updatedAt: '2026-06-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('EducationLibraryScreen', () => {
  it('renders configured resources and navigates to the detail route', async () => {
    const user = userEvent.setup();
    const resource = resourcesContent.resources[0];

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(resource.title)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ver material/i }));

    expect(screen.getByRole('heading', { name: resource.title })).toBeInTheDocument();
    expect(screen.getByText('Sobre este material')).toBeInTheDocument();
    expect(screen.getByText('Aplicação prática')).toBeInTheDocument();
  });

  it('renders the library thumbnail without blend or opacity effects', () => {
    const resource = resourcesContent.resources[0];

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const thumbnail = document.querySelector(`img[src="${resource.imageUrl}"]`);

    expect(thumbnail).toBeInstanceOf(HTMLImageElement);
    expect(thumbnail).not.toHaveClass('opacity-90');
    expect(thumbnail).not.toHaveClass('mix-blend-multiply');
    expect(thumbnail).not.toHaveAttribute('src', expect.stringContaining('respiracao'));
  });

  it('shows the preview warning when at least one material was actually added', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            {
              ...resource,
              id: 'preview-added-material',
              title: 'Material adicionado em teste',
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/versão de teste/i)).toBeInTheDocument();
    expect(screen.getByText('Material adicionado em teste')).toBeInTheDocument();
  });

  it('renders named group headings only for groups with resources', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedGroups: [{ id: 'unused-group', title: 'Grupo sem recursos', order: 10 }],
          addedEducationMaterials: [
            {
              ...resource,
              id: 'material-in-group',
              title: 'Material em grupo',
              group: 'auto-cuidado',
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    // 'Autocuidado' group heading should appear because it has resources
    expect(screen.getByRole('heading', { name: 'Autocuidado' })).toBeInTheDocument();
    // 'Grupo sem recursos' should NOT appear
    expect(screen.queryByRole('heading', { name: 'Grupo sem recursos' })).not.toBeInTheDocument();
    expect(screen.queryByText('Grupo sem recursos')).not.toBeInTheDocument();
  });

  it('does not render headings for empty groups', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedGroups: [{ id: 'empty-group', title: 'Grupo Vazio', order: 5 }],
          addedEducationMaterials: [
            {
              ...resource,
              id: 'material-no-group',
              title: 'Material sem grupo',
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('heading', { name: 'Grupo Vazio' })).not.toBeInTheDocument();
    expect(screen.getByText('Material sem grupo')).toBeInTheDocument();
  });

  it('renders named groups ordered by their order field', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedGroups: [
            { id: 'group-z', title: 'Grupo Z', order: 30 },
            { id: 'group-a', title: 'Grupo A', order: 10 },
            { id: 'group-m', title: 'Grupo M', order: 20 },
          ],
          addedEducationMaterials: [
            { ...resource, id: 'mat-z', title: 'Material Z', group: 'group-z', groupOrder: 1 },
            { ...resource, id: 'mat-a', title: 'Material A', group: 'group-a', groupOrder: 1 },
            { ...resource, id: 'mat-m', title: 'Material M', group: 'group-m', groupOrder: 1 },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const groupHeadings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(groupHeadings).toEqual(['Grupo A', 'Grupo M', 'Grupo Z']);
  });

  it('renders geral section first without a heading', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedGroups: [{ id: 'first-group', title: 'Primeiro Grupo', order: 1 }],
          addedEducationMaterials: [
            { ...resource, id: 'mat-geral', title: 'Material Geral', group: 'geral' },
            { ...resource, id: 'mat-named', title: 'Material Named', group: 'first-group' },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    // geral has no heading (h2); named group heading should appear
    const groupHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(groupHeadings).toHaveLength(1);
    expect(groupHeadings[0].textContent).toBe('Primeiro Grupo');
    // geral resources should still be visible
    expect(screen.getByText('Material Geral')).toBeInTheDocument();
    expect(screen.getByText('Material Named')).toBeInTheDocument();
  });

  it('renders geral according to the default group order', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          defaultGroupOrder: 2,
          addedGroups: [{ id: 'first-group', title: 'Primeiro Grupo', order: 1 }],
          addedEducationMaterials: [
            { ...resource, id: 'mat-geral', title: 'Material Geral', group: 'geral' },
            { ...resource, id: 'mat-named', title: 'Material Pinned', group: 'first-group' },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const pinnedHeading = screen.getByRole('heading', { name: 'Primeiro Grupo' });
    const pinnedMaterial = screen.getByText('Material Pinned');
    const geralMaterial = screen.getByText('Material Geral');

    expect(pinnedHeading.compareDocumentPosition(pinnedMaterial)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(pinnedMaterial.compareDocumentPosition(geralMaterial)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('separates geral from a previous named group without rendering a geral heading', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          defaultGroupOrder: 2,
          addedGroups: [{ id: 'auto-group', title: 'Autocuidado', order: 1 }],
          addedEducationMaterials: [
            { ...resource, id: 'mat-autocuidado', title: 'Material Autocuidado', group: 'auto-group' },
            { ...resource, id: 'mat-geral', title: 'Material Geral', group: 'geral' },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const separator = screen.getByRole('separator', { name: 'Separador entre grupos de materiais' });
    const autocuidadoHeading = screen.getByRole('heading', { name: 'Autocuidado' });
    const geralMaterial = screen.getByText('Material Geral');

    expect(separator).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Geral' })).not.toBeInTheDocument();
    expect(autocuidadoHeading.compareDocumentPosition(separator)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(separator.compareDocumentPosition(geralMaterial)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('sorts resources within groups by groupOrder with stable tie-breaking', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            { ...resource, id: 'mat-3', title: 'Terceiro', group: 'geral', groupOrder: 3 },
            { ...resource, id: 'mat-1', title: 'Primeiro', group: 'geral', groupOrder: 1 },
            { ...resource, id: 'mat-2', title: 'Segundo', group: 'geral', groupOrder: 2 },
            { ...resource, id: 'mat-undefined', title: 'Sem order', group: 'geral' },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    // geral has no h2 heading; check resource card titles (h3) instead
    // Filter out the shipped resource that also renders in geral
    const resourceTitles = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
      .filter((t) => t !== resource.title);
    expect(resourceTitles).toEqual(['Primeiro', 'Segundo', 'Terceiro', 'Sem order']);
  });

  it('falls back dangling group references to geral', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            { ...resource, id: 'mat-dangling', title: 'Material Órfão', group: 'non-existent-group' },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    // Should still render (in geral section since group doesn't exist)
    expect(screen.getByText('Material Órfão')).toBeInTheDocument();
    // Should NOT have any extra heading since it's in geral
    const headings = screen.getAllByRole('heading');
    expect(headings.every((h) => h.textContent !== 'Material Órfão')).toBe(false);
  });

  it('sets isPreviewingDrafts true when only groups have drafts', async () => {
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedGroups: [{ id: 'new-group', title: 'Novo Grupo', order: 5 }],
        }),
      ),
    );

    const { resolveEducationResourcesForPreview } = await import('../educationResourcePreview');
    const preview = resolveEducationResourcesForPreview(getBundledContent());

    expect(preview.isPreviewingDrafts).toBe(true);
  });
});

describe('ResourceDetailScreen', () => {
  it('falls back to the first resource when the id is unknown', () => {
    const resource = resourcesContent.resources[0];

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/recurso-inexistente']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: resource.title })).toBeInTheDocument();
  });

  it('renders the source badge and dashboard-defined tags without empty badges', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          educationMaterialPatches: [
            {
              id: resource.id,
              sourceIndex: 0,
              patch: {
                tags: ['Respiração', '   ', '', 'Sala de aula'],
              },
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const detailHeader = screen.getByRole('heading', { name: resource.title }).closest('header');
    const visibleBadgeTexts = Array.from(detailHeader?.querySelectorAll('span') ?? []).map(
      (badge) => badge.textContent,
    );

    expect(visibleBadgeTexts).toEqual([resource.source, 'Respiração', 'Sala de aula']);
    expect(visibleBadgeTexts).not.toContain('Material educativo');
  });

  it('renders the respiration images as body content, not only as metadata', () => {
    const resource = resourcesContent.resources[0];

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('img', { name: 'Exercício de respiração passo 1.' })).toHaveAttribute(
      'src',
      '/SeCuida-Prototipo/respiracao1.jpg',
    );
    expect(screen.getByRole('img', { name: 'Exercício de respiração passo 2.' })).toHaveAttribute(
      'src',
      '/SeCuida-Prototipo/respiracao2.jpg',
    );
  });

  it('renders YouTube block titles before the iframe and omits the seeded mock description', () => {
    const resource = resourcesContent.resources[0];
    const videoBlock = resource.body?.find((block) => block.kind === 'video' && block.url?.includes('youtube'));

    if (!videoBlock || videoBlock.kind !== 'video' || !videoBlock.title) {
      throw new Error('Expected a seeded YouTube video block with a title.');
    }

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const videoHeading = screen.getByRole('heading', { name: videoBlock.title });
    const iframe = screen.getByTitle(videoBlock.title);

    expect(videoHeading.compareDocumentPosition(iframe) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.queryByText('Embed configurável pelo dashboard.')).not.toBeInTheDocument();
  });

  it('renders a YouTube block title, description, and iframe in DOM order', () => {
    const baseResource = resourcesContent.resources[0];
    const videoTitle = 'Vídeo: pausa guiada de respiração';
    const videoDescription = 'Uma prática breve para acompanhar antes do início da próxima aula.';

    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            {
              ...baseResource,
              id: 'video-block-with-description',
              title: 'Material com descrição de vídeo',
              body: [
                {
                  id: 'described-video',
                  kind: 'video',
                  title: videoTitle,
                  description: videoDescription,
                  url: 'https://www.youtube.com/watch?v=abcdef12345',
                },
              ],
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/video-block-with-description']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const videoHeading = screen.getByRole('heading', { name: videoTitle });
    const description = screen.getByText(videoDescription);
    const iframe = screen.getByTitle(videoTitle);

    expect(videoHeading.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(description.compareDocumentPosition(iframe) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('previews local dashboard drafts with a warning banner', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          educationMaterialPatches: [
            {
              id: resource.id,
              sourceIndex: 0,
              patch: {
                title: 'Material em teste',
                body: [{ id: 'draft-body', kind: 'paragraph', title: 'Rascunho', text: 'Texto em revisão.' }],
              },
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Material em teste' })).toBeInTheDocument();
    expect(screen.getByText(/versão de teste/i)).toBeInTheDocument();
    expect(screen.getByText('Texto em revisão.')).toBeInTheDocument();
  });

  it('does not show the preview warning on an unchanged material when another material was added', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            {
              ...resource,
              id: 'preview-added-material',
              title: 'Material adicionado em teste',
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: resource.title })).toBeInTheDocument();
    expect(screen.queryByText(/versão de teste/i)).not.toBeInTheDocument();
  });

  it('shows the preview warning on a detail page for an added material', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            {
              ...resource,
              id: 'preview-added-material',
              title: 'Material adicionado em teste',
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/preview-added-material']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Material adicionado em teste' })).toBeInTheDocument();
    expect(screen.getByText(/versão de teste/i)).toBeInTheDocument();
  });

  it('renders generic video URLs as full-card links instead of broken embeds', () => {
    const resource = resourcesContent.resources[0];
    localStorage.setItem(
      'secuida:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '1.0.0',
        flowPatches: [],
        educationMaterialPatches: [
          {
            id: resource.id,
            sourceIndex: 0,
            patch: {
              body: [{ id: 'generic-video', kind: 'video', title: 'Vídeo externo', url: 'https://example.com/video' }],
            },
          },
        ],
        addedFlows: [],
        addedEducationMaterials: [],
        updatedAt: '2026-06-05T00:00:00.000Z',
      }),
    );

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /vídeo externo abrir vídeo externo/i })).toHaveAttribute(
      'href',
      'https://example.com/video',
    );
    expect(screen.queryByTitle('Vídeo externo')).not.toBeInTheDocument();
  });
});

it('resolves local dashboard education drafts for preview', async () => {
  const resource = resourcesContent.resources[0];
  localStorage.setItem(
    'secuida:dev-dashboard:drafts:v1',
    JSON.stringify(
      createDraftState({
        educationMaterialPatches: [
          {
            id: resource.id,
            sourceIndex: 0,
            patch: { title: 'Material em teste' },
          },
        ],
      }),
    ),
  );

  const { resolveEducationResourcesForPreview } = await import('../educationResourcePreview');
  const preview = resolveEducationResourcesForPreview(getBundledContent());

  expect(preview.isPreviewingDrafts).toBe(true);
  expect(preview.changedResourceIds).toEqual([resource.id]);
  expect(preview.resources[0].title).toBe('Material em teste');
});

it('ignores unchanged education patches when computing preview warning state', async () => {
  const resource = resourcesContent.resources[0];
  localStorage.setItem(
    'secuida:dev-dashboard:drafts:v1',
    JSON.stringify(
      createDraftState({
        educationMaterialPatches: [
          {
            id: resource.id,
            sourceIndex: 0,
            patch: {
              title: resource.title,
              body: resource.body,
            },
          },
        ],
      }),
    ),
  );

  const { resolveEducationResourcesForPreview } = await import('../educationResourcePreview');
  const preview = resolveEducationResourcesForPreview(getBundledContent());

  expect(preview.isPreviewingDrafts).toBe(false);
  expect(preview.changedResourceIds).toEqual([]);
  expect(preview.resources).toEqual(resourcesContent.resources);
});

describe('resolveVideoEmbed', () => {
  it('converts YouTube watch URLs to embed URLs', async () => {
    const { resolveVideoEmbed } = await import('../videoEmbeds');

    expect(resolveVideoEmbed('https://www.youtube.com/watch?v=abcdef12345')).toEqual({
      kind: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/abcdef12345',
    });
  });

  it('falls back to a link for generic video URLs', async () => {
    const { resolveVideoEmbed } = await import('../videoEmbeds');

    expect(resolveVideoEmbed('https://example.com/video')).toEqual({
      kind: 'link',
      url: 'https://example.com/video',
    });
  });
});

describe('published content provider', () => {
  it('renders published education resources and groups', () => {
    const payload = buildDatabaseEducationPayload();
    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    expect(screen.getByText('Recurso do Banco de Dados')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grupo do Banco de Dados' })).toBeInTheDocument();
  });

  it('resolves published resource details by route id', () => {
    const payload = buildDatabaseEducationPayload();
    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/db-recurso']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    expect(screen.getByRole('heading', { name: 'Recurso do Banco de Dados' })).toBeInTheDocument();
  });
});
