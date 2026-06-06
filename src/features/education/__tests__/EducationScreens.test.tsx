import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { resourcesContent } from '../../../content/resources/resources';
import { EducationLibraryScreen } from '../EducationLibraryScreen';
import { ResourceDetailScreen } from '../ResourceDetailScreen';

beforeEach(() => {
  localStorage.clear();
});

describe('EducationLibraryScreen', () => {
  it('renders configured resources and navigates to the detail route', async () => {
    const user = userEvent.setup();
    const resource = resourcesContent.resources[0];

    render(
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
    expect(screen.getByRole('link', { name: /acessar fonte original/i })).toHaveAttribute('href', 'https://www.feevale.br/');
  });
});

describe('ResourceDetailScreen', () => {
  it('falls back to the first resource when the id is unknown', () => {
    const resource = resourcesContent.resources[0];

    render(
      <MemoryRouter initialEntries={['/educacao/recurso-inexistente']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: resource.title })).toBeInTheDocument();
  });

  it('previews local dashboard drafts with a warning banner', () => {
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
              title: 'Material em teste',
              body: [{ id: 'draft-body', kind: 'paragraph', title: 'Rascunho', text: 'Texto em revisão.' }],
            },
          },
        ],
        addedFlows: [],
        addedEducationMaterials: [],
        updatedAt: '2026-06-05T00:00:00.000Z',
      }),
    );

    render(
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

    render(
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
    JSON.stringify({
      schemaVersion: '1.0.0',
      flowPatches: [],
      educationMaterialPatches: [
        {
          id: resource.id,
          sourceIndex: 0,
          patch: { title: 'Material em teste' },
        },
      ],
      addedFlows: [],
      addedEducationMaterials: [],
      updatedAt: '2026-06-05T00:00:00.000Z',
    }),
  );

  const { resolveEducationResourcesForPreview } = await import('../educationResourcePreview');
  const preview = resolveEducationResourcesForPreview();

  expect(preview.isPreviewingDrafts).toBe(true);
  expect(preview.resources[0].title).toBe('Material em teste');
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
