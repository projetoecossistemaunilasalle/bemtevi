import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ResourceDetailScreen } from '../ResourceDetailScreen';
import {
  createDraftState,
  firstShippedMaterial,
  renderWithContent,
  shippedEducationMaterials,
  shippedMaterialSourceIndex,
} from './educationScreensTestUtils';

beforeEach(() => {
  localStorage.clear();
});

describe('ResourceDetailScreen', () => {
  it('falls back to the first resource when the id is unknown', () => {
    const resource = firstShippedMaterial();

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
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          educationMaterialPatches: [
            {
              id: resource.id,
              sourceIndex: shippedMaterialSourceIndex(resource.id),
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

  it('renders the published material source link at the end of the detail content', () => {
    const resource = firstShippedMaterial();
    const sourceBlock = [...(resource.body ?? [])].reverse().find((block) => block.kind === 'sourceLink');

    if (!sourceBlock || sourceBlock.kind !== 'sourceLink' || !sourceBlock.url) {
      throw new Error('Expected a published material with a source link.');
    }

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const sourceLink = screen.getByRole('link', { name: /acessar fonte original/i });
    expect(sourceLink).toHaveAttribute('href', sourceBlock.url);
    expect(resource.body?.at(-1)?.kind).toBe('sourceLink');
  });

  it('renders YouTube block titles before the iframe and omits the seeded mock description', () => {
    const baseResource = firstShippedMaterial();
    const videoTitle = 'Vídeo: Técnica de respiração';

    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            {
              ...baseResource,
              id: 'youtube-block-material',
              title: 'Material com vídeo do YouTube',
              body: [
                {
                  id: 'breathing-video',
                  kind: 'video',
                  title: videoTitle,
                  url: 'https://www.youtube.com/watch?v=kiEmbhvv7Fo',
                },
              ],
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/youtube-block-material']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const videoHeading = screen.getByRole('heading', { name: videoTitle });
    const iframe = screen.getByTitle(videoTitle);

    expect(videoHeading.compareDocumentPosition(iframe) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.queryByText('Embed configurável pelo dashboard.')).not.toBeInTheDocument();
  });

  it('renders a YouTube block title, description, and iframe in DOM order', () => {
    const baseResource = firstShippedMaterial();
    const videoTitle = 'Vídeo: pausa guiada de respiração';
    const videoDescription = 'Uma prática breve para acompanhar antes do início da próxima aula.';

    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
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

  it('renders an Instagram block inside the material with blockquote and fallback link', () => {
    const baseResource = firstShippedMaterial();
    const postTitle = 'Publicação educativa no Instagram';
    const postDescription = 'Dicas de saúde mental compartilhadas no nosso perfil oficial.';
    const instagramUrl = 'https://www.instagram.com/p/DFxyz123/';

    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            {
              ...baseResource,
              id: 'instagram-block-material',
              title: 'Material com post do Instagram',
              body: [
                {
                  id: 'instagram-post',
                  kind: 'video',
                  title: postTitle,
                  description: postDescription,
                  url: instagramUrl,
                },
              ],
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/instagram-block-material']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: postTitle })).toBeInTheDocument();
    expect(screen.getByText(postDescription)).toBeInTheDocument();
    const blockquote = document.querySelector('blockquote.instagram-media');
    expect(blockquote).toBeInTheDocument();
    expect(blockquote).toHaveAttribute('data-instgrm-permalink', instagramUrl);
    const link = screen.getByRole('link', { name: /abrir no instagram/i });
    expect(link).toHaveAttribute('href', instagramUrl);
  });

  it('renders a PDF inside the material with a direct-open fallback', () => {
    const baseResource = firstShippedMaterial();
    const pdfTitle = 'Cartilha de acolhimento';
    const pdfUrl = 'https://example.com/cartilha.pdf';

    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            {
              ...baseResource,
              id: 'pdf-block-material',
              body: [{ id: 'pdf-one', kind: 'pdf', title: pdfTitle, url: pdfUrl }],
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/pdf-block-material']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTitle(pdfTitle)).toHaveAttribute('src', pdfUrl);
    expect(screen.getByRole('link', { name: /abrir pdf em outra aba/i })).toHaveAttribute('href', pdfUrl);
  });

  it('renders legacy PDF source links inside the material', () => {
    const resource = shippedEducationMaterials().find((candidate) =>
      candidate.body?.some((block) => block.kind === 'sourceLink' && block.url?.includes('.pdf')),
    );
    const pdfBlock = resource?.body?.find((block) => block.kind === 'sourceLink' && block.url?.includes('.pdf'));

    if (!resource || !pdfBlock?.url) throw new Error('Expected a seeded material with a PDF source link.');

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTitle(pdfBlock.label ?? 'Documento em PDF')).toHaveAttribute('src', pdfBlock.url);
  });

  it('previews local dashboard drafts with a warning banner', () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          educationMaterialPatches: [
            {
              id: resource.id,
              sourceIndex: shippedMaterialSourceIndex(resource.id),
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
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
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
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
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
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '1.0.0',
        flowPatches: [],
        educationMaterialPatches: [
          {
            id: resource.id,
            sourceIndex: shippedMaterialSourceIndex(resource.id),
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

  it('renders material body texts and descriptions with text-justify class', () => {
    const resource = firstShippedMaterial();

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const description = screen.getByText(resource.description);
    expect(description).toHaveClass('text-justify');

    const paragraphBlock = resource.body?.find((block) => block.kind === 'paragraph' && block.text);
    if (!paragraphBlock || paragraphBlock.kind !== 'paragraph' || !paragraphBlock.text) {
      throw new Error('Expected a published material with a paragraph block.');
    }

    const paragraphText = screen.getByText(paragraphBlock.text);
    expect(paragraphText).toHaveClass('text-justify');
  });
});
