import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { getBundledContent } from '../../../app/content/bundledContent';
import { ResourceDetailScreen } from '../ResourceDetailScreen';
import {
  firstShippedMaterial,
  renderWithContent,
  seedLegacyDashboardDraftBytes,
  shippedEducationMaterials,
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
    const payload = {
      ...getBundledContent(),
      educationMaterials: [
        {
          ...resource,
          tags: ['Respiração', '   ', '', 'Sala de aula'],
        },
      ],
    };

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
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
    const payload = {
      ...getBundledContent(),
      educationMaterials: [
        {
          ...baseResource,
          id: 'youtube-block-material',
          title: 'Material com vídeo do YouTube',
          body: [
            {
              id: 'breathing-video',
              kind: 'video' as const,
              title: videoTitle,
              url: 'https://www.youtube.com/watch?v=kiEmbhvv7Fo',
            },
          ],
        },
      ],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/youtube-block-material']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
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
    const payload = {
      ...getBundledContent(),
      educationMaterials: [
        {
          ...baseResource,
          id: 'video-block-with-description',
          title: 'Material com descrição de vídeo',
          body: [
            {
              id: 'described-video',
              kind: 'video' as const,
              title: videoTitle,
              description: videoDescription,
              url: 'https://www.youtube.com/watch?v=abcdef12345',
            },
          ],
        },
      ],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/video-block-with-description']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
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
    const payload = {
      ...getBundledContent(),
      educationMaterials: [
        {
          ...baseResource,
          id: 'instagram-block-material',
          title: 'Material com post do Instagram',
          body: [
            {
              id: 'instagram-post',
              kind: 'video' as const,
              title: postTitle,
              description: postDescription,
              url: instagramUrl,
            },
          ],
        },
      ],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/instagram-block-material']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
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
    const payload = {
      ...getBundledContent(),
      educationMaterials: [
        {
          ...baseResource,
          id: 'pdf-block-material',
          body: [{ id: 'pdf-one', kind: 'pdf' as const, title: pdfTitle, url: pdfUrl }],
        },
      ],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/pdf-block-material']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
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

  it('renders generic video URLs as full-card links instead of broken embeds', () => {
    const resource = firstShippedMaterial();
    const payload = {
      ...getBundledContent(),
      educationMaterials: [
        {
          ...resource,
          body: [
            { id: 'generic-video', kind: 'video' as const, title: 'Vídeo externo', url: 'https://example.com/video' },
          ],
        },
      ],
    };

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
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

    const paragraphText = screen.getByText((_, element) => {
      if (element?.tagName.toLowerCase() !== 'p') return false;
      const normalizedContent = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const normalizedExpected = paragraphBlock.text.replace(/\s+/g, ' ').trim();
      return normalizedContent === normalizedExpected;
    });
    expect(paragraphText).toHaveClass('text-justify');
  });

  it('ignores populated bemtevi:dev-dashboard:drafts:v1 bytes and renders only published content', () => {
    seedLegacyDashboardDraftBytes();
    const resource = firstShippedMaterial();

    renderWithContent(
      <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: resource.title })).toBeInTheDocument();
    expect(screen.queryByText('Material adicionado em teste')).not.toBeInTheDocument();
    expect(screen.queryByText(/versão de teste/i)).not.toBeInTheDocument();
  });
});
